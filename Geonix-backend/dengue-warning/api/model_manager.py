from __future__ import annotations

import os
import pickle
import json
import joblib
import threading
import logging
from pathlib import Path
from typing import Any, Dict, List

import pandas as pd

logger = logging.getLogger("dengue_warning.model_manager")

BASE_MODEL_DIR = Path(__file__).resolve().parents[1] / "model"

MODEL_PATH = BASE_MODEL_DIR / "current_week" / "model.pkl"
FEATURES_PATH = BASE_MODEL_DIR / "metadata" / "feature_schema.json"
SCALER_PATH = BASE_MODEL_DIR / "preprocessing" / "label_encoder.pkl"

class DynamicModelManager:
    def __init__(self):
        self.models: Dict[str, Any] = {}
        self.label_encoder: Any = None
        self.feature_columns: List[str] = []
        self.model_config: Dict[str, Any] = {}
        self.area_metadata: Dict[str, Any] = {}
        self.model_metrics: Dict[str, Any] = {}
        self.scaler_enabled: bool = False
        self.mtimes: Dict[str, float] = {}
        self._lock = threading.Lock()
        self.load_or_reload()

    def load_or_reload(self) -> None:
        """Checks file mtimes and reloads artifacts dynamically if they change."""
        paths = {
            "current_week": BASE_MODEL_DIR / "current_week" / "model.pkl",
            "week_1": BASE_MODEL_DIR / "week_1" / "model.pkl",
            "week_2": BASE_MODEL_DIR / "week_2" / "model.pkl",
            "label_encoder": BASE_MODEL_DIR / "preprocessing" / "label_encoder.pkl",
            "feature_schema": BASE_MODEL_DIR / "metadata" / "feature_schema.json",
            "model_config": BASE_MODEL_DIR / "metadata" / "model_config.json",
            "area_metadata": BASE_MODEL_DIR / "metadata" / "area_metadata.json",
            "model_metrics": BASE_MODEL_DIR / "evaluation" / "model_metrics.json",
        }
        needs_reload = False
        with self._lock:
            for key, path in paths.items():
                if path.exists():
                    mtime = path.stat().st_mtime
                    if self.mtimes.get(key) != mtime:
                        self.mtimes[key] = mtime
                        needs_reload = True
                elif key in ["current_week", "label_encoder"]:
                    if not self.models.get("current_week") or not self.label_encoder:
                        raise FileNotFoundError(f"Critical Dengue model file not found at {path}")

            if needs_reload or not self.models:
                self._load_files()

    def _load_files(self) -> None:
        """Internal helper to read the pickles and json metadata from disk."""
        logger.info("Reloading Dengue model artifacts from disk...")
        try:
            for horizon in ["current_week", "week_1", "week_2"]:
                path = BASE_MODEL_DIR / horizon / "model.pkl"
                if path.exists():
                    with path.open("rb") as handle:
                        self.models[horizon] = pickle.load(handle)

            le_path = BASE_MODEL_DIR / "preprocessing" / "label_encoder.pkl"
            if le_path.exists():
                with le_path.open("rb") as handle:
                    self.label_encoder = joblib.load(handle)

            config_path = BASE_MODEL_DIR / "metadata" / "model_config.json"
            if config_path.exists():
                with config_path.open("r") as f:
                    self.model_config = json.load(f)

            schema_path = BASE_MODEL_DIR / "metadata" / "feature_schema.json"
            if schema_path.exists():
                with schema_path.open("r") as f:
                    schema_data = json.load(f)
                    self.feature_columns = schema_data.get("features", [])

            area_path = BASE_MODEL_DIR / "metadata" / "area_metadata.json"
            if area_path.exists():
                with area_path.open("r") as f:
                    self.area_metadata = json.load(f)

            metrics_path = BASE_MODEL_DIR / "evaluation" / "model_metrics.json"
            if metrics_path.exists():
                with metrics_path.open("r") as f:
                    self.model_metrics = json.load(f)

            logger.info(
                f"Successfully loaded model. Features count: {len(self.feature_columns)}. "
                f"Classes: {list(self.label_encoder.classes_) if self.label_encoder else 'None'}."
            )
        except Exception as exc:
            logger.error(f"Error loading model artifacts: {exc}")

    def get_status(self) -> Dict[str, Any]:
        """Returns metadata about the active model components."""
        self.load_or_reload()
        return {
            "model_version": self.model_config.get("model_version", "1.0.0"),
            "algorithm": self.model_config.get("algorithm", "XGBoost"),
            "feature_count": len(self.feature_columns),
            "features": self.feature_columns,
            "classes": list(self.label_encoder.classes_) if self.label_encoder else [],
            "metrics": self.model_metrics,
            "last_modified": {
                key: pd.Timestamp(val, unit="s").isoformat()
                for key, val in self.mtimes.items()
            },
        }

    def predict_horizon(self, horizon: str, feature_values: Dict[str, float]) -> Dict[str, Any]:
        """Runs inference for a specific forecast horizon (current_week, week_1, week_2)."""
        self.load_or_reload()
        model = self.models.get(horizon)
        if not model:
            raise RuntimeError(f"Dengue model for horizon '{horizon}' is not loaded.")
        if not self.label_encoder:
            raise RuntimeError("Label encoder is not loaded.")

        # Re-align feature vector to whatever columns the model expects
        aligned_features = {}
        for col in self.feature_columns:
            aligned_features[col] = float(feature_values.get(col, 0.0))

        # Create DataFrame
        feature_frame = pd.DataFrame([aligned_features], columns=self.feature_columns)

        # Run prediction
        pred_idx = model.predict(feature_frame)[0]
        probabilities = model.predict_proba(feature_frame)[0]

        # Map to class labels
        classes = self.label_encoder.classes_
        prob_dict = {}
        for idx, cls_name in enumerate(classes):
            prob_dict[cls_name] = float(probabilities[idx])

        predicted_class = str(classes[pred_idx])

        return {
            "predicted_class": predicted_class,
            "probabilities": prob_dict,
        }

    def predict(self, feature_values: Dict[str, float]) -> float:
        """
        Backward compatible prediction mapping predicted category back to numerical cases.
        Low (<10 cases) -> 5.0
        Medium (10-30 cases) -> 20.0
        High (>30 cases) -> 45.0
        """
        try:
            res = self.predict_horizon("current_week", feature_values)
            pred_class = res["predicted_class"]
            if pred_class == "Low":
                return 5.0
            elif pred_class == "Medium":
                return 20.0
            else:
                return 45.0
        except Exception as exc:
            logger.error(f"Error in backward compatible predict: {exc}")
            return 12.0

# Singleton manager
model_manager = DynamicModelManager()
