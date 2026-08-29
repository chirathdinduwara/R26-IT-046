import time
import requests
import pandas as pd

from datetime import date, timedelta


# ============================================================
# SIMPLE IN-MEMORY CACHE
# ============================================================

_forecast_cache = {}
_recent_weather_cache = {}

FORECAST_CACHE_SECONDS = 900       # 15 minutes
RECENT_CACHE_SECONDS = 1800        # 30 minutes


def _get_cached(cache, key, ttl_seconds):
    item = cache.get(key)

    if not item:
        return None

    if time.time() - item["timestamp"] > ttl_seconds:
        del cache[key]
        return None

    return item["data"]


def _set_cached(cache, key, data):
    cache[key] = {
        "timestamp": time.time(),
        "data": data
    }


def _request_with_retry(url, params, max_retries=4):
    last_error = None

    for attempt in range(max_retries):

        try:
            response = requests.get(
                url,
                params=params,
                timeout=30
            )

            if response.status_code == 429:
                retry_after = response.headers.get("Retry-After")

                if retry_after:
                    try:
                        wait_seconds = int(retry_after)
                    except ValueError:
                        wait_seconds = 2 ** attempt
                else:
                    wait_seconds = 2 ** attempt

                print(
                    f"Open-Meteo 429 rate limit. "
                    f"Retrying in {wait_seconds}s..."
                )

                time.sleep(wait_seconds)
                continue

            response.raise_for_status()

            return response

        except requests.RequestException as e:
            last_error = e

            if attempt < max_retries - 1:
                wait_seconds = 2 ** attempt

                print(
                    f"Weather request error: {e}. "
                    f"Retrying in {wait_seconds}s..."
                )

                time.sleep(wait_seconds)

    if last_error:
        raise last_error

    raise RuntimeError(
        "Weather service temporarily unavailable."
    )


# ============================================================
# 7-DAY FORECAST
# ============================================================

def get_forecast_weather(lat: float, lon: float):

    cache_key = (
        round(lat, 4),
        round(lon, 4)
    )

    cached = _get_cached(
        _forecast_cache,
        cache_key,
        FORECAST_CACHE_SECONDS
    )

    if cached is not None:
        print(
            f"Using cached forecast for "
            f"{cache_key[0]}, {cache_key[1]}"
        )

        return cached

    url = "https://api.open-meteo.com/v1/forecast"

    params = {

        "latitude": lat,
        "longitude": lon,

        "daily": ",".join([

            "temperature_2m_max",
            "temperature_2m_min",
            "temperature_2m_mean",
            "precipitation_sum",
            "rain_sum",
            "wind_speed_10m_max",
            "et0_fao_evapotranspiration"

        ]),

        "timezone": "Asia/Colombo",
        "forecast_days": 7
    }

    response = _request_with_retry(
        url,
        params
    )

    data = response.json()["daily"]

    df = pd.DataFrame(data)

    daily_forecast = []

    for _, row in df.iterrows():

        daily_forecast.append({

            "date":
                row["time"],

            "rain_mm":
                round(
                    float(row["rain_sum"]),
                    2
                ),

            "precipitation_mm":
                round(
                    float(row["precipitation_sum"]),
                    2
                ),

            "temp_max":
                round(
                    float(row["temperature_2m_max"]),
                    2
                ),

            "temp_min":
                round(
                    float(row["temperature_2m_min"]),
                    2
                ),

        })

    result = {

        "avg_temp":
            round(
                df["temperature_2m_mean"].mean(),
                2
            ),

        "max_temp":
            round(
                df["temperature_2m_max"].mean(),
                2
            ),

        "min_temp":
            round(
                df["temperature_2m_min"].mean(),
                2
            ),

        "total_rainfall":
            round(
                df["precipitation_sum"].sum(),
                2
            ),

        "total_rain":
            round(
                df["rain_sum"].sum(),
                2
            ),

        "rainy_days":
            int(
                (
                    df["precipitation_sum"] > 0
                ).sum()
            ),

        "wind_speed":
            round(
                df["wind_speed_10m_max"].mean(),
                2
            ),

        "evapotranspiration":
            round(
                df[
                    "et0_fao_evapotranspiration"
                ].sum(),
                2
            ),

        "daily_forecast":
            daily_forecast
    }

    _set_cached(
        _forecast_cache,
        cache_key,
        result
    )

    return result


# ============================================================
# RECENT ACTUAL WEATHER
# ============================================================

def get_recent_actual_weather(
    lat: float,
    lon: float,
    days: int = 30
) -> dict:

    cache_key = (
        round(lat, 4),
        round(lon, 4),
        days,
        date.today().isoformat()
    )

    cached = _get_cached(
        _recent_weather_cache,
        cache_key,
        RECENT_CACHE_SECONDS
    )

    if cached is not None:

        print(
            f"Using cached recent weather for "
            f"{cache_key[0]}, {cache_key[1]}"
        )

        return cached

    today = date.today()

    # Avoid asking archive API for today's unfinished data.
    end_date = today - timedelta(days=1)

    start_date = (
        end_date
        - timedelta(days=days - 1)
    )

    url = (
        "https://archive-api.open-meteo.com/v1/archive"
    )

    params = {

        "latitude": lat,
        "longitude": lon,

        "start_date":
            start_date.isoformat(),

        "end_date":
            end_date.isoformat(),

        "daily": ",".join([

            "temperature_2m_mean",
            "precipitation_sum",

        ]),

        "timezone":
            "Asia/Colombo",
    }

    response = _request_with_retry(
        url,
        params
    )

    data = response.json()["daily"]

    df = pd.DataFrame(data)

    if df.empty:

        result = {

            "days_observed": 0,
            "rainfall_mm": 0.0,
            "rainy_days": 0,
            "avg_temp": None

        }

        _set_cached(
            _recent_weather_cache,
            cache_key,
            result
        )

        return result

    df = df.dropna(
        subset=["precipitation_sum"]
    )

    result = {

        "days_observed":
            len(df),

        "rainfall_mm":
            round(
                float(
                    df[
                        "precipitation_sum"
                    ].sum()
                ),
                2
            ),

        "rainy_days":
            int(
                (
                    df[
                        "precipitation_sum"
                    ] > 0
                ).sum()
            ),

        "avg_temp":
            (
                round(
                    float(
                        df[
                            "temperature_2m_mean"
                        ].mean()
                    ),
                    2
                )

                if not df[
                    "temperature_2m_mean"
                ].isna().all()

                else None
            )
    }

    _set_cached(
        _recent_weather_cache,
        cache_key,
        result
    )

    return result