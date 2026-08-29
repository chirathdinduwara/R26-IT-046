from __future__ import annotations

import os
from pathlib import Path
from typing import Dict

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from .dengue_router import router as dengue_router
from .gemini_client import GeminiCalibrationError, GeminiConfig, GeminiRiskCalibrator
from .model_manager import MODEL_PATH, model_manager
from .schemas import RiskScoreRequest, RiskScoreResponse

load_dotenv(Path(__file__).resolve().parent.parent / ".env", override=False)

# Outbreak risk calibration thresholds
LOW_CASE_THRESHOLD = 20.0
NORMAL_CASE_THRESHOLD = 60.0
LOW_RISK_THRESHOLD = 0.35
DANGER_RISK_THRESHOLD = 0.65
HIGH_CASES_CAP = 120.0

gemini_api_key = os.getenv("GEMINI_API_KEY", "").strip()
gemini_model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
gemini_calibrator = GeminiRiskCalibrator(GeminiConfig(api_key=gemini_api_key, model=gemini_model)) if gemini_api_key else None

app = FastAPI(title="Dengue Risk Scoring API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dengue_router)

def _risk_score_from_predicted_cases(predicted_cases: float) -> float:
    cases = max(0.0, predicted_cases)
    if cases < LOW_CASE_THRESHOLD:
        return float(np.clip((cases / LOW_CASE_THRESHOLD) * LOW_RISK_THRESHOLD, 0.0, 1.0))

    if cases <= NORMAL_CASE_THRESHOLD:
        middle_band = (cases - LOW_CASE_THRESHOLD) / (NORMAL_CASE_THRESHOLD - LOW_CASE_THRESHOLD)
        return float(np.clip(LOW_RISK_THRESHOLD + middle_band * (DANGER_RISK_THRESHOLD - LOW_RISK_THRESHOLD), 0.0, 1.0))

    high_band = min(cases, HIGH_CASES_CAP) - NORMAL_CASE_THRESHOLD
    high_scale = HIGH_CASES_CAP - NORMAL_CASE_THRESHOLD
    return float(np.clip(DANGER_RISK_THRESHOLD + (high_band / high_scale) * (1.0 - DANGER_RISK_THRESHOLD), 0.0, 1.0))

def _zone_from_risk_score(risk_score: float) -> str:
    if risk_score < LOW_RISK_THRESHOLD:
        return "low"
    if risk_score <= DANGER_RISK_THRESHOLD:
        return "normal"
    return "danger"

def _alert_from_zone(zone: str) -> str:
    return "daily_push_notification" if zone == "danger" else "none"

@app.get("/health")
def health() -> Dict[str, object]:
    status = model_manager.get_status()
    has_model = len(model_manager.models) > 0
    return {
        "status": "ok",
        "model_loaded": has_model,
        "feature_count": status.get("feature_count", 0),
        "scaler_enabled": getattr(model_manager, "scaler_enabled", False),
        "gemini_enabled": gemini_calibrator is not None,
        "model_type": status.get("algorithm", "Unknown"),
        "last_modified": status.get("last_modified", {}),
    }

@app.post("/score", response_model=RiskScoreResponse)
def score(payload: RiskScoreRequest) -> RiskScoreResponse:
    feature_values = payload.model_dump()
    
    # Run prediction through the dynamic model manager
    predicted_cases = float(max(0.0, model_manager.predict(feature_values)))
    base_risk = _risk_score_from_predicted_cases(predicted_cases)

    final_risk = base_risk
    adjustment = None
    if payload.use_gemini:
        if gemini_calibrator is None:
            raise HTTPException(status_code=400, detail="Gemini calibration requested but GEMINI_API_KEY is not configured.")
        try:
            active_features = {k: v for k, v in feature_values.items() if k in model_manager.feature_columns}
            final_risk, adjustment = gemini_calibrator.calibrate(base_risk, active_features)
        except GeminiCalibrationError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

    zone = _zone_from_risk_score(final_risk)
    return RiskScoreResponse(
        division=payload.division,
        week_of_year=payload.week_of_year,
        year=payload.year,
        predicted_cases=round(predicted_cases, 2),
        base_risk_score=round(base_risk, 4),
        final_risk_score=round(final_risk, 4),
        zone=zone,
        alert=_alert_from_zone(zone),
        gemini_adjustment=round(adjustment, 4) if adjustment is not None else None,
    )
