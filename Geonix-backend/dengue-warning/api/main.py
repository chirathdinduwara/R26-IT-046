from __future__ import annotations

import os
import pickle
from pathlib import Path
from typing import Any, Dict

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .dengue_router import router as dengue_router
from .gemini_client import GeminiCalibrationError, GeminiConfig, GeminiRiskCalibrator
from .schemas import RiskScoreRequest, RiskScoreResponse


LOW_CASE_THRESHOLD = 20.0
NORMAL_CASE_THRESHOLD = 60.0
LOW_RISK_THRESHOLD = 0.35
DANGER_RISK_THRESHOLD = 0.65
HIGH_CASES_CAP = 120.0


def _default_artifacts_testmodel_dir() -> Path:
    return Path(__file__).resolve().parents[1] / "model"


def _load_pickle(path: Path) -> Any:
    with path.open("rb") as handle:
        return pickle.load(handle)


ARTIFACTS_TESTMODEL_DIR = Path(os.getenv("ARTIFACTS_TESTMODEL_DIR", str(_default_artifacts_testmodel_dir())))
MODEL_PATH = Path(os.getenv("MODEL_PATH", str(ARTIFACTS_TESTMODEL_DIR / "dengue_model.pkl")))
FEATURES_PATH = Path(os.getenv("FEATURES_PATH", str(ARTIFACTS_TESTMODEL_DIR / "features.pkl")))
SCALER_PATH = Path(os.getenv("SCALER_PATH", str(ARTIFACTS_TESTMODEL_DIR / "scaler.pkl")))

model = _load_pickle(MODEL_PATH)
raw_feature_columns = _load_pickle(FEATURES_PATH)
if not isinstance(raw_feature_columns, (list, tuple)):
    raise ValueError("features.pkl must contain a list or tuple of feature names.")
feature_columns = [str(name) for name in raw_feature_columns]
scaler = _load_pickle(SCALER_PATH)
scaler_transform = getattr(scaler, "transform", None)
scaler_enabled = callable(scaler_transform)

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


def _feature_dict(payload: RiskScoreRequest) -> Dict[str, float]:
    data = payload.model_dump()
    return {name: float(data[name]) for name in feature_columns}


@app.get("/health")
def health() -> Dict[str, object]:
    return {
        "status": "ok",
        "model_loaded": True,
        "feature_count": len(feature_columns),
        "scaler_enabled": scaler_enabled,
        "gemini_enabled": gemini_calibrator is not None,
    }


@app.post("/score", response_model=RiskScoreResponse)
def score(payload: RiskScoreRequest) -> RiskScoreResponse:
    feature_values = _feature_dict(payload)
    feature_frame = pd.DataFrame([feature_values], columns=feature_columns)
    model_input = scaler_transform(feature_frame) if scaler_enabled and scaler_transform is not None else feature_frame
    predicted_cases = float(max(0.0, model.predict(model_input)[0]))
    base_risk = _risk_score_from_predicted_cases(predicted_cases)

    final_risk = base_risk
    adjustment = None
    if payload.use_gemini:
        if gemini_calibrator is None:
            raise HTTPException(status_code=400, detail="Gemini calibration requested but GEMINI_API_KEY is not configured.")
        try:
            final_risk, adjustment = gemini_calibrator.calibrate(base_risk, feature_values)
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
