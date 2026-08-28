from __future__ import annotations

import time
import datetime
import logging
from dataclasses import dataclass
from typing import Any, Dict, List
import numpy as np

from .model_manager import model_manager
from .weather_service import get_realtime_weather

DIVISION_HISTORICAL_CASES = {
    "colombo": [36, 38, 40, 44, 42, 45],
    "dehiwala": [28, 30, 31, 33, 35, 32],
    "homagama": [12, 14, 15, 16, 18, 15],
    "kaduwela": [30, 32, 35, 36, 34, 38],
    "kesbewa": [22, 24, 25, 27, 26, 28],
    "kolonnawa": [45, 48, 47, 50, 49, 52],
    "maharagama": [25, 27, 28, 30, 32, 31],
    "moratuwa": [35, 37, 39, 41, 40, 42],
    "padukka": [8, 9, 10, 11, 11, 10],
    "ratmalana": [20, 22, 23, 25, 27, 26],
    "seethawaka": [12, 13, 15, 17, 16, 18],
    "sri_jayawardenepura_kotte": [32, 34, 36, 38, 38, 40],
    "thimbirigasyaya": [40, 42, 44, 46, 46, 48],
}


logger = logging.getLogger("dengue_warning.service")


# ============================================================
# Area profile
# ============================================================

@dataclass(frozen=True)
class AreaProfile:
    area_id: str
    area_name: str
    center: tuple[float, float]
    polygon: list[tuple[float, float]]
    history_base_scores: list[float]


# ============================================================
# Weather cache
# ============================================================

WEATHER_CACHE: Dict[
    tuple[float, float],
    tuple[float, Dict[str, float]],
] = {}

CACHE_TTL_SECONDS = 600


def _get_cached_weather(
    lat: float,
    lng: float,
    force_refresh: bool = False,
) -> Dict[str, float]:
    """
    Retrieve weather using a 10-minute local cache.
    """

    now = time.time()

    coord_key = (
        round(lat, 3),
        round(lng, 3),
    )

    if (
        not force_refresh
        and coord_key in WEATHER_CACHE
    ):

        cache_time, cached_data = WEATHER_CACHE[
            coord_key
        ]

        if (
            now - cache_time
            < CACHE_TTL_SECONDS
        ):
            return cached_data

    try:

        weather_data = get_realtime_weather(
            lat,
            lng,
        )

    except RuntimeError:

        if coord_key in WEATHER_CACHE:

            logger.warning(
                "Using stale cached weather due to "
                "real-time fetch failure. lat=%s lng=%s",
                lat,
                lng,
            )

            _, cached_data = WEATHER_CACHE[
                coord_key
            ]

            return cached_data

        raise

    WEATHER_CACHE[
        coord_key
    ] = (
        now,
        weather_data,
    )

    return weather_data


# ============================================================
# Risk helpers
# ============================================================

def _clamp_score(
    value: float,
) -> float:
    return max(
        0.0,
        min(
            1.0,
            round(
                value,
                4,
            ),
        ),
    )


def _hex_polygon(
    center: tuple[float, float],
    radius_lat: float,
    radius_lng: float,
) -> list[tuple[float, float]]:

    lat, lng = center

    return [
        (
            lat + radius_lat * 1.00,
            lng + radius_lng * 0.00,
        ),
        (
            lat + radius_lat * 0.50,
            lng + radius_lng * 0.87,
        ),
        (
            lat - radius_lat * 0.50,
            lng + radius_lng * 0.87,
        ),
        (
            lat - radius_lat * 1.00,
            lng + radius_lng * 0.00,
        ),
        (
            lat - radius_lat * 0.50,
            lng - radius_lng * 0.87,
        ),
        (
            lat + radius_lat * 0.50,
            lng - radius_lng * 0.87,
        ),
    ]


# ============================================================
# Colombo administrative divisions
# ============================================================

DIVISION_SEEDS = [
    (
        "colombo",
        "Colombo",
        (6.9271, 79.8612),
        [0.55, 0.56, 0.58, 0.60],
        0.011,
    ),
    (
        "dehiwala",
        "Dehiwala",
        (6.8513, 79.8653),
        [0.48, 0.49, 0.50, 0.52],
        0.010,
    ),
    (
        "homagama",
        "Homagama",
        (6.8445, 80.0048),
        [0.42, 0.44, 0.46, 0.45],
        0.012,
    ),
    (
        "kaduwela",
        "Kaduwela",
        (6.9320, 79.9800),
        [0.52, 0.54, 0.55, 0.57],
        0.012,
    ),
    (
        "kesbewa",
        "Kesbewa",
        (6.7954, 79.9266),
        [0.49, 0.50, 0.52, 0.53],
        0.011,
    ),
    (
        "kolonnawa",
        "Kolonnawa",
        (6.9353, 79.8918),
        [0.57, 0.59, 0.60, 0.62],
        0.010,
    ),
    (
        "maharagama",
        "Maharagama",
        (6.8480, 79.9296),
        [0.51, 0.53, 0.54, 0.55],
        0.011,
    ),
    (
        "moratuwa",
        "Moratuwa",
        (6.7730, 79.8816),
        [0.54, 0.55, 0.57, 0.59],
        0.011,
    ),
    (
        "padukka",
        "Padukka",
        (6.8497, 80.0966),
        [0.40, 0.41, 0.43, 0.42],
        0.015,
    ),
    (
        "ratmalana",
        "Ratmalana",
        (6.8210, 79.8800),
        [0.48, 0.50, 0.51, 0.53],
        0.011,
    ),
    (
        "seethawaka",
        "Seethawaka",
        (6.9553, 80.2083),
        [0.44, 0.45, 0.47, 0.46],
        0.017,
    ),
    (
        "sri_jayawardenepura_kotte",
        "Sri Jayawardenepura Kotte",
        (6.8941, 79.9024),
        [0.53, 0.55, 0.56, 0.58],
        0.011,
    ),
    (
        "thimbirigasyaya",
        "Thimbirigasyaya",
        (6.9017, 79.8737),
        [0.56, 0.58, 0.59, 0.61],
        0.010,
    ),
]


# ============================================================
# ML baselines
# ============================================================

DIVISION_BASELINES = {
    "colombo": {
        "breeding_site_index": 0.75,
        "larvae_index": 0.35,
        "mosquito_density": 0.38,
        "water_stagnation_index": 0.82,
        "cases_lag1": 45.0,
        "cases_lag2": 42.0,
        "cases_avg_3week": 44.0,
        "cases_growth_rate": 0.05,
    },

    "dehiwala": {
        "breeding_site_index": 0.68,
        "larvae_index": 0.32,
        "mosquito_density": 0.30,
        "water_stagnation_index": 0.74,
        "cases_lag1": 32.0,
        "cases_lag2": 35.0,
        "cases_avg_3week": 34.0,
        "cases_growth_rate": -0.08,
    },

    "homagama": {
        "breeding_site_index": 0.48,
        "larvae_index": 0.22,
        "mosquito_density": 0.21,
        "water_stagnation_index": 0.50,
        "cases_lag1": 15.0,
        "cases_lag2": 18.0,
        "cases_avg_3week": 16.0,
        "cases_growth_rate": 0.12,
    },

    "kaduwela": {
        "breeding_site_index": 0.70,
        "larvae_index": 0.31,
        "mosquito_density": 0.32,
        "water_stagnation_index": 0.78,
        "cases_lag1": 38.0,
        "cases_lag2": 34.0,
        "cases_avg_3week": 35.0,
        "cases_growth_rate": 0.10,
    },

    "kesbewa": {
        "breeding_site_index": 0.65,
        "larvae_index": 0.28,
        "mosquito_density": 0.29,
        "water_stagnation_index": 0.70,
        "cases_lag1": 28.0,
        "cases_lag2": 26.0,
        "cases_avg_3week": 27.0,
        "cases_growth_rate": 0.04,
    },

    "kolonnawa": {
        "breeding_site_index": 0.80,
        "larvae_index": 0.38,
        "mosquito_density": 0.42,
        "water_stagnation_index": 0.85,
        "cases_lag1": 52.0,
        "cases_lag2": 49.0,
        "cases_avg_3week": 50.0,
        "cases_growth_rate": 0.06,
    },

    "maharagama": {
        "breeding_site_index": 0.66,
        "larvae_index": 0.30,
        "mosquito_density": 0.31,
        "water_stagnation_index": 0.72,
        "cases_lag1": 31.0,
        "cases_lag2": 32.0,
        "cases_avg_3week": 31.5,
        "cases_growth_rate": -0.03,
    },

    "moratuwa": {
        "breeding_site_index": 0.72,
        "larvae_index": 0.34,
        "mosquito_density": 0.36,
        "water_stagnation_index": 0.80,
        "cases_lag1": 42.0,
        "cases_lag2": 40.0,
        "cases_avg_3week": 41.0,
        "cases_growth_rate": 0.02,
    },

    "padukka": {
        "breeding_site_index": 0.42,
        "larvae_index": 0.18,
        "mosquito_density": 0.17,
        "water_stagnation_index": 0.45,
        "cases_lag1": 10.0,
        "cases_lag2": 11.0,
        "cases_avg_3week": 10.5,
        "cases_growth_rate": -0.09,
    },

    "ratmalana": {
        "breeding_site_index": 0.64,
        "larvae_index": 0.29,
        "mosquito_density": 0.28,
        "water_stagnation_index": 0.68,
        "cases_lag1": 26.0,
        "cases_lag2": 27.0,
        "cases_avg_3week": 26.5,
        "cases_growth_rate": -0.04,
    },

    "seethawaka": {
        "breeding_site_index": 0.50,
        "larvae_index": 0.23,
        "mosquito_density": 0.22,
        "water_stagnation_index": 0.52,
        "cases_lag1": 18.0,
        "cases_lag2": 16.0,
        "cases_avg_3week": 17.0,
        "cases_growth_rate": 0.11,
    },

    "sri_jayawardenepura_kotte": {
        "breeding_site_index": 0.71,
        "larvae_index": 0.33,
        "mosquito_density": 0.34,
        "water_stagnation_index": 0.79,
        "cases_lag1": 40.0,
        "cases_lag2": 38.0,
        "cases_avg_3week": 39.0,
        "cases_growth_rate": 0.03,
    },

    "thimbirigasyaya": {
        "breeding_site_index": 0.78,
        "larvae_index": 0.37,
        "mosquito_density": 0.40,
        "water_stagnation_index": 0.84,
        "cases_lag1": 48.0,
        "cases_lag2": 46.0,
        "cases_avg_3week": 47.0,
        "cases_growth_rate": 0.04,
    },
}


# ============================================================
# Areas
# ============================================================

AREAS: list[AreaProfile] = [
    AreaProfile(
        area_id=area_id,
        area_name=area_name,
        center=center,
        polygon=_hex_polygon(
            center=center,
            radius_lat=radius,
            radius_lng=radius,
        ),
        history_base_scores=history_base,
    )
    for (
        area_id,
        area_name,
        center,
        history_base,
        radius,
    ) in DIVISION_SEEDS
]


# ============================================================
# Risk colors
# ============================================================

RISK_COLORS = {
    "normal": {
        "stroke": "#2E7D32",
        "fill": "rgba(46, 125, 50, 0.30)",
    },

    "middle": {
        "stroke": "#F9A825",
        "fill": "rgba(249, 168, 37, 0.30)",
    },

    "high": {
        "stroke": "#C62828",
        "fill": "rgba(198, 40, 40, 0.35)",
    },
}


# ============================================================
# Prevention guide
# ============================================================

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


# ============================================================
# Date / risk helpers
# ============================================================

def _week_label(
    weeks_ago: int,
) -> str:

    reference = (
        datetime.date.today()
        - datetime.timedelta(
            days=weeks_ago * 7
        )
    )

    iso_year, iso_week, _ = (
        reference.isocalendar()
    )

    return f"{iso_year}-W{iso_week:02d}"


def _risk_level(
    score: float,
) -> str:

    if score < 0.40:
        return "normal"

    if score < 0.70:
        return "middle"

    return "high"


def _risk_point(
    score: float,
    week_label: str,
) -> dict[str, Any]:

    level = _risk_level(
        score
    )

    return {
        "week_label": week_label,
        "risk_score": _clamp_score(
            score
        ),
        "risk_level": level,
        "color": RISK_COLORS[
            level
        ]["stroke"],
    }


def _risk_score_from_predicted_cases(
    predicted_cases: float,
) -> float:
    """
    Standardizes predicted case count
    to a 0.0 - 1.0 risk score.
    """

    cases = max(
        0.0,
        predicted_cases,
    )

    if cases < 20.0:

        return float(
            max(
                0.0,
                min(
                    1.0,
                    (
                        cases
                        / 20.0
                    )
                    * 0.35,
                ),
            )
        )

    if cases <= 60.0:

        middle_band = (
            cases - 20.0
        ) / 40.0

        return float(
            max(
                0.0,
                min(
                    1.0,
                    0.35
                    + middle_band
                    * 0.30,
                ),
            )
        )

    high_band = (
        min(
            cases,
            120.0,
        )
        - 60.0
    )

    return float(
        max(
            0.0,
            min(
                1.0,
                0.65
                + (
                    high_band
                    / 60.0
                )
                * 0.35,
            ),
        )
    )


# ============================================================
# ML prediction
# ============================================================

def map_cases_to_risk(cases: float, week_label: str) -> dict[str, Any]:
    if cases < 10.0:
        level = "normal"
        score = (cases / 10.0) * 0.35
    elif cases <= 30.0:
        level = "middle"
        score = 0.35 + ((cases - 10.0) / 20.0) * 0.30
    else:
        level = "high"
        score = 0.65 + min((cases - 30.0) / 90.0, 1.0) * 0.35
    
    return {
        "week_label": week_label,
        "risk_score": score,
        "risk_level": level,
        "color": RISK_COLORS[level]["stroke"],
    }


def map_risk_level(level: str) -> str:
    l_map = {"Low": "normal", "Medium": "middle", "High": "high"}
    return l_map.get(level, "normal")


def build_prediction_features(
    area_id: str,
    prediction_date: datetime.date,
    weather_data: Dict[str, float],
    horizon: str = "current_week"
) -> Dict[str, float]:
    history_cases = DIVISION_HISTORICAL_CASES.get(area_id, DIVISION_HISTORICAL_CASES["colombo"])
    
    # Calendar features
    month = prediction_date.month
    week_of_year = prediction_date.isocalendar()[1]
    month_sin = np.sin(2 * np.pi * month / 12)
    month_cos = np.cos(2 * np.pi * month / 12)
    week_sin = np.sin(2 * np.pi * week_of_year / 52)
    week_cos = np.cos(2 * np.pi * week_of_year / 52)
    
    # Case lag features
    cases_lag_1 = float(history_cases[5])
    cases_lag_2 = float(history_cases[4])
    cases_lag_3 = float(history_cases[3])
    cases_lag_4 = float(history_cases[2])
    cases_lag_6 = float(history_cases[0])
    
    cases_avg_3week = sum(history_cases[3:6]) / 3.0
    cases_avg_6week = sum(history_cases) / 6.0
    
    cases_growth_rate = (history_cases[5] - history_cases[4]) / history_cases[4] if history_cases[4] > 0 else 0.0
    prev_growth_rate = (history_cases[4] - history_cases[3]) / history_cases[3] if history_cases[3] > 0 else 0.0
    cases_acceleration = cases_growth_rate - prev_growth_rate
    
    # Weather features
    if horizon == "current_week":
        temp = weather_data.get("temperature_c", 28.0)
        humidity = weather_data.get("humidity_pct", 80.0)
        rainfall = weather_data.get("today_rain_mm", 0.0)
    else:
        temp = (weather_data.get("temp_min", 26.0) + weather_data.get("temp_max", 30.0)) / 2.0
        humidity = weather_data.get("humidity_avg_5d", 80.0)
        rainfall = weather_data.get("rainfall_5day_avg", 0.0)
        
    rainfall_2w = weather_data.get("rainfall_5day_sum", 0.0) * (14.0 / 5.0)
    rainfall_4w = weather_data.get("rainfall_5day_sum", 0.0) * (28.0 / 5.0)
    temp_2w = temp
    humidity_2w = weather_data.get("humidity_avg_5d", humidity)
    
    return {
        "Cases_lag_1": cases_lag_1,
        "Cases_lag_2": cases_lag_2,
        "Cases_lag_3": cases_lag_3,
        "Cases_lag_4": cases_lag_4,
        "Cases_lag_6": cases_lag_6,
        "Cases_avg_3week": cases_avg_3week,
        "Cases_avg_6week": cases_avg_6week,
        "Cases_growth_rate": cases_growth_rate,
        "Cases_acceleration": cases_acceleration,
        "Temperature": temp,
        "Humidity": humidity,
        "Rainfall": rainfall,
        "Rainfall_2W": rainfall_2w,
        "Rainfall_4W": rainfall_4w,
        "Temperature_2W": temp_2w,
        "Humidity_2W": humidity_2w,
        "month": float(month),
        "week_of_year": float(week_of_year),
        "month_sin": month_sin,
        "month_cos": month_cos,
        "week_sin": week_sin,
        "week_cos": week_cos,
    }


def predict_area_dengue_risk(area_id: str, weather_data: Dict[str, float]) -> Dict[str, Any]:
    today = datetime.date.today()
    
    # 1. Current week
    features_current = build_prediction_features(area_id, today, weather_data, "current_week")
    res_current = model_manager.predict_horizon("current_week", features_current)
    current_class = res_current["predicted_class"]
    current_probs = res_current["probabilities"]
    current_score = current_probs.get("Low", 0.0) * 0.20 + current_probs.get("Medium", 0.0) * 0.55 + current_probs.get("High", 0.0) * 0.85
    
    # 2. Week 1
    date_w1 = today + datetime.timedelta(days=7)
    features_w1 = build_prediction_features(area_id, date_w1, weather_data, "week_1")
    res_w1 = model_manager.predict_horizon("week_1", features_w1)
    w1_class = res_w1["predicted_class"]
    w1_probs = res_w1["probabilities"]
    w1_score = w1_probs.get("Low", 0.0) * 0.20 + w1_probs.get("Medium", 0.0) * 0.55 + w1_probs.get("High", 0.0) * 0.85
    
    # 3. Week 2
    date_w2 = today + datetime.timedelta(days=14)
    features_w2 = build_prediction_features(area_id, date_w2, weather_data, "week_2")
    res_w2 = model_manager.predict_horizon("week_2", features_w2)
    w2_class = res_w2["predicted_class"]
    w2_probs = res_w2["probabilities"]
    w2_score = w2_probs.get("Low", 0.0) * 0.20 + w2_probs.get("Medium", 0.0) * 0.55 + w2_probs.get("High", 0.0) * 0.85
    
    # Deterministic trend
    diff = w2_score - current_score
    if diff > 0.05:
        trend = "Increasing"
    elif diff < -0.05:
        trend = "Decreasing"
    else:
        trend = "Stable"
        
    # Escalation detection
    level_ranks = {"Low": 0, "Medium": 1, "High": 2}
    from_rank = level_ranks.get(current_class, 0)
    to_rank = level_ranks.get(w1_class, 0)
    escalation = to_rank > from_rank
    
    return {
        "area_id": area_id,
        "current_week": {
            "risk_level": map_risk_level(current_class),
            "risk_score": current_score,
            "probabilities": current_probs,
        },
        "next_week": {
            "risk_level": map_risk_level(w1_class),
            "risk_score": w1_score,
            "probabilities": w1_probs,
        },
        "week_after_next": {
            "risk_level": map_risk_level(w2_class),
            "risk_score": w2_score,
            "probabilities": w2_probs,
        },
        "trend": trend,
        "escalation": {
            "risk_escalation": escalation,
            "from": current_class,
            "to": w1_class,
        }
    }


def _predict_area_risk(
    area_id: str,
    weather_data: Dict[str, float],
) -> float:
    """Backward compatible base risk prediction score."""
    res = predict_area_dengue_risk(area_id, weather_data)
    return float(res["current_week"]["risk_score"])


def _distance_sq(
    lat_a: float,
    lng_a: float,
    lat_b: float,
    lng_b: float,
) -> float:
    return (
        (lat_a - lat_b) ** 2
        + (lng_a - lng_b) ** 2
    )


def _nearest_area(
    latitude: float,
    longitude: float,
) -> AreaProfile:
    return min(
        AREAS,
        key=lambda area: _distance_sq(
            latitude,
            longitude,
            area.center[0],
            area.center[1],
        ),
    )


def _build_area_history_complete(
    area_id: str,
    weather_data: Dict[str, float],
) -> List[dict[str, Any]]:
    history = []
    
    # 1. Past 6 weeks (W-6 to W-1)
    history_cases = DIVISION_HISTORICAL_CASES.get(area_id, DIVISION_HISTORICAL_CASES["colombo"])
    for i in range(6):
        weeks_ago = 6 - i
        cases = history_cases[i]
        week_label = _week_label(weeks_ago)
        history.append(map_cases_to_risk(cases, week_label))
        
    # 2. Current week (W-0)
    pred = predict_area_dengue_risk(area_id, weather_data)
    curr_week_label = _week_label(0)
    history.append({
        "week_label": curr_week_label,
        "risk_score": _clamp_score(pred["current_week"]["risk_score"]),
        "risk_level": pred["current_week"]["risk_level"],
        "color": RISK_COLORS[pred["current_week"]["risk_level"]]["stroke"],
    })
    
    # 3. Next week (W+1)
    next_week_label = _week_label(-1)
    history.append({
        "week_label": next_week_label,
        "risk_score": _clamp_score(pred["next_week"]["risk_score"]),
        "risk_level": pred["next_week"]["risk_level"],
        "color": RISK_COLORS[pred["next_week"]["risk_level"]]["stroke"],
    })
    
    # 4. Week after next (W+2)
    week_2_label = _week_label(-2)
    history.append({
        "week_label": week_2_label,
        "risk_score": _clamp_score(pred["week_after_next"]["risk_score"]),
        "risk_level": pred["week_after_next"]["risk_level"],
        "color": RISK_COLORS[pred["week_after_next"]["risk_level"]]["stroke"],
    })
    
    return history


def _build_area_history(
    area: AreaProfile,
    current_risk_score: float,
) -> List[dict[str, Any]]:
    # Fallback to keep signatures matching
    pass


# ============================================================
# Map
# ============================================================

def get_map_areas(
    latitude: float | None = None,
    longitude: float | None = None,
    force_refresh: bool = False,
) -> list[dict[str, Any]]:

    response = []

    base_lat = (
        latitude
        if latitude is not None
        else 6.9271
    )

    base_lng = (
        longitude
        if longitude is not None
        else 79.8612
    )

    weather = _get_cached_weather(
        base_lat,
        base_lng,
        force_refresh=force_refresh,
    )

    for area in AREAS:

        history = (
            _build_area_history_complete(
                area.area_id,
                weather,
            )
        )

        current = history[6]

        response.append(
            {
                "area_id": area.area_id,

                "area_name": area.area_name,

                "center": {
                    "latitude": area.center[0],
                    "longitude": area.center[1],
                },

                "polygon": [
                    {
                        "latitude": lat,
                        "longitude": lng,
                    }
                    for lat, lng
                    in area.polygon
                ],

                "current_risk": current,

                "history": history,

                "fill_color": RISK_COLORS[
                    current[
                        "risk_level"
                    ]
                ]["fill"],

                "stroke_color": RISK_COLORS[
                    current[
                        "risk_level"
                    ]
                ]["stroke"],
            }
        )

    return response


# ============================================================
# Area summary
# ============================================================

def get_area_summary(
    latitude: float,
    longitude: float,
    force_refresh: bool = False,
) -> dict[str, Any]:

    area = _nearest_area(
        latitude=latitude,
        longitude=longitude,
    )

    # Coordinate-specific weather.
    weather = _get_cached_weather(
        latitude,
        longitude,
        force_refresh=force_refresh,
    )

    history = (
        _build_area_history_complete(
            area.area_id,
            weather,
        )
    )

    current = history[6]
    next_week = history[7]

    is_critical = (
        current["risk_level"]
        == "high"
    )

    # ----------------------------------------------------------
    # Weather fields
    # ----------------------------------------------------------

    # Keep backward-compatible fields available.
    rainfall_7day_avg = weather.get(
        "rainfall_7day_avg",
        weather.get(
            "rainfall_5day_avg",
            0.0,
        ),
    )

    rainfall_7day_sum = weather.get(
        "rainfall_7day_sum",
        weather.get(
            "rainfall_5day_sum",
            0.0,
        ),
    )

    rainy_days_7d = weather.get(
        "rainy_days_7d",
        weather.get(
            "rainy_days_5d",
            0.0,
        ),
    )

    heavy_rain_days = weather.get(
        "heavy_rain_days",
        weather.get(
            "heavy_rain_days_5d",
            0.0,
        ),
    )

    # ----------------------------------------------------------
    # Final response
    # ----------------------------------------------------------

    return {
        "area_id": area.area_id,

        "area_name": area.area_name,

        "user_location": {
            "latitude": latitude,
            "longitude": longitude,
        },

        "center": {
            "latitude": area.center[0],
            "longitude": area.center[1],
        },

        "current_risk": current,

        "next_week_risk": next_week,

        "history": history,

        "alert": {
            "is_critical": is_critical,

            "frequency": (
                "once_per_day_until_normal"
            ),

            "message": (
                "Critical dengue risk: "
                "take immediate prevention actions "
                "and follow daily alerts until risk normalizes."
                if is_critical
                else
                "Risk is not critical. "
                "Continue weekly prevention habits."
            ),
        },

        "weather": {

            "temperature_c": weather.get(
                "temperature_c",
                0.0,
            ),

            "humidity_pct": weather.get(
                "humidity_pct",
                0.0,
            ),

            "current_rain_mm_h": weather.get(
                "current_rain_mm_h",
                0.0,
            ),

            "today_rain_mm": weather.get(
                "today_rain_mm",
                0.0,
            ),

            # --------------------------------------------------
            # Existing frontend compatibility
            # --------------------------------------------------

            "rainfall_7day_avg": rainfall_7day_avg,

            "rainfall_7day_sum": rainfall_7day_sum,

            "rainy_days_7d": rainy_days_7d,

            "heavy_rain_days": heavy_rain_days,

            "rainfall_mm": weather.get(
                "rainfall_mm",
                weather.get(
                    "today_rain_mm",
                    0.0,
                ),
            ),

            # --------------------------------------------------
            # Correct Free Plan naming
            # --------------------------------------------------

            "rainfall_5day_avg": weather.get(
                "rainfall_5day_avg",
                rainfall_7day_avg,
            ),

            "rainfall_5day_sum": weather.get(
                "rainfall_5day_sum",
                rainfall_7day_sum,
            ),

            "rainy_days_5d": weather.get(
                "rainy_days_5d",
                rainy_days_7d,
            ),

            "heavy_rain_days_5d": weather.get(
                "heavy_rain_days_5d",
                heavy_rain_days,
            ),

            "humidity_avg_5d": weather.get(
                "humidity_avg_5d",
                weather.get(
                    "humidity_pct",
                    0.0,
                ),
            ),

            "valid_forecast_days": weather.get(
                "valid_forecast_days",
                0.0,
            ),

            "temp_min": weather.get(
                "temp_min",
                weather.get(
                    "temperature_c",
                    0.0,
                ),
            ),

            "temp_max": weather.get(
                "temp_max",
                weather.get(
                    "temperature_c",
                    0.0,
                ),
            ),
        },
    }


# ============================================================
# Prevention guide
# ============================================================

def get_prevention_guide() -> dict[str, list[str]]:
    return PREVENTION_GUIDE