from __future__ import annotations

import importlib.util
import os
import sys
from pathlib import Path
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent

# Load environment variables from all service directories
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR / "dengue-warning" / ".env")
load_dotenv(BASE_DIR / "safe_route" / ".env")
load_dotenv(BASE_DIR / "paddy-advisory" / ".env")

FLOOD_MAIN_PATH = BASE_DIR / "flood-map" / "main.py"
SAFE_ROUTE_MAIN_PATH = BASE_DIR / "safe_route" / "main.py"
DENGUE_ROOT = BASE_DIR / "dengue-warning"
PADDY_MAIN_PATH = BASE_DIR / "paddy-advisory" / "api.py"
PADDY_ROOT = BASE_DIR / "paddy-advisory"

def _load_module_from_file(module_name: str, file_path: Path, working_dir: Path | None = None) -> Any:
    spec = importlib.util.spec_from_file_location(module_name, file_path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot load module from {file_path}")
    module = importlib.util.module_from_spec(spec)
    previous_dir = Path.cwd()
    try:
        if working_dir is not None:
            os.chdir(working_dir)
        spec.loader.exec_module(module)
    finally:
        os.chdir(previous_dir)
    return module


try:
    flood_module = _load_module_from_file(
        module_name="geonix_flood_main",
        file_path=FLOOD_MAIN_PATH,
        working_dir=FLOOD_MAIN_PATH.parent,
    )
except ModuleNotFoundError as exc:
    raise RuntimeError(
        "Flood backend dependencies are missing. Install flood requirements in the same Python environment "
        "(for example: geopandas, shapely, fiona, pyproj, httpx, scikit-learn, pandas, numpy, fastapi, uvicorn)."
    ) from exc
flood_router = flood_module.router

try:
    safe_route_module = _load_module_from_file(
        module_name="geonix_safe_route_main",
        file_path=SAFE_ROUTE_MAIN_PATH,
        working_dir=SAFE_ROUTE_MAIN_PATH.parent,
    )
except ModuleNotFoundError as exc:
    raise RuntimeError(
        "Safe route backend dependencies are missing. Install safe_route requirements in the same Python environment "
        "(for example: fastapi, pydantic, httpx, scikit-learn, joblib, numpy, uvicorn)."
    ) from exc
safe_route_router = safe_route_module.router

if str(DENGUE_ROOT) not in sys.path:
    sys.path.insert(0, str(DENGUE_ROOT))


import importlib
dengue_router_module = importlib.import_module("api.dengue_router")
dengue_main_module = importlib.import_module("api.main")
dengue_schemas_module = importlib.import_module("api.schemas")

dengue_router = dengue_router_module.router
dengue_health = dengue_main_module.health
dengue_score = dengue_main_module.score
RiskScoreResponse = dengue_schemas_module.RiskScoreResponse

if str(PADDY_ROOT) not in sys.path:
    sys.path.insert(0, str(PADDY_ROOT))

try:
    paddy_module = _load_module_from_file(
        module_name="geonix_paddy_main",
        file_path=PADDY_MAIN_PATH,
        working_dir=PADDY_MAIN_PATH.parent,
    )
except ModuleNotFoundError as exc:
    raise RuntimeError(
        "Paddy advisory backend dependencies are missing. Install paddy requirements in the same Python environment "
        "(for example: fastapi, pydantic, joblib, pandas, requests, python-dotenv)."
    ) from exc
paddy_router = paddy_module.router


app = FastAPI(title="Geonix Unified Backend", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Keep flood map endpoints exactly as they are (/predict/full, /predict/subdist, etc.).
app.include_router(flood_router)

# Add safe route endpoints under /safe-route.
app.include_router(safe_route_router)

# Add dengue warning endpoints on the same backend process.
app.include_router(dengue_router)
app.post("/score", response_model=RiskScoreResponse)(dengue_score)

# Add paddy advisory endpoints.
app.include_router(paddy_router)


@app.get("/dengue/health")
def dengue_health_check() -> dict[str, Any]:
    return dengue_health()


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok", "message": "Geonix Unified Backend Gateway is running"}

