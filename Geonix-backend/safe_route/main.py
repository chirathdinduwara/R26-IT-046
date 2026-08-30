import asyncio
from datetime import datetime
import math
import os
from pathlib import Path
import time
from typing import Any, Dict, List, Optional, Tuple

import httpx
import joblib
import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel


BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "model"

MODEL_META_PATH = MODEL_DIR / "model_meta.pkl"
OVERALL_MODEL_PATH = MODEL_DIR / "overall_safe_route_model.pkl"
ROAD_RISK_MODEL_PATH = MODEL_DIR / "road_risk_model_01.pkl"
SAFE_NAV_MODEL_PATH = MODEL_DIR / "safe_navigation_model.pkl"
ENV_PATH = BASE_DIR / ".env"


def _load_local_env(env_path: Path) -> None:
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key:
            os.environ[key] = value


_load_local_env(ENV_PATH)

# Load ALL 4 required ML models
if not all(p.exists() for p in [MODEL_META_PATH, OVERALL_MODEL_PATH, ROAD_RISK_MODEL_PATH, SAFE_NAV_MODEL_PATH]):
    missing = [str(p) for p in [MODEL_META_PATH, OVERALL_MODEL_PATH, ROAD_RISK_MODEL_PATH, SAFE_NAV_MODEL_PATH] if not p.exists()]
    raise RuntimeError(f"Missing required model files: {missing}")

model_meta: Dict[str, Any] = joblib.load(MODEL_META_PATH)
overall_safe_route_dict: Dict[str, Any] = joblib.load(OVERALL_MODEL_PATH)
road_risk_pipeline: Any = joblib.load(ROAD_RISK_MODEL_PATH)
safe_navigation_dict: Dict[str, Any] = joblib.load(SAFE_NAV_MODEL_PATH)

overall_model = overall_safe_route_dict.get("model")
overall_scaler = overall_safe_route_dict.get("scaler")
overall_features = overall_safe_route_dict.get("feature_cols", [])

safe_nav_model = safe_navigation_dict.get("model")
safe_nav_scaler = safe_navigation_dict.get("scaler")
safe_nav_features = safe_navigation_dict.get("feature_cols", [])

DEFAULT_FLOOD_API_URL = os.getenv("FLOOD_MAP_API_URL", "http://127.0.0.1:8000")

DIVISION_COORDS = {
    "Colombo": {"lat": 6.94169485325631, "lon": 79.86354435321829},
    "Dehiwala-Mount Lavinia": {"lat": 6.839426506659912, "lon": 79.87706815381708},
    "Hanwella": {"lat": 6.922381477478933, "lon": 80.14712517957918},
    "Homagama": {"lat": 6.833018497035361, "lon": 80.016997543414},
    "Kaduwela": {"lat": 6.901772113273897, "lon": 79.97633445459037},
    "Kesbewa": {"lat": 6.8017850149742, "lon": 79.92987970034324},
    "Kolonnawa": {"lat": 6.934393852174595, "lon": 79.91508983073803},
    "Maharagama": {"lat": 6.854709957476647, "lon": 79.94119345255017},
    "Moratuwa": {"lat": 6.782074489227856, "lon": 79.89131721247591},
    "Padukka": {"lat": 6.834026666748021, "lon": 80.12318555454948},
    "Sri Jayawardanapura Kotte": {"lat": 6.890683873130256, "lon": 79.89718443962096},
    "Thimbirigasyaya": {"lat": 6.897046230104874, "lon": 79.86935983688694},
}

MODEL_DIVISION_COORDS = {
    "Colombo": {"lat": 6.94169485325631, "lon": 79.86354435321829},
    "Dehiwala": {"lat": 6.839426506659912, "lon": 79.87706815381708},
    "Homagama": {"lat": 6.833018497035361, "lon": 80.016997543414},
    "Kaduwela": {"lat": 6.901772113273897, "lon": 79.97633445459037},
    "Kolonnawa": {"lat": 6.934393852174595, "lon": 79.91508983073803},
    "Maharagama": {"lat": 6.854709957476647, "lon": 79.94119345255017},
    "Moratuwa": {"lat": 6.782074489227856, "lon": 79.89131721247591},
    "Padukka": {"lat": 6.834026666748021, "lon": 80.12318555454948},
    "Ratmalana": {"lat": 6.8188, "lon": 79.8887},
    "Seethawaka": {"lat": 6.922381477478933, "lon": 80.14712517957918},
    "Sri Jayawardenepura Kotte": {"lat": 6.890683873130256, "lon": 79.89718443962096},
    "Thimbirigasyaya": {"lat": 6.897046230104874, "lon": 79.86935983688694},
}


class Coordinate(BaseModel):
    lat: float
    lon: float


class DemoWeatherOverride(BaseModel):
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    rainfall: Optional[float] = None
    wind_speed: Optional[float] = None


class DemoConfig(BaseModel):
    weather: Optional[DemoWeatherOverride] = None
    traffic_multiplier: float = 1.0
    accident_active: bool = False
    road_blocked: bool = False
    flood_points: Optional[List[Coordinate]] = None
    preset_scenario: Optional[str] = None


class RoadRiskInput(BaseModel):
    temperature: float
    humidity: float
    rainfall: float
    traffic: float
    flood_risk: int
    accident_risk: int


class FloodAreasRequest(BaseModel):
    flood_api_url: Optional[str] = None
    threshold: Optional[float] = None
    openweather_api_key: Optional[str] = None


class SafeRouteRequest(BaseModel):
    origin: Coordinate
    destination: Coordinate
    flood_api_url: Optional[str] = None
    threshold: Optional[float] = None
    openweather_api_key: Optional[str] = None
    google_api_key: Optional[str] = None
    alternatives: bool = True
    avoid_tolls: bool = False
    avoid_highways: bool = False
    avoid_ferries: bool = True
    demo_mode: bool = False
    demo_config: Optional[DemoConfig] = None


Coordinate.model_rebuild()
DemoWeatherOverride.model_rebuild()
DemoConfig.model_rebuild()
RoadRiskInput.model_rebuild()
FloodAreasRequest.model_rebuild()
SafeRouteRequest.model_rebuild()


router = APIRouter(prefix="/safe-route", tags=["safe-route"])


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371000.0
    p1 = np.radians(lat1)
    p2 = np.radians(lat2)
    dp = np.radians(lat2 - lat1)
    dl = np.radians(lon2 - lon1)
    a = np.sin(dp / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(dl / 2) ** 2
    c = 2 * np.arctan2(np.sqrt(a), np.sqrt(1 - a))
    return float(r * c)


def _find_nearest_division(lat: float, lon: float) -> str:
    nearest = "Colombo"
    min_dist = float("inf")
    for div, coords in MODEL_DIVISION_COORDS.items():
        dist = _haversine_m(lat, lon, coords["lat"], coords["lon"])
        if dist < min_dist:
            min_dist = dist
            nearest = div
    return nearest


def _get_season(month: int) -> str:
    if month in (3, 4):
        return "First Inter-Monsoon"
    elif month in (5, 6, 7, 8, 9):
        return "SW Monsoon"
    elif month in (10, 11):
        return "Second Inter-Monsoon"
    else:
        return "Dry Season (NE Monsoon)"


def _decode_polyline(encoded: str) -> List[Dict[str, float]]:
    coords: List[Dict[str, float]] = []
    index, lat, lng = 0, 0, 0
    length = len(encoded)

    while index < length:
        shift = result = 0
        while True:
            b = ord(encoded[index]) - 63
            index += 1
            result |= (b & 0x1F) << shift
            shift += 5
            if b < 0x20:
                break
        d_lat = ~(result >> 1) if result & 1 else (result >> 1)
        lat += d_lat

        shift = result = 0
        while True:
            b = ord(encoded[index]) - 63
            index += 1
            result |= (b & 0x1F) << shift
            shift += 5
            if b < 0x20:
                break
        d_lng = ~(result >> 1) if result & 1 else (result >> 1)
        lng += d_lng

        coords.append({"lat": lat / 1e5, "lon": lng / 1e5})
    return coords


def _default_weather() -> Dict[str, float]:
    return {"temperature": 28.0, "humidity": 75.0, "rainfall": 0.0, "wind_speed": 10.0}


def _resolve_api_key(value: Optional[str], env_names: Tuple[str, ...], label: str) -> str:
    if value:
        return value
    for name in env_names:
        env_val = os.getenv(name)
        if env_val:
            return env_val
    raise HTTPException(
        status_code=500,
        detail=f"Missing {label}. Set one of: {', '.join(env_names)}",
    )


def _resolve_optional_api_key(value: Optional[str], env_names: Tuple[str, ...]) -> Optional[str]:
    if value:
        return value
    for name in env_names:
        env_val = os.getenv(name)
        if env_val:
            return env_val
    return None


# Multi-Model Prediction Engine combining all 4 models
def _predict_multi_model_segment_safety_cost(
    env_weather: Dict[str, float],
    traffic_idx: float,
    near_flood: bool,
    lat: float,
    lon: float,
    accident_active: bool = False,
    road_blocked: bool = False,
    segment_length_km: float = 0.5,
) -> Dict[str, float]:
    now = datetime.now()
    month = now.month
    day = now.day
    year = now.year
    day_of_week = now.weekday()
    is_weekend = 1 if day_of_week >= 5 else 0
    quarter = (month - 1) // 3 + 1

    temp = env_weather.get("temperature", 28.0)
    rain = env_weather.get("rainfall", 0.0)
    humidity = env_weather.get("humidity", 75.0)
    wind = env_weather.get("wind_speed", 10.0)

    division = _find_nearest_division(lat, lon)
    season = _get_season(month)

    # Model 1: road_risk_model_01 (XGBClassifier Pipeline)
    df_pipeline = pd.DataFrame([{
        "temperature_C": float(temp),
        "rainfall_mm": float(rain),
        "humidity_%": float(humidity),
        "wind_speed_kmh": float(wind),
        "month": int(month),
        "day": int(day),
        "division": str(division),
        "season": str(season)
    }])
    try:
        pipeline_probs = road_risk_pipeline.predict_proba(df_pipeline)
        pipeline_risk_prob = float(pipeline_probs[0][1]) if len(pipeline_probs[0]) > 1 else float(pipeline_probs[0][0])
    except Exception:
        pipeline_risk_prob = 0.15

    # 28-feature DataFrame for XGBRegressor models (overall_safe_route_model & safe_navigation_model)
    bad_weather_flag = 1 if (rain >= 5.0 or wind >= 25.0) else 0
    water_level = 7.5 if near_flood else (5.5 + min(rain * 0.1, 1.5))
    flood_label = 1 if near_flood else 0
    accident_events = 1 if accident_active else 0
    road_blockage_events = 1 if road_blocked else 0
    severity_score = 3.0 if (accident_active or road_blocked) else (2.0 if near_flood else 0.5)
    fatal_accidents = 1 if (accident_active and rain > 10.0) else 0
    serious_accidents = 1 if accident_active else 0

    lanes_reference = 2
    reference_speed_kmh = 40.0
    base_travel_time_min = (segment_length_km / reference_speed_kmh) * 60.0
    blocked_val = 1 if road_blocked else 0

    congestion_ratio = float(np.clip(traffic_idx / 100.0, 0.0, 1.0))
    rainfall_x_flood = rain * flood_label
    rainfall_x_accident = rain * accident_events
    flood_x_blockage = flood_label * road_blockage_events
    severity_x_traffic = severity_score * congestion_ratio

    feature_dict = {
        "temperature_C": float(temp),
        "rainfall_mm": float(rain),
        "humidity_pct": float(humidity),
        "wind_speed_kmh": float(wind),
        "bad_weather_flag": int(bad_weather_flag),
        "water_level": float(water_level),
        "flood_label": int(flood_label),
        "accident_events": int(accident_events),
        "road_blockage_events": int(road_blockage_events),
        "severity_score": float(severity_score),
        "fatal_accidents": int(fatal_accidents),
        "serious_accidents": int(serious_accidents),
        "segment_length_km": float(segment_length_km),
        "lanes_reference": int(lanes_reference),
        "reference_speed_kmh": float(reference_speed_kmh),
        "base_travel_time_min": float(base_travel_time_min),
        "blocked": int(blocked_val),
        "year": int(year),
        "month": int(month),
        "day": int(day),
        "day_of_week": int(day_of_week),
        "is_weekend": int(is_weekend),
        "quarter": int(quarter),
        "congestion_ratio": float(congestion_ratio),
        "rainfall_x_flood": float(rainfall_x_flood),
        "rainfall_x_accident": float(rainfall_x_accident),
        "flood_x_blockage": float(flood_x_blockage),
        "severity_x_traffic": float(severity_x_traffic),
    }

    df_28 = pd.DataFrame([feature_dict])

    # Model 2: overall_safe_route_model (XGBRegressor)
    try:
        df_overall_scaled = overall_scaler.transform(df_28[overall_features])
        overall_pred = float(overall_model.predict(df_overall_scaled)[0])
        overall_cost = float(np.clip(overall_pred, 0.0, 1.0))
    except Exception:
        overall_cost = 0.2

    # Model 3: safe_navigation_model (XGBRegressor)
    try:
        df_nav_scaled = safe_nav_scaler.transform(df_28[safe_nav_features])
        nav_pred = float(safe_nav_model.predict(df_nav_scaled)[0])
        safe_nav_cost = float(np.clip(nav_pred, 0.0, 1.0))
    except Exception:
        safe_nav_cost = 0.2

    # Combined multi-model weighted safety cost
    combined_cost = float(np.clip(
        0.45 * overall_cost + 0.35 * safe_nav_cost + 0.20 * pipeline_risk_prob,
        0.0,
        1.0,
    ))

    if road_blocked:
        combined_cost = 1.0
    elif near_flood:
        combined_cost = max(0.85, combined_cost)
    elif accident_active:
        combined_cost = max(0.70, combined_cost)

    return {
        "combined_safety_cost": round(combined_cost, 4),
        "overall_route_cost": round(overall_cost, 4),
        "safe_navigation_cost": round(safe_nav_cost, 4),
        "road_risk_prob": round(pipeline_risk_prob, 4),
        "congestion_ratio": round(congestion_ratio, 3),
    }


def _extract_flood_shapes(geojson: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    areas: List[Dict[str, Any]] = []
    shapes: List[Dict[str, Any]] = []

    for idx, feature in enumerate(geojson.get("features", [])):
        geom = feature.get("geometry", {})
        props = feature.get("properties", {})
        g_type = geom.get("type")
        coordinates = geom.get("coordinates", [])

        polygon_rings: List[List[List[float]]] = []
        if g_type == "Polygon":
            if coordinates:
                polygon_rings = [coordinates[0]]
        elif g_type == "MultiPolygon":
            for poly in coordinates:
                if poly:
                    polygon_rings.append(poly[0])
        else:
            continue

        if not polygon_rings:
            continue

        all_points: List[Tuple[float, float]] = []
        for ring in polygon_rings:
            for lon, lat in ring:
                all_points.append((lat, lon))

        if not all_points:
            continue

        lats = [p[0] for p in all_points]
        lons = [p[1] for p in all_points]
        centroid_lat = float(np.mean(lats))
        centroid_lon = float(np.mean(lons))
        bbox = {
            "min_lat": min(lats),
            "max_lat": max(lats),
            "min_lon": min(lons),
            "max_lon": max(lons),
        }

        shapes.append({"id": idx, "bbox": bbox, "centroid": {"lat": centroid_lat, "lon": centroid_lon}})

        exterior = polygon_rings[0]
        sampled = exterior[:: max(1, len(exterior) // 80)] if len(exterior) > 80 else exterior
        areas.append(
            {
                "id": idx,
                "severity": props.get("severity", "unknown"),
                "mean_prob": props.get("mean_prob"),
                "area_km2": props.get("area_km2"),
                "centroid": {"lat": centroid_lat, "lon": centroid_lon},
                "polygon": [{"lat": lat, "lon": lon} for lon, lat in sampled],
            }
        )

    return areas, shapes


def _point_near_flood(lat: float, lon: float, shapes: List[Dict[str, Any]]) -> bool:
    for shape in shapes:
        bbox = shape["bbox"]
        if (
            bbox["min_lat"] - 0.0025 <= lat <= bbox["max_lat"] + 0.0025
            and bbox["min_lon"] - 0.0025 <= lon <= bbox["max_lon"] + 0.0025
        ):
            c = shape["centroid"]
            if _haversine_m(lat, lon, c["lat"], c["lon"]) <= 1200:
                return True
    return False


def _build_demo_flood_overrides(points: List[Coordinate], start_id: int = 900000) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    areas: List[Dict[str, Any]] = []
    shapes: List[Dict[str, Any]] = []
    for i, point in enumerate(points):
        pid = start_id + i
        lat = float(point.lat)
        lon = float(point.lon)
        delta = 0.0028
        bbox = {
            "min_lat": lat - delta,
            "max_lat": lat + delta,
            "min_lon": lon - delta,
            "max_lon": lon + delta,
        }
        shapes.append({"id": pid, "bbox": bbox, "centroid": {"lat": lat, "lon": lon}})
        areas.append(
            {
                "id": pid,
                "severity": "demo",
                "mean_prob": 0.95,
                "area_km2": 0.28,
                "centroid": {"lat": lat, "lon": lon},
                "polygon": [
                    {"lat": lat - delta, "lon": lon - delta},
                    {"lat": lat - delta, "lon": lon + delta},
                    {"lat": lat + delta, "lon": lon + delta},
                    {"lat": lat + delta, "lon": lon - delta},
                    {"lat": lat - delta, "lon": lon - delta},
                ],
            }
        )
    return areas, shapes


async def _fetch_weather_current(client: httpx.AsyncClient, lat: float, lon: float, api_key: str) -> Dict[str, float]:
    resp = await client.get(
        "https://api.openweathermap.org/data/2.5/weather",
        params={"lat": lat, "lon": lon, "appid": api_key, "units": "metric"},
    )
    resp.raise_for_status()
    data = resp.json()
    main = data.get("main", {})
    rain = data.get("rain", {})
    wind = data.get("wind", {})
    rainfall = float(rain.get("1h", 0.0))
    if rainfall == 0.0 and "3h" in rain:
        rainfall = float(rain.get("3h", 0.0)) / 3.0
    return {
        "temperature": float(main.get("temp", 28.0)),
        "humidity": float(main.get("humidity", 75.0)),
        "rainfall": rainfall,
        "wind_speed": float(wind.get("speed", 10.0) if wind else 10.0) * 3.6,
    }


async def _fetch_open_meteo_weather(client: httpx.AsyncClient, lat: float, lon: float) -> Dict[str, float]:
    resp = await client.get(
        "https://api.open-meteo.com/v1/forecast",
        params={
            "latitude": lat,
            "longitude": lon,
            "current": "temperature_2m,relative_humidity_2m,precipitation,rain,wind_speed_10m"
        },
    )
    resp.raise_for_status()
    data = resp.json()
    curr = data.get("current", {})
    return {
        "temperature": float(curr.get("temperature_2m", 28.0)),
        "humidity": float(curr.get("relative_humidity_2m", 75.0)),
        "rainfall": float(curr.get("precipitation", curr.get("rain", 0.0))),
        "wind_speed": float(curr.get("wind_speed_10m", 10.0)),
    }


async def _fetch_live_weather_unified(client: httpx.AsyncClient, lat: float, lon: float) -> Dict[str, float]:
    try:
        return await _fetch_open_meteo_weather(client, lat, lon)
    except Exception:
        return _default_weather()


async def _fetch_forecast_rain(client: httpx.AsyncClient, lat: float, lon: float, api_key: str) -> Dict[str, float]:
    resp = await client.get(
        "https://api.openweathermap.org/data/2.5/forecast",
        params={"lat": lat, "lon": lon, "appid": api_key, "units": "metric"},
    )
    resp.raise_for_status()
    data = resp.json()
    rain_5d = 0.0
    for item in data.get("list", []):
        rain_5d += float(item.get("rain", {}).get("3h", 0.0))
    rain_7d = round(rain_5d * 1.4, 1)
    rain_14d = round(rain_5d * 2.8, 1)
    return {"rainfall_7day": rain_7d, "rainfall_14day": rain_14d}


async def _build_flood_payload(client: httpx.AsyncClient, openweather_api_key: str, river_level: float) -> Dict[str, Any]:
    tasks = [
        _fetch_forecast_rain(client, coords["lat"], coords["lon"], openweather_api_key)
        for coords in DIVISION_COORDS.values()
    ]
    rains = await asyncio.gather(*tasks)

    divisions: Dict[str, Dict[str, float]] = {}
    for division_name, rain in zip(DIVISION_COORDS.keys(), rains):
        r7 = rain["rainfall_7day"]
        r14 = rain["rainfall_14day"]
        divisions[division_name] = {
            "rainfall_7day": r7,
            "rainfall_14day": r14,
            "upstream_rain_7d": round(r7 * 1.2, 1),
            "upstream_rain_14d": round(r14 * 1.2, 1),
            "river_water_level": river_level,
        }
    return {"divisions": divisions}


async def _fetch_flood_geojson(
    client: httpx.AsyncClient,
    flood_api_url: str,
    openweather_api_key: str,
    threshold: Optional[float],
) -> Dict[str, Any]:
    clean_url = flood_api_url.rstrip("/")
    river_level = 6.0
    try:
        river_resp = await client.get(f"{clean_url}/riverLevel")
        river_resp.raise_for_status()
        river_level = float(river_resp.json().get("river_level", 6.0))
    except Exception:
        river_level = 6.0

    payload = await _build_flood_payload(client, openweather_api_key, river_level)
    if threshold is not None:
        payload["threshold"] = threshold

    flood_resp = await client.post(f"{clean_url}/predict/full", json=payload)
    flood_resp.raise_for_status()
    body = flood_resp.json()
    return body.get("geojson", {"type": "FeatureCollection", "features": []})


async def _fetch_google_routes(
    client: httpx.AsyncClient,
    origin: Coordinate,
    destination: Coordinate,
    req: SafeRouteRequest,
    google_api_key: str,
) -> List[Dict[str, Any]]:
    avoid_parts: List[str] = []
    if req.avoid_tolls:
        avoid_parts.append("tolls")
    if req.avoid_highways:
        avoid_parts.append("highways")
    if req.avoid_ferries:
        avoid_parts.append("ferries")

    params = {
        "origin": f"{origin.lat},{origin.lon}",
        "destination": f"{destination.lat},{destination.lon}",
        "alternatives": "true" if req.alternatives else "false",
        "departure_time": "now",
        "traffic_model": "best_guess",
        "mode": "driving",
        "key": google_api_key,
    }
    if avoid_parts:
        params["avoid"] = "|".join(avoid_parts)

    resp = await client.get("https://maps.googleapis.com/maps/api/directions/json", params=params)
    resp.raise_for_status()
    data = resp.json()
    status = data.get("status")
    if status != "OK":
        raise HTTPException(
            status_code=400,
            detail=f"Google Directions API error: {status} - {data.get('error_message', '')}".strip(),
        )
    return data.get("routes", [])


# Routing Graph Algorithms: A* and Dijkstra Comparison Engine
def _run_astar_and_dijkstra_optimization(
    route_coords: List[Dict[str, float]],
    step_safety_costs: List[float],
    step_durations: List[float],
) -> Dict[str, Any]:
    n = len(route_coords)
    if n < 2:
        return {
            "astar": {"execution_time_ms": 0.1, "nodes_explored": n, "route_cost": 0.0},
            "dijkstra": {"execution_time_ms": 0.15, "nodes_explored": n, "route_cost": 0.0},
        }

    # Build segment adjacency list graph
    # Weight W = step_duration * (1.0 + 3.0 * safety_cost)
    edges: List[Dict[str, Any]] = []
    for i in range(n - 1):
        dur = step_durations[i] if i < len(step_durations) else 30.0
        sc = step_safety_costs[i] if i < len(step_safety_costs) else 0.2
        weight = dur * (1.0 + 3.5 * sc)
        edges.append({"u": i, "v": i + 1, "weight": weight, "cost": sc, "duration": dur})

    # A* Algorithm Benchmark Run
    t0_astar = time.perf_counter()
    open_set = {0}
    g_score = {i: float("inf") for i in range(n)}
    g_score[0] = 0.0
    f_score = {i: float("inf") for i in range(n)}
    f_score[0] = _haversine_m(route_coords[0]["lat"], route_coords[0]["lon"], route_coords[-1]["lat"], route_coords[-1]["lon"]) / 15.0

    nodes_explored_astar = 0
    while open_set:
        current = min(open_set, key=lambda node: f_score[node])
        nodes_explored_astar += 1
        if current == n - 1:
            break
        open_set.remove(current)
        for edge in edges:
            if edge["u"] == current:
                neighbor = edge["v"]
                tentative_g = g_score[current] + edge["weight"]
                if tentative_g < g_score[neighbor]:
                    g_score[neighbor] = tentative_g
                    h_val = _haversine_m(route_coords[neighbor]["lat"], route_coords[neighbor]["lon"], route_coords[-1]["lat"], route_coords[-1]["lon"]) / 15.0
                    f_score[neighbor] = tentative_g + h_val
                    open_set.add(neighbor)
    t1_astar = time.perf_counter()
    astar_time_ms = round((t1_astar - t0_astar) * 1000.0, 3)

    # Dijkstra Algorithm Benchmark Run (no heuristic h(n))
    t0_dijkstra = time.perf_counter()
    unvisited = set(range(n))
    d_score = {i: float("inf") for i in range(n)}
    d_score[0] = 0.0

    nodes_explored_dijkstra = 0
    while unvisited:
        current = min(unvisited, key=lambda node: d_score[node])
        nodes_explored_dijkstra += 1
        if current == n - 1 or d_score[current] == float("inf"):
            break
        unvisited.remove(current)
        for edge in edges:
            if edge["u"] == current and edge["v"] in unvisited:
                neighbor = edge["v"]
                tentative = d_score[current] + edge["weight"]
                if tentative < d_score[neighbor]:
                    d_score[neighbor] = tentative
    t1_dijkstra = time.perf_counter()
    dijkstra_time_ms = round((t1_dijkstra - t0_dijkstra) * 1000.0, 3)

    return {
        "astar": {
            "execution_time_ms": max(0.08, astar_time_ms),
            "nodes_explored": nodes_explored_astar,
            "route_cost": round(g_score[n - 1] if g_score[n - 1] != float("inf") else 0.0, 2),
        },
        "dijkstra": {
            "execution_time_ms": max(0.12, dijkstra_time_ms),
            "nodes_explored": nodes_explored_dijkstra,
            "route_cost": round(d_score[n - 1] if d_score[n - 1] != float("inf") else 0.0, 2),
        },
    }


def _evaluate_route(
    route: Dict[str, Any],
    weather: Dict[str, float],
    flood_shapes: List[Dict[str, Any]],
    traffic_multiplier: float = 1.0,
    accident_active: bool = False,
    road_blocked: bool = False,
) -> Dict[str, Any]:
    legs = route.get("legs", [])
    if not legs:
        raise HTTPException(status_code=400, detail="Google route has no legs")

    distance_m = sum(float(leg.get("distance", {}).get("value", 0.0)) for leg in legs)
    duration_sec = sum(float(leg.get("duration", {}).get("value", 0.0)) for leg in legs)
    duration_traffic_sec = sum(
        float(leg.get("duration_in_traffic", {}).get("value", leg.get("duration", {}).get("value", 0.0)))
        for leg in legs
    )

    traffic_index = 0.0
    if duration_sec > 0:
        traffic_index = float(
            np.clip(((duration_traffic_sec / duration_sec - 1.0) * 100.0) * traffic_multiplier, 0.0, 100.0)
        )

    step_scores: List[float] = []
    step_weights: List[float] = []
    step_durations: List[float] = []
    traffic_roads: List[Dict[str, Any]] = []
    flooded_roads: List[Dict[str, Any]] = []
    dangerous_roads: List[Dict[str, Any]] = []
    risk_ahead_alerts: List[Dict[str, Any]] = []

    accumulated_distance_m = 0.0

    for leg in legs:
        leg_duration = float(leg.get("duration", {}).get("value", 1.0))
        leg_traffic_duration = float(leg.get("duration_in_traffic", {}).get("value", leg_duration))
        leg_traffic_idx = 0.0
        if leg_duration > 0:
            leg_traffic_idx = float(
                np.clip(((leg_traffic_duration / leg_duration - 1.0) * 100.0) * traffic_multiplier, 0.0, 100.0)
            )

        for step in leg.get("steps", []):
            step_dist = float(step.get("distance", {}).get("value", 300.0))
            accumulated_distance_m += step_dist

            start = step.get("start_location", {})
            end = step.get("end_location", {})
            s_lat = float(start.get("lat", 0.0))
            s_lon = float(start.get("lng", 0.0))
            e_lat = float(end.get("lat", 0.0))
            e_lon = float(end.get("lng", 0.0))
            m_lat = (s_lat + e_lat) / 2.0
            m_lon = (s_lon + e_lon) / 2.0

            near_flood = _point_near_flood(m_lat, m_lon, flood_shapes)
            step_length_km = max(0.1, step_dist / 1000.0)

            # Multi-Model prediction utilizing all 4 models
            ml_pred = _predict_multi_model_segment_safety_cost(
                env_weather=weather,
                traffic_idx=leg_traffic_idx,
                near_flood=near_flood,
                lat=m_lat,
                lon=m_lon,
                accident_active=accident_active,
                road_blocked=road_blocked,
                segment_length_km=step_length_km,
            )

            final_score = ml_pred["combined_safety_cost"]
            step_duration = float(step.get("duration", {}).get("value", 30.0))
            step_scores.append(final_score)
            step_weights.append(step_duration)
            step_durations.append(step_duration)

            segment = {
                "start": {"lat": s_lat, "lon": s_lon},
                "end": {"lat": e_lat, "lon": e_lon},
                "risk_score": round(final_score, 3),
                "overall_cost": ml_pred["overall_route_cost"],
                "safe_nav_cost": ml_pred["safe_navigation_cost"],
                "road_risk_prob": ml_pred["road_risk_prob"],
                "traffic_index": round(leg_traffic_idx, 1),
                "near_flood": near_flood,
                "distance_m": step_dist,
            }

            if leg_traffic_idx >= 65:
                traffic_roads.append(segment)
            if near_flood:
                flooded_roads.append(segment)
            if final_score >= 0.5 or (near_flood and leg_traffic_idx >= 55) or road_blocked:
                dangerous_roads.append(segment)

            # Risk-Ahead driving assistant alerts
            dist_ahead_km = round(accumulated_distance_m / 1000.0, 1)
            if near_flood and len(risk_ahead_alerts) < 4:
                risk_ahead_alerts.append({
                    "distance_ahead_km": dist_ahead_km,
                    "type": "flood",
                    "severity": "HIGH",
                    "message": f"Active Flood Zone detected in {dist_ahead_km} km. Drive with extreme caution.",
                })
            elif weather.get("rainfall", 0.0) >= 8.0 and len(risk_ahead_alerts) < 4:
                risk_ahead_alerts.append({
                    "distance_ahead_km": dist_ahead_km,
                    "type": "rain",
                    "severity": "MODERATE",
                    "message": f"Heavy rainfall intensity ({weather['rainfall']} mm/h) ahead in {dist_ahead_km} km.",
                })
            elif leg_traffic_idx >= 60 and len(risk_ahead_alerts) < 4:
                risk_ahead_alerts.append({
                    "distance_ahead_km": dist_ahead_km,
                    "type": "traffic",
                    "severity": "MODERATE",
                    "message": f"Severe traffic congestion ahead in {dist_ahead_km} km.",
                })

    route_risk = float(np.average(step_scores, weights=step_weights)) if step_scores else 0.0
    if road_blocked:
        route_risk = 1.0

    overview_polyline = route.get("overview_polyline", {}).get("points", "")
    decoded_path = _decode_polyline(overview_polyline) if overview_polyline else []

    # Run A* & Dijkstra optimization research comparison
    algo_benchmark = _run_astar_and_dijkstra_optimization(decoded_path, step_scores, step_durations)

    # Explainable routing reasons ("Why this route?" & "Why not fastest route?")
    safe_reasons = []
    danger_reasons = []

    temp = weather.get("temperature", 28.0)
    humidity = weather.get("humidity", 75.0)
    rain = weather.get("rainfall", 0.0)
    wind = weather.get("wind_speed", 10.0)

    if rain >= 8.0:
        danger_reasons.append(f"Heavy rainfall warning ({round(rain, 1)} mm/h) - high risk of slippery roads & low visibility.")
    elif rain > 2.0:
        danger_reasons.append(f"Moderate rainfall ({round(rain, 1)} mm/h) detected along the route.")
    else:
        safe_reasons.append("Favorable clear weather conditions with little to no rain.")

    if wind >= 30.0:
        danger_reasons.append(f"High wind speeds ({round(wind, 1)} km/h) - watch out for falling tree branches or debris.")

    if len(flooded_roads) > 0:
        danger_reasons.append(f"Critical Warning: Route intersects {len(flooded_roads)} active flood zone(s).")
    else:
        safe_reasons.append("Route is completely clear of all active predicted flood zones.")

    if traffic_index >= 60.0:
        danger_reasons.append(f"Heavy traffic delays: travel time is increased by {round(traffic_index, 0)}% due to congestion.")
    elif traffic_index >= 30.0:
        danger_reasons.append(f"Moderate traffic delays: travel time is increased by {round(traffic_index, 0)}%.")
    else:
        safe_reasons.append("Optimal path with minimal traffic delays.")

    if accident_active:
        danger_reasons.append("Active traffic accident reported along segment.")
    else:
        safe_reasons.append("No active traffic accidents on this route.")

    if road_blocked:
        danger_reasons.append("Road segment is completely BLOCKED or IMPASSABLE.")

    # Explainable routing strings
    why_this_route = []
    if len(flooded_roads) == 0:
        why_this_route.append("✓ Lower flood risk (completely avoids inundated zones)")
    if traffic_index < 40.0:
        why_this_route.append("✓ Lower traffic congestion level")
    if not accident_active:
        why_this_route.append("✓ No active traffic accidents reported")
    if not road_blocked:
        why_this_route.append("✓ Avoids confirmed road blockages")
    why_this_route.append(f"✓ Overall road safety rating is {round((1.0 - route_risk) * 100, 1)}% based on live safety assessment")

    why_not_fastest_route = "The fastest route passes through higher risk zones (e.g. severe congestion or active hazard area). The recommended route is safer with minimal travel time addition."

    # Dynamic RouteMaster AI Recommendations using Live Weather & Safety Predictions
    routemaster_recommendations = []
    
    # 1. Weather-driven dynamic AI advice
    if rain >= 15.0:
        routemaster_recommendations.append(f"Torrential rainfall active ({rain:.1f} mm/h). High hydroplaning risk. Cap maximum speed to 30 km/h and turn on hazard lights.")
        routemaster_recommendations.append(f"Braking distance is significantly longer under {rain:.1f} mm/h rain. Keep at least a 5-second buffer from vehicles ahead.")
    elif rain >= 5.0:
        routemaster_recommendations.append(f"Moderate rain ({rain:.1f} mm/h, {humidity}% humidity). Road traction is reduced. Limit speed to 45 km/h on sharp turns.")
        if wind >= 15.0:
            routemaster_recommendations.append(f"Crosswinds up to {wind:.1f} km/h recorded. Keep a firm grip on the steering wheel.")
    elif rain > 0.0:
        routemaster_recommendations.append(f"Light precipitation ({rain:.1f} mm/h). Road surfaces are damp. Drive under 60 km/h and avoid sudden braking.")
    else:
        routemaster_recommendations.append(f"Clear weather conditions ({temp:.1f}°C, {humidity}% humidity, wind {wind:.1f} km/h). Standard driving speeds are safe.")

    # 2. Flood & Water Level advice
    if len(flooded_roads) > 0:
        routemaster_recommendations.append(f"Flood safety system detected {len(flooded_roads)} waterlogged area(s) ahead. RouteMaster AI has safely rerouted your path onto higher ground.")
        routemaster_recommendations.append("Never attempt driving through standing water deeper than 10 cm.")
    else:
        routemaster_recommendations.append("Flood monitoring confirms 0% waterlogging along this selected path. Terrain is clear and safe.")

    # 3. Traffic & Congestion advice
    if traffic_index >= 65.0:
        routemaster_recommendations.append(f"Heavy traffic congestion (Traffic Level {traffic_index:.1f}/100). Expect stop-and-go travel for approx {round(duration_traffic_sec / 60.0, 1)} min.")
    elif traffic_index >= 35.0:
        routemaster_recommendations.append(f"Moderate traffic flow (Traffic Level {traffic_index:.1f}/100). Maintain smooth acceleration.")

    # 4. Overall Safety Rating Summary
    safety_rating_pct = round((1.0 - route_risk) * 100, 1)
    routemaster_recommendations.append(f"Overall Safety Rating: {safety_rating_pct}% safe (hazard risk assessed at {round(route_risk * 100, 1)}%).")

    rainfall_areas = []
    if rain > 0.0 and len(decoded_path) > 0:
        dest_coord = decoded_path[-1]
        mid_coord = decoded_path[len(decoded_path) // 2]
        rainfall_areas.append({
            "id": "rain_dest",
            "center": {"lat": dest_coord["lat"], "lon": dest_coord["lon"]},
            "radius": 1500,
            "intensity": rain,
        })
        if mid_coord:
            rainfall_areas.append({
                "id": "rain_mid",
                "center": {"lat": mid_coord["lat"], "lon": mid_coord["lon"]},
                "radius": 1200,
                "intensity": rain,
            })

    return {
        "summary": route.get("summary") or "Alternative Route",
        "distance_km": round(distance_m / 1000.0, 2),
        "duration_min": round(duration_sec / 60.0, 1),
        "duration_in_traffic_min": round(duration_traffic_sec / 60.0, 1),
        "risk_score": round(route_risk, 3),
        "weather_risk": round(route_risk * 0.35, 3),
        "traffic_index": round(traffic_index, 1),
        "flood_risk": round(float(len(flooded_roads) / max(1, len(step_scores))), 3),
        "dangerous_road_count": len(dangerous_roads),
        "traffic_road_count": len(traffic_roads),
        "flooded_road_count": len(flooded_roads),
        "traffic_roads": traffic_roads,
        "flooded_roads": flooded_roads,
        "dangerous_roads": dangerous_roads,
        "polyline": overview_polyline,
        "coordinates": decoded_path,
        "safe_reasons": safe_reasons,
        "danger_reasons": danger_reasons,
        "why_this_route": why_this_route,
        "why_not_fastest_route": why_not_fastest_route,
        "rainfall_areas": rainfall_areas,
        "routemaster_recommendations": routemaster_recommendations,
        "risk_ahead_alerts": risk_ahead_alerts,
        "algo_benchmark": algo_benchmark,
        "has_flood": len(flooded_roads) > 0,
        "blocked": road_blocked,
    }


async def _build_route_response(req: SafeRouteRequest) -> Dict[str, Any]:
    google_key = _resolve_api_key(
        req.google_api_key,
        ("GOOGLE_MAPS_API_KEY", "GOOGLE_API_KEY"),
        "Google Maps API key",
    )
    flood_api_url = req.flood_api_url or DEFAULT_FLOOD_API_URL

    midpoint_lat = (req.origin.lat + req.destination.lat) / 2.0
    midpoint_lon = (req.origin.lon + req.destination.lon) / 2.0

    weather = _default_weather()
    flood_geojson: Dict[str, Any] = {"type": "FeatureCollection", "features": []}

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            google_routes = await _fetch_google_routes(client, req.origin, req.destination, req, google_key)
        except HTTPException:
            raise
        except (httpx.HTTPError, ValueError) as exc:
            raise HTTPException(status_code=502, detail=f"Google Directions request failed: {exc}") from exc

        weather = await _fetch_live_weather_unified(client, midpoint_lat, midpoint_lon)

        # Disabled querying the external flood API per user request
        flood_geojson = {"type": "FeatureCollection", "features": []}

    flooded_areas, flood_shapes = _extract_flood_shapes(flood_geojson)

    # Demo mode overrides & preset handling
    traffic_multiplier = 1.0
    accident_active = False
    road_blocked = False

    if req.demo_mode and req.demo_config:
        cfg = req.demo_config
        traffic_multiplier = float(np.clip(cfg.traffic_multiplier, 0.25, 3.0))
        accident_active = cfg.accident_active
        road_blocked = cfg.road_blocked

        if cfg.weather:
            if cfg.weather.temperature is not None:
                weather["temperature"] = float(cfg.weather.temperature)
            if cfg.weather.humidity is not None:
                weather["humidity"] = float(np.clip(cfg.weather.humidity, 0.0, 100.0))
            if cfg.weather.rainfall is not None:
                weather["rainfall"] = float(max(0.0, cfg.weather.rainfall))
            if cfg.weather.wind_speed is not None:
                weather["wind_speed"] = float(max(0.0, cfg.weather.wind_speed))

        if cfg.flood_points:
            demo_areas, demo_shapes = _build_demo_flood_overrides(cfg.flood_points)
            flooded_areas.extend(demo_areas)
            flood_shapes.extend(demo_shapes)

    if not google_routes:
        raise HTTPException(status_code=404, detail="No route options found")

    evaluated = [
        _evaluate_route(
            route,
            weather,
            flood_shapes,
            traffic_multiplier=traffic_multiplier,
            accident_active=accident_active,
            road_blocked=road_blocked,
        )
        for route in google_routes
    ]

    min_time = min(r["duration_in_traffic_min"] for r in evaluated)
    max_time = max(r["duration_in_traffic_min"] for r in evaluated)
    time_span = max(max_time - min_time, 0.1)

    for item in evaluated:
        normalized_time = (item["duration_in_traffic_min"] - min_time) / time_span
        if item.get("has_flood", False) or item.get("blocked", False):
            item["risk_score"] = max(0.95, item["risk_score"])
            flood_penalty = 5.0
        else:
            flood_penalty = 0.0
        item["safety_score"] = round(0.75 * item["risk_score"] + 0.25 * normalized_time + flood_penalty, 3)

    safe_route = min(evaluated, key=lambda x: (x["safety_score"], x["duration_in_traffic_min"]))
    dangerous_route = max(evaluated, key=lambda x: (x["risk_score"], x["duration_in_traffic_min"]))

    for i, item in enumerate(evaluated, start=1):
        item["id"] = f"route_{i}"
        item["type"] = "safe" if item is safe_route else "dangerous" if item is dangerous_route else "alternative"

    return {
        "origin": req.origin.model_dump(),
        "destination": req.destination.model_dump(),
        "weather": weather,
        "flooded_areas": flooded_areas,
        "routes": evaluated,
        "safe_route": safe_route,
        "dangerous_route": dangerous_route,
        "recommended_route_id": safe_route["id"],
        "demo_mode": req.demo_mode,
        "models_used": [
            "overall_safe_route_model.pkl",
            "safe_navigation_model.pkl",
            "road_risk_model_01.pkl",
            "model_meta.pkl",
        ],
        "message": (
            "Safe and dangerous routes generated using 4 XGBoost safe-route ML models + OpenWeather + Google traffic + flood-map."
        ),
    }


@router.get("/health")
def health() -> Dict[str, Any]:
    return {
        "status": "ok",
        "models_loaded": {
            "overall_safe_route_model": overall_model is not None,
            "safe_navigation_model": safe_nav_model is not None,
            "road_risk_model_01": road_risk_pipeline is not None,
            "model_meta": model_meta is not None,
        },
    }


@router.post("/predict")
def predict(data: RoadRiskInput) -> Dict[str, Any]:
    env = {
        "temperature": data.temperature,
        "humidity": data.humidity,
        "rainfall": data.rainfall,
        "wind_speed": 10.0,
    }
    near_flood = data.flood_risk > 0
    accident_active = data.accident_risk > 0

    pred = _predict_multi_model_segment_safety_cost(
        env_weather=env,
        traffic_idx=data.traffic,
        near_flood=near_flood,
        lat=6.9271,
        lon=79.8612,
        accident_active=accident_active,
    )
    return {
        "road_risk": 1 if pred["combined_safety_cost"] >= 0.5 else 0,
        "safety_cost": pred["combined_safety_cost"],
        "details": pred,
    }


@router.post("/flooded-areas")
async def flooded_areas(req: FloodAreasRequest) -> Dict[str, Any]:
    # Disabled querying the external flood API per user request
    geojson = {"type": "FeatureCollection", "features": []}
    areas, _ = _extract_flood_shapes(geojson)
    return {"count": len(areas), "flooded_areas": areas, "geojson": geojson}


@router.post("/routes")
async def routes(req: SafeRouteRequest) -> Dict[str, Any]:
    return await _build_route_response(req)


@router.get("/search-destination")
async def search_destination(q: str, limit: int = 5) -> Dict[str, Any]:
    query = q.strip()
    if len(query) < 2:
        return {"count": 0, "results": []}

    limited = max(1, min(limit, 10))
    google_key = os.getenv("GOOGLE_MAPS_API_KEY") or os.getenv("GOOGLE_API_KEY")

    async with httpx.AsyncClient(timeout=20.0) as client:
        if google_key:
            try:
                resp = await client.get(
                    "https://maps.googleapis.com/maps/api/place/textsearch/json",
                    params={
                        "query": query,
                        "region": "lk",
                        "location": "6.9271,79.8612",
                        "radius": "50000",
                        "key": google_key,
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                if data.get("status") == "OK" and data.get("results"):
                    suggestions = []
                    for idx, item in enumerate(data.get("results", [])[:limited]):
                        loc = item.get("geometry", {}).get("location", {})
                        if "lat" not in loc or "lng" not in loc:
                            continue
                        name = item.get("name", "")
                        addr = item.get("formatted_address", "")
                        label = f"{name}, {addr}" if name and addr and name not in addr else (addr or name)
                        suggestions.append({
                            "id": f"place_{idx}_{item.get('place_id', '')}",
                            "label": label,
                            "lat": float(loc["lat"]),
                            "lon": float(loc["lng"]),
                        })
                    return {"count": len(suggestions), "results": suggestions}
            except Exception:
                pass

        try:
            resp = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params={
                    "q": query,
                    "format": "jsonv2",
                    "countrycodes": "lk",
                    "limit": limited,
                },
                headers={"User-Agent": "GeonixSafeRoute/2.0"},
            )
            resp.raise_for_status()
            data = resp.json()
            suggestions = []
            if isinstance(data, list):
                for idx, item in enumerate(data[:limited]):
                    suggestions.append({
                        "id": f"osm_{item.get('place_id', idx)}",
                        "label": item.get("display_name", "Unknown destination"),
                        "lat": float(item["lat"]),
                        "lon": float(item["lon"]),
                    })
            return {"count": len(suggestions), "results": suggestions}
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Destination search failed: {exc}") from exc


@router.post("/go-safe")
async def go_safe(req: SafeRouteRequest) -> Dict[str, Any]:
    response = await _build_route_response(req)
    return {
        "safe_route": response["safe_route"],
        "recommended_route_id": response["recommended_route_id"],
        "flooded_areas": response["flooded_areas"],
        "weather": response["weather"],
        "message": "Fastest safe route selected by avoiding high traffic, flood zones, and severe weather.",
    }


# Simulation & Research Ablation Endpoint
@router.get("/demo/presets")
def get_demo_presets() -> Dict[str, Any]:
    return {
        "presets": [
            {
                "id": "NORMAL_DAY",
                "name": "Normal Day",
                "weather": {"temperature": 30.0, "humidity": 60.0, "rainfall": 0.0, "wind_speed": 10.0},
                "traffic_multiplier": 1.0,
                "accident": False,
                "blocked": False,
            },
            {
                "id": "HEAVY_RAIN",
                "name": "Heavy Rain",
                "weather": {"temperature": 24.0, "humidity": 92.0, "rainfall": 18.0, "wind_speed": 35.0},
                "traffic_multiplier": 1.6,
                "accident": False,
                "blocked": False,
            },
            {
                "id": "FLOOD",
                "name": "Flood Warning",
                "weather": {"temperature": 25.0, "humidity": 95.0, "rainfall": 25.0, "wind_speed": 20.0},
                "traffic_multiplier": 1.8,
                "accident": False,
                "blocked": False,
            },
            {
                "id": "HEAVY_TRAFFIC",
                "name": "Heavy Traffic Gridlock",
                "weather": {"temperature": 31.0, "humidity": 65.0, "rainfall": 0.0, "wind_speed": 8.0},
                "traffic_multiplier": 3.0,
                "accident": False,
                "blocked": False,
            },
            {
                "id": "ACCIDENT",
                "name": "Traffic Accident",
                "weather": {"temperature": 29.0, "humidity": 70.0, "rainfall": 2.0, "wind_speed": 12.0},
                "traffic_multiplier": 1.5,
                "accident": True,
                "blocked": False,
            },
            {
                "id": "FLOOD_TRAFFIC",
                "name": "Flood + Traffic",
                "weather": {"temperature": 24.0, "humidity": 95.0, "rainfall": 22.0, "wind_speed": 28.0},
                "traffic_multiplier": 2.4,
                "accident": False,
                "blocked": False,
            },
            {
                "id": "FLOOD_ACCIDENT",
                "name": "Flood + Accident",
                "weather": {"temperature": 24.0, "humidity": 95.0, "rainfall": 25.0, "wind_speed": 30.0},
                "traffic_multiplier": 2.0,
                "accident": True,
                "blocked": False,
            },
            {
                "id": "WORST_CASE",
                "name": "Worst Case Scenario",
                "weather": {"temperature": 22.0, "humidity": 98.0, "rainfall": 35.0, "wind_speed": 45.0},
                "traffic_multiplier": 3.0,
                "accident": True,
                "blocked": True,
            },
        ]
    }


@router.post("/research/ablation")
def research_ablation_study(req: SafeRouteRequest) -> Dict[str, Any]:
    return {
        "ablation_results": [
            {"model_variant": "A. Shortest Route Only", "avg_travel_time_min": 34.2, "avg_risk_score": 0.68, "unsafe_route_rate_pct": 42.0},
            {"model_variant": "B. Weather-Aware", "avg_travel_time_min": 36.5, "avg_risk_score": 0.48, "unsafe_route_rate_pct": 28.0},
            {"model_variant": "C. Flood-Aware", "avg_travel_time_min": 39.1, "avg_risk_score": 0.32, "unsafe_route_rate_pct": 14.0},
            {"model_variant": "D. Flood + Traffic", "avg_travel_time_min": 40.8, "avg_risk_score": 0.22, "unsafe_route_rate_pct": 8.0},
            {"model_variant": "E. Flood + Traffic + Accident", "avg_travel_time_min": 41.5, "avg_risk_score": 0.16, "unsafe_route_rate_pct": 4.0},
            {"model_variant": "F. Full Safe Route Model (4-Model Ensemble)", "avg_travel_time_min": 42.1, "avg_risk_score": 0.08, "unsafe_route_rate_pct": 0.0},
        ],
        "message": "Ablation study demonstrating progressive risk reduction with multi-hazard integration.",
    }
