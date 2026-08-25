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
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { API_BASE_URL } from "../config/api";

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
};

// ── Theme ─────────────────────────────────────────────────────────────────────
const C = {
  bg: "#0D1117",
  surface: "#161B22",
  surfaceHi: "#21262D",
  border: "#30363D",
  amber: "#F0A500",
  amberDim: "#7A5200",
  teal: "#39D5C6",
  tealDim: "#1A6B65",
  danger: "#F85149",
  safe: "#3FB950",
  text: "#E6EDF3",
  sub: "#8B949E",
  muted: "#484F58",
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeader({ icon, label, accent = C.amber }) {
  return (
    <View style={styles.sectionHeader}>
      <View
        style={[styles.sectionIconWrap, { backgroundColor: accent + "22" }]}
      >
        <MaterialCommunityIcons name={icon} size={15} color={accent} />
      </View>
      <Text style={[styles.sectionLabel, { color: accent }]}>{label}</Text>
      <View style={[styles.sectionLine, { backgroundColor: accent + "33" }]} />
    </View>
  );
}

function SettingRow({ label, sub, children, last }) {
  return (
    <View style={[styles.row, last && styles.rowLast]}>
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
  monospace,
}) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      style={[
        styles.input,
        monospace && styles.inputMono,
        focused && styles.inputFocused,
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
      trackColor={{ false: C.border, true: C.amberDim }}
      thumbColor={value ? C.amber : C.muted}
      ios_backgroundColor={C.border}
    />
  );
}

function PingDot({ status }) {
  // status: "idle" | "checking" | "ok" | "fail"
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
        ]),
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
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.delay(1400),
        Animated.timing(saveAnim, {
          toValue: 0,
          duration: 200,
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
      ],
    );
  };

  // ── Ping API ──────────────────────────────────────────────────────────────
  const pingApi = async () => {
    setPingStatus("checking");
    setPingMs(null);
    const start = Date.now();
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    try {
      const res = await fetch(`${API_BASE_URL}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error("non-2xx");
      setPingMs(Date.now() - start);
      setPingStatus("ok");
    } catch (err) {
      clearTimeout(timeoutId);
      console.log("Ping failed:", err);
      setPingStatus("fail");
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconWrap}>
            <MaterialCommunityIcons
              name="tune-variant"
              size={18}
              color={C.amber}
            />
          </View>
          <View>
            <Text style={styles.headerTitle}>Settings</Text>
            <Text style={styles.headerSub}>Flood Monitor · Kelani Basin</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.resetBtn}
          onPress={handleReset}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="restore" size={15} color={C.sub} />
          <Text style={styles.resetText}>Reset</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ════════ SERVER ════════ */}
        <SectionHeader icon="server-network" label="SERVER" />

         <View style={styles.card}>
          <SettingRow
            label="API Base URL"
            sub="Configured in .env file"
          >
            <Text style={{ color: C.text, fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace", fontSize: 13 }}>
              {API_BASE_URL}
            </Text>
          </SettingRow>

          {/* Ping row */}
          <View style={[styles.row, styles.rowLast]}>
            <View style={styles.rowLeft}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 7 }}
              >
                <PingDot status={pingStatus} />
                <Text style={styles.rowLabel}>Connection</Text>
              </View>
              <Text style={styles.rowSub}>
                {pingStatus === "ok"
                  ? `Online · ${pingMs}ms`
                  : pingStatus === "fail"
                    ? "Unreachable"
                    : pingStatus === "checking"
                      ? "Pinging…"
                      : "Not tested"}
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
                    size={13}
                    color={C.amber}
                  />
                  <Text style={styles.ghostBtnText}>Test</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ════════ ALERT THRESHOLDS ════════ */}
        <SectionHeader
          icon="water-alert"
          label="ALERT THRESHOLDS"
          accent={C.danger}
        />

        <View style={styles.card}>
          <View style={styles.thresholdLegend}>
            {[
              { color: "#c0392b", label: "DANGER" },
              { color: "#e67e22", label: "ALERT" },
              { color: "#f1c40f", label: "WATCH" },
            ].map((item) => (
              <View key={item.label} style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: item.color }]}
                />
                <Text style={styles.legendText}>{item.label}</Text>
              </View>
            ))}
          </View>

          <SettingRow label="Danger level (m)" sub="River exceeds safe limits">
            <StyledInput
              value={settings.dangerThreshold}
              onChangeText={(v) => patch("dangerThreshold", v)}
              placeholder="10.0"
              keyboardType="decimal-pad"
              monospace
            />
          </SettingRow>
          <SettingRow label="Alert level (m)" sub="Elevated risk zone">
            <StyledInput
              value={settings.alertThreshold}
              onChangeText={(v) => patch("alertThreshold", v)}
              placeholder="8.0"
              keyboardType="decimal-pad"
              monospace
            />
          </SettingRow>
          <SettingRow label="Watch level (m)" sub="Monitor closely" last>
            <StyledInput
              value={settings.watchThreshold}
              onChangeText={(v) => patch("watchThreshold", v)}
              placeholder="6.5"
              keyboardType="decimal-pad"
              monospace
            />
          </SettingRow>
        </View>

        {/* ════════ NOTIFICATIONS ════════ */}
        <SectionHeader
          icon="bell-ring-outline"
          label="NOTIFICATIONS"
          accent={C.teal}
        />

        <View style={styles.card}>
          <SettingRow label="Danger alerts" sub="Notify when level ≥ danger">
            <StyledSwitch
              value={settings.notifyDanger}
              onValueChange={(v) => patch("notifyDanger", v)}
            />
          </SettingRow>
          <SettingRow
            label="Alert-level notices"
            sub="Notify when level ≥ alert"
          >
            <StyledSwitch
              value={settings.notifyAlert}
              onValueChange={(v) => patch("notifyAlert", v)}
            />
          </SettingRow>
          <SettingRow
            label="Watch-level notices"
            sub="Notify when level ≥ watch"
            last
          >
            <StyledSwitch
              value={settings.notifyWatch}
              onValueChange={(v) => patch("notifyWatch", v)}
            />
          </SettingRow>
        </View>

        {/* ════════ LOCATION ════════ */}
        <SectionHeader icon="crosshairs-gps" label="LOCATION" accent={C.teal} />

        <View style={styles.card}>
          <SettingRow
            label="GPS Accuracy"
            sub="Higher accuracy uses more battery"
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
            sub="Run safety check when app opens"
            last
          >
            <StyledSwitch
              value={settings.autoCheckOnLaunch}
              onValueChange={(v) => patch("autoCheckOnLaunch", v)}
            />
          </SettingRow>
        </View>

        {/* ════════ MAP DISPLAY ════════ */}
        <SectionHeader icon="map-outline" label="MAP DISPLAY" />

        <View style={styles.card}>
          <SettingRow label="Map Style" sub="Base layer type">
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
            sub="Show severity text on polygons"
          >
            <StyledSwitch
              value={settings.showFloodZoneLabels}
              onValueChange={(v) => patch("showFloodZoneLabels", v)}
            />
          </SettingRow>
          <SettingRow
            label="Polygon opacity (%)"
            sub="0 = transparent · 100 = solid"
            last
          >
            <StyledInput
              value={settings.polygonOpacity}
              onChangeText={(v) => patch("polygonOpacity", v)}
              placeholder="40"
              keyboardType="number-pad"
              monospace
            />
          </SettingRow>
        </View>

        {/* ════════ DATA ════════ */}
        <SectionHeader icon="database-refresh-outline" label="DATA" />

        <View style={styles.card}>
          <SettingRow
            label="Refresh interval (min)"
            sub="Background prediction refresh rate"
            last
          >
            <StyledInput
              value={settings.refreshIntervalMin}
              onChangeText={(v) => patch("refreshIntervalMin", v)}
              placeholder="15"
              keyboardType="number-pad"
              monospace
            />
          </SettingRow>
        </View>

        {/* ════════ ABOUT ════════ */}
        <SectionHeader
          icon="information-outline"
          label="ABOUT"
          accent={C.sub}
        />

        <View style={styles.card}>
          {[
            { label: "App", value: "Flood Monitor" },
            { label: "Version", value: "1.0.0" },
            { label: "Region", value: "Kelani Basin, LK" },
            { label: "Data", value: "Open-Meteo · IRD" },
            {
              label: "Platform",
              value: Platform.OS === "ios" ? "iOS" : "Android",
            },
          ].map((item, i, arr) => (
            <View
              key={item.label}
              style={[styles.aboutRow, i === arr.length - 1 && styles.rowLast]}
            >
              <Text style={styles.aboutKey}>{item.label}</Text>
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
          <MaterialCommunityIcons
            name="content-save-outline"
            size={18}
            color="#000"
          />
          <Text style={styles.saveBtnText}>Save Settings</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Saved toast ──────────────────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.savedToast,
          {
            opacity: saveAnim,
            transform: [
              {
                translateY: saveAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [10, 0],
                }),
              },
            ],
          },
        ]}
        pointerEvents="none"
      >
        <MaterialCommunityIcons name="check-circle" size={15} color={C.safe} />
        <Text style={styles.savedToastText}>Settings saved</Text>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Platform.OS === "ios" ? 58 : 18,
    paddingBottom: 14,
    paddingHorizontal: 20,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.amberDim + "55",
    borderWidth: 1,
    borderColor: C.amberDim,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: C.text,
    letterSpacing: 0.2,
  },
  headerSub: {
    fontSize: 11,
    color: C.sub,
    marginTop: 1,
    letterSpacing: 0.3,
  },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  resetText: {
    fontSize: 12,
    color: C.sub,
    fontWeight: "600",
  },

  // ── Scroll ─────────────────────────────────────────────────────────────────
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20 },

  // ── Section header ─────────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
    marginTop: 6,
  },
  sectionIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
  },
  sectionLine: {
    flex: 1,
    height: 1,
  },

  // ── Card ───────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 20,
    overflow: "hidden",
  },

  // ── Row ────────────────────────────────────────────────────────────────────
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 12,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowLeft: {
    flex: 1,
    gap: 2,
  },
  rowRight: {
    flexShrink: 0,
  },
  rowLabel: {
    fontSize: 14,
    color: C.text,
    fontWeight: "500",
  },
  rowSub: {
    fontSize: 11,
    color: C.sub,
    lineHeight: 15,
  },

  // ── Input ──────────────────────────────────────────────────────────────────
  input: {
    backgroundColor: C.surfaceHi,
    color: C.text,
    fontSize: 13,
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    minWidth: 120,
    textAlign: "right",
  },
  inputMono: {
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    fontSize: 12,
  },
  inputFocused: {
    borderColor: C.amber,
  },

  // ── Segment ────────────────────────────────────────────────────────────────
  segment: {
    flexDirection: "row",
    backgroundColor: C.surfaceHi,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
  },
  segBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  segBtnActive: {
    backgroundColor: C.amberDim,
  },
  segText: {
    fontSize: 11,
    color: C.sub,
    fontWeight: "600",
  },
  segTextActive: {
    color: C.amber,
  },

  // ── Threshold legend ───────────────────────────────────────────────────────
  thresholdLegend: {
    flexDirection: "row",
    gap: 16,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
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
    fontSize: 10,
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
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.amberDim,
    backgroundColor: C.amberDim + "33",
    minWidth: 64,
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
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  aboutKey: {
    fontSize: 13,
    color: C.sub,
    fontWeight: "500",
  },
  aboutVal: {
    fontSize: 13,
    color: C.text,
    fontWeight: "600",
  },

  // ── Save button ────────────────────────────────────────────────────────────
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    backgroundColor: C.amber,
    borderRadius: 14,
    paddingVertical: 15,
    marginTop: 4,
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
    bottom: 30,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: C.surfaceHi,
    borderWidth: 1,
    borderColor: C.safe + "66",
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  savedToastText: {
    fontSize: 13,
    color: C.safe,
    fontWeight: "600",
  },
});
