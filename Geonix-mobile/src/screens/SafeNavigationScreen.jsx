import {
  ActivityIndicator,
  Alert,
<<<<<<< HEAD
  Linking,
=======
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
>>>>>>> 18dab5d510c938596f4c4c60ac85f0fb61e6b97e
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
<<<<<<< HEAD
import React, { useEffect, useMemo, useState } from "react";
=======
import React, { useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
>>>>>>> 18dab5d510c938596f4c4c60ac85f0fb61e6b97e
import * as Location from "expo-location";
import * as Speech from "expo-speech";
import MapView, { Circle, Marker, Polyline } from "react-native-maps";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SAFE_ROUTE_API_URL } from "../config/api";

const DEFAULT_SAFE_ROUTE_API_URL = SAFE_ROUTE_API_URL;
const STORAGE_KEY = "@flood_app_settings";
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

function safeToFixed(val, decimals = 1, fallback = "0.0") {
  const num = Number(val);
  return Number.isFinite(num) ? num.toFixed(decimals) : fallback;
}

const C = {
  bg: "#0D1117",
  surface: "#161B22",
  surfaceHi: "#21262D",
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
<<<<<<< HEAD
  { type: "standard", icon: "map-outline", label: "Map" },
  { type: "satellite", icon: "satellite-variant", label: "Satellite" },
  { type: "hybrid", icon: "layers-outline", label: "Hybrid" },
];

=======
  { type: "hybrid", icon: "layers-outline", label: "Hybrid" },
  { type: "standard", icon: "map-outline", label: "Standard" },
  { type: "satellite", icon: "satellite-variant", label: "Satellite" },
];

// Minimal & Professional Typewriter Effect for RouteMaster AI Recommendations
function TypewriterText({ text, speed = 20, style, cursorColor = C.amber }) {
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    let index = 0;
    setDisplayedText("");
    setIsTyping(true);
    if (!text) return;

    const timer = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(text.slice(0, index + 1));
        index++;
      } else {
        setIsTyping(false);
        clearInterval(timer);
      }
    }, speed);

    return () => clearInterval(timer);
  }, [text, speed]);

  return (
    <Text style={style}>
      {displayedText}
      {isTyping && <Text style={{ color: cursorColor, fontWeight: "700" }}>▌</Text>}
    </Text>
  );
}

>>>>>>> 18dab5d510c938596f4c4c60ac85f0fb61e6b97e
export default function SafeNavigationScreen() {
  const [apiUrl, setApiUrl] = useState(DEFAULT_SAFE_ROUTE_API_URL);
  
  // Location States
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);

  // Origin & Destination Search States
  const [useCustomOrigin, setUseCustomOrigin] = useState(false);
  const [originQuery, setOriginQuery] = useState("My Current Location");
  const [customOrigin, setCustomOrigin] = useState(null);

  const [destinationQuery, setDestinationQuery] = useState("");
  const [destination, setDestination] = useState(null);

  const [activeSearchField, setActiveSearchField] = useState(null); // "origin" | "destination" | null
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Routing & Map States
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [mapType, setMapType] = useState("hybrid");
<<<<<<< HEAD
=======
  const [rerouteAlert, setRerouteAlert] = useState(null);
  const [showRainOverlay, setShowRainOverlay] = useState(true);
  const [bottomCardExpanded, setBottomCardExpanded] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
>>>>>>> 18dab5d510c938596f4c4c60ac85f0fb61e6b97e

  const mapRef = useRef(null);
  const rerunTimerRef = useRef(null);

  const [safeRouteSettings, setSafeRouteSettings] = useState({
    safeRouteSpeak: true,
    safeRouteRerunMin: "10",
  });

  // Effective Origin Calculator
  const effectiveOrigin = useMemo(() => {
    if (useCustomOrigin && customOrigin) {
      return customOrigin;
    }
    if (currentLocation) {
      return {
        lat: currentLocation.lat,
        lon: currentLocation.lon,
        label: "Current Location",
      };
    }
    return null;
  }, [useCustomOrigin, customOrigin, currentLocation]);

  // Global Speech Controllers
  const stopSpeech = () => {
    try {
      Speech.stop();
    } catch (e) {}
    try {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    } catch (e) {}
  };

  const speakText = (text) => {
    if (!text || isMuted) return;
    try {
      stopSpeech();
      Speech.speak(text, {
        language: "en-US",
        pitch: 1.0,
        rate: 0.95,
        onError: (err) => console.warn("Expo Speech error:", err),
      });
    } catch (e) {
      try {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = 0.95;
          window.speechSynthesis.speak(utterance);
        }
      } catch (webErr) {
        console.warn("Speech synthesis error:", webErr);
      }
    }
  };

  const toggleMute = () => {
    if (!isMuted) {
      stopSpeech();
      setIsMuted(true);
    } else {
      setIsMuted(false);
      if (selectedRoute?.routemaster_recommendations?.length > 0) {
        const textToSpeak = selectedRoute.routemaster_recommendations.join(". ");
        speakText(`Voice unmuted. RouteMaster AI Advice: ${textToSpeak}`);
      } else {
        speakText("Voice unmuted.");
      }
    }
  };

  // Load settings from AsyncStorage
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          setSafeRouteSettings({
            safeRouteSpeak: parsed.safeRouteSpeak ?? true,
            safeRouteRerunMin: parsed.safeRouteRerunMin ?? "10",
          });
        }
      } catch (e) {
        console.warn("Error loading safe route settings:", e);
      }
    })();
  }, []);

<<<<<<< HEAD
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
=======
  // Multi-tier Fast Location Engine
  const detectCurrentLocation = async (showError = true, centerMap = true) => {
>>>>>>> 18dab5d510c938596f4c4c60ac85f0fb61e6b97e
    try {
      setLocationLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        if (showError) {
          Alert.alert("Permission Denied", "Location permission is required for safe navigation.");
        }
        return false;
      }

      try {
        const lastKnown = await Location.getLastKnownPositionAsync({});
        if (lastKnown?.coords) {
          const coords = {
            lat: Number(lastKnown.coords.latitude.toFixed(6)),
            lon: Number(lastKnown.coords.longitude.toFixed(6)),
          };
          setCurrentLocation(coords);
          if (!useCustomOrigin) {
            setOriginQuery("My Current Location");
          }
          if (centerMap && mapRef.current) {
            mapRef.current.animateToRegion({
              latitude: coords.lat,
              longitude: coords.lon,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }, 600);
          }
        }
      } catch (e) {}

      const posPromise = Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
<<<<<<< HEAD
      if (loc?.coords?.latitude != null && loc?.coords?.longitude != null) {
        setCurrentLocation({
          lat: Number(loc.coords.latitude.toFixed(6)),
          lon: Number(loc.coords.longitude.toFixed(6)),
        });
      }
      return true;
    } catch {
=======
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 4500),
      );

      const loc = await Promise.race([posPromise, timeoutPromise]).catch(async () => {
        return await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      });

      if (loc?.coords) {
        const coords = {
          lat: Number(loc.coords.latitude.toFixed(6)),
          lon: Number(loc.coords.longitude.toFixed(6)),
        };
        setCurrentLocation(coords);
        if (!useCustomOrigin) {
          setOriginQuery("My Current Location");
        }
        if (centerMap && mapRef.current) {
          mapRef.current.animateToRegion({
            latitude: coords.lat,
            longitude: coords.lon,
            latitudeDelta: 0.04,
            longitudeDelta: 0.04,
          }, 800);
        }
        return true;
      }
      return false;
    } catch (err) {
>>>>>>> 18dab5d510c938596f4c4c60ac85f0fb61e6b97e
      if (showError) {
        Alert.alert("Location Error", "Could not fetch current location. Please check GPS settings.");
      }
      return false;
    } finally {
      setLocationLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await detectCurrentLocation(false, false);
    })();
  }, []);

  // Origin & Destination Autocomplete Debounce Engine
  useEffect(() => {
    if (!activeSearchField) {
      setSearchResults([]);
      return;
    }

    const query = activeSearchField === "origin" ? originQuery.trim() : destinationQuery.trim();

    if (activeSearchField === "origin" && !useCustomOrigin && query === "My Current Location") {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    if (query.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    const timer = setTimeout(() => {
      performLocationSearch(query, activeSearchField);
    }, 350);

    return () => clearTimeout(timer);
  }, [originQuery, destinationQuery, activeSearchField, useCustomOrigin, apiUrl]);

  const performLocationSearch = async (query, field) => {
    try {
      setSearchLoading(true);
      const res = await fetch(
        `${apiUrl}/safe-route/search-destination?q=${encodeURIComponent(query)}&limit=6`,
      );
      const data = await parseJsonResponse(res);
      if (!res.ok) throw new Error(data?.detail || "Location search failed.");
      
      const currentQ = field === "origin" ? originQuery.trim() : destinationQuery.trim();
      if (query === currentQ && activeSearchField === field) {
        setSearchResults(Array.isArray(data?.results) ? data.results : []);
      }
    } catch (err) {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const selectLocationSuggestion = (item) => {
    Keyboard.dismiss();
    if (activeSearchField === "origin") {
      setCustomOrigin(item);
      setOriginQuery(item.label);
      setUseCustomOrigin(true);
    } else if (activeSearchField === "destination") {
      setDestination(item);
      setDestinationQuery(item.label);
    }
    setSearchResults([]);
    setActiveSearchField(null);
  };

  const resetToGpsOrigin = () => {
    Keyboard.dismiss();
    setUseCustomOrigin(false);
    setCustomOrigin(null);
    setOriginQuery("My Current Location");
    detectCurrentLocation(true, true);
  };

  const swapOriginAndDestination = () => {
    Keyboard.dismiss();
    const prevOriginQuery = originQuery;
    const prevDestinationQuery = destinationQuery;
    const prevEffectiveOrigin = effectiveOrigin;
    const prevDestination = destination;

    if (prevDestination) {
      setCustomOrigin(prevDestination);
      setOriginQuery(prevDestinationQuery || prevDestination.label);
      setUseCustomOrigin(true);
    } else {
      setCustomOrigin(null);
      setOriginQuery("My Current Location");
      setUseCustomOrigin(false);
    }

    if (prevEffectiveOrigin) {
      setDestination(prevEffectiveOrigin);
      setDestinationQuery(prevEffectiveOrigin.label || prevOriginQuery);
    } else {
      setDestination(null);
      setDestinationQuery("");
    }
    setSearchResults([]);
  };

  // Periodic Model Re-run Engine during Active Navigation
  useEffect(() => {
    if (isNavigating && effectiveOrigin && destination) {
      const rerunMinutes = parseInt(safeRouteSettings.safeRouteRerunMin, 10) || 10;
      const intervalMs = rerunMinutes * 60 * 1000;

      if (safeRouteSettings.safeRouteSpeak && !isMuted && selectedRoute) {
        const speechMsg = `Starting navigation. ${selectedRoute.routemaster_recommendations?.[0] || 'Drive safely.'}`;
        speakText(speechMsg);
      }

      rerunTimerRef.current = setInterval(async () => {
        try {
          const res = await fetch(`${apiUrl}/safe-route/routes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              origin: { lat: effectiveOrigin.lat, lon: effectiveOrigin.lon },
              destination: { lat: destination.lat, lon: destination.lon },
              alternatives: true,
            }),
          });
          const data = await parseJsonResponse(res);
          if (res.ok && data?.safe_route) {
            setResult(data);
            setSelectedRouteId(data.recommended_route_id);
            const alertMsg = `MODEL RE-EVALUATED (${rerunMinutes}m interval): Safe route updated with live weather & flood predictions.`;
            setRerouteAlert(alertMsg);

            if (safeRouteSettings.safeRouteSpeak && !isMuted) {
              const advice = data.safe_route.routemaster_recommendations?.[0] || "Route updated for optimal safety.";
              speakText(`Attention driver. ${advice}`);
            }
          }
        } catch (err) {
          console.warn("Model rerun error:", err);
        }
      }, intervalMs);
    } else {
      if (rerunTimerRef.current) {
        clearInterval(rerunTimerRef.current);
        rerunTimerRef.current = null;
      }
    }

    return () => {
      if (rerunTimerRef.current) {
        clearInterval(rerunTimerRef.current);
        rerunTimerRef.current = null;
      }
    };
  }, [isNavigating, effectiveOrigin, destination, safeRouteSettings, isMuted]);

  // Active Navigation Location Watcher
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
              const newLoc = {
                lat: Number(loc.coords.latitude.toFixed(6)),
                lon: Number(loc.coords.longitude.toFixed(6)),
              };
              setCurrentLocation(newLoc);
            },
          );
        } catch (e) {
          console.warn("Location watch error:", e);
        }
      })();
    }
    return () => {
      if (subscription) subscription.remove();
    };
  }, [isNavigating]);

  const fetchRoutes = async () => {
    Keyboard.dismiss();
    if (!effectiveOrigin?.lat || !effectiveOrigin?.lon) {
      const ok = await detectCurrentLocation(true, false);
      if (!ok) {
        Alert.alert("Origin Required", "Please acquire GPS location or select a custom origin location.");
        return;
      }
    }
    if (!destination?.lat || !destination?.lon) {
      Alert.alert("Destination Required", "Please type and select a destination from suggestions.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/safe-route/routes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: { lat: effectiveOrigin.lat, lon: effectiveOrigin.lon },
          destination: { lat: destination.lat, lon: destination.lon },
          alternatives: true,
        }),
      });
      const data = await parseJsonResponse(res);
      if (!res.ok) throw new Error(data?.detail || "Failed to fetch routes");
      setResult(data);
      setSelectedRouteId(data?.recommended_route_id ?? null);
      setBottomCardExpanded(true);

      if (data?.safe_route?.coordinates?.length && mapRef.current) {
        mapRef.current.fitToCoordinates(
          data.safe_route.coordinates.map((c) => ({ latitude: c.lat, longitude: c.lon })),
          { edgePadding: { top: 160, right: 60, bottom: 280, left: 60 }, animated: true },
        );
      }
    } catch (err) {
      Alert.alert("Safe Route Error", String(err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoSafe = () => {
    if (!safeRoute) return;
<<<<<<< HEAD
    setIsNavigating(true);
=======
    Keyboard.dismiss();
    setIsNavigating(true);
    setRerouteAlert(null);
  };

  const handleSpeakTest = () => {
    if (isMuted) setIsMuted(false);
    if (selectedRoute?.routemaster_recommendations?.length > 0) {
      const textToSpeak = selectedRoute.routemaster_recommendations.join(". ");
      speakText(`RouteMaster AI Advice: ${textToSpeak}`);
    } else {
      speakText("RouteMaster AI: Route is clear of active hazards.");
    }
  };

  const cycleMapType = () => {
    const idx = MAP_TYPES.findIndex((t) => t.type === mapType);
    const nextIdx = (idx + 1) % MAP_TYPES.length;
    setMapType(MAP_TYPES[nextIdx].type);
>>>>>>> 18dab5d510c938596f4c4c60ac85f0fb61e6b97e
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
<<<<<<< HEAD
    if (isNavigating && currentLocation) {
      return {
        latitude: currentLocation.lat,
        longitude: currentLocation.lon,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      };
    }

=======
    if (isNavigating && currentLocation?.lat) {
      return {
        latitude: currentLocation.lat,
        longitude: currentLocation.lon,
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
      };
    }
>>>>>>> 18dab5d510c938596f4c4c60ac85f0fb61e6b97e
    if (selectedRoute?.coordinates?.length) {
      const first = selectedRoute.coordinates[0];
      return {
        latitude: first.lat,
        longitude: first.lon,
        latitudeDelta: 0.16,
        longitudeDelta: 0.16,
      };
    }
    if (effectiveOrigin?.lat) {
      return {
        latitude: effectiveOrigin.lat,
        longitude: effectiveOrigin.lon,
        latitudeDelta: 0.06,
        longitudeDelta: 0.06,
      };
    }
    return {
      latitude: 6.9271,
      longitude: 79.8612,
      latitudeDelta: 0.20,
      longitudeDelta: 0.20,
    };
<<<<<<< HEAD
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
=======
  }, [selectedRoute, currentLocation, effectiveOrigin, isNavigating]);
>>>>>>> 18dab5d510c938596f4c4c60ac85f0fb61e6b97e

  // In-Drive Navigation Full-Screen View
  if (isNavigating && selectedRoute) {
    return (
      <View style={styles.fullScreenContainer}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          initialRegion={mapRegion}
          region={mapRegion}
          showsUserLocation={true}
          followsUserLocation={true}
          showsCompass={true}
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

          {/* Flooded Zones Overlay */}
          {result?.flooded_areas?.slice(0, 40).map((zone) => (
            <Circle
              key={`nav-zone-${zone.id}`}
              center={{ latitude: zone.centroid.lat, longitude: zone.centroid.lon }}
              radius={140}
              fillColor="rgba(248,81,73,0.3)"
              strokeColor="rgba(248,81,73,0.85)"
            />
          ))}

<<<<<<< HEAD
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
=======
          {/* Rain Overlay */}
          {showRainOverlay && result?.rainfall_areas?.map((area) => (
            <React.Fragment key={`nav-rain-${area.id}`}>
              <Circle
                center={{ latitude: area.center.lat, longitude: area.center.lon }}
                radius={area.radius}
                fillColor="rgba(88,166,255,0.15)"
                strokeColor="rgba(88,166,255,0.5)"
              />
              <Marker
                coordinate={{ latitude: area.center.lat, longitude: area.center.lon }}
                title="Rainfall Zone"
                description={`Precipitation: ${area.intensity} mm/h`}
              >
                <View style={styles.rainMarkerBadge}>
                  <MaterialCommunityIcons name="weather-pouring" size={14} color="#FFF" />
                </View>
              </Marker>
            </React.Fragment>
          ))}

          {!!destination && (
            <Marker
              coordinate={{ latitude: destination.lat, longitude: destination.lon }}
              title="Destination"
            />
          )}
        </MapView>

        {/* Navigation Banner Alert */}
        {rerouteAlert && (
          <View style={styles.rerouteBanner}>
            <MaterialCommunityIcons name="sync" size={18} color={C.amber} />
            <Text style={styles.rerouteBannerText}>{rerouteAlert}</Text>
          </View>
        )}

        {/* Navigation Dashboard Dock Overlay */}
        <View style={styles.navOverlayDock}>
          <View style={styles.dockHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.dockTitle}>🛡️ Geonix Safe Navigation</Text>
              <Text style={[styles.dockSafetyBadge, { color: selectedRoute.type === "safe" ? C.green : C.red }]}>
                {selectedRoute.type === "safe" ? "🟢 Safest Route Active" : "🔴 High Risk Route"} ({Math.round((1 - selectedRoute.risk_score) * 100)}% Safety Rating)
>>>>>>> 18dab5d510c938596f4c4c60ac85f0fb61e6b97e
              </Text>
            </View>

            {/* Mute Button + Voice Test Button */}
            <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
              <TouchableOpacity
                style={[styles.smallMuteBtn, isMuted && styles.smallMuteBtnActive]}
                onPress={toggleMute}
              >
                <MaterialCommunityIcons
                  name={isMuted ? "volume-off" : "volume-high"}
                  size={16}
                  color={isMuted ? C.red : C.amber}
                />
              </TouchableOpacity>

              <TouchableOpacity style={styles.voiceBtn} onPress={handleSpeakTest}>
                <MaterialCommunityIcons name="bullhorn-outline" size={15} color={C.amber} />
                <Text style={styles.voiceBtnText}>Voice Test</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Risk Ahead Alert Box */}
          {selectedRoute.risk_ahead_alerts && selectedRoute.risk_ahead_alerts.length > 0 && (
            <View style={styles.riskAheadCard}>
              <Text style={styles.riskAheadHeader}>🚨 RISK AHEAD ASSISTANT:</Text>
              {selectedRoute.risk_ahead_alerts.map((alertItem, idx) => (
                <Text key={`nav-alert-${idx}`} style={styles.riskAheadText}>
                  • {alertItem.message}
                </Text>
              ))}
            </View>
          )}

          {/* Weather Telemetry Row */}
          {result?.weather && (
            <View style={styles.telemetryRow}>
              <View style={styles.telemetryItem}>
                <Text style={styles.telemetryVal}>{result.weather.temperature.toFixed(1)}°C</Text>
                <Text style={styles.telemetrySub}>Temp</Text>
              </View>
              <View style={styles.telemetryItem}>
                <Text style={styles.telemetryVal}>{result.weather.humidity}%</Text>
                <Text style={styles.telemetrySub}>Humidity</Text>
              </View>
              <View style={styles.telemetryItem}>
                <Text style={styles.telemetryVal}>{result.weather.rainfall.toFixed(1)} mm</Text>
                <Text style={styles.telemetrySub}>Rain</Text>
              </View>
              <View style={styles.telemetryItem}>
                <Text style={styles.telemetryVal}>{result.weather.wind_speed.toFixed(1)} km/h</Text>
                <Text style={styles.telemetrySub}>Wind</Text>
              </View>
            </View>
          )}

          {/* RouteMaster AI Advice */}
          {selectedRoute.routemaster_recommendations && selectedRoute.routemaster_recommendations.length > 0 && (
            <View style={styles.aiAdviceBox}>
              <Text style={styles.aiAdviceHeader}>🤖 RouteMaster AI Safety Advice:</Text>
              <ScrollView style={{ maxHeight: 75 }} nestedScrollEnabled={true} keyboardShouldPersistTaps="handled">
                {selectedRoute.routemaster_recommendations.map((rec, idx) => (
                  <View key={`nav-rec-${idx}`} style={{ flexDirection: "row", marginTop: 3 }}>
                    <Text style={{ color: C.amber, fontSize: 10, marginRight: 4, marginTop: 1 }}>•</Text>
                    <TypewriterText text={rec} speed={18} style={styles.aiAdviceText} cursorColor={C.amber} />
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          <TouchableOpacity style={styles.exitNavBtn} onPress={() => { stopSpeech(); setIsNavigating(false); }}>
            <Text style={styles.exitNavText}>EXIT NAVIGATION</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

<<<<<<< HEAD
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
=======
  // Modern Unique Map UI View (Non-Navigation Mode) with KeyboardAvoidingView
  return (
    <KeyboardAvoidingView
      style={styles.fullScreenContainer}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={StyleSheet.absoluteFillObject}>
          {/* Immersive Full Screen Background Map */}
>>>>>>> 18dab5d510c938596f4c4c60ac85f0fb61e6b97e
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFillObject}
            initialRegion={mapRegion}
            region={mapRegion}
            mapType={mapType}
<<<<<<< HEAD
=======
            showsUserLocation={true}
            showsCompass={true}
            showsBuildings={true}
            onPress={() => {
              Keyboard.dismiss();
              setActiveSearchField(null);
            }}
>>>>>>> 18dab5d510c938596f4c4c60ac85f0fb61e6b97e
          >
            {safeRoute?.coordinates?.length > 1 && (
              <Polyline
                coordinates={safeRoute.coordinates.map((p) => ({ latitude: p.lat, longitude: p.lon }))}
                strokeColor={selectedRoute?.id === safeRoute.id ? C.green : "#2B7A3F"}
                strokeWidth={selectedRoute?.id === safeRoute.id ? 6 : 4}
              />
            )}

            {dangerousRoute?.coordinates?.length > 1 && (
              <Polyline
                coordinates={dangerousRoute.coordinates.map((p) => ({ latitude: p.lat, longitude: p.lon }))}
                strokeColor={selectedRoute?.id === dangerousRoute.id ? C.red : "#A33733"}
                strokeWidth={selectedRoute?.id === dangerousRoute.id ? 6 : 4}
              />
            )}

            {result?.flooded_areas?.slice(0, 40).map((zone) => zone?.centroid?.lat != null && zone?.centroid?.lon != null && (
              <Circle
                key={zone.id}
                center={{ latitude: zone.centroid.lat, longitude: zone.centroid.lon }}
                radius={140}
                fillColor="rgba(248,81,73,0.25)"
                strokeColor="rgba(248,81,73,0.7)"
              />
            ))}

<<<<<<< HEAD
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
=======
            {showRainOverlay && result?.rainfall_areas?.map((area) => (
              <React.Fragment key={`rain-group-${area.id}`}>
                <Circle
                  center={{ latitude: area.center.lat, longitude: area.center.lon }}
                  radius={area.radius}
                  fillColor="rgba(88,166,255,0.15)"
                  strokeColor="rgba(88,166,255,0.5)"
                />
                <Marker
                  coordinate={{ latitude: area.center.lat, longitude: area.center.lon }}
                  title="Active Rain Zone"
                  description={`Rainfall: ${area.intensity} mm/h`}
                >
                  <View style={styles.rainMarkerBadge}>
                    <MaterialCommunityIcons name="weather-pouring" size={14} color="#FFFFFF" />
>>>>>>> 18dab5d510c938596f4c4c60ac85f0fb61e6b97e
                  </View>
                </Marker>
              </React.Fragment>
            ))}

<<<<<<< HEAD
            {!!currentLocation && (
=======
            {!!effectiveOrigin && (
>>>>>>> 18dab5d510c938596f4c4c60ac85f0fb61e6b97e
              <Marker
                coordinate={{ latitude: effectiveOrigin.lat, longitude: effectiveOrigin.lon }}
                title={effectiveOrigin.label || "Start Location"}
                pinColor="green"
              />
            )}

            {!!destination && (
              <Marker
                coordinate={{ latitude: destination.lat, longitude: destination.lon }}
                title={destination.label || "Destination"}
                pinColor="red"
              />
            )}
          </MapView>
        </View>
      </TouchableWithoutFeedback>

<<<<<<< HEAD
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
=======
      {/* Floating Top Search Header Card */}
      <View style={styles.topFloatingHeader}>
        {/* Brand Bar */}
        <View style={styles.titlePillRow}>
          <View style={styles.brandIconWrap}>
            <MaterialCommunityIcons name="shield-check" size={18} color={C.amber} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.brandTitle}>Geonix Safe Route</Text>
            <Text style={styles.brandSub}>
              {effectiveOrigin
                ? `Start: ${effectiveOrigin.label}`
                : "Acquiring GPS location..."}
            </Text>
          </View>

          {/* Top Mute / Unmute Button */}
          <TouchableOpacity
            style={[styles.topMuteBtn, isMuted && styles.topMuteBtnActive]}
            onPress={toggleMute}
          >
            <MaterialCommunityIcons
              name={isMuted ? "volume-off" : "volume-high"}
              size={16}
              color={isMuted ? C.red : C.amber}
            />
          </TouchableOpacity>
        </View>

        {/* Dual Location Inputs Container */}
        <View style={styles.dualSearchCard}>
          {/* Origin Input Row */}
          <View style={styles.inputRow}>
            <MaterialCommunityIcons name="map-marker" size={18} color={C.green} style={{ marginLeft: 10 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Origin: Type start location..."
              placeholderTextColor={C.sub}
              value={originQuery}
              onFocus={() => setActiveSearchField("origin")}
              onChangeText={(text) => {
                setOriginQuery(text);
                setUseCustomOrigin(true);
                setCustomOrigin(null);
                setActiveSearchField("origin");
              }}
              autoCapitalize="words"
            />
            {useCustomOrigin ? (
              <TouchableOpacity style={styles.gpsResetBtn} onPress={resetToGpsOrigin} title="Use GPS">
                <MaterialCommunityIcons name="crosshairs-gps" size={16} color={C.amber} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.gpsResetBtn}
                onPress={() => detectCurrentLocation(true, true)}
                disabled={locationLoading}
              >
                {locationLoading ? (
                  <ActivityIndicator size="small" color={C.amber} />
                ) : (
                  <MaterialCommunityIcons name="crosshairs-gps" size={16} color={C.green} />
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Swap & Divider Controls */}
          <View style={styles.swapDividerRow}>
            <View style={styles.dividerLine} />
            <TouchableOpacity style={styles.swapBtn} onPress={swapOriginAndDestination}>
              <MaterialCommunityIcons name="swap-vertical" size={18} color={C.amber} />
            </TouchableOpacity>
            <View style={styles.dividerLine} />
          </View>

          {/* Destination Input Row */}
          <View style={styles.inputRow}>
            <MaterialCommunityIcons name="flag-checkered" size={18} color={C.red} style={{ marginLeft: 10 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Destination: Type end location..."
              placeholderTextColor={C.sub}
              value={destinationQuery}
              onFocus={() => setActiveSearchField("destination")}
              onChangeText={(text) => {
                setDestinationQuery(text);
                setDestination(null);
                setActiveSearchField("destination");
              }}
              autoCapitalize="words"
            />
            {destinationQuery.length > 0 && (
              <TouchableOpacity
                style={styles.clearTextBtn}
                onPress={() => {
                  setDestinationQuery("");
                  setDestination(null);
                }}
              >
                <MaterialCommunityIcons name="close-circle" size={16} color={C.sub} />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.findRouteBtn} onPress={fetchRoutes} disabled={loading}>
              {loading ? (
                <ActivityIndicator size="small" color={C.bg} />
              ) : (
                <Text style={styles.findRouteBtnText}>GO</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Autocomplete Suggestions Dropdown */}
        {searchResults.length > 0 && activeSearchField && (
          <View style={styles.suggestionDropdown}>
            <View style={styles.suggestionHeaderPill}>
              <Text style={styles.suggestionHeaderText}>
                Select {activeSearchField === "origin" ? "Origin" : "Destination"}:
              </Text>
            </View>
            <ScrollView
              style={{ maxHeight: 180 }}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled={true}
            >
              {searchResults.map((item, idx) => (
                <TouchableOpacity
                  key={`search-item-${item.id || idx}`}
                  style={styles.suggestionItem}
                  onPress={() => selectLocationSuggestion(item)}
                >
                  <MaterialCommunityIcons
                    name={activeSearchField === "origin" ? "map-marker" : "flag-checkered"}
                    size={14}
                    color={activeSearchField === "origin" ? C.green : C.red}
                  />
                  <Text numberOfLines={1} style={styles.suggestionText}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      {/* Floating Side Action Buttons (FABs) */}
      <View style={styles.rightFabStack}>
        <TouchableOpacity style={styles.fabBtn} onPress={resetToGpsOrigin}>
          <MaterialCommunityIcons name="target" size={18} color={C.amber} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.fabBtn} onPress={cycleMapType}>
          <MaterialCommunityIcons
            name={MAP_TYPES.find((t) => t.type === mapType)?.icon || "layers-outline"}
            size={18}
            color={C.amber}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.fabBtn, showRainOverlay && styles.fabBtnActive]}
          onPress={() => setShowRainOverlay(!showRainOverlay)}
        >
          <MaterialCommunityIcons
            name="weather-pouring"
            size={18}
            color={showRainOverlay ? C.amber : C.sub}
          />
        </TouchableOpacity>
      </View>

      {/* Floating Bottom Sheet Assessment Panel */}
      <View style={[styles.bottomSheetCard, !bottomCardExpanded && styles.bottomSheetCardCollapsed]}>
        <TouchableOpacity
          style={styles.sheetHandleWrap}
          onPress={() => setBottomCardExpanded(!bottomCardExpanded)}
          activeOpacity={0.8}
        >
          <View style={styles.sheetHandleBar} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", width: "100%", alignItems: "center", marginTop: 4 }}>
            <Text style={styles.sheetHeaderTitle}>
              {result ? "Route Safety Assessment" : "Safe Navigation Control"}
            </Text>
            <MaterialCommunityIcons
              name={bottomCardExpanded ? "chevron-down" : "chevron-up"}
              size={20}
              color={C.sub}
            />
          </View>
        </TouchableOpacity>

        {bottomCardExpanded && (
          <ScrollView
            style={styles.sheetScroll}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
          >
            {/* Real-time Environmental Metrics */}
            {result?.weather && (
              <View style={styles.weatherMetricsRow}>
                <View style={styles.metricPill}>
                  <Text style={styles.metricVal}>{result.weather.temperature.toFixed(1)}°C</Text>
                  <Text style={styles.metricSub}>Temp</Text>
                </View>
                <View style={styles.metricPill}>
                  <Text style={styles.metricVal}>{result.weather.humidity}%</Text>
                  <Text style={styles.metricSub}>Humidity</Text>
                </View>
                <View style={styles.metricPill}>
                  <Text style={styles.metricVal}>{result.weather.rainfall.toFixed(1)} mm</Text>
                  <Text style={styles.metricSub}>Rain</Text>
                </View>
                <View style={styles.metricPill}>
                  <Text style={styles.metricVal}>{result.weather.wind_speed.toFixed(1)} km/h</Text>
                  <Text style={styles.metricSub}>Wind</Text>
                </View>
              </View>
            )}

            {/* Main Action Button */}
            {result?.safe_route ? (
              <TouchableOpacity style={styles.startNavCta} onPress={handleGoSafe}>
                <MaterialCommunityIcons name="navigation" size={18} color={C.bg} />
                <Text style={styles.startNavCtaText}>START SAFE NAVIGATION</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.primaryFindBtn} onPress={fetchRoutes} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color={C.bg} />
                ) : (
                  <Text style={styles.primaryFindBtnText}>FIND SAFEST ROUTE</Text>
                )}
              </TouchableOpacity>
            )}

            {/* Route Cards */}
            {result?.routes?.filter((r) => r.type === "safe" || r.type === "dangerous").map((route) => (
>>>>>>> 18dab5d510c938596f4c4c60ac85f0fb61e6b97e
              <TouchableOpacity
                key={route.id}
                style={[
                  styles.routeSelectCard,
                  selectedRouteId === route.id && styles.routeSelectCardActive,
                ]}
                onPress={() => setSelectedRouteId(route.id)}
              >
                <Text style={styles.routeCardBadge}>
                  {route.type === "safe" ? "🟢 RECOMMENDED SAFEST ROUTE" : "🔴 DANGEROUS ROUTE"}
                </Text>
                <Text style={styles.routeCardMeta}>
                  {route.distance_km} km · {route.duration_in_traffic_min} min ETA · Safety Rating: {Math.round((1 - route.risk_score) * 100)}%
                </Text>
                <Text style={styles.routeCardSub}>
                  Traffic roads: {route.traffic_road_count} · Flooded segments: {route.flooded_road_count}
                </Text>
              </TouchableOpacity>
            ))}
<<<<<<< HEAD
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
=======

            {/* Explainable Routing Details */}
            {selectedRoute && (
              <View style={styles.explainableCard}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={styles.explainableTitle}>Why this route?</Text>

                  {/* Mute Button + Voice Test Button */}
                  <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                    <TouchableOpacity
                      style={[styles.smallMuteBtn, isMuted && styles.smallMuteBtnActive]}
                      onPress={toggleMute}
                    >
                      <MaterialCommunityIcons
                        name={isMuted ? "volume-off" : "volume-high"}
                        size={15}
                        color={isMuted ? C.red : C.amber}
                      />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.voiceBtn} onPress={handleSpeakTest}>
                      <MaterialCommunityIcons name="bullhorn-outline" size={14} color={C.amber} />
                      <Text style={styles.voiceBtnText}>Voice Test</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {selectedRoute.why_this_route?.map((item, idx) => (
                  <Text key={`why-${idx}`} style={styles.explainableItem}>
                    {item}
                  </Text>
                ))}

                {selectedRoute.why_not_fastest_route && selectedRoute.type === "safe" && (
                  <View style={styles.whyNotFastestBox}>
                    <Text style={styles.whyNotFastestTitle}>Why not the fastest route?</Text>
                    <Text style={styles.whyNotFastestText}>{selectedRoute.why_not_fastest_route}</Text>
                  </View>
                )}

                {/* RouteMaster AI Box */}
                {selectedRoute.routemaster_recommendations?.length > 0 && (
                  <View style={styles.aiAdviceBox}>
                    <Text style={styles.aiAdviceHeader}>🤖 RouteMaster AI Safety Advice:</Text>
                    {selectedRoute.routemaster_recommendations.map((rec, idx) => (
                      <View key={`sheet-rec-${idx}`} style={{ flexDirection: "row", marginTop: 3 }}>
                        <Text style={{ color: C.amber, fontSize: 10, marginRight: 4, marginTop: 1 }}>•</Text>
                        <TypewriterText text={rec} speed={18} style={styles.aiAdviceText} cursorColor={C.amber} />
                      </View>
>>>>>>> 18dab5d510c938596f4c4c60ac85f0fb61e6b97e
                    ))}
                  </View>
                )}
              </View>
            )}
<<<<<<< HEAD
          </View>
=======
          </ScrollView>
>>>>>>> 18dab5d510c938596f4c4c60ac85f0fb61e6b97e
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    backgroundColor: C.bg,
  },

  // Floating Top Header
  topFloatingHeader: {
    position: "absolute",
    top: Platform.OS === "ios" ? 54 : 16,
    left: 14,
    right: 14,
    zIndex: 20,
    gap: 8,
  },
  titlePillRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(22, 27, 34, 0.94)",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 10,
  },
  brandIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(255, 176, 32, 0.15)",
    borderWidth: 1,
    borderColor: C.amber,
    alignItems: "center",
    justifyContent: "center",
  },
  brandTitle: { color: C.text, fontSize: 14, fontWeight: "800" },
  brandSub: { color: C.sub, fontSize: 10 },
  topMuteBtn: {
    padding: 6,
    backgroundColor: "rgba(255, 176, 32, 0.12)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.amber,
  },
  topMuteBtnActive: {
    backgroundColor: "rgba(248, 81, 73, 0.15)",
    borderColor: C.red,
  },

  // Dual Location Search Card
  dualSearchCard: {
    backgroundColor: "rgba(22, 27, 34, 0.96)",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    padding: 8,
    gap: 6,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    color: C.text,
    fontSize: 12,
    paddingHorizontal: 10,
  },
  gpsResetBtn: {
    padding: 8,
    marginRight: 4,
  },
  clearTextBtn: {
    padding: 6,
    marginRight: 4,
  },
  findRouteBtn: {
    backgroundColor: C.amber,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 4,
  },
  findRouteBtnText: { color: C.bg, fontWeight: "800", fontSize: 12 },

  swapDividerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    height: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.border,
  },
  swapBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.surfaceHi,
    borderWidth: 1,
    borderColor: C.amber,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 8,
  },

  suggestionDropdown: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 2,
    maxHeight: 220,
  },
  suggestionHeaderPill: {
    backgroundColor: C.surfaceHi,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  suggestionHeaderText: { color: C.amber, fontSize: 10, fontWeight: "700" },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  suggestionText: { color: C.text, fontSize: 12, flex: 1 },

  // Right Side Floating Action Buttons (FABs)
  rightFabStack: {
    position: "absolute",
    right: 14,
    top: Platform.OS === "ios" ? 230 : 190,
    gap: 10,
    zIndex: 20,
  },
  fabBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(22, 27, 34, 0.92)",
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  fabBtnActive: {
    borderColor: C.amber,
    backgroundColor: "rgba(255, 176, 32, 0.15)",
  },

  // Floating Bottom Sheet Panel
  bottomSheetCard: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(22, 27, 34, 0.96)",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: C.border,
    maxHeight: SCREEN_HEIGHT * 0.52,
    paddingHorizontal: 14,
    paddingBottom: Platform.OS === "ios" ? 30 : 16,
    zIndex: 30,
  },
  bottomSheetCardCollapsed: {
    maxHeight: 65,
  },
  sheetHandleWrap: {
    alignItems: "center",
    paddingVertical: 8,
  },
  sheetHandleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.border,
  },
  sheetHeaderTitle: { color: C.text, fontSize: 13, fontWeight: "800" },
  sheetScroll: { marginTop: 4 },

  weatherMetricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  metricPill: {
    flex: 1,
    backgroundColor: "#0F141B",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 6,
    marginHorizontal: 2,
  },
  metricVal: { color: C.text, fontSize: 12, fontWeight: "700" },
  metricSub: { color: C.sub, fontSize: 9, marginTop: 1 },

  startNavCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: C.green,
    borderRadius: 12,
    paddingVertical: 13,
    marginBottom: 10,
  },
  startNavCtaText: { color: C.bg, fontWeight: "800", fontSize: 13 },

  primaryFindBtn: {
    backgroundColor: C.amber,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 10,
  },
  primaryFindBtnText: { color: C.bg, fontWeight: "800", fontSize: 12 },

  routeSelectCard: {
    backgroundColor: "#0F141B",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  routeSelectCardActive: {
    borderColor: C.amber,
    backgroundColor: "#18202B",
  },
  routeCardBadge: { color: C.text, fontSize: 11, fontWeight: "800" },
  routeCardMeta: { color: C.sub, fontSize: 10, marginTop: 2 },
  routeCardSub: { color: C.sub, fontSize: 9, marginTop: 1 },

  explainableCard: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 10,
    marginTop: 4,
    gap: 4,
  },
  explainableTitle: { color: C.amber, fontSize: 12, fontWeight: "700" },
  explainableItem: { color: C.text, fontSize: 11, marginTop: 2 },

  whyNotFastestBox: {
    backgroundColor: "rgba(248, 81, 73, 0.08)",
    borderRadius: 8,
    padding: 8,
    marginTop: 4,
  },
  whyNotFastestTitle: { color: C.red, fontSize: 11, fontWeight: "700" },
  whyNotFastestText: { color: C.text, fontSize: 10, marginTop: 2 },

  aiAdviceBox: {
    backgroundColor: "rgba(88, 166, 255, 0.08)",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 8,
    marginTop: 4,
  },
  aiAdviceHeader: { color: C.amber, fontSize: 11, fontWeight: "800", marginBottom: 2 },
  aiAdviceText: { color: C.text, fontSize: 10, marginTop: 2 },

  // Navigation Overlay Dock
  navOverlayDock: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 28 : 14,
    left: 14,
    right: 14,
    backgroundColor: "rgba(22, 27, 34, 0.95)",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 18,
    padding: 12,
    gap: 6,
  },
  dockHeaderRow: { flexDirection: "row", alignItems: "center" },
  dockTitle: { color: C.amber, fontSize: 13, fontWeight: "800" },
  dockSafetyBadge: { fontSize: 11, fontWeight: "700", marginTop: 1 },

  riskAheadCard: {
    backgroundColor: "rgba(248,81,73,0.12)",
    borderWidth: 1,
    borderColor: C.red,
    borderRadius: 8,
    padding: 6,
  },
  riskAheadHeader: { color: C.red, fontSize: 10, fontWeight: "800" },
  riskAheadText: { color: C.text, fontSize: 10, marginTop: 2 },

  telemetryRow: { flexDirection: "row", justifyContent: "space-between", marginVertical: 2 },
  telemetryItem: { alignItems: "center" },
  telemetryVal: { color: C.text, fontSize: 11, fontWeight: "700" },
  telemetrySub: { color: C.sub, fontSize: 9 },

  voiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,176,32,0.15)",
    borderWidth: 1,
    borderColor: C.amber,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  voiceBtnText: { color: C.amber, fontSize: 10, fontWeight: "700" },

  smallMuteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 176, 32, 0.12)",
    borderWidth: 1,
    borderColor: C.amber,
    alignItems: "center",
    justifyContent: "center",
  },
  smallMuteBtnActive: {
    backgroundColor: "rgba(248, 81, 73, 0.15)",
    borderColor: C.red,
  },

  exitNavBtn: {
    backgroundColor: C.redDim,
    borderWidth: 1,
    borderColor: C.red,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 4,
  },
<<<<<<< HEAD
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
=======
  exitNavText: { color: C.red, fontWeight: "800", fontSize: 11 },

  rerouteBanner: {
    position: "absolute",
    top: Platform.OS === "ios" ? 54 : 20,
    left: 14,
    right: 14,
    backgroundColor: "#1C1910",
    borderWidth: 1.5,
    borderColor: C.amber,
    borderRadius: 12,
>>>>>>> 18dab5d510c938596f4c4c60ac85f0fb61e6b97e
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    zIndex: 30,
  },
  rerouteBannerText: { color: C.amber, fontSize: 11, fontWeight: "700", flex: 1 },

  rainMarkerBadge: {
    backgroundColor: C.blue,
    padding: 5,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
<<<<<<< HEAD
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
=======
>>>>>>> 18dab5d510c938596f4c4c60ac85f0fb61e6b97e
});
