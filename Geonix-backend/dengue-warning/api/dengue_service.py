from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any


@dataclass(frozen=True)
class AreaProfile:
    area_id: str
    area_name: str
    center: tuple[float, float]
    polygon: list[tuple[float, float]]
    history_scores: list[float]


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


def _history_seed(base: float, trend: float) -> list[float]:
    offsets = [-0.05, -0.035, -0.02, -0.008, 0.006, 0.02, 0.035, 0.05]
    return [_clamp_score(base + trend * i + offsets[i]) for i in range(8)]


DIVISION_SEEDS: list[tuple[str, str, tuple[float, float], float, float, float, float]] = [
    ("colombo", "Colombo", (6.9271, 79.8612), 0.58, 0.012, 0.010, 0.011),
    ("dehiwala", "Dehiwala", (6.8513, 79.8653), 0.50, 0.010, 0.009, 0.010),
    ("homagama", "Homagama", (6.8445, 80.0048), 0.46, 0.008, 0.014, 0.015),
    ("kaduwela", "Kaduwela", (6.9320, 79.9800), 0.55, 0.011, 0.012, 0.013),
    ("kesbewa", "Kesbewa", (6.7954, 79.9266), 0.52, 0.010, 0.011, 0.012),
    ("kolonnawa", "Kolonnawa", (6.9353, 79.8918), 0.60, 0.011, 0.009, 0.010),
    ("maharagama", "Maharagama", (6.8480, 79.9296), 0.54, 0.010, 0.010, 0.011),
    ("moratuwa", "Moratuwa", (6.7730, 79.8816), 0.57, 0.012, 0.010, 0.011),
    ("padukka", "Padukka", (6.8497, 80.0966), 0.43, 0.007, 0.015, 0.016),
    ("ratmalana", "Ratmalana", (6.8210, 79.8800), 0.51, 0.009, 0.010, 0.011),
    ("seethawaka", "Seethawaka", (6.9553, 80.2083), 0.47, 0.007, 0.017, 0.018),
    ("sri_jayawardenepura_kotte", "Sri Jayawardenepura Kotte", (6.8941, 79.9024), 0.56, 0.010, 0.010, 0.011),
    ("thimbirigasyaya", "Thimbirigasyaya", (6.9017, 79.8737), 0.59, 0.011, 0.009, 0.010),
]


AREAS: list[AreaProfile] = [
    AreaProfile(
        area_id=area_id,
        area_name=area_name,
        center=center,
        polygon=_hex_polygon(center=center, radius_lat=radius_lat, radius_lng=radius_lng),
        history_scores=_history_seed(base=base, trend=trend),
    )
    for area_id, area_name, center, base, trend, radius_lat, radius_lng in DIVISION_SEEDS
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
    reference = date.today() - timedelta(days=weeks_ago * 7)
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


def _forecast_next_week(history_scores: list[float]) -> float:
    current = history_scores[-1]
    previous = history_scores[-2]
    previous_two = history_scores[-3]
    trend = current - previous
    momentum = previous - previous_two
    projected = current + 0.55 * trend + 0.20 * momentum
    return _clamp_score(projected)


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


def _area_history(profile: AreaProfile) -> list[dict[str, Any]]:
    history: list[dict[str, Any]] = []
    total = len(profile.history_scores)
    for index, score in enumerate(profile.history_scores):
        weeks_ago = (total - 1) - index
        history.append(_risk_point(score=score, week_label=_week_label(weeks_ago=weeks_ago)))
    return history


def get_map_areas() -> list[dict[str, Any]]:
    response: list[dict[str, Any]] = []
    for area in AREAS:
        history = _area_history(area)
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
    history = _area_history(area)
    current = history[-1]
    next_week_score = _forecast_next_week(area.history_scores)
    next_week = _risk_point(score=next_week_score, week_label=_week_label(weeks_ago=-1))
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
    }


def get_prevention_guide() -> dict[str, list[str]]:
    return PREVENTION_GUIDE
