import os

def generate_ai_advice(context: dict):
    try:
        from google import genai

        client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

        prompt = f"""
You are an agricultural advisory assistant for Sri Lankan paddy farmers.

Create a short, practical advisory in simple English.
Do not invent unknown facts. Use only the provided data.

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

Crop calendar/rule notes:
{chr(10).join(['- ' + r for r in context['rules']])}

Output format:
1. Current condition
2. Irrigation advice
3. Fertilizer/crop management advice
4. Risk warning
Keep it under 120 words.
"""

        response = client.models.generate_content(
            model="gemini-3-flash-preview",
            contents=prompt
        )

        return response.text

    except Exception as e:
        # fallback if API key missing / quota issue / network issue
        return " ".join(context.get("rules", [])) + f" AI advisory unavailable: {str(e)}"