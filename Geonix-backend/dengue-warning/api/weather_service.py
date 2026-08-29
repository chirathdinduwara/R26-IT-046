from __future__ import annotations

import logging
import os
from typing import Dict, Optional

import requests

logger = logging.getLogger("dengue_warning.weather")

OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"


def _safe_float(
    value: object,
    default: float = 0.0,
) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _fetch_openmeteo(
    latitude: float,
    longitude: float,
) -> Optional[Dict[str, float]]:
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "current": "temperature_2m,relative_humidity_2m,rain",
        "daily": "temperature_2m_max,temperature_2m_min,rain_sum,relative_humidity_2m_mean",
        "timezone": "auto",
    }

    try:
        response = requests.get(
            OPEN_METEO_FORECAST_URL,
            params=params,
            timeout=10,
        )

        if not response.ok:
            logger.warning(
                "Open-Meteo API returned status %s: %s",
                response.status_code,
                response.text[:300],
            )
            return None

        data = response.json()
        if not isinstance(data, dict):
            logger.warning("Open-Meteo API returned invalid response.")
            return None

        current = data.get("current", {})
        daily = data.get("daily", {})

        current_temp = _safe_float(current.get("temperature_2m"), 28.0)
        current_humidity = _safe_float(current.get("relative_humidity_2m"), 80.0)
        current_rain = _safe_float(current.get("rain"), 0.0)

        daily_rain = daily.get("rain_sum", [])
        if not isinstance(daily_rain, list) or not daily_rain:
            daily_rain = [0.0] * 7

        daily_humidity = daily.get("relative_humidity_2m_mean", [])
        if not isinstance(daily_humidity, list) or not daily_humidity:
            daily_humidity = [current_humidity] * 7

        daily_temp_min = daily.get("temperature_2m_min", [])
        if not isinstance(daily_temp_min, list) or not daily_temp_min:
            daily_temp_min = [current_temp - 2.0] * 7

        daily_temp_max = daily.get("temperature_2m_max", [])
        if not isinstance(daily_temp_max, list) or not daily_temp_max:
            daily_temp_max = [current_temp + 2.0] * 7

        # Clean floats
        rain_values = [_safe_float(r, 0.0) for r in daily_rain]
        humidity_values = [_safe_float(h, current_humidity) for h in daily_humidity]
        temp_min_values = [_safe_float(t, current_temp) for t in daily_temp_min]
        temp_max_values = [_safe_float(t, current_temp) for t in daily_temp_max]

        valid_days = len(rain_values)

        # 5-day metrics
        limit_5d = min(5, valid_days)
        rain_5d = rain_values[:limit_5d]
        humidity_5d = humidity_values[:limit_5d]

        rainfall_5day_sum = sum(rain_5d)
        rainfall_5day_avg = rainfall_5day_sum / limit_5d if limit_5d > 0 else 0.0
        rainy_days_5d = float(sum(1 for r in rain_5d if r > 0.1))
        heavy_rain_days_5d = float(sum(1 for r in rain_5d if r > 10.0))
        humidity_avg_5d = sum(humidity_5d) / limit_5d if limit_5d > 0 else current_humidity

        # 7-day metrics
        limit_7d = min(7, valid_days)
        rain_7d = rain_values[:limit_7d]

        rainfall_7day_sum = sum(rain_7d)
        rainfall_7day_avg = rainfall_7day_sum / limit_7d if limit_7d > 0 else 0.0
        rainy_days_7d = float(sum(1 for r in rain_7d if r > 0.1))
        heavy_rain_days_7d = float(sum(1 for r in rain_7d if r > 10.0))

        # Temperature extremes over the forecast period
        forecast_temp_min = min(temp_min_values) if temp_min_values else current_temp
        forecast_temp_max = max(temp_max_values) if temp_max_values else current_temp

        today_rain_mm = rain_values[0] if rain_values else 0.0

        payload = {
            # Current
            "temperature_c": round(current_temp, 2),
            "humidity_pct": round(current_humidity, 1),
            "current_rain_mm_h": round(current_rain, 2),

            # Today
            "today_rain_mm": round(today_rain_mm, 2),
            "rainfall_mm": round(today_rain_mm, 2),

            # 5-day forecast
            "rainfall_5day_sum": round(rainfall_5day_sum, 2),
            "rainfall_5day_avg": round(rainfall_5day_avg, 2),
            "rainy_days_5d": rainy_days_5d,
            "heavy_rain_days_5d": heavy_rain_days_5d,
            "humidity_avg_5d": round(humidity_avg_5d, 1),
            "valid_forecast_days": float(valid_days),

            # Backward compatibility
            "rainfall_7day_sum": round(rainfall_7day_sum, 2),
            "rainfall_7day_avg": round(rainfall_7day_avg, 2),
            "rainy_days_7d": rainy_days_7d,
            "heavy_rain_days": heavy_rain_days_7d,

            # Temperature
            "temp_min": round(forecast_temp_min, 2),
            "temp_max": round(forecast_temp_max, 2),

            # Compatibility
            "rainfall_14day_sum": round(rainfall_5day_sum, 2),
        }

        logger.info(
            "Weather source: Open-Meteo API. Available forecast days=%s",
            valid_days,
        )
        return payload

    except requests.RequestException as exc:
        logger.warning("Open-Meteo forecast request error: %s", exc)
    except ValueError as exc:
        logger.warning("Open-Meteo JSON parsing error: %s", exc)
    except Exception as exc:
        logger.warning("Unexpected error during Open-Meteo fetch: %s", exc)

    return None


def get_realtime_weather(
    latitude: float,
    longitude: float,
) -> Dict[str, float]:
    """
    Fetch real-time weather using GPS latitude/longitude.

    Uses Open-Meteo API (free tier, no API key required).
    """
    latitude = _safe_float(latitude, float("nan"))
    longitude = _safe_float(longitude, float("nan"))

    # Validate coordinates
    if not (-90.0 <= latitude <= 90.0):
        raise ValueError(f"Invalid latitude: {latitude}")

    if not (-180.0 <= longitude <= 180.0):
        raise ValueError(f"Invalid longitude: {longitude}")

    # Log/read API key if set (kept for backward compatibility, but not required)
    api_key = os.getenv("dengue_OPENWEATHER_API_KEY", "").strip()

    if not api_key:
        from pathlib import Path
        from dotenv import dotenv_values

        env_path = Path(__file__).resolve().parent.parent / ".env"
        if env_path.is_file():
            env_vars = dotenv_values(env_path)
            api_key = env_vars.get("dengue_OPENWEATHER_API_KEY", "").strip()

    if api_key:
        logger.debug("dengue_OPENWEATHER_API_KEY environment variable detected (optional for Open-Meteo).")
    else:
        logger.debug("No dengue_OPENWEATHER_API_KEY set. Continuing without key (Open-Meteo free tier).")

    weather_data = _fetch_openmeteo(latitude=latitude, longitude=longitude)

    if weather_data is None:
        raise RuntimeError("Failed to fetch real-time weather from Open-Meteo API.")

    logger.info(
        "Successfully fetched weather from Open-Meteo API. lat=%s lon=%s",
        latitude,
        longitude,
    )

    return weather_data