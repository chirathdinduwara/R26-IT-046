from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
from datetime import datetime
import pandas as pd
import joblib
import csv

from weather_api import (
    get_forecast_weather,
    get_recent_actual_weather,
)

from crop_calendar import (
    get_crop_calendar_rules,
)

from ai_advisor import (
    generate_ai_advice,
)

from climate_lookup import (
    get_seasonal_climate_estimate,
    get_rainfall_deviation,
)


# ============================================================
# FASTAPI APP
# ============================================================

app = FastAPI(
    title="Paddy Advisory API",
    description="Paddy cultivation advisory and yield prediction API",
    version="1.0.0",
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# BASE DIRECTORY
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

print("==============================================")
print("PADDY ADVISORY API")
print("BASE DIR:", BASE_DIR)
print("==============================================")


# ============================================================
# FILE PATHS
# ============================================================

LOCATION_CSV = BASE_DIR / "data" / "locations.csv"

SOIL_CSV = BASE_DIR / "data" / "soil_clean.csv"

FINAL_DATASET_CSV = BASE_DIR / "data" / "final_dataset.csv"

FERTILIZER_RULES_CSV = (
    BASE_DIR
    / "data"
    / "fertilizer"
    / "fertilizer_rules.csv"
)

MODEL_PATH = (
    BASE_DIR
    / "model"
    / "paddy_model_improved_6.pkl"
)


# ============================================================
# FILE CHECK
# ============================================================

print("Location CSV:", LOCATION_CSV)
print("Location CSV exists:", LOCATION_CSV.exists())

print("Soil CSV:", SOIL_CSV)
print("Soil CSV exists:", SOIL_CSV.exists())

print("Final dataset:", FINAL_DATASET_CSV)
print("Final dataset exists:", FINAL_DATASET_CSV.exists())

print("Fertilizer rules:", FERTILIZER_RULES_CSV)
print("Fertilizer rules exists:", FERTILIZER_RULES_CSV.exists())

print("Model:", MODEL_PATH)
print("Model exists:", MODEL_PATH.exists())

print("==============================================")


# ============================================================
# LOAD MODEL
# ============================================================

try:
    if MODEL_PATH.exists():
        model = joblib.load(MODEL_PATH)
        print("Paddy model loaded successfully.")
    else:
        model = None
        print("WARNING: Model file does not exist.")

except Exception as e:
    print("ERROR loading model:", e)
    model = None


# ============================================================
# LOCATION CSV
# ============================================================

def load_locations():

    if not LOCATION_CSV.exists():
        raise FileNotFoundError(
            f"Location CSV not found: {LOCATION_CSV}"
        )

    locations = []

    with open(
        LOCATION_CSV,
        "r",
        encoding="utf-8-sig",
        newline=""
    ) as file:

        reader = csv.DictReader(file)

        print("CSV columns:", reader.fieldnames)

        for row in reader:

            district = (
                row.get("district") or ""
            ).strip()

            city = (
                row.get("city") or ""
            ).strip()

            if not district or not city:
                continue

            try:

                lat = (
                    float(row["lat"])
                    if row.get("lat")
                    else None
                )

                lon = (
                    float(row["lon"])
                    if row.get("lon")
                    else None
                )

            except (ValueError, TypeError):

                continue

            locations.append(
                {
                    "district": district,
                    "city": city,
                    "lat": lat,
                    "lon": lon,
                }
            )

    print(
        f"Loaded {len(locations)} locations."
    )

    return locations


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():

    return {
        "message": "Paddy Advisory API is running",
        "status": "success",
        "version": "1.0.0",
        "endpoints": [
            "/",
            "/health",
            "/districts",
            "/cities/{district}",
            "/location/{district}/{city}",
            "/predict",
        ],
    }


# ============================================================
# HEALTH
# ============================================================

@app.get("/health")
def health():

    return {
        "status": "ok",
        "location_csv": str(LOCATION_CSV),
        "location_csv_exists": LOCATION_CSV.exists(),
        "soil_csv_exists": SOIL_CSV.exists(),
        "final_dataset_exists": FINAL_DATASET_CSV.exists(),
        "fertilizer_rules_exists": FERTILIZER_RULES_CSV.exists(),
        "model_exists": MODEL_PATH.exists(),
    }


# ============================================================
# DISTRICTS
# ============================================================

@app.get("/districts")
def get_districts():

    try:

        locations = load_locations()

        districts = sorted(
            {
                location["district"]
                for location in locations
                if location["district"]
            }
        )

        print(
            "Returning districts:",
            len(districts)
        )

        return {
            "status": "success",
            "districts": districts,
        }

    except FileNotFoundError as e:

        raise HTTPException(
            status_code=500,
            detail=str(e),
        )

    except Exception as e:

        print(
            "DISTRICT ERROR:",
            e
        )

        raise HTTPException(
            status_code=500,
            detail=f"Failed to load districts: {str(e)}",
        )


# ============================================================
# CITIES
# ============================================================

@app.get("/cities/{district}")
def get_cities(district: str):

    try:

        locations = load_locations()

        district_key = (
            district.strip().lower()
        )

        cities = sorted(
            {
                location["city"]
                for location in locations
                if location["district"]
                .strip()
                .lower()
                == district_key
            }
        )

        if not cities:

            raise HTTPException(
                status_code=404,
                detail=(
                    f"No cities found for district: "
                    f"{district}"
                ),
            )

        return {
            "status": "success",
            "district": district,
            "cities": cities,
        }

    except HTTPException:

        raise

    except FileNotFoundError as e:

        raise HTTPException(
            status_code=500,
            detail=str(e),
        )

    except Exception as e:

        print(
            "CITY ERROR:",
            e
        )

        raise HTTPException(
            status_code=500,
            detail=f"Failed to load cities: {str(e)}",
        )


# ============================================================
# LOCATION
# ============================================================

@app.get("/location/{district}/{city}")
def get_location(
    district: str,
    city: str,
):

    try:

        locations = load_locations()

        district_key = (
            district.strip().lower()
        )

        city_key = (
            city.strip().lower()
        )

        for location in locations:

            if (
                location["district"]
                .strip()
                .lower()
                == district_key
                and
                location["city"]
                .strip()
                .lower()
                == city_key
            ):

                return {
                    "status": "success",
                    **location,
                }

        raise HTTPException(
            status_code=404,
            detail=(
                f"Location not found: "
                f"{district}, {city}"
            ),
        )

    except HTTPException:

        raise

    except FileNotFoundError as e:

        raise HTTPException(
            status_code=500,
            detail=str(e),
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=f"Failed to load location: {str(e)}",
        )


# ============================================================
# LOCATION HELPER
# ============================================================

def get_location_info(
    district: str,
    city: str,
):

    locations = load_locations()

    district_key = (
        district.strip().lower()
    )

    city_key = (
        city.strip().lower()
    )

    for location in locations:

        if (
            location["district"]
            .strip()
            .lower()
            == district_key
            and
            location["city"]
            .strip()
            .lower()
            == city_key
        ):

            return location

    return None


# ============================================================
# FARMER INPUT
# ============================================================

class FarmerInput(BaseModel):

    district: str
    city: str
    season: str
    farm_size_hectare: float
    crop_week: int


# ============================================================
# SOIL
# ============================================================

def get_soil(district):

    if not SOIL_CSV.exists():

        raise FileNotFoundError(
            f"Soil CSV not found: {SOIL_CSV}"
        )

    soil = pd.read_csv(SOIL_CSV)

    if "District" not in soil.columns:

        raise ValueError(
            "soil_clean.csv must contain a District column."
        )

    soil["District"] = (
        soil["District"]
        .astype(str)
        .str.strip()
        .str.lower()
    )

    district_key = (
        district.strip().lower()
    )

    row = soil[
        soil["District"] == district_key
    ]

    if row.empty:

        raise ValueError(
            f"Soil data not found for {district}"
        )

    row = row.iloc[0]

    return {
        "pH": float(row["pH"]),
        "soil_type": str(
            row["soil_type"]
        ).strip(),
        "zone": str(
            row["zone"]
        ).strip(),
    }


# ============================================================
# CULTIVATION
# ============================================================

def get_cultivation(
    district,
    season,
):

    if not FINAL_DATASET_CSV.exists():

        raise FileNotFoundError(
            f"Final dataset not found: "
            f"{FINAL_DATASET_CSV}"
        )

    df = pd.read_csv(
        FINAL_DATASET_CSV
    )

    required = [
        "District",
        "Season",
        "Sown_Extent",
        "Harvested_Extent",
        "Production",
    ]

    for column in required:

        if column not in df.columns:

            raise ValueError(
                f"Missing column in final_dataset.csv: "
                f"{column}"
            )

    df["District"] = (
        df["District"]
        .astype(str)
        .str.strip()
        .str.title()
    )

    df["Season"] = (
        df["Season"]
        .astype(str)
        .str.strip()
        .str.title()
    )

    district = (
        district.strip().title()
    )

    season = (
        season.strip().title()
    )

    subset = df[
        (df["District"] == district)
        &
        (df["Season"] == season)
    ]

    if subset.empty:

        subset = df[
            df["District"] == district
        ]

    if subset.empty:

        return {
            "Sown_Extent": 5000,
            "Harvested_Extent": 4800,
            "Production": 15,
        }

    return {
        "Sown_Extent": float(
            subset["Sown_Extent"].mean()
        ),
        "Harvested_Extent": float(
            subset["Harvested_Extent"].mean()
        ),
        "Production": float(
            subset["Production"].mean()
        ),
    }


# ============================================================
# YIELD HISTORY
# ============================================================

def get_yield_history_features(
    district,
    season,
):

    if not FINAL_DATASET_CSV.exists():

        raise FileNotFoundError(
            f"Final dataset not found: "
            f"{FINAL_DATASET_CSV}"
        )

    history = pd.read_csv(
        FINAL_DATASET_CSV
    )

    history["District"] = (
        history["District"]
        .astype(str)
        .str.strip()
        .str.title()
    )

    history["Season"] = (
        history["Season"]
        .astype(str)
        .str.strip()
        .str.title()
    )

    district = (
        district.strip().title()
    )

    season = (
        season.strip().title()
    )

    subset = history[
        (history["District"] == district)
        &
        (history["Season"] == season)
    ].sort_values("Year")

    if len(subset) >= 3:

        yield_lag_1 = float(
            subset["Average_Yield"]
            .iloc[-1]
        )

        yield_rolling_3 = float(
            subset["Average_Yield"]
            .tail(3)
            .mean()
        )

    else:

        yield_lag_1 = 3000
        yield_rolling_3 = 3200

    return (
        yield_lag_1,
        yield_rolling_3,
    )


# ============================================================
# RISK
# ============================================================

def calculate_risk(
    rain,
    temp,
):

    if rain < 20:

        return "Drought Risk"

    if rain > 160:

        return "Flood Risk"

    if temp > 32:

        return "Heat Stress"

    return "Low Risk"


# ============================================================
# WATER
# ============================================================

def detect_water_condition(
    total_rainfall,
    zone,
):

    if total_rainfall >= 80:

        return "Rainfed"

    if zone.strip().title() == "Wet":

        return "Rainfed"

    return "Irrigated"


# ============================================================
# FERTILIZER
# ============================================================

def recommend_fertilizer(
    zone,
    water_condition,
    crop_duration,
    crop_week,
):

    if not FERTILIZER_RULES_CSV.exists():

        return {
            "Week": "",
            "message": "Fertilizer rules CSV not found.",
            "Urea_kg_ha": 0,
            "TSP_kg_ha": 0,
            "MOP_kg_ha": 0,
            "Zinc_kg_ha": 0,
        }

    rules = pd.read_csv(
        FERTILIZER_RULES_CSV
    )

    rules["Zone"] = (
        rules["Zone"]
        .astype(str)
        .str.strip()
        .str.title()
    )

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

    zone = (
        str(zone)
        .strip()
        .title()
    )

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
        (rules["Zone"] == zone)
        &
        (
            rules["Water_Condition"]
            == water_condition
        )
        &
        (
            rules["Crop_Duration"]
            == crop_duration
        )
        &
        (
            rules["Week"]
            == week_label
        )
    ]

    if result.empty:

        return {
            "Week": week_label,
            "message": "No fertilizer recommendation found.",
            "Urea_kg_ha": 0,
            "TSP_kg_ha": 0,
            "MOP_kg_ha": 0,
            "Zinc_kg_ha": 0,
        }

    row = result.iloc[0]

    return {
        "Week": week_label,
        "Urea_kg_ha": float(
            row["Urea_kg_ha"]
        ),
        "TSP_kg_ha": float(
            row["TSP_kg_ha"]
        ),
        "MOP_kg_ha": float(
            row["MOP_kg_ha"]
        ),
        "Zinc_kg_ha": float(
            row["Zinc_kg_ha"]
        ),
    }


# ============================================================
# PREDICTION
# ============================================================

@app.post("/predict")
def predict(data: FarmerInput):

    try:

        # ----------------------------------------------------
        # MODEL
        # ----------------------------------------------------

        if model is None:

            raise HTTPException(
                status_code=500,
                detail="Paddy prediction model is not loaded.",
            )

        # ----------------------------------------------------
        # INPUT VALIDATION
        # ----------------------------------------------------

        if data.farm_size_hectare <= 0:

            raise HTTPException(
                status_code=400,
                detail="Farm size must be greater than zero.",
            )

        if data.crop_week <= 0:

            raise HTTPException(
                status_code=400,
                detail="Crop week must be greater than zero.",
            )

        # ----------------------------------------------------
        # SEASON
        # ----------------------------------------------------

        season = (
            data.season
            .strip()
            .title()
        )

        if season not in ["Yala", "Maha"]:

            return {
                "status": "failed",
                "message": (
                    "Please select Yala or Maha."
                ),
            }

        # ----------------------------------------------------
        # LOCATION
        # ----------------------------------------------------

        loc_info = get_location_info(
            data.district,
            data.city,
        )

        if loc_info is None:

            return {
                "status": "failed",
                "message": (
                    f"{data.city} is not available "
                    f"under {data.district}."
                ),
            }

        district = loc_info["district"]
        city = loc_info["city"]

        # ----------------------------------------------------
        # WEATHER
        # ----------------------------------------------------

        weather_forecast = (
            get_forecast_weather(
                loc_info["lat"],
                loc_info["lon"],
            )
        )

        daily_forecast = (
            weather_forecast.get(
                "daily_forecast",
                [],
            )
        )

        # Keep the original dictionary intact
        weather_data = dict(
            weather_forecast
        )

        weather_data.pop(
            "daily_forecast",
            None,
        )

        # ----------------------------------------------------
        # RECENT WEATHER
        # ----------------------------------------------------

        recent_weather = (
            get_recent_actual_weather(
                loc_info["lat"],
                loc_info["lon"],
                days=30,
            )
        )

        # ----------------------------------------------------
        # SEASONAL CLIMATE
        # ----------------------------------------------------

        seasonal_climate = (
            get_seasonal_climate_estimate(
                district=district,
                season=season,
                recent_weather=recent_weather,
                forecast_weather=weather_data,
            )
        )

        # ----------------------------------------------------
        # SOIL
        # ----------------------------------------------------

        soil = get_soil(
            district
        )

        # ----------------------------------------------------
        # WATER
        # ----------------------------------------------------

        water_condition = (
            detect_water_condition(
                total_rainfall=weather_data[
                    "total_rainfall"
                ],
                zone=soil["zone"],
            )
        )

        # ----------------------------------------------------
        # FERTILIZER
        # ----------------------------------------------------

        crop_duration = "3 Month"

        fertilizer = (
            recommend_fertilizer(
                zone=soil["zone"],
                water_condition=water_condition,
                crop_duration=crop_duration,
                crop_week=data.crop_week,
            )
        )

        # ----------------------------------------------------
        # CULTIVATION
        # ----------------------------------------------------

        cultivation = (
            get_cultivation(
                district,
                season,
            )
        )

        # ----------------------------------------------------
        # HISTORY
        # ----------------------------------------------------

        (
            yield_lag_1,
            yield_rolling_3,
        ) = get_yield_history_features(
            district,
            season,
        )

        # ----------------------------------------------------
        # MODEL DATA
        # ----------------------------------------------------

        input_data = {
            "District": district,
            "Year": datetime.now().year,
            "Season": season,

            **seasonal_climate,
            **soil,
            **cultivation,

            "yield_lag_1":
                yield_lag_1,

            "yield_rolling_3":
                yield_rolling_3,
        }

        df = pd.DataFrame(
            [input_data]
        )

        # ----------------------------------------------------
        # FEATURE ENGINEERING
        # ----------------------------------------------------

        df["temp_range"] = (
            df["max_temp"]
            - df["min_temp"]
        )

        df["rain_per_day"] = (
            df["total_rainfall"]
            /
            (
                df["rainy_days"]
                + 1
            )
        )

        df["harvest_ratio"] = (
            df["Harvested_Extent"]
            /
            (
                df["Sown_Extent"]
                + 1
            )
        )

        df["water_stress"] = (
            df["evapotranspiration"]
            /
            (
                df["total_rainfall"]
                + 1
            )
        )

        df["rain_temp_interaction"] = (
            df["total_rainfall"]
            *
            df["avg_temp"]
        )

        df["humidity_effect"] = (
            df["rainy_days"]
            *
            df["avg_temp"]
        )

        df["rainfall_deviation"] = (
            get_rainfall_deviation(
                district,
                season,
                seasonal_climate[
                    "total_rainfall"
                ],
            )
        )

        # ----------------------------------------------------
        # PREDICTION
        # ----------------------------------------------------

        predicted = float(
            model.predict(df)[0]
        )

        # Avoid negative prediction
        predicted = max(
            0,
            predicted
        )

        # ----------------------------------------------------
        # PRODUCTION
        # ----------------------------------------------------

        production = (
            predicted
            *
            data.farm_size_hectare
        ) / 1000

        # ----------------------------------------------------
        # RISK
        # ----------------------------------------------------

        risk = calculate_risk(
            weather_data[
                "total_rainfall"
            ],
            weather_data[
                "avg_temp"
            ],
        )

        # ----------------------------------------------------
        # CROP STAGE
        # ----------------------------------------------------

        crop_stage, rules = (
            get_crop_calendar_rules(
                crop_week=data.crop_week,
                season=season,
                pH=soil["pH"],
                total_rainfall=weather_data[
                    "total_rainfall"
                ],
            )
        )

        # ----------------------------------------------------
        # AI CONTEXT
        # ----------------------------------------------------

        ai_context = {

            "district":
                district,

            "location":
                city,

            "season":
                season,

            "crop_week":
                data.crop_week,

            "crop_stage":
                crop_stage,

            "predicted_yield":
                round(predicted, 2),

            "expected_production":
                round(production, 2),

            "risk_level":
                risk,

            "soil_pH":
                soil["pH"],

            "soil_type":
                soil["soil_type"],

            "total_rainfall":
                weather_data[
                    "total_rainfall"
                ],

            "avg_temp":
                weather_data[
                    "avg_temp"
                ],

            "rules":
                rules,

            "fertilizer_week":
                fertilizer["Week"],

            "urea_kg_ha":
                fertilizer["Urea_kg_ha"],

            "tsp_kg_ha":
                fertilizer["TSP_kg_ha"],

            "mop_kg_ha":
                fertilizer["MOP_kg_ha"],

            "zinc_kg_ha":
                fertilizer["Zinc_kg_ha"],
        }

        # ----------------------------------------------------
        # AI ADVICE
        # ----------------------------------------------------

        advice = generate_ai_advice(
            ai_context
        )

        # ----------------------------------------------------
        # RESPONSE
        # ----------------------------------------------------

        return {

            "status":
                "success",

            "District":
                district,

            "City":
                city,

            "Predicted_Yield":
                round(predicted, 2),

            "Expected_Production_tons":
                round(production, 2),

            "Risk_Level":
                risk,

            "Crop_Stage":
                crop_stage,

            "Recommended_Fertilizer":
                fertilizer,

            "Water_Condition":
                water_condition,

            "Advisory_English":
                advice.get(
                    "english",
                    "",
                ),

            "Advisory_Sinhala":
                advice.get(
                    "sinhala",
                    "",
                ),

            "Seven_Day_Rain_Forecast":
                daily_forecast,

            "Model_Input_Seasonal_Rainfall_mm":
                round(
                    seasonal_climate[
                        "total_rainfall"
                    ],
                    1,
                ),
        }

    except HTTPException:

        raise

    except Exception as e:

        print(
            "================================"
        )

        print(
            "PREDICTION ERROR:",
            repr(e),
        )

        print(
            "================================"
        )

        raise HTTPException(
            status_code=500,
            detail=f"Prediction failed: {str(e)}",
        )