import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { FontAwesome } from "@expo/vector-icons";

import HomeStack from "../Navigations/HomeStack";
import HomeScreen from "../screens/home/HomeScreen";

const Tab = createBottomTabNavigator();

export default function BottomNav() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: "#007AFF",
        tabBarInactiveTintColor: "gray",

        tabBarIcon: ({ color, size }) => {
          let icon = "";

          switch (route.name) {
            case "Home":
              icon = "home";
              break;
            case "Settings":
              icon = "cog";
              break;
          }

          return <FontAwesome name={icon} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeStack} />
      <Tab.Screen name="Settings" component={HomeScreen} />
    </Tab.Navigator>
  );
}
