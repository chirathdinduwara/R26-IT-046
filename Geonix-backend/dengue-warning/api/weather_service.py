from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Dict, Optional

import requests


logger = logging.getLogger("dengue_warning.weather")


# ============================================================
# OpenWeather Free Plan
# ============================================================

OPENWEATHER_CURRENT_URL = (
    "https://api.openweathermap.org/data/2.5/weather"
)

OPENWEATHER_FORECAST_URL = (
    "https://api.openweathermap.org/data/2.5/forecast"
)


# ============================================================
# Helper functions
# ============================================================

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


def _safe_int(
    value: object,
    default: int = 0,
) -> int:
    try:
        if value is None:
            return default

        return int(value)

    except (TypeError, ValueError):
        return default


def _get_current_rain_mm_h(
    weather_data: dict,
) -> float:
    """
    Current rainfall from OpenWeather.

    rain.1h = precipitation during the last 1 hour, in mm.
    """

    rain = weather_data.get("rain")

    if not isinstance(rain, dict):
        return 0.0

    return _safe_float(
        rain.get("1h"),
        0.0,
    )


def _get_forecast_rain_3h(
    forecast_item: dict,
) -> float:
    """
    Rainfall for one 3-hour forecast period.

    rain.3h = precipitation during that 3-hour period, in mm.
    """

    rain = forecast_item.get("rain")

    if not isinstance(rain, dict):
        return 0.0

    return _safe_float(
        rain.get("3h"),
        0.0,
    )


def _get_forecast_humidity(
    forecast_item: dict,
    fallback: float,
) -> float:
    main = forecast_item.get("main")

    if not isinstance(main, dict):
        return fallback

    return _safe_float(
        main.get("humidity"),
        fallback,
    )


# ============================================================
# Aggregate 3-hour forecast into daily forecast
# ============================================================

def _aggregate_forecast_by_day(
    forecast_items: list,
    current_humidity: float,
    timezone_offset: int = 0,
) -> list[dict]:
    """
    Convert OpenWeather 3-hour forecast items into daily data.

    Free Weather plan:
        5 days
        3-hour intervals

    No fake days are added.
    """

    daily: dict[str, dict] = {}

    for item in forecast_items:

        if not isinstance(item, dict):
            continue

        timestamp = _safe_int(
            item.get("dt"),
            0,
        )

        if timestamp <= 0:
            continue

        # OpenWeather city timezone offset is in seconds.
        local_timestamp = timestamp + timezone_offset

        forecast_dt = datetime.fromtimestamp(
            local_timestamp,
            tz=timezone.utc,
        )

        date_key = forecast_dt.date().isoformat()

        if date_key not in daily:
            daily[date_key] = {
                "date": date_key,
                "rain": 0.0,
                "humidity_values": [],
                "temp_values": [],
            }

        # ------------------------------------------------------
        # Rain
        # ------------------------------------------------------

        rain_3h = _get_forecast_rain_3h(
            item
        )

        daily[date_key]["rain"] += rain_3h

        # ------------------------------------------------------
        # Humidity
        # ------------------------------------------------------

        humidity = _get_forecast_humidity(
            item,
            current_humidity,
        )

        daily[date_key][
            "humidity_values"
        ].append(humidity)

        # ------------------------------------------------------
        # Temperature
        # ------------------------------------------------------

        main = item.get("main")

        if isinstance(main, dict):
            temp = main.get("temp")

            if temp is not None:
                daily[date_key][
                    "temp_values"
                ].append(
                    _safe_float(
                        temp,
                        0.0,
                    )
                )

    # ----------------------------------------------------------
    # Convert dictionary into clean daily list
    # ----------------------------------------------------------

    result: list[dict] = []

    for date_key in sorted(daily.keys())[:5]:

        data = daily[date_key]

        humidity_values = data[
            "humidity_values"
        ]

        temp_values = data[
            "temp_values"
        ]

        humidity_avg = (
            sum(humidity_values)
            / len(humidity_values)
            if humidity_values
            else current_humidity
        )

        temp_min = (
            min(temp_values)
            if temp_values
            else 0.0
        )

        temp_max = (
            max(temp_values)
            if temp_values
            else 0.0
        )

        result.append(
            {
                "date": date_key,

                "rain": round(
                    data["rain"],
                    2,
                ),

                "humidity": round(
                    humidity_avg,
                    1,
                ),

                "temp_min": round(
                    temp_min,
                    2,
                ),

                "temp_max": round(
                    temp_max,
                    2,
                ),
            }
        )

    return result


# ============================================================
# Calculate statistics
# ============================================================

def _calculate_forecast_statistics(
    daily_forecast: list[dict],
    current_humidity: float,
) -> Dict[str, float]:
    """
    Calculate rainfall and humidity statistics.

    IMPORTANT:
    OpenWeather Free Plan gives approximately 5 days.
    Therefore these are 5-day statistics.

    rainfall_7day_avg is retained as a backward-compatible
    field because the existing dengue ML/service code expects it.

    It represents the average over the available forecast days,
    NOT a true 7-day forecast.
    """

    if not daily_forecast:

        return {
            "rainfall_5day_sum": 0.0,
            "rainfall_5day_avg": 0.0,

            # Backward compatibility.
            "rainfall_7day_sum": 0.0,
            "rainfall_7day_avg": 0.0,

            "rainy_days_5d": 0.0,
            "rainy_days_7d": 0.0,

            "heavy_rain_days_5d": 0.0,
            "heavy_rain_days": 0.0,

            "humidity_avg_5d": round(
                current_humidity,
                1,
            ),

            "valid_forecast_days": 0.0,
        }

    rain_values = [
        _safe_float(
            day.get("rain"),
            0.0,
        )
        for day in daily_forecast
    ]

    humidity_values = [
        _safe_float(
            day.get("humidity"),
            current_humidity,
        )
        for day in daily_forecast
        if day.get("humidity") is not None
    ]

    valid_days = len(rain_values)

    rainfall_sum = sum(
        rain_values
    )

    rainfall_average = (
        rainfall_sum / valid_days
        if valid_days > 0
        else 0.0
    )

    rainy_days = sum(
        1
        for rain in rain_values
        if rain > 0.1
    )

    heavy_rain_days = sum(
        1
        for rain in rain_values
        if rain > 10.0
    )

    humidity_average = (
        sum(humidity_values)
        / len(humidity_values)
        if humidity_values
        else current_humidity
    )

    return {
        # ------------------------------------------------------
        # Correct Free Plan metrics
        # ------------------------------------------------------

        "rainfall_5day_sum": round(
            rainfall_sum,
            2,
        ),

        "rainfall_5day_avg": round(
            rainfall_average,
            2,
        ),

        # ------------------------------------------------------
        # Backward compatibility with existing ML/service code
        #
        # IMPORTANT:
        # This is NOT a real 7-day forecast.
        # It uses the available forecast days.
        # ------------------------------------------------------

        "rainfall_7day_sum": round(
            rainfall_sum,
            2,
        ),

        "rainfall_7day_avg": round(
            rainfall_average,
            2,
        ),

        "rainy_days_5d": float(
            rainy_days
        ),

        "rainy_days_7d": float(
            rainy_days
        ),

        "heavy_rain_days_5d": float(
            heavy_rain_days
        ),

        "heavy_rain_days": float(
            heavy_rain_days
        ),

        "humidity_avg_5d": round(
            humidity_average,
            1,
        ),

        "valid_forecast_days": float(
            valid_days
        ),
    }


# ============================================================
# Fetch current weather
# ============================================================

def _fetch_current_weather(
    latitude: float,
    longitude: float,
    api_key: str,
) -> Optional[dict]:
    params = {
        "lat": latitude,
        "lon": longitude,
        "appid": api_key,
        "units": "metric",
    }

    try:

        response = requests.get(
            OPENWEATHER_CURRENT_URL,
            params=params,
            timeout=10,
        )

        if not response.ok:

            logger.warning(
                "OpenWeather current API returned "
                "status %s: %s",
                response.status_code,
                response.text[:300],
            )

            return None

        data = response.json()

        if not isinstance(data, dict):

            logger.warning(
                "OpenWeather current API returned "
                "invalid response."
            )

            return None

        main = data.get("main")

        if not isinstance(main, dict):

            logger.warning(
                "OpenWeather current API missing main."
            )

            return None

        if main.get("temp") is None:

            logger.warning(
                "OpenWeather current API missing temperature."
            )

            return None

        if main.get("humidity") is None:

            logger.warning(
                "OpenWeather current API missing humidity."
            )

            return None

        temperature_c = _safe_float(
            main.get("temp"),
            0.0,
        )

        humidity_pct = _safe_float(
            main.get("humidity"),
            0.0,
        )

        current_rain_mm_h = (
            _get_current_rain_mm_h(
                data
            )
        )

        return {
            "temperature_c": temperature_c,
            "humidity_pct": humidity_pct,
            "current_rain_mm_h": current_rain_mm_h,

            "temp_min": _safe_float(
                main.get("temp_min"),
                temperature_c,
            ),

            "temp_max": _safe_float(
                main.get("temp_max"),
                temperature_c,
            ),
        }

    except requests.RequestException as exc:

        logger.warning(
            "OpenWeather current request error: %s",
            exc,
        )

    except ValueError as exc:

        logger.warning(
            "OpenWeather current JSON error: %s",
            exc,
        )

    except (TypeError, KeyError) as exc:

        logger.warning(
            "OpenWeather current response error: %s",
            exc,
        )

    return None


# ============================================================
# Fetch 5-day / 3-hour forecast
# ============================================================

def _fetch_forecast(
    latitude: float,
    longitude: float,
    api_key: str,
    current_humidity: float,
) -> Optional[dict]:

    params = {
        "lat": latitude,
        "lon": longitude,
        "appid": api_key,
        "units": "metric",
    }

    try:

        response = requests.get(
            OPENWEATHER_FORECAST_URL,
            params=params,
            timeout=10,
        )

        if not response.ok:

            logger.warning(
                "OpenWeather forecast API returned "
                "status %s: %s",
                response.status_code,
                response.text[:300],
            )

            return None

        data = response.json()

        if not isinstance(data, dict):

            logger.warning(
                "OpenWeather forecast returned invalid response."
            )

            return None

        forecast_items = data.get("list")

        if (
            not isinstance(
                forecast_items,
                list,
            )
            or not forecast_items
        ):

            logger.warning(
                "OpenWeather forecast missing list."
            )

            return None

        # ------------------------------------------------------
        # Get timezone offset from API response
        # ------------------------------------------------------

        city = data.get("city")

        timezone_offset = 0

        if isinstance(city, dict):

            timezone_offset = _safe_int(
                city.get("timezone"),
                0,
            )

        # ------------------------------------------------------
        # Aggregate 3-hour records
        # ------------------------------------------------------

        daily_forecast = (
            _aggregate_forecast_by_day(
                forecast_items=forecast_items,
                current_humidity=current_humidity,
                timezone_offset=timezone_offset,
            )
        )

        if not daily_forecast:

            logger.warning(
                "OpenWeather forecast had no usable daily data."
            )

            return None

        # ------------------------------------------------------
        # Today's date in the API location timezone
        # ------------------------------------------------------

        now_utc = datetime.now(
            timezone.utc
        )

        local_timestamp = (
            now_utc.timestamp()
            + timezone_offset
        )

        local_now = datetime.fromtimestamp(
            local_timestamp,
            tz=timezone.utc,
        )

        today_key = (
            local_now.date().isoformat()
        )

        today_entry = next(
            (
                day
                for day in daily_forecast
                if day["date"] == today_key
            ),
            None,
        )

        today_rain_mm = (
            _safe_float(
                today_entry.get("rain"),
                0.0,
            )
            if today_entry
            else 0.0
        )

        # ------------------------------------------------------
        # Forecast temperature range
        # ------------------------------------------------------

        all_min_temps = [
            _safe_float(
                day.get("temp_min"),
                0.0,
            )
            for day in daily_forecast
            if day.get("temp_min") is not None
        ]

        all_max_temps = [
            _safe_float(
                day.get("temp_max"),
                0.0,
            )
            for day in daily_forecast
            if day.get("temp_max") is not None
        ]

        forecast_temp_min = (
            min(all_min_temps)
            if all_min_temps
            else None
        )

        forecast_temp_max = (
            max(all_max_temps)
            if all_max_temps
            else None
        )

        return {
            "daily": daily_forecast,

            "today_rain_mm": round(
                today_rain_mm,
                2,
            ),

            "temp_min": forecast_temp_min,
            "temp_max": forecast_temp_max,

            "timezone_offset": timezone_offset,
        }

    except requests.RequestException as exc:

        logger.warning(
            "OpenWeather forecast request error: %s",
            exc,
        )

    except ValueError as exc:

        logger.warning(
            "OpenWeather forecast JSON error: %s",
            exc,
        )

    except (
        TypeError,
        KeyError,
        OverflowError,
    ) as exc:

        logger.warning(
            "OpenWeather forecast response error: %s",
            exc,
        )

    return None


# ============================================================
# Main weather fetch
# ============================================================

def _fetch_openweather(
    latitude: float,
    longitude: float,
    api_key: str,
) -> Optional[Dict[str, float]]:

    # ----------------------------------------------------------
    # Current weather
    # ----------------------------------------------------------

    current = _fetch_current_weather(
        latitude=latitude,
        longitude=longitude,
        api_key=api_key,
    )

    if current is None:

        logger.warning(
            "Failed to fetch current weather."
        )

        return None

    # ----------------------------------------------------------
    # Forecast
    # ----------------------------------------------------------

    forecast = _fetch_forecast(
        latitude=latitude,
        longitude=longitude,
        api_key=api_key,
        current_humidity=current[
            "humidity_pct"
        ],
    )

    # ----------------------------------------------------------
    # If forecast fails, still return current weather
    # ----------------------------------------------------------

    if forecast is None:

        logger.warning(
            "Forecast unavailable. "
            "Returning current weather only."
        )

        return {
            "temperature_c": round(
                current["temperature_c"],
                2,
            ),

            "humidity_pct": round(
                current["humidity_pct"],
                1,
            ),

            "current_rain_mm_h": round(
                current["current_rain_mm_h"],
                2,
            ),

            "today_rain_mm": 0.0,

            "rainfall_mm": 0.0,

            "rainfall_5day_sum": 0.0,
            "rainfall_5day_avg": 0.0,

            # Compatibility fields.
            "rainfall_7day_sum": 0.0,
            "rainfall_7day_avg": 0.0,

            "rainy_days_5d": 0.0,
            "rainy_days_7d": 0.0,

            "heavy_rain_days_5d": 0.0,
            "heavy_rain_days": 0.0,

            "humidity_avg_5d": round(
                current["humidity_pct"],
                1,
            ),

            "valid_forecast_days": 0.0,

            "temp_min": round(
                current["temp_min"],
                2,
            ),

            "temp_max": round(
                current["temp_max"],
                2,
            ),

            "rainfall_14day_sum": 0.0,
        }

    daily = forecast.get(
        "daily",
        [],
    )

    if not isinstance(
        daily,
        list,
    ):
        daily = []

    statistics = (
        _calculate_forecast_statistics(
            daily_forecast=daily,
            current_humidity=current[
                "humidity_pct"
            ],
        )
    )

    forecast_temp_min = forecast.get(
        "temp_min"
    )

    forecast_temp_max = forecast.get(
        "temp_max"
    )

    if not isinstance(
        forecast_temp_min,
        (int, float),
    ):
        forecast_temp_min = current[
            "temp_min"
        ]

    if not isinstance(
        forecast_temp_max,
        (int, float),
    ):
        forecast_temp_max = current[
            "temp_max"
        ]

    today_rain_mm = _safe_float(
        forecast.get(
            "today_rain_mm",
            0.0,
        ),
        0.0,
    )

    payload = {
        # ------------------------------------------------------
        # Current
        # ------------------------------------------------------

        "temperature_c": round(
            current["temperature_c"],
            2,
        ),

        "humidity_pct": round(
            current["humidity_pct"],
            1,
        ),

        "current_rain_mm_h": round(
            current["current_rain_mm_h"],
            2,
        ),

        # ------------------------------------------------------
        # Today
        # ------------------------------------------------------

        "today_rain_mm": round(
            today_rain_mm,
            2,
        ),

        "rainfall_mm": round(
            today_rain_mm,
            2,
        ),

        # ------------------------------------------------------
        # 5-day forecast
        # ------------------------------------------------------

        "rainfall_5day_sum": statistics[
            "rainfall_5day_sum"
        ],

        "rainfall_5day_avg": statistics[
            "rainfall_5day_avg"
        ],

        "rainy_days_5d": statistics[
            "rainy_days_5d"
        ],

        "heavy_rain_days_5d": statistics[
            "heavy_rain_days_5d"
        ],

        "humidity_avg_5d": statistics[
            "humidity_avg_5d"
        ],

        "valid_forecast_days": statistics[
            "valid_forecast_days"
        ],

        # ------------------------------------------------------
        # Backward compatibility
        # ------------------------------------------------------

        "rainfall_7day_sum": statistics[
            "rainfall_7day_sum"
        ],

        "rainfall_7day_avg": statistics[
            "rainfall_7day_avg"
        ],

        "rainy_days_7d": statistics[
            "rainy_days_7d"
        ],

        "heavy_rain_days": statistics[
            "heavy_rain_days"
        ],

        # ------------------------------------------------------
        # Temperature
        # ------------------------------------------------------

        "temp_min": round(
            float(forecast_temp_min),
            2,
        ),

        "temp_max": round(
            float(forecast_temp_max),
            2,
        ),

        # ------------------------------------------------------
        # Compatibility
        # ------------------------------------------------------

        "rainfall_14day_sum": statistics[
            "rainfall_5day_sum"
        ],
    }

    logger.info(
        "Weather source: OpenWeather Free plan "
        "(current + 5-day/3-hour forecast). "
        "Available forecast days=%s",
        int(
            statistics[
                "valid_forecast_days"
            ]
        ),
    )

    return payload


# ============================================================
# Public API
# ============================================================

def get_realtime_weather(
    latitude: float,
    longitude: float,
) -> Dict[str, float]:
    """
    Fetch real-time weather using GPS latitude/longitude.

    Uses OpenWeather Free Weather APIs only.
    """

    latitude = _safe_float(
        latitude,
        float("nan"),
    )

    longitude = _safe_float(
        longitude,
        float("nan"),
    )

    # ----------------------------------------------------------
    # Validate coordinates
    # ----------------------------------------------------------

    if not (
        -90.0 <= latitude <= 90.0
    ):
        raise ValueError(
            f"Invalid latitude: {latitude}"
        )

    if not (
        -180.0 <= longitude <= 180.0
    ):
        raise ValueError(
            f"Invalid longitude: {longitude}"
        )

    # ----------------------------------------------------------
    # API key
    # ----------------------------------------------------------

    from pathlib import Path
    from dotenv import dotenv_values

    env_path = Path(__file__).resolve().parent.parent / ".env"
    env_vars = dotenv_values(env_path)
    api_key = env_vars.get("dengue_OPENWEATHER_API_KEY", "").strip()

    if not api_key:
        raise RuntimeError(
            "dengue_OPENWEATHER_API_KEY is missing in dengue-warning/.env; "
            "cannot fetch real-time weather."
        )

    # ----------------------------------------------------------
    # Fetch
    # ----------------------------------------------------------

    weather_data = _fetch_openweather(
        latitude=latitude,
        longitude=longitude,
        api_key=api_key,
    )

    if weather_data is None:

        raise RuntimeError(
            "Failed to fetch real-time weather "
            "from OpenWeather API."
        )

    logger.info(
        "Successfully fetched weather from OpenWeather "
        "Free Weather API. lat=%s lon=%s",
        latitude,
        longitude,
    )

    return weather_data