import { StyleSheet, View } from "react-native";
import MapView, { Polygon, Marker } from "react-native-maps";

export default function FloodMapScreen() {
  // Example flood polygon (Colombo area)
  const floodPolygon = [
    { latitude: 6.92, longitude: 79.88 },
    { latitude: 6.92, longitude: 79.89 },
    { latitude: 6.93, longitude: 79.89 },
    { latitude: 6.93, longitude: 79.88 },
  ];

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: 6.92,
          longitude: 79.88,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        }}
      >
        {/* Flood area polygon */}
        <Polygon
          coordinates={floodPolygon}
          fillColor="rgba(0, 0, 255, 0.3)"
          strokeColor="blue"
          strokeWidth={2}
        />

        {/* Example marker */}
        <Marker
          coordinate={{ latitude: 6.92, longitude: 79.88 }}
          title="Flood Area"
        />
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
});
