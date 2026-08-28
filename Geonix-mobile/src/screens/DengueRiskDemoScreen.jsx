import React, { useMemo, useRef, useState, useEffect } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Image,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import MapView, { Marker, Polygon } from "react-native-maps";
import { fetchDengueMap } from "../components/features/dengue/dengueApi";

const DEFAULT_CENTER = { latitude: 6.9147, longitude: 79.8737 };

// 13 Sri Lankan divisions fallback metadata
const DIVISION_FALLBACKS = [
  {
    area_id: "colombo",
    area_name: "Colombo",
    base_score: 0.55,
    center: { latitude: 6.9271, longitude: 79.8612 },
    polygon: [
      { latitude: 6.942, longitude: 79.846 },
      { latitude: 6.942, longitude: 79.876 },
      { latitude: 6.912, longitude: 79.876 },
      { latitude: 6.912, longitude: 79.846 },
    ],
  },
  {
    area_id: "dehiwala",
    area_name: "Dehiwala",
    base_score: 0.42,
    center: { latitude: 6.8480, longitude: 79.8883 },
    polygon: [
      { latitude: 6.860, longitude: 79.876 },
      { latitude: 6.860, longitude: 79.900 },
      { latitude: 6.836, longitude: 79.900 },
      { latitude: 6.836, longitude: 79.876 },
    ],
  },
  {
    area_id: "homagama",
    area_name: "Homagama",
    base_score: 0.18,
    center: { latitude: 6.8402, longitude: 79.9984 },
    polygon: [
      { latitude: 6.865, longitude: 79.973 },
      { latitude: 6.865, longitude: 80.023 },
      { latitude: 6.815, longitude: 80.023 },
      { latitude: 6.815, longitude: 79.973 },
    ],
  },
  {
    area_id: "kaduwela",
    area_name: "Kaduwela",
    base_score: 0.45,
    center: { latitude: 6.9271, longitude: 79.9832 },
    polygon: [
      { latitude: 6.949, longitude: 79.961 },
      { latitude: 6.949, longitude: 80.005 },
      { latitude: 6.905, longitude: 80.005 },
      { latitude: 6.905, longitude: 79.961 },
    ],
  },
  {
    area_id: "kesbewa",
    area_name: "Kesbewa",
    base_score: 0.32,
    center: { latitude: 6.7917, longitude: 79.9513 },
    polygon: [
      { latitude: 6.811, longitude: 79.931 },
      { latitude: 6.811, longitude: 79.971 },
      { latitude: 6.771, longitude: 79.971 },
      { latitude: 6.771, longitude: 79.931 },
    ],
  },
  {
    area_id: "kolonnawa",
    area_name: "Kolonnawa",
    base_score: 0.72,
    center: { latitude: 6.9271, longitude: 79.8974 },
    polygon: [
      { latitude: 6.939, longitude: 79.885 },
      { latitude: 6.939, longitude: 79.909 },
      { latitude: 6.915, longitude: 79.909 },
      { latitude: 6.915, longitude: 79.885 },
    ],
  },
  {
    area_id: "maharagama",
    area_name: "Maharagama",
    base_score: 0.38,
    center: { latitude: 6.8483, longitude: 79.9265 },
    polygon: [
      { latitude: 6.864, longitude: 79.910 },
      { latitude: 6.864, longitude: 79.942 },
      { latitude: 6.832, longitude: 79.942 },
      { latitude: 6.832, longitude: 79.910 },
    ],
  },
  {
    area_id: "moratuwa",
    area_name: "Moratuwa",
    base_score: 0.52,
    center: { latitude: 6.7730, longitude: 79.8816 },
    polygon: [
      { latitude: 6.791, longitude: 79.863 },
      { latitude: 6.791, longitude: 79.900 },
      { latitude: 6.755, longitude: 79.900 },
      { latitude: 6.755, longitude: 79.863 },
    ],
  },
  {
    area_id: "padukka",
    area_name: "Padukka",
    base_score: 0.12,
    center: { latitude: 6.8441, longitude: 80.1264 },
    polygon: [
      { latitude: 6.872, longitude: 80.098 },
      { latitude: 6.872, longitude: 80.154 },
      { latitude: 6.816, longitude: 80.154 },
      { latitude: 6.816, longitude: 80.098 },
    ],
  },
  {
    area_id: "ratmalana",
    area_name: "Ratmalana",
    base_score: 0.35,
    center: { latitude: 6.8192, longitude: 79.8911 },
    polygon: [
      { latitude: 6.831, longitude: 79.879 },
      { latitude: 6.831, longitude: 79.903 },
      { latitude: 6.807, longitude: 79.903 },
      { latitude: 6.807, longitude: 79.879 },
    ],
  },
  {
    area_id: "seethawaka",
    area_name: "Seethawaka",
    base_score: 0.16,
    center: { latitude: 6.9519, longitude: 80.1782 },
    polygon: [
      { latitude: 6.981, longitude: 80.148 },
      { latitude: 6.981, longitude: 80.208 },
      { latitude: 6.921, longitude: 80.208 },
      { latitude: 6.921, longitude: 80.148 },
    ],
  },
  {
    area_id: "sri_jayawardenepura_kotte",
    area_name: "Sri Jayawardenepura Kotte",
    base_score: 0.48,
    center: { latitude: 6.9010, longitude: 79.9077 },
    polygon: [
      { latitude: 6.915, longitude: 79.893 },
      { latitude: 6.915, longitude: 79.921 },
      { latitude: 6.887, longitude: 79.921 },
      { latitude: 6.887, longitude: 79.893 },
    ],
  },
  {
    area_id: "thimbirigasyaya",
    area_name: "Thimbirigasyaya",
    base_score: 0.65,
    center: { latitude: 6.8962, longitude: 79.8686 },
    polygon: [
      { latitude: 6.910, longitude: 79.854 },
      { latitude: 6.910, longitude: 79.882 },
      { latitude: 6.882, longitude: 79.882 },
      { latitude: 6.882, longitude: 79.854 },
    ],
  },
];

const PRESETS = [
  { label: "☀️ Dry Season", temp: 32, humidity: 45, rain: 0, rain7: 5, cases: 10, trend: "Decreasing", breeding: 0.15 },
  { label: "🌧️ Monsoon Start", temp: 28, humidity: 75, rain: 20, rain7: 55, cases: 25, trend: "Stable", breeding: 0.55 },
  { label: "⛈️ Vector Epidemic", temp: 27, humidity: 95, rain: 55, rain7: 140, cases: 90, trend: "Increasing", breeding: 0.90 },
];

const MAP_TYPES = [
  { type: "standard", icon: "map-outline", label: "Map" },
  { type: "satellite", icon: "satellite-variant", label: "Satellite" },
  { type: "hybrid", icon: "layers-outline", label: "Hybrid" },
];

const C = {
  bg: "#0D1117",
  surface: "#1C2128",
  surfaceHi: "#262C36",
  border: "#30363D",
  text: "#F0F6FC",
  sub: "#8B949E",
  amber: "#F0A500",
  amberDim: "#7A5200",
  high: "#FF3B30",
  highBg: "rgba(255, 59, 48, 0.15)",
  moderate: "#FF9500",
  moderateBg: "rgba(255, 149, 0, 0.15)",
  low: "#34C759",
  lowBg: "rgba(52, 199, 89, 0.15)",
};

function getRiskConfig(score) {
  if (score >= 0.65) {
    return {
      level: "high",
      color: C.high,
      bg: C.highBg,
      fill: "rgba(255, 59, 48, 0.24)",
      stroke: "rgba(255, 59, 48, 0.85)",
      label: "High Risk 🔴",
    };
  }
  if (score >= 0.38) {
    return {
      level: "middle",
      color: C.moderate,
      bg: C.moderateBg,
      fill: "rgba(255, 149, 0, 0.22)",
      stroke: "rgba(255, 149, 0, 0.85)",
      label: "Moderate Risk 🟠",
    };
  }
  return {
    level: "low",
    color: C.low,
    bg: C.lowBg,
    fill: "rgba(52, 199, 89, 0.18)",
    stroke: "rgba(52, 199, 89, 0.85)",
    label: "Low Risk 🟢",
  };
}

export default function DengueRiskDemoScreen() {
  const mapRef = useRef(null);
  
  // Real-time fetched areas or fallbacks
  const [areas, setAreas] = useState(DIVISION_FALLBACKS);
  const [selectedAreaId, setSelectedAreaId] = useState("colombo");
  const [mapType, setMapType] = useState("hybrid");
  const [showAreaModal, setShowAreaModal] = useState(false);

  // 6 Interactive simulator variables
  const [temp, setTemp] = useState(28);
  const [humidity, setHumidity] = useState(80);
  const [rain, setRain] = useState(15);
  const [rain7, setRain7] = useState(45);
  const [recentCases, setRecentCases] = useState(45);
  const [caseTrend, setCaseTrend] = useState("Increasing");
  const [breedingIndex, setBreedingIndex] = useState(0.85);

  // Load divisions from backend if available
  useEffect(() => {
    let active = true;
    fetchDengueMap()
      .then((data) => {
        if (active && Array.isArray(data) && data.length > 0) {
          const mapped = data.map((a, idx) => {
            const baseScore = DIVISION_FALLBACKS.find((f) => f.area_id === a.area_id)?.base_score || 0.40;
            return {
              area_id: a.area_id,
              area_name: a.area_name,
              base_score: baseScore,
              center: {
                latitude: a.center?.latitude || DEFAULT_CENTER.latitude,
                longitude: a.center?.longitude || DEFAULT_CENTER.longitude,
              },
              polygon: a.polygon.map((p) => ({
                latitude: p.latitude,
                longitude: p.longitude,
              })),
            };
          });
          setAreas(mapped);
        }
      })
      .catch((err) => {
        console.warn("Could not load real divisions map. Using fallbacks.", err);
      });
    return () => {
      active = false;
    };
  }, []);

  const selectedArea = useMemo(() => {
    return areas.find((a) => a.area_id === selectedAreaId) || areas[0];
  }, [areas, selectedAreaId]);

  // Recenter map on area selection change
  useEffect(() => {
    if (selectedArea && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: selectedArea.center.latitude,
        longitude: selectedArea.center.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }, 800);
    }
  }, [selectedArea]);

  // Calculate live dynamic risk scores per ward based on interactive controls
  const simulatedWards = useMemo(() => {
    return areas.map((ward) => {
      // If this is the selected ward, use our precise simulator inputs
      const isSelf = ward.area_id === selectedAreaId;
      
      const tVal = isSelf ? temp : 28;
      const hVal = isSelf ? humidity : 75;
      const rVal = isSelf ? rain : 10;
      const r7Val = isSelf ? rain7 : 35;
      const cVal = isSelf ? recentCases : 30;
      const trVal = isSelf ? caseTrend : "Stable";
      const bVal = isSelf ? breedingIndex : 0.60;

      // 1. Temperature suitability (Peak vector speed between 25-30°C)
      let tempFactor = 0;
      if (tVal >= 25 && tVal <= 30) {
        tempFactor = 0.18;
      } else if (tVal > 30) {
        tempFactor = 0.06;
      }

      // 2. Humidity impact (>75% extends mosquito survival window)
      const humFactor = (hVal - 50) * 0.0045;

      // 3. Stagnant water accumulation (Rain today & rain avg)
      const rainFactor = Math.min(0.22, rVal * 0.005 + r7Val * 0.0018);

      // 4. Historical reservoir (Recent case loads)
      const casesFactor = Math.min(0.24, cVal * 0.0028);

      // 5. Growth trajectory
      let trendFactor = 0.0;
      if (trVal === "Increasing") {
        trendFactor = 0.12;
      } else if (trVal === "Decreasing") {
        trendFactor = -0.06;
      }

      // 6. Local Stagnation / Breeding index
      const breedingFactor = bVal * 0.16;

      const calculatedScore = Math.min(
        0.98,
        Math.max(0.05, ward.base_score + tempFactor + humFactor + rainFactor + casesFactor + trendFactor + breedingFactor)
      );

      const config = getRiskConfig(calculatedScore);
      return {
        ...ward,
        score: calculatedScore,
        config,
      };
    });
  }, [areas, selectedAreaId, temp, humidity, rain, rain7, recentCases, caseTrend, breedingIndex]);

  const activeSimulatedWard = useMemo(() => {
    return simulatedWards.find((w) => w.area_id === selectedAreaId) || simulatedWards[0];
  }, [simulatedWards, selectedAreaId]);

  const highRiskCount = useMemo(
    () => simulatedWards.filter((w) => w.config.level === "high").length,
    [simulatedWards],
  );

  const avgRiskScore = useMemo(() => {
    const total = simulatedWards.reduce((sum, w) => sum + w.score, 0);
    return Math.round((total / simulatedWards.length) * 100);
  }, [simulatedWards]);

  const applyPreset = (p) => {
    setTemp(p.temp);
    setHumidity(p.humidity);
    setRain(p.rain);
    setRain7(p.rain7);
    setRecentCases(p.cases);
    setCaseTrend(p.trend);
    setBreedingIndex(p.breeding);
  };

  const adjustValue = (setter, val, delta, min, max) => {
    const next = Math.min(max, Math.max(min, val + delta));
    // Support decimal values for breeding index
    if (min === 0 && max === 1) {
      setter(Number(next.toFixed(2)));
    } else {
      setter(Math.round(next));
    }
  };

  // Simulated AI explanation dynamically built for Viva presentations
  const simulatedExplanation = useMemo(() => {
    const level = activeSimulatedWard.config.label.replace(/🟢|🟠|🔴/g, "").trim();
    let text = `The simulated model classifies ${activeSimulatedWard.area_name} at ${level} (${Math.round(activeSimulatedWard.score * 100)}%). `;
    
    if (temp >= 25 && temp <= 30) {
      text += `A highly suitable temperature of ${temp}°C accelerates mosquito larvae replication cycles. `;
    } else {
      text += `The temperature of ${temp}°C is outside the optimal breeding range, slightly restricting vector speed. `;
    }

    if (humidity >= 75) {
      text += `High relative humidity (${humidity}%) prolongs vector feeding longevity, enhancing risk. `;
    }

    if (rain >= 30 || rain7 >= 80) {
      text += `Heavy rainfall accumulation (${rain}mm today) amplifies stagnant pools of water. `;
    }

    if (breedingIndex >= 0.70) {
      text += `A breeding site index of ${Math.round(breedingIndex * 100)}% flags critical local standing water breeding suitability. `;
    }

    if (recentCases >= 50 && caseTrend === "Increasing") {
      text += `An increasing trend over ${recentCases} recent cases signals rapid virus amplification within the community reservoir.`;
    } else if (caseTrend === "Decreasing") {
      text += `A decreasing case trend indicates vector control measures are stabilizing new cases.`;
    }

    return text;
  }, [activeSimulatedWard, temp, humidity, rain, rain7, recentCases, caseTrend, breedingIndex]);

  return (
    <View style={styles.screenContainer}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        
        {/* SIMULATOR TITLE BANNER */}
        <View style={styles.headerCard}>
          <View style={styles.headerIconWrap}>
            <MaterialCommunityIcons name="flask" size={24} color={C.amber} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Dengue Risk Simulator</Text>
            <Text style={styles.headerSub}>
              Adjust climate and breeding indicators to analyze spatial risk outputs.
            </Text>
          </View>
        </View>

        {/* 1. AREA SELECTOR HERO CARD */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>1. Select Simulation Area</Text>
          <Pressable style={styles.selectorBtn} onPress={() => setShowAreaModal(true)}>
            <MaterialCommunityIcons name="map-marker-radius" size={18} color={C.amber} />
            <Text style={styles.selectorBtnText}>{selectedArea.area_name}</Text>
            <MaterialCommunityIcons name="chevron-down" size={18} color={C.sub} />
          </Pressable>
          <Text style={styles.hintText}>
            Base ward vulnerability: <Text style={{ color: C.amber }}>{(selectedArea.base_score * 100).toFixed(0)}% score</Text>. Custom adjustments will apply to this area.
          </Text>
        </View>

        {/* 2. PRESETS */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>2. Choose Outbreak Scenario Preset</Text>
          <View style={styles.presetRow}>
            {PRESETS.map((p) => {
              const isActive =
                temp === p.temp &&
                humidity === p.humidity &&
                rain === p.rain &&
                recentCases === p.cases &&
                caseTrend === p.trend;
              return (
                <Pressable
                  key={p.label}
                  style={[styles.presetChip, isActive && styles.presetChipActive]}
                  onPress={() => applyPreset(p)}
                >
                  <Text style={[styles.presetChipText, isActive && styles.presetChipTextActive]}>
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 3. SIMULATOR PARAMETERS PANEL */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>3. Fine-Tune Parameter Adjustments</Text>
          
          <View style={styles.paramGrid}>
            {/* Temperature */}
            <View style={styles.paramCard}>
              <View style={styles.paramHeader}>
                <MaterialCommunityIcons name="thermometer" size={15} color={C.amber} />
                <Text style={styles.paramLabel}>Temperature (°C)</Text>
              </View>
              <Text style={styles.paramValueText}>{temp}°C</Text>
              <View style={styles.paramControlRow}>
                <Pressable style={styles.stepBtn} onPress={() => adjustValue(setTemp, temp, -1, 15, 45)}>
                  <Text style={styles.stepBtnText}>-</Text>
                </Pressable>
                <Text style={styles.paramIndicatorLabel}>
                  {temp >= 25 && temp <= 30 ? "🔥 Peak Vector Speed" : "Slow Speed"}
                </Text>
                <Pressable style={styles.stepBtn} onPress={() => adjustValue(setTemp, temp, 1, 15, 45)}>
                  <Text style={styles.stepBtnText}>+</Text>
                </Pressable>
              </View>
            </View>

            {/* Humidity */}
            <View style={styles.paramCard}>
              <View style={styles.paramHeader}>
                <MaterialCommunityIcons name="water-percent" size={15} color={C.amber} />
                <Text style={styles.paramLabel}>Humidity (%)</Text>
              </View>
              <Text style={styles.paramValueText}>{humidity}%</Text>
              <View style={styles.paramControlRow}>
                <Pressable style={styles.stepBtn} onPress={() => adjustValue(setHumidity, humidity, -5, 20, 100)}>
                  <Text style={styles.stepBtnText}>-</Text>
                </Pressable>
                <Text style={styles.paramIndicatorLabel}>
                  {humidity >= 75 ? "💧 High Survival" : "Low Survival"}
                </Text>
                <Pressable style={styles.stepBtn} onPress={() => adjustValue(setHumidity, humidity, 5, 20, 100)}>
                  <Text style={styles.stepBtnText}>+</Text>
                </Pressable>
              </View>
            </View>

            {/* Rain Today */}
            <View style={styles.paramCard}>
              <View style={styles.paramHeader}>
                <MaterialCommunityIcons name="weather-rainy" size={15} color={C.amber} />
                <Text style={styles.paramLabel}>Rain Today (mm)</Text>
              </View>
              <Text style={styles.paramValueText}>{rain} mm</Text>
              <View style={styles.paramControlRow}>
                <Pressable style={styles.stepBtn} onPress={() => adjustValue(setRain, rain, -5, 0, 150)}>
                  <Text style={styles.stepBtnText}>-</Text>
                </Pressable>
                <Text style={styles.paramIndicatorLabel}>
                  {rain >= 30 ? "⛈️ Stagnant Pooling" : "Mild Accumulation"}
                </Text>
                <Pressable style={styles.stepBtn} onPress={() => adjustValue(setRain, rain, 5, 0, 150)}>
                  <Text style={styles.stepBtnText}>+</Text>
                </Pressable>
              </View>
            </View>

            {/* 7-Day Accumulated Rain */}
            <View style={styles.paramCard}>
              <View style={styles.paramHeader}>
                <MaterialCommunityIcons name="calendar-multiselect" size={15} color={C.amber} />
                <Text style={styles.paramLabel}>7-Day Rain (mm)</Text>
              </View>
              <Text style={styles.paramValueText}>{rain7} mm</Text>
              <View style={styles.paramControlRow}>
                <Pressable style={styles.stepBtn} onPress={() => adjustValue(setRain7, rain7, -10, 0, 300)}>
                  <Text style={styles.stepBtnText}>-</Text>
                </Pressable>
                <Text style={styles.paramIndicatorLabel}>
                  {rain7 >= 100 ? "🌊 Saturated Soil" : "Dry Ground"}
                </Text>
                <Pressable style={styles.stepBtn} onPress={() => adjustValue(setRain7, rain7, 10, 0, 300)}>
                  <Text style={styles.stepBtnText}>+</Text>
                </Pressable>
              </View>
            </View>

            {/* Recent Dengue Cases */}
            <View style={styles.paramCard}>
              <View style={styles.paramHeader}>
                <MaterialCommunityIcons name="bug-outline" size={15} color={C.amber} />
                <Text style={styles.paramLabel}>Recent Cases</Text>
              </View>
              <Text style={styles.paramValueText}>{recentCases} cases</Text>
              <View style={styles.paramControlRow}>
                <Pressable style={styles.stepBtn} onPress={() => adjustValue(setRecentCases, recentCases, -5, 0, 200)}>
                  <Text style={styles.stepBtnText}>-</Text>
                </Pressable>
                <Text style={styles.paramIndicatorLabel}>
                  {recentCases >= 50 ? "☣️ High Reservoir" : "Low Reservoir"}
                </Text>
                <Pressable style={styles.stepBtn} onPress={() => adjustValue(setRecentCases, recentCases, 5, 0, 200)}>
                  <Text style={styles.stepBtnText}>+</Text>
                </Pressable>
              </View>
            </View>

            {/* Water Stagnation / Breeding index */}
            <View style={styles.paramCard}>
              <View style={styles.paramHeader}>
                <MaterialCommunityIcons name="cup-water" size={15} color={C.amber} />
                <Text style={styles.paramLabel}>Breeding Index</Text>
              </View>
              <Text style={styles.paramValueText}>{Math.round(breedingIndex * 100)}%</Text>
              <View style={styles.paramControlRow}>
                <Pressable style={styles.stepBtn} onPress={() => adjustValue(setBreedingIndex, breedingIndex, -0.05, 0, 1)}>
                  <Text style={styles.stepBtnText}>-</Text>
                </Pressable>
                <Text style={styles.paramIndicatorLabel}>
                  {breedingIndex >= 0.70 ? "🦟 Heavy Breeding" : "Low Breeding"}
                </Text>
                <Pressable style={styles.stepBtn} onPress={() => adjustValue(setBreedingIndex, breedingIndex, 0.05, 0, 1)}>
                  <Text style={styles.stepBtnText}>+</Text>
                </Pressable>
              </View>
            </View>
          </View>

          {/* Case Growth Trend Toggle */}
          <Text style={[styles.paramLabel, { marginTop: 14, marginBottom: 6 }]}>Case Growth / Trend</Text>
          <View style={styles.trendRow}>
            {["Decreasing", "Stable", "Increasing"].map((t) => (
              <Pressable
                key={t}
                style={[styles.trendBtn, caseTrend === t && styles.trendBtnActive]}
                onPress={() => setCaseTrend(t)}
              >
                <MaterialCommunityIcons
                  name={t === "Increasing" ? "trending-up" : t === "Decreasing" ? "trending-down" : "trending-neutral"}
                  size={14}
                  color={caseTrend === t ? C.amber : C.sub}
                />
                <Text style={[styles.trendBtnText, caseTrend === t && styles.trendBtnTextActive]}>{t}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* 4. REAL-TIME THREAT METRICS */}
        <View style={[styles.heroCard, { borderLeftColor: activeSimulatedWard.config.color }]}>
          {/* Transparent Mosquito Watermark */}
          <View style={styles.watermarkContainer}>
            <Image
              source={require("../../assets/mosquito.png")}
              style={styles.watermarkImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.cardSectionTitle}>4. Active Simulation Dashboard</Text>
          <View style={styles.summaryBar}>
            <View style={styles.summaryStatItem}>
              <Text style={[styles.summaryStatValue, { color: activeSimulatedWard.config.color }]}>
                {Math.round(activeSimulatedWard.score * 100)}%
              </Text>
              <Text style={styles.summaryStatLabel}>Risk Score</Text>
            </View>
            <View style={styles.summaryStatDivider} />
            <View style={styles.summaryStatItem}>
              <Text style={[styles.summaryStatValue, { color: activeSimulatedWard.config.color }]}>
                {activeSimulatedWard.config.label.split(" ")[0]}
              </Text>
              <Text style={styles.summaryStatLabel}>Threat Level</Text>
            </View>
            <View style={styles.summaryStatDivider} />
            <View style={styles.summaryStatItem}>
              <Text style={[styles.summaryStatValue, { color: temp >= 25 && humidity >= 75 ? C.high : C.low }]}>
                {temp >= 25 && humidity >= 75 ? "SURGE" : "STABLE"}
              </Text>
              <Text style={styles.summaryStatLabel}>Vector Status</Text>
            </View>
          </View>

          {/* SIMULATION EXPLANATION BOX */}
          <View style={styles.explanationBox}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <MaterialCommunityIcons name="robot-outline" size={14} color={C.amber} />
              <Text style={styles.explanationTitle}>Simulated Model Explanation:</Text>
            </View>
            <Text style={styles.explanationText}>{simulatedExplanation}</Text>
          </View>
        </View>

        {/* 5. INTERACTIVE MAP VIEW */}
        <View style={styles.mapCard}>
          <View style={styles.mapHeaderRow}>
            <Text style={styles.cardSectionTitle}>5. Spatial Outbreak Risk Map</Text>
            <View style={styles.mapTypeRow}>
              {MAP_TYPES.map((opt) => {
                const active = mapType === opt.type;
                return (
                  <Pressable
                    key={opt.type}
                    style={[styles.mapTypeBtn, active && styles.mapTypeBtnActive]}
                    onPress={() => setMapType(opt.type)}
                  >
                    <Text style={[styles.mapTypeBtnText, active && styles.mapTypeBtnTextActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.mapContainer}>
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={{
                latitude: selectedArea.center.latitude,
                longitude: selectedArea.center.longitude,
                latitudeDelta: 0.08,
                longitudeDelta: 0.08,
              }}
              mapType={mapType}
            >
              {/* Simulated Wards Polygons */}
              {simulatedWards.map((ward) => (
                <Polygon
                  key={ward.area_id}
                  coordinates={ward.polygon}
                  fillColor={ward.config.fill}
                  strokeColor={ward.area_id === selectedAreaId ? "#FFFFFF" : ward.config.stroke}
                  strokeWidth={ward.area_id === selectedAreaId ? 3.0 : 1.5}
                />
              ))}

              {/* Simulated Wards Markers */}
              {simulatedWards.map((ward) => (
                <Marker
                  key={`${ward.area_id}-marker`}
                  coordinate={ward.center}
                  title={ward.area_name}
                  description={`Simulated Risk: ${Math.round(ward.score * 100)}%`}
                  onPress={() => setSelectedAreaId(ward.area_id)}
                >
                  <View
                    style={[
                      styles.markerBadge,
                      { backgroundColor: ward.config.color },
                      ward.area_id === selectedAreaId && { borderWidth: 2, borderColor: "#FFFFFF" },
                    ]}
                  >
                    <Text style={styles.markerBadgeText}>{Math.round(ward.score * 100)}%</Text>
                  </View>
                </Marker>
              ))}
            </MapView>
          </View>

          {/* SIMULATED SPATIAL THREAT LIST */}
          <View style={styles.wardBreakdown}>
            <Text style={styles.wardBreakdownTitle}>Spatial Wards Threat Summary:</Text>
            {simulatedWards.map((w) => {
              const isSelected = w.area_id === selectedAreaId;
              return (
                <Pressable
                  key={w.area_id}
                  style={[styles.wardRow, isSelected && styles.wardRowSelected]}
                  onPress={() => setSelectedAreaId(w.area_id)}
                >
                  <View style={[styles.wardDot, { backgroundColor: w.config.color }]} />
                  <Text style={[styles.wardName, isSelected && { fontWeight: "800", color: C.amber }]}>
                    {w.area_name} {isSelected && "(Selected)"}
                  </Text>
                  <Text style={[styles.wardScore, { color: w.config.color }]}>
                    {Math.round(w.score * 100)}%
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* SELECT DIVISION POPUP MODAL */}
      <Modal visible={showAreaModal} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Simulation Ward</Text>
              <Pressable onPress={() => setShowAreaModal(false)}>
                <MaterialCommunityIcons name="close" size={20} color={C.text} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.modalList}>
              {areas.map((a) => (
                <Pressable
                  key={a.area_id}
                  style={[styles.modalItem, selectedAreaId === a.area_id && styles.modalItemActive]}
                  onPress={() => {
                    setSelectedAreaId(a.area_id);
                    setShowAreaModal(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalItemText,
                      selectedAreaId === a.area_id && { color: C.amber, fontWeight: "800" },
                    ]}
                  >
                    {a.area_name}
                  </Text>
                  {selectedAreaId === a.area_id && (
                    <MaterialCommunityIcons name="check" size={16} color={C.amber} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: C.bg,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 14,
    paddingBottom: 40,
    gap: 14,
  },
  headerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  headerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.amberDim + "44",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.amber,
  },
  headerTitle: {
    color: C.text,
    fontSize: 15,
    fontWeight: "800",
  },
  headerSub: {
    color: C.sub,
    fontSize: 11,
    marginTop: 2,
    lineHeight: 16,
  },
  demoBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: C.amberDim + "66",
    borderWidth: 1,
    borderColor: C.amber,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  demoBadgeText: {
    fontSize: 8,
    color: C.amber,
    fontWeight: "900",
  },
  card: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  heroCard: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderLeftWidth: 4,
    borderRadius: 16,
    padding: 14,
    gap: 10,
    overflow: "hidden",
    position: "relative",
  },
  watermarkContainer: {
    position: "absolute",
    right: -15,
    bottom: -15,
  },
  watermarkImage: {
    width: 120,
    height: 120,
    opacity: 0.12,
  },
  cardSectionTitle: {
    color: C.text,
    fontSize: 13,
    fontWeight: "800",
  },
  selectorBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surfaceHi,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  selectorBtnText: {
    flex: 1,
    color: C.text,
    fontSize: 13,
    fontWeight: "700",
  },
  hintText: {
    color: C.sub,
    fontSize: 11,
    lineHeight: 16,
  },
  presetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2,
  },
  presetChip: {
    backgroundColor: C.surfaceHi,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  presetChipActive: {
    borderColor: C.amber,
    backgroundColor: C.amberDim + "44",
  },
  presetChipText: {
    color: C.sub,
    fontSize: 11,
    fontWeight: "700",
  },
  presetChipTextActive: {
    color: C.amber,
  },
  paramGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  paramCard: {
    width: "48%",
    backgroundColor: C.surfaceHi,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 10,
    gap: 6,
  },
  paramHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  paramLabel: {
    color: C.sub,
    fontSize: 10,
    fontWeight: "700",
  },
  paramValueText: {
    color: C.text,
    fontSize: 18,
    fontWeight: "900",
    marginVertical: 2,
  },
  paramControlRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stepBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnText: {
    color: C.amber,
    fontSize: 16,
    fontWeight: "900",
  },
  paramIndicatorLabel: {
    color: C.sub,
    fontSize: 8,
    fontWeight: "600",
    textAlign: "center",
    flex: 1,
  },
  trendRow: {
    flexDirection: "row",
    gap: 8,
  },
  trendBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: C.surfaceHi,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingVertical: 8,
  },
  trendBtnActive: {
    borderColor: C.amber,
    backgroundColor: C.amberDim + "33",
  },
  trendBtnText: {
    color: C.sub,
    fontSize: 10,
    fontWeight: "700",
  },
  trendBtnTextActive: {
    color: C.amber,
  },
  summaryBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surfaceHi,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 10,
  },
  summaryStatItem: {
    flex: 1,
    alignItems: "center",
  },
  summaryStatValue: {
    color: C.text,
    fontSize: 16,
    fontWeight: "900",
  },
  summaryStatLabel: {
    color: C.sub,
    fontSize: 9,
    fontWeight: "600",
    marginTop: 2,
  },
  summaryStatDivider: {
    width: 1,
    height: 22,
    backgroundColor: C.border,
  },
  explanationBox: {
    backgroundColor: C.surfaceHi,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 10,
    marginTop: 4,
  },
  explanationTitle: {
    color: C.amber,
    fontSize: 11,
    fontWeight: "800",
  },
  explanationText: {
    color: C.text,
    fontSize: 11,
    lineHeight: 16,
  },
  mapCard: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  mapHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  mapTypeRow: {
    flexDirection: "row",
    backgroundColor: C.surfaceHi,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
  },
  mapTypeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  mapTypeBtnActive: {
    backgroundColor: C.amberDim + "66",
  },
  mapTypeBtnText: {
    color: C.sub,
    fontSize: 9,
    fontWeight: "700",
  },
  mapTypeBtnTextActive: {
    color: C.amber,
  },
  mapContainer: {
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.border,
  },
  map: {
    width: "100%",
    height: 280,
  },
  markerBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FFFFFF",
    elevation: 3,
  },
  markerBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
  },
  wardBreakdown: {
    backgroundColor: C.surfaceHi,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 10,
    gap: 6,
  },
  wardBreakdownTitle: {
    color: C.sub,
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 2,
  },
  wardRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 8,
  },
  wardRowSelected: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  wardDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  wardName: {
    flex: 1,
    color: C.text,
    fontSize: 11,
    fontWeight: "600",
  },
  wardScore: {
    fontSize: 11,
    fontWeight: "800",
  },
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    maxHeight: "80%",
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  modalTitle: {
    color: C.text,
    fontSize: 15,
    fontWeight: "800",
  },
  modalList: {
    gap: 6,
  },
  modalItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.surfaceHi,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  modalItemActive: {
    borderColor: C.amber,
  },
  modalItemText: {
    color: C.text,
    fontSize: 12,
    fontWeight: "600",
  },
});
