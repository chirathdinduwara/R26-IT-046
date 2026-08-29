import React from "react";
import {
  ActivityIndicator,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { ArrowLeft } from "lucide-react-native";

import styles from "../../styles/paddyStyles";

export default function PaddyInputForm({
  districts,
  cities,
  district,
  setDistrict,
  city,
  setCity,
  season,
  setSeason,
  farmSize,
  setFarmSize,
  cropWeek,
  setCropWeek,
  loading,
  handlePredict,
  language,
  setLanguage,
  text,
  sinhalaLanguageName,
}) {
  return (
    <>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => console.log("Back pressed")}>
          <ArrowLeft size={26} color="#111" />
        </TouchableOpacity>

        <Text style={styles.pageTitle}>{text.newPrediction}</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.langTabs}>
        <TouchableOpacity
          style={language === "en" ? styles.langActive : styles.langInactive}
          onPress={() => setLanguage("en")}
        >
          <Text
            style={
              language === "en"
                ? styles.langActiveText
                : styles.langInactiveText
            }
          >
            English
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={language === "si" ? styles.langActive : styles.langInactive}
          onPress={() => setLanguage("si")}
        >
          <Text
            style={
              language === "si"
                ? styles.langActiveText
                : styles.langInactiveText
            }
          >
            {sinhalaLanguageName}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.label}>{text.district}</Text>
        <View style={styles.pickerBox}>
          <Picker selectedValue={district} onValueChange={setDistrict}>
            {districts.map((item) => (
              <Picker.Item
                key={String(item)}
                label={String(item)}
                value={item}
              />
            ))}
          </Picker>
        </View>

        <Text style={styles.label}>{text.city}</Text>
        <View style={styles.pickerBox}>
          <Picker selectedValue={city} onValueChange={setCity}>
            {cities.map((item) => (
              <Picker.Item
                key={String(item)}
                label={String(item)}
                value={item}
              />
            ))}
          </Picker>
        </View>

        <Text style={styles.label}>{text.season}</Text>
        <View style={styles.pickerBox}>
          <Picker selectedValue={season} onValueChange={setSeason}>
            <Picker.Item label={text.yala} value="Yala" />
            <Picker.Item label={text.maha} value="Maha" />
          </Picker>
        </View>

        <Text style={styles.label}>{text.farmSize}</Text>
        <TextInput
          style={styles.input}
          value={farmSize}
          onChangeText={setFarmSize}
          keyboardType="numeric"
          placeholder="2"
          placeholderTextColor="#888"
        />

        <Text style={styles.label}>{text.cropWeek}</Text>
        <TextInput
          style={styles.input}
          value={cropWeek}
          onChangeText={setCropWeek}
          keyboardType="numeric"
          placeholder="3"
          placeholderTextColor="#888"
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handlePredict}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{text.getPrediction}</Text>
          )}
        </TouchableOpacity>
      </View>
    </>
  );
}
