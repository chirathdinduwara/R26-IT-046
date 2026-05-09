#Updates
# main.py
from fastapi import FastAPI
import geopandas as gpd
import pandas as pd
import numpy as np
import joblib
import json
import requests
from datetime import datetime, timedelta

app = FastAPI()
model = joblib.load("model/flood_model2.pkl")
grid  = gpd.read_file("model/grid.geojson").to_crs(epsg=4326)

with open("model/feature_cols.json") as f:
    FEATURE_COLS = json.load(f)

LAT, LON = 7.0, 79.97
UPSTREAM_LAT, UPSTREAM_LON = 7.50, 80.35

def get_recent_rainfall(lat, lon, days=7):
    today = datetime.utcnow()
    start = (today - timedelta(days=days)).strftime("%Y-%m-%d")
    end   = today.strftime("%Y-%m-%d")
    url   = "https://archive-api.open-meteo.com/v1/archive"
    r = requests.get(url, params={
        "latitude": lat, "longitude": lon,
        "start_date": start, "end_date": end,
        "daily": "precipitation_sum",
        "timezone": "Asia/Colombo",
    }, timeout=10)
    precip = r.json()["daily"]["precipitation_sum"]
    precip = [p or 0 for p in precip]
    return {
        "day":  precip[-1] if precip else 0,
        "3day": sum(precip[-3:]),
        "7day": sum(precip[-7:]),
    }

@app.get("/predict")
def predict_flood(
    rainfall_3day: float = None,   # override if provided; else fetched from API
    threshold: float = 0.45
):
    # Fetch live rainfall if not overridden
    local    = get_recent_rainfall(LAT, LON)
    upstream = get_recent_rainfall(UPSTREAM_LAT, UPSTREAM_LON, days=3)

    r3day = rainfall_3day if rainfall_3day is not None else local["3day"]

    data = grid.copy()
    data["rainfall_day"]            = local["day"]
    data["rainfall_3day"]           = r3day
    data["rainfall_7day"]           = local["7day"]
    data["upstream_rainfall_3day"]  = upstream["3day"]

    X = data[FEATURE_COLS].fillna(0)
    data["flood_prob"] = model.predict_proba(X)[:, 1]

    flood_data = data[data["flood_prob"] > threshold].copy()

    # Dissolve adjacent cells into contiguous zones
    flood_proj = flood_data.to_crs(epsg=5235)
    flood_proj["geometry"] = flood_proj.geometry.buffer(15)
    dissolved = flood_proj.dissolve().explode(index_parts=False).reset_index(drop=True)
    dissolved = dissolved[dissolved.geometry.area > 80_000]  # remove tiny patches
    dissolved["geometry"] = dissolved.geometry.buffer(-15)
    dissolved = dissolved.to_crs(epsg=4326)

    geojson = {"type": "FeatureCollection", "features": [],
               "metadata": {
                   "rainfall_day_mm": local["day"],
                   "rainfall_3day_mm": r3day,
                   "rainfall_7day_mm": local["7day"],
                   "upstream_3day_mm": upstream["3day"],
               }}

    for _, row in dissolved.iterrows():
        geom = row.geometry
        if geom is None or geom.is_empty:
            continue
        polys = [geom] if geom.geom_type == "Polygon" else list(geom.geoms)
        for poly in polys:
            rings = [[[x, y] for x, y in poly.exterior.coords]]
            rings += [[[x, y] for x, y in i.coords] for i in poly.interiors]
            geojson["features"].append({
                "type": "Feature",
                "properties": {"flood_risk": "high"},
                "geometry": {"type": "Polygon", "coordinates": rings}
            })

    return geojson