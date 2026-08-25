from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

RiskLevel = Literal["normal", "middle", "high"]

class GeoPoint(BaseModel):
    latitude: float
    longitude: float

class RiskPoint(BaseModel):
    week_label: str
    risk_score: float
    risk_level: RiskLevel
    color: str

class MapAreaResponse(BaseModel):
    area_id: str
    area_name: str
    center: GeoPoint
    polygon: list[GeoPoint]
    current_risk: RiskPoint
    history: list[RiskPoint]
    fill_color: str
    stroke_color: str

class AlertPolicy(BaseModel):
    is_critical: bool
    frequency: str
    message: str

class WeatherInfo(BaseModel):
    temperature_c: float
    humidity_pct: float
    rainfall_mm: float
    rainfall_7day_sum: float
    rainy_days_7d: float

class AreaSummaryResponse(BaseModel):
    area_id: str
    area_name: str
    user_location: GeoPoint
    center: GeoPoint
    current_risk: RiskPoint
    next_week_risk: RiskPoint
    history: list[RiskPoint]
    alert: AlertPolicy
    weather: WeatherInfo | None = None

class PreventionGuideResponse(BaseModel):
    do_now: list[str]
    prevent: list[str]
    reduce: list[str]

class ChatRequest(BaseModel):
    message: str
    history: list[dict[str, str]] = []

class ChatResponse(BaseModel):
    response: str
