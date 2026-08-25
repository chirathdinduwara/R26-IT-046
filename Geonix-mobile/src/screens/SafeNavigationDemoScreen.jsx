import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useEffect, useMemo, useState } from "react";
import * as Location from "expo-location";
import MapView, { Circle, Marker, Polyline } from "react-native-maps";
import { SAFE_ROUTE_API_URL } from "../config/api";

const DEFAULT_SAFE_ROUTE_API_URL = SAFE_ROUTE_API_URL;

function normalizeSafeRouteApiUrl(rawUrl) {
  const value = String(rawUrl || "").trim();
  if (!value) return DEFAULT_SAFE_ROUTE_API_URL;
  try {
    const url = new URL(value);
    return url.toString().replace(/\/$/, "");
  } catch {
    return value.replace(/\/$/, "");
  }
}

const C = {
  bg: "#0D1117",
  surface: "#161B22",
  border: "#30363D",
  text: "#E6EDF3",
  sub: "#8B949E",
  blue: "#58A6FF",
  blueDim: "#1f385c",
  red: "#F85149",
  redDim: "#5c1d1a",
  green: "#56ef5c",
  greenDim: "#1a5c1f",
};

async function parseJsonResponse(res) {
  const raw = await res.text();
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(raw?.slice(0, 160) || "Server returned non-JSON response.");
  }
}

export default function SafeNavigationDemoScreen() {
  const [apiUrl, setApiUrl] = useState(DEFAULT_SAFE_ROUTE_API_URL);
  const [originLat, setOriginLat] = useState("6.9038");
  const [originLon, setOriginLon] = useState("79.8550");
  const [destLat, setDestLat] = useState("6.9271");
  const [destLon, setDestLon] = useState("79.8612");
  const [temp, setTemp] = useState("28");
  const [humidity, setHumidity] = useState("80");
  const [rainfall, setRainfall] = useState("2");
  const [trafficMultiplier, setTrafficMultiplier] = useState("1.2");
  const [floodLat, setFloodLat] = useState("");
  const [floodLon, setFloodLon] = useState("");
  const [floodPoints, setFloodPoints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [selectedRouteId, setSelectedRouteId] = useState(null);

  useEffect(() => {
    // No async storage load needed
  }, []);

  const setCurrentAsOrigin = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Location permission is required.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setOriginLat(String(loc.coords.latitude.toFixed(6)));
      setOriginLon(String(loc.coords.longitude.toFixed(6)));
    } catch {
      Alert.alert("Location Error", "Could not fetch current location.");
    }
  };

  const addFloodPoint = () => {
    const lat = Number(floodLat);
    const lon = Number(floodLon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      Alert.alert("Invalid Flood Point", "Enter valid flood point lat/lon.");
      return;
    }
    setFloodPoints((prev) => [...prev, { lat, lon }]);
    setFloodLat("");
    setFloodLon("");
  };

  const clearFloodPoints = () => setFloodPoints([]);

  const findRoutes = async () => {
    const oLat = Number(originLat);
    const oLon = Number(originLon);
    const dLat = Number(destLat);
    const dLon = Number(destLon);
    if ([oLat, oLon, dLat, dLon].some((v) => Number.isNaN(v))) {
      Alert.alert(
        "Invalid Inputs",
        "Enter valid origin and destination lat/lon.",
      );
      return;
    }

    const t = Number(temp);
    const h = Number(humidity);
    const r = Number(rainfall);
    const tm = Number(trafficMultiplier);
    if ([t, h, r, tm].some((v) => Number.isNaN(v))) {
      Alert.alert(
        "Invalid Demo Inputs",
        "Enter valid weather and traffic values.",
      );
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/safe-route/routes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: { lat: oLat, lon: oLon },
          destination: { lat: dLat, lon: dLon },
          alternatives: true,
          demo_mode: true,
          demo_config: {
            weather: {
              temperature: t,
              humidity: h,
              rainfall: r,
            },
            traffic_multiplier: tm,
            flood_points: floodPoints,
          },
        }),
      });
      const data = await parseJsonResponse(res);
      if (!res.ok) {
        throw new Error(data?.detail || "Failed to fetch demo routes.");
      }
      setResult(data);
      setSelectedRouteId(data?.recommended_route_id ?? null);
    } catch (err) {
      Alert.alert("Demo Route Error", String(err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const selectedRoute = useMemo(() => {
    if (!result?.routes?.length) return null;
    return (
      result.routes.find((r) => r.id === selectedRouteId) ||
      result.routes.find((r) => r.id === result.recommended_route_id) ||
      result.routes[0]
    );
  }, [result, selectedRouteId]);

  const safeRoute = result?.safe_route;
  const dangerousRoute = result?.dangerous_route;

  const mapRegion = useMemo(() => {
    if (selectedRoute?.coordinates?.length) {
      const first = selectedRoute.coordinates[0];
      return {
        latitude: first.lat,
        longitude: first.lon,
        latitudeDelta: 0.2,
        longitudeDelta: 0.2,
      };
    }
    const oLat = Number(originLat);
    const oLon = Number(originLon);
    if (!Number.isNaN(oLat) && !Number.isNaN(oLon)) {
      return {
        latitude: oLat,
        longitude: oLon,
        latitudeDelta: 0.2,
        longitudeDelta: 0.2,
      };
    }
    return {
      latitude: 6.9271,
      longitude: 79.8612,
      latitudeDelta: 0.3,
      longitudeDelta: 0.3,
    };
  }, [selectedRoute, originLat, originLon]);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Safe Navigation Demo</Text>
        <Text style={styles.subtitle}>
          Manual demo controls for weather, traffic, and flood points.
        </Text>

        <View style={styles.card}>
          <Text style={styles.section}>Origin / Destination</Text>
          <View style={styles.row}>
            <TextInput
              style={styles.input}
              placeholder="Origin lat"
              placeholderTextColor={C.sub}
              value={originLat}
              onChangeText={setOriginLat}
              keyboardType="decimal-pad"
            />
            <TextInput
              style={styles.input}
              placeholder="Origin lon"
              placeholderTextColor={C.sub}
              value={originLon}
              onChangeText={setOriginLon}
              keyboardType="decimal-pad"
            />
          </View>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={setCurrentAsOrigin}
          >
            <Text style={styles.secondaryBtnText}>
              Use Current Location as Origin
            </Text>
          </TouchableOpacity>
          <View style={styles.row}>
            <TextInput
              style={styles.input}
              placeholder="Destination lat"
              placeholderTextColor={C.sub}
              value={destLat}
              onChangeText={setDestLat}
              keyboardType="decimal-pad"
            />
            <TextInput
              style={styles.input}
              placeholder="Destination lon"
              placeholderTextColor={C.sub}
              value={destLon}
              onChangeText={setDestLon}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>Demo Weather + Traffic</Text>
          <View style={styles.row}>
            <TextInput
              style={styles.input}
              placeholder="Temp °C"
              placeholderTextColor={C.sub}
              value={temp}
              onChangeText={setTemp}
              keyboardType="decimal-pad"
            />
            <TextInput
              style={styles.input}
              placeholder="Humidity %"
              placeholderTextColor={C.sub}
              value={humidity}
              onChangeText={setHumidity}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.row}>
            <TextInput
              style={styles.input}
              placeholder="Rainfall mm/h"
              placeholderTextColor={C.sub}
              value={rainfall}
              onChangeText={setRainfall}
              keyboardType="decimal-pad"
            />
            <TextInput
              style={styles.input}
              placeholder="Traffic multiplier (0.25-3)"
              placeholderTextColor={C.sub}
              value={trafficMultiplier}
              onChangeText={setTrafficMultiplier}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>Manual Flood Points</Text>
          <View style={styles.row}>
            <TextInput
              style={styles.input}
              placeholder="Flood point lat"
              placeholderTextColor={C.sub}
              value={floodLat}
              onChangeText={setFloodLat}
              keyboardType="decimal-pad"
            />
            <TextInput
              style={styles.input}
              placeholder="Flood point lon"
              placeholderTextColor={C.sub}
              value={floodLon}
              onChangeText={setFloodLon}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.row}>
            <TouchableOpacity
              style={styles.secondaryBtnHalf}
              onPress={addFloodPoint}
            >
              <Text style={styles.secondaryBtnText}>Add Flood Point</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryBtnHalf}
              onPress={clearFloodPoints}
            >
              <Text style={styles.secondaryBtnText}>Clear Points</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.meta}>Flood points: {floodPoints.length}</Text>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={findRoutes}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={C.bg} />
            ) : (
              <Text style={styles.primaryBtnText}>
                Find Dangerous + Safe Routes
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.mapWrap}>
          <MapView
            style={styles.map}
            initialRegion={mapRegion}
            region={mapRegion}
          >
            {safeRoute?.coordinates?.length > 1 && (
              <Polyline
                coordinates={safeRoute.coordinates.map((p) => ({
                  latitude: p.lat,
                  longitude: p.lon,
                }))}
                strokeColor={
                  selectedRoute?.id === safeRoute.id ? C.green : "#2B7A3F"
                }
                strokeWidth={selectedRoute?.id === safeRoute.id ? 6 : 4}
              />
            )}
            {dangerousRoute?.coordinates?.length > 1 && (
              <Polyline
                coordinates={dangerousRoute.coordinates.map((p) => ({
                  latitude: p.lat,
                  longitude: p.lon,
                }))}
                strokeColor={
                  selectedRoute?.id === dangerousRoute.id ? C.red : "#A33733"
                }
                strokeWidth={selectedRoute?.id === dangerousRoute.id ? 6 : 4}
              />
            )}

            {floodPoints.map((p, i) => (
              <Circle
                key={`manual-${i}`}
                center={{ latitude: p.lat, longitude: p.lon }}
                radius={230}
                fillColor="rgba(248,81,73,0.25)"
                strokeColor="rgba(248,81,73,0.8)"
              />
            ))}

            {result?.flooded_areas?.slice(0, 40).map((zone) => (
              <Circle
                key={`pred-${zone.id}`}
                center={{
                  latitude: zone.centroid.lat,
                  longitude: zone.centroid.lon,
                }}
                radius={120}
                fillColor="rgba(255,165,0,0.22)"
                strokeColor="rgba(255,165,0,0.8)"
              />
            ))}

            {!Number.isNaN(Number(originLat)) &&
              !Number.isNaN(Number(originLon)) &&
              originLat &&
              originLon && (
                <Marker
                  coordinate={{
                    latitude: Number(originLat),
                    longitude: Number(originLon),
                  }}
                  title="Origin"
                />
              )}
            {!Number.isNaN(Number(destLat)) &&
              !Number.isNaN(Number(destLon)) &&
              destLat &&
              destLon && (
                <Marker
                  coordinate={{
                    latitude: Number(destLat),
                    longitude: Number(destLon),
                  }}
                  title="Destination"
                />
              )}
          </MapView>
        </View>

        {result && (
          <View style={styles.card}>
            <Text style={styles.section}>Output</Text>
            <Text style={styles.meta}>
              Demo mode: {String(result.demo_mode)}
            </Text>
            <TouchableOpacity
              style={styles.safeBtn}
              onPress={() => safeRoute && setSelectedRouteId(safeRoute.id)}
            >
              <Text style={styles.safeBtnText}>Go with Safe Route</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dangerBtn}
              onPress={() =>
                dangerousRoute && setSelectedRouteId(dangerousRoute.id)
              }
            >
              <Text style={styles.dangerBtnText}>Show Dangerous Route</Text>
            </TouchableOpacity>
            {result.routes?.map((route) => (
              <TouchableOpacity
                key={route.id}
                style={[
                  styles.routeCard,
                  selectedRouteId === route.id && styles.routeCardActive,
                ]}
                onPress={() => setSelectedRouteId(route.id)}
              >
                <Text style={styles.routeTitle}>
                  {route.type === "safe"
                    ? "SAFE ROUTE"
                    : route.type === "dangerous"
                      ? "DANGEROUS ROUTE"
                      : "ALTERNATIVE"}
                </Text>
                <Text style={styles.routeMeta}>
                  {route.distance_km} km | {route.duration_in_traffic_min} min
                  (traffic)
                </Text>
                <Text style={styles.routeMeta}>
                  risk {route.risk_score} | traffic roads{" "}
                  {route.traffic_road_count} | flooded roads{" "}
                  {route.flooded_road_count}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 14, gap: 12 },
  title: { color: C.text, fontSize: 22, fontWeight: "800" },
  subtitle: { color: C.sub, fontSize: 12, marginBottom: 6 },
  card: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  section: { color: C.text, fontSize: 13, fontWeight: "700" },
  meta: { color: C.sub, fontSize: 12 },
  row: { flexDirection: "row", gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    color: C.text,
    backgroundColor: "#0F141B",
  },
  primaryBtn: {
    backgroundColor: C.amber,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
  },
  primaryBtnText: { color: C.bg, fontWeight: "800", fontSize: 12 },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  secondaryBtnHalf: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  secondaryBtnText: { color: C.sub, fontSize: 12, fontWeight: "600" },
  mapWrap: {
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.border,
  },
  map: { height: 300, width: "100%" },
  safeBtn: {
    backgroundColor: C.green,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  safeBtnText: { color: C.bg, fontWeight: "800" },
  dangerBtn: {
    backgroundColor: C.red,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  dangerBtnText: { color: C.text, fontWeight: "800" },
  routeCard: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 10,
    gap: 3,
    backgroundColor: "#0F141B",
  },
  routeCardActive: { borderColor: C.amber },
  routeTitle: { color: C.amber, fontSize: 11, fontWeight: "800" },
  routeMeta: { color: C.sub, fontSize: 11 },
});
