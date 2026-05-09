import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View, Text, StyleSheet, Platform } from "react-native";

import HomeStack from "../Navigations/HomeStack";
import SettingsScreen from "../screens/SettingsScreen";

const Tab = createBottomTabNavigator();

const C = {
  bg: "#161B22",
  border: "#30363D",
  amber: "#F0A500",
  amberDim: "#7A5200",
  sub: "#8B949E",
  muted: "#484F58",
};

const TAB_ICONS = {
  Home: "view-dashboard-outline",
  Settings: "tune-variant",
};

const TAB_ICONS_ACTIVE = {
  Home: "view-dashboard",
  Settings: "tune-variant",
};

function TabIcon({ name, focused, color, label }) {
  return (
    <View style={styles.iconColumn}>
      <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
        {/* Top indicator bar */}
        {focused && <View style={styles.topBar} />}
        <MaterialCommunityIcons
          name={focused ? (TAB_ICONS_ACTIVE[label] ?? name) : name}
          size={21}
          color={color}
        />
      </View>
    </View>
  );
}

export default function BottomNav() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: true,
        tabBarLabelStyle: styles.label,
        tabBarActiveTintColor: C.amber,
        tabBarInactiveTintColor: C.muted,
        tabBarIcon: ({ focused, color }) => (
          <TabIcon
            name={TAB_ICONS[route.name] ?? "circle-outline"}
            focused={focused}
            color={color}
            label={route.name}
          />
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeStack} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: C.bg,
    borderTopWidth: 1,
    borderTopColor: C.border,
    height: Platform.OS === "ios" ? 82 : 64,
    paddingBottom: Platform.OS === "ios" ? 22 : 8,
    paddingTop: 0,
    elevation: 0,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
  },

  label: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginTop: 1,
  },

  iconColumn: {
    alignItems: "center",
  },

  iconWrap: {
    width: 44,
    height: 32,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    overflow: "visible",
  },

  iconWrapActive: {
    backgroundColor: C.amberDim + "44",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.amberDim,
  },

  // Amber notch on top edge of active icon
  topBar: {
    position: "absolute",
    top: -9,
    width: 20,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: C.amber,
  },
});
