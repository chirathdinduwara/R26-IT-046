from __future__ import annotations

import importlib.util
import os
import sys
from pathlib import Path
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


BASE_DIR = Path(__file__).resolve().parent
FLOOD_MAIN_PATH = BASE_DIR / "flood-map" / "main.py"
DENGUE_ROOT = BASE_DIR / "dengue-warning"


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
flood_app: FastAPI = flood_module.app

if str(DENGUE_ROOT) not in sys.path:
    sys.path.insert(0, str(DENGUE_ROOT))

from api.dengue_router import router as dengue_router  # noqa: E402
from api.main import health as dengue_health  # noqa: E402
from api.main import score as dengue_score  # noqa: E402
from api.schemas import RiskScoreRequest, RiskScoreResponse  # noqa: E402


app = FastAPI(title="Geonix Unified Backend", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Keep flood map endpoints exactly as they are (/predict/full, /predict/subdist, etc.).
app.include_router(flood_app.router)

# Add dengue warning endpoints on the same backend process.
app.include_router(dengue_router)
app.post("/score", response_model=RiskScoreResponse)(dengue_score)


@app.get("/dengue/health")
def dengue_health_check() -> dict[str, Any]:
    return dengue_health()
