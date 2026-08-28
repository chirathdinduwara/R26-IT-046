import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import React, { useEffect, useMemo, useState } from "react";
import * as Location from "expo-location";
import MapView, { Circle, Marker, Polyline } from "react-native-maps";
import { MaterialCommunityIcons } from "@expo/vector-icons";
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

function safeToFixed(val, decimals = 1, fallback = "0.0") {
  const num = Number(val);
  return Number.isFinite(num) ? num.toFixed(decimals) : fallback;
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
  amber: "#FFB020",
};

async function parseJsonResponse(res) {
  const raw = await res.text();
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(
      raw?.slice(0, 160) || "Server returned a non-JSON response.",
    );
  }
}

const MAP_TYPES = [
  { type: "standard", icon: "map-outline", label: "Map" },
  { type: "satellite", icon: "satellite-variant", label: "Satellite" },
  { type: "hybrid", icon: "layers-outline", label: "Hybrid" },
];

export default function SafeNavigationScreen() {
  const [apiUrl, setApiUrl] = useState(DEFAULT_SAFE_ROUTE_API_URL);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);

  const [destinationQuery, setDestinationQuery] = useState("");
  const [destination, setDestination] = useState(null);
  const [destinationResults, setDestinationResults] = useState([]);
  const [destinationLoading, setDestinationLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [mapType, setMapType] = useState("hybrid");

  useEffect(() => {
    (async () => {
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

  useEffect(() => {
    let subscription = null;

    if (isNavigating) {
      (async () => {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== "granted") return;

          subscription = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.BestForNavigation,
              timeInterval: 2000,
              distanceInterval: 5,
            },
            (loc) => {
              if (loc?.coords?.latitude != null && loc?.coords?.longitude != null) {
                setCurrentLocation({
                  lat: Number(loc.coords.latitude.toFixed(6)),
                  lon: Number(loc.coords.longitude.toFixed(6)),
                });
              }
            }
          );
        } catch (e) {
          console.warn("Location watch error:", e);
        }
      })();
    }

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, [isNavigating]);

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
      if (loc?.coords?.latitude != null && loc?.coords?.longitude != null) {
        setCurrentLocation({
          lat: Number(loc.coords.latitude.toFixed(6)),
          lon: Number(loc.coords.longitude.toFixed(6)),
        });
      }
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
      Alert.alert(
        "Destination Required",
        "Type destination and select one suggestion.",
      );
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

  const handleGoSafe = () => {
    if (!safeRoute) return;
    setIsNavigating(true);
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
    if (isNavigating && currentLocation) {
      return {
        latitude: currentLocation.lat,
        longitude: currentLocation.lon,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      };
    }

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
        latitudeDelta: Math.max(
          0.1,
          Math.abs(currentLocation.lat - destination.lat) * 2,
        ),
        longitudeDelta: Math.max(
          0.1,
          Math.abs(currentLocation.lon - destination.lon) * 2,
        ),
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
  }, [selectedRoute, currentLocation, destination, isNavigating]);

  if (isNavigating && selectedRoute) {
    return (
      <View style={styles.navScreen}>
        <MapView
          style={styles.navMap}
          initialRegion={mapRegion}
          region={mapRegion}
          showsUserLocation={true}
          followsUserLocation={true}
          mapType={mapType}
        >
          {selectedRoute?.coordinates?.length > 1 && (
            <Polyline
              coordinates={selectedRoute.coordinates.map((p) => ({
                latitude: p.lat,
                longitude: p.lon,
              }))}
              strokeColor={selectedRoute.type === "safe" ? C.green : C.red}
              strokeWidth={7}
            />
          )}

          {result?.flooded_areas?.slice(0, 40).map((zone) => zone?.centroid?.lat != null && zone?.centroid?.lon != null && (
            <Circle
              key={`nav-zone-${zone.id}`}
              center={{
                latitude: zone.centroid.lat,
                longitude: zone.centroid.lon,
              }}
              radius={120}
              fillColor="rgba(248,81,73,0.25)"
              strokeColor="rgba(248,81,73,0.7)"
            />
          ))}

          {result?.rainfall_areas?.map((area) => area?.center?.lat != null && area?.center?.lon != null && (
            <React.Fragment key={`nav-rain-group-${area.id}`}>
              <Circle
                center={{
                  latitude: area.center.lat,
                  longitude: area.center.lon,
                }}
                radius={area.radius || 100}
                fillColor="rgba(248,81,73,0.08)"
                strokeColor="rgba(248,81,73,0.3)"
              />
              <Marker
                coordinate={{
                  latitude: area.center.lat,
                  longitude: area.center.lon,
                }}
                title="Rainfall Zone"
                description={`Rain: ${safeToFixed(area.intensity, 1, "0.0")} mm/h`}
              >
                <View style={{ backgroundColor: "#F85149", padding: 6, borderRadius: 20, borderWidth: 1.5, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }}>
                  <MaterialCommunityIcons name="cloud-rain" size={16} color="#FFFFFF" />
                </View>
              </Marker>
            </React.Fragment>
          ))}

          {!!currentLocation && (
            <Marker
              coordinate={{
                latitude: currentLocation.lat,
                longitude: currentLocation.lon,
              }}
              title="Your Location"
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

        {/* Floating Dashboard Widget overlay */}
        <View style={styles.navOverlay}>
          <Text style={styles.navOverlayTitle}>🛡️ Navigation Assistant</Text>
          
          <Text style={[styles.navOverlaySafety, { color: selectedRoute.type === "safe" ? C.green : C.red }]}>
            {selectedRoute.type === "safe" ? "🟢 Safe Route" : "🔴 Caution: Dangerous Route"} ({selectedRoute.risk_score != null ? Math.round((1 - selectedRoute.risk_score) * 100) : 100}% Safe)
          </Text>

          {/* Mini Weather metrics inside overlay */}
          {result?.weather && (
            <View style={styles.navWeatherRow}>
              <Text style={styles.navWeatherText}>🌡️ {safeToFixed(result.weather.temperature, 1, "--")}°C</Text>
              <Text style={styles.navWeatherText}>💧 {result.weather.humidity ?? "--"}%</Text>
              <Text style={styles.navWeatherText}>🌧️ {safeToFixed(result.weather.rainfall, 1, "0.0")}mm</Text>
              <Text style={styles.navWeatherText}>💨 {safeToFixed(result.weather.wind_speed, 1, "0.0")}km/h</Text>
            </View>
          )}

          <ScrollView style={styles.navOverlayReasons} nestedScrollEnabled={true}>
            {selectedRoute.safe_reasons?.map((reason, idx) => (
              <Text key={`nav-safe-${idx}`} style={styles.navReasonText}>🟢 {reason}</Text>
            ))}
            {selectedRoute.danger_reasons?.map((reason, idx) => (
              <Text key={`nav-danger-${idx}`} style={styles.navReasonText}>⚠️ {reason}</Text>
            ))}
          </ScrollView>

          {selectedRoute.routemaster_recommendations && selectedRoute.routemaster_recommendations.length > 0 && (
            <View style={{ padding: 8, backgroundColor: "rgba(57,213,198,0.05)", borderRadius: 8, borderWidth: 1, borderColor: C.border, marginTop: 4 }}>
              <Text style={{ color: C.amber, fontSize: 10, fontWeight: "800", marginBottom: 2 }}>🛡️ RouteMaster AI Safety Guidelines:</Text>
              <ScrollView style={{ maxHeight: 75 }} nestedScrollEnabled={true}>
                {selectedRoute.routemaster_recommendations.map((rec, idx) => (
                  <Text key={`nav-rec-${idx}`} style={{ color: C.text, fontSize: 9, marginTop: 2, lineHeight: 12 }}>
                    • {rec}
                  </Text>
                ))}
              </ScrollView>
            </View>
          )}

          <TouchableOpacity
            style={styles.exitBtn}
            onPress={() => setIsNavigating(false)}
          >
            <Text style={styles.exitBtnText}>Exit Navigation</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Safe Navigation</Text>
        <Text style={styles.subtitle}>
          Current location is automatic. Start typing destination to get
          suggestions.
        </Text>

        <View style={styles.card}>
          <Text style={styles.section}>Current Location</Text>
          <Text style={styles.meta}>
            {currentLocation
              ? `${currentLocation.lat}, ${currentLocation.lon}`
              : "Detecting location..."}
          </Text>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => detectCurrentLocation(true)}
            disabled={locationLoading}
          >
            {locationLoading ? (
              <ActivityIndicator color={C.sub} />
            ) : (
              <Text style={styles.secondaryBtnText}>
                Refresh Current Location
              </Text>
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
          {!!destination && (
            <Text style={styles.meta}>Selected: {destination.label}</Text>
          )}

          {destinationResults.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.resultItem}
              onPress={() => selectDestination(item)}
            >
              <Text numberOfLines={2} style={styles.resultText}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={fetchRoutes}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={C.bg} />
            ) : (
              <Text style={styles.primaryBtnText}>
                Find Safe Route
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {result?.weather && (
          <View style={styles.weatherCard}>
            <Text style={styles.weatherTitle}>🌦️ Current Weather Conditions</Text>
            <View style={styles.weatherRow}>
              <View style={styles.weatherItem}>
                <Text style={styles.weatherVal}>{safeToFixed(result.weather.temperature, 1, "--")}°C</Text>
                <Text style={styles.weatherLabel}>Temperature</Text>
              </View>
              <View style={styles.weatherItem}>
                <Text style={styles.weatherVal}>{result.weather.humidity ?? "--"}%</Text>
                <Text style={styles.weatherLabel}>Humidity</Text>
              </View>
              <View style={styles.weatherItem}>
                <Text style={styles.weatherVal}>{safeToFixed(result.weather.rainfall, 1, "0.0")} mm</Text>
                <Text style={styles.weatherLabel}>Rainfall</Text>
              </View>
              <View style={styles.weatherItem}>
                <Text style={styles.weatherVal}>{safeToFixed(result.weather.wind_speed, 1, "0.0")} km/h</Text>
                <Text style={styles.weatherLabel}>Wind Speed</Text>
              </View>
            </View>
          </View>
        )}

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
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.mapWrap}>
          <MapView
            style={styles.map}
            initialRegion={mapRegion}
            region={mapRegion}
            mapType={mapType}
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

            {result?.flooded_areas?.slice(0, 40).map((zone) => zone?.centroid?.lat != null && zone?.centroid?.lon != null && (
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

            {result?.rainfall_areas?.map((area) => area?.center?.lat != null && area?.center?.lon != null && (
              <React.Fragment key={`rain-group-${area.id}`}>
                <Circle
                  center={{
                    latitude: area.center.lat,
                    longitude: area.center.lon,
                  }}
                  radius={area.radius || 100}
                  fillColor="rgba(248,81,73,0.08)"
                  strokeColor="rgba(248,81,73,0.3)"
                />
                <Marker
                  coordinate={{
                    latitude: area.center.lat,
                    longitude: area.center.lon,
                  }}
                  title="Rainfall Zone"
                  description={`Rain: ${safeToFixed(area.intensity, 1, "0.0")} mm/h`}
                >
                  <View style={{ backgroundColor: "#F85149", padding: 6, borderRadius: 20, borderWidth: 1.5, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }}>
                    <MaterialCommunityIcons name="cloud-rain" size={16} color="#FFFFFF" />
                  </View>
                </Marker>
              </React.Fragment>
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
              onPress={handleGoSafe}
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

            {result.routes?.filter(route => route.type === "safe" || route.type === "dangerous").map((route) => (
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
            {selectedRoute && (
              <View style={[styles.card, { marginTop: 12, borderLeftWidth: 4, borderLeftColor: selectedRoute.type === "safe" ? C.green : C.red }]}>
                <Text style={styles.section}>Route Safety Assessment</Text>
                {selectedRoute.type === "safe" ? (
                  <Text style={[styles.meta, { color: C.green, fontWeight: "bold" }]}>
                    Recommended Safe & Fast Route (Safety Rating: {selectedRoute.risk_score != null ? Math.round((1 - selectedRoute.risk_score) * 100) : 100}%)
                  </Text>
                ) : (
                  <Text style={[styles.meta, { color: C.red, fontWeight: "bold" }]}>
                    Use Caution: Dangerous Route Option (Safety Rating: {selectedRoute.risk_score != null ? Math.round((1 - selectedRoute.risk_score) * 100) : 100}%)
                  </Text>
                )}

                {selectedRoute.safe_reasons?.map((reason, idx) => (
                  <Text key={`safe-reason-${idx}`} style={styles.reasonText}>
                    🟢 {reason}
                  </Text>
                ))}

                {selectedRoute.danger_reasons?.map((reason, idx) => (
                  <Text key={`danger-reason-${idx}`} style={styles.reasonText}>
                    ⚠️ {reason}
                  </Text>
                ))}

                {(!selectedRoute.safe_reasons?.length && !selectedRoute.danger_reasons?.length) && (
                  <Text style={styles.meta}>No explicit weather or traffic hazards detected along this route.</Text>
                )}

                {selectedRoute.routemaster_recommendations && selectedRoute.routemaster_recommendations.length > 0 && (
                  <View style={{ marginTop: 12, padding: 10, backgroundColor: "rgba(57,213,198,0.06)", borderRadius: 10, borderWidth: 1, borderColor: C.border }}>
                    <Text style={{ color: C.amber, fontSize: 11, fontWeight: "800", marginBottom: 4 }}>🛡️ RouteMaster AI Safety Guidelines:</Text>
                    {selectedRoute.routemaster_recommendations.map((rec, idx) => (
                      <Text key={`rec-${idx}`} style={{ color: C.text, fontSize: 10, marginTop: 4, lineHeight: 14 }}>
                        • {rec}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            )}
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
    borderWidth: 1,
    borderColor: C.red,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
    backgroundColor: "transparent",
  },
  dangerBtnText: { color: C.red, fontWeight: "800" },
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
  reasonText: { color: C.text, fontSize: 11, marginTop: 4, lineHeight: 15 },
  weatherCard: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 14,
  },
  weatherTitle: {
    color: C.text,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 10,
  },
  weatherRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  weatherItem: {
    alignItems: "center",
    flex: 1,
  },
  weatherVal: {
    color: C.text,
    fontSize: 14,
    fontWeight: "800",
  },
  weatherLabel: {
    color: C.sub,
    fontSize: 10,
    marginTop: 2,
  },
  navScreen: {
    flex: 1,
    backgroundColor: C.bg,
  },
  navMap: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  navOverlay: {
    position: "absolute",
    top: 50,
    left: 14,
    right: 14,
    backgroundColor: "rgba(22, 27, 34, 0.93)",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 14,
    maxHeight: 340,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  navOverlayTitle: {
    color: C.text,
    fontSize: 13,
    fontWeight: "800",
  },
  navOverlaySafety: {
    fontSize: 12,
    fontWeight: "700",
    marginVertical: 2,
  },
  navWeatherRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#0F141B",
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  navWeatherText: {
    color: C.text,
    fontSize: 10,
    fontWeight: "600",
  },
  navOverlayReasons: {
    maxHeight: 80,
    marginVertical: 4,
  },
  navReasonText: {
    color: C.text,
    fontSize: 10,
    marginTop: 2,
    lineHeight: 13,
  },
  exitBtn: {
    backgroundColor: C.red,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 4,
  },
  exitBtnText: {
    color: C.text,
    fontWeight: "800",
    fontSize: 12,
  },
  mapTypeRow: {
    flexDirection: "row",
    alignSelf: "flex-start",
    backgroundColor: C.surfaceHi,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
    marginBottom: 8,
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
    backgroundColor: "rgba(255, 176, 32, 0.15)",
  },
  mapTypeBtnText: {
    color: C.sub,
    fontSize: 11,
    fontWeight: "700",
  },
  mapTypeBtnTextActive: {
    color: C.amber,
  },
});
