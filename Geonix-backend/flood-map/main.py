from fastapi import FastAPI
import geopandas as gpd
import pandas as pd
import numpy as np
import joblib
from shapely.ops import unary_union

app = FastAPI()

model = joblib.load("model/flood_model2.pkl")
grid = gpd.read_file("model/grid.geojson")
grid = grid.to_crs(epsg=4326)

@app.get("/")
def home():
    return {"message": "Flood Prediction API Running"}

@app.get("/predict")
def predict_flood(rainfall: float = 80, threshold: float = 0.4):
    data = grid.copy()
    data["rainfall"] = rainfall

    # Drop rows with missing features
    feature_cols = ["elevation", "dist_river", "rainfall"]
    data = data.dropna(subset=feature_cols)

    X = data[feature_cols]
    data["flood_prob"] = model.predict_proba(X)[:, 1]

    # Use a lower threshold since model is imbalanced
    flood_data = data[data["flood_prob"] > threshold].copy()

    if flood_data.empty:
        return {"type": "FeatureCollection", "features": []}

    # --- KEY FIX: Dissolve adjacent cells into contiguous zones ---
    # Buffer slightly to merge touching cells, then dissolve
    flood_proj = flood_data.to_crs(epsg=5235)
    flood_proj["geometry"] = flood_proj.geometry.buffer(10)  # 10m buffer to connect touching cells
    
    # Dissolve into contiguous flood zones
    dissolved = flood_proj.dissolve().explode(index_parts=False).reset_index(drop=True)
    
    # Remove tiny isolated patches (less than 2 grid cells = 80,000 m²)
    dissolved = dissolved[dissolved.geometry.area > 80_000]
    
    # Shrink back
    dissolved["geometry"] = dissolved.geometry.buffer(-10)
    dissolved = dissolved.to_crs(epsg=4326)

    # Build GeoJSON
    geojson = {"type": "FeatureCollection", "features": []}

    for _, row in dissolved.iterrows():
        geom = row.geometry
        if geom is None or geom.is_empty:
            continue
        
        # Handle both Polygon and MultiPolygon
        if geom.geom_type == "Polygon":
            polys = [geom]
        elif geom.geom_type == "MultiPolygon":
            polys = list(geom.geoms)
        else:
            continue

        for poly in polys:
            coords = [[x, y] for x, y in poly.exterior.coords]
            # Include interior rings (holes)
            rings = [coords] + [[[x, y] for x, y in interior.coords] 
                                 for interior in poly.interiors]
            geojson["features"].append({
                "type": "Feature",
                "properties": {
                    # avg flood_prob not meaningful after dissolve; omit or set to null
                    "flood_risk": "high"
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": rings
                }
            })

    return geojson