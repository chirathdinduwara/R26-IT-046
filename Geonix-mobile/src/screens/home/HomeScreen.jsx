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
import { MaterialCommunityIcons, Ionicons, Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import TopWeather from "../../components/HomeScreen/TopWeather";

const { width } = Dimensions.get("window");

// ── Palette (matches Settings + Theme) ───────────────────────────────────────
const C = {
  bg: "#0D1117",
  surface: "#161B22",
  surfaceHi: "#21262D",
  border: "#30363D",
  borderGlow: "rgba(240, 165, 0, 0.35)",
  text: "#E6EDF3",
  sub: "#8B949E",
  muted: "#484F58",
  amber: "#F0A500",
  amberDim: "#7A5200",
  green: "#3FB950",
  teal: "#39D5C6",
  blue: "#1E90FF",
  cyan: "#29B6F6",
  danger: "#FF7043",
};

const NAV_ITEMS = [
  {
    id: "1",
    title: "Flood Map",
    subtitle: "Live City-wide flood prediction",
    route: "FloodMap",
    icon: "water",
    accent: "#1E90FF",
    gradient: ["#0C2540", "#081626"],
    tagColor: "#3FB950",
  },
  {
    id: "2",
    title: "Division Flood Map",
    subtitle: "Sub-district flood risk analysis",
    route: "FloodMapDivision",
    icon: "map-marker-radius",
    accent: "#29B6F6",
    gradient: ["#07293D", "#061824"],
    tag: null,
  },
  {
    id: "3",
    title: "Dengue Warning",
    subtitle: "Outbrake Zones & Risk Alerts",
    route: "DengueWarning",
    icon: "bug",
    accent: "#FF7043",
    gradient: ["#33150C", "#1D0B06"],
    tagColor: "#FF7043",
  },
  {
    id: "4",
    title: "Paddy Advisory",
    subtitle: "Crop guidance & weather suitability",
    route: "PaddyAdvisory",
    icon: "sprout",
    accent: "#66BB6A",
    gradient: ["#0F2D14", "#081A0B"],
    tag: null,
  },
  {
    id: "5",
    title: "Safe Navigation",
    subtitle: "Safest routes during floods and other hazards",
    route: "SafeNavigation",
    icon: "shield-check",
    accent: "#FFD54F",
    gradient: ["#2E2207", "#1A1303"],
    tagColor: "#FFD54F",
  },
  {
    id: "6",
    title: "Safe Navigation Demo",
    subtitle: "Simulated flood and hazard conditions",
    route: "SafeNavigationDemo",
    icon: "flask-outline",
    accent: "#FFB74D",
    gradient: ["#301E0A", "#1A1005"],
    tag: "DEMO",
    tagColor: "#FFB74D",
  },
];

// ── Nav card ──────────────────────────────────────────────────────────────────
function NavCard({ item, onPress, index }) {
  return (
    <TouchableOpacity
      style={styles.cardWrapper}
      onPress={onPress}
      activeOpacity={0.82}
    >
      <LinearGradient
        colors={item.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        {/* Subtle accent top rail */}
        <View
          style={[styles.cardAccentBar, { backgroundColor: item.accent }]}
        />

        {/* Ambient Corner Glow */}
        <View
          style={[
            styles.cardGlowCircle,
            { backgroundColor: item.accent + "18" },
          ]}
        />

        {/* Icon Container with double glow border */}
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor: item.accent + "1A",
              borderColor: item.accent + "4D",
            },
          ]}
        >
          <MaterialCommunityIcons
            name={item.icon}
            size={24}
            color={item.accent}
          />
        </View>

        {/* Text Body */}
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
          <Text style={styles.cardSub} numberOfLines={2}>
            {item.subtitle}
          </Text>
        </View>

        {/* Chevron Button */}
        <View style={styles.chevronWrap}>
          <Ionicons
            name="arrow-forward-circle"
            size={22}
            color={item.accent}
            style={{ opacity: 0.85 }}
          />
        </View>
      </LinearGradient>
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
          toValue: 0.3,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
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

      {/* ── Modern App Header ────────────────────────────────────────────── */}
      <LinearGradient
        colors={["#1B222D", "#131820", "#0D1117"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.header}
      >
        {/* Subtle Ambient Decorative Circles */}
        <View style={styles.ambientGlow} pointerEvents="none" />

        <View style={styles.headerContent}>
          <View style={styles.headerMeta}>
            <View style={styles.headerMetaRow}>
              <View style={styles.locIconPill}>
                <Text style={styles.headerEyebrow}>COLOMBO DRISTRICT - SRI LANKA</Text>
              </View>
            </View>
            <Text style={styles.headerTitle}>Geonix Mobile</Text>
          </View>

          {/* Live System Badge */}
          <View style={styles.liveBadge}>
            <Animated.View style={[styles.liveDot, { opacity: pulseAnim }]} />
            <Text style={styles.liveBadgeText}>LIVE</Text>
          </View>
        </View>

        {/* Ambient golden divider */}
        <View style={styles.headerBorder} />
      </LinearGradient>

      {/* ── Scrollable Body ─────────────────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Weather & Location Glass Widget */}
        <LinearGradient
          colors={["rgba(33, 38, 45, 0.9)", "rgba(22, 27, 34, 0.95)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.weatherWrap}
        >

          <View style={styles.weatherComponentWrapper}>
            <TopWeather />
          </View>
        </LinearGradient>

        {/* Section Header */}
        <View style={styles.sectionRow}>
          <View style={styles.sectionAccent} />
          <Text style={styles.sectionLabel}>SERVICES</Text>
          <View style={styles.sectionLine} />
        </View>

        {/* Navigation Cards */}
        {NAV_ITEMS.map((item, idx) => (
          <NavCard
            key={item.id}
            item={item}
            index={idx}
            onPress={() => navigation.navigate(item.route)}
          />
        ))}

        <View style={{ height: 32 }} />
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
    paddingTop: Platform.OS === "ios" ? 54 : 42,
    paddingBottom: 0,
    overflow: "hidden",
    position: "relative",
  },
  ambientGlow: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: C.amber + "12",
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerMeta: {
    gap: 3,
    flex: 1,
  },
  headerMetaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  locIconPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.amber + "1A",
    borderColor: C.amber + "33",
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 3,
    paddingHorizontal: 8,
    gap: 5,
  },
  headerEyebrow: {
    fontSize: 9,
    fontWeight: "800",
    color: C.amber,
    letterSpacing: 1.5,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: C.text,
    letterSpacing: -0.5,
    marginTop: 6,
  },

  // Live badge
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.green + "1A",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.green + "4D",
    paddingVertical: 5,
    paddingHorizontal: 12,
    marginBottom: 6,
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
    letterSpacing: 1.2,
  },

  // Golden accent bottom line
  headerBorder: {
    height: 2,
    backgroundColor: C.amber,
    opacity: 0.65,
  },

  // ── Scroll ───────────────────────────────────────────────────────────────────
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  // Weather wrapper
  weatherWrap: {
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 18,
    paddingVertical: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  weatherComponentWrapper: {
    paddingVertical: 4,
  },
  // Section divider
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    marginBottom: 14,
  },
  sectionAccent: {
    width: 3.5,
    height: 14,
    borderRadius: 2,
    backgroundColor: C.amber,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: C.text,
    letterSpacing: 1.8,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.border,
  },

  // ── Card ─────────────────────────────────────────────────────────────────────
  cardWrapper: {
    marginBottom: 11,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 13,
    position: "relative",
    overflow: "hidden",
  },
  cardAccentBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3.5,
  },
  cardGlowCircle: {
    position: "absolute",
    right: -25,
    bottom: -25,
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.2,
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
    fontSize: 15,
    fontWeight: "700",
    color: C.text,
    letterSpacing: 0.2,
  },
  cardSub: {
    fontSize: 11.5,
    color: C.sub,
    lineHeight: 16,
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
    fontSize: 8.5,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  chevronWrap: {
    paddingLeft: 4,
  },
});
