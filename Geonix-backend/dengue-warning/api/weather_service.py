from __future__ import annotations

import logging
import requests
from typing import Dict

logger = logging.getLogger("dengue_warning.weather")

FALLBACK_WEATHER: Dict[str, float] = {
    "temperature_c": 28.5,
    "humidity_pct": 76.0,
    "rainfall_mm": 4.5,
    "temp_min": 24.5,
    "temp_max": 31.5,
    "rainfall_7day_sum": 35.0,
    "rainfall_14day_sum": 78.0,
    "humidity_avg_7d": 77.0,
    "rainy_days_7d": 3.0,
    "heavy_rain_days": 1.0,
}

def get_realtime_weather(latitude: float, longitude: float) -> Dict[str, float]:
    """
    Fetches real-time and historical weather data for the coordinates using Open-Meteo.
    Calculates features required by the Dengue warning ML model.
    Falls back to Colombo climatic averages if the API is offline.
    """
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "current": "temperature_2m,relative_humidity_2m",
        "hourly": "relative_humidity_2m",
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum",
        "past_days": 14,
        "forecast_days": 1,
        "timezone": "auto",
    }
    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()

        current = data.get("current", {})
        daily = data.get("daily", {})
        hourly = data.get("hourly", {})

        precip_list = daily.get("precipitation_sum", [])
        temp_min_list = daily.get("temperature_2m_min", [])
        temp_max_list = daily.get("temperature_2m_max", [])
        humidity_hourly = hourly.get("relative_humidity_2m", [])

        # Fetch current conditions
        temp_c = float(current.get("temperature_2m", FALLBACK_WEATHER["temperature_c"]))
        humidity = float(current.get("relative_humidity_2m", FALLBACK_WEATHER["humidity_pct"]))

        # Calculate precipitation and min/max metrics for today
        rain_today = float(precip_list[-1]) if precip_list else FALLBACK_WEATHER["rainfall_mm"]
        t_min = float(temp_min_list[-1]) if temp_min_list else FALLBACK_WEATHER["temp_min"]
        t_max = float(temp_max_list[-1]) if temp_max_list else FALLBACK_WEATHER["temp_max"]

        # 7-day and 14-day rainfall sums (including today)
        rain_7d = float(sum(precip_list[-7:])) if len(precip_list) >= 7 else FALLBACK_WEATHER["rainfall_7day_sum"]
        rain_14d = float(sum(precip_list[-14:])) if len(precip_list) >= 14 else FALLBACK_WEATHER["rainfall_14day_sum"]

        # Average humidity over past 7 days (last 168 hours)
        if len(humidity_hourly) >= 168:
            avg_hum_7d = float(sum(humidity_hourly[-168:]) / 168.0)
        else:
            avg_hum_7d = FALLBACK_WEATHER["humidity_avg_7d"]

        # Count rainy and heavy rain days in past 7 days
        recent_precip = precip_list[-7:] if len(precip_list) >= 7 else []
        rainy_days = float(sum(1 for r in recent_precip if r > 0.1)) if recent_precip else FALLBACK_WEATHER["rainy_days_7d"]
        heavy_days = float(sum(1 for r in recent_precip if r > 10.0)) if recent_precip else FALLBACK_WEATHER["heavy_rain_days"]

        return {
            "temperature_c": temp_c,
            "humidity_pct": humidity,
            "rainfall_mm": rain_today,
            "temp_min": t_min,
            "temp_max": t_max,
            "rainfall_7day_sum": rain_7d,
            "rainfall_14day_sum": rain_14d,
            "humidity_avg_7d": avg_hum_7d,
            "rainy_days_7d": rainy_days,
            "heavy_rain_days": heavy_days,
        }

    except Exception as e:
        logger.warning(f"Failed to fetch weather from Open-Meteo: {e}. Using fallback values.")
        return dict(FALLBACK_WEATHER)
