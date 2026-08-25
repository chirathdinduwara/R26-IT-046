from __future__ import annotations

from pydantic import BaseModel, Field


class RiskScoreRequest(BaseModel):
    division: str = Field(..., description="Administrative division name.")
    year: int = Field(..., ge=2000, le=2100)
    week_of_year: int = Field(..., ge=1, le=53)
    temperature_c: float
    temp_min: float
    temp_max: float
    humidity_pct: float = Field(..., ge=0, le=100)
    rainfall_mm: float = Field(..., ge=0)
    rainfall_7day_sum: float = Field(..., ge=0)
    rainfall_14day_sum: float = Field(..., ge=0)
    humidity_avg_7d: float = Field(..., ge=0, le=100)
    rainy_days_7d: int = Field(..., ge=0, le=7)
    heavy_rain_days: int = Field(..., ge=0, le=7)
    breeding_site_index: float = Field(..., ge=0, le=1)
    larvae_index: float = Field(..., ge=0, le=1)
    mosquito_density: float = Field(..., ge=0, le=1)
    water_stagnation_index: float = Field(..., ge=0, le=1)
    cases_lag1: float = Field(..., ge=0)
    cases_lag2: float = Field(..., ge=0)
    cases_avg_3week: float = Field(..., ge=0)
    cases_growth_rate: float
    time_index: float = Field(..., ge=0)
    use_gemini: bool = Field(default=False, description="Apply Gemini calibration if API key is configured.")


class RiskScoreResponse(BaseModel):
    division: str
    week_of_year: int
    year: int
    predicted_cases: float
    base_risk_score: float
    final_risk_score: float
    zone: str
    alert: str
    gemini_adjustment: float | None = None
