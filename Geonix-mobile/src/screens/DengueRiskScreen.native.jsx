import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  ImageBackground,
  Modal,
  Animated,
  Easing,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
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
  bg: "#080C12",
  surface: "#111720",
  surfaceHi: "#1A2030",
  surfaceMid: "#161C28",
  border: "#252D3D",
  borderLight: "#2E3850",
  text: "#EEF2FF",
  textSoft: "#C8D0E0",
  sub: "#6B7A99",
  subLight: "#8896B8",
  amber: "#F5A623",
  amberDim: "#7A4A00",
  amberGlow: "rgba(245, 166, 35, 0.18)",
  high: "#FF453A",
  highBg: "rgba(255, 69, 58, 0.14)",
  highGlow: "rgba(255, 69, 58, 0.35)",
  moderate: "#FF9F0A",
  moderateBg: "rgba(255, 159, 10, 0.14)",
  low: "#30D158",
  lowBg: "rgba(48, 209, 88, 0.14)",
  blue: "#0A84FF",
  teal: "#39D5C6",
  tealBg: "rgba(57, 213, 198, 0.12)",
};

/* ───────────────────────── helpers (unchanged logic) ───────────────────────── */

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
    throw new Error(
      "Location permission denied. Please enable GPS access to load real-time weather.",
    );
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
        setTimeout(
          () => reject(new Error("Location request timed out.")),
          LOCATION_TIMEOUT_MS,
        ),
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
    throw new Error(
      "Unable to get your GPS location. Please turn on location services and refresh.",
    );
  }
}

async function requestNotificationPermission() {
  if (
    Platform.OS === "web" ||
    !Notifications ||
    typeof Notifications.getPermissionsAsync !== "function"
  ) {
    return false;
  }
  try {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
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
  if (
    Platform.OS === "web" ||
    !Notifications ||
    typeof Notifications.scheduleNotificationAsync !== "function"
  ) {
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
      await triggerLocalNotification(
        "Critical Dengue Risk Alert",
        summary.alert.message,
      );
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

/* Dark overlay over the photo, tinted by risk level (UI only) */
function heroOverlay(level) {
  if (level === "high")
    return ["rgba(40,8,12,0.75)", "rgba(24,10,16,0.62)", "rgba(8,12,18,0.97)"];
  if (level === "middle" || level === "medium")
    return ["rgba(45,24,4,0.75)", "rgba(28,16,10,0.62)", "rgba(8,12,18,0.97)"];
  return ["rgba(4,36,24,0.75)", "rgba(8,24,22,0.62)", "rgba(8,12,18,0.97)"];
}

/* ───────────────────────────────── screen ───────────────────────────────── */

export default function DengueRiskScreen() {
  const navigation = useNavigation();
  const mapRef = useRef(null);
  const fullMapRef = useRef(null);

  const [lang, setLang] = useState("EN");

  const t = useCallback(
    (key) => {
      const translations = {
        EN: {
          title: "Dengue Warning",
          currentRisk: "CURRENT LOCATION RISK",
          climate: "Real-Time Climate Indicators",
          weekSummary: "Selected Week Summary",
          mapTitle: "Risk Zone Map",
          weeklyTrend: "Weekly Case Density Trend",
          threatScore: "Calculated Zone Threat Score",
          aiAssistant: "Ask about prevention",
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
          aiAssistant: "වැළැක්වීම ගැන අසන්න",
          recenter: "නැවත යොමු කරන්න",
          nextWeekForecast: "ලබන සතියේ පුරෝකථනය",
          activeWeek: "වත්මන් සතිය",
          lowRisk: "අඩු අවදානම",
          moderate: "මධ්‍යස්ථ අවදානම",
          highRisk: "වැඩි අවදානම",
        },
      };
      return translations[lang][key] || key;
    },
    [lang],
  );

  useEffect(() => {
    navigation.setOptions({
      title: t("title"),
      headerRight: () => (
        <View style={styles.headerRightContainer}>
          <Pressable
            style={[styles.langBtn, lang === "SI" && styles.langBtnActive]}
            onPress={() => setLang(lang === "EN" ? "SI" : "EN")}
          >
            <MaterialCommunityIcons
              name="translate"
              size={14}
              color={lang === "SI" ? C.amber : C.sub}
            />
            <Text
              style={[styles.langBtnText, lang === "SI" && { color: C.amber }]}
            >
              {lang === "EN" ? "සිංහල" : "EN"}
            </Text>
          </Pressable>
          <View style={styles.headerBadge}>
            <View style={styles.headerBadgeDot} />
            <Text style={styles.headerBadgeText}>RISK ALERTS</Text>
          </View>
        </View>
      ),
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
      const { mapData, summaryData, preventionData } =
        await fetchDashboardData(true);
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
      const { mapData, summaryData, preventionData } =
        await fetchDashboardData(true);
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
    if (
      Platform.OS !== "web" &&
      Notifications &&
      typeof Notifications.setNotificationHandler === "function"
    ) {
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
      existingMap.set(
        summary.next_week_risk.week_label,
        summary.next_week_risk,
      );
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
          return (
            hMatch &&
            parseInt(hMatch[1], 10) === targetYear &&
            parseInt(hMatch[2], 10) === targetWeekNum
          );
        });
      }

      if (item) {
        result.push(item);
      } else {
        let baseScore = summary.current_risk.risk_score || 0.4;
        if (offset > 0 && summary.next_week_risk) {
          baseScore = summary.next_week_risk.risk_score;
        }
        const syntheticScore = Math.min(
          0.95,
          Math.max(0.1, baseScore + offset * 0.02),
        );
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

  const selectedRiskConfig = useMemo(() => {
    return getRiskColorConfig(selectedWeekRisk?.risk_level);
  }, [selectedWeekRisk]);

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

  const pulse = useRef(new Animated.Value(0)).current;
  const fabScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1800,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const pulseScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.22],
  });
  const pulseOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 0],
  });

  if (loading) {
    return (
      <View style={styles.centered}>
        <View style={styles.loadingRing}>
          <ActivityIndicator size="large" color={C.amber} />
        </View>
        <Text style={styles.loadingText}>Analyzing Dengue Risk</Text>
        <Text style={styles.loadingSubText}>
          Fetching live climate & location data
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <View style={styles.errorIconWrap}>
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={40}
            color={C.high}
          />
        </View>
        <Text style={styles.errorTitle}>Unable to Load Risk Data</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={loadDashboard}>
          <MaterialCommunityIcons name="refresh" size={16} color={C.bg} />
          <Text style={styles.retryText}>Retry Loading</Text>
        </Pressable>
      </View>
    );
  }

  const heroColor = currentRiskConfig.color;
  const heroScoreNum = Math.round(
    Number(summary?.current_risk?.risk_score || 0) * 100,
  );
  const meterLeft = `${Math.min(100, Math.max(0, heroScoreNum))}%`;

  return (
    <View style={styles.screenContainer}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
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
        {/* ── HERO CARD ── */}
        <ImageBackground
          source={require("../../assets/colombo-hero.jpg")}
          style={[styles.heroCard, { borderColor: heroColor + "55" }]}
          imageStyle={styles.heroBgImage}
          resizeMode="cover"
        >
          {/* risk-tinted overlay: photo shows at the top, dark at the bottom for text */}
          <LinearGradient
            colors={heroOverlay(summary?.current_risk?.risk_level)}
            locations={[0, 0.45, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />

          {/* glowing accent line */}
          <LinearGradient
            colors={[heroColor, heroColor + "00"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.heroAccentBar}
          />

          {/* Top row */}
          <View style={styles.heroTopRow}>
            <View style={styles.heroLocationBlock}>
              <Text style={styles.heroEyebrow}>{t("currentRisk")}</Text>
              <View style={styles.heroLocationPinRow}>
                <MaterialCommunityIcons
                  name="map-marker"
                  size={18}
                  color={heroColor}
                />
                <Text style={styles.heroAreaName} numberOfLines={1}>
                  {summary?.area_name}
                </Text>
              </View>
              <Text style={styles.heroCoords}>
                GPS {formatCoordinate(summary?.user_location?.latitude)},{" "}
                {formatCoordinate(summary?.user_location?.longitude)}
              </Text>
            </View>
            <View
              style={[
                styles.heroBadge,
                { backgroundColor: heroColor, borderColor: heroColor },
              ]}
            >
              <MaterialCommunityIcons
                name={currentRiskConfig.icon}
                size={14}
                color={C.bg}
              />
              <Text style={styles.heroBadgeText}>
                {currentRiskConfig.label}
              </Text>
            </View>
          </View>

          {/* Score */}
          <View style={styles.heroScoreRow}>
            <Text style={[styles.heroScoreText, { color: heroColor }]}>
              {heroScoreNum}
            </Text>
            <Text style={[styles.heroScorePct, { color: heroColor }]}>%</Text>
            <View style={styles.heroScoreMeta}>
              <Text style={styles.heroScoreSub}>{t("threatScore")}</Text>
              <View
                style={[styles.heroWeekChip, { borderColor: heroColor + "66" }]}
              >
                <MaterialCommunityIcons
                  name="calendar-week"
                  size={12}
                  color={heroColor}
                />
                <Text style={[styles.heroWeekChipText, { color: heroColor }]}>
                  {formatWeekLabel(
                    summary?.current_risk?.week_label,
                    summary?.current_risk?.week_label,
                  )}
                </Text>
              </View>
            </View>
          </View>

          {/* Risk meter */}
          <View style={styles.meterWrap}>
            <View style={styles.meterTrack}>
              <View
                style={[styles.meterSeg, { flex: 35, backgroundColor: C.low }]}
              />
              <View
                style={[
                  styles.meterSeg,
                  { flex: 30, backgroundColor: C.moderate },
                ]}
              />
              <View
                style={[styles.meterSeg, { flex: 35, backgroundColor: C.high }]}
              />
            </View>
            <View
              style={[
                styles.meterThumb,
                { left: meterLeft, borderColor: heroColor },
              ]}
            />
            <View style={styles.meterLabels}>
              <Text style={styles.meterLabelText}>Low</Text>
              <Text style={styles.meterLabelText}>Moderate</Text>
              <Text style={styles.meterLabelText}>High</Text>
            </View>
          </View>

          {/* Alert banner */}
          {summary?.alert?.message ? (
            <View
              style={[
                styles.alertBanner,
                summary.alert.is_critical
                  ? styles.alertBannerCritical
                  : styles.alertBannerNormal,
              ]}
            >
              <View style={styles.alertIconWrap}>
                <MaterialCommunityIcons
                  name={
                    summary.alert.is_critical ? "alert" : "information-outline"
                  }
                  size={18}
                  color={summary.alert.is_critical ? C.high : C.low}
                />
              </View>
              <Text style={styles.alertText}>{summary.alert.message}</Text>
            </View>
          ) : null}
        </ImageBackground>

        {/* ── CLIMATE CARD ── */}
        {summary?.weather ? (
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <View style={styles.cardTitleIconWrap}>
                <MaterialCommunityIcons
                  name="weather-partly-cloudy"
                  size={16}
                  color={C.teal}
                />
              </View>
              <Text style={styles.cardTitle}>{t("climate")}</Text>
            </View>

            <View style={styles.weatherGrid}>
              <View style={styles.weatherItem}>
                <View
                  style={[
                    styles.weatherIconCircle,
                    {
                      borderColor: "rgba(255,100,60,0.4)",
                      backgroundColor: "rgba(255,100,60,0.10)",
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="thermometer"
                    size={20}
                    color="#FF6B3D"
                  />
                </View>
                <Text style={styles.weatherValue}>
                  {hasNumber(summary.weather.temperature_c)
                    ? `${summary.weather.temperature_c.toFixed(1)}°C`
                    : "--"}
                </Text>
                <Text style={styles.weatherLabel}>Temperature</Text>
              </View>

              <View style={styles.weatherItem}>
                <View
                  style={[
                    styles.weatherIconCircle,
                    {
                      borderColor: "rgba(10,132,255,0.4)",
                      backgroundColor: "rgba(10,132,255,0.10)",
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="water-outline"
                    size={20}
                    color={C.blue}
                  />
                </View>
                <Text style={styles.weatherValue}>
                  {hasNumber(summary.weather.humidity_pct)
                    ? `${Math.round(summary.weather.humidity_pct)}%`
                    : "--"}
                </Text>
                <Text style={styles.weatherLabel}>Humidity</Text>
              </View>

              <View style={styles.weatherItem}>
                <View
                  style={[
                    styles.weatherIconCircle,
                    {
                      borderColor: "rgba(57,213,198,0.4)",
                      backgroundColor: "rgba(57,213,198,0.10)",
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="weather-pouring"
                    size={20}
                    color={C.teal}
                  />
                </View>
                <Text style={styles.weatherValue}>
                  {hasNumber(summary.weather.current_rain_mm_h)
                    ? `${summary.weather.current_rain_mm_h.toFixed(1)} mm/h`
                    : "0.0 mm/h"}
                </Text>
                <Text style={styles.weatherLabel}>Current Rain</Text>
              </View>

              <View style={styles.weatherItem}>
                <View
                  style={[
                    styles.weatherIconCircle,
                    {
                      borderColor: "rgba(245,166,35,0.4)",
                      backgroundColor: "rgba(245,166,35,0.10)",
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="weather-rainy"
                    size={20}
                    color={C.amber}
                  />
                </View>
                <Text style={styles.weatherValue}>
                  {hasNumber(summary.weather.today_rain_mm)
                    ? `${summary.weather.today_rain_mm.toFixed(1)} mm`
                    : "0.0 mm"}
                </Text>
                <Text style={styles.weatherLabel}>Today's Rain</Text>
              </View>

              <View style={[styles.weatherItem, styles.weatherItemFull]}>
                <View
                  style={[
                    styles.weatherIconCircle,
                    {
                      borderColor: "rgba(245,166,35,0.4)",
                      backgroundColor: "rgba(245,166,35,0.10)",
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="chart-bar"
                    size={20}
                    color={C.amber}
                  />
                </View>
                <View style={styles.weatherFullText}>
                  <Text style={styles.weatherValue}>
                    {hasNumber(summary.weather.rainfall_7day_avg)
                      ? `${summary.weather.rainfall_7day_avg.toFixed(1)} mm/day`
                      : "0.0 mm/day"}
                  </Text>
                  <Text style={styles.weatherLabel}>
                    7-day Average Rainfall
                  </Text>
                </View>
                <View style={styles.weatherMiniBar}>
                  {[0.3, 0.5, 0.4, 0.7, 0.6, 0.8, 0.9].map((h, i) => (
                    <View
                      key={i}
                      style={[
                        styles.weatherMiniBarItem,
                        {
                          height: Math.round(h * 24),
                          backgroundColor: i === 6 ? C.amber : C.amber + "55",
                        },
                      ]}
                    />
                  ))}
                </View>
              </View>
            </View>
          </View>
        ) : null}

        {/* ── WEEKLY OUTLOOK ── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderText}>Weekly Outlook</Text>
        </View>

        {/* Active vs Next week */}
        <View style={styles.duoRow}>
          <View
            style={[
              styles.duoCard,
              { borderColor: selectedRiskConfig.color + "55" },
            ]}
          >
            <Text style={styles.duoTitle}>{t("activeWeek")}</Text>
            <Text
              style={[styles.duoScore, { color: selectedRiskConfig.color }]}
            >
              {percentage(selectedWeekRisk?.risk_score)}
            </Text>
            <View
              style={[
                styles.duoBadge,
                { backgroundColor: selectedRiskConfig.bg },
              ]}
            >
              <Text
                style={[
                  styles.duoBadgeText,
                  { color: selectedRiskConfig.color },
                ]}
              >
                {selectedRiskConfig.label}
              </Text>
            </View>
            <Text style={styles.duoWeek} numberOfLines={1}>
              {formatWeekLabel(selectedWeek, summary?.current_risk?.week_label)}
            </Text>
          </View>

          <View
            style={[
              styles.duoCard,
              { borderColor: nextWeekRiskConfig.color + "55" },
            ]}
          >
            <Text style={styles.duoTitle}>{t("nextWeekForecast")}</Text>
            <Text
              style={[styles.duoScore, { color: nextWeekRiskConfig.color }]}
            >
              {percentage(summary?.next_week_risk?.risk_score)}
            </Text>
            <View
              style={[
                styles.duoBadge,
                { backgroundColor: nextWeekRiskConfig.bg },
              ]}
            >
              <Text
                style={[
                  styles.duoBadgeText,
                  { color: nextWeekRiskConfig.color },
                ]}
              >
                {nextWeekRiskConfig.label}
              </Text>
            </View>
            <Text style={styles.duoWeek} numberOfLines={1}>
              {formatWeekLabel(
                summary?.next_week_risk?.week_label,
                summary?.current_risk?.week_label,
              )}
            </Text>
          </View>
        </View>

        {/* Trend bars (tap to select week) */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <View
              style={[
                styles.cardTitleIconWrap,
                { backgroundColor: C.amberGlow },
              ]}
            >
              <MaterialCommunityIcons
                name="chart-line-variant"
                size={16}
                color={C.amber}
              />
            </View>
            <Text style={styles.cardTitle}>Risk Trend</Text>
            <Text style={styles.cardHint}>Tap a bar</Text>
          </View>
          <View style={styles.trendRow}>
            {formattedWeekList.map((item) => {
              const cfg = getRiskColorConfig(item.risk_level);
              const barH = Math.max(
                10,
                Math.round((item.risk_score || 0.1) * 90),
              );
              const isActive = selectedWeek === item.week_label;
              const wkMatch = item.week_label.match(/(\d{1,2})$/);
              return (
                <Pressable
                  key={`trend-${item.week_label}`}
                  style={styles.trendCol}
                  onPress={() => setSelectedWeek(item.week_label)}
                >
                  <Text
                    style={[styles.trendPct, isActive && { color: cfg.color }]}
                  >
                    {Math.round((item.risk_score || 0) * 100)}
                  </Text>
                  <View
                    style={[
                      styles.trendBar,
                      {
                        height: barH,
                        backgroundColor: isActive
                          ? cfg.color
                          : cfg.color + "55",
                      },
                    ]}
                  />
                  <Text
                    style={[styles.trendLabel, isActive && { color: C.text }]}
                  >
                    W{wkMatch ? parseInt(wkMatch[1], 10) : ""}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── MAP CARD ── */}
        <View style={styles.mapCard}>
          <View style={styles.mapCardHeader}>
            <Text style={styles.sectionTitle}>
              {t("mapTitle")} (
              {formatWeekLabel(selectedWeek, summary?.current_risk?.week_label)}
              )
            </Text>
            <Pressable
              style={styles.expandButton}
              onPress={() => setIsFullscreenMap(true)}
            >
              <MaterialCommunityIcons
                name="fullscreen"
                size={16}
                color={C.amber}
              />
              <Text style={styles.expandButtonText}>Expand</Text>
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {formattedWeekList.map((item) => {
              const itemConfig = getRiskColorConfig(item.risk_level);
              const isActive = selectedWeek === item.week_label;
              const userFriendlyWeek = formatWeekLabel(
                item.week_label,
                summary?.current_risk?.week_label,
              );
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
                  <Text
                    style={[styles.filterWeek, isActive && { color: C.text }]}
                  >
                    {userFriendlyWeek}
                  </Text>
                  <Text
                    style={[styles.filterRisk, { color: itemConfig.color }]}
                  >
                    {percentage(item.risk_score)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.mapContainer}>
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={initialRegion}
              mapType={mapType}
            >
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
                    <View
                      style={[
                        styles.customMarkerBadge,
                        { backgroundColor: riskCfg.color },
                      ]}
                    >
                      <Text style={styles.customMarkerBadgeText}>
                        {percentage(risk.risk_score)}
                      </Text>
                    </View>
                  </Marker>
                );
              })}
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

            <View style={styles.floatingMapTypeRow}>
              {MAP_TYPES.map((opt) => {
                const active = mapType === opt.type;
                return (
                  <Pressable
                    key={opt.type}
                    style={[
                      styles.floatingMapTypeBtn,
                      active && styles.floatingMapTypeBtnActive,
                    ]}
                    onPress={() => setMapType(opt.type)}
                  >
                    <MaterialCommunityIcons
                      name={opt.icon}
                      size={12}
                      color={active ? C.amber : C.sub}
                    />
                    <Text
                      style={[
                        styles.floatingMapTypeBtnText,
                        active && styles.floatingMapTypeBtnTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              style={styles.floatingRecenterBtn}
              onPress={() => recenterMap(mapRef)}
            >
              <MaterialCommunityIcons
                name="crosshairs-gps"
                size={12}
                color={C.amber}
              />
              <Text style={styles.floatingRecenterText}>{t("recenter")}</Text>
            </Pressable>
          </View>

          <View style={styles.legendRow}>
            {[
              { color: C.low, label: t("lowRisk") },
              { color: C.moderate, label: t("moderate") + " Risk" },
              { color: C.high, label: t("highRisk") },
            ].map((l) => (
              <View key={l.label} style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: l.color }]}
                />
                <Text style={styles.legendText}>{l.label}</Text>
              </View>
            ))}
          </View>

          {/* Selected week summary strip */}
          <View style={styles.summaryStrip}>
            <Text style={styles.summaryStripLabel}>{t("weekSummary")}</Text>
            <Text
              style={[
                styles.summaryStripValue,
                { color: selectedRiskConfig.color },
              ]}
            >
              {formatWeekLabel(selectedWeek, summary?.current_risk?.week_label)}{" "}
              · {percentage(selectedWeekRisk?.risk_score)} ·{" "}
              {selectedRiskConfig.label}
            </Text>
          </View>
        </View>

        {/* ── DEMO SIMULATOR CARD ── */}
        <Pressable
          style={styles.demoCard}
          onPress={() => navigation.navigate("DengueRiskDemo")}
        >
          <View style={styles.demoCardIconWrap}>
            <MaterialCommunityIcons
              name="flask-outline"
              size={22}
              color={C.amber}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.demoCardTitle}>
              Dengue Risk Simulator (Demo Mode)
            </Text>
            <Text style={styles.demoCardSub}>
              Adjust temperature, humidity & rainfall to simulate risk zone
              changes.
            </Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={20}
            color={C.amber}
          />
        </Pressable>
      </ScrollView>

      {/* ── AI CHATBOT FAB ── */}
      {/* ── AI CHATBOT FAB ── */}
      <View pointerEvents="box-none" style={styles.fabWrap}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.fabPulse,
            { opacity: pulseOpacity, transform: [{ scale: pulseScale }] },
          ]}
        />
        <Animated.View style={{ transform: [{ scale: fabScale }] }}>
          <Pressable
            onPress={openDengueChat}
            onPressIn={() =>
              Animated.spring(fabScale, {
                toValue: 0.94,
                useNativeDriver: true,
              }).start()
            }
            onPressOut={() =>
              Animated.spring(fabScale, {
                toValue: 1,
                friction: 4,
                useNativeDriver: true,
              }).start()
            }
            accessibilityRole="button"
            accessibilityLabel={t("aiAssistant")}
          >
            <LinearGradient
              colors={["#FFC857", C.amber, "#E58E0F"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.fab}
            >
              <View style={styles.fabIconCircle}>
                <MaterialCommunityIcons
                  name="robot-happy"
                  size={22}
                  color={C.amber}
                />
                <View style={styles.fabOnlineDot} />
              </View>
              <View style={styles.fabTextCol}>
                <Text style={styles.fabTitle}>{t("aiAssistant")}</Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color={C.bg}
              />
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </View>

      {/* ── FULLSCREEN MAP MODAL ── */}
      <Modal
        visible={isFullscreenMap}
        animationType="slide"
        onRequestClose={() => setIsFullscreenMap(false)}
      >
        <View style={styles.fullScreenModalContainer}>
          <View style={styles.fullScreenHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fullScreenTitle}>{t("mapTitle")}</Text>
              <Text style={styles.fullScreenSubTitle}>
                Viewing:{" "}
                {formatWeekLabel(
                  selectedWeek,
                  summary?.current_risk?.week_label,
                )}
              </Text>
            </View>
            <Pressable
              style={styles.closeModalBtn}
              onPress={() => setIsFullscreenMap(false)}
            >
              <MaterialCommunityIcons name="close" size={20} color={C.text} />
            </Pressable>
          </View>

          <View style={styles.fullScreenWeekBar}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.fullScreenFilterRow}
            >
              {formattedWeekList.map((item) => {
                const itemConfig = getRiskColorConfig(item.risk_level);
                const isActive = selectedWeek === item.week_label;
                const userFriendlyWeek = formatWeekLabel(
                  item.week_label,
                  summary?.current_risk?.week_label,
                );
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
                    <Text
                      style={[styles.filterRisk, { color: itemConfig.color }]}
                    >
                      {percentage(item.risk_score)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View style={{ flex: 1, position: "relative" }}>
            {summary?.weather ? (
              <View style={styles.floatingClimateHudWrapper}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.floatingClimateHudRow}
                >
                  {[
                    {
                      key: "temp",
                      icon: "thermometer",
                      value: summary.weather.temperature_c
                        ? `${summary.weather.temperature_c.toFixed(1)}°C`
                        : "--",
                      tip: `Temperature: ${summary.weather.temperature_c?.toFixed(1)}°C — Ideal mosquito vector activity zone (25°C - 30°C).`,
                    },
                    {
                      key: "humidity",
                      icon: "water-outline",
                      value: summary.weather.humidity_pct
                        ? `${Math.round(summary.weather.humidity_pct)}%`
                        : "--",
                      tip: `Humidity: ${Math.round(summary.weather.humidity_pct)}% — High humidity prolongs mosquito feeding lifespan.`,
                    },
                    {
                      key: "rain",
                      icon: "weather-pouring",
                      value: hasNumber(summary.weather.current_rain_mm_h)
                        ? `${summary.weather.current_rain_mm_h.toFixed(1)} mm/h`
                        : "0.0 mm/h",
                      tip: `Current Rain: ${summary.weather.current_rain_mm_h?.toFixed(1) || 0} mm/h — Active rainfall can immediately increase water stagnation.`,
                    },
                    {
                      key: "rain7",
                      icon: "calendar-range-outline",
                      value: hasNumber(summary.weather.rainfall_7day_avg)
                        ? `${summary.weather.rainfall_7day_avg.toFixed(1)} mm/d`
                        : "0.0 mm/d",
                      tip: `7-Day Rain Avg: ${summary.weather.rainfall_7day_avg?.toFixed(1) || 0} mm/day — Higher weekly rainfall average increases breeding site persistence.`,
                    },
                    {
                      key: "todayRain",
                      icon: "weather-rainy",
                      value: hasNumber(summary.weather.today_rain_mm)
                        ? `${summary.weather.today_rain_mm.toFixed(1)} mm`
                        : "0.0 mm",
                      tip: `Today's Rain: ${summary.weather.today_rain_mm?.toFixed(1) || 0} mm — Daily rainfall accumulation is a direct dengue risk amplifier.`,
                    },
                  ].map((pill) => (
                    <Pressable
                      key={pill.key}
                      style={[
                        styles.compactClimatePill,
                        activeClimateTip?.key === pill.key &&
                          styles.compactClimatePillActive,
                      ]}
                      onPress={() =>
                        setActiveClimateTip(
                          activeClimateTip?.key === pill.key
                            ? null
                            : { key: pill.key, text: pill.tip },
                        )
                      }
                    >
                      <MaterialCommunityIcons
                        name={pill.icon}
                        size={13}
                        color={C.amber}
                      />
                      <Text style={styles.compactClimateValue}>
                        {pill.value}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
                {activeClimateTip ? (
                  <View style={styles.climateTipToast}>
                    <MaterialCommunityIcons
                      name="lightbulb-on-outline"
                      size={14}
                      color={C.amber}
                    />
                    <Text style={styles.climateTipToastText}>
                      {activeClimateTip.text}
                    </Text>
                    <Pressable onPress={() => setActiveClimateTip(null)}>
                      <MaterialCommunityIcons
                        name="close-circle"
                        size={16}
                        color={C.sub}
                      />
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
              {mapAreas.map((area) => {
                const risk = areaRiskForWeek(area, selectedWeek);
                const riskCfg = getRiskColorConfig(risk.risk_level);
                return (
                  <Marker
                    key={`${area.area_id}-marker-full`}
                    coordinate={area.center}
                    title={`${area.area_name} (${riskCfg.label})`}
                    description={`${percentage(risk.risk_score)}`}
                  >
                    <View
                      style={[
                        styles.customMarkerBadge,
                        { backgroundColor: riskCfg.color },
                      ]}
                    >
                      <Text style={styles.customMarkerBadgeText}>
                        {percentage(risk.risk_score)}
                      </Text>
                    </View>
                  </Marker>
                );
              })}
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

            <View style={styles.floatingMapTypeRowFullScreen}>
              {MAP_TYPES.map((opt) => {
                const active = mapType === opt.type;
                return (
                  <Pressable
                    key={`full-${opt.type}`}
                    style={[
                      styles.floatingMapTypeBtn,
                      active && styles.floatingMapTypeBtnActive,
                    ]}
                    onPress={() => setMapType(opt.type)}
                  >
                    <MaterialCommunityIcons
                      name={opt.icon}
                      size={12}
                      color={active ? C.amber : C.sub}
                    />
                    <Text
                      style={[
                        styles.floatingMapTypeBtnText,
                        active && styles.floatingMapTypeBtnTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.fullScreenFooter}>
            <Pressable
              style={styles.recenterButton}
              onPress={() => recenterMap(fullMapRef)}
            >
              <MaterialCommunityIcons
                name="crosshairs-gps"
                size={13}
                color={C.amber}
              />
              <Text style={styles.recenterText}>Recenter</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ───────────────────────────────── styles ───────────────────────────────── */

const styles = StyleSheet.create({
  // ── General layout ──
  screenContainer: { flex: 1, backgroundColor: C.bg },
  screen: { flex: 1, backgroundColor: C.bg },
  content: { padding: 14, paddingBottom: 120, gap: 14 },

  // ── Loading / Error ──
  centered: {
    flex: 1,
    backgroundColor: C.bg,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: C.amber,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  loadingText: {
    color: C.text,
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  loadingSubText: {
    color: C.sub,
    fontSize: 12,
    marginTop: 6,
    textAlign: "center",
  },
  errorIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.highBg,
    borderWidth: 1,
    borderColor: C.high,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  errorTitle: {
    color: C.text,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  errorText: {
    color: C.sub,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.amber,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
    shadowColor: C.amber,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  retryText: { color: C.bg, fontWeight: "800", fontSize: 14 },

  // ── HERO ──
  heroCard: {
    backgroundColor: C.surface,
    borderRadius: 26,
    borderWidth: 1,
    padding: 18,
    gap: 16,
    minHeight: 380,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  heroAccentBar: { position: "absolute", top: 0, left: 0, right: 0, height: 3 },
  heroBgImage: { borderRadius: 26 },

  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  heroLocationBlock: { flex: 1, gap: 4 },
  heroEyebrow: {
    color: C.subLight,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  heroLocationPinRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  heroAreaName: {
    color: C.text,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.6,
    flexShrink: 1,
  },
  heroCoords: { color: C.sub, fontSize: 12, fontWeight: "500" },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  heroBadgeText: { color: C.bg, fontSize: 12, fontWeight: "900" },

  heroScoreRow: { flexDirection: "row", alignItems: "flex-end" },
  heroScoreText: {
    fontSize: 76,
    fontWeight: "900",
    letterSpacing: -4,
    lineHeight: 80,
  },
  heroScorePct: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 10,
    marginLeft: 2,
  },
  heroScoreMeta: { flex: 1, alignItems: "flex-end", gap: 8, marginBottom: 10 },
  heroScoreSub: {
    color: C.textSoft,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "right",
  },
  heroWeekChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "rgba(8,12,18,0.55)",
  },
  heroWeekChipText: { fontSize: 11, fontWeight: "800" },

  // risk meter
  meterWrap: { gap: 6 },
  meterTrack: {
    flexDirection: "row",
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    gap: 2,
  },
  meterSeg: { height: 8, opacity: 0.85 },
  meterThumb: {
    position: "absolute",
    top: -3,
    width: 14,
    height: 14,
    borderRadius: 7,
    marginLeft: -7,
    backgroundColor: "#FFFFFF",
    borderWidth: 3,
  },
  meterLabels: { flexDirection: "row", justifyContent: "space-between" },
  meterLabelText: { color: C.sub, fontSize: 10, fontWeight: "700" },

  // ── Alert banner ──
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
  },
  alertBannerCritical: {
    backgroundColor: "rgba(255,69,58,0.16)",
    borderColor: "rgba(255,69,58,0.55)",
  },
  alertBannerNormal: { backgroundColor: C.lowBg, borderColor: C.low },
  alertIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  alertText: {
    flex: 1,
    color: C.textSoft,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },

  // ── Card shared ──
  card: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 22,
    padding: 16,
    gap: 14,
  },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitleIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.tealBg,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { flex: 1, color: C.text, fontSize: 14, fontWeight: "800" },
  cardHint: { color: C.sub, fontSize: 11, fontWeight: "600" },

  // ── Weather grid ──
  weatherGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  weatherItem: {
    flex: 1,
    minWidth: "46%",
    backgroundColor: C.surfaceHi,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    gap: 4,
  },
  weatherItemFull: {
    minWidth: "100%",
    flex: undefined,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  weatherIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: 6,
  },
  weatherFullText: { flex: 1, gap: 2 },
  weatherValue: {
    fontSize: 20,
    color: C.text,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  weatherLabel: { fontSize: 11, color: C.sub, fontWeight: "600" },
  weatherMiniBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
    height: 26,
  },
  weatherMiniBarItem: { width: 5, borderRadius: 2 },

  // ── Section header ──
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 2,
    marginTop: 4,
  },
  sectionHeaderText: { color: C.text, fontSize: 17, fontWeight: "800" },
  sectionHeaderLink: { flexDirection: "row", alignItems: "center", gap: 2 },
  sectionHeaderLinkText: { color: C.amber, fontSize: 13, fontWeight: "700" },

  // ── Active / Next week duo ──
  duoRow: { flexDirection: "row", gap: 10 },
  duoCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  duoTitle: {
    color: C.subLight,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  duoScore: { fontSize: 38, fontWeight: "900", letterSpacing: -1.5 },
  duoBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  duoBadgeText: { fontSize: 11, fontWeight: "800" },
  duoWeek: { color: C.sub, fontSize: 11, fontWeight: "600", marginTop: 2 },

  // ── Trend bars ──
  trendRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 4,
  },
  trendCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 5,
  },
  trendBar: { width: "78%", borderRadius: 6 },
  trendPct: { color: C.sub, fontSize: 10, fontWeight: "800" },
  trendLabel: { color: C.sub, fontSize: 10, fontWeight: "700" },

  // ── History cards ──
  historyRow: { flexDirection: "row", gap: 10 },
  historyCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    alignItems: "center",
    gap: 4,
  },
  historyScore: { fontSize: 24, fontWeight: "900", letterSpacing: -0.5 },
  historyLevel: { fontSize: 12, fontWeight: "800" },
  historyWeek: {
    color: C.sub,
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
  },

  // ── Map card ──
  sectionTitle: {
    color: C.text,
    fontSize: 14,
    fontWeight: "800",
    flex: 1,
    paddingRight: 8,
  },
  mapCard: {
    backgroundColor: C.surface,
    borderRadius: 22,
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.amberDim,
  },
  expandButtonText: { color: C.amber, fontSize: 12, fontWeight: "800" },

  // ── Week filter chips ──
  filterRow: { gap: 8, paddingBottom: 2 },
  fullScreenFilterRow: { gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  filterChip: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: C.surfaceHi,
    minWidth: 92,
  },
  filterWeek: { color: C.sub, fontSize: 11, fontWeight: "700" },
  filterRisk: { marginTop: 2, fontSize: 14, fontWeight: "900" },

  // ── Map container ──
  mapContainer: {
    position: "relative",
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.border,
  },
  map: { width: "100%", height: 300 },

  // ── Floating map controls ──
  floatingMapTypeRow: {
    position: "absolute",
    top: 10,
    left: 10,
    flexDirection: "row",
    backgroundColor: "rgba(8, 12, 18, 0.88)",
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
    backgroundColor: "rgba(8, 12, 18, 0.92)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
  },
  floatingMapTypeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  floatingMapTypeBtnActive: { backgroundColor: C.amberDim + "77" },
  floatingMapTypeBtnText: { color: C.sub, fontSize: 10, fontWeight: "700" },
  floatingMapTypeBtnTextActive: { color: C.amber },
  floatingRecenterBtn: {
    position: "absolute",
    bottom: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(8, 12, 18, 0.90)",
    borderRadius: 18,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: C.amber,
  },
  floatingRecenterText: { color: C.amber, fontSize: 10, fontWeight: "800" },

  // ── Markers ──
  customMarkerBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 6,
  },
  customMarkerBadgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
  userGpsPulseOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(10, 132, 255, 0.25)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(10, 132, 255, 0.55)",
  },
  userGpsDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: "#0A84FF",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },

  // ── Legend + summary strip ──
  legendRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 2,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { color: C.subLight, fontSize: 11, fontWeight: "600" },
  summaryStrip: {
    backgroundColor: C.surfaceHi,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 3,
  },
  summaryStripLabel: { color: C.sub, fontSize: 11, fontWeight: "700" },
  summaryStripValue: { fontSize: 13, fontWeight: "800" },

  // ── Demo card ──
  demoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.amberDim,
    borderRadius: 22,
    padding: 16,
    gap: 12,
  },
  demoCardIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: C.amberGlow,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.amberDim,
  },
  demoCardTitle: { color: C.text, fontSize: 14, fontWeight: "800" },
  demoCardSub: {
    color: C.subLight,
    fontSize: 12,
    marginTop: 3,
    lineHeight: 17,
  },

  // ── FAB ──
  fabWrap: {
    position: "absolute",
    right: 16,
    bottom: 24,
    alignItems: "flex-end",
  },
  fabPulse: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 999,
    backgroundColor: C.amber,
  },
  fab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 999,
    paddingLeft: 8,
    paddingRight: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    shadowColor: C.amber,
    shadowOpacity: 0.55,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 14,
  },
  fabIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  fabOnlineDot: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: C.low,
    borderWidth: 2,
    borderColor: C.amber,
  },
  fabTextCol: { gap: 1 },
  fabTitle: {
    color: C.bg,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.2,
  },

  // ── Fullscreen modal ──
  fullScreenModalContainer: { flex: 1, backgroundColor: C.bg },
  fullScreenHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    paddingTop: Platform.OS === "ios" ? 52 : 16,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  fullScreenTitle: { color: C.text, fontSize: 18, fontWeight: "800" },
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
  fullScreenFooter: { position: "absolute", bottom: 22, right: 16 },
  closeModalBtn: { padding: 7, backgroundColor: C.surfaceHi, borderRadius: 20 },
  recenterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(8, 12, 18, 0.92)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: C.amber,
  },
  recenterText: { color: C.amber, fontWeight: "800", fontSize: 11 },

  // ── Floating climate HUD (fullscreen map) ──
  floatingClimateHudWrapper: {
    position: "absolute",
    top: 12,
    left: 10,
    right: 10,
    zIndex: 10,
    gap: 6,
  },
  floatingClimateHudRow: { gap: 6, alignItems: "center" },
  compactClimatePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(8, 12, 18, 0.92)",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  compactClimatePillActive: {
    borderColor: C.amber,
    backgroundColor: "rgba(122, 74, 0, 0.55)",
  },
  compactClimateValue: { color: C.text, fontSize: 11, fontWeight: "700" },
  climateTipToast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(17, 23, 32, 0.97)",
    borderWidth: 1,
    borderColor: C.amber,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 7,
  },
  climateTipToastText: {
    flex: 1,
    color: C.textSoft,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "600",
  },

  // ── Header right ──
  headerRightContainer: { flexDirection: "row", alignItems: "center", gap: 8 },
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
  langBtnActive: { borderColor: C.amber },
  langBtnText: { fontSize: 11, fontWeight: "700", color: C.sub },
  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderColor: C.teal + "55",
    backgroundColor: C.tealBg,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 9,
  },
  headerBadgeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: C.teal,
  },
  headerBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: C.teal,
    letterSpacing: 1.2,
  },
});
