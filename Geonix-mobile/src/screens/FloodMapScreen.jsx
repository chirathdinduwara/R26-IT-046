import { StyleSheet, View } from "react-native";
import MapView, { Polygon } from "react-native-maps";
import { useEffect, useState } from "react";

export default function FloodMapScreen() {
  const [polygons, setPolygons] = useState([]);

  const API_URL = "http://192.168.8.101:8000";

  useEffect(() => {
    fetch(`${API_URL}/predict?rainfall=300`)
      .then((res) => res.json())
      .then((data) => {
        const converted = data.features
          .filter((f) => f.geometry?.type === "Polygon")
          .map((f) => {
            return f.geometry.coordinates[0].map((coord) => ({
              latitude: coord[1],
              longitude: coord[0],
            }));
          });
        console.log("Converted Polygons:", converted);
        setPolygons(converted);
      })
      .catch((err) => console.log("API ERROR:", err));
  }, []);

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: 6.92,
          longitude: 79.88,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        }}
      >
        {polygons.map((poly, index) => (
          <Polygon
            key={index}
            coordinates={poly}
            fillColor="rgba(0, 0, 255, 0.35)"
            strokeColor="blue"
            strokeWidth={2}
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
});
