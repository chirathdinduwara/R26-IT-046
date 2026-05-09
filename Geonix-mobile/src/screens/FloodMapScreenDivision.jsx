import {
  StyleSheet,
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Alert,
  Platform,
} from "react-native";

import MapView, { Polygon, Marker } from "react-native-maps";
import { useRef, useState } from "react";
import * as Location from "expo-location";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import DIVISION_COORDS from "../../assets/col_divs/devCords";

export default function FloodMapScreenDivision() {
  const API_URL = "http://192.168.8.100:8000";

  const [geojson, setGeojson] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [selectedDivision, setSelectedDivision] = useState(null);
  const [predictionMeta, setPredictionMeta] = useState(null);
  const [safetyModal, setSafetyModal] = useState(false);
  const [safetyResult, setSafetyResult] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [mapType, setMapType] = useState("hybrid");

  const [rain7, setRain7] = useState("");
  const [rain14, setRain14] = useState("");
  const [up7, setUp7] = useState("");
  const [up14, setUp14] = useState("");
  const [river, setRiver] = useState("");

  const mapRef = useRef(null);
  const fade = useRef(new Animated.Value(0)).current;
  const toastMsg = useRef("Done");
  // Track if prediction was triggered from location button
  const fromMyLocation = useRef(false);

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

  const MAP_TYPES = [
    { type: "standard", icon: "map-outline", label: "Map" },
    { type: "satellite", icon: "satellite-variant", label: "Satellite" },
    { type: "hybrid", icon: "layers-outline", label: "Hybrid" },
  ];

  // ── Nearest division ───────────────────────────────────────────────────────
  const getNearestDivision = (lat, lon) => {
    let best = null,
      bestDist = Infinity;
    for (const [name, c] of Object.entries(DIVISION_COORDS)) {
      const d = (lat - c.lat) ** 2 + (lon - c.lon) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = name;
      }
    }
    return best;
  };

  // ── Open predict modal ────────────────────────────────────────────────────
  const openPredictModal = (division, fromLocation = false) => {
    fromMyLocation.current = fromLocation;
    setSelectedDivision(division);
    setRain7("100");
    setRain14("200");
    setUp7("120");
    setUp14("240");
    setRiver("7.5");
    setPredictionMeta(null);
    setGeojson(null);
    setModalVisible(true);
  };

  // ── Map tap ────────────────────────────────────────────────────────────────
  const onMapPress = (e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    openPredictModal(getNearestDivision(latitude, longitude), false);
  };

  // ── My location button ────────────────────────────────────────────────────
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
        {
          latitude,
          longitude,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        },
        600,
      );

      openPredictModal(getNearestDivision(latitude, longitude), true);
    } catch (err) {
      console.error(err);
      toast("Could not get location");
    } finally {
      setLocating(false);
    }
  };

  // ── Predict ────────────────────────────────────────────────────────────────
  const predict = async () => {
    try {
      setLoading(true);

      const payload = {
        division: selectedDivision,
        rainfall_7day: parseFloat(rain7),
        rainfall_14day: parseFloat(rain14),
        upstream_rain_7d: parseFloat(up7),
        upstream_rain_14d: parseFloat(up14),
        river_water_level: parseFloat(river),
      };

      const res = await fetch(`${API_URL}/predict/subdist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.error) {
        toast("Invalid division");
        return;
      }

      const meta = {
        blocked: data.blocked ?? false,
        zones: data.zones ?? 0,
        flooded_pct: data.flooded_pct ?? 0,
        reason: data.reason ?? null,
      };

      setPredictionMeta(meta);
      setGeojson(data.geojson);
      setModalVisible(false);

      if (fromMyLocation.current) {
        // Show full safety popup when triggered from location button
        setSafetyResult({
          safe: meta.blocked || meta.zones === 0,
          division: selectedDivision,
          flooded_pct: meta.flooded_pct,
          zones: meta.zones,
          blocked: meta.blocked,
        });
        setSafetyModal(true);
      } else {
        toast(
          data.zones > 0
            ? `${data.zones} flood zone(s) found`
            : "No flood zones",
        );
      }
    } catch (err) {
      console.log(err);
      toast("API error");
    } finally {
      setLoading(false);
    }
  };

  // ── Polygons ───────────────────────────────────────────────────────────────
  const polygons =
    geojson?.features?.flatMap((f) => {
      const g = f.geometry;
      if (g.type === "Polygon") {
        return [
          {
            coords: g.coordinates[0].map(([lng, lat]) => ({
              latitude: lat,
              longitude: lng,
            })),
            severity: f.properties?.severity,
          },
        ];
      }
      return [];
    }) || [];

  // ── Status banner ──────────────────────────────────────────────────────────
  function getStatusBanner() {
    if (!predictionMeta || safetyModal) return null;
    const { blocked, zones, flooded_pct } = predictionMeta;
    if (blocked)
      return {
        icon: "✅",
        title: "No Flood Risk",
        body: "Rainfall and river level are below flood thresholds for this area.",
        bg: "#e8f5e9",
        border: "#27ae60",
        text: "#1b5e20",
      };
    if (zones === 0)
      return {
        icon: "🟡",
        title: "No Active Flooding",
        body: `Conditions monitored — no areas exceed the threshold (${flooded_pct.toFixed(1)}% risk).`,
        bg: "#fffde7",
        border: "#f9a825",
        text: "#5f4300",
      };
    return null;
  }

  const statusBanner = getStatusBanner();

  // ── Safety popup config ────────────────────────────────────────────────────
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

  return (
    <View style={styles.container}>
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
      {/* MAP */}
      <MapView
        ref={mapRef}
        style={styles.map}
        mapType={mapType}
        onPress={onMapPress}
        initialRegion={{
          latitude: 6.91,
          longitude: 79.92,
          latitudeDelta: 0.22,
          longitudeDelta: 0.22,
        }}
      >
        {polygons.map((p, i) => (
          <Polygon
            key={i}
            coordinates={p.coords}
            fillColor={
              p.severity === "high" ? "rgba(255,0,0,0.4)" : "rgba(0,0,255,0.3)"
            }
            strokeColor="black"
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

      {/* MY LOCATION BUTTON */}
      <TouchableOpacity
        style={styles.locationBtn}
        onPress={handleMyLocation}
        disabled={locating}
        activeOpacity={0.85}
      >
        {locating ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <MaterialCommunityIcons
            name="crosshairs-gps"
            size={22}
            color="#fff"
          />
        )}
      </TouchableOpacity>

      {/* LOADING */}
      {loading && (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#1E90FF" />
          <Text style={styles.loadingText}>Predicting...</Text>
        </View>
      )}

      {/* TOAST */}
      <Animated.View style={[styles.toast, { opacity: fade }]}>
        <Text style={styles.toastText}>{toastMsg.current}</Text>
      </Animated.View>

      {/* STATUS BANNER */}
      {!loading && statusBanner && (
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
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusTitle, { color: statusBanner.text }]}>
              {statusBanner.title}
            </Text>
            <Text style={[styles.statusBody, { color: statusBanner.text }]}>
              {statusBanner.body}
            </Text>
          </View>
        </View>
      )}

      {/* ── PREDICT MODAL ──────────────────────────────────────────────────── */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <View style={styles.modalHandle} />

            {fromMyLocation.current && (
              <View style={styles.myLocationBadge}>
                <MaterialCommunityIcons
                  name="crosshairs-gps"
                  size={12}
                  color="#5B8DEF"
                />
                <Text style={styles.myLocationBadgeText}>YOUR LOCATION</Text>
              </View>
            )}

            <Text style={styles.modalEyebrow}>DIVISION</Text>
            <Text style={styles.modalTitle}>{selectedDivision}</Text>

            <View style={styles.inputRow}>
              <View style={[styles.inputWrap, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Rain 7d (mm)</Text>
                <TextInput
                  style={styles.input}
                  value={rain7}
                  onChangeText={setRain7}
                  keyboardType="numeric"
                />
              </View>
              <View style={[styles.inputWrap, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Rain 14d (mm)</Text>
                <TextInput
                  style={styles.input}
                  value={rain14}
                  onChangeText={setRain14}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.inputRow}>
              <View style={[styles.inputWrap, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Upstream 7d (mm)</Text>
                <TextInput
                  style={styles.input}
                  value={up7}
                  onChangeText={setUp7}
                  keyboardType="numeric"
                />
              </View>
              <View style={[styles.inputWrap, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Upstream 14d (mm)</Text>
                <TextInput
                  style={styles.input}
                  value={up14}
                  onChangeText={setUp14}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.inputWrap}>
              <Text style={styles.inputLabel}>River Level (m)</Text>
              <TextInput
                style={styles.input}
                value={river}
                onChangeText={setRiver}
                keyboardType="numeric"
              />
            </View>

            <TouchableOpacity
              style={styles.btn}
              onPress={predict}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons
                name="water-alert"
                size={18}
                color="#fff"
              />
              <Text style={styles.btnText}>
                {fromMyLocation.current ? "Check My Safety" : "Run Prediction"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── SAFETY RESULT MODAL ────────────────────────────────────────────── */}
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

  // ── Location button ────────────────────────────────────────────────────────
  locationBtn: {
    position: "absolute",
    bottom: 108,
    right: 16,
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: "#0042A5",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },

  // ── User pin ───────────────────────────────────────────────────────────────
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
    backgroundColor: "#1E90FF",
    borderWidth: 2,
    borderColor: "#fff",
  },
  userPinRing: {
    position: "absolute",
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(30,144,255,0.18)",
    borderWidth: 1.5,
    borderColor: "rgba(30,144,255,0.45)",
  },

  // ── Loading ────────────────────────────────────────────────────────────────
  loading: {
    position: "absolute",
    top: "40%",
    alignSelf: "center",
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 14,
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  loadingText: { fontSize: 13, color: "#333", fontWeight: "500" },

  // ── Toast ──────────────────────────────────────────────────────────────────
  toast: {
    position: "absolute",
    top: 60,
    alignSelf: "center",
    backgroundColor: "#111",
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  toastText: { color: "white", fontSize: 13 },

  // ── Status banner ──────────────────────────────────────────────────────────
  statusBanner: {
    position: "absolute",
    bottom: 28,
    left: 16,
    right: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingVertical: 12,
    paddingHorizontal: 14,
    zIndex: 999,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  statusIcon: { fontSize: 22, lineHeight: 26 },
  statusTitle: { fontSize: 13, fontWeight: "700", marginBottom: 2 },
  statusBody: { fontSize: 12, lineHeight: 17 },

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

  // ── Predict modal ──────────────────────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  modal: {
    backgroundColor: "#161B22",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: "#30363D",
    borderBottomWidth: 0,
  },
  modalHandle: {
    width: 36,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#30363D",
    alignSelf: "center",
    marginBottom: 14,
  },
  myLocationBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#7A520022",
    borderWidth: 1,
    borderColor: "#7A520066",
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
    marginBottom: 10,
  },
  myLocationBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#F0A500",
    letterSpacing: 1.5,
  },
  modalEyebrow: {
    fontSize: 9,
    fontWeight: "800",
    color: "#8B949E",
    letterSpacing: 2.5,
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#E6EDF3",
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  inputRow: { flexDirection: "row", gap: 10 },
  inputWrap: { marginBottom: 10 },
  inputLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#8B949E",
    marginBottom: 5,
    letterSpacing: 0.8,
  },
  input: {
    backgroundColor: "#21262D",
    padding: 11,
    borderRadius: 10,
    fontSize: 14,
    color: "#E6EDF3",
    borderWidth: 1,
    borderColor: "#30363D",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  btn: {
    backgroundColor: "#7A5200",
    borderWidth: 1,
    borderColor: "#F0A500",
    padding: 14,
    borderRadius: 12,
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  btnText: {
    color: "#F0A500",
    fontWeight: "800",
    fontSize: 15,
    letterSpacing: 0.3,
  },
  cancelBtn: { marginTop: 8, padding: 10, alignItems: "center" },
  cancelText: {
    color: "#484F58",
    fontSize: 13,
    fontWeight: "600",
  },

  // ── Safety modal ───────────────────────────────────────────────────────────
  safetyBackdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.72)",
    padding: 24,
  },
  safetyCard: {
    width: "100%",
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
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
    backgroundColor: "#ffffff15",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
    marginBottom: 14,
  },
  safetyDivisionText: { fontSize: 12, color: "#ccc", fontWeight: "600" },
  safetyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
    marginBottom: 8,
  },
  safetyBody: {
    fontSize: 13,
    color: "#aaa",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 22,
  },
  safetyStats: {
    flexDirection: "row",
    backgroundColor: "#ffffff10",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 22,
    gap: 24,
  },
  statBox: { alignItems: "center" },
  statValue: { fontSize: 22, fontWeight: "800", color: "#fff" },
  statLabel: { fontSize: 11, color: "#888", marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: "#ffffff20" },
  safetyBtn: {
    width: "100%",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  safetyBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
