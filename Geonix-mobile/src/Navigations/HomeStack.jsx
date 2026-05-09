import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen from "../screens/home/HomeScreen";
import FloodMapScreen from "../screens/FloodMapScreen";
import FloodMapScreenDivision from "../screens/FloodMapScreenDivision";
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
        name="FloodMapDivision"
        component={FloodMapScreenDivision}
      />
    </Stack.Navigator>
  );
}
