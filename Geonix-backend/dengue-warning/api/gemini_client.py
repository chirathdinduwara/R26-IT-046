from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Dict, Tuple

import requests


@dataclass(frozen=True)
class GeminiConfig:
    api_key: str
    model: str = "gemini-2.0-flash"
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
