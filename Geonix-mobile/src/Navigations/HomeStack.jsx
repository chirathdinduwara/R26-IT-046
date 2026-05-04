import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen from "../screens/home/HomeScreen";
import FloodMapScreen from "../screens/FloodMapScreen";
import PaddyAdvisoryScreen from "../screens/PaddyAdvisoryScreen";

const Stack = createNativeStackNavigator();

export default function HomeStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="FloodMap" component={FloodMapScreen} />
      <Stack.Screen
        name="PaddyAdvisory"
        component={PaddyAdvisoryScreen}
        options={{ title: "Paddy Advisory" }}
      />
    </Stack.Navigator>
  );
}
