from fastapi import APIRouter
from pydantic import BaseModel
import geopandas as gpd, pandas as pd, numpy as np
import joblib, json, httpx
from datetime import datetime, timedelta, timezone

# ── Load artifacts ────────────────────────────────────────────────────────────
model  = joblib.load("model/flood_model.pkl")
le     = joblib.load("model/division_encoder.pkl")
grid   = gpd.read_file("model/grid.geojson").to_crs(4326)
config = json.load(open("model/config.json"))
FEATS  = config["feature_cols"]
THRESH = config["threshold"]
DIVS   = config["divisions"]


GATE = {
    "rainfall_7day":    ( 40.0,    80.0 ),  # mm   — 7-day local rainfall
    "upstream_rain_7d": ( 30.0,    60.0 ),  # mm   — Kelani catchment (Kitulgala/Avissawella)
    "river_water_level":( 6.5,      8.0 ),  # m    — Hanwella gauge (alert ~8m, danger ~10m)
}


WEIGHTS = {"rainfall_7day": 0.45, "upstream_rain_7d": 0.25, "river_water_level": 0.30}


def physics_score(r7: float, up7: float, river: float) -> tuple[bool, float]:

    vals = {"rainfall_7day": r7, "upstream_rain_7d": up7, "river_water_level": river}


    for key, (hard_min, _) in GATE.items():
        if vals[key] < hard_min:
            return True, 0.0


    factors = {}
    for key, (hard_min, soft_min) in GATE.items():
        v = vals[key]
        factors[key] = 1.0 if v >= soft_min else (v - hard_min) / (soft_min - hard_min)

    dampen = float(np.clip(sum(WEIGHTS[k] * factors[k] for k in WEIGHTS), 0.0, 1.0))
    return False, dampen


def empty_response(reason: str, r7: float, up7: float, river: float, division: str = None):
    resp = {
        "geojson":     {"type": "FeatureCollection", "features": []},
        "flooded_pct": 0.0,
        "zones":       0,
        "blocked":     True,
        "reason":      reason,
        "inputs":      {
            "rainfall_7day_mm":    r7,
            "upstream_rain_7d_mm": up7,
            "river_water_level_m": river,
        },
    }
    if division:
        resp["division"] = division
    return resp



def cells_to_polygons(flood_cells, min_area_m2=40_000):
    if flood_cells.empty:
        return {"type": "FeatureCollection", "features": []}
    fp = flood_cells.to_crs(5235).copy()
    fp["geometry"] = fp.geometry.buffer(12)
    diss = fp.dissolve().explode(index_parts=False).reset_index(drop=True)
    diss = diss[diss.geometry.area > min_area_m2]
    diss["geometry"] = diss.geometry.buffer(-12)
    diss = diss.to_crs(4326)
    features = []
    for _, row in diss.iterrows():
        geom = row.geometry
        if not geom or geom.is_empty:
            continue
        polys = [geom] if geom.geom_type == "Polygon" else list(geom.geoms)
        mp  = float(row.get("flood_prob", 0.8))
        sev = "high" if mp > 0.70 else "medium" if mp > 0.50 else "low"
        for poly in polys:
            rings = [list(map(list, poly.exterior.coords))]
            rings += [list(map(list, i.coords)) for i in poly.interiors]
            features.append({
                "type": "Feature",
                "geometry": {"type": "Polygon", "coordinates": rings},
                "properties": {
                    "severity":  sev,
                    "mean_prob": round(mp, 3),
                    "area_km2":  round(
                        poly.area * (111.32 ** 2) * np.cos(np.radians(poly.centroid.y)), 3
                    ),
                },
            })
    return {"type": "FeatureCollection", "features": features}


# ── App ───────────────────────────────────────────────────────────────────────
router = APIRouter(tags=["flood-map"])


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
    divisions: dict[str, DivisionWeather]
    threshold: float | None = None


# ── Live river level ──────────────────────────────────────────────────────────
RIVER_API = "https://api.riverwatch.lk/v1/stations/6930a98221f7b8c9787f0622/history"

async def get_latest_river_level() -> float:
    now = datetime.now(timezone.utc)
    params = {
        "limit":      1,
        "start_date": (now - timedelta(days=3)).strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
        "end_date":   now.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
    }
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.get(RIVER_API, params=params)
            r.raise_for_status()
            print(f"Latest river level from API: {r.json()[0]['waterLevel']} m")
            return float(r.json()[0]["waterLevel"])
    except Exception:
        return 6.0   # conservative fallback keeps gate closed


# ── POST /predict/subdist ─────────────────────────────────────────────────────
@router.post("/predict/subdist")
async def predict_subdist(req: SubdistInput):
    thresh = req.threshold or THRESH

    # 1. Physics gate
    blocked, dampen = physics_score(
        req.rainfall_7day, req.upstream_rain_7d, req.river_water_level
    )
    if blocked:
        return empty_response(
            "Conditions below minimum flood threshold — no flood expected",
            req.rainfall_7day, req.upstream_rain_7d, req.river_water_level,
            division=req.division,
        )

    # 2. Grid subset for this division
    g_sub = grid[grid["division"] == req.division].reset_index(drop=True)
    if g_sub.empty:
        return {"error": f"Unknown division: {req.division}", "valid": DIVS}

    div_enc = le.transform([req.division])[0] if req.division in le.classes_ else 0

    X = pd.DataFrame({
        "elevation":         g_sub["elevation"].values,
        "dist_river":        g_sub["dist_river"].values,
        "rainfall_7day":     req.rainfall_7day,
        "rainfall_14day":    req.rainfall_14day,
        "upstream_rain_7d":  req.upstream_rain_7d,
        "upstream_rain_14d": req.upstream_rain_14d,
        "river_water_level": req.river_water_level,
        "division_enc":      div_enc,
    })

    # 3. Predict + dampen
    probs = model.predict_proba(X[FEATS])[:, 1] * dampen

    g_sub = g_sub.copy()
    g_sub["flood_prob"] = probs
    geojson = cells_to_polygons(g_sub[probs >= thresh])

    return {
        "geojson":       geojson,
        "division":      req.division,
        "flooded_pct":   round(float((probs >= thresh).mean() * 100), 2),
        "zones":         len(geojson["features"]),
        "dampen_factor": round(dampen, 3),
        "blocked":       False,
    }


# ── POST /predict/full ────────────────────────────────────────────────────────
@router.post("/predict/full")
async def predict_full(req: FullMapInput):
    thresh = req.threshold or THRESH

    live_river_level = await get_latest_river_level()

    supplied = [v.model_dump() for v in req.divisions.values()]
    fallback = {k: float(np.mean([s[k] for s in supplied])) for k in supplied[0]}

    # City-level gate using mean rainfall + live river
    mean_r7  = float(np.mean([s["rainfall_7day"]    for s in supplied]))
    mean_up7 = float(np.mean([s["upstream_rain_7d"] for s in supplied]))
    blocked, _ = physics_score(mean_r7, mean_up7, live_river_level)
    if blocked:
        return empty_response(
            "City-wide conditions below minimum flood threshold",
            mean_r7, mean_up7, live_river_level,
        ) | {"river_level": live_river_level}

    n    = len(grid)
    r7   = np.zeros(n);  r14   = np.zeros(n)
    up7  = np.zeros(n);  up14  = np.zeros(n)
    rl   = np.full(n, live_river_level)
    enc  = np.zeros(n, dtype=int)
    cell_dampen = np.ones(n)   # per-division dampening

    for i, div in enumerate(grid["division"].values):
        wx = req.divisions.get(div)
        w  = wx.model_dump() if wx else fallback
        r7[i]   = w["rainfall_7day"]
        r14[i]  = w["rainfall_14day"]
        up7[i]  = w["upstream_rain_7d"]
        up14[i] = w["upstream_rain_14d"]
        enc[i]  = le.transform([div])[0] if div in le.classes_ else 0
        # Each cell gets a dampen factor based on its division's own rainfall
        _, cell_dampen[i] = physics_score(
            w["rainfall_7day"], w["upstream_rain_7d"], live_river_level
        )

    X = pd.DataFrame({
        "elevation":         grid["elevation"].values,
        "dist_river":        grid["dist_river"].values,
        "rainfall_7day":     r7,
        "rainfall_14day":    r14,
        "upstream_rain_7d":  up7,
        "upstream_rain_14d": up14,
        "river_water_level": rl,
        "division_enc":      enc,
    })

    # Per-cell dampening applied after model inference
    probs = model.predict_proba(X[FEATS])[:, 1] * cell_dampen

    gw = grid.copy()
    gw["flood_prob"] = probs
    geojson = cells_to_polygons(gw[probs >= thresh])

    return {
        "geojson":     geojson,
        "flooded_pct": round(float((probs >= thresh).mean() * 100), 2),
        "zones":       len(geojson["features"]),
        "river_level": live_river_level,
        "blocked":     False,
    }


# ── Utility endpoints ─────────────────────────────────────────────────────────
@router.get("/divisions")
async def list_divisions():
    return {"divisions": DIVS}


@router.get("/health")
async def health():
    return {"status": "ok", "grid_cells": len(grid)}

@router.get("/riverLevel")
async def get_river_level():
    return {"river_level": await get_latest_river_level()}


@router.get("/thresholds")
async def get_thresholds():
    """Returns the physics gate limits — useful for frontend tooltips."""
    return {
        "physics_gate": {
            "rainfall_7day":    {"hard_min": 40,  "soft_min": 80,  "unit": "mm"},
            "upstream_rain_7d": {"hard_min": 30,  "soft_min": 60,  "unit": "mm"},
            "river_water_level":{"hard_min": 6.5, "soft_min": 8.0, "unit": "metres"},
        },
        "model_threshold": THRESH,
        "note": (
            "Below hard_min → always empty (blocked). "
            "Between hard_min and soft_min → model runs with dampened probabilities. "
            "Above soft_min → model runs at full strength."
        ),
    }


@router.get("/verify")
async def verify():
    """Sanity check: flood area must grow monotonically with rainfall + river level."""
    scenarios = [
        (20,  5.0,  "dry season"),
        (50,  6.8,  "light rain"),
        (80,  8.5,  "moderate"),
        (120, 10.0, "heavy"),
        (180, 12.0, "extreme"),
    ]
    results = []
    for r7, river, label in scenarios:
        blocked, dampen = physics_score(r7, r7 * 0.6, river)
        if blocked:
            results.append({"label": label, "rainfall_7d": r7, "river_m": river,
                             "flooded_pct": 0.0, "blocked": True})
            continue
        X = pd.DataFrame({
            "elevation":         grid["elevation"].values,
            "dist_river":        grid["dist_river"].values,
            "rainfall_7day":     r7,
            "rainfall_14day":    r7 * 1.8,
            "upstream_rain_7d":  r7 * 0.6,
            "upstream_rain_14d": r7 * 1.1,
            "river_water_level": river,
            "division_enc":      np.zeros(len(grid), dtype=int),
        })
        probs = model.predict_proba(X[FEATS])[:, 1] * dampen
        results.append({
            "label":        label,
            "rainfall_7d":  r7,
            "river_m":      river,
            "dampen":       round(dampen, 3),
            "flooded_pct":  round(float((probs >= THRESH).mean() * 100), 2),
            "blocked":      False,
        })

    pcts = [r["flooded_pct"] for r in results]
    monotone = all(pcts[i] <= pcts[i + 1] for i in range(len(pcts) - 1))
    return {
        "monotone_ok": monotone,
        "status":      "OK" if monotone else "WARNING — not monotone, check training data",
        "results":     results,
    }
