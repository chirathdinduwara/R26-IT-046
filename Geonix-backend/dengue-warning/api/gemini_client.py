from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Dict, Tuple

import requests
import logging

logger = logging.getLogger("dengue_warning.gemini")


@dataclass(frozen=True)
class GeminiConfig:
    api_key: str
    model: str = "gemini-3.6-flash"
    timeout_seconds: int = 20


class GeminiCalibrationError(Exception):
    pass


class GeminiRiskCalibrator:
    def __init__(self, config: GeminiConfig):
        if not config.api_key:
            raise ValueError("GEMINI_API_KEY is required to initialize GeminiRiskCalibrator.")
        self._config = config
        self._url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{config.model}:generateContent?key={config.api_key}"
        )

    def _build_prompt(self, base_score: float, features: Dict[str, float]) -> str:
        return (
            "You are calibrating a dengue risk score for Colombo district zones.\n"
            "Given a base ML risk score and engineered weather/case features, "
            "return only JSON with one key: adjustment.\n"
            "Rules:\n"
            "1) adjustment must be a float between -0.10 and 0.10\n"
            "2) positive adjustment only when multiple indicators strongly increase outbreak risk\n"
            "3) negative adjustment only when multiple indicators strongly reduce outbreak risk\n"
            "4) conservative output near zero when signal is weak\n"
            f"Base risk score: {base_score:.4f}\n"
            f"Features: {json.dumps(features, separators=(',', ':'))}\n"
            'Output format exactly: {"adjustment": 0.00}'
        )

    @staticmethod
    def _extract_json(text: str) -> Dict[str, float]:
        match = re.search(r"\{[\s\S]*\}", text)
        if not match:
            raise GeminiCalibrationError("Gemini response did not contain a JSON object.")
        parsed = json.loads(match.group(0))
        if "adjustment" not in parsed:
            raise GeminiCalibrationError("Gemini response JSON missing 'adjustment'.")
        adjustment = float(parsed["adjustment"])
        if adjustment < -0.10 or adjustment > 0.10:
            raise GeminiCalibrationError("Gemini adjustment out of allowed range [-0.10, 0.10].")
        return {"adjustment": adjustment}

    def calibrate(self, base_score: float, features: Dict[str, float]) -> Tuple[float, float]:
        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "text": self._build_prompt(base_score=base_score, features=features),
                        }
                    ]
                }
            ]
        }
        try:
            response = requests.post(self._url, json=payload, timeout=self._config.timeout_seconds)
            response.raise_for_status()
        except requests.RequestException as exc:
            raise GeminiCalibrationError(f"Gemini API request failed: {exc}") from exc

        data = response.json()
        try:
            text = data["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError, TypeError) as exc:
            raise GeminiCalibrationError("Gemini response format was not recognized.") from exc
        parsed = self._extract_json(text)
        adjustment = parsed["adjustment"]
        final_score = max(0.0, min(1.0, base_score + adjustment))
        return final_score, adjustment


class GeminiExplainerError(Exception):
    pass


class GeminiExplainer:
    def __init__(self, config: GeminiConfig):
        if not config.api_key:
            raise ValueError("GEMINI_API_KEY is required to initialize GeminiExplainer.")
        self._config = config
        self._url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{config.model}:generateContent?key={config.api_key}"
        )

    def generate_explanation(
        self,
        area_name: str,
        current_level: str,
        current_score: float,
        next_week_level: str,
        week_after_next_level: str,
        probabilities: dict[str, float],
        history_trajectory: list[float],
        weather: dict[str, float],
        trend: str,
        escalation: dict[str, Any]
    ) -> str:
        prompt = (
            f"You are the Dengue Safety AI Assistant for the Colombo District. "
            f"Please generate a short (3-4 sentences), factual, natural-language explanation of why the Machine Learning "
            f"model predicted a '{current_level}' risk level for {area_name}.\n\n"
            f"Factual Model Data:\n"
            f"- Area: {area_name}\n"
            f"- Current Risk Level: {current_level} (Score: {current_score:.2f})\n"
            f"- Model Horizon Predictions: Next Week: {next_week_level}, Two Weeks Out: {week_after_next_level}\n"
            f"- Category Probabilities: Low Risk: {probabilities.get('Low', 0.0):.2f}, Medium Risk: {probabilities.get('Medium', 0.0):.2f}, High Risk: {probabilities.get('High', 0.0):.2f}\n"
            f"- Historical 6-week Case Counts trajectory: {history_trajectory}\n"
            f"- Current Weather: Temp: {weather.get('temperature_c', 28.0):.1f}°C, Humidity: {weather.get('humidity_pct', 80.0):.0f}%, Today's Rain: {weather.get('today_rain_mm', 0.0):.1f}mm\n"
            f"- Risk Trend: {trend}\n"
            f"- Risk Escalation Status: Escalating? {escalation.get('risk_escalation', False)} (From: {escalation.get('from', 'Low')}, To: {escalation.get('to', 'Low')})\n\n"
            f"Instructions:\n"
            f"1. Explain the prediction based strictly on the weather (e.g. recent rainfall leads to stagnant water breeding opportunities, or high humidity prolongs mosquito lifespan) and the historical cases trajectory.\n"
            f"2. Keep the explanation professional, concise, and easy to understand.\n"
            f"3. Strictly follow AI Safety guidelines: Do NOT make absolute medical diagnoses, do NOT guarantee infection, do NOT prescribe treatments. Use cautious, advisory terminology (e.g. 'elevates risk opportunity', 'potential breeding site accumulation').\n"
            f"4. Do NOT output markdown headers, JSON, or list bullets. Output only the paragraphs of the explanation.\n"
        )
        
        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "text": prompt,
                        }
                    ]
                }
            ]
        }
        try:
            response = requests.post(self._url, json=payload, timeout=self._config.timeout_seconds)
            response.raise_for_status()
            data = response.json()
            explanation = data["candidates"][0]["content"]["parts"][0]["text"].strip()
            explanation = explanation.replace("**", "").replace("*", "")
            return explanation
        except Exception as exc:
            logger.error(f"Gemini Explanation generation failed: {exc}")
            raise GeminiExplainerError(f"Gemini API request failed: {exc}") from exc
