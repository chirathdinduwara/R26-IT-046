import asyncio
import os
from pathlib import Path
from typing import Any

import httpx
import joblib
import numpy as np
from fastapi import APIRouter, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "model" / "road_risk_model.pkl"
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
        if key and key not in os.environ:
            os.environ[key] = value


_load_local_env(ENV_PATH)

if not MODEL_PATH.exists():
    raise RuntimeError(f"Safe route model not found: {MODEL_PATH}")

model = joblib.load(MODEL_PATH)

DEFAULT_FLOOD_API_URL = os.getenv("FLOOD_MAP_API_URL", "http://127.0.0.1:8000")

# Division centroids used to build flood-map weather payload.
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


class Coordinate(BaseModel):
    lat: float
    lon: float


class DemoWeatherOverride(BaseModel):
    temperature: float | None = None
    humidity: float | None = None
    rainfall: float | None = None


class DemoConfig(BaseModel):
    weather: DemoWeatherOverride | None = None
    traffic_multiplier: float = 1.0
    flood_points: list[Coordinate] | None = None


class RoadRiskInput(BaseModel):
    temperature: float
    humidity: float
    rainfall: float
    traffic: float
    flood_risk: int
    accident_risk: int


class FloodAreasRequest(BaseModel):
    flood_api_url: str | None = None
    threshold: float | None = None
    openweather_api_key: str | None = None


class SafeRouteRequest(BaseModel):
    origin: Coordinate
    destination: Coordinate
    flood_api_url: str | None = None
    threshold: float | None = None
    openweather_api_key: str | None = None
    google_api_key: str | None = None
    alternatives: bool = True
    avoid_tolls: bool = False
    avoid_highways: bool = False
    avoid_ferries: bool = True
    demo_mode: bool = False
    demo_config: DemoConfig | None = None


# Ensure forward annotations are fully resolved when this module is dynamically loaded.
Coordinate.model_rebuild()
DemoWeatherOverride.model_rebuild()
DemoConfig.model_rebuild()
RoadRiskInput.model_rebuild()
FloodAreasRequest.model_rebuild()
SafeRouteRequest.model_rebuild()


router = APIRouter(prefix="/safe-route", tags=["safe-route"])


def _resolve_api_key(value: str | None, env_names: tuple[str, ...], label: str) -> str:
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


def _predict_risk_probability(features: list[list[float]]) -> float:
    if hasattr(model, "predict_proba"):
        probs = model.predict_proba(features)
        if len(probs[0]) > 1:
            return float(probs[0][1])
        return float(probs[0][0])
    pred = float(model.predict(features)[0])
    return float(np.clip(pred, 0.0, 1.0))


def _decode_polyline(encoded: str) -> list[dict[str, float]]:
    coords: list[dict[str, float]] = []
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


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371000.0
    p1 = np.radians(lat1)
    p2 = np.radians(lat2)
    dp = np.radians(lat2 - lat1)
    dl = np.radians(lon2 - lon1)
    a = np.sin(dp / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(dl / 2) ** 2
    c = 2 * np.arctan2(np.sqrt(a), np.sqrt(1 - a))
    return float(r * c)


def _weather_risk_index(rainfall_mm_h: float, humidity: float) -> float:
    rain_factor = min(1.0, max(0.0, rainfall_mm_h / 18.0))
    humidity_factor = min(1.0, max(0.0, (humidity - 60.0) / 40.0))
    return 0.75 * rain_factor + 0.25 * humidity_factor


def _extract_flood_shapes(geojson: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    areas: list[dict[str, Any]] = []
    shapes: list[dict[str, Any]] = []

    for idx, feature in enumerate(geojson.get("features", [])):
        geom = feature.get("geometry", {})
        props = feature.get("properties", {})
        g_type = geom.get("type")
        coordinates = geom.get("coordinates", [])

        polygon_rings: list[list[list[float]]] = []
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

        all_points: list[tuple[float, float]] = []
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


def _point_near_flood(lat: float, lon: float, shapes: list[dict[str, Any]]) -> bool:
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


def _build_demo_flood_overrides(points: list[Coordinate], start_id: int = 900000) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    areas: list[dict[str, Any]] = []
    shapes: list[dict[str, Any]] = []
    for i, point in enumerate(points):
        pid = start_id + i
        lat = float(point.lat)
        lon = float(point.lon)
        delta = 0.0028  # ~300m box
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


async def _fetch_weather_current(client: httpx.AsyncClient, lat: float, lon: float, api_key: str) -> dict[str, float]:
    resp = await client.get(
        "https://api.openweathermap.org/data/2.5/weather",
        params={"lat": lat, "lon": lon, "appid": api_key, "units": "metric"},
    )
    resp.raise_for_status()
    data = resp.json()
    main = data.get("main", {})
    rain = data.get("rain", {})
    rainfall = float(rain.get("1h", 0.0))
    if rainfall == 0.0 and "3h" in rain:
        rainfall = float(rain.get("3h", 0.0)) / 3.0
    return {
        "temperature": float(main.get("temp", 28.0)),
        "humidity": float(main.get("humidity", 75.0)),
        "rainfall": rainfall,
    }


async def _fetch_forecast_rain(client: httpx.AsyncClient, lat: float, lon: float, api_key: str) -> dict[str, float]:
    resp = await client.get(
        "https://api.openweathermap.org/data/2.5/forecast",
        params={"lat": lat, "lon": lon, "appid": api_key, "units": "metric"},
    )
    resp.raise_for_status()
    data = resp.json()
    rain_5d = 0.0
    for item in data.get("list", []):
        rain_5d += float(item.get("rain", {}).get("3h", 0.0))
    # OpenWeather 5-day forecast scaled to approximate 7/14-day totals for flood model inputs.
    rain_7d = round(rain_5d * 1.4, 1)
    rain_14d = round(rain_5d * 2.8, 1)
    return {"rainfall_7day": rain_7d, "rainfall_14day": rain_14d}


async def _build_flood_payload(client: httpx.AsyncClient, openweather_api_key: str, river_level: float) -> dict[str, Any]:
    tasks = [
        _fetch_forecast_rain(client, coords["lat"], coords["lon"], openweather_api_key)
        for coords in DIVISION_COORDS.values()
    ]
    rains = await asyncio.gather(*tasks)

    divisions: dict[str, dict[str, float]] = {}
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
    threshold: float | None,
) -> dict[str, Any]:
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
) -> list[dict[str, Any]]:
    avoid_parts: list[str] = []
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


async def _search_destinations_google(
    client: httpx.AsyncClient,
    query: str,
    google_api_key: str,
    limit: int,
) -> list[dict[str, Any]]:
    resp = await client.get(
        "https://maps.googleapis.com/maps/api/geocode/json",
        params={
            "address": query,
            "components": "country:LK",
            "region": "lk",
            "key": google_api_key,
        },
    )
    resp.raise_for_status()
    data = resp.json()
    status = data.get("status")
    if status not in ("OK", "ZERO_RESULTS"):
        raise HTTPException(
            status_code=400,
            detail=f"Google Geocoding API error: {status} - {data.get('error_message', '')}".strip(),
        )

    suggestions: list[dict[str, Any]] = []
    for idx, item in enumerate(data.get("results", [])[:limit]):
        loc = item.get("geometry", {}).get("location", {})
        if "lat" not in loc or "lng" not in loc:
            continue
        suggestions.append(
            {
                "id": f"dest_{idx}",
                "label": item.get("formatted_address", "Unknown destination"),
                "lat": float(loc["lat"]),
                "lon": float(loc["lng"]),
            }
        )
    return suggestions


def _evaluate_route(
    route: dict[str, Any],
    weather: dict[str, float],
    flood_shapes: list[dict[str, Any]],
    traffic_multiplier: float = 1.0,
) -> dict[str, Any]:
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

    step_scores: list[float] = []
    step_weights: list[float] = []
    traffic_roads: list[dict[str, Any]] = []
    flooded_roads: list[dict[str, Any]] = []
    dangerous_roads: list[dict[str, Any]] = []

    weather_penalty = _weather_risk_index(weather["rainfall"], weather["humidity"])

    for leg in legs:
        leg_duration = float(leg.get("duration", {}).get("value", 1.0))
        leg_traffic_duration = float(leg.get("duration_in_traffic", {}).get("value", leg_duration))
        leg_traffic_idx = 0.0
        if leg_duration > 0:
            leg_traffic_idx = float(
                np.clip(((leg_traffic_duration / leg_duration - 1.0) * 100.0) * traffic_multiplier, 0.0, 100.0)
            )

        for step in leg.get("steps", []):
            start = step.get("start_location", {})
            end = step.get("end_location", {})
            s_lat = float(start.get("lat", 0.0))
            s_lon = float(start.get("lng", 0.0))
            e_lat = float(end.get("lat", 0.0))
            e_lon = float(end.get("lng", 0.0))
            m_lat = (s_lat + e_lat) / 2.0
            m_lon = (s_lon + e_lon) / 2.0

            near_flood = _point_near_flood(m_lat, m_lon, flood_shapes)
            flood_risk = 1 if near_flood else 0
            accident_risk = 1 if (leg_traffic_idx >= 60 or weather["rainfall"] >= 6) else 0

            model_input = [[
                weather["temperature"],
                weather["humidity"],
                weather["rainfall"],
                leg_traffic_idx,
                flood_risk,
                accident_risk,
            ]]
            model_prob = _predict_risk_probability(model_input)
            final_score = float(np.clip(0.7 * model_prob + 0.2 * weather_penalty + 0.1 * (leg_traffic_idx / 100.0), 0.0, 1.0))

            step_duration = float(step.get("duration", {}).get("value", 30.0))
            step_scores.append(final_score)
            step_weights.append(step_duration)

            segment = {
                "start": {"lat": s_lat, "lon": s_lon},
                "end": {"lat": e_lat, "lon": e_lon},
                "risk_score": round(final_score, 3),
                "traffic_index": round(leg_traffic_idx, 1),
                "near_flood": near_flood,
                "distance_m": float(step.get("distance", {}).get("value", 0.0)),
            }

            if leg_traffic_idx >= 65:
                traffic_roads.append(segment)
            if near_flood:
                flooded_roads.append(segment)
            if final_score >= 0.65 or (near_flood and leg_traffic_idx >= 55):
                dangerous_roads.append(segment)

    route_risk = float(np.average(step_scores, weights=step_weights)) if step_scores else 0.0

    overview_polyline = route.get("overview_polyline", {}).get("points", "")
    decoded_path = _decode_polyline(overview_polyline) if overview_polyline else []

    return {
        "summary": route.get("summary") or "Alternative Route",
        "distance_km": round(distance_m / 1000.0, 2),
        "duration_min": round(duration_sec / 60.0, 1),
        "duration_in_traffic_min": round(duration_traffic_sec / 60.0, 1),
        "risk_score": round(route_risk, 3),
        "weather_risk": round(weather_penalty, 3),
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
    }


async def _build_route_response(req: SafeRouteRequest) -> dict[str, Any]:
    openweather_key = _resolve_api_key(
        req.openweather_api_key,
        ("OPENWEATHER_API_KEY", "OPENWEATHER_KEY"),
        "OpenWeather API key",
    )
    google_key = _resolve_api_key(
        req.google_api_key,
        ("GOOGLE_MAPS_API_KEY", "GOOGLE_API_KEY"),
        "Google Maps API key",
    )
    flood_api_url = req.flood_api_url or DEFAULT_FLOOD_API_URL

    midpoint_lat = (req.origin.lat + req.destination.lat) / 2.0
    midpoint_lon = (req.origin.lon + req.destination.lon) / 2.0

    async with httpx.AsyncClient(timeout=30.0) as client:
        weather_task = _fetch_weather_current(client, midpoint_lat, midpoint_lon, openweather_key)
        google_task = _fetch_google_routes(client, req.origin, req.destination, req, google_key)
        flood_task = _fetch_flood_geojson(client, flood_api_url, openweather_key, req.threshold)

        weather, google_routes, flood_geojson = await asyncio.gather(weather_task, google_task, flood_task)

    flooded_areas, flood_shapes = _extract_flood_shapes(flood_geojson)
    if req.demo_mode and req.demo_config and req.demo_config.flood_points:
        demo_areas, demo_shapes = _build_demo_flood_overrides(req.demo_config.flood_points)
        flooded_areas.extend(demo_areas)
        flood_shapes.extend(demo_shapes)
    if not google_routes:
        raise HTTPException(status_code=404, detail="No route options found")

    if req.demo_mode and req.demo_config and req.demo_config.weather:
        weather_override = req.demo_config.weather
        if weather_override.temperature is not None:
            weather["temperature"] = float(weather_override.temperature)
        if weather_override.humidity is not None:
            weather["humidity"] = float(np.clip(weather_override.humidity, 0.0, 100.0))
        if weather_override.rainfall is not None:
            weather["rainfall"] = float(max(0.0, weather_override.rainfall))

    traffic_multiplier = 1.0
    if req.demo_mode and req.demo_config:
        traffic_multiplier = float(np.clip(req.demo_config.traffic_multiplier, 0.25, 3.0))

    evaluated = [
        _evaluate_route(route, weather, flood_shapes, traffic_multiplier=traffic_multiplier) for route in google_routes
    ]

    min_time = min(r["duration_in_traffic_min"] for r in evaluated)
    max_time = max(r["duration_in_traffic_min"] for r in evaluated)
    time_span = max(max_time - min_time, 0.1)

    for item in evaluated:
        normalized_time = (item["duration_in_traffic_min"] - min_time) / time_span
        item["safety_score"] = round(0.75 * item["risk_score"] + 0.25 * normalized_time, 3)

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
        "message": (
            "Safe and dangerous routes generated using road-risk model + OpenWeather + Google traffic + flood-map."
        ),
    }


@router.get("/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "model_loaded": True}


@router.post("/predict")
def predict(data: RoadRiskInput) -> dict[str, int]:
    features = [[
        data.temperature,
        data.humidity,
        data.rainfall,
        data.traffic,
        data.flood_risk,
        data.accident_risk,
    ]]
    prediction = model.predict(features)
    return {"road_risk": int(prediction[0])}


@router.post("/flooded-areas")
async def flooded_areas(req: FloodAreasRequest) -> dict[str, Any]:
    openweather_key = _resolve_api_key(
        req.openweather_api_key,
        ("OPENWEATHER_API_KEY", "OPENWEATHER_KEY"),
        "OpenWeather API key",
    )
    flood_api_url = req.flood_api_url or DEFAULT_FLOOD_API_URL

    async with httpx.AsyncClient(timeout=30.0) as client:
        geojson = await _fetch_flood_geojson(client, flood_api_url, openweather_key, req.threshold)
    areas, _ = _extract_flood_shapes(geojson)
    return {"count": len(areas), "flooded_areas": areas, "geojson": geojson}


@router.post("/routes")
async def routes(req: SafeRouteRequest) -> dict[str, Any]:
    return await _build_route_response(req)


@router.get("/search-destination")
async def search_destination(q: str, limit: int = 5) -> dict[str, Any]:
    query = q.strip()
    if len(query) < 2:
        return {"count": 0, "results": []}

    limited = max(1, min(limit, 10))
    google_key = _resolve_api_key(
        None,
        ("GOOGLE_MAPS_API_KEY", "GOOGLE_API_KEY"),
        "Google Maps API key",
    )

    async with httpx.AsyncClient(timeout=20.0) as client:
        results = await _search_destinations_google(client, query, google_key, limited)
    return {"count": len(results), "results": results}


@router.post("/go-safe")
async def go_safe(req: SafeRouteRequest) -> dict[str, Any]:
    response = await _build_route_response(req)
    return {
        "safe_route": response["safe_route"],
        "recommended_route_id": response["recommended_route_id"],
        "flooded_areas": response["flooded_areas"],
        "weather": response["weather"],
        "message": "Fastest safe route selected by avoiding high traffic, flood zones, and severe weather.",
    }


app = FastAPI(title="Geonix Safe Route API", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)


# Compatibility aliases for standalone safe_route service usage.
@app.post("/predict")
def predict_alias(data: RoadRiskInput) -> dict[str, int]:
    return predict(data)


@app.post("/flooded-areas")
async def flooded_areas_alias(req: FloodAreasRequest) -> dict[str, Any]:
    return await flooded_areas(req)


@app.post("/routes")
async def routes_alias(req: SafeRouteRequest) -> dict[str, Any]:
    return await routes(req)


@app.get("/search-destination")
async def search_destination_alias(q: str, limit: int = 5) -> dict[str, Any]:
    return await search_destination(q, limit)


@app.post("/go-safe")
async def go_safe_alias(req: SafeRouteRequest) -> dict[str, Any]:
    return await go_safe(req)
