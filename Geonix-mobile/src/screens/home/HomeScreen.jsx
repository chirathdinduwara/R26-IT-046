import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  Pressable,
} from "react-native";
import { FontAwesome } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import TopWeather from "../../components/HomeScreen/TopWeather";
import NavCard from "../../components/HomeScreen/NavCards";

export default function HomeScreen() {
  const navigation = useNavigation();

  const data = [{ id: "1", title: "FloodMap" }];

  return (
    <View style={styles.container}>
      <TopWeather />

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NavCard
            title={item.title}
            onPress={() => navigation.navigate(item.title)}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#9daeef",
    padding: 16,
    gap: 20,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 40,
    marginBottom: 20,
  },

  title: {
    fontSize: 24,
    fontWeight: "bold",
  },

  searchBox: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 20,
  },

  input: {
    marginLeft: 10,
    flex: 1,
  },

  card: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 12,
    marginBottom: 12,
  },

  cardText: {
    fontSize: 16,
    fontWeight: "500",
  },
});
