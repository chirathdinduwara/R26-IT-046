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
    throw new Error(raw?.slice(0, 160) || "Server returned non-JSON response.");
  }
}

const MAP_TYPES = [
  { type: "standard", icon: "map-outline", label: "Map" },
  { type: "satellite", icon: "satellite-variant", label: "Satellite" },
  { type: "hybrid", icon: "layers-outline", label: "Hybrid" },
];

const weatherPresets = [
  { label: "☀️ Sunny", temp: "31", humidity: "60", rain: "0" },
  { label: "🌧️ Showers", temp: "28", humidity: "85", rain: "2" },
  { label: "⛈️ Storm", temp: "25", humidity: "95", rain: "12" },
];

const trafficPresets = [
  { label: "🟢 Light (1.0x)", val: "1.0" },
  { label: "🟡 Moderate (1.4x)", val: "1.4" },
  { label: "🔴 Heavy (2.2x)", val: "2.2" },
  { label: "⚠️ Gridlock (3.0x)", val: "3.0" },
];

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
  const [isNavigating, setIsNavigating] = useState(false);
  const [mapType, setMapType] = useState("hybrid");

  const [destinationQuery, setDestinationQuery] = useState("");
  const [destinationResults, setDestinationResults] = useState([]);
  const [destinationLoading, setDestinationLoading] = useState(false);
  const [selectedDestinationLabel, setSelectedDestinationLabel] = useState("");

  const currentLocation = useMemo(() => {
    const lat = Number(originLat);
    const lon = Number(originLon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
    return { lat, lon };
  }, [originLat, originLon]);

  const destination = useMemo(() => {
    const lat = Number(destLat);
    const lon = Number(destLon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
    return { lat, lon };
  }, [destLat, destLon]);

  useEffect(() => {
    // No async storage load needed
  }, []);

  useEffect(() => {
    const q = destinationQuery.trim();
    if (selectedDestinationLabel === q) {
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
  }, [destinationQuery, apiUrl, selectedDestinationLabel]);

  const searchDestinationSuggestions = async (query) => {
    setDestinationLoading(true);
    try {
      const res = await fetch(
        `${apiUrl}/safe-route/search-destination?q=${encodeURIComponent(query)}`,
      );
      const data = await parseJsonResponse(res);
      if (res.ok) {
        setDestinationResults(data?.results || []);
      }
    } catch (err) {
      console.warn("Search destination error:", err);
    } finally {
      setDestinationLoading(false);
    }
  };

  const selectDestination = (item) => {
    setDestLat(String(item.lat));
    setDestLon(String(item.lon));
    setSelectedDestinationLabel(item.label);
    setDestinationQuery(item.label);
    setDestinationResults([]);
  };

  const handleMapPress = (e) => {
    if (isNavigating) return;
    const { coordinate } = e.nativeEvent;
    if (coordinate) {
      setFloodPoints((prev) => [
        ...prev,
        {
          lat: Number(coordinate.latitude.toFixed(6)),
          lon: Number(coordinate.longitude.toFixed(6)),
        },
      ]);
    }
  };

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
              setOriginLat(String(loc.coords.latitude.toFixed(6)));
              setOriginLon(String(loc.coords.longitude.toFixed(6)));
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

          {result?.flooded_areas?.slice(0, 40).map((zone) => (
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

          {result?.rainfall_areas?.map((area) => (
            <React.Fragment key={`nav-rain-group-${area.id}`}>
              <Circle
                center={{
                  latitude: area.center.lat,
                  longitude: area.center.lon,
                }}
                radius={area.radius}
                fillColor="rgba(248,81,73,0.08)"
                strokeColor="rgba(248,81,73,0.3)"
              />
              <Marker
                coordinate={{
                  latitude: area.center.lat,
                  longitude: area.center.lon,
                }}
                title="Rainfall Zone"
                description={`Rain: ${area.intensity} mm/h`}
              >
                <View style={{ backgroundColor: "#F85149", padding: 6, borderRadius: 20, borderWidth: 1.5, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }}>
                  <MaterialCommunityIcons name="cloud-rain" size={16} color="#FFFFFF" />
                </View>
              </Marker>
            </React.Fragment>
          ))}

          {floodPoints.map((p, i) => (
            <React.Fragment key={`nav-manual-group-${i}`}>
              <Circle
                center={{ latitude: p.lat, longitude: p.lon }}
                radius={230}
                fillColor="rgba(248,81,73,0.25)"
                strokeColor="rgba(248,81,73,0.8)"
              />
              <Marker
                coordinate={{ latitude: p.lat, longitude: p.lon }}
                title={`Flood Zone ${i+1}`}
              >
                <View style={{ backgroundColor: "#F85149", padding: 5, borderRadius: 15, borderWidth: 1, borderColor: "#FFF" }}>
                  <MaterialCommunityIcons name="water-alert" size={14} color="#FFF" />
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
          <Text style={styles.navOverlayTitle}>🛡️ Navigation Assistant (Demo)</Text>
          
          <Text style={[styles.navOverlaySafety, { color: selectedRoute.type === "safe" ? C.green : C.red }]}>
<<<<<<< HEAD
            {selectedRoute.type === "safe" ? "🟢 Safe Route" : "🔴 Caution: Dangerous Route"} ({selectedRoute.risk_score != null ? Math.round((1 - selectedRoute.risk_score) * 100) : 100}% Safe)
=======
            {selectedRoute.type === "safe" ? "🟢 Safe Route" : "🔴 Caution: Dangerous Route"} ({Math.round((1 - selectedRoute.risk_score) * 100)}% Safe)
>>>>>>> 18dab5d510c938596f4c4c60ac85f0fb61e6b97e
          </Text>

          {/* Mini Weather metrics inside overlay */}
          {result?.weather && (
            <View style={styles.navWeatherRow}>
<<<<<<< HEAD
              <Text style={styles.navWeatherText}>🌡️ {safeToFixed(result.weather.temperature, 1, "--")}°C</Text>
              <Text style={styles.navWeatherText}>💧 {result.weather.humidity ?? "--"}%</Text>
              <Text style={styles.navWeatherText}>🌧️ {safeToFixed(result.weather.rainfall, 1, "0.0")}mm</Text>
              <Text style={styles.navWeatherText}>💨 {safeToFixed(result.weather.wind_speed, 1, "0.0")}km/h</Text>
=======
              <Text style={styles.navWeatherText}>🌡️ {result.weather.temperature.toFixed(1)}°C</Text>
              <Text style={styles.navWeatherText}>💧 {result.weather.humidity}%</Text>
              <Text style={styles.navWeatherText}>🌧️ {result.weather.rainfall.toFixed(1)}mm</Text>
              <Text style={styles.navWeatherText}>💨 {result.weather.wind_speed.toFixed(1)}km/h</Text>
>>>>>>> 18dab5d510c938596f4c4c60ac85f0fb61e6b97e
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

          <Text style={[styles.section, { marginTop: 12 }]}>Destination</Text>
          <TextInput
            style={styles.input}
            placeholder="Type destination name..."
            placeholderTextColor={C.sub}
            value={destinationQuery}
            onChangeText={(text) => {
              setDestinationQuery(text);
              setDestLat("");
              setDestLon("");
              setSelectedDestinationLabel("");
            }}
            autoCapitalize="words"
          />
          {destinationLoading && <Text style={styles.meta}>Searching...</Text>}
          {!!destLat && !!destLon && (
            <Text style={styles.meta}>Selected: {destinationQuery}</Text>
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
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>Demo Weather Preset</Text>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginVertical: 4 }}>
            {weatherPresets.map((p) => {
              const active = temp === p.temp && humidity === p.humidity && rainfall === p.rain;
              return (
                <TouchableOpacity
                  key={p.label}
                  style={[styles.presetChip, active && styles.presetChipActive]}
                  onPress={() => {
                    setTemp(p.temp);
                    setHumidity(p.humidity);
                    setRainfall(p.rain);
                  }}
                >
                  <Text style={[styles.presetChipText, active && styles.presetChipTextActive]}>{p.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.section, { marginTop: 8 }]}>Demo Traffic Congestion</Text>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginVertical: 4 }}>
            {trafficPresets.map((p) => {
              const active = trafficMultiplier === p.val;
              return (
                <TouchableOpacity
                  key={p.label}
                  style={[styles.presetChip, active && styles.presetChipActive]}
                  onPress={() => setTrafficMultiplier(p.val)}
                >
                  <Text style={[styles.presetChipText, active && styles.presetChipTextActive]}>{p.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.meta, { marginTop: 6 }]}>
            Active: {temp}°C | {humidity}% humidity | {rainfall} mm/h rain | {trafficMultiplier}x traffic
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>Flood Area Control</Text>
          <Text style={styles.meta}>💡 Tap anywhere on the map below to add flood zones dynamically.</Text>
          <View style={[styles.row, { marginTop: 4 }]}>
            <TouchableOpacity
              style={{ flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingVertical: 10, alignItems: "center" }}
              onPress={clearFloodPoints}
            >
              <Text style={styles.secondaryBtnText}>Clear All Flood Zones ({floodPoints.length})</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={findRoutes}
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
            onPress={handleMapPress}
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
              <React.Fragment key={`manual-group-${i}`}>
                <Circle
                  center={{ latitude: p.lat, longitude: p.lon }}
                  radius={230}
                  fillColor="rgba(248,81,73,0.25)"
                  strokeColor="rgba(248,81,73,0.8)"
                />
                <Marker
                  coordinate={{ latitude: p.lat, longitude: p.lon }}
                  title={`Flood Zone ${i+1}`}
                >
                  <View style={{ backgroundColor: "#F85149", padding: 5, borderRadius: 15, borderWidth: 1, borderColor: "#FFF" }}>
                    <MaterialCommunityIcons name="water-alert" size={14} color="#FFF" />
                  </View>
                </Marker>
              </React.Fragment>
            ))}

            {result?.flooded_areas?.slice(0, 40).map((zone) => (
              <Circle
                key={`pred-${zone.id}`}
                center={{
                  latitude: zone.centroid.lat,
                  longitude: zone.centroid.lon,
                }}
                radius={120}
                fillColor="rgba(248,81,73,0.22)"
                strokeColor="rgba(248,81,73,0.8)"
              />
            ))}

            {result?.rainfall_areas?.map((area) => (
              <React.Fragment key={`rain-group-${area.id}`}>
                <Circle
                  center={{
                    latitude: area.center.lat,
                    longitude: area.center.lon,
                  }}
                  radius={area.radius}
                  fillColor="rgba(248,81,73,0.08)"
                  strokeColor="rgba(248,81,73,0.3)"
                />
                <Marker
                  coordinate={{
                    latitude: area.center.lat,
                    longitude: area.center.lon,
                  }}
                  title="Rainfall Zone"
                  description={`Rain: ${area.intensity} mm/h`}
                >
                  <View style={{ backgroundColor: "#F85149", padding: 6, borderRadius: 20, borderWidth: 1.5, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }}>
                    <MaterialCommunityIcons name="cloud-rain" size={16} color="#FFFFFF" />
                  </View>
                </Marker>
              </React.Fragment>
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
              onPress={() => safeRoute && setIsNavigating(true)}
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
            {selectedRoute && (
              <View style={[styles.card, { marginTop: 12, borderLeftWidth: 4, borderLeftColor: selectedRoute.type === "safe" ? C.green : C.red }]}>
                <Text style={styles.section}>Route Safety Assessment</Text>
                {selectedRoute.type === "safe" ? (
                  <Text style={[styles.meta, { color: C.green, fontWeight: "bold" }]}>
                    Recommended Safe & Fast Route (Safety Rating: {Math.round((1 - selectedRoute.risk_score) * 100)}%)
                  </Text>
                ) : (
                  <Text style={[styles.meta, { color: C.red, fontWeight: "bold" }]}>
                    Use Caution: Dangerous Route Option (Safety Rating: {Math.round((1 - selectedRoute.risk_score) * 100)}%)
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
  presetChip: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: C.surfaceHi,
  },
  presetChipActive: {
    borderColor: C.amber,
    backgroundColor: "rgba(255, 176, 32, 0.12)",
  },
  presetChipText: {
    color: C.sub,
    fontSize: 11,
    fontWeight: "700",
  },
  presetChipTextActive: {
    color: C.amber,
  },
  resultItem: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 9,
    backgroundColor: "#0F141B",
    marginTop: 4,
  },
  resultText: { color: C.text, fontSize: 12 },
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
