from fastapi import FastAPI
from pydantic import BaseModel
import joblib
import pandas as pd
from datetime import datetime
import requests
from weather_api import get_forecast_weather
from crop_calendar import get_crop_calendar_rules
from ai_advisor import generate_ai_advice

app = FastAPI()

# load model
model = joblib.load("model/paddy_model.pkl")
features = joblib.load("model/features.pkl")

def get_location_info(district: str, city: str):
    locations = pd.read_csv("data/locations.csv")

    locations["district"] = locations["district"].astype(str).str.strip().str.lower()
    locations["city"] = locations["city"].astype(str).str.strip().str.lower()

    district_key = district.strip().lower()
    city_key = city.strip().lower()

    row = locations[
        (locations["district"] == district_key) &
        (locations["city"] == city_key)
    ]

    if row.empty:
        return None

    row = row.iloc[0]

    return {
        "district": row["district"].title(),
        "city": row["city"].title(),
        "lat": float(row["lat"]),
        "lon": float(row["lon"])
    }

# -------- INPUT SCHEMA --------
class FarmerInput(BaseModel):
    district: str
    city: str
    season: str
    farm_size_hectare: float
    crop_week: int


# -------- LOCATION MAP --------
LOCATIONS = {
    "kesbewa": {"district": "Colombo", "lat": 6.7951, "lon": 79.9386},
    "colombo": {"district": "Colombo", "lat": 6.9271, "lon": 79.8612},
    "gampaha": {"district": "Gampaha", "lat": 7.0873, "lon": 80.0144},
    "kalutara": {"district": "Kalutara", "lat": 6.5854, "lon": 79.9607},
    "galle": {"district": "Galle", "lat": 6.0535, "lon": 80.2210},
    "matara": {"district": "Matara", "lat": 5.9485, "lon": 80.5353},
    "hambantota": {"district": "Hambantota", "lat": 6.1241, "lon": 81.1185},
}


# -------- WEATHER API --------
def get_weather(lat, lon):
    url = "https://api.open-meteo.com/v1/forecast"

    params = {
        "latitude": lat,
        "longitude": lon,
        "daily": "temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,rain_sum,wind_speed_10m_max,et0_fao_evapotranspiration",
        "timezone": "Asia/Colombo",
        "forecast_days": 7
    }

    res = requests.get(url, params=params)
    data = res.json()["daily"]

    df = pd.DataFrame(data)

    return {
        "avg_temp": df["temperature_2m_mean"].mean(),
        "max_temp": df["temperature_2m_max"].mean(),
        "min_temp": df["temperature_2m_min"].mean(),
        "total_rainfall": df["precipitation_sum"].sum(),
        "total_rain": df["rain_sum"].sum(),
        "rainy_days": (df["precipitation_sum"] > 0).sum(),
        "wind_speed": df["wind_speed_10m_max"].mean(),
        "evapotranspiration": df["et0_fao_evapotranspiration"].sum()
    }

@app.get("/districts")
def get_districts():
    locations = pd.read_csv("data/locations.csv")
    districts = sorted(locations["district"].dropna().unique().tolist())
    return {"districts": districts}


@app.get("/cities/{district}")
def get_cities(district: str):
    locations = pd.read_csv("data/locations.csv")

    subset = locations[
        locations["district"].str.lower() == district.lower()
    ]

    if subset.empty:
        return {"cities": []}

    cities = sorted(subset["city"].dropna().unique().tolist())
    return {"cities": cities}


# -------- SOIL DATA --------
def get_soil(district):
    soil = pd.read_csv("data/soil_clean.csv")
    row = soil[soil["District"].str.lower() == district.lower()].iloc[0]

    return {
        "pH": float(row["pH"]),
        "soil_type": row["soil_type"],
        "zone": row["zone"]
    }


def get_cultivation(district, season):
    df = pd.read_csv("data/final_dataset.csv")

    df["District"] = df["District"].astype(str).str.strip().str.title()
    df["Season"] = df["Season"].astype(str).str.strip().str.title()

    district = district.strip().title()
    season = season.strip().title()

    subset = df[(df["District"] == district) & (df["Season"] == season)]

    if subset.empty:
        subset = df[df["District"] == district]

    if subset.empty:
        return {
            "Major_Schemes_Sown": 1000,
            "Minor_Schemes_Sown": 1000,
            "Rainfed_Sown": 3000,
            "All_Schemes_Sown": 5000,
            "All_Schemes_Harvested": 4800
        }

    return {
        "Major_Schemes_Sown": float(subset["Major_Schemes_Sown"].mean()),
        "Minor_Schemes_Sown": float(subset["Minor_Schemes_Sown"].mean()),
        "Rainfed_Sown": float(subset["Rainfed_Sown"].mean()),
        "All_Schemes_Sown": float(subset["All_Schemes_Sown"].mean()),
        "All_Schemes_Harvested": float(subset["All_Schemes_Harvested"].mean())
    }


# -------- ENCODING --------
def encode(df):
    season_map = {"Maha": 0, "Yala": 1}
    soil_map = {"Red Yellow Podzolic": 0, "Reddish Brown Earth": 1}
    zone_map = {"Wet": 0, "Intermediate": 1, "Dry": 2}

    df["Season"] = df["Season"].map(season_map).fillna(1)
    df["soil_type"] = df["soil_type"].map(soil_map).fillna(0)
    df["zone"] = df["zone"].map(zone_map).fillna(0)

    return df


# -------- RISK --------
def calculate_risk(rain, temp):
    if rain < 20:
        return "High Drought Risk"
    elif rain > 120:
        return "Flood Risk"
    elif temp > 32:
        return "Heat Stress"
    return "Low Risk"


# -------- ADVICE --------
def generate_advice(risk, pH, season):
    advice = []

    if "Drought" in risk:
        advice.append("Irrigate regularly")
    elif "Flood" in risk:
        advice.append("Improve drainage")
    else:
        advice.append("Conditions normal")

    if pH < 5.5:
        advice.append("Apply lime")

    if season == "Yala":
        advice.append("Plan irrigation carefully")

    return " | ".join(advice)


# -------- API --------
@app.post("/predict")
def predict(data: FarmerInput):

    season = data.season.strip().title()

    if season not in ["Yala", "Maha"]:
        return {
            "status": "failed",
            "message": "Season is required. Please select either Yala or Maha."
        }

    loc_info = get_location_info(data.district, data.city)

    if loc_info is None:
        return {
            "status": "failed",
            "message": f"{data.city} is not available under {data.district}. Please select a valid city."
        }

    district = loc_info["district"]
    city = loc_info["city"]

    weather = get_forecast_weather(loc_info["lat"], loc_info["lon"])
    daily_forecast = weather.pop("daily_forecast")

    soil = get_soil(district)
    cultivation = get_cultivation(district, season)

    input_data = {
        "Year": datetime.now().year,
        "Season": season,
        **weather,
        **soil,
        **cultivation
    }

    df = pd.DataFrame([input_data])

    # feature engineering
    df["temp_range"] = df["max_temp"] - df["min_temp"]
    df["rain_per_day"] = df["total_rainfall"] / (df["rainy_days"] + 1)
    df["rainfed_ratio"] = df["Rainfed_Sown"] / (df["All_Schemes_Sown"] + 1)
    df["harvest_ratio"] = df["All_Schemes_Harvested"] / (df["All_Schemes_Sown"] + 1)

    df["irrigated_sown"] = df["Major_Schemes_Sown"] + df["Minor_Schemes_Sown"]
    df["irrigation_ratio"] = df["irrigated_sown"] / (df["All_Schemes_Sown"] + 1)

    df = encode(df)
    df = df[features]

    predicted = model.predict(df)[0]

    production = (predicted * data.farm_size_hectare) / 1000

    risk = calculate_risk(weather["total_rainfall"], weather["avg_temp"])

    crop_stage, rules = get_crop_calendar_rules(
    crop_week=data.crop_week,
    season=season,
    pH=soil["pH"],
    total_rainfall=weather["total_rainfall"]
)
    
    ai_context = {
    "district": district,
    "location": city,
    "season": season,
    "crop_week": data.crop_week,
    "crop_stage": crop_stage,
    "predicted_yield": round(predicted, 2),
    "expected_production": round(production, 2),
    "risk_level": risk,
    "soil_pH": soil["pH"],
    "soil_type": soil["soil_type"],
    "total_rainfall": weather["total_rainfall"],
    "avg_temp": weather["avg_temp"],
    "rules": rules
}
    
    advice = generate_ai_advice(ai_context)

    return {
        "District": district,
        "City": city,
        "Predicted_Yield": round(predicted, 2),
        "Expected_Production_tons": round(production, 2),
        "Risk_Level": risk,
        "Crop_Stage": crop_stage,
        "Advisory_English": advice["english"],
        "Advisory_Sinhala": advice["sinhala"],
        "Seven_Day_Rain_Forecast": daily_forecast
    }