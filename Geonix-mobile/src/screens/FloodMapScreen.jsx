import { StyleSheet, Text, View } from "react-native";

export default function FloodMapScreen() {
  return (
    <>
      <View style={styles.container}>
        <Text>Flood Map Screen</Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f6fa",
    padding: 16,
  },
});
