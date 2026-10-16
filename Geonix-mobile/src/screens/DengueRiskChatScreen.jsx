import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { DENGUE_API_URL } from "../config/api";

const ADVICE_TABS = [
  { key: "do_now", label: "What to do now", icon: "lightning-bolt-outline" },
  { key: "prevent", label: "How to prevent", icon: "shield-check-outline" },
  { key: "reduce", label: "How to reduce", icon: "arrow-down-circle-outline" },
];

const QUICK_PROMPTS = [
  { icon: "thermometer", text: "What are the symptoms of dengue?" },
  {
    icon: "water-off-outline",
    text: "How do I stop mosquito breeding at home?",
  },
  { icon: "shield-check-outline", text: "How to prevent dengue in my area?" },
  { icon: "hospital-box-outline", text: "When should I see a doctor?" },
];

const FALLBACK_PREVENTION = {
  do_now: [
    "Check around your home for stagnant water containers and empty them.",
    "Use mosquito repellent and wear full-cover clothing in morning/evening.",
    "If fever starts, seek medical care early and avoid self-medication.",
  ],
  prevent: [
    "Clean water storage containers weekly and keep them tightly covered.",
    "Keep gutters, drains, and roof channels clear of blockages.",
    "Coordinate weekly neighborhood clean-up for mosquito breeding control.",
  ],
  reduce: [
    "Protect infected family members from mosquito bites to reduce spread.",
    "Use nets/screens and remove indoor mosquito resting spots.",
    "Report persistent mosquito hotspots to local health authorities.",
  ],
};

const C = {
  bg: "#080C12",
  surface: "#111720",
  surfaceHi: "#1A2030",
  border: "#252D3D",
  borderLight: "#2E3850",
  text: "#EEF2FF",
  textSoft: "#C8D0E0",
  sub: "#6B7A99",
  subLight: "#8896B8",
  amber: "#F5A623",
  amberDim: "#7A4A00",
  amberGlow: "rgba(245, 166, 35, 0.16)",
  low: "#30D158",
  teal: "#39D5C6",
};

function normalizeAdvice(data, key) {
  if (!Array.isArray(data?.[key]) || data[key].length === 0) {
    return FALLBACK_PREVENTION[key];
  }
  return data[key];
}

function normalizeBaseUrl(value) {
  if (typeof value !== "string") return "";
  let normalized = value.trim();
  if (!normalized) return "";
  normalized = normalized
    .replace(/^httpx:\/\//i, "http://")
    .replace(/^httpsx:\/\//i, "https://");
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(normalized)) {
    normalized = `http://${normalized}`;
  }
  return normalized.replace(/\/+$/, "");
}

async function resolveApiBaseUrl() {
  return normalizeBaseUrl(DENGUE_API_URL);
}

/* ───────────────────────── small UI components ───────────────────────── */

function BotAvatar({ size = 34, showOnline = false }) {
  return (
    <View style={{ width: size, height: size }}>
      <LinearGradient
        colors={["#FFC857", C.amber, "#C77700"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.avatar,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
      >
        <MaterialCommunityIcons
          name="robot-happy-outline"
          size={size * 0.56}
          color={C.bg}
        />
      </LinearGradient>
      {showOnline ? <View style={styles.onlineDot} /> : null}
    </View>
  );
}

function TypingDots() {
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const loops = dots.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(v, {
            toValue: 1,
            duration: 320,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0,
            duration: 320,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.delay(320 - i * 160),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [dots]);

  return (
    <View style={styles.typingRow}>
      {dots.map((v, i) => (
        <Animated.View
          key={i}
          style={[
            styles.typingDot,
            {
              opacity: v.interpolate({
                inputRange: [0, 1],
                outputRange: [0.35, 1],
              }),
              transform: [
                {
                  translateY: v.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -4],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

/* ───────────────────────────────── screen ───────────────────────────────── */

export default function DengueRiskChatScreen({ route }) {
  const scrollRef = useRef(null);

  const prevention = useMemo(() => {
    const source = route?.params?.prevention || {};
    return {
      do_now: normalizeAdvice(source, "do_now"),
      prevent: normalizeAdvice(source, "prevent"),
      reduce: normalizeAdvice(source, "reduce"),
    };
  }, [route?.params?.prevention]);

  const [activeTab, setActiveTab] = useState("do_now");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: "welcome",
      role: "assistant",
      text: "Hi! I am your Dengue Safety AI Assistant. Ask me anything about symptoms, local vector prevention, or health guidelines.",
      showAdvice: false,
    },
  ]);

  // optional `override` lets the quick-prompt chips send a message directly
  const sendMessage = async (override) => {
    const prompt = (typeof override === "string" ? override : input).trim();
    if (!prompt || loading) {
      return;
    }
    const timeId = Date.now();

    setMessages((prev) => [
      ...prev,
      { id: `u-${timeId}`, role: "user", text: prompt },
    ]);
    setInput("");
    setLoading(true);

    try {
      // const baseUrl = await resolveApiBaseUrl();
      const history = messages
        .filter((m) => m.id !== "welcome")
        .map((m) => ({
          role: m.role,
          text: m.text,
        }));

      const baseUrl = "https://r26-it-046-production-685e.up.railway.app";

      const response = await fetch(`${baseUrl}/dengue/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          message: prompt,
          history: history,
        }),
      });
      console.log("FULL URL:", `${baseUrl}/dengue/chat`);

      if (!response.ok) {
        throw new Error("Failed to get chat response");
      }

      const resData = await response.json();

      const pLower = prompt.toLowerCase();
      const showAdvice =
        pLower.includes("prevent") ||
        pLower.includes("breed") ||
        pLower.includes("water") ||
        pLower.includes("habit") ||
        pLower.includes("reduce") ||
        pLower.includes("symptom");

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${timeId}`,
          role: "assistant",
          text: resData.response,
          showAdvice: showAdvice,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${timeId}`,
          role: "assistant",
          text: "I had trouble connecting to the Dengue Safety API. Please verify your connection and try again.",
          showAdvice: false,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const canSend = input.trim().length > 0 && !loading;
  const showQuickPrompts = messages.length === 1 && !loading;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* soft amber glow behind the header */}
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(245,166,35,0.12)", "rgba(8,12,18,0)"]}
        style={styles.topGlow}
      />

      {/* ── Header card ── */}
      <View style={styles.headerCard}>
        <BotAvatar size={46} showOnline />
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>Dengue AI Safety Assistant</Text>
          <View style={styles.headerStatusRow}>
            <Text style={styles.headerSub} numberOfLines={1}>
              Powered by Gemini AI
            </Text>
          </View>
        </View>
      </View>

      {/* ── Chat ── */}
      <ScrollView
        ref={scrollRef}
        style={styles.chatScroll}
        contentContainerStyle={styles.chatContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() =>
          scrollRef.current?.scrollToEnd({ animated: true })
        }
      >
        {messages.map((message) => {
          const isUser = message.role === "user";
          return (
            <View
              key={message.id}
              style={[
                styles.messageRow,
                isUser ? styles.messageRowUser : styles.messageRowAssistant,
              ]}
            >
              {!isUser ? <BotAvatar size={30} /> : null}

              {isUser ? (
                <LinearGradient
                  colors={["#FFC857", C.amber]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.bubble, styles.userBubble]}
                >
                  <Text style={styles.userText}>{message.text}</Text>
                </LinearGradient>
              ) : (
                <View style={[styles.bubble, styles.assistantBubble]}>
                  <Text style={styles.assistantText}>{message.text}</Text>

                  {message.showAdvice ? (
                    <View style={styles.adviceCard}>
                      <View style={styles.adviceHeader}>
                        <MaterialCommunityIcons
                          name="clipboard-text-outline"
                          size={14}
                          color={C.amber}
                        />
                        <Text style={styles.adviceHeaderText}>
                          Quick Safety Guide
                        </Text>
                      </View>

                      <View style={styles.tabRow}>
                        {ADVICE_TABS.map((tab) => {
                          const active = activeTab === tab.key;
                          return (
                            <Pressable
                              key={tab.key}
                              onPress={() => setActiveTab(tab.key)}
                              style={[
                                styles.tabButton,
                                active && styles.tabButtonActive,
                              ]}
                            >
                              <MaterialCommunityIcons
                                name={tab.icon}
                                size={16}
                                color={active ? C.bg : C.sub}
                              />
                              <Text
                                style={[
                                  styles.tabText,
                                  active && styles.tabTextActive,
                                ]}
                                numberOfLines={2}
                              >
                                {tab.label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>

                      {prevention[activeTab].map((item, index) => (
                        <View
                          key={`${activeTab}-${index}`}
                          style={styles.adviceItem}
                        >
                          <View style={styles.adviceCheck}>
                            <MaterialCommunityIcons
                              name="check"
                              size={12}
                              color={C.amber}
                            />
                          </View>
                          <Text style={styles.adviceText}>{item}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              )}
            </View>
          );
        })}

        {/* quick prompts (only before the first question) */}
        {showQuickPrompts ? (
          <View style={styles.quickWrap}>
            <Text style={styles.quickTitle}>Try asking</Text>
            <View style={styles.quickGrid}>
              {QUICK_PROMPTS.map((q) => (
                <Pressable
                  key={q.text}
                  style={({ pressed }) => [
                    styles.quickChip,
                    pressed && styles.quickChipPressed,
                  ]}
                  onPress={() => sendMessage(q.text)}
                >
                  <View style={styles.quickIcon}>
                    <MaterialCommunityIcons
                      name={q.icon}
                      size={16}
                      color={C.amber}
                    />
                  </View>
                  <Text style={styles.quickText}>{q.text}</Text>
                  <MaterialCommunityIcons
                    name="arrow-top-right"
                    size={14}
                    color={C.sub}
                  />
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {/* typing indicator */}
        {loading ? (
          <View style={[styles.messageRow, styles.messageRowAssistant]}>
            <BotAvatar size={30} />
            <View
              style={[
                styles.bubble,
                styles.assistantBubble,
                styles.typingBubble,
              ]}
            >
              <TypingDots />
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* ── Input bar ── */}
      <View style={styles.inputWrap}>
        <View style={styles.inputRow}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask about dengue safety..."
            placeholderTextColor={C.sub}
            style={styles.input}
            multiline
            editable={!loading}
          />
          <Pressable
            onPress={() => sendMessage()}
            disabled={!canSend}
            accessibilityLabel="Send message"
          >
            {canSend ? (
              <LinearGradient
                colors={["#FFC857", C.amber, "#E58E0F"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sendButton}
              >
                <MaterialCommunityIcons name="send" size={18} color={C.bg} />
              </LinearGradient>
            ) : (
              <View style={[styles.sendButton, styles.sendButtonOff]}>
                <MaterialCommunityIcons name="send" size={18} color={C.sub} />
              </View>
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

/* ───────────────────────────────── styles ───────────────────────────────── */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  topGlow: { position: "absolute", top: 0, left: 0, right: 0, height: 220 },

  // avatar
  avatar: { alignItems: "center", justifyContent: "center" },
  onlineDot: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: C.low,
    borderWidth: 2,
    borderColor: C.surface,
  },

  // header
  headerCard: {
    marginHorizontal: 14,
    marginTop: 12,
    marginBottom: 6,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 22,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  headerTextWrap: { flex: 1, gap: 4 },
  headerTitle: {
    color: C.text,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  headerStatusRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.low },
  headerStatus: { color: C.low, fontSize: 11, fontWeight: "800" },
  headerStatusSep: { color: C.sub, fontSize: 11 },
  headerSub: {
    color: C.subLight,
    fontSize: 11,
    fontWeight: "600",
    flexShrink: 1,
  },

  // chat
  chatScroll: { flex: 1 },
  chatContent: { paddingHorizontal: 14, paddingVertical: 12, gap: 14 },
  messageRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  messageRowAssistant: { alignSelf: "flex-start", maxWidth: "92%" },
  messageRowUser: { alignSelf: "flex-end", maxWidth: "86%" },

  bubble: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexShrink: 1,
  },
  assistantBubble: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderBottomLeftRadius: 6,
  },
  userBubble: {
    borderBottomRightRadius: 6,
    shadowColor: C.amber,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  assistantText: { color: C.text, fontSize: 14, lineHeight: 21 },
  userText: { color: C.bg, fontSize: 14, lineHeight: 21, fontWeight: "700" },

  // typing
  typingBubble: { paddingVertical: 14 },
  typingRow: { flexDirection: "row", alignItems: "center", gap: 5, height: 10 },
  typingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.amber },

  // advice card
  adviceCard: {
    marginTop: 12,
    backgroundColor: C.surfaceHi,
    borderWidth: 1,
    borderColor: C.borderLight,
    borderRadius: 16,
    padding: 12,
    gap: 10,
  },
  adviceHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  adviceHeaderText: {
    color: C.amber,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  tabRow: { flexDirection: "row", gap: 6 },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  tabButtonActive: { backgroundColor: C.amber, borderColor: C.amber },
  tabText: {
    color: C.sub,
    fontSize: 10,
    fontWeight: "800",
    textAlign: "center",
  },
  tabTextActive: { color: C.bg },
  adviceItem: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  adviceCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginTop: 1,
    backgroundColor: C.amberGlow,
    borderWidth: 1,
    borderColor: C.amberDim,
    alignItems: "center",
    justifyContent: "center",
  },
  adviceText: { flex: 1, color: C.textSoft, fontSize: 12.5, lineHeight: 19 },

  // quick prompts
  quickWrap: { gap: 10, marginTop: 4 },
  quickTitle: {
    color: C.sub,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    paddingLeft: 4,
  },
  quickGrid: { gap: 8 },
  quickChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  quickChipPressed: { borderColor: C.amber, backgroundColor: C.surfaceHi },
  quickIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.amberGlow,
    alignItems: "center",
    justifyContent: "center",
  },
  quickText: { flex: 1, color: C.textSoft, fontSize: 13, fontWeight: "600" },

  // input
  inputWrap: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 24 : 12,
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderTopColor: C.border,
    gap: 8,
  },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: C.borderLight,
    backgroundColor: C.surfaceHi,
    color: C.text,
    fontSize: 14,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 13 : 10,
    paddingBottom: Platform.OS === "ios" ? 13 : 10,
    textAlignVertical: "center",
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: C.amber,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  sendButtonOff: {
    backgroundColor: C.surfaceHi,
    borderWidth: 1,
    borderColor: C.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  disclaimer: {
    color: C.sub,
    fontSize: 10.5,
    textAlign: "center",
    fontWeight: "500",
  },
});
