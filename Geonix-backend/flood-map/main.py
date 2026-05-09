# # from fastapi import FastAPI
# # from fastapi.middleware.cors import CORSMiddleware
# # import geopandas as gpd
# # import pandas as pd
# # import numpy as np
# # import joblib
# # import json

# # app = FastAPI()

# # app.add_middleware(
# #     CORSMiddleware,
# #     allow_origins=["*"],
# #     allow_methods=["*"],
# #     allow_headers=["*"],
# # )

# # # -----------------------------
# # # LOAD MODEL + GRID
# # # -----------------------------
# # model = joblib.load("model/flood_model3.pkl")
# # grid = gpd.read_file("model/grid.geojson").to_crs(epsg=4326)

# # with open("model/feature_cols.json") as f:
# #     FEATURE_COLS = json.load(f)

# # print("Model loaded. Features:", FEATURE_COLS)
# # print(f"Grid: {len(grid):,} cells")


# # # -----------------------------
# # # HOME
# # # -----------------------------
# # @app.get("/")
# # def home():
# #     return {
# #         "message": "Flood Prediction API — Colombo District",
# #         "features": FEATURE_COLS,
# #         "grid_cells": len(grid),
# #     }


# # # -----------------------------
# # # PREDICT ENDPOINT
# # # -----------------------------
# # @app.get("/predict")
# # def predict(
# #     rainfall_7day: float = 90.0,
# #     rainfall_14day: float = None,
# #     threshold: float = 0.45,
# # ):

# #     # -----------------------------
# #     # 🌧️ PHYSICAL SAFETY GATE
# #     # -----------------------------
# #     if rainfall_7day < 5:
# #         return {
# #             "type": "FeatureCollection",
# #             "features": [],
# #             "debug": {
# #                 "message": "No flood expected at very low rainfall",
# #                 "rainfall_7day_mm": rainfall_7day,
# #                 "rainfall_14day_mm": 0,
# #                 "threshold": threshold,
# #                 "total_cells": len(grid),
# #                 "flooded_cells": 0,
# #                 "flooded_pct": 0.0,
# #             },
# #         }

# #     # -----------------------------
# #     # ESTIMATE 14 DAY RAINFALL
# #     # -----------------------------
# #     r14 = rainfall_14day if rainfall_14day is not None else rainfall_7day * 1.8

# #     # -----------------------------
# #     # BUILD FEATURE MATRIX
# #     # -----------------------------
# #     X = pd.DataFrame({
# #         "elevation": grid["elevation"].values,
# #         "dist_river": grid["dist_river"].values,
# #         "rainfall_7day": rainfall_7day,
# #         "rainfall_14day": r14,
# #     })

# #     # -----------------------------
# #     # MODEL PREDICTION
# #     # -----------------------------
# #     probs = model.predict_proba(X[FEATURE_COLS])[:, 1]

# #     # -----------------------------
# #     # 🌧️ RAINFALL PHYSICS SCALING
# #     # -----------------------------
# #     rainfall_factor = min(rainfall_7day / 100.0, 1.0)
# #     probs = probs * rainfall_factor

# #     flood_mask = probs > threshold

# #     # -----------------------------
# #     # DEBUG INFO
# #     # -----------------------------
# #     debug = {
# #         "rainfall_7day_mm": rainfall_7day,
# #         "rainfall_14day_mm": round(r14, 1),
# #         "threshold": threshold,
# #         "total_cells": len(grid),
# #         "flooded_cells": int(flood_mask.sum()),
# #         "flooded_pct": round(float(flood_mask.mean() * 100), 2),
# #         "prob_min": float(probs.min()),
# #         "prob_max": float(probs.max()),
# #         "prob_mean": float(probs.mean()),
# #     }

# #     # -----------------------------
# #     # NO FLOOD CASE
# #     # -----------------------------
# #     if not flood_mask.any():
# #         return {
# #             "type": "FeatureCollection",
# #             "features": [],
# #             "debug": debug,
# #         }

# #     # -----------------------------
# #     # FLOOD CELLS
# #     # -----------------------------
# #     flood_cells = grid[flood_mask].copy()

# #     # dissolve + smooth
# #     fp = flood_cells.to_crs(epsg=5235)
# #     fp["geometry"] = fp.geometry.buffer(15)

# #     dissolved = (
# #         fp.dissolve()
# #         .explode(index_parts=False)
# #         .reset_index(drop=True)
# #     )

# #     dissolved = dissolved[dissolved.geometry.area > 80_000]
# #     dissolved["geometry"] = dissolved.geometry.buffer(-15)
# #     dissolved = dissolved.to_crs(epsg=4326)

# #     # -----------------------------
# #     # GEOJSON OUTPUT
# #     # -----------------------------
# #     features = []

# #     for _, row in dissolved.iterrows():
# #         geom = row.geometry

# #         if geom is None or geom.is_empty:
# #             continue

# #         polys = [geom] if geom.geom_type == "Polygon" else list(geom.geoms)

# #         for poly in polys:
# #             rings = [[[x, y] for x, y in poly.exterior.coords]]
# #             rings += [[[x, y] for x, y in i.coords] for i in poly.interiors]

# #             features.append({
# #                 "type": "Feature",
# #                 "properties": {"flood_risk": "high"},
# #                 "geometry": {
# #                     "type": "Polygon",
# #                     "coordinates": rings,
# #                 },
# #             })

# #     return {
# #         "type": "FeatureCollection",
# #         "features": features,
# #         "debug": debug,
# #     }


# # # -----------------------------
# # # VERIFY MODEL BEHAVIOR
# # # -----------------------------
# # @app.get("/verify")
# # def verify():

# #     results = []

# #     for r7 in [20, 49, 90, 110, 148, 200]:

# #         X = pd.DataFrame({
# #             "elevation": grid["elevation"].values,
# #             "dist_river": grid["dist_river"].values,
# #             "rainfall_7day": r7,
# #             "rainfall_14day": r7 * 1.8,
# #         })

# #         probs = model.predict_proba(X[FEATURE_COLS])[:, 1]

# #         rainfall_factor = min(r7 / 100.0, 1.0)
# #         probs = probs * rainfall_factor

# #         results.append({
# #             "rainfall_7day_mm": r7,
# #             "rainfall_14day_mm": round(r7 * 1.8, 0),
# #             "flooded_pct": round(float((probs > 0.45).mean() * 100), 2),
# #             "avg_prob": round(float(probs.mean()), 4),
# #         })

# #     all_same = len(set(r["flooded_pct"] for r in results)) == 1

# #     return {
# #         "model_working": not all_same,
# #         "status": "BROKEN — retrain" if all_same else "OK",
# #         "results": results,
# #     }


# from fastapi import FastAPI
# from fastapi.middleware.cors import CORSMiddleware
# from pydantic import BaseModel
# import geopandas as gpd, pandas as pd, numpy as np
# import joblib, json
# from sklearn.preprocessing import LabelEncoder
# from xgboost import XGBClassifier

# # ── Load artifacts ────────────────────────────────────────────────────────────
# model  = joblib.load("model/flood_modelupdated.pkl")
# le     = joblib.load("model/division_encoder.pkl")
# grid   = gpd.read_file("model/grid.geojson").to_crs(4326)
# config = json.load(open("model/configupdated.json"))
# FEATS  = config["feature_cols"]
# THRESH = config["threshold"]
# DIVS   = config["divisions"]

# def cells_to_polygons(flood_cells, min_area_m2=40_000):
#     if flood_cells.empty: return {"type":"FeatureCollection","features":[]}
#     fp = flood_cells.to_crs(5235).copy()
#     fp["geometry"] = fp.geometry.buffer(12)
#     diss = fp.dissolve().explode(index_parts=False).reset_index(drop=True)
#     diss = diss[diss.geometry.area > min_area_m2]
#     diss["geometry"] = diss.geometry.buffer(-12)
#     diss = diss.to_crs(4326)
#     features=[]
#     for _, row in diss.iterrows():
#         geom=row.geometry
#         if not geom or geom.is_empty: continue
#         polys=[geom] if geom.geom_type=="Polygon" else list(geom.geoms)
#         mp=float(row.get("flood_prob",0.8))
#         sev="high" if mp>0.70 else "medium" if mp>0.50 else "low"
#         for poly in polys:
#             rings=[list(map(list,poly.exterior.coords))]
#             rings+=[list(map(list,i.coords)) for i in poly.interiors]
#             features.append({"type":"Feature",
#                 "geometry":{"type":"Polygon","coordinates":rings},
#                 "properties":{"severity":sev,"mean_prob":round(mp,3),
#                     "area_km2":round(poly.area*(111.32**2)*
#                         np.cos(np.radians(poly.centroid.y)),3)}})
#     return {"type":"FeatureCollection","features":features}

# # ── App ───────────────────────────────────────────────────────────────────────
# app = FastAPI(title="Colombo Flood Predictor v3")
# app.add_middleware(CORSMiddleware, allow_origins=["*"],
#                    allow_methods=["*"], allow_headers=["*"])

# class SubdistInput(BaseModel):
#     division:          str
#     rainfall_7day:     float
#     rainfall_14day:    float
#     upstream_rain_7d:  float
#     upstream_rain_14d: float
#     river_water_level: float
#     threshold:         float | None = None

# class DivisionWeather(BaseModel):
#     rainfall_7day:     float
#     rainfall_14day:    float
#     upstream_rain_7d:  float
#     upstream_rain_14d: float
#     river_water_level: float

# class FullMapInput(BaseModel):
#     divisions: dict[str, DivisionWeather]   # {division_name: weather}
#     threshold: float | None = None
# # @app.post("/predict/subdist")
# # async def predict_subdist(req: SubdistInput):

# #     # 1. Validate division
# #     if req.division not in DIVS:
# #         return {"error": "Invalid division", "valid": DIVS}

# #     thresh = req.threshold or THRESH

# #     # 2. STRICT DIVISION FILTER
# #     g_sub = grid[grid["division"] == req.division].copy()

# #     if g_sub.empty:
# #         return {"error": "No grid found for division"}

# #     div_enc = le.transform([req.division])[0]

# #     # 3. FEATURE MATRIX
# #     X = pd.DataFrame({
# #         "elevation": g_sub["elevation"].values,
# #         "dist_river": g_sub["dist_river"].values,
# #         "rainfall_7day": req.rainfall_7day,
# #         "rainfall_14day": req.rainfall_14day,
# #         "upstream_rain_7d": req.upstream_rain_7d,
# #         "upstream_rain_14d": req.upstream_rain_14d,
# #         "river_water_level": req.river_water_level,
# #         "division_enc": div_enc
# #     })

# #     # 4. PREDICT
# #     probs = model.predict_proba(X[FEATS])[:, 1]

# #     # 🔥 CRITICAL FIX: clamp + smooth
# #     probs = np.clip(probs, 0, 1)

# #     # Optional smoothing (VERY IMPORTANT for maps)
# #     probs = pd.Series(probs).rolling(3, min_periods=1).mean().values

# #     g_sub["flood_prob"] = probs

# #     # 5. STRICT THRESHOLD FILTER
# #     flooded = g_sub[g_sub["flood_prob"] >= thresh].copy()

# #     # 6. SAFETY: avoid "everything flooded"
# #     flood_ratio = len(flooded) / len(g_sub)

# #     if flood_ratio > 0.85:
# #         # too aggressive → reduce sensitivity
# #         thresh = np.percentile(probs, 90)
# #         flooded = g_sub[g_sub["flood_prob"] >= thresh]

# #     # 7. BUILD GEOJSON
# #     geojson = cells_to_polygons(flooded)

# #     # 8. DEBUG METRICS
# #     debug = {
# #         "division": req.division,
# #         "threshold": float(thresh),
# #         "mean_prob": float(np.mean(probs)),
# #         "max_prob": float(np.max(probs)),
# #         "min_prob": float(np.min(probs)),
# #         "flooded_cells": int(len(flooded)),
# #         "total_cells": int(len(g_sub)),
# #         "flood_ratio": float(flood_ratio),
# #     }

# #     return {
# #         "geojson": geojson,
# #         "division": req.division,
# #         "flooded_pct": round(float((probs >= thresh).mean() * 100), 2),
# #         "zones": len(geojson["features"]),
# #         "debug": debug
# #     }
# @app.post("/predict/subdist")
# async def predict_subdist(req: SubdistInput):
#     thresh = req.threshold or THRESH
#     mask   = grid["division"] == req.division
#     g_sub  = grid[mask].reset_index(drop=True)
#     if g_sub.empty:
#         return {"error": f"Unknown division: {req.division}", "valid": DIVS}
#     div_enc = le.transform([req.division])[0] if req.division in le.classes_ else 0
#     X = pd.DataFrame({"elevation":g_sub["elevation"].values,
#         "dist_river":g_sub["dist_river"].values,
#         "rainfall_7day":req.rainfall_7day, "rainfall_14day":req.rainfall_14day,
#         "upstream_rain_7d":req.upstream_rain_7d,
#         "upstream_rain_14d":req.upstream_rain_14d,
#         "river_water_level":req.river_water_level, "division_enc":div_enc})
#     probs = model.predict_proba(X[FEATS])[:,1]
#     g_sub = g_sub.copy(); g_sub["flood_prob"] = probs
#     geojson = cells_to_polygons(g_sub[probs>=thresh])
#     return {"geojson":geojson,"division":req.division,
#             "flooded_pct":round(float((probs>=thresh).mean()*100),2),
#             "zones":len(geojson["features"])}

# @app.post("/predict/full")
# async def predict_full(req: FullMapInput):
#     thresh = req.threshold or THRESH
#     supplied = [v.model_dump() for v in req.divisions.values()]
#     fallback = {k: np.mean([s[k] for s in supplied]) for k in supplied[0]}
#     n=len(grid)
#     r7=np.zeros(n);r14=np.zeros(n);up7=np.zeros(n)
#     up14=np.zeros(n);rl=np.zeros(n);enc=np.zeros(n,dtype=int)
#     for i,div in enumerate(grid["division"].values):
#         wx=req.divisions.get(div)
#         w=wx.model_dump() if wx else fallback
#         r7[i]=w["rainfall_7day"]; r14[i]=w["rainfall_14day"]
#         up7[i]=w["upstream_rain_7d"]; up14[i]=w["upstream_rain_14d"]
#         rl[i]=w["river_water_level"]
#         enc[i]=le.transform([div])[0] if div in le.classes_ else 0
#     X=pd.DataFrame({"elevation":grid["elevation"].values,
#         "dist_river":grid["dist_river"].values,
#         "rainfall_7day":r7,"rainfall_14day":r14,
#         "upstream_rain_7d":up7,"upstream_rain_14d":up14,
#         "river_water_level":rl,"division_enc":enc})
#     probs=model.predict_proba(X[FEATS])[:,1]
#     gw=grid.copy(); gw["flood_prob"]=probs
#     geojson=cells_to_polygons(gw[probs>=thresh])
#     return {"geojson":geojson,
#             "flooded_pct":round(float((probs>=thresh).mean()*100),2),
#             "zones":len(geojson["features"])}

# @app.get("/divisions")
# async def list_divisions(): return {"divisions": DIVS}

# @app.get("/health")
# async def health(): return {"status":"ok","grid_cells":len(grid)}


from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import geopandas as gpd, pandas as pd, numpy as np
import joblib, json
from sklearn.preprocessing import LabelEncoder
from xgboost import XGBClassifier

# ── Load artifacts ────────────────────────────────────────────────────────────
model  = joblib.load("model/flood_model.pkl")
le     = joblib.load("model/division_encoder.pkl")
grid   = gpd.read_file("model/grid.geojson").to_crs(4326)
config = json.load(open("model/config.json"))
FEATS  = config["feature_cols"]
THRESH = config["threshold"]
DIVS   = config["divisions"]

def cells_to_polygons(flood_cells, min_area_m2=40_000):
    if flood_cells.empty: return {"type":"FeatureCollection","features":[]}
    fp = flood_cells.to_crs(5235).copy()
    fp["geometry"] = fp.geometry.buffer(12)
    diss = fp.dissolve().explode(index_parts=False).reset_index(drop=True)
    diss = diss[diss.geometry.area > min_area_m2]
    diss["geometry"] = diss.geometry.buffer(-12)
    diss = diss.to_crs(4326)
    features=[]
    for _, row in diss.iterrows():
        geom=row.geometry
        if not geom or geom.is_empty: continue
        polys=[geom] if geom.geom_type=="Polygon" else list(geom.geoms)
        mp=float(row.get("flood_prob",0.8))
        sev="high" if mp>0.70 else "medium" if mp>0.50 else "low"
        for poly in polys:
            rings=[list(map(list,poly.exterior.coords))]
            rings+=[list(map(list,i.coords)) for i in poly.interiors]
            features.append({"type":"Feature",
                "geometry":{"type":"Polygon","coordinates":rings},
                "properties":{"severity":sev,"mean_prob":round(mp,3),
                    "area_km2":round(poly.area*(111.32**2)*
                        np.cos(np.radians(poly.centroid.y)),3)}})
    return {"type":"FeatureCollection","features":features}

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="Colombo Flood Predictor v3")
app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])

class SubdistInput(BaseModel):
    division:          str
    rainfall_7day:     float
    rainfall_14day:    float
    upstream_rain_7d:  float
    upstream_rain_14d: float
    river_water_level: float
    threshold:         float | None = None

class DivisionWeather(BaseModel):
    rainfall_7day:     float
    rainfall_14day:    float
    upstream_rain_7d:  float
    upstream_rain_14d: float
    river_water_level: float

class FullMapInput(BaseModel):
    divisions: dict[str, DivisionWeather]   # {division_name: weather}
    threshold: float | None = None

@app.post("/predict/subdist")
async def predict_subdist(req: SubdistInput):
    thresh = req.threshold or THRESH
    mask   = grid["division"] == req.division
    g_sub  = grid[mask].reset_index(drop=True)
    if g_sub.empty:
        return {"error": f"Unknown division: {req.division}", "valid": DIVS}
    div_enc = le.transform([req.division])[0] if req.division in le.classes_ else 0
    X = pd.DataFrame({"elevation":g_sub["elevation"].values,
        "dist_river":g_sub["dist_river"].values,
        "rainfall_7day":req.rainfall_7day, "rainfall_14day":req.rainfall_14day,
        "upstream_rain_7d":req.upstream_rain_7d,
        "upstream_rain_14d":req.upstream_rain_14d,
        "river_water_level":req.river_water_level, "division_enc":div_enc})
    probs = model.predict_proba(X[FEATS])[:,1]
    g_sub = g_sub.copy(); g_sub["flood_prob"] = probs
    geojson = cells_to_polygons(g_sub[probs>=thresh])
    return {"geojson":geojson,"division":req.division,
            "flooded_pct":round(float((probs>=thresh).mean()*100),2),
            "zones":len(geojson["features"])}

@app.post("/predict/full")
async def predict_full(req: FullMapInput):
    thresh = req.threshold or THRESH
    supplied = [v.model_dump() for v in req.divisions.values()]
    fallback = {k: np.mean([s[k] for s in supplied]) for k in supplied[0]}
    n=len(grid)
    r7=np.zeros(n);r14=np.zeros(n);up7=np.zeros(n)
    up14=np.zeros(n);rl=np.zeros(n);enc=np.zeros(n,dtype=int)
    for i,div in enumerate(grid["division"].values):
        wx=req.divisions.get(div)
        w=wx.model_dump() if wx else fallback
        r7[i]=w["rainfall_7day"]; r14[i]=w["rainfall_14day"]
        up7[i]=w["upstream_rain_7d"]; up14[i]=w["upstream_rain_14d"]
        rl[i]=w["river_water_level"]
        enc[i]=le.transform([div])[0] if div in le.classes_ else 0
    X=pd.DataFrame({"elevation":grid["elevation"].values,
        "dist_river":grid["dist_river"].values,
        "rainfall_7day":r7,"rainfall_14day":r14,
        "upstream_rain_7d":up7,"upstream_rain_14d":up14,
        "river_water_level":rl,"division_enc":enc})
    probs=model.predict_proba(X[FEATS])[:,1]
    gw=grid.copy(); gw["flood_prob"]=probs
    geojson=cells_to_polygons(gw[probs>=thresh])
    return {"geojson":geojson,
            "flooded_pct":round(float((probs>=thresh).mean()*100),2),
            "zones":len(geojson["features"])}

@app.get("/divisions")
async def list_divisions(): return {"divisions": DIVS}

@app.get("/health")
async def health(): return {"status":"ok","grid_cells":len(grid)}