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
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import MapView, { Circle, Marker, Polyline } from "react-native-maps";

const STORAGE_KEY = "@flood_app_settings";

const C = {
  bg: "#0D1117",
  surface: "#161B22",
  border: "#30363D",
  text: "#E6EDF3",
  sub: "#8B949E",
  amber: "#F0A500",
  green: "#3FB950",
  red: "#F85149",
};

async function parseJsonResponse(res) {
  const raw = await res.text();
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(raw?.slice(0, 160) || "Server returned a non-JSON response.");
  }
}

export default function SafeNavigationScreen() {
  const [apiUrl, setApiUrl] = useState("http://192.168.199.22:8000");
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);

  const [destinationQuery, setDestinationQuery] = useState("");
  const [destination, setDestination] = useState(null);
  const [destinationResults, setDestinationResults] = useState([]);
  const [destinationLoading, setDestinationLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [selectedRouteId, setSelectedRouteId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.apiUrl) setApiUrl(parsed.apiUrl);
        }
      } catch {}
      await detectCurrentLocation(false);
    })();
  }, []);

  useEffect(() => {
    const q = destinationQuery.trim();
    if (destination && destination.label === q) {
      return;
    }
    if (q.length < 2) {
      setDestinationResults([]);
      setDestinationLoading(false);
      return;
    }

    const timer = setTimeout(() => {
      searchDestinationSuggestions(q);
    }, 350);

    return () => clearTimeout(timer);
  }, [destinationQuery, apiUrl]);

  const detectCurrentLocation = async (showError = true) => {
    try {
      setLocationLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        if (showError) {
          Alert.alert("Permission Denied", "Location permission is required.");
        }
        return false;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCurrentLocation({
        lat: Number(loc.coords.latitude.toFixed(6)),
        lon: Number(loc.coords.longitude.toFixed(6)),
      });
      return true;
    } catch {
      if (showError) {
        Alert.alert("Location Error", "Could not get current location.");
      }
      return false;
    } finally {
      setLocationLoading(false);
    }
  };

  const searchDestinationSuggestions = async (q) => {
    try {
      setDestinationLoading(true);
      const res = await fetch(
        `${apiUrl}/safe-route/search-destination?q=${encodeURIComponent(q)}&limit=6`,
      );
      const data = await parseJsonResponse(res);
      if (!res.ok) {
        throw new Error(data?.detail || "Destination search failed.");
      }
      // Ignore stale responses.
      if (q !== destinationQuery.trim()) return;
      setDestinationResults(Array.isArray(data?.results) ? data.results : []);
    } catch (err) {
      setDestinationResults([]);
      if (q === destinationQuery.trim()) {
        Alert.alert("Search Error", String(err.message || err));
      }
    } finally {
      if (q === destinationQuery.trim()) {
        setDestinationLoading(false);
      }
    }
  };

  const selectDestination = (item) => {
    setDestination(item);
    setDestinationQuery(item.label);
    setDestinationResults([]);
  };

  const fetchRoutes = async () => {
    if (!currentLocation) {
      const ok = await detectCurrentLocation(true);
      if (!ok) return;
    }
    if (!destination) {
      Alert.alert("Destination Required", "Type destination and select one suggestion.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/safe-route/routes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: { lat: currentLocation.lat, lon: currentLocation.lon },
          destination: { lat: destination.lat, lon: destination.lon },
          alternatives: true,
        }),
      });
      const data = await parseJsonResponse(res);
      if (!res.ok) {
        throw new Error(data?.detail || "Failed to fetch routes");
      }
      setResult(data);
      setSelectedRouteId(data?.recommended_route_id ?? null);
    } catch (err) {
      Alert.alert("Safe Route Error", String(err.message || err));
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
        latitudeDelta: 0.18,
        longitudeDelta: 0.18,
      };
    }

    if (currentLocation && destination) {
      const centerLat = (currentLocation.lat + destination.lat) / 2;
      const centerLon = (currentLocation.lon + destination.lon) / 2;
      return {
        latitude: centerLat,
        longitude: centerLon,
        latitudeDelta: Math.max(0.1, Math.abs(currentLocation.lat - destination.lat) * 2),
        longitudeDelta: Math.max(0.1, Math.abs(currentLocation.lon - destination.lon) * 2),
      };
    }

    if (currentLocation) {
      return {
        latitude: currentLocation.lat,
        longitude: currentLocation.lon,
        latitudeDelta: 0.14,
        longitudeDelta: 0.14,
      };
    }

    return {
      latitude: 6.9271,
      longitude: 79.8612,
      latitudeDelta: 0.25,
      longitudeDelta: 0.25,
    };
  }, [selectedRoute, currentLocation, destination]);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Safe Navigation</Text>
        <Text style={styles.subtitle}>
          Current location is automatic. Start typing destination to get suggestions.
        </Text>

        <View style={styles.card}>
          <Text style={styles.section}>Current Location</Text>
          <Text style={styles.meta}>
            {currentLocation ? `${currentLocation.lat}, ${currentLocation.lon}` : "Detecting location..."}
          </Text>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => detectCurrentLocation(true)}
            disabled={locationLoading}
          >
            {locationLoading ? (
              <ActivityIndicator color={C.sub} />
            ) : (
              <Text style={styles.secondaryBtnText}>Refresh Current Location</Text>
            )}
          </TouchableOpacity>

          <Text style={[styles.section, { marginTop: 12 }]}>Destination</Text>
          <TextInput
            style={styles.input}
            placeholder="Type destination name..."
            placeholderTextColor={C.sub}
            value={destinationQuery}
            onChangeText={(text) => {
              setDestinationQuery(text);
              setDestination(null);
            }}
            autoCapitalize="words"
          />
          {destinationLoading && <Text style={styles.meta}>Searching...</Text>}
          {!!destination && <Text style={styles.meta}>Selected: {destination.label}</Text>}

          {destinationResults.map((item) => (
            <TouchableOpacity key={item.id} style={styles.resultItem} onPress={() => selectDestination(item)}>
              <Text numberOfLines={2} style={styles.resultText}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.primaryBtn} onPress={fetchRoutes} disabled={loading}>
            {loading ? (
              <ActivityIndicator color={C.bg} />
            ) : (
              <Text style={styles.primaryBtnText}>Find Dangerous + Safe Routes</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.mapWrap}>
          <MapView style={styles.map} initialRegion={mapRegion} region={mapRegion}>
            {safeRoute?.coordinates?.length > 1 && (
              <Polyline
                coordinates={safeRoute.coordinates.map((p) => ({
                  latitude: p.lat,
                  longitude: p.lon,
                }))}
                strokeColor={selectedRoute?.id === safeRoute.id ? C.green : "#2B7A3F"}
                strokeWidth={selectedRoute?.id === safeRoute.id ? 6 : 4}
              />
            )}

            {dangerousRoute?.coordinates?.length > 1 && (
              <Polyline
                coordinates={dangerousRoute.coordinates.map((p) => ({
                  latitude: p.lat,
                  longitude: p.lon,
                }))}
                strokeColor={selectedRoute?.id === dangerousRoute.id ? C.red : "#A33733"}
                strokeWidth={selectedRoute?.id === dangerousRoute.id ? 6 : 4}
              />
            )}

            {result?.flooded_areas?.slice(0, 40).map((zone) => (
              <Circle
                key={zone.id}
                center={{
                  latitude: zone.centroid.lat,
                  longitude: zone.centroid.lon,
                }}
                radius={120}
                fillColor="rgba(248,81,73,0.25)"
                strokeColor="rgba(248,81,73,0.7)"
              />
            ))}

            {!!currentLocation && (
              <Marker
                coordinate={{
                  latitude: currentLocation.lat,
                  longitude: currentLocation.lon,
                }}
                title="Current Location"
              />
            )}

            {!!destination && (
              <Marker
                coordinate={{
                  latitude: destination.lat,
                  longitude: destination.lon,
                }}
                title="Destination"
              />
            )}
          </MapView>
        </View>

        {result && (
          <View style={styles.card}>
            <Text style={styles.section}>Route Comparison</Text>
            <TouchableOpacity
              style={styles.safeBtn}
              onPress={() => safeRoute && setSelectedRouteId(safeRoute.id)}
            >
              <Text style={styles.safeBtnText}>Go with Safe Route</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dangerBtn}
              onPress={() => dangerousRoute && setSelectedRouteId(dangerousRoute.id)}
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
                  {route.distance_km} km | {route.duration_in_traffic_min} min (traffic)
                </Text>
                <Text style={styles.routeMeta}>
                  risk {route.risk_score} | traffic roads {route.traffic_road_count} | flooded roads{" "}
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
  input: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    color: C.text,
    backgroundColor: "#0F141B",
  },
  resultItem: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 9,
    backgroundColor: "#0F141B",
  },
  resultText: { color: C.text, fontSize: 12 },
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
