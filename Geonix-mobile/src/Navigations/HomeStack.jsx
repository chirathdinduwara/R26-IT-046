import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Platform } from "react-native";
import HomeScreen from "../screens/home/HomeScreen";
import FloodMapScreen from "../screens/FloodMapScreen";
import PaddyAdvisoryScreen from "../screens/PaddyAdvisoryScreen";
import FloodMapScreenDivision from "../screens/FloodMapScreenDivision";
import DengueRiskScreen from "../screens/DengueRiskScreen";
import DengueRiskDemoScreen from "../screens/DengueRiskDemoScreen";
import DengueChatbotScreen from "../screens/DengueRiskChatScreen";
import SafeNavigationScreen from "../screens/SafeNavigationScreen";
import SafeNavigationDemoScreen from "../screens/SafeNavigationDemoScreen";

const Stack = createNativeStackNavigator();

const HEADER = {
  bg: "#161B22",
  border: "#30363D",
  text: "#E6EDF3",
  sub: "#8B949E",
  amber: "#F0A500",
  teal: "#39D5C6",
};

const baseHeader = {
  headerStyle: {
    backgroundColor: HEADER.bg,
  },
  headerTintColor: HEADER.amber,
  headerTitleStyle: {
    color: HEADER.text,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  headerShadowVisible: false,
  headerBackTitleVisible: false,
  headerBottomBorderVisible: true,
  contentStyle: { backgroundColor: "#0D1117" },

  ...(Platform.OS === "android" && {
    headerBackButtonMenuEnabled: false,
  }),
};

export default function HomeStack() {
  return (
    <Stack.Navigator screenOptions={baseHeader}>
      <Stack.Screen
        name="HomeScreen"
        component={HomeScreen}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="FloodMap"
        component={FloodMapScreen}
        options={{
          title: "Flood Risk Map",
          headerTitleStyle: {
            ...baseHeader.headerTitleStyle,
          },
          headerStyle: {
            ...baseHeader.headerStyle,
          },
          headerRight: () => (
            <DistrictBadge label="ALL DIVISIONS" color={HEADER.amber} />
          ),
        }}
      />

      <Stack.Screen
        name="FloodMapDivision"
        component={FloodMapScreenDivision}
        options={{
          title: "Division Predict",
          headerTitleStyle: {
            ...baseHeader.headerTitleStyle,
          },
          headerRight: () => (
            <DistrictBadge label="TAP TO PREDICT" color={HEADER.teal} />
          ),
        }}
      />

      {/* ── Paddy Advisory ──────────────────────── */}
      {/* ── Single-division / tap-to-predict map ──────────────────────── */}
      <Stack.Screen
        name="PaddyAdvisory"
        component={PaddyAdvisoryScreen}
        options={{
          title: "Paddy Advisory",
          headerTitleStyle: {
            ...baseHeader.headerTitleStyle,
          },
          headerRight: () => (
            <DistrictBadge label="TAP TO PREDICT" color={HEADER.teal} />
          ),
        }}
      />

      <Stack.Screen
        name="DengueWarning"
        component={DengueRiskScreen}
        options={{
          title: "Dengue Warning",
          headerTitleStyle: {
            ...baseHeader.headerTitleStyle,
          },
          headerRight: () => (
            <DistrictBadge label="RISK ALERTS" color={HEADER.teal} />
          ),
        }}
      />

      <Stack.Screen
        name="DengueRiskDemo"
        component={DengueRiskDemoScreen}
        options={{
          title: "Dengue Risk Simulator",
          headerTitleStyle: {
            ...baseHeader.headerTitleStyle,
          },
          headerRight: () => (
            <DistrictBadge label="DEMO MODE" color={HEADER.amber} />
          ),
        }}
      />

      <Stack.Screen
        name="DengueChatbot"
        component={DengueChatbotScreen}
        options={{
          title: "Dengue AI Assistant",
          headerTitleStyle: {
            ...baseHeader.headerTitleStyle,
          },
          headerRight: () => (
            <DistrictBadge label="CHAT PREVIEW" color={HEADER.amber} />
          ),
        }}
      />

      <Stack.Screen
        name="SafeNavigation"
        component={SafeNavigationScreen}
        options={{
          title: "Safe Navigation",
          headerTitleStyle: {
            ...baseHeader.headerTitleStyle,
          },
          headerRight: () => (
            <DistrictBadge label="SAFE ROUTES" color={HEADER.teal} />
          ),
        }}
      />

      <Stack.Screen
        name="SafeNavigationDemo"
        component={SafeNavigationDemoScreen}
        options={{
          title: "Safe Navigation Demo",
          headerTitleStyle: {
            ...baseHeader.headerTitleStyle,
          },
          headerRight: () => (
            <DistrictBadge label="DEMO MODE" color={HEADER.amber} />
          ),
        }}
      />
    </Stack.Navigator>
  );
}

import { View, Text, StyleSheet } from "react-native";

function DistrictBadge({ label, color }) {
  return (
    <View
      style={[
        styles.badge,
        { borderColor: color + "55", backgroundColor: color + "18" },
      ]}
    >
      <View style={[styles.badgeDot, { backgroundColor: color }]} />
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 4,
  },
  badgeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
});
