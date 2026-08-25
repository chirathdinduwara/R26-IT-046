from __future__ import annotations

import time
import datetime
from dataclasses import dataclass
from typing import Any, Dict, List

from .model_manager import model_manager
from .weather_service import get_realtime_weather

@dataclass(frozen=True)
class AreaProfile:
    area_id: str
    area_name: str
    center: tuple[float, float]
    polygon: list[tuple[float, float]]
    history_base_scores: list[float]

# Cache to avoid hammering Open-Meteo API (10-minute TTL)
WEATHER_CACHE: Dict[tuple[float, float], tuple[float, Dict[str, float]]] = {}
CACHE_TTL_SECONDS = 600

def _get_cached_weather(lat: float, lng: float) -> Dict[str, float]:
    """Retrieves weather with a 10-minute local cache."""
    now = time.time()
    coord_key = (round(lat, 3), round(lng, 3))
    if coord_key in WEATHER_CACHE:
        cache_time, cached_data = WEATHER_CACHE[coord_key]
        if now - cache_time < CACHE_TTL_SECONDS:
            return cached_data
    
    weather_data = get_realtime_weather(lat, lng)
    WEATHER_CACHE[coord_key] = (now, weather_data)
    return weather_data

def _clamp_score(value: float) -> float:
    return max(0.0, min(1.0, round(value, 4)))

def _hex_polygon(center: tuple[float, float], radius_lat: float, radius_lng: float) -> list[tuple[float, float]]:
    lat, lng = center
    return [
        (lat + radius_lat * 1.00, lng + radius_lng * 0.00),
        (lat + radius_lat * 0.50, lng + radius_lng * 0.87),
        (lat - radius_lat * 0.50, lng + radius_lng * 0.87),
        (lat - radius_lat * 1.00, lng + radius_lng * 0.00),
        (lat - radius_lat * 0.50, lng - radius_lng * 0.87),
        (lat + radius_lat * 0.50, lng - radius_lng * 0.87),
    ]

# Coordinates, base risk profiles, and bounds of Colombo administrative divisions
DIVISION_SEEDS = [
    ("colombo", "Colombo", (6.9271, 79.8612), [0.55, 0.56, 0.58, 0.60], 0.011),
    ("dehiwala", "Dehiwala", (6.8513, 79.8653), [0.48, 0.49, 0.50, 0.52], 0.010),
    ("homagama", "Homagama", (6.8445, 80.0048), [0.42, 0.44, 0.46, 0.45], 0.012),
    ("kaduwela", "Kaduwela", (6.9320, 79.9800), [0.52, 0.54, 0.55, 0.57], 0.012),
    ("kesbewa", "Kesbewa", (6.7954, 79.9266), [0.49, 0.50, 0.52, 0.53], 0.011),
    ("kolonnawa", "Kolonnawa", (6.9353, 79.8918), [0.57, 0.59, 0.60, 0.62], 0.010),
    ("maharagama", "Maharagama", (6.8480, 79.9296), [0.51, 0.53, 0.54, 0.55], 0.011),
    ("moratuwa", "Moratuwa", (6.7730, 79.8816), [0.54, 0.55, 0.57, 0.59], 0.011),
    ("padukka", "Padukka", (6.8497, 80.0966), [0.40, 0.41, 0.43, 0.42], 0.015),
    ("ratmalana", "Ratmalana", (6.8210, 79.8800), [0.48, 0.50, 0.51, 0.53], 0.011),
    ("seethawaka", "Seethawaka", (6.9553, 80.2083), [0.44, 0.45, 0.47, 0.46], 0.017),
    ("sri_jayawardenepura_kotte", "Sri Jayawardenepura Kotte", (6.8941, 79.9024), [0.53, 0.55, 0.56, 0.58], 0.011),
    ("thimbirigasyaya", "Thimbirigasyaya", (6.9017, 79.8737), [0.56, 0.58, 0.59, 0.61], 0.010),
]

# Baseline indicators for ML features
DIVISION_BASELINES = {
    "colombo": {"breeding_site_index": 0.75, "larvae_index": 0.35, "mosquito_density": 0.38, "water_stagnation_index": 0.82, "cases_lag1": 45.0, "cases_lag2": 42.0, "cases_avg_3week": 44.0, "cases_growth_rate": 0.05},
    "dehiwala": {"breeding_site_index": 0.68, "larvae_index": 0.32, "mosquito_density": 0.30, "water_stagnation_index": 0.74, "cases_lag1": 32.0, "cases_lag2": 35.0, "cases_avg_3week": 34.0, "cases_growth_rate": -0.08},
    "homagama": {"breeding_site_index": 0.48, "larvae_index": 0.22, "mosquito_density": 0.21, "water_stagnation_index": 0.50, "cases_lag1": 15.0, "cases_lag2": 18.0, "cases_avg_3week": 16.0, "cases_growth_rate": 0.12},
    "kaduwela": {"breeding_site_index": 0.70, "larvae_index": 0.31, "mosquito_density": 0.32, "water_stagnation_index": 0.78, "cases_lag1": 38.0, "cases_lag2": 34.0, "cases_avg_3week": 35.0, "cases_growth_rate": 0.10},
    "kesbewa": {"breeding_site_index": 0.65, "larvae_index": 0.28, "mosquito_density": 0.29, "water_stagnation_index": 0.70, "cases_lag1": 28.0, "cases_lag2": 26.0, "cases_avg_3week": 27.0, "cases_growth_rate": 0.04},
    "kolonnawa": {"breeding_site_index": 0.80, "larvae_index": 0.38, "mosquito_density": 0.42, "water_stagnation_index": 0.85, "cases_lag1": 52.0, "cases_lag2": 49.0, "cases_avg_3week": 50.0, "cases_growth_rate": 0.06},
    "maharagama": {"breeding_site_index": 0.66, "larvae_index": 0.30, "mosquito_density": 0.31, "water_stagnation_index": 0.72, "cases_lag1": 31.0, "cases_lag2": 32.0, "cases_avg_3week": 31.5, "cases_growth_rate": -0.03},
    "moratuwa": {"breeding_site_index": 0.72, "larvae_index": 0.34, "mosquito_density": 0.36, "water_stagnation_index": 0.80, "cases_lag1": 42.0, "cases_lag2": 40.0, "cases_avg_3week": 41.0, "cases_growth_rate": 0.02},
    "padukka": {"breeding_site_index": 0.42, "larvae_index": 0.18, "mosquito_density": 0.17, "water_stagnation_index": 0.45, "cases_lag1": 10.0, "cases_lag2": 11.0, "cases_avg_3week": 10.5, "cases_growth_rate": -0.09},
    "ratmalana": {"breeding_site_index": 0.64, "larvae_index": 0.29, "mosquito_density": 0.28, "water_stagnation_index": 0.68, "cases_lag1": 26.0, "cases_lag2": 27.0, "cases_avg_3week": 26.5, "cases_growth_rate": -0.04},
    "seethawaka": {"breeding_site_index": 0.50, "larvae_index": 0.23, "mosquito_density": 0.22, "water_stagnation_index": 0.52, "cases_lag1": 18.0, "cases_lag2": 16.0, "cases_avg_3week": 17.0, "cases_growth_rate": 0.11},
    "sri_jayawardenepura_kotte": {"breeding_site_index": 0.71, "larvae_index": 0.33, "mosquito_density": 0.34, "water_stagnation_index": 0.79, "cases_lag1": 40.0, "cases_lag2": 38.0, "cases_avg_3week": 39.0, "cases_growth_rate": 0.03},
    "thimbirigasyaya": {"breeding_site_index": 0.78, "larvae_index": 0.37, "mosquito_density": 0.40, "water_stagnation_index": 0.84, "cases_lag1": 48.0, "cases_lag2": 46.0, "cases_avg_3week": 47.0, "cases_growth_rate": 0.04},
}

AREAS: list[AreaProfile] = [
    AreaProfile(
        area_id=area_id,
        area_name=area_name,
        center=center,
        polygon=_hex_polygon(center=center, radius_lat=radius, radius_lng=radius),
        history_base_scores=history_base,
    )
    for area_id, area_name, center, history_base, radius in DIVISION_SEEDS
]

RISK_COLORS = {
    "normal": {"stroke": "#2E7D32", "fill": "rgba(46, 125, 50, 0.30)"},
    "middle": {"stroke": "#F9A825", "fill": "rgba(249, 168, 37, 0.30)"},
    "high": {"stroke": "#C62828", "fill": "rgba(198, 40, 40, 0.35)"},
}

PREVENTION_GUIDE = {
    "do_now": [
        "Check your immediate surroundings for stagnant water (buckets, tires, flower pots, gutters).",
        "Use mosquito repellent and wear long sleeves, especially in early morning and evening.",
        "Sleep under mosquito nets if your area risk is middle or high.",
    ],
    "prevent": [
        "Empty and scrub water containers weekly to break mosquito breeding cycles.",
        "Cover all water storage tanks and keep drainage paths clear.",
        "Coordinate with neighbors for weekly community clean-up to remove breeding sites.",
    ],
    "reduce": [
        "If fever, headache, or body pain appears, seek medical care quickly and avoid self-medication.",
        "Keep infected persons protected from mosquito bites to reduce community spread.",
        "Report repeated mosquito hotspots to local public health authorities for targeted spraying.",
    ],
}

def _week_label(weeks_ago: int) -> str:
    reference = datetime.date.today() - datetime.timedelta(days=weeks_ago * 7)
    iso_year, iso_week, _ = reference.isocalendar()
    return f"{iso_year}-W{iso_week:02d}"

def _risk_level(score: float) -> str:
    if score < 0.40:
        return "normal"
    if score < 0.70:
        return "middle"
    return "high"

def _risk_point(score: float, week_label: str) -> dict[str, Any]:
    level = _risk_level(score)
    return {
        "week_label": week_label,
        "risk_score": _clamp_score(score),
        "risk_level": level,
        "color": RISK_COLORS[level]["stroke"],
    }

def _risk_score_from_predicted_cases(predicted_cases: float) -> float:
    """Standardizes predicted case count to a 0.0 - 1.0 risk score."""
    cases = max(0.0, predicted_cases)
    if cases < 20.0:
        return float(max(0.0, min(1.0, (cases / 20.0) * 0.35)))
    if cases <= 60.0:
        middle_band = (cases - 20.0) / 40.0
        return float(max(0.0, min(1.0, 0.35 + middle_band * 0.30)))
    high_band = min(cases, 120.0) - 60.0
    return float(max(0.0, min(1.0, 0.65 + (high_band / 60.0) * 0.35)))

def _predict_area_risk(area_id: str, weather_data: Dict[str, float]) -> float:
    """Builds a complete ML feature dictionary and predicts risk for an administrative division."""
    today = datetime.date.today()
    week_of_year = today.isocalendar()[1]
    time_index = (today.year - 2011) * 52 + week_of_year - 8

    features = dict(weather_data)
    features.update({
        "week_of_year": float(week_of_year),
        "time_index": float(time_index)
    })
    
    baselines = DIVISION_BASELINES.get(area_id, DIVISION_BASELINES["colombo"])
    features.update(baselines)

    try:
        predicted_cases = model_manager.predict(features)
        return _risk_score_from_predicted_cases(predicted_cases)
    except Exception:
        # Fall back to base seed if ML prediction crashes
        return 0.50

def _distance_sq(lat_a: float, lng_a: float, lat_b: float, lng_b: float) -> float:
    return (lat_a - lat_b) ** 2 + (lng_a - lng_b) ** 2

def _nearest_area(latitude: float, longitude: float) -> AreaProfile:
    return min(
        AREAS,
        key=lambda area: _distance_sq(
            latitude,
            longitude,
            area.center[0],
            area.center[1],
        ),
    )

def _build_area_history(area: AreaProfile, current_risk_score: float) -> List[dict[str, Any]]:
    """Generates an 8-week history including the current dynamic week's prediction."""
    history = []
    # Base historical seed offsets
    offsets = [-0.05, -0.035, -0.02, -0.008, 0.006, 0.02, 0.035]
    
    # We construct 7 historical points + the current dynamic week's prediction
    base_val = area.history_base_scores[0]
    for i in range(7):
        score = _clamp_score(base_val + offsets[i])
        weeks_ago = 8 - i
        history.append(_risk_point(score, _week_label(weeks_ago)))
        
    history.append(_risk_point(current_risk_score, _week_label(0)))
    return history

def get_map_areas() -> list[dict[str, Any]]:
    response = []
    # To keep response fast, we fetch general Colombo weather once
    weather = _get_cached_weather(6.9271, 79.8612)
    
    for area in AREAS:
        current_risk_score = _predict_area_risk(area.area_id, weather)
        history = _build_area_history(area, current_risk_score)
        current = history[-1]
        response.append(
            {
                "area_id": area.area_id,
                "area_name": area.area_name,
                "center": {"latitude": area.center[0], "longitude": area.center[1]},
                "polygon": [{"latitude": lat, "longitude": lng} for lat, lng in area.polygon],
                "current_risk": current,
                "history": history,
                "fill_color": RISK_COLORS[current["risk_level"]]["fill"],
                "stroke_color": RISK_COLORS[current["risk_level"]]["stroke"],
            }
        )
    return response

def get_area_summary(latitude: float, longitude: float) -> dict[str, Any]:
    area = _nearest_area(latitude=latitude, longitude=longitude)
    
    # Fetch coordinate-specific weather dynamically
    weather = _get_cached_weather(latitude, longitude)
    current_risk_score = _predict_area_risk(area.area_id, weather)
    
    history = _build_area_history(area, current_risk_score)
    current = history[-1]
    
    # Simple forecast logic for next week based on trend momentum
    next_week_score = current_risk_score + 0.02
    next_week = _risk_point(score=next_week_score, week_label=_week_label(-1))
    
    is_critical = current["risk_level"] == "high"

    return {
        "area_id": area.area_id,
        "area_name": area.area_name,
        "user_location": {"latitude": latitude, "longitude": longitude},
        "center": {"latitude": area.center[0], "longitude": area.center[1]},
        "current_risk": current,
        "next_week_risk": next_week,
        "history": history,
        "alert": {
            "is_critical": is_critical,
            "frequency": "once_per_day_until_normal",
            "message": (
                "Critical dengue risk: take immediate prevention actions and follow daily alerts until risk normalizes."
                if is_critical
                else "Risk is not critical. Continue weekly prevention habits."
            ),
        },
        "weather": {
            "temperature_c": weather["temperature_c"],
            "humidity_pct": weather["humidity_pct"],
            "rainfall_mm": weather["rainfall_mm"],
            "rainfall_7day_sum": weather["rainfall_7day_sum"],
            "rainy_days_7d": weather["rainy_days_7d"],
        },
    }

def get_prevention_guide() -> dict[str, list[str]]:
    return PREVENTION_GUIDE
