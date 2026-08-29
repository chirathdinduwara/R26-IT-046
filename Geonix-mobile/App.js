import React, { useCallback, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { LogBox, StyleSheet, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import BottomNav from "./src/components/BottomNav.jsx";
import AnimatedSplash from "./src/screens/AnimatedSplashScreen.jsx";

// Suppress the SDK 53 expo-notifications remote push notifications warning/error in Expo Go
LogBox.ignoreLogs([
  "expo-notifications: Android Push notifications (remote notifications) functionality",
]);

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [splashAnimationDone, setSplashAnimationDone] = useState(false);

  const [fontsLoaded] = useFonts({
    // your custom fonts here, if any
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      // Hide the native splash immediately — our custom one takes over
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <View style={styles.container} onLayout={onLayoutRootView}>
      <NavigationContainer>
        <BottomNav />
        <StatusBar style="auto" />
      </NavigationContainer>

      {!splashAnimationDone && (
        <AnimatedSplash
          onAnimationFinish={() => setSplashAnimationDone(true)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
});
