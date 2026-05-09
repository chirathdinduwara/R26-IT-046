import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Platform } from "react-native";
import HomeScreen from "../screens/home/HomeScreen";
import FloodMapScreen from "../screens/FloodMapScreen";
import FloodMapScreenDivision from "../screens/FloodMapScreenDivision";

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
  headerTintColor: HEADER.amber, // back-arrow colour
  headerTitleStyle: {
    color: HEADER.text,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  headerShadowVisible: false, // removes iOS drop-shadow
  headerBackTitleVisible: false, // iOS: hide "Back" text
  // Hairline border under the header
  headerBottomBorderVisible: true,
  contentStyle: { backgroundColor: "#0D1117" },

  // Android ripple on back button
  ...(Platform.OS === "android" && {
    headerBackButtonMenuEnabled: false,
  }),
};

export default function HomeStack() {
  return (
    <Stack.Navigator screenOptions={baseHeader}>
      {/* ── Home — no header ───────────────────────────────────────────── */}
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ headerShown: false }}
      />

      {/* ── Full district flood map ────────────────────────────────────── */}
      <Stack.Screen
        name="FloodMap"
        component={FloodMapScreen}
        options={{
          title: "Flood Risk Map",
          headerTitleStyle: {
            ...baseHeader.headerTitleStyle,
          },
          // Amber left-border accent via a custom hairline
          headerStyle: {
            ...baseHeader.headerStyle,
            // RN stack doesn't support borderLeft natively, so we rely on
            // the consistent bg + bottom border for the branded look
          },
          // Subtle subtitle via headerRight badge
          headerRight: () => (
            <DistrictBadge label="ALL DIVISIONS" color={HEADER.amber} />
          ),
        }}
      />

      {/* ── Single-division / tap-to-predict map ──────────────────────── */}
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
    </Stack.Navigator>
  );
}

// ── Small pill badge shown in header right ────────────────────────────────────
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
