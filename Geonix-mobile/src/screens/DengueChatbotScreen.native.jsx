import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

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
  const [messages, setMessages] = useState([
    {
      id: "welcome",
      role: "assistant",
      text: "Hi! I can help with dengue safety guidance. Send a message to get recommendation tabs.",
      showAdvice: false,
    },
  ]);

  const sendMessage = () => {
    const prompt = input.trim();
    if (!prompt) {
      return;
    }
    const timeId = Date.now();
    setMessages((prev) => [
      ...prev,
      { id: `u-${timeId}`, role: "user", text: prompt, showAdvice: false },
      {
        id: `a-${timeId}`,
        role: "assistant",
        text: "Here are recommended dengue actions based on your request.",
        showAdvice: true,
      },
    ]);
    setInput("");
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
          <Text style={styles.headerTitle}>Dengue Assistant (UI Preview)</Text>
          <Text style={styles.headerSub}>
            Gemini integration can be plugged in later without UI changes.
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
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask about dengue safety..."
          placeholderTextColor={C.sub}
          style={styles.input}
          multiline
        />
        <Pressable style={styles.sendButton} onPress={sendMessage}>
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
    maxWidth: "95%",
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: C.amberDim + "55",
    borderColor: C.amber,
  },
  assistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: C.surface,
    borderColor: C.border,
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
