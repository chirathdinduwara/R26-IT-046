import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Leaf, CloudRain, AlertTriangle } from "lucide-react-native";

export default function PaddyAdvisoryScreen() {
  const [district, setDistrict] = useState("Colombo");
  const [city, setCity] = useState("Kesbewa");
  const [season, setSeason] = useState("Yala");
  const [farmSize, setFarmSize] = useState("2");
  const [cropWeek, setCropWeek] = useState("3");

  const [result, setResult] = useState(null);

  const handlePredict = async () => {
    try {
      const res = await fetch("http://192.168.8.101:8000/predict", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          district,
          city,
          season,
          farm_size_hectare: parseFloat(farmSize),
          crop_week: parseInt(cropWeek),
        }),
      });

      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.log(err);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🌾 Paddy Advisory</Text>
        <Text style={styles.headerSub}>Smart Farming Assistant</Text>
      </View>

      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Healthy Paddy, Better Tomorrow</Text>
        <Text style={styles.heroSub}>Smart insights for higher yield</Text>
      </View>

      {/* Inputs */}
      <View style={styles.card}>
        <Text style={styles.label}>District</Text>
        <TextInput
          style={styles.input}
          value={district}
          onChangeText={setDistrict}
        />

        <Text style={styles.label}>City</Text>
        <TextInput style={styles.input} value={city} onChangeText={setCity} />

        <Text style={styles.label}>Season</Text>
        <TextInput
          style={styles.input}
          value={season}
          onChangeText={setSeason}
        />

        <Text style={styles.label}>Farm Size (ha)</Text>
        <TextInput
          style={styles.input}
          value={farmSize}
          onChangeText={setFarmSize}
        />

        <Text style={styles.label}>Crop Week</Text>
        <TextInput
          style={styles.input}
          value={cropWeek}
          onChangeText={setCropWeek}
        />

        <TouchableOpacity style={styles.button} onPress={handlePredict}>
          <Text style={styles.buttonText}>Get Prediction</Text>
        </TouchableOpacity>
      </View>

      {/* Results */}
      {result && (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>📊 Result Summary</Text>

          <View style={styles.grid}>
            <View style={styles.cardBox}>
              <Text style={styles.cardLabel}>Predicted Yield</Text>
              <Text style={styles.cardValue}>{result.Predicted_Yield}</Text>
              <Text style={styles.cardUnit}>kg/ha</Text>
            </View>

            <View style={styles.cardBox}>
              <Text style={styles.cardLabel}>Production</Text>
              <Text style={styles.cardValue}>
                {result.Expected_Production_tons}
              </Text>
              <Text style={styles.cardUnit}>tons</Text>
            </View>

            <View style={styles.cardBox}>
              <Text style={styles.cardLabel}>Risk</Text>
              <Text style={styles.cardValue}>{result.Risk_Level}</Text>
            </View>

            <View style={styles.cardBox}>
              <Text style={styles.cardLabel}>Stage</Text>
              <Text style={styles.cardValue}>{result.Crop_Stage}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>💡 Advisory</Text>

          <View style={styles.advisoryBox}>
            <Text style={styles.advisoryText}>{result.Advisory}</Text>
          </View>
          <Text style={styles.sectionTitle}>🌧️ 7 Day Forecast</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {result.Seven_Day_Rain_Forecast.map((day, i) => (
              <View key={i} style={styles.forecastCard}>
                <Text style={styles.forecastDate}>{day.date}</Text>
                <Text>{day.rain_mm} mm</Text>
                <Text>{day.temp_max}°</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#f5f7f6",
    flex: 1,
    padding: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#2e7d32",
  },
  card: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
  },
  label: {
    marginTop: 10,
    fontWeight: "600",
  },
  input: {
    backgroundColor: "#eee",
    padding: 10,
    borderRadius: 8,
    marginTop: 5,
  },
  button: {
    backgroundColor: "#2e7d32",
    padding: 12,
    marginTop: 15,
    borderRadius: 10,
  },
  buttonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "bold",
  },
  resultCard: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  resultText: {
    fontSize: 14,
    marginVertical: 3,
  },
  advisoryTitle: {
    marginTop: 10,
    fontWeight: "bold",
  },
  advisoryText: {
    fontSize: 13,
    marginTop: 5,
  },
  forecastRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 5,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  header: {
    marginBottom: 10,
  },

  headerTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#2e7d32",
  },

  headerSub: {
    color: "#666",
    fontSize: 13,
  },

  hero: {
    backgroundColor: "#2e7d32",
    padding: 15,
    borderRadius: 15,
    marginBottom: 15,
  },

  heroTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },

  heroSub: {
    color: "#e8f5e9",
    fontSize: 12,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 10,
  },

  cardBox: {
    width: "48%",
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    elevation: 3,
  },

  cardLabel: {
    fontSize: 12,
    color: "#666",
  },

  cardValue: {
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 5,
  },

  cardUnit: {
    fontSize: 11,
    color: "#999",
  },
  sectionTitle: {
    fontWeight: "bold",
    marginTop: 15,
    fontSize: 16,
  },

  advisoryBox: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    marginTop: 5,
  },

  advisoryText: {
    fontSize: 13,
    lineHeight: 18,
  },
  forecastCard: {
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 10,
    marginRight: 10,
    width: 80,
    alignItems: "center",
  },

  forecastDate: {
    fontSize: 11,
    marginBottom: 5,
  },
});
