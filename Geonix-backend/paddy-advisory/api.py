from fastapi import FastAPI
from pydantic import BaseModel
import joblib
import pandas as pd
from datetime import datetime

from weather_api import get_forecast_weather
from crop_calendar import get_crop_calendar_rules
from ai_advisor import generate_ai_advice

app = FastAPI()

# -------- LOAD MODEL --------
pipeline = joblib.load("model/paddy_pipeline.pkl")


# -------- INPUT SCHEMA --------
class FarmerInput(BaseModel):
    district: str
    city: str
    season: str
    farm_size_hectare: float
    crop_week: int


# -------- LOCATION INFO --------
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

    soil["District"] = soil["District"].astype(str).str.strip().str.lower()

    row = soil[soil["District"] == district.lower()]

    if row.empty:
        raise ValueError(f"Soil data not found for {district}")

    row = row.iloc[0]

    return {
        "pH": float(row["pH"]),
        "soil_type": str(row["soil_type"]).strip(),
        "zone": str(row["zone"]).strip()
    }


# -------- CULTIVATION HISTORY --------
def get_cultivation(district, season):
    df = pd.read_csv("data/final_dataset.csv")

    df["District"] = df["District"].astype(str).str.strip().str.title()
    df["Season"] = df["Season"].astype(str).str.strip().str.title()

    district = district.strip().title()
    season = season.strip().title()

    subset = df[
        (df["District"] == district) &
        (df["Season"] == season)
    ]

    if subset.empty:
        subset = df[df["District"] == district]

    if subset.empty:
        return {
            "Sown_Extent": 5000,
            "Harvested_Extent": 4800,
            "Production": 15
        }

    return {
        "Sown_Extent": float(subset["Sown_Extent"].mean()),
        "Harvested_Extent": float(subset["Harvested_Extent"].mean()),
        "Production": float(subset["Production"].mean())
    }


# -------- HISTORICAL YIELD FEATURES --------
def get_yield_history_features(district, season):
    history = pd.read_csv("data/final_dataset.csv")

    history["District"] = history["District"].astype(str).str.strip().str.title()
    history["Season"] = history["Season"].astype(str).str.strip().str.title()

    district = district.strip().title()
    season = season.strip().title()

    subset = history[
        (history["District"] == district) &
        (history["Season"] == season)
    ].sort_values("Year")

    if len(subset) >= 3:
        yield_lag_1 = float(subset["Average_Yield"].iloc[-1])
        yield_rolling_3 = float(subset["Average_Yield"].tail(3).mean())
    else:
        yield_lag_1 = 3000
        yield_rolling_3 = 3200

    return yield_lag_1, yield_rolling_3





# -------- RISK --------
def calculate_risk(rain, temp):
    if rain < 20:
        return "High Drought Risk"
    elif rain > 120:
        return "Flood Risk"
    elif temp > 32:
        return "Heat Stress"
    return "Low Risk"

# -------- AUTO WATER CONDITION --------
def detect_water_condition(total_rainfall, zone):

    if total_rainfall >= 80:
        return "Rainfed"

    if zone.strip().title() == "Wet":
        return "Rainfed"

    return "Irrigated"
# -------- FERTILIZER RECOMMENDATION --------
def recommend_fertilizer(zone, water_condition, crop_duration, crop_week):

    rules = pd.read_csv("data/fertilizer/fertilizer_rules.csv")

    rules["Zone"] = rules["Zone"].astype(str).str.strip().str.title()

    rules["Water_Condition"] = (
        rules["Water_Condition"]
        .astype(str)
        .str.strip()
        .str.title()
    )

    rules["Crop_Duration"] = (
        rules["Crop_Duration"]
        .astype(str)
        .str.strip()
    )

    rules["Week"] = (
        rules["Week"]
        .astype(str)
        .str.strip()
    )

    zone = str(zone).strip().title()

    water_condition = (
        str(water_condition)
        .strip()
        .title()
    )

    crop_duration = (
        str(crop_duration)
        .strip()
    )

    if crop_week <= 1:
        week_label = "Basic"

    elif crop_week <= 2:
        week_label = "2 Weeks"

    elif crop_week <= 4:
        week_label = "4 Weeks"

    elif crop_week <= 6:
        week_label = "6 Weeks"

    else:
        week_label = "7 Weeks"

    result = rules[
        (rules["Zone"] == zone) &
        (rules["Water_Condition"] == water_condition) &
        (rules["Crop_Duration"] == crop_duration) &
        (rules["Week"] == week_label)
    ]

    if result.empty:
        return {
            "Week": week_label,
            "message": "No fertilizer recommendation found.",
            "Urea_kg_ha": 0,
            "TSP_kg_ha": 0,
            "MOP_kg_ha": 0,
            "Zinc_kg_ha": 0
        }

    row = result.iloc[0]

    return {
        "Week": week_label,
        "Urea_kg_ha": float(row["Urea_kg_ha"]),
        "TSP_kg_ha": float(row["TSP_kg_ha"]),
        "MOP_kg_ha": float(row["MOP_kg_ha"]),
        "Zinc_kg_ha": float(row["Zinc_kg_ha"])
    }

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

    water_condition = detect_water_condition(
    total_rainfall=weather["total_rainfall"],
    zone=soil["zone"]
    )   

    crop_duration = "3 Month"

    fertilizer = recommend_fertilizer(
    zone=soil["zone"],
    water_condition=water_condition,
    crop_duration=crop_duration,
    crop_week=data.crop_week
    )
    cultivation = get_cultivation(district, season)

    yield_lag_1, yield_rolling_3 = get_yield_history_features(district, season)

    input_data = {
        "District": district,
        "Year": datetime.now().year,
        "Season": season,

        **weather,
        **soil,
        **cultivation,

        "yield_lag_1": yield_lag_1,
        "yield_rolling_3": yield_rolling_3
    }

    df = pd.DataFrame([input_data])

    # feature engineering
    df["temp_range"] = df["max_temp"] - df["min_temp"]

    df["rain_per_day"] = (
        df["total_rainfall"] /
        (df["rainy_days"] + 1)
    )

    df["harvest_ratio"] = (
        df["Harvested_Extent"] /
        (df["Sown_Extent"] + 1)
    )

    df["water_stress"] = (
        df["evapotranspiration"] /
        (df["total_rainfall"] + 1)
    )

   

    

    predicted = float(pipeline.predict(df)[0])

    production = float((predicted * data.farm_size_hectare) / 1000)
    

    risk = calculate_risk(
        weather["total_rainfall"],
        weather["avg_temp"]
    )

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
        "rules": rules,
        "fertilizer_week": fertilizer["Week"],
        "urea_kg_ha": fertilizer["Urea_kg_ha"],
        "tsp_kg_ha": fertilizer["TSP_kg_ha"],
        "mop_kg_ha": fertilizer["MOP_kg_ha"],
        "zinc_kg_ha": fertilizer["Zinc_kg_ha"],
    }

    advice = generate_ai_advice(ai_context)

    return {
    "District": district,
    "City": city,
    "Predicted_Yield": round(predicted, 2),
    "Expected_Production_tons": round(production, 2),
    "Risk_Level": risk,
    "Crop_Stage": crop_stage,
    "Recommended_Fertilizer": fertilizer,
    "Water_Condition": water_condition,
    "Advisory_English": advice["english"],
    "Advisory_Sinhala": advice["sinhala"],
    "Seven_Day_Rain_Forecast": daily_forecast
    
    }