import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { DENGUE_API_URL } from "../config/api";

const ADVICE_TABS = [
  { key: "do_now", label: "What to do now" },
  { key: "prevent", label: "How to prevent" },
  { key: "reduce", label: "How to reduce" },
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
  bg: "#0D1117",
  surface: "#161B22",
  surfaceHi: "#21262D",
  border: "#30363D",
  text: "#E6EDF3",
  sub: "#8B949E",
  amber: "#F0A500",
  amberDim: "#7A5200",
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
  normalized = normalized.replace(/^httpx:\/\//i, "http://").replace(/^httpsx:\/\//i, "https://");
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(normalized)) {
    normalized = `http://${normalized}`;
  }
  return normalized.replace(/\/+$/, "");
}

async function resolveApiBaseUrl() {
  return normalizeBaseUrl(DENGUE_API_URL);
}

export default function DengueChatbotScreen({ route }) {
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
      text: "Hi! I am your Dengue Safety AI assistant. Ask me anything about symptoms, local prevention, or guidelines.",
      showAdvice: false,
    },
  ]);

  const sendMessage = async () => {
    const prompt = input.trim();
    if (!prompt || loading) {
      return;
    }
    const timeId = Date.now();
    
    // Add user message
    setMessages((prev) => [
      ...prev,
      { id: `u-${timeId}`, role: "user", text: prompt },
    ]);
    setInput("");
    setLoading(true);

    try {
      const baseUrl = await resolveApiBaseUrl();
      const history = messages
        .filter((m) => m.id !== "welcome")
        .map((m) => ({
          role: m.role,
          text: m.text,
        }));

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

      if (!response.ok) {
        throw new Error("Failed to get chat response");
      }

      const resData = await response.json();
      
      // Suggest prevention guides if the query contains breeding, prevention, or habits
      const pLower = prompt.toLowerCase();
      const showAdvice = pLower.includes("prevent") || 
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

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.headerCard}>
        <View style={styles.headerIconWrap}>
          <MaterialCommunityIcons
            name="robot-happy-outline"
            size={20}
            color={C.amber}
          />
        </View>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>Dengue Safety AI Assistant</Text>
          <Text style={styles.headerSub}>
            Live recommendations from Gemini based on local health guidelines.
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.chatScroll}
        contentContainerStyle={styles.chatContent}
      >
        {messages.map((message) => (
          <View
            key={message.id}
            style={[
              styles.messageBubble,
              message.role === "user"
                ? styles.userBubble
                : styles.assistantBubble,
            ]}
          >
            <Text
              style={[
                styles.messageText,
                message.role === "user"
                  ? styles.userText
                  : styles.assistantText,
              ]}
            >
              {message.text}
            </Text>

            {message.showAdvice ? (
              <View style={styles.adviceCard}>
                <View style={styles.tabRow}>
                  {ADVICE_TABS.map((tab) => (
                    <Pressable
                      key={tab.key}
                      onPress={() => setActiveTab(tab.key)}
                      style={[
                        styles.tabButton,
                        activeTab === tab.key && styles.tabButtonActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.tabText,
                          activeTab === tab.key && styles.tabTextActive,
                        ]}
                      >
                        {tab.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {prevention[activeTab].map((item, index) => (
                  <Text key={`${activeTab}-${index}`} style={styles.adviceText}>
                    • {item}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        ))}

        {loading ? (
          <View style={[styles.messageBubble, styles.assistantBubble, styles.loadingBubble]}>
            <ActivityIndicator size="small" color={C.amber} />
            <Text style={[styles.messageText, { color: C.sub, marginLeft: 8 }]}>AI is thinking...</Text>
          </View>
        ) : null}
      </ScrollView>

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
          style={[styles.sendButton, loading && { opacity: 0.6 }]} 
          onPress={sendMessage}
          disabled={loading}
        >
          <MaterialCommunityIcons name="send" size={18} color={C.bg} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
  },
  headerCard: {
    marginHorizontal: 14,
    marginTop: 14,
    marginBottom: 8,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    gap: 10,
  },
  headerIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.amberDim + "44",
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    color: C.text,
    fontSize: 14,
    fontWeight: "800",
  },
  headerSub: {
    marginTop: 2,
    color: C.sub,
    fontSize: 12,
    lineHeight: 17,
  },
  chatScroll: {
    flex: 1,
  },
  chatContent: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  messageBubble: {
    maxWidth: "90%",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: C.amberDim + "35",
    borderColor: C.amber,
  },
  assistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: C.surface,
    borderColor: C.border,
  },
  loadingBubble: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  messageText: {
    lineHeight: 19,
    fontSize: 13,
  },
  userText: {
    color: C.text,
  },
  assistantText: {
    color: C.text,
  },
  adviceCard: {
    marginTop: 10,
    backgroundColor: C.surfaceHi,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  tabRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tabButton: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  tabButtonActive: {
    borderColor: C.amber,
    backgroundColor: C.amberDim + "44",
  },
  tabText: {
    color: C.sub,
    fontSize: 11,
    fontWeight: "700",
  },
  tabTextActive: {
    color: C.amber,
  },
  adviceText: {
    color: C.text,
    fontSize: 12,
    lineHeight: 18,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.surface,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 110,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surfaceHi,
    color: C.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: "top",
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.amber,
    borderWidth: 1,
    borderColor: C.amberDim,
  },
});
