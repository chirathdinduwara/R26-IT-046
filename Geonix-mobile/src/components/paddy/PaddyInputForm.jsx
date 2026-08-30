import React from "react";
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { Ionicons } from "@expo/vector-icons";

import paddyHero from "../../assets/paddy-hero.png";
import paddyFormBackground from "../../assets/paddy-form-background.jpg";
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
      <View style={styles.formLanguageRow}>
        <View style={styles.formLanguagePill}>
          <Ionicons name="language-outline" size={17} color="#27763b" />
          <TouchableOpacity
            style={[
              styles.formLanguageOption,
              language === "en" && styles.formLanguageOptionActive,
            ]}
            onPress={() => setLanguage("en")}
          >
            <Text
              style={[
                styles.formLanguageText,
                language === "en" && styles.formLanguageTextActive,
              ]}
            >
              English
            </Text>
          </TouchableOpacity>
          <View style={styles.formLanguageDivider} />
          <TouchableOpacity
            style={[
              styles.formLanguageOption,
              language === "si" && styles.formLanguageOptionActive,
            ]}
            onPress={() => setLanguage("si")}
          >
            <Text
              style={[
                styles.formLanguageText,
                language === "si" && styles.formLanguageTextActive,
              ]}
            >
              {sinhalaLanguageName}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ImageBackground
        source={paddyFormBackground}
        style={styles.formHeroBanner}
        imageStyle={styles.formHeroImageStyle}
        resizeMode="cover"
      >
        <View style={styles.formHeroOverlay} />
        <View style={styles.formHeroImageCircle}>
          <Image
            source={paddyHero}
            style={styles.formHeroImage}
            resizeMode="contain"
          />
        </View>
        <View style={styles.formHeroContent}>
          <Text style={styles.formHeroTitle}>{text.newPrediction}</Text>
          <Text style={styles.formHeroSubtitle}>{text.formSubtitle}</Text>
        </View>
      </ImageBackground>

      <View style={styles.enhancedFormCard}>
        <FormSectionHeader
          icon="location-outline"
          title={text.locationDetails}
        />

        <Text style={styles.enhancedLabel}>{text.district}</Text>
        <PickerField icon="business-outline">
          <Picker selectedValue={district} onValueChange={setDistrict}>
            {districts.map((item) => (
              <Picker.Item
                key={String(item)}
                label={String(item)}
                value={item}
              />
            ))}
          </Picker>
        </PickerField>

        <Text style={styles.enhancedLabel}>{text.city}</Text>
        <PickerField icon="location-outline">
          <Picker selectedValue={city} onValueChange={setCity}>
            {cities.map((item) => (
              <Picker.Item
                key={String(item)}
                label={String(item)}
                value={item}
              />
            ))}
          </Picker>
        </PickerField>

        <View style={styles.formSectionSpacing} />
        <FormSectionHeader
          icon="calendar-outline"
          title={text.cultivationDetails}
        />

        <Text style={styles.enhancedLabel}>{text.season}</Text>
        <PickerField icon="partly-sunny-outline">
          <Picker selectedValue={season} onValueChange={setSeason}>
            <Picker.Item label={text.yala} value="Yala" />
            <Picker.Item label={text.maha} value="Maha" />
          </Picker>
        </PickerField>

        <Text style={styles.enhancedLabel}>{text.farmSize}</Text>
        <UnitInput
          icon="leaf-outline"
          value={farmSize}
          onChangeText={setFarmSize}
          placeholder="2"
          unit="ha"
        />

        <Text style={styles.enhancedLabel}>{text.cropWeek}</Text>
        <UnitInput
          icon="calendar-number-outline"
          value={cropWeek}
          onChangeText={setCropWeek}
          placeholder="3"
          unit={text.week}
        />

        <TouchableOpacity
          style={[
            styles.enhancedPredictButton,
            loading && styles.buttonDisabled,
          ]}
          onPress={handlePredict}
          disabled={loading}
          activeOpacity={0.82}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Ionicons name="leaf-outline" size={23} color="#ffffff" />
              <Text style={styles.enhancedPredictButtonText}>
                {text.getPrediction}
              </Text>
              <View style={styles.predictArrowCircle}>
                <Ionicons name="arrow-forward" size={21} color="#26773b" />
              </View>
            </>
          )}
        </TouchableOpacity>
      </View>
    </>
  );
}

function FormSectionHeader({ icon, title }) {
  return (
    <View style={styles.formSectionHeader}>
      <View style={styles.formSectionIcon}>
        <Ionicons name={icon} size={21} color="#338749" />
      </View>
      <Text style={styles.formSectionTitle}>{title}</Text>
      <View style={styles.formSectionLine} />
    </View>
  );
}

function PickerField({ icon, children }) {
  return (
    <View style={styles.enhancedField}>
      <View style={styles.enhancedFieldIcon}>
        <Ionicons name={icon} size={19} color="#3c8b4c" />
      </View>
      <View style={styles.enhancedPicker}>{children}</View>
    </View>
  );
}

function UnitInput({ icon, value, onChangeText, placeholder, unit }) {
  return (
    <View style={styles.enhancedField}>
      <View style={styles.enhancedFieldIcon}>
        <Ionicons name={icon} size={19} color="#3c8b4c" />
      </View>
      <TextInput
        style={styles.enhancedInput}
        value={value}
        onChangeText={onChangeText}
        keyboardType="numeric"
        placeholder={placeholder}
        placeholderTextColor="#8a948d"
      />
      <View style={styles.inputUnitBox}>
        <Text style={styles.inputUnitText}>{unit}</Text>
      </View>
    </View>
  );
}
