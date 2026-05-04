import requests
import pandas as pd

def get_forecast_weather(lat: float, lon: float):
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

    response = requests.get(url, params=params, timeout=30)
    response.raise_for_status()

    data = response.json()["daily"]
    df = pd.DataFrame(data)

    daily_forecast = []
    for _, row in df.iterrows():
        daily_forecast.append({
            "date": row["time"],
            "rain_mm": round(float(row["rain_sum"]), 2),
            "precipitation_mm": round(float(row["precipitation_sum"]), 2),
            "temp_max": round(float(row["temperature_2m_max"]), 2),
            "temp_min": round(float(row["temperature_2m_min"]), 2),
        })

    return {
        "avg_temp": round(df["temperature_2m_mean"].mean(), 2),
        "max_temp": round(df["temperature_2m_max"].mean(), 2),
        "min_temp": round(df["temperature_2m_min"].mean(), 2),
        "total_rainfall": round(df["precipitation_sum"].sum(), 2),
        "total_rain": round(df["rain_sum"].sum(), 2),
        "rainy_days": int((df["precipitation_sum"] > 0).sum()),
        "wind_speed": round(df["wind_speed_10m_max"].mean(), 2),
        "evapotranspiration": round(df["et0_fao_evapotranspiration"].sum(), 2),
        "daily_forecast": daily_forecast
    }