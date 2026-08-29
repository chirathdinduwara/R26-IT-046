import joblib
import pandas as pd
from pandas.core.arrays._mixins import NDArrayBackedExtensionArray

# Monkeypatch pandas NDArrayBackedExtensionArray.__setstate__ to support backward compatibility
# when loading pickle files created by older versions of pandas.
_orig_ndarray_setstate = NDArrayBackedExtensionArray.__setstate__

def _patched_ndarray_setstate(self, state):
    if isinstance(state, tuple) and len(state) == 2 and (state[0] is str or state[0] == "str"):
        state = (pd.StringDtype(), state[1], {})
    return _orig_ndarray_setstate(self, state)

NDArrayBackedExtensionArray.__setstate__ = _patched_ndarray_setstate

_lookup = joblib.load("model/paddy_climate_lookup.pkl")

_climate_by_ds = _lookup["climate_by_district_season"]
_climate_by_d = _lookup["climate_by_district"]
_climate_global = _lookup["climate_global"]

_rain_mean_by_ds = _lookup["rain_mean_by_district_season"]
_rain_mean_global = _lookup["rain_mean_global"]


def get_seasonal_climate_estimate(
    district: str,
    season: str,
    recent_weather: dict = None,
    forecast_weather: dict = None,
    season_total_days: int = 150
) -> dict:

    district = district.strip().title()
    season = season.strip().title()

    base = _lookup_base_climate(district, season)

    result = dict(base)

    if not recent_weather:
        return result

    recent_rain = recent_weather.get("rainfall_mm", 0.0)
    recent_days = recent_weather.get("days_observed", 0)

    if recent_days <= 0:
        return result

    # Historical expected rainfall for the same number of days
    historical_daily_rain = (
        base["total_rainfall"] / season_total_days
    )

    historical_recent_rain = (
        historical_daily_rain * recent_days
    )

    # How abnormal has recent rainfall been?
    if historical_recent_rain > 0:
        rainfall_ratio = (
            recent_rain / historical_recent_rain
        )
    else:
        rainfall_ratio = 1.0

    # Limit extreme adjustment
    rainfall_ratio = max(
        0.5,
        min(rainfall_ratio, 2.0)
    )

    # Forecast influence
    forecast_rain = 0.0

    if forecast_weather:
        forecast_rain = float(
            forecast_weather.get(
                "total_rainfall",
                0.0
            )
        )

    # Expected historical rainfall for next 7 days
    historical_7day_rain = (
        historical_daily_rain * 7
    )

    if historical_7day_rain > 0:
        forecast_ratio = (
            forecast_rain / historical_7day_rain
        )
    else:
        forecast_ratio = 1.0

    forecast_ratio = max(
        0.5,
        min(forecast_ratio, 2.5)
    )

    # Combine recent + forecast signals
    weather_factor = (
        rainfall_ratio * 0.7
        +
        forecast_ratio * 0.3
    )

    # Adjust seasonal rainfall
    adjusted_rainfall = (
        base["total_rainfall"]
        * weather_factor
    )

    result["total_rainfall"] = round(
        adjusted_rainfall,
        2
    )

    # Adjust rainy days approximately
    result["rainy_days"] = round(
        base["rainy_days"] * weather_factor,
        1
    )

    # Temperature response
    if recent_weather.get("avg_temp") is not None:

        result["avg_temp"] = round(
            (
                base["avg_temp"] * 0.7
                +
                recent_weather["avg_temp"] * 0.3
            ),
            2
        )

    return result


def _lookup_base_climate(district: str, season: str) -> dict:

    row = _climate_by_ds[
        (_climate_by_ds["District"] == district) &
        (_climate_by_ds["Season"] == season)
    ]
    if not row.empty:
        row = row.iloc[0]
        return {
            "avg_temp": float(row["avg_temp"]),
            "max_temp": float(row["max_temp"]),
            "min_temp": float(row["min_temp"]),
            "total_rainfall": float(row["total_rainfall"]),
            "rainy_days": float(row["rainy_days"]),
            "wind_speed": float(row["wind_speed"]),
            "evapotranspiration": float(row["evapotranspiration"]),
        }

    # fallback: district only (any season)
    row = _climate_by_d[_climate_by_d["District"] == district]
    if not row.empty:
        row = row.iloc[0]
        return {
            "avg_temp": float(row["avg_temp"]),
            "max_temp": float(row["max_temp"]),
            "min_temp": float(row["min_temp"]),
            "total_rainfall": float(row["total_rainfall"]),
            "rainy_days": float(row["rainy_days"]),
            "wind_speed": float(row["wind_speed"]),
            "evapotranspiration": float(row["evapotranspiration"]),
        }

    # fallback: global mean across all training data
    return {k: float(v) for k, v in _climate_global.items()}


def get_rainfall_deviation(district: str, season: str, seasonal_total_rainfall: float) -> float:
    
    district = district.strip().title()
    season = season.strip().title()

    row = _rain_mean_by_ds[
        (_rain_mean_by_ds["District"] == district) &
        (_rain_mean_by_ds["Season"] == season)
    ]
    if not row.empty:
        mean_rain = float(row.iloc[0]["rain_mean_ds"])
    else:
        mean_rain = float(_rain_mean_global)

    return seasonal_total_rainfall - mean_rain