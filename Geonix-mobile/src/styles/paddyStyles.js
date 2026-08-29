import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
  zoomRoot: {
    flex: 1,
    backgroundColor: "#f4f7f5",
    overflow: "hidden",
  },

  zoomCanvas: {
    flex: 1,
  },

  container: {
    flex: 1,
    backgroundColor: "#f4f7f5",
    paddingHorizontal: 18,
  },

  contentContainer: {
    paddingTop: 6,
    paddingBottom: 30,
  },

  dashboardHeader: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    paddingVertical: 8,
    marginBottom: 10,
  },

  dashboardHeadingContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 10,
  },

  dashboardPaddyIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "#f7c63d",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },

  dashboardHeadingText: {
    flex: 1,
  },

  dashboardTitle: {
    color: "#173d28",
    fontSize: 19,
    lineHeight: 24,
    fontWeight: "900",
  },

  dashboardLanguageButton: {
    minWidth: 58,
    height: 38,
    paddingHorizontal: 10,
    borderRadius: 19,
    backgroundColor: "#e5f3e9",
    borderWidth: 1,
    borderColor: "#c6e3ce",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },

  dashboardLanguageText: {
    color: "#176d33",
    fontSize: 11,
    fontWeight: "900",
    marginLeft: 4,
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

  formLanguageRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 4,
    marginBottom: 10,
  },

  formLanguagePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#c9decf",
    borderRadius: 24,
    paddingVertical: 4,
    paddingHorizontal: 7,
    shadowColor: "#173d28",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },

  formLanguageOption: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },

  formLanguageOptionActive: {
    backgroundColor: "#e7f5e9",
  },

  formLanguageText: {
    color: "#47534b",
    fontSize: 12,
    fontWeight: "700",
  },

  formLanguageTextActive: {
    color: "#23753a",
    fontWeight: "900",
  },

  formLanguageDivider: {
    width: 1,
    height: 20,
    backgroundColor: "#d7dfd9",
  },

  formHeroBanner: {
    minHeight: 142,
    backgroundColor: "#216f3d",
    borderRadius: 24,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    marginBottom: -20,
    marginHorizontal: 8,
    zIndex: 2,
    shadowColor: "#123c24",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.22,
    shadowRadius: 9,
    elevation: 6,
  },

  formHeroImageStyle: {
    borderRadius: 24,
  },

  formHeroOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(13, 70, 36, 0.58)",
    borderRadius: 24,
  },

  formHeroImageCircle: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: "#f4faef",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginRight: 15,
    zIndex: 1,
  },

  formHeroImage: {
    width: 92,
    height: 82,
    transform: [{ translateY: 7 }],
  },

  formHeroContent: {
    flex: 1,
    zIndex: 1,
  },

  formHeroTitle: {
    color: "#ffffff",
    fontSize: 25,
    lineHeight: 30,
    fontWeight: "900",
    marginBottom: 6,
  },

  formHeroSubtitle: {
    color: "#e7f5e9",
    fontSize: 13,
    lineHeight: 19,
  },

  enhancedFormCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 42,
    paddingBottom: 18,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#e0e9e2",
    shadowColor: "#183c28",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.11,
    shadowRadius: 10,
    elevation: 4,
  },

  formSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 11,
  },

  formSectionIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#eaf6e8",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  formSectionTitle: {
    color: "#255f36",
    fontSize: 17,
    fontWeight: "900",
  },

  formSectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#d2e5d5",
    marginLeft: 12,
  },

  formSectionSpacing: {
    height: 17,
  },

  enhancedLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: "#18231c",
    marginBottom: 7,
    marginTop: 7,
  },

  enhancedField: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d2dbd5",
    overflow: "hidden",
    marginBottom: 7,
  },

  enhancedFieldIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#eef8eb",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 9,
  },

  enhancedPicker: {
    flex: 1,
    minHeight: 56,
    justifyContent: "center",
  },

  enhancedInput: {
    flex: 1,
    height: 56,
    paddingHorizontal: 13,
    fontSize: 16,
    color: "#1f2922",
  },

  inputUnitBox: {
    minWidth: 65,
    height: 56,
    backgroundColor: "#eef6e7",
    borderLeftWidth: 1,
    borderLeftColor: "#d5e2d3",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },

  inputUnitText: {
    color: "#2b713c",
    fontSize: 14,
    fontWeight: "800",
  },

  enhancedPredictButton: {
    height: 60,
    backgroundColor: "#2d8a3d",
    borderRadius: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 22,
    paddingHorizontal: 10,
    shadowColor: "#176229",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 4,
  },

  enhancedPredictButtonText: {
    flex: 1,
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "900",
    textAlign: "center",
    marginLeft: 28,
  },

  predictArrowCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
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
    flexDirection: "row",
    alignItems: "center",
    maxWidth: "100%",
  },

  contextText: {
    color: "#1b5e20",
    fontWeight: "800",
    fontSize: 13,
    marginLeft: 6,
    flexShrink: 1,
  },

  predictionHero: {
    backgroundColor: "#10873b",
    borderRadius: 22,
    padding: 20,
    marginBottom: 14,
    minHeight: 238,
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#0b5725",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },

  heroDecorationLarge: {
    position: "absolute",
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: "rgba(100, 195, 75, 0.18)",
    right: -90,
    bottom: -115,
  },

  heroDecorationSmall: {
    position: "absolute",
    width: 125,
    height: 125,
    borderRadius: 63,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    right: -20,
    top: -45,
  },

  paddyHeroImage: {
    position: "absolute",
    width: 210,
    height: 165,
    right: -20,
    bottom: -5,
    opacity: 0.75,
    zIndex: 0,
  },

  predictionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    zIndex: 1,
  },

  predictionIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  predictionLabel: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "800",
  },

  yieldValueRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: 10,
    zIndex: 1,
  },

  yieldValue: {
    color: "#ffffff",
    fontSize: 48,
    lineHeight: 54,
    fontWeight: "900",
    letterSpacing: -1,
  },

  yieldUnit: {
    color: "#ffffff",
    fontSize: 19,
    fontWeight: "800",
    marginLeft: 8,
    marginBottom: 7,
  },

  predictionCaption: {
    color: "#d9f2df",
    fontSize: 12,
    marginTop: 2,
    zIndex: 1,
  },

  heroDivider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.28)",
    marginVertical: 15,
    zIndex: 1,
  },

  heroMetricsRow: {
    flexDirection: "row",
    alignItems: "center",
    zIndex: 1,
  },

  heroMetric: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },

  heroMetricText: {
    marginLeft: 10,
    flexShrink: 1,
  },

  heroMetricLabel: {
    color: "#d9f2df",
    fontSize: 11,
    fontWeight: "700",
  },

  heroMetricValue: {
    color: "#ffffff",
    fontSize: 21,
    fontWeight: "900",
    marginTop: 2,
  },

  heroMetricUnit: {
    fontSize: 12,
    fontWeight: "700",
  },

  metricDivider: {
    width: 1,
    height: 44,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    marginHorizontal: 12,
  },

  statusGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },

  statusCard: {
    width: "48.5%",
    minHeight: 112,
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    elevation: 2,
    shadowColor: "#183b24",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
  },

  statusIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#edf8f0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },

  statusContent: {
    flex: 1,
  },

  statusTitle: {
    color: "#176d33",
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 4,
  },

  statusCaption: {
    color: "#68716b",
    fontSize: 11,
    lineHeight: 15,
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
    marginRight: 10,
    flexShrink: 1,
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

  forecastList: {
    paddingRight: 6,
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

  sectionIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#edf8f0",
    justifyContent: "center",
    alignItems: "center",
  },

  soilGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  infoItem: {
    width: "48.5%",
    backgroundColor: "#f4f9f5",
    borderRadius: 13,
    padding: 12,
    marginBottom: 10,
    minHeight: 72,
  },

  infoItemLabel: {
    color: "#6b756e",
    fontSize: 11,
    marginBottom: 5,
  },

  infoItemValue: {
    color: "#1b2820",
    fontSize: 15,
    fontWeight: "900",
  },

  soilStatusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 2,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e7eee9",
  },

  soilStatusLabel: {
    color: "#4b5650",
    fontSize: 13,
    fontWeight: "700",
  },

  soilStatusBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },

  soilStatusText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
  },

  soilStatusAcidic: {
    backgroundColor: "#e69a16",
  },

  soilStatusModerate: {
    backgroundColor: "#2e9b4b",
  },

  soilStatusAlkaline: {
    backgroundColor: "#3d83c5",
  },

  soilStatusUnknown: {
    backgroundColor: "#859089",
  },

  stageLabel: {
    color: "#227c3d",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 12,
    textAlign: "right",
    maxWidth: "45%",
  },

  fertilizerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  fertilizerItem: {
    width: "48.5%",
    backgroundColor: "#f5faf6",
    borderRadius: 14,
    padding: 11,
    marginBottom: 10,
    minHeight: 122,
    borderWidth: 1,
    borderColor: "#e5eee7",
  },

  fertilizerIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#e4f5e8",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },

  fertilizerTextArea: {
    flex: 1,
  },

  fertilizerName: {
    color: "#1d2821",
    fontSize: 14,
    fontWeight: "900",
  },

  fertilizerAmount: {
    color: "#228341",
    fontSize: 13,
    fontWeight: "900",
    marginTop: 3,
  },

  fertilizerFarmAmount: {
    color: "#6b746e",
    fontSize: 10,
    lineHeight: 14,
    marginTop: 4,
  },

  adviceAccordion: {
    backgroundColor: "#f3f8f4",
    borderRadius: 14,
    marginBottom: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e4eee6",
  },

  adviceAccordionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
  },

  advisoryIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    elevation: 3,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 3,
  },

  adviceAccordionTitle: {
    flex: 1,
    color: "#216d39",
    fontSize: 14,
    fontWeight: "900",
    marginRight: 8,
  },

  adviceAccordionText: {
    color: "#37433b",
    fontSize: 14,
    lineHeight: 22,
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 2,
    borderTopWidth: 1,
    borderTopColor: "#e2ebe4",
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

  priorityActionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff8e2",
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#f0d78a",
  },

  priorityActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: "#ffe5a1",
    alignItems: "center",
    justifyContent: "center",
  },

  priorityActionContent: {
    flex: 1,
    marginLeft: 12,
  },

  priorityActionLabel: {
    color: "#8a6500",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },

  priorityActionText: {
    color: "#3f351c",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
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

export default styles;
