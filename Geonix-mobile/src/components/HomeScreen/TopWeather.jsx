import { FontAwesome } from "@expo/vector-icons";
import { Text, View } from "react-native";

export default function TopWeather() {
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <FontAwesome name="location-arrow" size={15} color="white" />
        <Text style={{ color: "white", fontSize: 16 }}>Malabe, SL</Text>
      </View>
    </View>
  );
}
