import { FontAwesome } from "@expo/vector-icons";
import { Text, View } from "react-native";
import * as Location from "expo-location";
import { useEffect, useState } from "react";

export default function TopWeather() {
  const [locationName, setLocationName] = useState("Loading...");

  useEffect(() => {
    getLocation();
  }, []);

  const getLocation = async () => {
    try {
      // Ask permission
      let { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        setLocationName("Permission denied");
        return;
      }

      // Get GPS coordinates
      let location = await Location.getCurrentPositionAsync({});

      const { latitude, longitude } = location.coords;

      // Convert coordinates to city name
      let address = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      if (address.length > 0) {
        const place = address[0];

        setLocationName(
          `${place.city || place.region}, ${place.country || ""}`,
        );
      }
    } catch (err) {
      console.log(err);
      setLocationName("Location error");
    }
  };

  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        }}
      >
        <FontAwesome name="location-arrow" size={15} color="white" />

        <Text style={{ color: "white", fontSize: 16 }}>{locationName}</Text>
      </View>
    </View>
  );
}
