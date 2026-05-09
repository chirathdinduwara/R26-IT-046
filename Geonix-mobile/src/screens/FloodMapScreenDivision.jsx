import {
  StyleSheet,
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from "react-native";

import MapView, { Polygon } from "react-native-maps";
import { useEffect, useRef, useState } from "react";
import DIVISION_COORDS from "../../assets/col_divs/devCords";

export default function FloodMapScreenDivision() {
  const API_URL = "http://192.168.8.100:8000";

  const [geojson, setGeojson] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const [selectedDivision, setSelectedDivision] = useState(null);

  const [rain7, setRain7] = useState("");
  const [rain14, setRain14] = useState("");
  const [up7, setUp7] = useState("");
  const [up14, setUp14] = useState("");
  const [river, setRiver] = useState("");

  // -----------------------------
  // ANIMATION
  // -----------------------------
  const fade = useRef(new Animated.Value(0)).current;

  const toast = (msg) => {
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
      }, 1200);
    });
  };

  // -----------------------------
  // MAP → DIVISION PICK
  // -----------------------------
  const getNearestDivision = (lat, lon) => {
    let best = null;
    let bestDist = Infinity;

    for (const [name, c] of Object.entries(DIVISION_COORDS)) {
      const d = (lat - c.lat) ** 2 + (lon - c.lon) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = name;
      }
    }

    return best;
  };

  const onMapPress = (e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;

    const div = getNearestDivision(latitude, longitude);

    setSelectedDivision(div);

    // optional auto-fill defaults (important UX upgrade)
    setRain7("100");
    setRain14("200");
    setUp7("120");
    setUp14("240");
    setRiver("7.5");

    setModalVisible(true);
  };

  // -----------------------------
  // PREDICT (SUBDIST ONLY)
  // -----------------------------
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
      console.log("Sent payload:", data);

      if (data.error) {
        toast("Invalid division");
        return;
      }

      setGeojson(data.geojson);
      setModalVisible(false);

      toast("Prediction ready");
    } catch (err) {
      console.log(err);
      toast("API error");
    } finally {
      setLoading(false);
    }
  };

  // -----------------------------
  // POLYGONS
  // -----------------------------
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

  return (
    <View style={styles.container}>
      {/* MAP */}
      <MapView
        style={styles.map}
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
          />
        ))}
      </MapView>

      {/* LOADING */}
      {loading && (
        <View style={styles.loading}>
          <ActivityIndicator size="large" />
          <Text>Predicting...</Text>
        </View>
      )}

      {/* TOAST */}
      <Animated.View style={[styles.toast, { opacity: fade }]}>
        <Text style={{ color: "white" }}>Done</Text>
      </Animated.View>

      {/* MODAL */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modal}>
          <Text style={styles.title}>Division: {selectedDivision}</Text>

          <TextInput
            style={styles.input}
            value={rain7}
            onChangeText={setRain7}
            placeholder="Rain 7d"
          />
          <TextInput
            style={styles.input}
            value={rain14}
            onChangeText={setRain14}
            placeholder="Rain 14d"
          />
          <TextInput
            style={styles.input}
            value={up7}
            onChangeText={setUp7}
            placeholder="Upstream 7d"
          />
          <TextInput
            style={styles.input}
            value={up14}
            onChangeText={setUp14}
            placeholder="Upstream 14d"
          />
          <TextInput
            style={styles.input}
            value={river}
            onChangeText={setRiver}
            placeholder="River level"
          />

          <TouchableOpacity style={styles.btn} onPress={predict}>
            <Text style={styles.btnText}>Predict</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setModalVisible(false)}>
            <Text style={{ textAlign: "center", marginTop: 10 }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

// -----------------------------
const styles = StyleSheet.create({
  container: { flex: 1 },

  map: { flex: 1 },

  modal: {
    marginTop: "auto",
    backgroundColor: "white",
    padding: 15,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },

  input: {
    backgroundColor: "#eee",
    padding: 10,
    marginBottom: 8,
    borderRadius: 8,
  },

  btn: {
    backgroundColor: "blue",
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },

  btnText: {
    color: "white",
    textAlign: "center",
  },

  loading: {
    position: "absolute",
    top: "40%",
    alignSelf: "center",
    backgroundColor: "white",
    padding: 15,
    borderRadius: 10,
  },

  toast: {
    position: "absolute",
    top: 60,
    alignSelf: "center",
    backgroundColor: "black",
    padding: 10,
    borderRadius: 8,
  },

  title: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
  },
});
