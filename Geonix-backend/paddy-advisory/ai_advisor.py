
import json
import os
import re

from dotenv import load_dotenv


load_dotenv(override=True)


def generate_ai_advice(context: dict):
    rules = context.get("rules", [])
    risk_level = str(context.get("risk_level", "Low Risk"))
    crop_stage = str(context.get("crop_stage", "current crop stage"))
    predicted_yield = context.get("predicted_yield", 0)
    rainfall = context.get("total_rainfall", 0)

    risk_key = risk_level.lower()
    if any(word in risk_key for word in ("flood", "drought", "heat", "high")):
        fallback_priority = "High"
    elif "medium" in risk_key or "moderate" in risk_key:
        fallback_priority = "Medium"
    else:
        fallback_priority = "Normal"

    fallback_action_english = (
        str(rules[0])
        if rules
        else "Monitor field water, crop health, and the 7-day weather forecast."
    )
    fallback_action_sinhala = (
        "ක්ෂේත්‍රයේ ජල තත්ත්වය, වගාවේ සෞඛ්‍යය සහ දින 7 කාලගුණ අනාවැකිය "
        "නිරීක්ෂණය කරන්න."
    )
    fallback_insight_english = (
        f"The crop is currently at the {crop_stage} stage with a {risk_level} "
        f"assessment. The predicted yield is {predicted_yield} kg/ha and the "
        f"7-day rainfall estimate is {rainfall} mm. Prioritize the recommended "
        "field action and monitor changes in water and crop condition."
    )
    fallback_insight_sinhala = (
        f"වගාව දැනට {crop_stage} අදියරේ පවතින අතර අවදානම් මට්ටම "
        f"{risk_level} ලෙස හඳුනාගෙන ඇත. අනුමාන අස්වැන්න {predicted_yield} "
        f"කි.ග්‍රෑ/හෙක්ටයාර් වන අතර දින 7 වර්ෂාපතනය {rainfall} මි.මී. ලෙස "
        "අපේක්ෂා කෙරේ. නිර්දේශිත ක්‍රියාවට ප්‍රමුඛත්වය දෙමින් ජල සහ වගා "
        "තත්ත්වය නිරීක්ෂණය කරන්න."
    )

    try:
        from google import genai

        api_key = os.getenv("GEMINI_API_KEY")

        if not api_key:
            raise RuntimeError("GEMINI_API_KEY is not configured.")

        client = genai.Client(api_key=api_key)
        model_name = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")

        rule_notes = "\n".join(f"- {rule}" for rule in rules)

        prompt = f"""
You are an agricultural advisory assistant for Sri Lankan paddy farmers.

Generate farmer-friendly advice in BOTH English and Sinhala.
Use only the provided data. Do not invent facts.

Farmer context:
- District: {context['district']}
- Location: {context['location']}
- Season: {context['season']}
- Crop week: {context['crop_week']}
- Crop stage: {context['crop_stage']}
- Predicted yield: {context['predicted_yield']} kg/ha
- Expected production: {context['expected_production']} tons
- Risk level: {context['risk_level']}
- Soil pH: {context['soil_pH']}
- Soil type: {context['soil_type']}
- 7-day rainfall: {context['total_rainfall']} mm
- Average temperature: {context['avg_temp']} °C

Recommended fertilizer:
- Fertilizer timing: {context.get('fertilizer_week', 'N/A')}
- Urea: {context.get('urea_kg_ha', 0)} kg/ha
- TSP: {context.get('tsp_kg_ha', 0)} kg/ha
- MOP: {context.get('mop_kg_ha', 0)} kg/ha
- Zinc: {context.get('zinc_kg_ha', 0)} kg/ha

Rule notes:
{rule_notes}

In the Fertilizer / Crop management section, clearly mention the recommended
fertilizer amounts. If the risk level is Flood Risk or rainfall is high, advise
delaying fertilizer application until field water conditions improve.

Return ONLY valid JSON:
{{
  "advisory_english": "1. Current condition\n...\n\n2. Irrigation advice\n...\n\n3. Fertilizer / Crop management\n...\n\n4. Risk warning\n...",
  "advisory_sinhala": "1. වත්මන් තත්ත්වය\n...\n\n2. ජල කළමනාකරණ උපදෙස්\n...\n\n3. පොහොර / වගා කළමනාකරණ උපදෙස්\n...\n\n4. අවදානම් අනතුරු ඇඟවීම\n...",
  "ai_insight_english": "One personalized explanation of what the combined prediction results mean, why they matter at this crop stage, and what to monitor during the next 7 days.",
  "ai_insight_sinhala": "ඒකාබද්ධ අනාවැකි ප්‍රතිඵලවල අර්ථය, මෙම වර්ධන අදියරේ ඒවා වැදගත් වන්නේ ඇයි සහ ඉදිරි දින 7 තුළ නිරීක්ෂණය කළ යුතු දේ පිළිබඳ පුද්ගලීකරණය කළ පැහැදිලි කිරීමක්.",
  "priority_level": "High, Medium, or Normal",
  "priority_action_english": "One short action the farmer should prioritize now.",
  "priority_action_sinhala": "ගොවියා දැන් ප්‍රමුඛත්වය දිය යුතු එක් කෙටි ක්‍රියාවක්."
}}

The AI insight must directly connect at least three supplied facts, such as the
crop stage, risk, rainfall, soil, fertilizer timing, or predicted yield. Explain
the reason for the priority action. Do not repeat the four advisory sections.
Do not invent or change any numeric value. Use only High, Medium, or Normal for
priority_level. Keep each advisory language under 140 words, each AI insight
under 70 words, and each priority action under 25 words.
"""

        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
        )

        text = (response.text or "").strip()
        text = re.sub(r"^```json\s*", "", text)
        text = re.sub(r"^```\s*", "", text)
        text = re.sub(r"\s*```$", "", text)

        data = json.loads(text)

        priority_level = str(
            data.get("priority_level", fallback_priority)
        ).strip().title()
        if priority_level not in {"High", "Medium", "Normal"}:
            priority_level = fallback_priority

        return {
            "english": data.get("advisory_english", ""),
            "sinhala": data.get("advisory_sinhala", ""),
            "insight_english": (
                data.get("ai_insight_english") or fallback_insight_english
            ),
            "insight_sinhala": (
                data.get("ai_insight_sinhala") or fallback_insight_sinhala
            ),
            "priority_level": priority_level,
            "priority_action_english": (
                data.get("priority_action_english")
                or fallback_action_english
            ),
            "priority_action_sinhala": (
                data.get("priority_action_sinhala")
                or fallback_action_sinhala
            ),
        }

    except Exception as error:
        print("Gemini advisory error:", error)

        fallback = " ".join(context.get("rules", []))

        return {
            "english": fallback,
            "sinhala": (
                "වගා තත්ත්වය නිරීක්ෂණය කරන්න. ජල සැපයුම, පොහොර යෙදීම සහ "
                "වර්ධන අදියර අනුව වගා කළමනාකරණය සිදු කරන්න."
            ),
            "insight_english": fallback_insight_english,
            "insight_sinhala": fallback_insight_sinhala,
            "priority_level": fallback_priority,
            "priority_action_english": fallback_action_english,
            "priority_action_sinhala": fallback_action_sinhala,
        }
