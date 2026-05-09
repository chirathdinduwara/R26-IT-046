import { StyleSheet, View, Text, ActivityIndicator } from "react-native";
import MapView, { Polygon } from "react-native-maps";
import { useEffect, useState } from "react";
import DIVISION_COORDS from "../../assets/col_divs/devCords";

// division centroid coordinates
const DIVISION_COORDS_API = DIVISION_COORDS;

export default function FloodMapScreen() {
  const [geojson, setGeojson] = useState(null);

  const [loading, setLoading] = useState(true);

  const API_URL = "http://192.168.8.100:8000";

  // Fetch rainfall from Open-Meteo
  async function fetchDivisionRainfall(lat, lon) {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}` +
      `&longitude=${lon}` +
      `&daily=precipitation_sum` +
      `&timezone=Asia/Colombo` +
      `&forecast_days=16`;

    const res = await fetch(url);
    const data = await res.json();

    const prec = data.daily?.precipitation_sum || [];
    const safe = prec.map((v) => v || 0);

    const rain7 = safe.slice(0, 7).reduce((a, b) => a + b, 0);
    const rain14 = safe.slice(0, 14).reduce((a, b) => a + b, 0);

    return {
      rainfall_7day: Number(rain7.toFixed(1)),
      rainfall_14day: Number(rain14.toFixed(1)),
    };
  }

  async function buildWeatherPayload() {
    const divisions = {};

    for (const [name, coord] of Object.entries(DIVISION_COORDS_API)) {
      console.log("Fetching:", name);

      const rain = await fetchDivisionRainfall(coord.lat, coord.lon);
      console.log(`Rainfall for ${name}:`, rain);
      divisions[name] = {
        rainfall_7day: rain.rainfall_7day,

        rainfall_14day: rain.rainfall_14day,

        // shared upstream values for now
        upstream_rain_7d: rain.rainfall_7day * 1.2,

        upstream_rain_14d: rain.rainfall_14day * 1.2,

        // TODO:
        // replace with real API gauge data
        river_water_level: 7.5,
      };
    }

    return { divisions };
  }

  useEffect(() => {
    async function loadFloodPrediction() {
      try {
        // Build live weather payload
        const payload = await buildWeatherPayload();

        console.log("Payload:", payload);

        // Send to FastAPI
        const res = await fetch(`${API_URL}/predict/full`, {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify(payload),
        });

        const data = await res.json();

        console.log("Prediction:", data);

        setGeojson(data.geojson);
      } catch (err) {
        console.log("ERROR:", err);
      } finally {
        setLoading(false);
      }
    }

    loadFloodPrediction();
  }, []);

  function getPolygons() {
    if (!geojson?.features) return [];

    return geojson.features.flatMap((f) => {
      const geom = f.geometry;

      if (geom.type === "Polygon") {
        return [
          {
            coordinates: geom.coordinates[0].map(([lng, lat]) => ({
              latitude: lat,
              longitude: lng,
            })),

            severity: f.properties?.severity,
          },
        ];
      }

      if (geom.type === "MultiPolygon") {
        return geom.coordinates.map((poly) => ({
          coordinates: poly[0].map(([lng, lat]) => ({
            latitude: lat,
            longitude: lng,
          })),

          severity: f.properties?.severity,
        }));
      }

      return [];
    });
  }

  function getColor(sev) {
    if (sev === "high") {
      return "rgba(255,0,0,0.45)";
    }

    if (sev === "medium") {
      return "rgba(255,165,0,0.40)";
    }

    return "rgba(0,0,255,0.35)";
  }

  const polygons = getPolygons();

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loading}>
          <ActivityIndicator size="large" />
          <Text>Fetching rainfall + predicting floods...</Text>
        </View>
      )}

      <MapView
        style={styles.map}
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
            strokeColor="black"
            strokeWidth={1.5}
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  map: {
    flex: 1,
  },

  loading: {
    position: "absolute",

    top: 70,

    alignSelf: "center",

    backgroundColor: "white",

    padding: 12,

    borderRadius: 12,

    zIndex: 999,
  },
});
