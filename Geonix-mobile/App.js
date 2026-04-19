import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import HomeScree from "./src/screens/home/HomeScreen.jsx";
import { NavigationContainer } from "@react-navigation/native";
import BottomNav from "./src/components/BottomNav.jsx";

export default function App() {
  return (
    <NavigationContainer>
      <BottomNav />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
});
