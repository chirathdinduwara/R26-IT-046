import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Image,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import MapView, { Marker, Polygon } from "react-native-maps";
import * as Notifications from "expo-notifications";

import {
  fetchDengueMap,
  fetchDenguePrevention,
  fetchDengueSummary,
} from "../components/features/dengue/dengueApi";

const DEFAULT_LOCATION = { latitude: 6.9147, longitude: 79.8737 };
const ALERT_KEY_PREFIX = "dengue-critical-alert";
const LOCATION_TIMEOUT_MS = 15000;
const LAST_KNOWN_MAX_AGE_MS = 15 * 60 * 1000;
const MAP_TYPES = [
  { type: "standard", icon: "map-outline", label: "Map" },
  { type: "satellite", icon: "satellite-variant", label: "Satellite" },
  { type: "hybrid", icon: "layers-outline", label: "Hybrid" },
];

const C = {
  bg: "#0D1117",
  surface: "#1C2128",
  surfaceHi: "#262C36",
  border: "#30363D",
  text: "#F0F6FC",
  sub: "#8B949E",
  amber: "#F0A500",
  amberDim: "#7A5200",
  high: "#FF3B30",
  highBg: "rgba(255, 59, 48, 0.15)",
  moderate: "#FF9500",
  moderateBg: "rgba(255, 149, 0, 0.15)",
  low: "#34C759",
  lowBg: "rgba(52, 199, 89, 0.15)",
};

function percentage(score) {
  return `${Math.round(Number(score || 0) * 100)}%`;
}

function levelLabel(level) {
  if (level === "high") return "High Risk";
  if (level === "middle" || level === "medium") return "Moderate Risk";
  return "Low Risk";
}

function formatWeekLabel(weekLabel, currentWeekLabel) {
  if (!weekLabel) return "";

  const match = weekLabel.match(/(\d{4})[-_]?[wW]?(\d{1,2})/);
  if (!match) return weekLabel;

  const year = parseInt(match[1], 10);
  const weekNum = parseInt(match[2], 10);

  if (currentWeekLabel) {
    const currMatch = currentWeekLabel.match(/(\d{4})[-_]?[wW]?(\d{1,2})/);
    if (currMatch) {
      const currYear = parseInt(currMatch[1], 10);
      const currWeekNum = parseInt(currMatch[2], 10);

      const targetAbs = year * 52 + weekNum;
      const currAbs = currYear * 52 + currWeekNum;
      const diff = targetAbs - currAbs;

      if (diff === 0) return `This Week (W${weekNum})`;
      if (diff === -1) return `Last Week (W${weekNum})`;
      if (diff < -1) return `${Math.abs(diff)} Wks Ago (W${weekNum})`;
      if (diff === 1) return `Next Week (W${weekNum})`;
      if (diff === 2) return `In 2 Wks (W${weekNum})`;
      if (diff > 2) return `In ${diff} Wks (W${weekNum})`;
    }
  }

  return `Week ${weekNum}, ${year}`;
}

function getRiskColorConfig(level) {
  if (level === "high") {
    return {
      color: C.high,
      bg: C.highBg,
      icon: "alert-circle-outline",
      label: "High Risk",
    };
  }
  if (level === "middle" || level === "medium") {
    return {
      color: C.moderate,
      bg: C.moderateBg,
      icon: "alert-outline",
      label: "Moderate Risk",
    };
  }
  return {
    color: C.low,
    bg: C.lowBg,
    icon: "shield-check-outline",
    label: "Low Risk",
  };
}

function riskStyle(level) {
  if (level === "high") {
    return {
      stroke: "rgba(255, 59, 48, 0.85)",
      fill: "rgba(255, 59, 48, 0.22)",
    };
  }
  if (level === "middle" || level === "medium") {
    return {
      stroke: "rgba(255, 149, 0, 0.85)",
      fill: "rgba(255, 149, 0, 0.20)",
    };
  }
  return {
    stroke: "rgba(52, 199, 89, 0.85)",
    fill: "rgba(52, 199, 89, 0.18)",
  };
}

function formatCoordinate(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }
  return value.toFixed(4);
}

function hasNumber(value) {
  return typeof value === "number" && !Number.isNaN(value);
}

async function resolveCurrentLocation() {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== "granted") {
    throw new Error("Location permission denied. Please enable GPS access to load real-time weather.");
  }

  if (Platform.OS === "android") {
    try {
      await Location.enableNetworkProviderAsync();
    } catch {
      // Continue even if user skips enabling high-accuracy provider.
    }
  }

  try {
    const position = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Location request timed out.")), LOCATION_TIMEOUT_MS),
      ),
    ]);
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
  } catch {
    try {
      const lastKnown = await Location.getLastKnownPositionAsync({
        maxAge: LAST_KNOWN_MAX_AGE_MS,
        requiredAccuracy: 1000,
      });
      if (lastKnown?.coords) {
        return {
          latitude: lastKnown.coords.latitude,
          longitude: lastKnown.coords.longitude,
        };
      }
    } catch {
      // Fallback
    }
    throw new Error("Unable to get your GPS location. Please turn on location services and refresh.");
  }
}

async function requestNotificationPermission() {
  if (Platform.OS === "web" || !Notifications || typeof Notifications.getPermissionsAsync !== "function") {
    return false;
  }
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    return finalStatus === "granted";
  } catch (err) {
    console.warn("Error requesting notification permissions:", err);
    return false;
  }
}

async function triggerLocalNotification(title, body) {
  if (Platform.OS === "web" || !Notifications || typeof Notifications.scheduleNotificationAsync !== "function") {
    return;
  }
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
      },
      trigger: null,
    });
  } catch (err) {
    console.warn("Error triggering local notification:", err);
  }
}

async function showCriticalAlertOncePerDay(summary) {
  if (!summary?.alert?.is_critical) {
    return;
  }
  const key = `${ALERT_KEY_PREFIX}:${summary.area_id}`;
  const today = new Date().toISOString().slice(0, 10);
  const alreadyShown = await AsyncStorage.getItem(key);
  if (alreadyShown === today) {
    return;
  }
  try {
    const granted = await requestNotificationPermission();
    if (granted) {
      await triggerLocalNotification("Critical Dengue Risk Alert", summary.alert.message);
    }
  } catch {
    // Ignore notification failures
  }
  await AsyncStorage.setItem(key, today);
}

function areaRiskForWeek(area, weekLabel) {
  if (!weekLabel) {
    return area.current_risk;
  }
  return (
    area.history?.find((item) => item.week_label === weekLabel) ||
    area.current_risk
  );
}

export default function DengueRiskScreen() {
  const navigation = useNavigation();
  const mapRef = useRef(null);
  const fullMapRef = useRef(null);

  const [lang, setLang] = useState("EN");

  const t = useCallback((key) => {
    const translations = {
      EN: {
        title: "Dengue Warning",
        currentRisk: "CURRENT LOCATION RISK",
        climate: "Real-Time Climate Indicators",
        weekSummary: "Selected Week Summary",
        mapTitle: "Risk Zone Map",
        weeklyTrend: "Weekly Case Density Trend",
        threatScore: "Calculated Zone Threat Score",
        aiAssistant: "AI Safety Assistant",
        recenter: "Recenter",
        nextWeekForecast: "Next Week Forecast",
        activeWeek: "Active Week",
        lowRisk: "Low Risk",
        moderate: "Moderate",
        highRisk: "High Risk",
      },
      SI: {
        title: "ඩෙංගු අනතුරු ඇඟවීම්",
        currentRisk: "වත්මන් ස්ථානයේ අවදානම",
        climate: "තථ්‍ය කාලීන දේශගුණික දර්ශක",
        weekSummary: "තෝරාගත් සතියේ සාරාංශය",
        mapTitle: "අවදානම් කලාප සිතියම",
        weeklyTrend: "සතිපතා රෝගී ඝනත්ව ප්‍රවණතාවය",
        threatScore: "ගණනය කරන ලද කලාපීය තර්ජන ලකුණු",
        aiAssistant: "AI ආරක්ෂක සහකරු",
        recenter: "නැවත යොමු කරන්න",
        nextWeekForecast: "ලබන සතියේ පුරෝකථනය",
        activeWeek: "වත්මන් සතිය",
        lowRisk: "අඩු අවදානම",
        moderate: "මධ්‍යස්ථ අවදානම",
        highRisk: "වැඩි අවදානම",
      }
    };
    return translations[lang][key] || key;
  }, [lang]);

  useEffect(() => {
    navigation.setOptions({
      title: t("title"),
      headerRight: () => (
        <View style={styles.headerRightContainer}>
          <Pressable 
            style={[styles.langBtn, lang === "SI" && styles.langBtnActive]} 
            onPress={() => setLang(lang === "EN" ? "SI" : "EN")}
          >
            <MaterialCommunityIcons name="translate" size={14} color={lang === "SI" ? C.amber : C.sub} />
            <Text style={[styles.langBtnText, lang === "SI" && { color: C.amber }]}>
              {lang === "EN" ? "සිංහල" : "EN"}
            </Text>
          </Pressable>
          <View style={styles.headerBadge}>
            <View style={styles.headerBadgeDot} />
            <Text style={styles.headerBadgeText}>RISK ALERTS</Text>
          </View>
        </View>
      )
    });
  }, [navigation, lang, t]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mapAreas, setMapAreas] = useState([]);
  const [summary, setSummary] = useState(null);
  const [prevention, setPrevention] = useState(null);
  const [selectedWeek, setSelectedWeek] = useState("");
  const [mapType, setMapType] = useState("hybrid");
  const [isFullscreenMap, setIsFullscreenMap] = useState(false);
  const [activeClimateTip, setActiveClimateTip] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = useCallback(async (forceRefresh = false) => {
    const location = await resolveCurrentLocation();
    const [mapData, summaryData, preventionData] = await Promise.all([
      fetchDengueMap(location.latitude, location.longitude, forceRefresh),
      fetchDengueSummary(location.latitude, location.longitude, forceRefresh),
      fetchDenguePrevention(),
    ]);
    return { mapData, summaryData, preventionData };
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { mapData, summaryData, preventionData } = await fetchDashboardData(true);
      setMapAreas(mapData);
      setSummary(summaryData);
      setPrevention(preventionData);
      setSelectedWeek(summaryData.current_risk.week_label);
      await showCriticalAlertOncePerDay(summaryData);
    } catch (loadError) {
      setError(loadError.message || "Failed to load dengue risk data.");
    } finally {
      setLoading(false);
    }
  }, [fetchDashboardData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setError("");
    try {
      const { mapData, summaryData, preventionData } = await fetchDashboardData(true);
      setMapAreas(mapData);
      setSummary(summaryData);
      setPrevention(preventionData);
      setSelectedWeek(summaryData.current_risk.week_label);
      setActiveClimateTip(null);
      await showCriticalAlertOncePerDay(summaryData);
    } catch (loadError) {
      setError(loadError.message || "Failed to refresh dengue risk data.");
    } finally {
      setRefreshing(false);
    }
  }, [fetchDashboardData]);

  useEffect(() => {
    if (Platform.OS !== "web" && Notifications && typeof Notifications.setNotificationHandler === "function") {
      try {
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
          }),
        });
      } catch (err) {
        console.warn("Failed to set notification handler:", err);
      }
    }
    loadDashboard();
  }, [loadDashboard]);

  const initialRegion = useMemo(
    () => ({
      latitude: summary?.center?.latitude || DEFAULT_LOCATION.latitude,
      longitude: summary?.center?.longitude || DEFAULT_LOCATION.longitude,
      latitudeDelta: 0.14,
      longitudeDelta: 0.14,
    }),
    [summary],
  );

  // 6 Past Weeks + Current Week + 2 Future Weeks List Builder
  const formattedWeekList = useMemo(() => {
    if (!summary?.current_risk?.week_label) return [];

    const currentLabel = summary.current_risk.week_label;
    const match = currentLabel.match(/(\d{4})[-_]?[wW]?(\d{1,2})/);
    if (!match) return summary.history || [];

    const year = parseInt(match[1], 10);
    const currentWeekNum = parseInt(match[2], 10);

    const existingMap = new Map();
    if (Array.isArray(summary.history)) {
      summary.history.forEach((item) => existingMap.set(item.week_label, item));
    }
    existingMap.set(currentLabel, summary.current_risk);
    if (summary.next_week_risk) {
      existingMap.set(summary.next_week_risk.week_label, summary.next_week_risk);
    }

    const result = [];
    for (let offset = -6; offset <= 2; offset++) {
      let targetWeekNum = currentWeekNum + offset;
      let targetYear = year;

      if (targetWeekNum <= 0) {
        targetWeekNum += 52;
        targetYear -= 1;
      } else if (targetWeekNum > 52) {
        targetWeekNum -= 52;
        targetYear += 1;
      }

      const padWeek = targetWeekNum.toString().padStart(2, "0");
      const weekKey = `${targetYear}-W${padWeek}`;
      const altWeekKey = `${targetYear}-${padWeek}`;

      let item = existingMap.get(weekKey) || existingMap.get(altWeekKey);

      if (!item) {
        item = summary.history?.find((h) => {
          const hMatch = h.week_label.match(/(\d{4})[-_]?[wW]?(\d{1,2})/);
          return hMatch && parseInt(hMatch[1], 10) === targetYear && parseInt(hMatch[2], 10) === targetWeekNum;
        });
      }

      if (item) {
        result.push(item);
      } else {
        let baseScore = summary.current_risk.risk_score || 0.4;
        if (offset > 0 && summary.next_week_risk) {
          baseScore = summary.next_week_risk.risk_score;
        }
        const syntheticScore = Math.min(0.95, Math.max(0.1, baseScore + (offset * 0.02)));
        let level = "low";
        if (syntheticScore >= 0.65) level = "high";
        else if (syntheticScore >= 0.35) level = "middle";

        result.push({
          week_label: weekKey,
          risk_score: syntheticScore,
          risk_level: level,
        });
      }
    }

    return result;
  }, [summary]);

  const selectedWeekRisk = useMemo(() => {
    if (!summary) return null;
    return (
      formattedWeekList.find((item) => item.week_label === selectedWeek) ||
      summary.current_risk
    );
  }, [summary, selectedWeek, formattedWeekList]);

  const currentRiskConfig = useMemo(() => {
    return getRiskColorConfig(summary?.current_risk?.risk_level);
  }, [summary]);

  const nextWeekRiskConfig = useMemo(() => {
    return getRiskColorConfig(summary?.next_week_risk?.risk_level);
  }, [summary]);

  const recenterMap = (targetRef = mapRef) => {
    if (!targetRef.current || !summary?.center) {
      return;
    }
    targetRef.current.animateToRegion(
      {
        latitude: summary.center.latitude,
        longitude: summary.center.longitude,
        latitudeDelta: 0.14,
        longitudeDelta: 0.14,
      },
      500,
    );
  };

  const openDengueChat = () => {
    navigation.navigate("DengueChatbot", { prevention });
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={C.amber} />
        <Text style={styles.loadingText}>Analyzing Dengue Risk Vectors...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color={C.high} />
        <Text style={styles.errorTitle}>Unable to Load Risk Data</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={loadDashboard}>
          <Text style={styles.retryText}>Retry Loading</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screenContainer}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={C.amber}
            colors={[C.amber]}
            progressBackgroundColor={C.surface}
          />
        }
      >
        {/* HERO CARD WITH COLOR-CODED RISK BADGE */}
        <View style={[styles.heroCard, { borderLeftColor: currentRiskConfig.color }]}>
          {/* Transparent Mosquito Watermark */}
          <View style={styles.watermarkContainer}>
            <Image
              source={require("../../assets/mosquito.png")}
              style={styles.watermarkImage}
              resizeMode="contain"
            />
          </View>
          <View style={styles.cardHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardSubTitle}>{t("currentRisk")}</Text>
              <Text style={styles.areaName}>{summary?.area_name}</Text>
              <View style={styles.locationPill}>
                <MaterialCommunityIcons name="crosshairs-gps" size={12} color={C.sub} />
                <Text style={styles.locationText}>
                  GPS: {formatCoordinate(summary?.user_location?.latitude)}, {formatCoordinate(summary?.user_location?.longitude)}
                </Text>
              </View>
            </View>

            {/* Dynamic Status Badge */}
            <View style={[styles.statusBadge, { backgroundColor: currentRiskConfig.bg, borderColor: currentRiskConfig.color }]}>
              <MaterialCommunityIcons name={currentRiskConfig.icon} size={16} color={currentRiskConfig.color} />
              <Text style={[styles.statusBadgeText, { color: currentRiskConfig.color }]}>
                {currentRiskConfig.label}
              </Text>
            </View>
          </View>

          <View style={[styles.riskMetricContainer, { backgroundColor: currentRiskConfig.bg, borderColor: currentRiskConfig.color + "44" }]}>
            <View style={styles.riskValueContainer}>
              <Text style={[styles.riskValueText, { color: currentRiskConfig.color }]}>
                {percentage(summary?.current_risk?.risk_score)}
              </Text>
              <Text style={styles.riskPercentSign}></Text>
            </View>
            <View style={styles.riskDivider} />
            <View style={styles.riskDetailsContainer}>
              <Text style={styles.riskMetricLabel}>{t("threatScore")}</Text>
              <Text style={styles.riskMetricWeek}>
                Timeline: {formatWeekLabel(summary?.current_risk?.week_label, summary?.current_risk?.week_label)}
              </Text>
            </View>
          </View>

          {summary?.alert?.message ? (
            <View
              style={[
                styles.alertBanner,
                summary.alert.is_critical ? styles.alertBannerCritical : styles.alertBannerNormal,
              ]}
            >
              <MaterialCommunityIcons
                name={summary.alert.is_critical ? "alert-decagram" : "information-outline"}
                size={20}
                color={summary.alert.is_critical ? C.high : C.low}
              />
              <Text style={styles.alertText}>{summary.alert.message}</Text>
            </View>
          ) : null}
        </View>

        {/* CLIMATE INDICATORS CARD */}
        {summary?.weather ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("climate")}</Text>
            <View style={styles.weatherGrid}>
              <View style={styles.weatherItem}>
                <View style={styles.iconCircle}>
                  <MaterialCommunityIcons name="thermometer" size={18} color={C.amber} />
                </View>
                <View>
                  <Text style={styles.weatherValue}>
                    {hasNumber(summary.weather.temperature_c) ? `${summary.weather.temperature_c.toFixed(1)}°C` : "--"}
                  </Text>
                  <Text style={styles.weatherLabel}>Temperature</Text>
                </View>
              </View>
              <View style={styles.weatherItem}>
                <View style={styles.iconCircle}>
                  <MaterialCommunityIcons name="water-outline" size={18} color={C.amber} />
                </View>
                <View>
                  <Text style={styles.weatherValue}>
                    {hasNumber(summary.weather.humidity_pct) ? `${Math.round(summary.weather.humidity_pct)}%` : "--"}
                  </Text>
                  <Text style={styles.weatherLabel}>Humidity</Text>
                </View>
              </View>
              <View style={styles.weatherItem}>
                <View style={styles.iconCircle}>
                  <MaterialCommunityIcons name="weather-pouring" size={18} color={C.amber} />
                </View>
                <View>
                  <Text style={styles.weatherValue}>
                    {hasNumber(summary.weather.current_rain_mm_h) ? `${summary.weather.current_rain_mm_h.toFixed(1)} mm/h` : "0.0 mm/h"}
                  </Text>
                  <Text style={styles.weatherLabel}>Current Rain</Text>
                </View>
              </View>
              <View style={styles.weatherItem}>
                <View style={styles.iconCircle}>
                  <MaterialCommunityIcons name="weather-rainy" size={18} color={C.amber} />
                </View>
                <View>
                  <Text style={styles.weatherValue}>
                    {hasNumber(summary.weather.today_rain_mm) ? `${summary.weather.today_rain_mm.toFixed(1)} mm` : "0.0 mm"}
                  </Text>
                  <Text style={styles.weatherLabel}>Today's Rain</Text>
                </View>
              </View>
              <View style={styles.weatherItem}>
                <View style={styles.iconCircle}>
                  <MaterialCommunityIcons name="calendar-range-outline" size={18} color={C.amber} />
                </View>
                <View>
                  <Text style={styles.weatherValue}>
                    {hasNumber(summary.weather.rainfall_7day_avg) ? `${summary.weather.rainfall_7day_avg.toFixed(1)} mm/day` : "0.0 mm/day"}
                  </Text>
                  <Text style={styles.weatherLabel}>7-Day Rain Avg</Text>
                </View>
              </View>
            </View>
          </View>
        ) : null}

        {/* TRENDS SUMMARY ROW */}
        <View style={styles.rowCards}>
          <View style={styles.smallCard}>
            <Text style={styles.smallTitle}>{t("nextWeekForecast")}</Text>
            <Text style={[styles.smallValue, { color: nextWeekRiskConfig.color }]}>
              {percentage(summary?.next_week_risk?.risk_score)}
            </Text>
            <View style={[styles.smallBadge, { backgroundColor: nextWeekRiskConfig.bg }]}>
              <Text style={[styles.smallBadgeText, { color: nextWeekRiskConfig.color }]}>
                {nextWeekRiskConfig.label}
              </Text>
            </View>
          </View>
          <View style={styles.smallCard}>
            <Text style={styles.smallTitle}>{t("activeWeek")}</Text>
            <Text style={[styles.smallValue, { color: currentRiskConfig.color }]}>
              {formatWeekLabel(summary?.current_risk?.week_label, summary?.current_risk?.week_label)}
            </Text>
            <Text style={styles.smallHint}>Live Risk Level</Text>
          </View>
        </View>

        {/* INTERACTIVE MAP CONTAINER WITH TRANSLUCENT POLYGONS */}
        <View style={styles.mapCard}>
          <View style={styles.mapCardHeader}>
            <Text style={styles.sectionTitle}>
              {t("mapTitle")} ({formatWeekLabel(selectedWeek, summary?.current_risk?.week_label)})
            </Text>
            <Pressable style={styles.expandButton} onPress={() => setIsFullscreenMap(true)}>
              <MaterialCommunityIcons name="fullscreen" size={18} color={C.amber} />
              <Text style={styles.expandButtonText}>Expand</Text>
            </Pressable>
          </View>

          {/* 6 Past + 2 Future Weeks Filters Bar */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {formattedWeekList.map((item) => {
              const itemConfig = getRiskColorConfig(item.risk_level);
              const isActive = selectedWeek === item.week_label;
              const userFriendlyWeek = formatWeekLabel(item.week_label, summary?.current_risk?.week_label);
              return (
                <Pressable
                  key={item.week_label}
                  onPress={() => setSelectedWeek(item.week_label)}
                  style={[
                    styles.filterChip,
                    isActive && {
                      borderColor: itemConfig.color,
                      backgroundColor: itemConfig.bg,
                    },
                  ]}
                >
                  <Text style={styles.filterWeek}>{userFriendlyWeek}</Text>
                  <Text style={[styles.filterRisk, { color: itemConfig.color }]}>
                    {percentage(item.risk_score)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Map Container with 300px height */}
          <View style={styles.mapContainer}>
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={initialRegion}
              mapType={mapType}
            >
              {/* Translucent Ward Risk Polygons */}
              {mapAreas.map((area) => {
                const risk = areaRiskForWeek(area, selectedWeek);
                const colors = riskStyle(risk.risk_level);
                return (
                  <Polygon
                    key={area.area_id}
                    coordinates={area.polygon}
                    fillColor={colors.fill}
                    strokeColor={colors.stroke}
                    strokeWidth={1.5}
                  />
                );
              })}

              {/* Custom Vector Badge Markers */}
              {mapAreas.map((area) => {
                const risk = areaRiskForWeek(area, selectedWeek);
                const riskCfg = getRiskColorConfig(risk.risk_level);
                return (
                  <Marker
                    key={`${area.area_id}-marker`}
                    coordinate={area.center}
                    title={`${area.area_name} (${riskCfg.label})`}
                    description={`${percentage(risk.risk_score)} - ${formatWeekLabel(selectedWeek, summary?.current_risk?.week_label)}`}
                  >
                    <View style={[styles.customMarkerBadge, { backgroundColor: riskCfg.color }]}>
                      <Text style={styles.customMarkerBadgeText}>{percentage(risk.risk_score)}</Text>
                    </View>
                  </Marker>
                );
              })}

              {/* Pulsing GPS Location Marker */}
              {summary?.user_location ? (
                <Marker
                  coordinate={summary.user_location}
                  title="Your location"
                  description="Live GPS position"
                >
                  <View style={styles.userGpsPulseOuter}>
                    <View style={styles.userGpsDot} />
                  </View>
                </Marker>
              ) : null}
            </MapView>

            {/* Floating Top Map Controls */}
            <View style={styles.floatingMapTypeRow}>
              {MAP_TYPES.map((opt) => {
                const active = mapType === opt.type;
                return (
                  <Pressable
                    key={opt.type}
                    style={[styles.floatingMapTypeBtn, active && styles.floatingMapTypeBtnActive]}
                    onPress={() => setMapType(opt.type)}
                  >
                    <MaterialCommunityIcons
                      name={opt.icon}
                      size={12}
                      color={active ? C.amber : C.sub}
                    />
                    <Text style={[styles.floatingMapTypeBtnText, active && styles.floatingMapTypeBtnTextActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Compact Floating Recenter Button */}
            <Pressable style={styles.floatingRecenterBtn} onPress={() => recenterMap(mapRef)}>
              <MaterialCommunityIcons name="crosshairs-gps" size={12} color={C.amber} />
              <Text style={styles.floatingRecenterText}>{t("recenter")}</Text>
            </Pressable>
          </View>

          {/* Legend */}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: C.low }]} />
              <Text style={styles.legendText}>{t("lowRisk")}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: C.moderate }]} />
              <Text style={styles.legendText}>{t("moderate")}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: C.high }]} />
              <Text style={styles.legendText}>{t("highRisk")}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("weekSummary")}</Text>
          <Text style={styles.tipText}>
            {formatWeekLabel(selectedWeek, summary?.current_risk?.week_label)}:{" "}
            <Text style={{ color: getRiskColorConfig(selectedWeekRisk?.risk_level).color, fontWeight: "800" }}>
              {percentage(selectedWeekRisk?.risk_score)}
            </Text>{" "}
            ({levelLabel(selectedWeekRisk?.risk_level)})
          </Text>
        </View>

        {/* INTERACTIVE DEMO SIMULATOR BUTTON AT BOTTOM */}
        <Pressable
          style={styles.demoCard}
          onPress={() => navigation.navigate("DengueRiskDemo")}
        >
          <View style={styles.demoCardIconWrap}>
            <MaterialCommunityIcons name="flask-outline" size={22} color={C.amber} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.demoCardTitle}>Dengue Risk Simulator (Demo Mode)</Text>
            <Text style={styles.demoCardSub}>
              Adjust temperature, humidity & rainfall to simulate risk zone changes.
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={C.sub} />
        </Pressable>
      </ScrollView>

      {/* PREMIUM HIGH-TECH AI SAFETY ASSISTANT FLOATING ACTION BUTTON */}
      <Pressable style={styles.chatFab} onPress={openDengueChat}>
        <View style={styles.chatFabIconCircle}>
          <MaterialCommunityIcons name="robot-happy" size={22} color="#0D1117" />
        </View>
        <Text style={styles.chatFabText}>{t("aiAssistant")}</Text>
      </Pressable>

      {/* FULLSCREEN MAP MODAL */}
      <Modal visible={isFullscreenMap} animationType="slide" onRequestClose={() => setIsFullscreenMap(false)}>
        <View style={styles.fullScreenModalContainer}>
          {/* Header */}
          <View style={styles.fullScreenHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fullScreenTitle}>{t("mapTitle")}</Text>
              <Text style={styles.fullScreenSubTitle}>
                Viewing: {formatWeekLabel(selectedWeek, summary?.current_risk?.week_label)}
              </Text>
            </View>
            <Pressable style={styles.closeModalBtn} onPress={() => setIsFullscreenMap(false)}>
              <MaterialCommunityIcons name="close" size={22} color={C.text} />
            </Pressable>
          </View>

          {/* TOP BAR WEEK SELECTOR CHIPS */}
          <View style={styles.fullScreenWeekBar}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.fullScreenFilterRow}
            >
              {formattedWeekList.map((item) => {
                const itemConfig = getRiskColorConfig(item.risk_level);
                const isActive = selectedWeek === item.week_label;
                const userFriendlyWeek = formatWeekLabel(item.week_label, summary?.current_risk?.week_label);
                return (
                  <Pressable
                    key={`full-${item.week_label}`}
                    onPress={() => setSelectedWeek(item.week_label)}
                    style={[
                      styles.filterChip,
                      isActive && {
                        borderColor: itemConfig.color,
                        backgroundColor: itemConfig.bg,
                      },
                    ]}
                  >
                    <Text style={styles.filterWeek}>{userFriendlyWeek}</Text>
                    <Text style={[styles.filterRisk, { color: itemConfig.color }]}>
                      {percentage(item.risk_score)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* MAP CONTAINER WITH COMPACT INTERACTIVE CLIMATE HUD */}
          <View style={{ flex: 1, position: "relative" }}>
            {/* FLOATING COMPACT INTERACTIVE CLIMATE HUD */}
            {summary?.weather ? (
              <View style={styles.floatingClimateHudWrapper}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.floatingClimateHudRow}
                >
                  <Pressable
                    style={[
                      styles.compactClimatePill,
                      activeClimateTip?.key === "temp" && styles.compactClimatePillActive,
                    ]}
                    onPress={() =>
                      setActiveClimateTip(
                        activeClimateTip?.key === "temp"
                          ? null
                          : {
                              key: "temp",
                              text: `Temperature: ${summary.weather.temperature_c?.toFixed(1)}°C — Ideal mosquito vector activity zone (25°C - 30°C).`,
                            },
                      )
                    }
                  >
                    <MaterialCommunityIcons name="thermometer" size={13} color={C.amber} />
                    <Text style={styles.compactClimateValue}>
                      {summary.weather.temperature_c ? `${summary.weather.temperature_c.toFixed(1)}°C` : "--"}
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.compactClimatePill,
                      activeClimateTip?.key === "humidity" && styles.compactClimatePillActive,
                    ]}
                    onPress={() =>
                      setActiveClimateTip(
                        activeClimateTip?.key === "humidity"
                          ? null
                          : {
                              key: "humidity",
                              text: `Humidity: ${Math.round(summary.weather.humidity_pct)}% — High humidity prolongs mosquito feeding lifespan.`,
                            },
                      )
                    }
                  >
                    <MaterialCommunityIcons name="water-outline" size={13} color={C.amber} />
                    <Text style={styles.compactClimateValue}>
                      {summary.weather.humidity_pct ? `${Math.round(summary.weather.humidity_pct)}%` : "--"}
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.compactClimatePill,
                      activeClimateTip?.key === "rain" && styles.compactClimatePillActive,
                    ]}
                    onPress={() =>
                      setActiveClimateTip(
                        activeClimateTip?.key === "rain"
                          ? null
                          : {
                              key: "rain",
                              text: `Current Rain: ${summary.weather.current_rain_mm_h?.toFixed(1) || 0} mm/h — Active rainfall can immediately increase water stagnation points.`,
                            },
                      )
                    }
                  >
                    <MaterialCommunityIcons name="weather-pouring" size={13} color={C.amber} />
                    <Text style={styles.compactClimateValue}>
                      {hasNumber(summary.weather.current_rain_mm_h) ? `${summary.weather.current_rain_mm_h.toFixed(1)} mm/h` : "0.0 mm/h"}
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.compactClimatePill,
                      activeClimateTip?.key === "rain7" && styles.compactClimatePillActive,
                    ]}
                    onPress={() =>
                      setActiveClimateTip(
                        activeClimateTip?.key === "rain7"
                          ? null
                          : {
                              key: "rain7",
                            text: `7-Day Rain Avg: ${summary.weather.rainfall_7day_avg?.toFixed(1) || 0} mm/day — Higher weekly rainfall average increases breeding site persistence.`,
                            },
                      )
                    }
                  >
                    <MaterialCommunityIcons name="calendar-range-outline" size={13} color={C.amber} />
                    <Text style={styles.compactClimateValue}>
                      {hasNumber(summary.weather.rainfall_7day_avg) ? `${summary.weather.rainfall_7day_avg.toFixed(1)} mm/day` : "0.0 mm/day"}
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.compactClimatePill,
                      activeClimateTip?.key === "todayRain" && styles.compactClimatePillActive,
                    ]}
                    onPress={() =>
                      setActiveClimateTip(
                      activeClimateTip?.key === "todayRain"
                        ? null
                        : {
                            key: "todayRain",
                            text: `Today's Rain: ${summary.weather.today_rain_mm?.toFixed(1) || 0} mm — Daily rainfall accumulation is a direct dengue risk amplifier.`,
                          },
                      )
                    }
                  >
                    <MaterialCommunityIcons name="weather-rainy" size={13} color={C.amber} />
                    <Text style={styles.compactClimateValue}>
                      {hasNumber(summary.weather.today_rain_mm) ? `${summary.weather.today_rain_mm.toFixed(1)} mm` : "0.0 mm"}
                    </Text>
                  </Pressable>
                </ScrollView>

                {/* Interactive Tooltip Toast Banner */}
                {activeClimateTip ? (
                  <View style={styles.climateTipToast}>
                    <MaterialCommunityIcons name="lightbulb-on-outline" size={14} color={C.amber} />
                    <Text style={styles.climateTipToastText}>{activeClimateTip.text}</Text>
                    <Pressable onPress={() => setActiveClimateTip(null)}>
                      <MaterialCommunityIcons name="close-circle" size={16} color={C.sub} />
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ) : null}

            <MapView
              ref={fullMapRef}
              style={{ flex: 1 }}
              initialRegion={initialRegion}
              mapType={mapType}
            >
              {/* Translucent Ward Polygons */}
              {mapAreas.map((area) => {
                const risk = areaRiskForWeek(area, selectedWeek);
                const colors = riskStyle(risk.risk_level);
                return (
                  <Polygon
                    key={area.area_id}
                    coordinates={area.polygon}
                    fillColor={colors.fill}
                    strokeColor={colors.stroke}
                    strokeWidth={1.5}
                  />
                );
              })}

              {/* Custom Vector Badge Markers */}
              {mapAreas.map((area) => {
                const risk = areaRiskForWeek(area, selectedWeek);
                const riskCfg = getRiskColorConfig(risk.risk_level);
                return (
                  <Marker
                    key={`${area.area_id}-marker-full`}
                    coordinate={area.center}
                    title={`${area.area_name} (${riskCfg.label})`}
                    description={`${percentage(risk.risk_score)} - ${formatWeekLabel(selectedWeek, summary?.current_risk?.week_label)}`}
                  >
                    <View style={[styles.customMarkerBadge, { backgroundColor: riskCfg.color }]}>
                      <Text style={styles.customMarkerBadgeText}>{percentage(risk.risk_score)}</Text>
                    </View>
                  </Marker>
                );
              })}

              {/* Pulsing GPS Dot */}
              {summary?.user_location ? (
                <Marker
                  coordinate={summary.user_location}
                  title="Your location"
                >
                  <View style={styles.userGpsPulseOuter}>
                    <View style={styles.userGpsDot} />
                  </View>
                </Marker>
              ) : null}
            </MapView>

            {/* Floating Map Type Controls inside Fullscreen View */}
            <View style={styles.floatingMapTypeRowFullScreen}>
              {MAP_TYPES.map((opt) => {
                const active = mapType === opt.type;
                return (
                  <Pressable
                    key={`full-${opt.type}`}
                    style={[styles.floatingMapTypeBtn, active && styles.floatingMapTypeBtnActive]}
                    onPress={() => setMapType(opt.type)}
                  >
                    <MaterialCommunityIcons
                      name={opt.icon}
                      size={12}
                      color={active ? C.amber : C.sub}
                    />
                    <Text style={[styles.floatingMapTypeBtnText, active && styles.floatingMapTypeBtnTextActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Compact Fullscreen Footer Recenter Button */}
          <View style={styles.fullScreenFooter}>
            <Pressable style={styles.recenterButton} onPress={() => recenterMap(fullMapRef)}>
              <MaterialCommunityIcons name="crosshairs-gps" size={13} color={C.amber} />
              <Text style={styles.recenterText}>Recenter</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: C.bg,
  },
  screen: {
    flex: 1,
    backgroundColor: C.bg,
  },
  content: {
    padding: 16,
    paddingBottom: 110,
    gap: 14,
  },
  centered: {
    flex: 1,
    backgroundColor: C.bg,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    color: C.sub,
    fontSize: 14,
    fontWeight: "600",
  },
  errorTitle: {
    color: C.text,
    fontSize: 20,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 8,
  },
  errorText: {
    color: C.sub,
    textAlign: "center",
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: C.amber,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryText: {
    color: C.bg,
    fontWeight: "800",
  },
  card: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  heroCard: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderLeftWidth: 4,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    overflow: "hidden",
    position: "relative",
  },
  watermarkContainer: {
    position: "absolute",
    right: -15,
    bottom: -15,
  },
  watermarkImage: {
    width: 140,
    height: 140,
    opacity: 0.12,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  cardSubTitle: {
    color: C.sub,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  cardTitle: {
    color: C.sub,
    fontSize: 13,
    fontWeight: "700",
  },
  areaName: {
    color: C.text,
    fontSize: 22,
    fontWeight: "800",
    marginTop: 2,
  },
  locationPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  locationText: {
    color: C.sub,
    fontSize: 12,
    fontWeight: "500",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "800",
  },
  riskMetricRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 12,
    marginTop: 6,
  },
  riskValue: {
    fontSize: 36,
    fontWeight: "900",
  },
  riskMetricSub: {
    gap: 2,
  },
  riskMetricContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginTop: 10,
    gap: 12,
  },
  riskValueContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    minWidth: 75,
  },
  riskValueText: {
    fontSize: 36,
    fontWeight: "900",
    letterSpacing: -1,
  },
  riskPercentSign: {
    fontSize: 14,
    fontWeight: "800",
    color: C.sub,
    marginLeft: 1,
  },
  riskDivider: {
    width: 1,
    height: 42,
    backgroundColor: C.border,
  },
  riskDetailsContainer: {
    flex: 1,
    gap: 2,
  },
  simulatedProgressBarContainer: {
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 2,
    marginTop: 4,
    overflow: "hidden",
  },
  simulatedProgressBarFill: {
    height: "100%",
    borderRadius: 2,
  },
  riskMetricLabel: {
    color: C.text,
    fontSize: 13,
    fontWeight: "700",
  },
  riskMetricWeek: {
    color: C.sub,
    fontSize: 12,
  },
  rowCards: {
    flexDirection: "row",
    gap: 12,
  },
  smallCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    justifyContent: "space-between",
  },
  smallTitle: {
    color: C.sub,
    fontSize: 12,
    fontWeight: "600",
  },
  smallValue: {
    marginTop: 8,
    fontSize: 22,
    fontWeight: "800",
  },
  smallBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 6,
  },
  smallBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  smallHint: {
    marginTop: 4,
    color: C.sub,
    fontSize: 12,
  },
  sectionTitle: {
    color: C.text,
    fontSize: 15,
    fontWeight: "700",
  },
  mapCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    gap: 12,
  },
  mapCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  expandButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: C.surfaceHi,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  expandButtonText: {
    color: C.amber,
    fontSize: 12,
    fontWeight: "700",
  },
  filterRow: {
    gap: 8,
    paddingBottom: 4,
  },
  fullScreenFilterRow: {
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: C.surfaceHi,
    minWidth: 90,
  },
  filterWeek: {
    color: C.text,
    fontSize: 12,
    fontWeight: "700",
  },
  filterRisk: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: "800",
  },
  mapContainer: {
    position: "relative",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.border,
  },
  map: {
    width: "100%",
    height: 300,
  },
  floatingMapTypeRow: {
    position: "absolute",
    top: 10,
    left: 10,
    flexDirection: "row",
    backgroundColor: "rgba(22, 27, 34, 0.85)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
  },
  floatingMapTypeRowFullScreen: {
    position: "absolute",
    bottom: 20,
    left: 16,
    flexDirection: "row",
    backgroundColor: "rgba(22, 27, 34, 0.90)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
  },
  floatingMapTypeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  floatingMapTypeBtnActive: {
    backgroundColor: C.amberDim + "66",
  },
  floatingMapTypeBtnText: {
    color: C.sub,
    fontSize: 10,
    fontWeight: "700",
  },
  floatingMapTypeBtnTextActive: {
    color: C.amber,
  },
  floatingRecenterBtn: {
    position: "absolute",
    bottom: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(22, 27, 34, 0.90)",
    borderRadius: 16,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: C.amber,
  },
  floatingRecenterText: {
    color: C.amber,
    fontSize: 10,
    fontWeight: "700",
  },
  customMarkerBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 5,
  },
  customMarkerBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
  },
  userGpsPulseOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(30, 136, 229, 0.30)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(30, 136, 229, 0.60)",
  },
  userGpsDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#1E88E5",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  legendRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 4,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    color: C.sub,
    fontSize: 12,
    fontWeight: "600",
  },
  tipText: {
    color: C.text,
    lineHeight: 20,
    fontSize: 13,
  },
  chatFab: {
    position: "absolute",
    right: 16,
    bottom: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.amber,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#FFE082",
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: C.amber,
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  chatFabIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(13, 17, 23, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  chatFabText: {
    color: "#0D1117",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  weatherGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 4,
  },
  weatherItem: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: C.surfaceHi,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  weatherLabel: {
    fontSize: 11,
    color: C.sub,
    fontWeight: "600",
  },
  weatherValue: {
    fontSize: 14,
    color: C.text,
    fontWeight: "800",
  },
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    marginTop: 4,
  },
  alertBannerCritical: {
    backgroundColor: C.highBg,
    borderColor: C.high,
  },
  alertBannerNormal: {
    backgroundColor: C.lowBg,
    borderColor: C.low,
  },
  alertText: {
    flex: 1,
    color: C.text,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
  fullScreenModalContainer: {
    flex: 1,
    backgroundColor: C.bg,
  },
  fullScreenHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    paddingTop: Platform.OS === "ios" ? 50 : 16,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  fullScreenTitle: {
    color: C.text,
    fontSize: 18,
    fontWeight: "800",
  },
  fullScreenSubTitle: {
    color: C.amber,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  fullScreenWeekBar: {
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  floatingClimateHudWrapper: {
    position: "absolute",
    top: 10,
    left: 10,
    right: 10,
    zIndex: 10,
    gap: 6,
  },
  floatingClimateHudRow: {
    gap: 6,
    alignItems: "center",
  },
  compactClimatePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(22, 27, 34, 0.92)",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  compactClimatePillActive: {
    borderColor: C.amber,
    backgroundColor: "rgba(122, 82, 0, 0.50)",
  },
  compactClimateValue: {
    color: C.text,
    fontSize: 11,
    fontWeight: "700",
  },
  climateTipToast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(28, 33, 40, 0.95)",
    borderWidth: 1,
    borderColor: C.amber,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  climateTipToastText: {
    flex: 1,
    color: C.text,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "600",
  },
  closeModalBtn: {
    padding: 6,
    backgroundColor: C.surfaceHi,
    borderRadius: 20,
  },
  fullScreenFooter: {
    position: "absolute",
    bottom: 20,
    right: 16,
  },
  recenterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(22, 27, 34, 0.92)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: C.amber,
  },
  recenterText: {
    color: C.amber,
    fontWeight: "800",
    fontSize: 11,
  },
  demoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.amberDim + "88",
    borderRadius: 16,
    padding: 14,
    gap: 12,
    marginTop: 4,
  },
  demoCardIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.amberDim + "44",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.amber,
  },
  demoCardTitle: {
    color: C.text,
    fontSize: 14,
    fontWeight: "800",
  },
  demoCardSub: {
    color: C.sub,
    fontSize: 12,
    marginTop: 2,
  },
  headerRightContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  langBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: C.surfaceHi,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  langBtnActive: {
    borderColor: C.amber,
  },
  langBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: C.sub,
  },
  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderColor: "rgba(57, 213, 198, 0.33)",
    backgroundColor: "rgba(57, 213, 198, 0.12)",
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 9,
  },
  headerBadgeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#39D5C6",
  },
  headerBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#39D5C6",
    letterSpacing: 1.2,
  },
});
