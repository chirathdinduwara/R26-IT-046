import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  ActivityIndicator,
  Animated,
  Alert,
  StatusBar,
  Platform,
} from "react-native";
import { useState, useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons, Ionicons, Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  API_BASE_URL,
  DENGUE_API_URL,
  FLOOD_API_URL,
  PADDY_API_URL,
  SAFE_ROUTE_API_URL,
} from "../config/api";

const BACKENDS = {
  dengue: { label: "Dengue Backend", url: DENGUE_API_URL, icon: "bug" },
  flood: { label: "Flood Backend", url: FLOOD_API_URL, icon: "water" },
  paddy: { label: "Paddy Backend", url: PADDY_API_URL, icon: "sprout" },
  safe_route: {
    label: "Safe Route Backend",
    url: SAFE_ROUTE_API_URL,
    icon: "shield-check",
  },
};

// ── Storage key ───────────────────────────────────────────────────────────────
const STORAGE_KEY = "@flood_app_settings";

// ── Defaults ──────────────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  dangerThreshold: "10.0",
  alertThreshold: "8.0",
  watchThreshold: "6.5",
  notifyDanger: true,
  notifyAlert: true,
  notifyWatch: false,
  autoCheckOnLaunch: false,
  locationAccuracy: "balanced", // "low" | "balanced" | "high"
  mapStyle: "standard", // "standard" | "satellite" | "hybrid"
  showFloodZoneLabels: true,
  polygonOpacity: "40", // percent string
  refreshIntervalMin: "15",
  safeRouteSpeak: true,
  safeRouteRerunMin: "10",
};

// ── Theme Palette ─────────────────────────────────────────────────────────────
const C = {
  bg: "#0D1117",
  surface: "#161B22",
  surfaceHi: "#21262D",
  border: "#30363D",
  borderGlow: "rgba(240, 165, 0, 0.35)",
  amber: "#F0A500",
  amberDim: "#7A5200",
  teal: "#39D5C6",
  tealDim: "#1A6B65",
  danger: "#F85149",
  safe: "#3FB950",
  text: "#E6EDF3",
  sub: "#8B949E",
  muted: "#484F58",
  blue: "#1E90FF",
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeader({ icon, label, accent = C.amber }) {
  return (
    <View style={styles.sectionHeader}>
      <View
        style={[
          styles.sectionIconWrap,
          { backgroundColor: accent + "1A", borderColor: accent + "44" },
        ]}
      >
        <MaterialCommunityIcons name={icon} size={15} color={accent} />
      </View>
      <Text style={[styles.sectionLabel, { color: accent }]}>{label}</Text>
      <View style={[styles.sectionLine, { backgroundColor: accent + "33" }]} />
    </View>
  );
}

function SettingRow({ label, sub, icon, children, last }) {
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      {icon && (
        <View style={styles.rowIconPill}>
          <MaterialCommunityIcons name={icon} size={16} color={C.sub} />
        </View>
      )}
      <View style={styles.rowLeft}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      <View style={styles.rowRight}>{children}</View>
    </View>
  );
}

function StyledInput({
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  unit,
  monospace,
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.inputContainer, focused && styles.inputContainerFocused]}>
      <TextInput
        style={[
          styles.input,
          monospace && styles.inputMono,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.muted}
        keyboardType={keyboardType}
        autoCapitalize="none"
        autoCorrect={false}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {unit && <Text style={styles.inputUnit}>{unit}</Text>}
    </View>
  );
}

function SegmentControl({ options, value, onChange }) {
  return (
    <View style={styles.segment}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[styles.segBtn, active && styles.segBtnActive]}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.7}
          >
            <Text style={[styles.segText, active && styles.segTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function StyledSwitch({ value, onValueChange }) {
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: C.surfaceHi, true: C.amberDim }}
      thumbColor={value ? C.amber : C.muted}
      ios_backgroundColor={C.surfaceHi}
    />
  );
}

function PingDot({ status }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (status === "checking") {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 0.3,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulse.setValue(1);
    }
  }, [status]);

  const color =
    status === "ok"
      ? C.safe
      : status === "fail"
        ? C.danger
        : status === "checking"
          ? C.amber
          : C.muted;

  return (
    <Animated.View
      style={[styles.pingDot, { backgroundColor: color, opacity: pulse }]}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [pingStatus, setPingStatus] = useState("idle"); // idle | checking | ok | fail
  const [pingMs, setPingMs] = useState(null);
  const [saved, setSaved] = useState(false);
  const saveAnim = useRef(new Animated.Value(0)).current;

  // ── Load from storage ──────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
      } catch (e) {
        console.warn("Settings load error:", e);
      }
    })();
  }, []);

  // ── Patch helper ──────────────────────────────────────────────────────────
  const patch = (key, val) => setSettings((prev) => ({ ...prev, [key]: val }));

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      setSaved(true);
      Animated.sequence([
        Animated.timing(saveAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.delay(1400),
        Animated.timing(saveAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(() => setSaved(false));
    } catch (e) {
      Alert.alert("Save Failed", "Could not write settings to storage.");
    }
  };

  // ── Reset ─────────────────────────────────────────────────────────────────
  const handleReset = () => {
    Alert.alert(
      "Reset Settings",
      "All settings will revert to their defaults. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            setSettings(DEFAULT_SETTINGS);
            await AsyncStorage.removeItem(STORAGE_KEY);
          },
        },
      ]
    );
  };

  const [selectedBackend, setSelectedBackend] = useState("dengue");
  const [pingText, setPingText] = useState("");

  const cleanUrl = (url) => {
    if (!url) return "";
    let trimmed = url.trim();
    if (!/^https?:\/\//i.test(trimmed)) {
      trimmed = `https://${trimmed}`;
    }
    return trimmed;
  };

  // ── Ping API ──────────────────────────────────────────────────────────────
  const pingApi = async () => {
    setPingStatus("checking");
    setPingMs(null);
    setPingText("Testing response time...");
    const start = Date.now();

    const targetBackend = BACKENDS[selectedBackend];
    const cleanedUrl = cleanUrl(targetBackend.url);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(`${cleanedUrl}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const latency = Date.now() - start;
      setPingMs(latency);

      if (!res.ok) {
        // Fallback check to root URL directly
        const fallbackController = new AbortController();
        const fallbackTimeout = setTimeout(
          () => fallbackController.abort(),
          4000
        );
        const fallbackRes = await fetch(cleanedUrl, {
          signal: fallbackController.signal,
        });
        clearTimeout(fallbackTimeout);
        if (!fallbackRes.ok) throw new Error("non-2xx");
      }

      setPingStatus("ok");
      setPingText(`${targetBackend.label} is online : ${latency}ms`);
    } catch (err) {
      clearTimeout(timeoutId);
      console.log(`Ping to ${targetBackend.label} failed:`, err);
      setPingStatus("fail");
      setPingText(`${targetBackend.label} is offline`);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
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
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIconWrap}>
              <MaterialCommunityIcons
                name="tune-variant"
                size={20}
                color={C.amber}
              />
            </View>
            <View>
              <Text style={styles.headerTitle}>System Settings</Text>
              <Text style={styles.headerSub}>Geonix Climate & Risk Control</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.resetBtn}
            onPress={handleReset}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="restore" size={15} color={C.amber} />
            <Text style={styles.resetText}>Reset</Text>
          </TouchableOpacity>
        </View>

        {/* Ambient bottom line */}
        <View style={styles.headerBorder} />
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ════════ SERVER ════════ */}
        <SectionHeader icon="server-network" label="BACKEND SERVICES & APIS" />

        <View style={styles.card}>
          <View style={styles.cardHeaderStrip}>
            <Text style={styles.cardHeaderTitle}>SELECT BACKEND SERVICE</Text>
            <Text style={styles.cardHeaderSub}>
              Switch between predictive models to check network health
            </Text>
          </View>

          {/* Backend Selector Tabs */}
          <View style={styles.backendTabContainer}>
            {Object.keys(BACKENDS).map((key) => {
              const isActive = selectedBackend === key;
              const b = BACKENDS[key];
              const labelMap = {
                dengue: "Dengue",
                flood: "Flood",
                paddy: "Paddy",
                safe_route: "Safe Nav",
              };
              return (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.backendTab,
                    isActive && styles.backendTabActive,
                  ]}
                  onPress={() => {
                    setSelectedBackend(key);
                    setPingStatus("idle");
                    setPingMs(null);
                    setPingText("");
                  }}
                  activeOpacity={0.78}
                >
                  <MaterialCommunityIcons
                    name={b.icon}
                    size={15}
                    color={isActive ? C.amber : C.sub}
                    style={{ marginBottom: 3 }}
                  />
                  <Text
                    style={[
                      styles.backendTabText,
                      isActive && styles.backendTabTextActive,
                    ]}
                  >
                    {labelMap[key]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Selected URL Row */}
          <View style={styles.urlContainer}>
            <View style={styles.urlHeader}>
              <View style={styles.urlBadge}>
                <Feather name="link-2" size={11} color={C.teal} />
                <Text style={styles.urlBadgeText}>ACTIVE ENDPOINT</Text>
              </View>
              <Text style={styles.urlEnvText}>Source: .env</Text>
            </View>
            <Text
              numberOfLines={1}
              ellipsizeMode="middle"
              style={styles.urlValue}
            >
              {BACKENDS[selectedBackend].url}
            </Text>
          </View>

          {/* Connection Diagnostics Row */}
          <View style={[styles.row, styles.rowLast, { paddingTop: 14 }]}>
            <View style={styles.rowLeft}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 7 }}
              >
                <PingDot status={pingStatus} />
                <Text style={styles.rowLabel}>Diagnostics Status</Text>
              </View>
              <Text
                style={[
                  styles.rowSub,
                  pingStatus === "ok" && { color: C.safe, fontWeight: "600" },
                  pingStatus === "fail" && { color: C.danger, fontWeight: "600" },
                ]}
              >
                {pingText || "Service ready to test"}
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.ghostBtn,
                pingStatus === "checking" && styles.ghostBtnDisabled,
              ]}
              onPress={pingApi}
              disabled={pingStatus === "checking"}
              activeOpacity={0.75}
            >
              {pingStatus === "checking" ? (
                <ActivityIndicator size="small" color={C.amber} />
              ) : (
                <>
                  <MaterialCommunityIcons
                    name="lightning-bolt"
                    size={14}
                    color={C.amber}
                  />
                  <Text style={styles.ghostBtnText}>Ping Test</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ════════ ALERT THRESHOLDS ════════ */}
        <SectionHeader
          icon="water-alert"
          label="FLOOD WATER LEVEL THRESHOLDS"
          accent={C.danger}
        />

        <View style={styles.card}>
          <View style={styles.thresholdLegend}>
            {[
              { color: "#F85149", label: "DANGER", sub: "≥ Safe limit" },
              { color: "#FF7043", label: "ALERT", sub: "Elevated" },
              { color: "#F0A500", label: "WATCH", sub: "Monitor" },
            ].map((item) => (
              <View key={item.label} style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: item.color }]}
                />
                <Text style={styles.legendText}>{item.label}</Text>
              </View>
            ))}
          </View>

          <SettingRow
            label="Danger level"
            sub="Critical river gauge height"
            icon="alert-octagon"
          >
            <StyledInput
              value={settings.dangerThreshold}
              onChangeText={(v) => patch("dangerThreshold", v)}
              placeholder="10.0"
              keyboardType="decimal-pad"
              unit="m"
              monospace
            />
          </SettingRow>

          <SettingRow
            label="Alert level"
            sub="Elevated risk warning boundary"
            icon="alert"
          >
            <StyledInput
              value={settings.alertThreshold}
              onChangeText={(v) => patch("alertThreshold", v)}
              placeholder="8.0"
              keyboardType="decimal-pad"
              unit="m"
              monospace
            />
          </SettingRow>

          <SettingRow
            label="Watch level"
            sub="Pre-alert advisory boundary"
            icon="eye-outline"
            last
          >
            <StyledInput
              value={settings.watchThreshold}
              onChangeText={(v) => patch("watchThreshold", v)}
              placeholder="6.5"
              keyboardType="decimal-pad"
              unit="m"
              monospace
            />
          </SettingRow>
        </View>

        {/* ════════ NOTIFICATIONS ════════ */}
        <SectionHeader
          icon="bell-ring-outline"
          label="EARLY WARNING NOTIFICATIONS"
          accent={C.teal}
        />

        <View style={styles.card}>
          <SettingRow
            label="Danger alerts"
            sub="Push alerts when water level ≥ danger"
            icon="bell-alert"
          >
            <StyledSwitch
              value={settings.notifyDanger}
              onValueChange={(v) => patch("notifyDanger", v)}
            />
          </SettingRow>
          <SettingRow
            label="Alert-level notices"
            sub="Notify when water level reaches alert zone"
            icon="bell"
          >
            <StyledSwitch
              value={settings.notifyAlert}
              onValueChange={(v) => patch("notifyAlert", v)}
            />
          </SettingRow>
          <SettingRow
            label="Watch-level notices"
            sub="Notify for minor water level advisory"
            icon="bell-outline"
            last
          >
            <StyledSwitch
              value={settings.notifyWatch}
              onValueChange={(v) => patch("notifyWatch", v)}
            />
          </SettingRow>
        </View>

        {/* ════════ LOCATION ════════ */}
        <SectionHeader
          icon="crosshairs-gps"
          label="GEOLOCATION & SENSORS"
          accent={C.blue}
        />

        <View style={styles.card}>
          <SettingRow
            label="GPS Accuracy"
            sub="Higher accuracy enhances precision routing"
            icon="crosshairs"
          >
            <SegmentControl
              value={settings.locationAccuracy}
              onChange={(v) => patch("locationAccuracy", v)}
              options={[
                { label: "Low", value: "low" },
                { label: "Mid", value: "balanced" },
                { label: "High", value: "high" },
              ]}
            />
          </SettingRow>
          <SettingRow
            label="Auto-check on launch"
            sub="Perform instant hazard check when opened"
            icon="shield-search"
            last
          >
            <StyledSwitch
              value={settings.autoCheckOnLaunch}
              onValueChange={(v) => patch("autoCheckOnLaunch", v)}
            />
          </SettingRow>
        </View>

        {/* ════════ MAP DISPLAY ════════ */}
        <SectionHeader
          icon="map-outline"
          label="MAP VISUALIZATION"
          accent={C.amber}
        />

        <View style={styles.card}>
          <SettingRow
            label="Map Style"
            sub="Cartographic base layer"
            icon="layers-outline"
          >
            <SegmentControl
              value={settings.mapStyle}
              onChange={(v) => patch("mapStyle", v)}
              options={[
                { label: "Street", value: "standard" },
                { label: "Satellite", value: "satellite" },
                { label: "Hybrid", value: "hybrid" },
              ]}
            />
          </SettingRow>
          <SettingRow
            label="Flood zone labels"
            sub="Overlay division risk text directly on map"
            icon="label-outline"
          >
            <StyledSwitch
              value={settings.showFloodZoneLabels}
              onValueChange={(v) => patch("showFloodZoneLabels", v)}
            />
          </SettingRow>
          <SettingRow
            label="Polygon opacity"
            sub="Flood risk overlay translucency"
            icon="opacity"
            last
          >
            <StyledInput
              value={settings.polygonOpacity}
              onChangeText={(v) => patch("polygonOpacity", v)}
              placeholder="40"
              keyboardType="number-pad"
              unit="%"
              monospace
            />
          </SettingRow>
        </View>

        {/* ════════ SAFE ROUTE NAVIGATION ════════ */}
        <SectionHeader
          icon="navigation-variant-outline"
          label="SAFE ROUTE NAVIGATION (AI)"
          accent={C.safe}
        />

        <View style={styles.card}>
          <SettingRow
            label="Voice Navigation Alerts"
            sub="Audio hazard notifications while navigating"
            icon="volume-high"
          >
            <StyledSwitch
              value={settings.safeRouteSpeak}
              onValueChange={(v) => patch("safeRouteSpeak", v)}
            />
          </SettingRow>
          <SettingRow
            label="Model Re-evaluation"
            sub="Dynamic route recalculation interval"
            icon="timer-refresh-outline"
            last
          >
            <SegmentControl
              value={settings.safeRouteRerunMin}
              onChange={(v) => patch("safeRouteRerunMin", v)}
              options={[
                { label: "5m", value: "5" },
                { label: "10m", value: "10" },
                { label: "15m", value: "15" },
              ]}
            />
          </SettingRow>
        </View>

        {/* ════════ DATA ════════ */}
        <SectionHeader
          icon="database-refresh-outline"
          label="DATA SYNCHRONIZATION"
          accent={C.teal}
        />

        <View style={styles.card}>
          <SettingRow
            label="Refresh interval"
            sub="Background satellite & rainfall sync frequency"
            icon="sync"
            last
          >
            <StyledInput
              value={settings.refreshIntervalMin}
              onChangeText={(v) => patch("refreshIntervalMin", v)}
              placeholder="15"
              keyboardType="number-pad"
              unit="min"
              monospace
            />
          </SettingRow>
        </View>

        {/* ════════ ABOUT ════════ */}
        <SectionHeader
          icon="information-outline"
          label="ABOUT SYSTEM"
          accent={C.sub}
        />

        <View style={styles.card}>
          {[
            {
              label: "Application",
              value: "Geonix Mobile",
              icon: "cellphone-cog",
            },
            {
              label: "Version",
              value: "1.0.0 (Production)",
              icon: "tag-outline",
            },
            {
              label: "Monitored Region",
              value: "Kelani Basin & Sri Lanka",
              icon: "map-marker",
            },
            {
              label: "Primary Sensors",
              value: "Open-Meteo · IRD · DMC",
              icon: "database-outline",
            },
            {
              label: "Runtime Environment",
              value: Platform.OS === "ios" ? "Apple iOS" : "Google Android",
              icon: "laptop",
            },
          ].map((item, i, arr) => (
            <View
              key={item.label}
              style={[
                styles.aboutRow,
                i === arr.length - 1 && styles.rowLast,
              ]}
            >
              <View style={styles.aboutLeft}>
                <MaterialCommunityIcons
                  name={item.icon}
                  size={15}
                  color={C.amber}
                />
                <Text style={styles.aboutKey}>{item.label}</Text>
              </View>
              <Text style={styles.aboutVal}>{item.value}</Text>
            </View>
          ))}
        </View>

        {/* ════════ SAVE BUTTON ════════ */}
        <TouchableOpacity
          style={styles.saveBtn}
          onPress={handleSave}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[C.amber, "#D48B00"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.saveBtnGradient}
          >
            <MaterialCommunityIcons
              name="content-save-check"
              size={20}
              color="#000"
            />
            <Text style={styles.saveBtnText}>Save Configuration</Text>
          </LinearGradient>
        </TouchableOpacity>

        <View style={{ height: 48 }} />
      </ScrollView>

      {/* ── Saved toast notification ──────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.savedToast,
          {
            opacity: saveAnim,
            transform: [
              {
                translateY: saveAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [12, 0],
                }),
              },
            ],
          },
        ]}
        pointerEvents="none"
      >
        <MaterialCommunityIcons name="check-decagram" size={17} color={C.safe} />
        <Text style={styles.savedToastText}>Settings Saved Successfully</Text>
      </Animated.View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
  },

  // ── Header ─────────────────────────────────────────────────────────────────
  header: {
    paddingTop: Platform.OS === "ios" ? 54 : 42,
    paddingBottom: 0,
    overflow: "hidden",
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.amber + "1A",
    borderWidth: 1.2,
    borderColor: C.amber + "4D",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: C.text,
    letterSpacing: -0.2,
  },
  headerSub: {
    fontSize: 11,
    color: C.sub,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.amber + "44",
    backgroundColor: C.amber + "12",
  },
  resetText: {
    fontSize: 12,
    color: C.amber,
    fontWeight: "700",
  },
  headerBorder: {
    height: 2,
    backgroundColor: C.amber,
    opacity: 0.65,
  },

  // ── Scroll ─────────────────────────────────────────────────────────────────
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 18 },

  // ── Section header ─────────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
    marginTop: 8,
  },
  sectionIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionLabel: {
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 1.6,
  },
  sectionLine: {
    flex: 1,
    height: 1,
  },

  // ── Card ───────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeaderStrip: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  cardHeaderTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: C.amber,
    letterSpacing: 1.2,
  },
  cardHeaderSub: {
    fontSize: 11,
    color: C.sub,
    marginTop: 2,
    lineHeight: 15,
  },

  // ── Row ────────────────────────────────────────────────────────────────────
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
    gap: 12,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowIconPill: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: C.surfaceHi,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  rowLeft: {
    flex: 1,
    gap: 2,
  },
  rowRight: {
    flexShrink: 0,
  },
  rowLabel: {
    fontSize: 13.5,
    color: C.text,
    fontWeight: "600",
  },
  rowSub: {
    fontSize: 11,
    color: C.sub,
    lineHeight: 15,
  },

  // ── Input ──────────────────────────────────────────────────────────────────
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.bg,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 10,
    minWidth: 100,
  },
  inputContainerFocused: {
    borderColor: C.amber,
  },
  input: {
    color: C.text,
    fontSize: 13,
    paddingVertical: 7,
    flex: 1,
    textAlign: "right",
  },
  inputMono: {
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    fontSize: 12.5,
    fontWeight: "600",
  },
  inputUnit: {
    fontSize: 11,
    fontWeight: "700",
    color: C.amber,
    marginLeft: 5,
  },

  // ── Segment ────────────────────────────────────────────────────────────────
  segment: {
    flexDirection: "row",
    backgroundColor: C.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    padding: 3,
    gap: 2,
  },
  segBtn: {
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 7,
  },
  segBtnActive: {
    backgroundColor: C.surfaceHi,
    borderWidth: 1,
    borderColor: C.amber + "66",
  },
  segText: {
    fontSize: 11,
    color: C.sub,
    fontWeight: "600",
  },
  segTextActive: {
    color: C.amber,
    fontWeight: "800",
  },

  // ── Threshold legend ───────────────────────────────────────────────────────
  thresholdLegend: {
    flexDirection: "row",
    gap: 14,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 9.5,
    color: C.sub,
    fontWeight: "700",
    letterSpacing: 0.8,
  },

  // ── Ping dot ───────────────────────────────────────────────────────────────
  pingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // ── Ghost button ───────────────────────────────────────────────────────────
  ghostBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: C.amber + "66",
    backgroundColor: C.amber + "1A",
    minWidth: 70,
    justifyContent: "center",
  },
  ghostBtnDisabled: {
    opacity: 0.5,
  },
  ghostBtnText: {
    fontSize: 12,
    color: C.amber,
    fontWeight: "700",
  },

  // ── About rows ─────────────────────────────────────────────────────────────
  aboutRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  aboutLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  aboutKey: {
    fontSize: 13,
    color: C.sub,
    fontWeight: "500",
  },
  aboutVal: {
    fontSize: 12.5,
    color: C.text,
    fontWeight: "600",
  },

  // ── Save button ────────────────────────────────────────────────────────────
  saveBtn: {
    borderRadius: 15,
    overflow: "hidden",
    marginTop: 4,
    shadowColor: C.amber,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  saveBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingVertical: 15,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#000",
    letterSpacing: 0.3,
  },

  // ── Saved toast ────────────────────────────────────────────────────────────
  savedToast: {
    position: "absolute",
    bottom: 28,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#161B22FA",
    borderWidth: 1,
    borderColor: C.safe + "80",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 22,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  savedToastText: {
    fontSize: 13,
    color: C.safe,
    fontWeight: "700",
  },

  // ── Backend Selector Styles ────────────────────────────────────────────────
  backendTabContainer: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: "space-between",
  },
  backendTab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surfaceHi,
    alignItems: "center",
    justifyContent: "center",
  },
  backendTabActive: {
    borderColor: C.amber,
    backgroundColor: C.amber + "1F",
  },
  backendTabText: {
    fontSize: 10,
    fontWeight: "700",
    color: C.sub,
  },
  backendTabTextActive: {
    color: C.amber,
    fontWeight: "800",
  },

  // URL Display box
  urlContainer: {
    marginHorizontal: 16,
    marginBottom: 6,
    backgroundColor: C.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    padding: 10,
  },
  urlHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  urlBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  urlBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: C.teal,
    letterSpacing: 1,
  },
  urlEnvText: {
    fontSize: 9.5,
    color: C.muted,
  },
  urlValue: {
    color: C.text,
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    fontSize: 11,
    fontWeight: "500",
  },
});
