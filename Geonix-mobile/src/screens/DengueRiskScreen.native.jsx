import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import MapView, { Marker, Polygon } from "react-native-maps";
import * as Notifications from "expo-notifications";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

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
  surface: "#161B22",
  surfaceHi: "#21262D",
  border: "#30363D",
  text: "#E6EDF3",
  sub: "#8B949E",
  amber: "#F0A500",
  amberDim: "#7A5200",
};

function percentage(score) {
  return `${Math.round(Number(score || 0) * 100)}%`;
}

function levelLabel(level) {
  if (level === "high") return "High";
  if (level === "middle") return "Middle";
  return "Normal";
}

function formatCoordinate(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }
  return value.toFixed(5);
}

function riskStyle(level) {
  if (level === "high") {
    return { stroke: "#C62828", fill: "rgba(198, 40, 40, 0.35)" };
  }
  if (level === "middle") {
    return { stroke: "#F9A825", fill: "rgba(249, 168, 37, 0.30)" };
  }
  return { stroke: "#2E7D32", fill: "rgba(46, 125, 50, 0.30)" };
}

async function resolveCurrentLocation() {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== "granted") {
    return DEFAULT_LOCATION;
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
      // Ignore and fall back to default location.
    }
    return DEFAULT_LOCATION;
  }
}

async function requestNotificationPermission() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  return finalStatus === "granted";
}

async function triggerLocalNotification(title, body) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
      },
      trigger: null,
    });
  } catch {
    // Ignore trigger failure
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
  Alert.alert("Critical dengue risk", summary.alert.message);
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mapAreas, setMapAreas] = useState([]);
  const [summary, setSummary] = useState(null);
  const [prevention, setPrevention] = useState(null);
  const [selectedWeek, setSelectedWeek] = useState("");
  const [mapType, setMapType] = useState("hybrid");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const location = await resolveCurrentLocation();
      const [mapData, summaryData, preventionData] = await Promise.all([
        fetchDengueMap(),
        fetchDengueSummary(location.latitude, location.longitude),
        fetchDenguePrevention(),
      ]);
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
  }, []);

  useEffect(() => {
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

  const selectedWeekRisk = useMemo(() => {
    if (!summary) {
      return null;
    }
    return (
      summary.history?.find((item) => item.week_label === selectedWeek) ||
      summary.current_risk
    );
  }, [summary, selectedWeek]);

  const recenterMap = () => {
    if (!mapRef.current || !summary?.center) {
      return;
    }
    mapRef.current.animateToRegion(
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
        <Text style={styles.loadingText}>Loading dengue risk dashboard...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Unable to load data</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={loadDashboard}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screenContainer}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Current risk in your area</Text>
          <Text style={styles.areaName}>{summary?.area_name}</Text>
          <Text style={styles.locationText}>
            Your location: {formatCoordinate(summary?.user_location?.latitude)},{" "}
            {formatCoordinate(summary?.user_location?.longitude)}
          </Text>
          <Text
            style={[styles.riskValue, { color: summary?.current_risk?.color }]}
          >
            {percentage(summary?.current_risk?.risk_score)} (
            {levelLabel(summary?.current_risk?.risk_level)})
          </Text>

          {summary?.alert?.message ? (
            <View style={[
              styles.alertBanner,
              summary.alert.is_critical ? styles.alertBannerCritical : styles.alertBannerNormal
            ]}>
              <MaterialCommunityIcons 
                name={summary.alert.is_critical ? "alert-decagram-outline" : "checkbox-marked-circle-outline"} 
                size={16} 
                color={summary.alert.is_critical ? "#C62828" : "#2E7D32"} 
              />
              <Text style={styles.alertText}>{summary.alert.message}</Text>
            </View>
          ) : null}
        </View>

        {summary?.weather ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Real-Time Climate Indicators</Text>
            <View style={styles.weatherGrid}>
              <View style={styles.weatherItem}>
                <MaterialCommunityIcons name="thermometer" size={18} color={C.amber} />
                <Text style={styles.weatherValue}>
                  {summary.weather.temperature_c ? `${summary.weather.temperature_c.toFixed(1)}°C` : "--"}
                </Text>
                <Text style={styles.weatherLabel}>Temperature</Text>
              </View>
              <View style={styles.weatherItem}>
                <MaterialCommunityIcons name="water-outline" size={18} color={C.amber} />
                <Text style={styles.weatherValue}>
                  {summary.weather.humidity_pct ? `${Math.round(summary.weather.humidity_pct)}%` : "--"}
                </Text>
                <Text style={styles.weatherLabel}>Humidity</Text>
              </View>
              <View style={styles.weatherItem}>
                <MaterialCommunityIcons name="weather-pouring" size={18} color={C.amber} />
                <Text style={styles.weatherValue}>
                  {summary.weather.rainfall_mm ? `${summary.weather.rainfall_mm.toFixed(1)} mm` : "0.0 mm"}
                </Text>
                <Text style={styles.weatherLabel}>Rain Today</Text>
              </View>
              <View style={styles.weatherItem}>
                <MaterialCommunityIcons name="calendar-range-outline" size={18} color={C.amber} />
                <Text style={styles.weatherValue}>
                  {summary.weather.rainfall_7day_sum ? `${summary.weather.rainfall_7day_sum.toFixed(1)} mm` : "--"}
                </Text>
                <Text style={styles.weatherLabel}>7-Day Rain</Text>
              </View>
            </View>
          </View>
        ) : null}

        <Pressable style={styles.actionCard} onPress={openDengueChat}>
          <View style={styles.actionCardIconWrap}>
            <MaterialCommunityIcons name="robot-happy-outline" size={24} color={C.amber} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionCardTitle}>Dengue AI Safety Assistant</Text>
            <Text style={styles.actionCardSub}>Ask about symptoms, prevention, or local guidance.</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={C.sub} />
        </Pressable>

        <View style={styles.rowCards}>
          <View style={styles.smallCard}>
            <Text style={styles.smallTitle}>Next week forecast</Text>
            <Text
              style={[
                styles.smallValue,
                { color: summary?.next_week_risk?.color },
              ]}
            >
              {percentage(summary?.next_week_risk?.risk_score)}
            </Text>
            <Text style={styles.smallHint}>
              {levelLabel(summary?.next_week_risk?.risk_level)}
            </Text>
          </View>
          <View style={styles.smallCard}>
            <Text style={styles.smallTitle}>This week</Text>
            <Text
              style={[
                styles.smallValue,
                { color: summary?.current_risk?.color },
              ]}
            >
              {summary?.current_risk?.week_label}
            </Text>
            <Text style={styles.smallHint}>Live risk level</Text>
          </View>
        </View>

        <View style={styles.mapWrapper}>
          <Text style={styles.sectionTitle}>Past dengue risk filter</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {summary?.history?.map((item) => (
              <Pressable
                key={item.week_label}
                onPress={() => setSelectedWeek(item.week_label)}
                style={[
                  styles.filterChip,
                  selectedWeek === item.week_label && {
                    borderColor: item.color,
                    backgroundColor: C.amberDim + "44",
                  },
                ]}
              >
                <Text style={styles.filterWeek}>{item.week_label}</Text>
                <Text style={[styles.filterRisk, { color: item.color }]}>
                  {percentage(item.risk_score)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.mapTypeRow}>
            {MAP_TYPES.map((opt, i) => {
              const active = mapType === opt.type;
              return (
                <Pressable
                  key={opt.type}
                  style={[
                    styles.mapTypeBtn,
                    active && styles.mapTypeBtnActive,
                    i < MAP_TYPES.length - 1 && styles.mapTypeBtnBorder,
                  ]}
                  onPress={() => setMapType(opt.type)}
                >
                  <MaterialCommunityIcons
                    name={opt.icon}
                    size={14}
                    color={active ? C.amber : C.sub}
                  />
                  <Text
                    style={[
                      styles.mapTypeBtnText,
                      active && styles.mapTypeBtnTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.sectionTitle}>Risk map ({selectedWeek})</Text>
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
                  strokeWidth={2}
                />
              );
            })}
            {mapAreas.map((area) => {
              const risk = areaRiskForWeek(area, selectedWeek);
              return (
                <Marker
                  key={`${area.area_id}-marker`}
                  coordinate={area.center}
                  pinColor={risk.color}
                  title={`${area.area_name} (${levelLabel(risk.risk_level)})`}
                  description={`${percentage(risk.risk_score)} - ${selectedWeek}`}
                />
              );
            })}
            {summary?.user_location ? (
              <Marker
                coordinate={summary.user_location}
                pinColor="#1E88E5"
                title="Your location"
                description="Used to find your nearest dengue risk zone"
              />
            ) : null}
          </MapView>
          <Pressable style={styles.recenterButton} onPress={recenterMap}>
            <Text style={styles.recenterText}>Re-center</Text>
          </Pressable>
          <Text style={styles.legend}>
            <Text style={{ color: "#2E7D32" }}>Normal</Text> |{" "}
            <Text style={{ color: "#F9A825" }}>Middle</Text> |{" "}
            <Text style={{ color: "#C62828" }}>High</Text>
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Selected week summary</Text>
          <Text style={styles.tipText}>
            {selectedWeek}:{" "}
            <Text style={{ color: selectedWeekRisk?.color }}>
              {percentage(selectedWeekRisk?.risk_score)}
            </Text>{" "}
            ({levelLabel(selectedWeekRisk?.risk_level)})
          </Text>
        </View>
      </ScrollView>

      <Pressable style={styles.chatFab} onPress={openDengueChat}>
        <MaterialCommunityIcons name="robot-happy-outline" size={20} color={C.bg} />
        <Text style={styles.chatFabText}>AI Chat</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
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
    marginTop: 10,
    color: C.sub,
  },
  errorTitle: {
    color: C.text,
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  errorText: {
    color: C.sub,
    textAlign: "center",
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: C.amber,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: {
    color: C.bg,
    fontWeight: "700",
  },
  card: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  cardTitle: {
    color: C.sub,
    fontSize: 14,
    fontWeight: "600",
  },
  areaName: {
    color: C.text,
    fontSize: 22,
    fontWeight: "800",
  },
  locationText: {
    color: C.sub,
    fontSize: 12,
    marginTop: -2,
  },
  riskValue: {
    fontSize: 24,
    fontWeight: "800",
  },
  rowCards: {
    flexDirection: "row",
    gap: 12,
  },
  smallCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
  },
  smallTitle: {
    color: C.sub,
    fontSize: 13,
  },
  smallValue: {
    marginTop: 10,
    fontSize: 20,
    fontWeight: "800",
  },
  smallHint: {
    marginTop: 2,
    color: C.sub,
    fontSize: 12,
  },
  sectionTitle: {
    color: C.text,
    fontSize: 16,
    fontWeight: "700",
  },
  mapWrapper: {
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    gap: 10,
  },
  filterRow: {
    gap: 8,
    paddingBottom: 2,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: C.surfaceHi,
    minWidth: 96,
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
  mapTypeRow: {
    flexDirection: "row",
    alignSelf: "flex-start",
    backgroundColor: C.surfaceHi,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
    marginTop: 2,
  },
  mapTypeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  mapTypeBtnBorder: {
    borderRightWidth: 1,
    borderRightColor: C.border,
  },
  mapTypeBtnActive: {
    backgroundColor: C.amberDim + "44",
  },
  mapTypeBtnText: {
    color: C.sub,
    fontSize: 11,
    fontWeight: "700",
  },
  mapTypeBtnTextActive: {
    color: C.amber,
  },
  map: {
    width: "100%",
    height: 680,
    borderRadius: 12,
  },
  recenterButton: {
    alignSelf: "flex-end",
    backgroundColor: C.amberDim,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: C.amber,
  },
  recenterText: {
    color: C.amber,
    fontWeight: "700",
    fontSize: 12,
  },
  legend: {
    color: C.sub,
    fontSize: 12,
    fontWeight: "600",
  },
  tipText: {
    color: C.text,
    lineHeight: 20,
  },
  chatFab: {
    position: "absolute",
    right: 16,
    bottom: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.amber,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.amberDim,
    paddingHorizontal: 14,
    paddingVertical: 11,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },
  chatFabText: {
    color: C.bg,
    fontSize: 13,
    fontWeight: "800",
  },
  weatherGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  weatherItem: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: C.surfaceHi,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    padding: 10,
    alignItems: "center",
    gap: 4,
  },
  weatherLabel: {
    fontSize: 10,
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
    marginTop: 10,
  },
  alertBannerCritical: {
    backgroundColor: "rgba(198, 40, 40, 0.15)",
    borderColor: "#C62828",
  },
  alertBannerNormal: {
    backgroundColor: "rgba(46, 125, 50, 0.12)",
    borderColor: "#2E7D32",
  },
  alertText: {
    flex: 1,
    color: C.text,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    marginTop: 4,
  },
  actionCardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.surfaceHi,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  actionCardTitle: {
    color: C.text,
    fontSize: 14,
    fontWeight: "800",
  },
  actionCardSub: {
    color: C.sub,
    fontSize: 12,
    marginTop: 2,
  },
});
