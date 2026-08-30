import React from "react";
import { Image, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  BarChart3,
  ChevronDown,
  ChevronUp,
  CloudRain,
  FlaskConical,
  Leaf,
  MapPin,
  Package,
  ShieldCheck,
  Sprout,
} from "lucide-react-native";

import paddyHero from "../../assets/paddy-hero.png";
import styles from "../../styles/paddyStyles";
import {
  formatForecastDay,
  formatNumber,
  getDisplayAdvisory,
  getFertilizerTheme,
  getLocalizedCropStage,
  getLocalizedRiskLabel,
  getRiskSummary,
  getRiskTheme,
  getSoilReaction,
  splitAdvisory,
} from "../../utils/paddyHelpers";

const ADVISORY_ICONS = [
  { icon: "leaf-outline", color: "#FFFFFF", backgroundColor: "#2EAD56" },
  { icon: "water-outline", color: "#FFFFFF", backgroundColor: "#168BC5" },
  { icon: "flask-outline", color: "#FFFFFF", backgroundColor: "#E5A400" },
  {
    icon: "shield-checkmark-outline",
    color: "#FFFFFF",
    backgroundColor: "#E65A0B",
  },
];

export default function PaddyDashboard({
  result,
  language,
  setLanguage,
  city,
  district,
  season,
  cropWeek,
  farmSize,
  expandedAdvice,
  setExpandedAdvice,
  onNewPrediction,
  text,
}) {
  const forecast = Array.isArray(result?.Seven_Day_Rain_Forecast)
    ? result.Seven_Day_Rain_Forecast
    : [];
  const advisorySections = splitAdvisory(getDisplayAdvisory(result, language));
  const predictedYield = formatNumber(result?.Predicted_Yield, 0);
  const expectedProduction = formatNumber(result?.Expected_Production_tons, 2);
  const fertilizer = result?.Recommended_Fertilizer || {};
  const resultFarmSize = Number(result?.Farm_Size_Hectare ?? farmSize);
  const soilPH = result?.Soil_pH;
  const soilReaction = getSoilReaction(soilPH, language);
  const riskTheme = getRiskTheme(result?.Risk_Level);
  const priorityAction =
    language === "si"
      ? result?.AI_Priority_Action_Sinhala
      : result?.AI_Priority_Action_English;

  return (
    <>
      <View style={styles.dashboardHeader}>
        <View style={styles.dashboardHeadingContent}>
          <View style={styles.dashboardPaddyIcon}>
            <Sprout size={23} color="#176d33" />
          </View>
          <View style={styles.dashboardHeadingText}>
            <Text style={styles.dashboardTitle} numberOfLines={2}>
              {text.dashboardTitle}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.dashboardLanguageButton}
          onPress={() => setLanguage(language === "en" ? "si" : "en")}
          activeOpacity={0.75}
        >
          <Ionicons name="language-outline" size={18} color="#176d33" />
          <Text style={styles.dashboardLanguageText}>
            {language === "en" ? "සිං" : "EN"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.contextChip}>
        <MapPin size={16} color="#1b7a39" />
        <Text style={styles.contextText}>
          {result?.City || city || "\u2014"},{" "}
          {result?.District || district || "\u2014"}
          {"  |  "}
          {result?.Season || season}
          {"  |  "}
          {text.week} {result?.Crop_Week || cropWeek}
        </Text>
      </View>

      <View style={styles.predictionHero}>
        <View style={styles.heroDecorationLarge} />
        <View style={styles.heroDecorationSmall} />
        <Image
          source={paddyHero}
          style={styles.paddyHeroImage}
          resizeMode="contain"
          pointerEvents="none"
        />

        <View style={styles.predictionTitleRow}>
          <View style={styles.predictionIconCircle}>
            <Leaf size={23} color="#16833a" />
          </View>
          <Text style={styles.predictionLabel}>{text.predictedYield}</Text>
        </View>

        <View style={styles.yieldValueRow}>
          <Text style={styles.yieldValue}>{predictedYield}</Text>
          <Text style={styles.yieldUnit}>{text.kgHa}</Text>
        </View>
        <Text style={styles.predictionCaption}>{text.basedOnConditions}</Text>
        <View style={styles.heroDivider} />

        <View style={styles.heroMetricsRow}>
          <View style={styles.heroMetric}>
            <Package size={24} color="#ffffff" />
            <View style={styles.heroMetricText}>
              <Text style={styles.heroMetricLabel}>
                {text.expectedProduction}
              </Text>
              <Text style={styles.heroMetricValue}>
                {expectedProduction}{" "}
                <Text style={styles.heroMetricUnit}>{text.tons}</Text>
              </Text>
            </View>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.heroMetric}>
            <Leaf size={24} color="#ffffff" />
            <View style={styles.heroMetricText}>
              <Text style={styles.heroMetricLabel}>{text.farmSizeShort}</Text>
              <Text style={styles.heroMetricValue}>
                {formatNumber(resultFarmSize, 1)}{" "}
                <Text style={styles.heroMetricUnit}>ha</Text>
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.statusGrid}>
        <View style={styles.statusCard}>
          <View
            style={[
              styles.statusIconCircle,
              { backgroundColor: riskTheme.background },
            ]}
          >
            <ShieldCheck size={27} color={riskTheme.accent} />
          </View>
          <View style={styles.statusContent}>
            <Text style={[styles.statusTitle, { color: riskTheme.title }]}>
              {getLocalizedRiskLabel(result?.Risk_Level, language)}
            </Text>
            <Text style={styles.statusCaption} numberOfLines={2}>
              {getRiskSummary(result?.Risk_Level, language)}
            </Text>
          </View>
        </View>

        <View style={styles.statusCard}>
          <View style={styles.statusIconCircle}>
            <Sprout size={27} color="#36a852" />
          </View>
          <View style={styles.statusContent}>
            <Text style={styles.statusTitle}>
              {getLocalizedCropStage(result?.Crop_Stage, language)}
            </Text>
            <Text style={styles.statusCaption}>{text.currentCropStage}</Text>
          </View>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{text.weatherForecast}</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.forecastList}
        >
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
                  {day?.date ? String(day.date).slice(5) : "\u2014"}
                </Text>
                <CloudRain size={26} color="#4aa3df" />
                <Text style={styles.forecastRain}>
                  {day?.rain_mm ?? "\u2014"} mm
                </Text>
                <Text style={styles.forecastTemp}>
                  {day?.temp_max ?? "\u2014"}
                  {"\u00B0"} / {day?.temp_min ?? "\u2014"}
                  {"\u00B0"}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No rain forecast available.</Text>
          )}
        </ScrollView>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{text.soilCondition}</Text>
          <View style={styles.sectionIconCircle}>
            <Sprout size={21} color="#278c46" />
          </View>
        </View>

        <View style={styles.soilGrid}>
          <InfoItem label={text.soilPH} value={formatNumber(soilPH, 1)} />
          <InfoItem
            label={text.soilType}
            value={result?.Soil_Type || "\u2014"}
          />
          <InfoItem label={text.zone} value={result?.Zone || "\u2014"} />
          <InfoItem
            label={text.waterCondition}
            value={result?.Water_Condition || "\u2014"}
          />
        </View>

        <View style={styles.soilStatusRow}>
          <Text style={styles.soilStatusLabel}>{text.soilReaction}</Text>
          <View style={[styles.soilStatusBadge, soilReaction.style]}>
            <Text style={styles.soilStatusText}>{soilReaction.label}</Text>
          </View>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {text.fertilizerRecommendation}
          </Text>
          <Text style={styles.stageLabel}>
            {getLocalizedCropStage(result?.Crop_Stage, language)} |{" "}
            {fertilizer?.Week || "\u2014"}
          </Text>
        </View>

        <View style={styles.fertilizerGrid}>
          {[
            ["Urea", fertilizer?.Urea_kg_ha],
            ["TSP", fertilizer?.TSP_kg_ha],
            ["MOP", fertilizer?.MOP_kg_ha],
            ["Zinc", fertilizer?.Zinc_kg_ha],
          ].map(([name, amount]) => (
            <FertilizerItem
              key={name}
              name={name}
              amount={amount}
              farmSize={resultFarmSize}
              text={text}
            />
          ))}
        </View>
      </View>

      {!!priorityAction && (
        <View style={styles.priorityActionCard}>
          <View style={styles.priorityActionIcon}>
            <Ionicons name="flash-outline" size={21} color="#9a6900" />
          </View>
          <View style={styles.priorityActionContent}>
            <Text style={styles.priorityActionLabel}>
              {text.priorityAction}
            </Text>
            <Text style={styles.priorityActionText}>{priorityAction}</Text>
          </View>
        </View>
      )}

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{text.advisorySummary}</Text>
          <BarChart3 size={22} color="#2e7d32" />
        </View>

        {advisorySections.length > 0 ? (
          advisorySections.map((item, index) => (
            <View key={`${item.title}-${index}`} style={styles.adviceAccordion}>
              <TouchableOpacity
                style={styles.adviceAccordionHeader}
                onPress={() =>
                  setExpandedAdvice(expandedAdvice === index ? -1 : index)
                }
                activeOpacity={0.75}
              >
                <View
                  style={[
                    styles.advisoryIcon,
                    {
                      backgroundColor:
                        ADVISORY_ICONS[index]?.backgroundColor || "#2E8B57",
                    },
                  ]}
                >
                  <Ionicons
                    name={ADVISORY_ICONS[index]?.icon || "leaf-outline"}
                    size={21}
                    color={ADVISORY_ICONS[index]?.color || "#FFFFFF"}
                  />
                </View>

                <Text style={styles.adviceAccordionTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                {expandedAdvice === index ? (
                  <ChevronUp size={21} color="#276f3d" />
                ) : (
                  <ChevronDown size={21} color="#276f3d" />
                )}
              </TouchableOpacity>

              {expandedAdvice === index && (
                <Text style={styles.adviceAccordionText}>{item.text}</Text>
              )}
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>{text.noAdvice}</Text>
        )}
      </View>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={onNewPrediction}
      >
        <Text style={styles.secondaryButtonText}>{text.makeNew}</Text>
      </TouchableOpacity>
    </>
  );
}

function InfoItem({ label, value }) {
  return (
    <View style={styles.infoItem}>
      <Text style={styles.infoItemLabel}>{label}</Text>
      <Text style={styles.infoItemValue}>{value}</Text>
    </View>
  );
}

function FertilizerItem({ name, amount, farmSize, text }) {
  const perHectare = Number(amount);
  const farmAmount = perHectare * Number(farmSize);
  const hasValidAmount = Number.isFinite(perHectare);
  const theme = getFertilizerTheme(name);

  return (
    <View style={styles.fertilizerItem}>
      <View
        style={[
          styles.fertilizerIconCircle,
          { backgroundColor: theme.background },
        ]}
      >
        <FlaskConical size={21} color={theme.accent} />
      </View>

      <View style={styles.fertilizerTextArea}>
        <Text style={styles.fertilizerName}>{name}</Text>
        <Text style={[styles.fertilizerAmount, { color: theme.accent }]}>
          {hasValidAmount ? formatNumber(perHectare, 1) : "\u2014"} kg/ha
        </Text>
        <Text style={styles.fertilizerFarmAmount}>
          {text.forFarm}:{" "}
          {hasValidAmount && Number.isFinite(farmAmount)
            ? formatNumber(farmAmount, 1)
            : "\u2014"}{" "}
          kg
        </Text>
      </View>
    </View>
  );
}
