import React, { useEffect, useState } from "react";

import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";

import {
  Leaf,
  CloudRain,
  ShieldCheck,
  Sprout,
  Package,
  BarChart3,
  ArrowLeft,
} from "lucide-react-native";

import { Picker } from "@react-native-picker/picker";
import { PADDY_API_URL } from "../config/api";

const TEXT = {
  en: {
    newPrediction: "New Prediction",
    paddyAdvisory: "Paddy Advisory",
    district: "District",
    city: "City / Area",
    season: "Season",
    yala: "Yala Season",
    maha: "Maha Season",
    farmSize: "Farm Size (Hectare)",
    cropWeek: "Crop Week",
    getPrediction: "Get Prediction",
    heroTitle: "Healthy Paddy,\nBetter Tomorrow",
    heroSub: "Smart insights for higher yield",
    predictedYield: "Predicted Yield",
    expectedProduction: "Expected Production",
    riskLevel: "Risk Level",
    cropStage: "Crop Stage",
    rainForecast: "7 Day Rain Forecast",
    viewAll: "View All",
    advisorySummary: "Advisory Summary",
    makeNew: "Make New Prediction",
    kgHa: "kg/ha",
    tons: "tons",
    week: "Week",
  },

  si: {
    newPrediction: "නව අනාවැකිය",
    paddyAdvisory: "වී වගා උපදේශනය",
    district: "දිස්ත්‍රික්කය",
    city: "නගරය / ප්‍රදේශය",
    season: "කන්නය",
    yala: "යල කන්නය",
    maha: "මහ කන්නය",
    farmSize: "ගොවිබිම් ප්‍රමාණය (හෙක්ටයාර්)",
    cropWeek: "වගා සතිය",
    getPrediction: "අනාවැකිය ලබාගන්න",
    heroTitle: "සාර්ථක වී වගාවක්,\nහොඳ හෙටක්",
    heroSub: "ඉහළ අස්වැන්නකට බුද්ධිමත් උපදෙස්",
    predictedYield: "අනුමාන අස්වැන්න",
    expectedProduction: "අපේක්ෂිත නිෂ්පාදනය",
    riskLevel: "අවදානම් මට්ටම",
    cropStage: "වර්ධන අදියර",
    rainForecast: "දින 7 වැසි අනාවැකිය",
    viewAll: "සියල්ල බලන්න",
    advisorySummary: "උපදේශන සාරාංශය",
    makeNew: "නව අනාවැකියක් කරන්න",
    kgHa: "කි.ග්‍රෑ/හෙක්ටයාර්",
    tons: "ටොන්",
    week: "සතිය",
  },
};

export default function PaddyAdvisoryScreen() {
  const [districts, setDistricts] = useState([]);
  const [cities, setCities] = useState([]);

  const [district, setDistrict] = useState("");
  const [city, setCity] = useState("");

  const [season, setSeason] = useState("Yala");
  const [farmSize, setFarmSize] = useState("2");
  const [cropWeek, setCropWeek] = useState("3");

  const [result, setResult] = useState(null);
  const [showResult, setShowResult] = useState(false);

  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState("en");

  // --------------------------------------------------
  // GET PREDICTION
  // --------------------------------------------------

  const handlePredict = async () => {
    if (!district || !city || !season || !farmSize || !cropWeek) {
      Alert.alert("Missing Data", "Please fill all fields.");
      return;
    }

    const farmSizeNumber = Number(farmSize);
    const cropWeekNumber = Number(cropWeek);

    if (Number.isNaN(farmSizeNumber) || farmSizeNumber <= 0) {
      Alert.alert("Invalid Farm Size", "Please enter a valid farm size.");
      return;
    }

    if (Number.isNaN(cropWeekNumber) || cropWeekNumber <= 0) {
      Alert.alert("Invalid Crop Week", "Please enter a valid crop week.");
      return;
    }

    try {
      setLoading(true);

      const payload = {
        district: district.trim(),
        city: city.trim(),
        season: season.trim(),
        farm_size_hectare: farmSizeNumber,
        crop_week: cropWeekNumber,
      };

      console.log("Prediction payload:", payload);
      console.log("Prediction URL:", `${PADDY_API_URL}/predict`);

      const res = await fetch(`${PADDY_API_URL}/predict`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      console.log("Prediction API response:", data);

      if (!res.ok) {
        Alert.alert(
          "Prediction Failed",
          data?.message || `Server returned HTTP ${res.status}`,
        );
        return;
      }

      if (data?.status === "failed") {
        Alert.alert("Prediction Failed", data?.message || "Prediction failed.");
        return;
      }

      if (!data || typeof data !== "object") {
        Alert.alert(
          "Prediction Failed",
          "Invalid response received from backend.",
        );
        return;
      }

      setResult(data);
      setShowResult(true);
    } catch (err) {
      console.log("Predict error:", err);

      Alert.alert("Network Error", "Cannot connect to backend server.");
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // LOAD DISTRICTS
  // --------------------------------------------------

  useEffect(() => {
    let mounted = true;

    async function loadDistricts() {
      try {
        console.log("Loading districts:", `${PADDY_API_URL}/districts`);

        const res = await fetch(`${PADDY_API_URL}/districts`);

        const data = await res.json();

        console.log("District API response:", data);

        if (!res.ok) {
          throw new Error(`District API returned HTTP ${res.status}`);
        }

        /*
         * Expected backend:
         *
         * {
         *   "districts": ["Ampara", "Badulla", ...]
         * }
         *
         * Also supports:
         *
         * ["Ampara", "Badulla", ...]
         */

        let districtList = [];

        if (Array.isArray(data)) {
          districtList = data;
        } else if (Array.isArray(data?.districts)) {
          districtList = data.districts;
        }

        // Make sure only usable values are kept
        districtList = districtList.filter(
          (item) => typeof item === "string" && item.trim().length > 0,
        );

        if (!mounted) return;

        setDistricts(districtList);

        if (districtList.length > 0) {
          setDistrict(districtList[0]);
        } else {
          setDistrict("");
          setCities([]);
          setCity("");
        }
      } catch (err) {
        console.log("Load districts error:", err);

        if (!mounted) return;

        setDistricts([]);
        setDistrict("");
        setCities([]);
        setCity("");

        Alert.alert(
          "District Error",
          "Could not load districts from the backend.",
        );
      }
    }

    loadDistricts();

    return () => {
      mounted = false;
    };
  }, []);

  // --------------------------------------------------
  // LOAD CITIES WHEN DISTRICT CHANGES
  // --------------------------------------------------

  useEffect(() => {
    if (!district) {
      setCities([]);
      setCity("");
      return;
    }

    let mounted = true;

    async function loadCities() {
      try {
        const encodedDistrict = encodeURIComponent(district);

        const url = `${PADDY_API_URL}/cities/${encodedDistrict}`;

        console.log("Loading cities:", url);

        const res = await fetch(url);

        const data = await res.json();

        console.log("City API response:", data);

        if (!res.ok) {
          throw new Error(`City API returned HTTP ${res.status}`);
        }

        /*
         * Expected backend:
         *
         * {
         *   "cities": ["Ampara", "Kalmunai", ...]
         * }
         *
         * Also supports:
         *
         * ["Ampara", "Kalmunai", ...]
         */

        let cityList = [];

        if (Array.isArray(data)) {
          cityList = data;
        } else if (Array.isArray(data?.cities)) {
          cityList = data.cities;
        }

        cityList = cityList.filter(
          (item) => typeof item === "string" && item.trim().length > 0,
        );

        if (!mounted) return;

        setCities(cityList);

        if (cityList.length > 0) {
          setCity(cityList[0]);
        } else {
          setCity("");
        }
      } catch (err) {
        console.log("Load cities error:", err);

        if (!mounted) return;

        setCities([]);
        setCity("");

        Alert.alert("City Error", `Could not load cities for ${district}.`);
      }
    }

    loadCities();

    return () => {
      mounted = false;
    };
  }, [district]);

  // --------------------------------------------------
  // INPUT SCREEN
  // --------------------------------------------------

  const renderInputScreen = () => (
    <>
      <View style={styles.topbar}>
        <TouchableOpacity
          onPress={() => {
            console.log("Back pressed");
          }}
        >
          <ArrowLeft size={26} color="#111" />
        </TouchableOpacity>

        <Text style={styles.pageTitle}>{TEXT[language].newPrediction}</Text>

        <View style={{ width: 26 }} />
      </View>

      {/* LANGUAGE TABS */}

      <View style={styles.langTabs}>
        <TouchableOpacity
          style={language === "en" ? styles.langActive : styles.langInactive}
          onPress={() => setLanguage("en")}
        >
          <Text
            style={
              language === "en"
                ? styles.langActiveText
                : styles.langInactiveText
            }
          >
            English
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={language === "si" ? styles.langActive : styles.langInactive}
          onPress={() => setLanguage("si")}
        >
          <Text
            style={
              language === "si"
                ? styles.langActiveText
                : styles.langInactiveText
            }
          >
            සිංහල
          </Text>
        </TouchableOpacity>
      </View>

      {/* FORM */}

      <View style={styles.formCard}>
        {/* DISTRICT */}

        <Text style={styles.label}>{TEXT[language].district}</Text>

        <View style={styles.pickerBox}>
          <Picker
            selectedValue={district}
            onValueChange={(value) => {
              setDistrict(value);
            }}
          >
            {Array.isArray(districts) &&
              districts.map((d) => (
                <Picker.Item key={String(d)} label={String(d)} value={d} />
              ))}
          </Picker>
        </View>

        {/* CITY */}

        <Text style={styles.label}>{TEXT[language].city}</Text>

        <View style={styles.pickerBox}>
          <Picker
            selectedValue={city}
            onValueChange={(value) => {
              setCity(value);
            }}
          >
            {Array.isArray(cities) &&
              cities.map((c) => (
                <Picker.Item key={String(c)} label={String(c)} value={c} />
              ))}
          </Picker>
        </View>

        {/* SEASON */}

        <Text style={styles.label}>{TEXT[language].season}</Text>

        <View style={styles.pickerBox}>
          <Picker selectedValue={season} onValueChange={setSeason}>
            <Picker.Item label={TEXT[language].yala} value="Yala" />

            <Picker.Item label={TEXT[language].maha} value="Maha" />
          </Picker>
        </View>

        {/* FARM SIZE */}

        <Text style={styles.label}>{TEXT[language].farmSize}</Text>

        <TextInput
          style={styles.input}
          value={farmSize}
          onChangeText={setFarmSize}
          keyboardType="numeric"
          placeholder="2"
          placeholderTextColor="#888"
        />

        {/* CROP WEEK */}

        <Text style={styles.label}>{TEXT[language].cropWeek}</Text>

        <TextInput
          style={styles.input}
          value={cropWeek}
          onChangeText={setCropWeek}
          keyboardType="numeric"
          placeholder="3"
          placeholderTextColor="#888"
        />

        {/* BUTTON */}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handlePredict}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {TEXT[language].getPrediction}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </>
  );

  // --------------------------------------------------
  // RESULT SCREEN
  // --------------------------------------------------

  const renderResultScreen = () => {
    const forecast = Array.isArray(result?.Seven_Day_Rain_Forecast)
      ? result.Seven_Day_Rain_Forecast
      : [];

    const advisory = getDisplayAdvisory(result, language);

    const advisorySections = splitAdvisory(advisory);

    return (
      <>
        {/* TOP BAR */}

        <View style={styles.topbar}>
          <TouchableOpacity onPress={() => setShowResult(false)}>
            <ArrowLeft size={26} color="#111" />
          </TouchableOpacity>

          <Text style={styles.pageTitle}>{TEXT[language].paddyAdvisory}</Text>

          <Text style={{ fontSize: 22 }}>🔔</Text>
        </View>

        {/* HERO */}

        <View style={styles.hero}>
          <Text style={styles.heroTitle}>{TEXT[language].heroTitle}</Text>

          <Text style={styles.heroSub}>{TEXT[language].heroSub}</Text>

          <Text style={styles.heroIcon}>🌾</Text>
        </View>

        {/* CONTEXT */}

        <View style={styles.contextChip}>
          <Text style={styles.contextText}>
            📍 {result?.City || city || "—"},{" "}
            {result?.District || district || "—"} • {season} •{" "}
            {TEXT[language].week} {cropWeek}
          </Text>
        </View>

        {/* RESULT GRID */}

        <View style={styles.grid}>
          {/* YIELD */}

          <View style={styles.resultBox}>
            <Leaf size={28} color="#36a852" />

            <Text style={styles.cardLabel}>
              {TEXT[language].predictedYield}
            </Text>

            <Text style={styles.cardValue}>
              {result?.Predicted_Yield ?? "—"}
            </Text>

            <Text style={styles.cardUnit}>{TEXT[language].kgHa}</Text>
          </View>

          {/* PRODUCTION */}

          <View style={styles.resultBox}>
            <Package size={28} color="#f28c28" />

            <Text style={styles.cardLabel}>
              {TEXT[language].expectedProduction}
            </Text>

            <Text style={styles.cardValue}>
              {result?.Expected_Production_tons ?? "—"}
            </Text>

            <Text style={styles.cardUnit}>{TEXT[language].tons}</Text>
          </View>

          {/* RISK */}

          <View style={styles.resultBox}>
            <ShieldCheck size={28} color="#3ca34b" />

            <Text style={styles.cardLabel}>{TEXT[language].riskLevel}</Text>

            <View style={[styles.riskBadge, getRiskStyle(result?.Risk_Level)]}>
              <Text style={styles.riskBadgeText}>
                {result?.Risk_Level || "—"}
              </Text>
            </View>
          </View>

          {/* CROP STAGE */}

          <View style={styles.resultBox}>
            <Sprout size={28} color="#5fbf3f" />

            <Text style={styles.cardLabel}>{TEXT[language].cropStage}</Text>

            <Text style={styles.cardValueSmall}>
              {result?.Crop_Stage || "—"}
            </Text>
          </View>
        </View>

        {/* RAIN FORECAST */}

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {TEXT[language].rainForecast}
            </Text>

            <Text style={styles.viewAll}>{TEXT[language].viewAll}</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {forecast.length > 0 ? (
              forecast.map((day, index) => (
                <View
                  key={`${day?.date || "day"}-${index}`}
                  style={styles.forecastCard}
                >
                  <Text style={styles.forecastDay}>
                    {formatForecastDay(day?.date)}
                  </Text>

                  <Text style={styles.forecastDate}>
                    {day?.date ? String(day.date).slice(5) : "—"}
                  </Text>

                  <CloudRain size={26} color="#4aa3df" />

                  <Text style={styles.forecastRain}>
                    {day?.rain_mm ?? "—"} mm
                  </Text>

                  <Text style={styles.forecastTemp}>
                    {day?.temp_max ?? "—"}° / {day?.temp_min ?? "—"}°
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No rain forecast available.</Text>
            )}
          </ScrollView>
        </View>

        {/* ADVISORY */}

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {TEXT[language].advisorySummary}
            </Text>

            <BarChart3 size={22} color="#2e7d32" />
          </View>

          {advisorySections.length > 0 ? (
            advisorySections.map((item, index) => (
              <View key={index} style={styles.adviceMiniCard}>
                <Text style={styles.adviceMiniTitle}>{item.title}</Text>

                <Text style={styles.adviceMiniText}>{item.text}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>
              No advisory information available.
            </Text>
          )}
        </View>

        {/* NEW PREDICTION */}

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => {
            setShowResult(false);
            setResult(null);
          }}
        >
          <Text style={styles.secondaryButtonText}>
            {TEXT[language].makeNew}
          </Text>
        </TouchableOpacity>
      </>
    );
  };

  // --------------------------------------------------
  // MAIN RETURN
  // --------------------------------------------------

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {!showResult ? renderInputScreen() : renderResultScreen()}
    </ScrollView>
  );
}

// ======================================================
// HELPER FUNCTIONS
// ======================================================

function getDisplayAdvisory(result, language) {
  if (!result) {
    return "";
  }

  if (language === "si") {
    return result.Advisory_Sinhala || result.Advisory || "";
  }

  return result.Advisory_English || result.Advisory || "";
}

function cleanMarkdown(text) {
  if (!text || typeof text !== "string") {
    return "";
  }

  return text.replace(/\*\*/g, "").replace(/###/g, "").trim();
}

function splitAdvisory(text) {
  const clean = cleanMarkdown(text);

  if (!clean) {
    return [];
  }

  const sections = clean
    .split(/\n\s*\n/)
    .map((section) => section.trim())
    .filter(Boolean);

  if (sections.length <= 1) {
    return [
      {
        title: "💡 Advisory",
        text: clean,
      },
    ];
  }

  return sections.map((section) => {
    const lines = section
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const title = lines[0] || "Advice";

    const body = lines.slice(1).join(" ");

    return {
      title,
      text: body || title,
    };
  });
}

function getRiskStyle(riskLevel) {
  if (!riskLevel) {
    return styles.mediumRisk;
  }

  const risk = String(riskLevel).toLowerCase();

  if (risk.includes("low")) {
    return styles.lowRisk;
  }

  if (risk.includes("medium")) {
    return styles.mediumRisk;
  }

  if (risk.includes("high")) {
    return styles.highRisk;
  }

  return styles.mediumRisk;
}

function formatForecastDay(date) {
  if (!date) {
    return "—";
  }

  try {
    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
      return "—";
    }

    return parsed.toLocaleDateString("en-US", {
      weekday: "short",
    });
  } catch (error) {
    return "—";
  }
}

// ======================================================
// STYLES
// ======================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f4f7f5",
    paddingHorizontal: 18,
  },

  contentContainer: {
    paddingTop: 6,
    paddingBottom: 30,
  },

  topbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
    marginBottom: 18,
  },

  pageTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1f2b22",
  },

  langTabs: {
    flexDirection: "row",
    backgroundColor: "#e9eeee",
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },

  langActive: {
    flex: 1,
    backgroundColor: "#2e8b45",
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: "center",
  },

  langInactive: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: "center",
  },

  langActiveText: {
    color: "#fff",
    fontWeight: "700",
  },

  langInactiveText: {
    color: "#222",
    fontWeight: "700",
  },

  formCard: {
    backgroundColor: "#fff",
    padding: 18,
    borderRadius: 18,
    marginBottom: 30,
    elevation: 2,
  },

  label: {
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 8,
    marginTop: 10,
    color: "#111",
  },

  pickerBox: {
    backgroundColor: "#eeeeee",
    borderRadius: 11,
    overflow: "hidden",
    minHeight: 50,
    justifyContent: "center",
  },

  input: {
    backgroundColor: "#eeeeee",
    height: 50,
    borderRadius: 11,
    paddingHorizontal: 14,
    fontSize: 16,
    color: "#222",
  },

  button: {
    height: 56,
    backgroundColor: "#2e842f",
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 22,
  },

  buttonDisabled: {
    opacity: 0.7,
  },

  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },

  hero: {
    backgroundColor: "#13813b",
    borderRadius: 18,
    padding: 18,
    minHeight: 125,
    marginBottom: 16,
    overflow: "hidden",
  },

  heroTitle: {
    fontSize: 23,
    color: "#fff",
    fontWeight: "900",
    lineHeight: 30,
  },

  heroSub: {
    color: "#e4f7e9",
    marginTop: 8,
    fontSize: 14,
  },

  heroIcon: {
    position: "absolute",
    right: 16,
    bottom: 10,
    fontSize: 64,
    opacity: 0.8,
  },

  contextChip: {
    backgroundColor: "#e8f5e9",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginBottom: 16,
    alignSelf: "flex-start",
  },

  contextText: {
    color: "#1b5e20",
    fontWeight: "800",
    fontSize: 13,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 8,
  },

  resultBox: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 15,
    minHeight: 128,
    marginBottom: 12,
    elevation: 2,
  },

  cardLabel: {
    color: "#333",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 8,
  },

  cardValue: {
    fontSize: 25,
    fontWeight: "900",
    color: "#111",
    marginTop: 6,
  },

  cardValueSmall: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111",
    marginTop: 6,
  },

  cardUnit: {
    fontSize: 13,
    color: "#666",
  },

  sectionCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#111",
    marginBottom: 12,
  },

  viewAll: {
    color: "#2e7d32",
    fontWeight: "700",
    fontSize: 13,
  },

  forecastCard: {
    backgroundColor: "#f5faf6",
    borderRadius: 14,
    padding: 10,
    width: 86,
    alignItems: "center",
    marginRight: 10,
  },

  forecastDay: {
    fontSize: 13,
    fontWeight: "800",
    color: "#222",
  },

  forecastDate: {
    fontSize: 12,
    color: "#555",
    marginTop: 5,
    marginBottom: 5,
  },

  forecastRain: {
    fontSize: 14,
    fontWeight: "900",
    marginTop: 6,
  },

  forecastTemp: {
    fontSize: 11,
    color: "#666",
    marginTop: 4,
  },

  contextText: {
    color: "#1b5e20",
    fontWeight: "800",
    fontSize: 13,
  },

  adviceMiniCard: {
    backgroundColor: "#f6faf7",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#2e8b45",
  },

  adviceMiniTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#1f5f2d",
    marginBottom: 6,
  },

  adviceMiniText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#333",
  },

  secondaryButton: {
    height: 54,
    backgroundColor: "#1f7a32",
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 30,
  },

  secondaryButtonText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 15,
  },

  riskBadge: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    alignSelf: "flex-start",
    marginTop: 10,
  },

  riskBadgeText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 13,
  },

  lowRisk: {
    backgroundColor: "#2e8b45",
  },

  mediumRisk: {
    backgroundColor: "#f39c12",
  },

  highRisk: {
    backgroundColor: "#d63031",
  },

  emptyText: {
    color: "#777",
    fontSize: 14,
    paddingVertical: 10,
  },
});
