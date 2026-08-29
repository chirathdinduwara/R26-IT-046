import styles from "../styles/paddyStyles";

export function getDisplayAdvisory(result, language) {
  if (!result) {
    return "";
  }

  if (language === "si") {
    return result.Advisory_Sinhala || result.Advisory || "";
  }

  return result.Advisory_English || result.Advisory || "";
}

export function cleanMarkdown(text) {
  if (!text || typeof text !== "string") {
    return "";
  }

  return text.replace(/\*\*/g, "").replace(/###/g, "").trim();
}

export function splitAdvisory(text) {
  const clean = cleanMarkdown(text);

  if (!clean) {
    return [];
  }

  // Gemini normally returns four numbered sections. Splitting at each
  // numbered heading also works when it omits blank lines between sections.
  const numberedSections = clean
    .split(/(?=^\s*\d+\s*[.)]\s+)/gm)
    .map((section) => section.trim())
    .filter(Boolean);

  const sections =
    numberedSections.length > 1
      ? numberedSections
      : clean
          .split(/\n\s*\n/)
          .map((section) => section.trim())
          .filter(Boolean);

  if (sections.length <= 1) {
    return [
      {
        title: "Advisory",
        text: clean,
      },
    ];
  }

  return sections.map((section) => {
    const lines = section
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    // The coloured icon replaces the visible 1, 2, 3 or 4 prefix.
    const title = (lines[0] || "Advice")
      .replace(/^\s*\d+\s*[.)\-:]\s*/, "")
      .trim();

    const body = lines.slice(1).join(" ");

    return {
      title,
      text: body || title,
    };
  });
}

export function formatForecastDay(date) {
  if (!date) {
    return "\u2014";
  }

  try {
    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
      return "\u2014";
    }

    return parsed.toLocaleDateString("en-US", {
      weekday: "short",
    });
  } catch (error) {
    return "\u2014";
  }
}

export function formatNumber(value, decimalPlaces = 0) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "\u2014";
  }

  return numericValue.toLocaleString("en-US", {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  });
}

export function getRiskSummary(riskLevel, language) {
  const risk = String(riskLevel || "").toLowerCase();

  if (language === "si") {
    if (risk.includes("drought")) {
      return "අඩු වර්ෂාපතනය නිසා ජල හිඟයක් ඇති විය හැක.";
    }
    if (risk.includes("flood")) {
      return "අධික වර්ෂාපතනය නිසා ගංවතුර අවදානම වැඩි විය හැක.";
    }
    if (risk.includes("heat")) {
      return "ඉහළ උෂ්ණත්වය වගාවට පීඩනයක් ඇති කළ හැක.";
    }
    return "කාලගුණය සෞඛ්‍ය සම්පන්න වගා වර්ධනයට සුදුසුය.";
  }

  if (risk.includes("drought")) {
    return "Low rainfall may cause water stress.";
  }
  if (risk.includes("flood")) {
    return "High rainfall may increase flood risk.";
  }
  if (risk.includes("heat")) {
    return "High temperature may stress the crop.";
  }
  return "Weather is suitable for healthy crop growth.";
}

export function getRiskTheme(riskLevel) {
  const risk = String(riskLevel || "").toLowerCase();

  if (risk.includes("drought")) {
    return {
      accent: "#d88a08",
      background: "#fff3dc",
      title: "#a75f00",
    };
  }

  if (risk.includes("flood")) {
    return {
      accent: "#287fc0",
      background: "#e8f4fc",
      title: "#17699f",
    };
  }

  if (risk.includes("heat")) {
    return {
      accent: "#dc5b32",
      background: "#fff0eb",
      title: "#b23e20",
    };
  }

  return {
    accent: "#2e9b4b",
    background: "#eaf8ee",
    title: "#176d33",
  };
}

export function getLocalizedRiskLabel(riskLevel, language) {
  if (!riskLevel) {
    return "\u2014";
  }

  if (language !== "si") {
    return riskLevel;
  }

  const risk = String(riskLevel).toLowerCase();

  if (risk.includes("drought")) return "නියං අවදානම";
  if (risk.includes("flood")) return "ගංවතුර අවදානම";
  if (risk.includes("heat")) return "උෂ්ණත්ව පීඩනය";
  return "අඩු අවදානම";
}

export function getLocalizedCropStage(cropStage, language) {
  if (!cropStage) {
    return "\u2014";
  }

  if (language !== "si") {
    return cropStage;
  }

  const stage = String(cropStage).toLowerCase();

  if (stage.includes("establishment")) return "ස්ථාපන අදියර";
  if (stage.includes("tillering")) return "පඳුරු දැමීම";
  if (stage.includes("panicle")) return "කරල් ආරම්භක අදියර";
  if (stage.includes("grain")) return "ධාන්‍ය පිරීම";
  if (stage.includes("maturity")) return "පරිණත අදියර";
  return cropStage;
}

export function getFertilizerTheme(name) {
  const themes = {
    Urea: { accent: "#288d47", background: "#e5f5e9" },
    TSP: { accent: "#e97819", background: "#fff0e2" },
    MOP: { accent: "#16855d", background: "#e2f4ed" },
    Zinc: { accent: "#d69708", background: "#fff4d8" },
  };

  return themes[name] || themes.Urea;
}

export function getSoilReaction(pH, language) {
  const numericPH = Number(pH);

  if (!Number.isFinite(numericPH)) {
    return {
      label: "\u2014",
      style: styles.soilStatusUnknown,
    };
  }

  if (numericPH < 5.5) {
    return {
      label: language === "si" ? "ආම්ලික" : "Acidic",
      style: styles.soilStatusAcidic,
    };
  }

  if (numericPH > 7.5) {
    return {
      label: language === "si" ? "ක්ෂාරීය" : "Alkaline",
      style: styles.soilStatusAlkaline,
    };
  }

  return {
    label: language === "si" ? "මධ්‍යස්ථ පරාසය" : "Moderate range",
    style: styles.soilStatusModerate,
  };
}
