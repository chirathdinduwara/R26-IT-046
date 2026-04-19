import { Pressable, Text, StyleSheet } from "react-native";

export default function NavCard({ title, onPress }) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <Text style={styles.text}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 20,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    backgroundColor: "rgba(255,255,255,0.1)", // fallback
    overflow: "hidden",
  },

  text: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },

  clickEffect: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
});
