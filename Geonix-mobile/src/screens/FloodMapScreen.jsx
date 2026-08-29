import {
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
  Modal,
  TouchableOpacity,
  Animated,
  Alert,
} from "react-native";
import MapView, { Polygon, Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { useEffect, useState, useRef } from "react";
import * as Location from "expo-location";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { FLOOD_API_URL } from "../config/api";
import DIVISION_COORDS from "../../assets/col_divs/devCords";

const DIVISION_COORDS_API = DIVISION_COORDS;

export default function FloodMapScreen() {
  const [geojson, setGeojson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [riverLevel, setRiverLevel] = useState(null);
  const [riverError, setRiverError] = useState(false);
  const [predictionMeta, setPredictionMeta] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [safetyModal, setSafetyModal] = useState(false);
  const [safetyResult, setSafetyResult] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [mapType, setMapType] = useState("hybrid");

  const mapRef = useRef(null);
  const fade = useRef(new Animated.Value(0)).current;
  const toastMsg = useRef("");

  // ── Toast ──────────────────────────────────────────────────────────────────
  const toast = (msg) => {
    toastMsg.current = msg;
    fade.setValue(0);
    Animated.timing(fade, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setTimeout(() => {
        Animated.timing(fade, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }, 1800);
    });
  };

  // ── Nearest division ───────────────────────────────────────────────────────
  const getNearestDivision = (lat, lon) => {
    let best = null,
      bestDist = Infinity;
    for (const [name, c] of Object.entries(DIVISION_COORDS_API)) {
      const d = (lat - c.lat) ** 2 + (lon - c.lon) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = name;
      }
    }
    return best;
  };

  // ── Fetch live river level ────────────────────────────────────────────────
  async function fetchRiverLevel() {
    const res = await fetch(`${FLOOD_API_URL}/riverLevel`);
    const data = await res.json();
    return data.river_level;
  }

  // ── Fetch Open-Meteo rainfall per division ────────────────────────────────
  async function fetchDivisionRainfall(lat, lon) {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lon}` +
      `&daily=precipitation_sum` +
      `&timezone=Asia/Colombo&forecast_days=16`;
    const res = await fetch(url);
    const data = await res.json();
    const prec = data.daily?.precipitation_sum || [];
    const safe = prec.map((v) => v || 0);
    return {
      rainfall_7day: Number(
        safe
          .slice(0, 7)
          .reduce((a, b) => a + b, 0)
          .toFixed(1),
      ),
      rainfall_14day: Number(
        safe
          .slice(0, 14)
          .reduce((a, b) => a + b, 0)
          .toFixed(1),
      ),
    };
  }

  // ── Build full weather payload ────────────────────────────────────────────
  async function buildWeatherPayload(riverLevelM) {
    const divisions = {};
    for (const [name, coord] of Object.entries(DIVISION_COORDS_API)) {
      const rain = await fetchDivisionRainfall(coord.lat, coord.lon);
      divisions[name] = {
        rainfall_7day: rain.rainfall_7day,
        rainfall_14day: rain.rainfall_14day,
        upstream_rain_7d: rain.rainfall_7day * 1.2,
        upstream_rain_14d: rain.rainfall_14day * 1.2,
        river_water_level: riverLevelM,
      };
    }
    return { divisions };
  }

  // ── Initial load flow ─────────────────────────────────────────────────────
  useEffect(() => {
    async function loadFloodPrediction() {
      try {
        let riverLevelM = 6.0;
        try {
          riverLevelM = await fetchRiverLevel();
          setRiverLevel(riverLevelM);
        } catch {
          setRiverError(true);
        }

        const payload = await buildWeatherPayload(riverLevelM);

        const res = await fetch(`${FLOOD_API_URL}/predict/full`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();

        setPredictionMeta({
          blocked: data.blocked ?? false,
          reason: data.reason ?? null,
          flooded_pct: data.flooded_pct ?? 0,
          zones: data.zones ?? 0,
        });

        if (data.river_level != null) setRiverLevel(data.river_level);
        setGeojson(data.geojson);
      } catch (err) {
        console.error("Flood prediction error:", err);
        setPredictionMeta({
          blocked: true,
          reason: "Could not reach prediction server",
          zones: 0,
          flooded_pct: 0,
        });
      } finally {
        setLoading(false);
      }
    }
    loadFloodPrediction();
  }, []);

  // ── My Location — auto safety check ──────────────────────────────────────
  const handleMyLocation = async () => {
    try {
      setLocating(true);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Location access is needed to check your flood risk.",
          [{ text: "OK" }],
        );
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = loc.coords;
      setUserLocation({ latitude, longitude });

      mapRef.current?.animateToRegion(
        { latitude, longitude, latitudeDelta: 0.08, longitudeDelta: 0.08 },
        600,
      );

      const division = getNearestDivision(latitude, longitude);
      const divCoord = DIVISION_COORDS_API[division];

      setLocationLoading(true);

      let riverLevelM = riverLevel ?? 6.0;
      try {
        riverLevelM = await fetchRiverLevel();
      } catch {
        /* use cached */
      }

      const rain = await fetchDivisionRainfall(divCoord.lat, divCoord.lon);

      const payload = {
        division,
        rainfall_7day: rain.rainfall_7day,
        rainfall_14day: rain.rainfall_14day,
        upstream_rain_7d: rain.rainfall_7day * 1.2,
        upstream_rain_14d: rain.rainfall_14day * 1.2,
        river_water_level: riverLevelM,
      };

      const res = await fetch(`${FLOOD_API_URL}/predict/subdist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.error) {
        toast("Division lookup failed");
        return;
      }

      const meta = {
        blocked: data.blocked ?? false,
        zones: data.zones ?? 0,
        flooded_pct: data.flooded_pct ?? 0,
      };

      setSafetyResult({
        safe: meta.blocked || meta.zones === 0,
        division,
        flooded_pct: meta.flooded_pct,
        zones: meta.zones,
        blocked: meta.blocked,
      });
      setSafetyModal(true);
    } catch (err) {
      console.error(err);
      toast("Location check failed");
    } finally {
      setLocating(false);
      setLocationLoading(false);
    }
  };

  // ── Polygon helpers ───────────────────────────────────────────────────────
  function getPolygons() {
    if (!geojson?.features) return [];
    return geojson.features.flatMap((f) => {
      const geom = f.geometry;
      if (geom.type === "Polygon")
        return [
          {
            coordinates: geom.coordinates[0].map(([lng, lat]) => ({
              latitude: lat,
              longitude: lng,
            })),
            severity: f.properties?.severity,
          },
        ];
      if (geom.type === "MultiPolygon")
        return geom.coordinates.map((poly) => ({
          coordinates: poly[0].map(([lng, lat]) => ({
            latitude: lat,
            longitude: lng,
          })),
          severity: f.properties?.severity,
        }));
      return [];
    });
  }

  function getColor(sev) {
    if (sev === "high") return "rgba(255,0,0,0.45)";
    if (sev === "medium") return "rgba(255,165,0,0.40)";
    return "rgba(0,0,255,0.35)";
  }

  // ── River level badge ─────────────────────────────────────────────────────
  function getRiverStatus(level) {
    if (level == null) return { label: "—", color: "#888" };
    if (level >= 10.0) return { label: "DANGER", color: "#c0392b" };
    if (level >= 8.0) return { label: "ALERT", color: "#e67e22" };
    if (level >= 6.5) return { label: "WATCH", color: "#f1c40f" };
    return { label: "NORMAL", color: "#27ae60" };
  }

  // ── No-flood banner ───────────────────────────────────────────────────────
  function getStatusBanner() {
    if (!predictionMeta) return null;
    const { blocked, zones, flooded_pct } = predictionMeta;
    if (blocked)
      return {
        icon: "✅",
        title: "No Flood Risk Detected",
        body: "Current rainfall and river levels are well below flood thresholds.",
        bg: "#0A2E14",
        border: "#27ae60",
        text: "#4ADE80",
      };
    if (zones === 0)
      return {
        icon: "🟡",
        title: "Conditions Monitored — No Active Flooding",
        body: `Rainfall detected but no areas exceed the flood probability threshold right now (${flooded_pct.toFixed(1)}% risk).`,
        bg: "#1A1200",
        border: "#F0A500",
        text: "#F0A500",
      };
    return null;
  }

  const polygons = getPolygons();
  const riverStatus = getRiverStatus(riverLevel);
  const statusBanner = !loading ? getStatusBanner() : null;

  // ── Safety modal config ───────────────────────────────────────────────────
  const safeConfig = safetyResult?.safe
    ? {
        icon: "shield-check",
        iconBg: "#1B5E20",
        iconColor: "#4ADE80",
        label: "YOU ARE SAFE",
        labelColor: "#4ADE80",
        title: "No flood risk at your location",
        body: `${safetyResult?.division} is currently outside active flood zones.`,
        bg: "#0A2E14",
        btnBg: "#27ae60",
        btnText: "Got it",
      }
    : {
        icon: "alert-circle",
        iconBg: "#7F1D1D",
        iconColor: "#F87171",
        label: "FLOOD RISK NEARBY",
        labelColor: "#F87171",
        title: "Flood zones detected near you",
        body: `${safetyResult?.zones ?? 0} active zone(s) in ${safetyResult?.division}. Consider moving to higher ground.`,
        bg: "#2D0A0A",
        btnBg: "#dc2626",
        btnText: "Understood",
      };

  // ── Map type options ──────────────────────────────────────────────────────
  const MAP_TYPES = [
    { type: "standard", icon: "map-outline", label: "Map" },
    { type: "satellite", icon: "satellite-variant", label: "Satellite" },
    { type: "hybrid", icon: "layers-outline", label: "Hybrid" },
  ];

  return (
    <View style={styles.container}>
      {/* ── Loading overlay ──────────────────────────────────────────────── */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#F0A500" />
          <Text style={styles.loadingText}>
            Fetching rainfall + river level...
          </Text>
        </View>
      )}

      {locationLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#F0A500" />
          <Text style={styles.loadingText}>Checking your area...</Text>
        </View>
      )}

      {/* ── Map type toggle — top left ────────────────────────────────────── */}
      {!loading && (
        <View style={styles.mapTypeRow}>
          {MAP_TYPES.map((opt, i) => {
            const active = mapType === opt.type;
            return (
              <TouchableOpacity
                key={opt.type}
                style={[
                  styles.mapTypeBtn,
                  active && styles.mapTypeBtnActive,
                  i < MAP_TYPES.length - 1 && styles.mapTypeBtnBorder,
                ]}
                onPress={() => setMapType(opt.type)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons
                  name={opt.icon}
                  size={14}
                  color={active ? "#F0A500" : "#8B949E"}
                />
                <Text
                  style={[
                    styles.mapTypeBtnText,
                    active && styles.mapTypeBtnTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* ── River level badge — top right ────────────────────────────────── */}
      {!loading && (
        <View style={[styles.riverBadge, { borderColor: riverStatus.color }]}>
          <Text style={styles.riverLabel}>Kelani River</Text>
          <Text style={[styles.riverLevelText, { color: riverStatus.color }]}>
            {riverLevel != null ? `${riverLevel.toFixed(2)} m` : "N/A"}
          </Text>
          <Text style={[styles.riverStatusText, { color: riverStatus.color }]}>
            {riverError ? "⚠ offline" : riverStatus.label}
          </Text>
        </View>
      )}

      {/* ── Status banner — bottom ────────────────────────────────────────── */}
      {statusBanner && (
        <View
          style={[
            styles.statusBanner,
            {
              backgroundColor: statusBanner.bg,
              borderColor: statusBanner.border,
            },
          ]}
        >
          <Text style={styles.statusIcon}>{statusBanner.icon}</Text>
          <View style={styles.statusText}>
            <Text style={[styles.statusTitle, { color: statusBanner.text }]}>
              {statusBanner.title}
            </Text>
            <Text style={[styles.statusBody, { color: statusBanner.text }]}>
              {statusBanner.body}
            </Text>
          </View>
        </View>
      )}

      {/* ── Toast ────────────────────────────────────────────────────────── */}
      <Animated.View style={[styles.toast, { opacity: fade }]}>
        <Text style={styles.toastText}>{toastMsg.current}</Text>
      </Animated.View>

      {/* ── My Location button ────────────────────────────────────────────── */}
      <TouchableOpacity
        style={styles.locationBtn}
        onPress={handleMyLocation}
        disabled={locating || locationLoading || loading}
        activeOpacity={0.85}
      >
        {locating || locationLoading ? (
          <ActivityIndicator size="small" color="#F0A500" />
        ) : (
          <MaterialCommunityIcons
            name="crosshairs-gps"
            size={22}
            color="#F0A500"
          />
        )}
      </TouchableOpacity>

      {/* ── Map ──────────────────────────────────────────────────────────── */}
      <MapView
        provider={PROVIDER_GOOGLE}
        ref={mapRef}
        style={styles.map}
        mapType={mapType}
        initialRegion={{
          latitude: 6.91,
          longitude: 79.92,
          latitudeDelta: 0.22,
          longitudeDelta: 0.22,
        }}
      >
        {polygons.map((poly, idx) => (
          <Polygon
            key={idx}
            coordinates={poly.coordinates}
            fillColor={getColor(poly.severity)}
            strokeColor={mapType === "standard" ? "#000" : "#fff"}
            strokeWidth={1.5}
          />
        ))}

        {userLocation && (
          <Marker coordinate={userLocation} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.userPin}>
              <View style={styles.userPinRing} />
              <View style={styles.userPinDot} />
            </View>
          </Marker>
        )}
      </MapView>

      {/* ── Safety Result Modal ───────────────────────────────────────────── */}
      {safetyResult && (
        <Modal visible={safetyModal} transparent animationType="fade">
          <View style={styles.safetyBackdrop}>
            <View
              style={[styles.safetyCard, { backgroundColor: safeConfig.bg }]}
            >
              <View
                style={[
                  styles.safetyIconCircle,
                  { backgroundColor: safeConfig.iconBg },
                ]}
              >
                <MaterialCommunityIcons
                  name={safeConfig.icon}
                  size={44}
                  color={safeConfig.iconColor}
                />
              </View>

              <Text
                style={[styles.safetyLabel, { color: safeConfig.labelColor }]}
              >
                {safeConfig.label}
              </Text>

              <View style={styles.safetyDivisionPill}>
                <Ionicons name="location-sharp" size={12} color="#aaa" />
                <Text style={styles.safetyDivisionText}>
                  {safetyResult.division}
                </Text>
              </View>

              <Text style={styles.safetyTitle}>{safeConfig.title}</Text>
              <Text style={styles.safetyBody}>{safeConfig.body}</Text>

              <View style={styles.safetyStats}>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{safetyResult.zones}</Text>
                  <Text style={styles.statLabel}>Flood Zones</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>
                    {safetyResult.flooded_pct.toFixed(1)}%
                  </Text>
                  <Text style={styles.statLabel}>Area at Risk</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.safetyBtn,
                  { backgroundColor: safeConfig.btnBg },
                ]}
                onPress={() => setSafetyModal(false)}
                activeOpacity={0.85}
              >
                <Text style={styles.safetyBtnText}>{safeConfig.btnText}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },

  // ── Loading overlay ────────────────────────────────────────────────────────
  loadingOverlay: {
    position: "absolute",
    top: 70,
    alignSelf: "center",
    backgroundColor: "#161B22",
    borderWidth: 1,
    borderColor: "#30363D",
    padding: 16,
    borderRadius: 14,
    zIndex: 999,
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  loadingText: {
    fontSize: 12,
    color: "#8B949E",
    fontWeight: "600",
    letterSpacing: 0.3,
  },

  // ── Map type toggle ────────────────────────────────────────────────────────
  mapTypeRow: {
    position: "absolute",
    top: 60,
    left: 14,
    flexDirection: "row",
    backgroundColor: "#161B22",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#30363D",
    overflow: "hidden",
    zIndex: 999,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  mapTypeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 9,
    paddingHorizontal: 11,
  },
  mapTypeBtnBorder: {
    borderRightWidth: 1,
    borderRightColor: "#30363D",
  },
  mapTypeBtnActive: {
    backgroundColor: "#7A520033",
  },
  mapTypeBtnText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#8B949E",
    letterSpacing: 0.5,
  },
  mapTypeBtnTextActive: {
    color: "#F0A500",
  },

  // ── River level badge ──────────────────────────────────────────────────────
  riverBadge: {
    position: "absolute",
    top: 60,
    right: 14,
    backgroundColor: "#161B22",
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 8,
    paddingHorizontal: 12,
    zIndex: 999,
    alignItems: "center",
    minWidth: 92,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  riverLabel: {
    fontSize: 9,
    color: "#8B949E",
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 2,
  },
  riverLevelText: {
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 24,
    letterSpacing: -0.5,
  },
  riverStatusText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginTop: 2,
  },

  // ── Status banner ──────────────────────────────────────────────────────────
  statusBanner: {
    position: "absolute",
    bottom: 28,
    left: 14,
    right: 14,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    zIndex: 999,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  statusIcon: { fontSize: 22, lineHeight: 26 },
  statusText: { flex: 1 },
  statusTitle: { fontSize: 13, fontWeight: "700", marginBottom: 2 },
  statusBody: { fontSize: 11, lineHeight: 16 },

  // ── My location button ─────────────────────────────────────────────────────
  locationBtn: {
    position: "absolute",
    bottom: 108,
    right: 14,
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: "#161B22",
    borderWidth: 1,
    borderColor: "#7A5200",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },

  // ── User location pin ──────────────────────────────────────────────────────
  userPin: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  userPinDot: {
    position: "absolute",
    zIndex: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#F0A500",
    borderWidth: 2,
    borderColor: "#161B22",
  },
  userPinRing: {
    position: "absolute",
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(240,165,0,0.12)",
    borderWidth: 1.5,
    borderColor: "rgba(240,165,0,0.35)",
  },

  // ── Toast ──────────────────────────────────────────────────────────────────
  toast: {
    position: "absolute",
    top: 60,
    alignSelf: "center",
    backgroundColor: "#161B22",
    borderWidth: 1,
    borderColor: "#30363D",
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 10,
    zIndex: 1000,
  },
  toastText: {
    color: "#E6EDF3",
    fontSize: 12,
    fontWeight: "600",
  },

  // ── Safety modal ───────────────────────────────────────────────────────────
  safetyBackdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.75)",
    padding: 24,
  },
  safetyCard: {
    width: "100%",
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#30363D",
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },
  safetyIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  safetyLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2.5,
    marginBottom: 10,
  },
  safetyDivisionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ffffff10",
    borderWidth: 1,
    borderColor: "#ffffff18",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
    marginBottom: 14,
  },
  safetyDivisionText: {
    fontSize: 12,
    color: "#aaa",
    fontWeight: "600",
  },
  safetyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#E6EDF3",
    textAlign: "center",
    marginBottom: 8,
  },
  safetyBody: {
    fontSize: 13,
    color: "#8B949E",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 22,
  },
  safetyStats: {
    flexDirection: "row",
    backgroundColor: "#ffffff08",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#ffffff12",
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 22,
    gap: 24,
  },
  statBox: { alignItems: "center" },
  statValue: { fontSize: 22, fontWeight: "800", color: "#E6EDF3" },
  statLabel: {
    fontSize: 10,
    color: "#8B949E",
    marginTop: 2,
    letterSpacing: 0.5,
  },
  statDivider: { width: 1, height: 32, backgroundColor: "#ffffff15" },
  safetyBtn: {
    width: "100%",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  safetyBtnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
    letterSpacing: 0.3,
  },
});
