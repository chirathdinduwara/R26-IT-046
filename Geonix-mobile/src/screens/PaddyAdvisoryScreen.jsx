import React, { useEffect, useRef, useState } from "react";
import { Alert, Animated, ScrollView, View } from "react-native";

import PaddyDashboard from "../components/paddy/PaddyDashboard";
import PaddyInputForm from "../components/paddy/PaddyInputForm";
import { PADDY_API_URL } from "../config/api";
import styles from "../styles/paddyStyles";

const TEXT = {
  en: {
    newPrediction: "New Prediction",
    paddyAdvisory: "Paddy Advisory",
    dashboardEyebrow: "SMART PADDY FIELD",
    dashboardTitle: "Paddy Field Dashboard",
    dashboardSubtitle: "Your field overview and smart recommendations",
    district: "District",
    city: "City / Area",
    season: "Season",
    yala: "Yala Season",
    maha: "Maha Season",
    farmSize: "Farm Size (Hectare)",
    cropWeek: "Crop Week",
    getPrediction: "Get Prediction",
    formSubtitle:
      "Enter your farm details for an accurate yield prediction and expert advice.",
    locationDetails: "Location Details",
    cultivationDetails: "Cultivation Details",
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
    farmSizeShort: "Farm size",
    basedOnConditions: "Based on current weather and historical conditions",
    currentCropStage: "Current crop stage",
    languageName: "English",
    weatherForecast: "7-Day Weather Forecast",
    swipeMore: "Swipe to see more",
    soilCondition: "Soil Condition",
    soilPH: "Soil pH",
    soilType: "Soil type",
    zone: "Zone",
    soilReaction: "Soil reaction",
    fertilizerRecommendation: "Fertilizer Recommendation",
    perHectare: "per hectare",
    forFarm: "for your farm",
    waterCondition: "Water condition",
    noAdvice: "No advisory information available.",
    priorityAction: "Priority action",
  },

  si: {
    newPrediction: "නව අනාවැකිය",
    paddyAdvisory: "වී වගා උපදේශනය",
    dashboardEyebrow: "ස්මාර්ට් වී වගාව",
    dashboardTitle: "වී වගා දත්ත පුවරුව",
    dashboardSubtitle: "ඔබේ වගාවේ තත්ත්වය සහ බුද්ධිමත් උපදෙස්",
    district: "දිස්ත්‍රික්කය",
    city: "නගරය / ප්‍රදේශය",
    season: "කන්නය",
    yala: "යල කන්නය",
    maha: "මහ කන්නය",
    farmSize: "ගොවිබිම් ප්‍රමාණය (හෙක්ටයාර්)",
    cropWeek: "වගා සතිය",
    getPrediction: "අනාවැකිය ලබාගන්න",
    formSubtitle:
      "නිවැරදි අස්වැන්න අනාවැකියක් සහ වගා උපදෙස් සඳහා ඔබේ ගොවිබිම් තොරතුරු ඇතුළත් කරන්න.",
    locationDetails: "ස්ථාන තොරතුරු",
    cultivationDetails: "වගා තොරතුරු",
    secureNote: "ඔබේ දත්ත අනාවැකිය සඳහා පමණක් ආරක්ෂිතව භාවිත කරයි.",
    whatYouGet: "ඔබට ලැබෙන දේ",
    yieldPrediction: "අස්වැන්න අනාවැකිය",
    riskAssessment: "අවදානම් තක්සේරුව",
    fertilizerAdvice: "පොහොර උපදෙස්",
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
    farmSizeShort: "ගොවිබිම් ප්‍රමාණය",
    basedOnConditions: "වත්මන් කාලගුණය සහ ඓතිහාසික දත්ත මත",
    currentCropStage: "වත්මන් වර්ධන අදියර",
    languageName: "සිංහල",
    weatherForecast: "දින 7 කාලගුණ අනාවැකිය",
    swipeMore: "තවත් බැලීමට ස්වයිප් කරන්න",
    soilCondition: "පසේ තත්ත්වය",
    soilPH: "පසේ pH අගය",
    soilType: "පස් වර්ගය",
    zone: "කෘෂි පාරිසරික කලාපය",
    soilReaction: "පසේ ප්‍රතික්‍රියාව",
    fertilizerRecommendation: "පොහොර නිර්දේශය",
    perHectare: "හෙක්ටයාරයකට",
    forFarm: "ඔබේ ගොවිබිම සඳහා",
    waterCondition: "ජල තත්ත්වය",
    noAdvice: "උපදේශන තොරතුරු නොමැත.",
    priorityAction: "ප්‍රමුඛ ක්‍රියාව",
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
  const [expandedAdvice, setExpandedAdvice] = useState(0);

  // Pure React Native pinch zoom. No Reanimated/NativeWorklets dependency.
  const dashboardScale = useRef(new Animated.Value(1)).current;
  const dashboardTranslateX = useRef(new Animated.Value(0)).current;
  const dashboardTranslateY = useRef(new Animated.Value(0)).current;
  const zoomState = useRef({
    scale: 1,
    translateX: 0,
    translateY: 0,
    startScale: 1,
    startTranslateX: 0,
    startTranslateY: 0,
    startDistance: 0,
    startCenterX: 0,
    startCenterY: 0,
    pinching: false,
  });

  const getTouchMetrics = (touches) => {
    if (!touches || touches.length < 2) return null;

    const first = touches[0];
    const second = touches[1];
    const deltaX = second.pageX - first.pageX;
    const deltaY = second.pageY - first.pageY;

    return {
      distance: Math.max(Math.hypot(deltaX, deltaY), 1),
      centerX: (first.pageX + second.pageX) / 2,
      centerY: (first.pageY + second.pageY) / 2,
    };
  };

  const beginDashboardPinch = (event) => {
    const metrics = getTouchMetrics(event.nativeEvent.touches);
    if (!metrics) return;

    const state = zoomState.current;
    state.pinching = true;
    state.startDistance = metrics.distance;
    state.startCenterX = metrics.centerX;
    state.startCenterY = metrics.centerY;
    state.startScale = state.scale;
    state.startTranslateX = state.translateX;
    state.startTranslateY = state.translateY;
  };

  const moveDashboardPinch = (event) => {
    const metrics = getTouchMetrics(event.nativeEvent.touches);
    const state = zoomState.current;

    if (!metrics || !state.pinching) return;

    const nextScale = Math.min(
      Math.max(state.startScale * (metrics.distance / state.startDistance), 1),
      2,
    );
    const nextTranslateX =
      state.startTranslateX + (metrics.centerX - state.startCenterX);
    const nextTranslateY =
      state.startTranslateY + (metrics.centerY - state.startCenterY);

    state.scale = nextScale;
    state.translateX = nextScale > 1 ? nextTranslateX : 0;
    state.translateY = nextScale > 1 ? nextTranslateY : 0;

    dashboardScale.setValue(state.scale);
    dashboardTranslateX.setValue(state.translateX);
    dashboardTranslateY.setValue(state.translateY);
  };

  const finishDashboardPinch = () => {
    const state = zoomState.current;
    state.pinching = false;

    if (state.scale <= 1.01) {
      resetDashboardZoom();
    }
  };

  const resetDashboardZoom = () => {
    const state = zoomState.current;
    state.scale = 1;
    state.translateX = 0;
    state.translateY = 0;
    state.pinching = false;

    Animated.parallel([
      Animated.spring(dashboardScale, {
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.spring(dashboardTranslateX, {
        toValue: 0,
        useNativeDriver: true,
      }),
      Animated.spring(dashboardTranslateY, {
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();
  };

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

  const handleNewPrediction = () => {
    resetDashboardZoom();
    setShowResult(false);
    setResult(null);
    setExpandedAdvice(0);
  };

  const text = TEXT[language];

  return (
    <View
      style={styles.zoomRoot}
      onMoveShouldSetResponderCapture={(event) =>
        showResult && event.nativeEvent.touches.length >= 2
      }
      onResponderGrant={beginDashboardPinch}
      onResponderMove={moveDashboardPinch}
      onResponderRelease={finishDashboardPinch}
      onResponderTerminate={finishDashboardPinch}
    >
      <Animated.View
        style={[
          styles.zoomCanvas,
          {
            transform: [
              { translateX: dashboardTranslateX },
              { translateY: dashboardTranslateY },
              { scale: dashboardScale },
            ],
          },
        ]}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {!showResult ? (
            <PaddyInputForm
              districts={districts}
              cities={cities}
              district={district}
              setDistrict={setDistrict}
              city={city}
              setCity={setCity}
              season={season}
              setSeason={setSeason}
              farmSize={farmSize}
              setFarmSize={setFarmSize}
              cropWeek={cropWeek}
              setCropWeek={setCropWeek}
              loading={loading}
              handlePredict={handlePredict}
              language={language}
              setLanguage={setLanguage}
              text={text}
              sinhalaLanguageName={TEXT.si.languageName}
            />
          ) : (
            <PaddyDashboard
              result={result}
              language={language}
              setLanguage={setLanguage}
              city={city}
              district={district}
              season={season}
              cropWeek={cropWeek}
              farmSize={farmSize}
              expandedAdvice={expandedAdvice}
              setExpandedAdvice={setExpandedAdvice}
              onNewPrediction={handleNewPrediction}
              text={text}
            />
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
