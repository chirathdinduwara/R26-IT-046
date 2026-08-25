from __future__ import annotations

import os
import pickle
import threading
import logging
from pathlib import Path
from typing import Any, Dict, List

import pandas as pd

logger = logging.getLogger("dengue_warning.model_manager")

def _default_artifacts_testmodel_dir() -> Path:
    return Path(__file__).resolve().parents[1] / "model"

# Paths to model artifacts
ARTIFACTS_TESTMODEL_DIR = Path(os.getenv("ARTIFACTS_TESTMODEL_DIR", str(_default_artifacts_testmodel_dir())))
MODEL_PATH = Path(os.getenv("MODEL_PATH", str(ARTIFACTS_TESTMODEL_DIR / "dengue_model.pkl")))
FEATURES_PATH = Path(os.getenv("FEATURES_PATH", str(ARTIFACTS_TESTMODEL_DIR / "features.pkl")))
SCALER_PATH = Path(os.getenv("SCALER_PATH", str(ARTIFACTS_TESTMODEL_DIR / "scaler.pkl")))

class DynamicModelManager:
    def __init__(self):
        self.model: Any = None
        self.scaler: Any = None
        self.feature_columns: List[str] = []
        self.scaler_enabled: bool = False
        self.mtimes: Dict[str, float] = {}
        self._lock = threading.Lock()
        self.load_or_reload()

    def load_or_reload(self) -> None:
        """Checks file mtimes and reloads artifacts dynamically if they change."""
        paths = {
            "model": MODEL_PATH,
            "features": FEATURES_PATH,
            "scaler": SCALER_PATH,
        }
        needs_reload = False
        with self._lock:
            for key, path in paths.items():
                if path.exists():
                    mtime = path.stat().st_mtime
                    if self.mtimes.get(key) != mtime:
                        self.mtimes[key] = mtime
                        needs_reload = True
                elif key == "model":
                    # If model file is deleted but we have a copy in memory, we proceed.
                    # If we don't, we raise an error.
                    if self.model is None:
                        raise FileNotFoundError(f"Model file not found at {MODEL_PATH}")

            if needs_reload or self.model is None:
                self._load_files()

    def _load_files(self) -> None:
        """Internal helper to read the pickles from disk."""
        logger.info("Reloading model artifacts from disk...")
        try:
            if MODEL_PATH.exists():
                with MODEL_PATH.open("rb") as handle:
                    self.model = pickle.load(handle)

            if FEATURES_PATH.exists():
                with FEATURES_PATH.open("rb") as handle:
                    raw_features = pickle.load(handle)
                    if isinstance(raw_features, (list, tuple)):
                        self.feature_columns = [str(x) for x in raw_features]
                    else:
                        self.feature_columns = []
            else:
                self.feature_columns = []

            if SCALER_PATH.exists():
                with SCALER_PATH.open("rb") as handle:
                    self.scaler = pickle.load(handle)
                scaler_transform = getattr(self.scaler, "transform", None)
                self.scaler_enabled = callable(scaler_transform)
            else:
                self.scaler = None
                self.scaler_enabled = False

            logger.info(
                f"Successfully loaded model. Features count: {len(self.feature_columns)}. "
                f"Scaler enabled: {self.scaler_enabled}."
            )
        except Exception as exc:
            logger.error(f"Error loading model artifacts: {exc}")
            # Do not overwrite working memory variables with None on failure

    def get_status(self) -> Dict[str, Any]:
        """Returns metadata about the active model components."""
        self.load_or_reload()
        return {
            "model_path": str(MODEL_PATH),
            "features_path": str(FEATURES_PATH),
            "scaler_path": str(SCALER_PATH),
            "model_type": type(self.model).__name__ if self.model else "None",
            "feature_count": len(self.feature_columns),
            "features": self.feature_columns,
            "scaler_enabled": self.scaler_enabled,
            "scaler_type": type(self.scaler).__name__ if self.scaler else "None",
            "last_modified": {
                key: pd.Timestamp(val, unit="s").isoformat()
                for key, val in self.mtimes.items()
            },
        }

    def predict(self, feature_values: Dict[str, float]) -> float:
        """
        Extracts only the feature fields expected by the active model and predicts.
        Gracefully handles missing columns by defaulting to 0.0.
        """
        self.load_or_reload()
        if not self.model:
            raise RuntimeError("Model is not loaded.")

        # Re-align feature vector to whatever columns the model expects
        aligned_features = {}
        for col in self.feature_columns:
            aligned_features[col] = float(feature_values.get(col, 0.0))

        # Create DataFrame
        feature_frame = pd.DataFrame([aligned_features], columns=self.feature_columns)
        
        # Scale if enabled
        if self.scaler_enabled and self.scaler is not None:
            model_input = self.scaler.transform(feature_frame)
        else:
            model_input = feature_frame

        prediction = self.model.predict(model_input)[0]
        return float(prediction)

# Singleton manager
model_manager = DynamicModelManager()
