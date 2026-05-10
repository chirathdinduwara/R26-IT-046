import os
import json
import re
from dotenv import load_dotenv

load_dotenv(override=True)

def generate_ai_advice(context: dict):
    try:
        from google import genai

        api_key = os.getenv("GEMINI_API_KEY")
        print("Loaded Gemini key:", api_key[:15] if api_key else "NO KEY")

        client = genai.Client(api_key=api_key)

        client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

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
{chr(10).join(['- ' + r for r in context['rules']])}

In the Fertilizer / Crop management section, clearly mention the recommended fertilizer amounts. 
If risk level is Flood Risk or rainfall is high, advise delaying fertilizer application until field water conditions improve.

Return ONLY valid JSON:
{{
  "advisory_english": "1. Current condition\\n...\\n\\n2. Irrigation advice\\n...\\n\\n3. Fertilizer / Crop management\\n...\\n\\n4. Risk warning\\n...",
  "advisory_sinhala": "1. වත්මන් තත්ත්වය\\n...\\n\\n2. ජල කළමනාකරණ උපදෙස්\\n...\\n\\n3. පොහොර / වගා කළමනාකරණ උපදෙස්\\n...\\n\\n4. අවදානම් අනතුරු ඇඟවීම\\n..."
}}
Keep each language under 140 words.
"""

        response = client.models.generate_content(
            model="gemini-3-flash-preview",
            contents=prompt
        )

        text = response.text.strip()

        
        text = re.sub(r"^```json\s*", "", text)
        text = re.sub(r"^```\s*", "", text)
        text = re.sub(r"\s*```$", "", text)

        data = json.loads(text)

        return {
            "english": data.get("advisory_english", ""),
            "sinhala": data.get("advisory_sinhala", "")
        }

    except Exception as e:
        print("Gemini advisory error:", e)
        fallback = " ".join(context.get("rules", []))
        return {
            "english": fallback,
            "sinhala": "වගා තත්ත්වය නිරීක්ෂණය කරන්න. ජල සැපයුම, පොහොර යෙදීම සහ වර්ධන අදියර අනුව වගා කළමනාකරණය සිදු කරන්න."
        }