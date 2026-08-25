#!/usr/bin/env python3
"""Minimal smoke check for api.main and model_manager"""
import sys
try:
    from api.model_manager import model_manager, MODEL_PATH
    print("[OK] api.main and model_manager imported successfully")
    print(f"  Model path: {MODEL_PATH}")
    print(f"  Features count: {len(model_manager.feature_columns)}")
    print(f"  Scaler enabled: {model_manager.scaler_enabled}")
    sys.exit(0)
except ImportError as e:
    print(f"[ERROR] Import failed: {e}")
    sys.exit(1)
except Exception as e:
    print(f"[ERROR] Error: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
