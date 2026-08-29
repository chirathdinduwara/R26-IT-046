import { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  Platform,
  Animated,
} from "react-native";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import TopWeather from "../../components/HomeScreen/TopWeather";

const { width } = Dimensions.get("window");

// ── Palette (matches Settings + Stack) ───────────────────────────────────────
const C = {
  bg: "#0D1117",
  surface: "#161B22",
  surfaceHi: "#21262D",
  border: "#30363D",
  text: "#E6EDF3",
  sub: "#8B949E",
  muted: "#484F58",
  amber: "#F0A500",
  amberDim: "#7A5200",
  green: "#3FB950",
};

const NAV_ITEMS = [
  {
    id: "1",
    title: "Flood Map",
    subtitle: "Live city-wide flood prediction",
    route: "FloodMap",
    icon: "water",
    accent: "#1E90FF",
    dimBg: "#0A1929",
    tag: "LIVE",
    tagColor: "#3FB950",
  },
  {
    id: "2",
    title: "Division Flood Map",
    subtitle: "Sub-district flood risk analysis",
    route: "FloodMapDivision",
    icon: "map-marker-radius",
    accent: "#29B6F6",
    dimBg: "#051520",
    tag: null,
  },
  {
    id: "3",
    title: "Dengue Warning",
    subtitle: "Outbreak zones & risk alerts",
    route: "DengueWarning",
    icon: "bug",
    accent: "#FF7043",
    dimBg: "#1A0A05",
    tag: "ALERT",
    tagColor: "#FF7043",
  },
  {
    id: "4",
    title: "Paddy Advisory",
    subtitle: "Crop guidance & weather suitability",
    route: "PaddyAdvisory",
    icon: "sprout",
    accent: "#66BB6A",
    dimBg: "#071A09",
    tag: null,
  },
  {
    id: "5",
    title: "Safe Navigation",
    subtitle: "Route safety during flood events",
    route: "SafeNavigation",
    icon: "shield-check",
    accent: "#FFD54F",
    dimBg: "#1A1200",
    tag: null,
  },
  {
    id: "6",
    title: "Safe Navigation Demo",
    subtitle: "Manual weather, traffic, and flood point simulation",
    route: "SafeNavigationDemo",
    icon: "flask-outline",
    accent: "#FFB74D",
    dimBg: "#1E1306",
    tag: "DEMO",
    tagColor: "#FFB74D",
  },
];

// ── Nav card ──────────────────────────────────────────────────────────────────
function NavCard({ item, onPress, index }) {
  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: item.dimBg }]}
      onPress={onPress}
      activeOpacity={0.78}
    >
      {/* Left accent rail */}
      <View style={[styles.accentRail, { backgroundColor: item.accent }]} />

      {/* Icon */}
      <View
        style={[
          styles.iconWrap,
          {
            backgroundColor: item.accent + "1A",
            borderColor: item.accent + "33",
          },
        ]}
      >
        <MaterialCommunityIcons
          name={item.icon}
          size={24}
          color={item.accent}
        />
      </View>

      {/* Text block */}
      <View style={styles.cardBody}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          {item.tag && (
            <View
              style={[
                styles.tag,
                {
                  backgroundColor: (item.tagColor ?? item.accent) + "22",
                  borderColor: (item.tagColor ?? item.accent) + "55",
                },
              ]}
            >
              {item.tag === "LIVE" && (
                <View
                  style={[
                    styles.tagPulse,
                    { backgroundColor: item.tagColor ?? item.accent },
                  ]}
                />
              )}
              <Text
                style={[
                  styles.tagText,
                  { color: item.tagColor ?? item.accent },
                ]}
              >
                {item.tag}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.cardSub}>{item.subtitle}</Text>
      </View>

      {/* Chevron */}
      <Ionicons name="chevron-forward" size={16} color={C.muted} />
    </TouchableOpacity>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const navigation = useNavigation();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.25,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        {/* Grid texture overlay — pure View dots */}
        <View style={styles.headerGrid} pointerEvents="none">
          {Array.from({ length: 30 }).map((_, i) => (
            <View key={i} style={styles.gridDot} />
          ))}
        </View>

        <View style={styles.headerContent}>
          <View style={styles.headerMeta}>
            <View style={styles.headerMetaRow}>
              <MaterialCommunityIcons
                name="map-marker"
                size={10}
                color={C.amber}
              />
              <Text style={styles.headerEyebrow}>COLOMBO DISTRICT · LK</Text>
            </View>
            <Text style={styles.headerTitle}>Geonix Mobile</Text>
          </View>

          {/* Live badge */}
          <View style={styles.liveBadge}>
            <Animated.View style={[styles.liveDot, { opacity: pulseAnim }]} />
            <Text style={styles.liveBadgeText}>LIVE</Text>
          </View>
        </View>

        {/* Amber bottom border */}
        <View style={styles.headerBorder} />
      </View>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Weather widget */}
        <View style={styles.weatherWrap}>
          <TopWeather />
        </View>

        {/* Section row */}
        <View style={styles.sectionRow}>
          <View style={styles.sectionAccent} />
          <Text style={styles.sectionLabel}>SERVICES</Text>
          <View style={styles.sectionLine} />
          <Text style={styles.sectionCount}>{NAV_ITEMS.length}</Text>
        </View>

        {/* Cards */}
        {NAV_ITEMS.map((item, idx) => (
          <NavCard
            key={item.id}
            item={item}
            index={idx}
            onPress={() => navigation.navigate(item.route)}
          />
        ))}

        <View style={{ height: 36 }} />
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    backgroundColor: C.surface,
    paddingTop: Platform.OS === "ios" ? 58 : 45,
    paddingBottom: 0,
    overflow: "hidden",
    borderBottomWidth: 0,
  },

  // Dot-grid texture
  headerGrid: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    flexWrap: "wrap",
    paddingTop: 16,
    paddingHorizontal: 12,
    gap: (width - 24) / 30 - 2,
    opacity: 0.18,
  },
  gridDot: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: C.amber,
    margin: 9,
  },

  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  headerMeta: {
    gap: 4,
  },
  headerMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  headerEyebrow: {
    fontSize: 9,
    fontWeight: "800",
    color: C.amber,
    letterSpacing: 2.5,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: C.text,
    lineHeight: 36,
    letterSpacing: -0.5,
    marginTop: 4,
  },

  // Live badge
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.green + "15",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.green + "40",
    paddingVertical: 6,
    paddingHorizontal: 11,
    marginBottom: 4,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: C.green,
  },
  liveBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: C.green,
    letterSpacing: 1.5,
  },

  // Amber bottom line
  headerBorder: {
    height: 2,
    backgroundColor: C.amber,
    opacity: 0.7,
  },

  // ── Scroll ───────────────────────────────────────────────────────────────────
  scroll: {
    paddingHorizontal: 14,
    paddingTop: 16,
  },

  // Weather wrapper
weatherWrap: {
  borderRadius: 24,
  overflow: "hidden",
  marginBottom: 16,
  backgroundColor: "rgba(255, 255, 255, 0.10)",
  borderWidth: 1,
  borderColor: "rgba(255, 255, 255, 0.18)",
  shadowColor: "#000",
  shadowOffset: {
    width: 0,
    height: 10,
  },
  shadowOpacity: 0.25,
  shadowRadius: 20,
  elevation: 10,
  paddingHorizontal: 20,
  paddingVertical: 14,
},

  // Section divider
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 20,
    marginBottom: 10,
    marginLeft: 2,
  },
  sectionAccent: {
    width: 3,
    height: 12,
    borderRadius: 2,
    backgroundColor: C.amber,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: C.amber,
    letterSpacing: 2.5,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.border,
  },
  sectionCount: {
    fontSize: 10,
    fontWeight: "700",
    color: C.muted,
    letterSpacing: 0.5,
  },

  // ── Card ─────────────────────────────────────────────────────────────────────
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    marginBottom: 8,
    paddingVertical: 13,
    paddingRight: 14,
    paddingLeft: 0,
    gap: 12,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },

  accentRail: {
    width: 3,
    alignSelf: "stretch",
    borderRadius: 0,
    marginRight: 2,
  },

  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  cardBody: {
    flex: 1,
    gap: 3,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: C.text,
    letterSpacing: 0.1,
  },
  cardSub: {
    fontSize: 11,
    color: C.sub,
    lineHeight: 15,
  },

  // Tag pill
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 6,
    borderWidth: 1,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  tagPulse: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  tagText: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1,
  },
});
