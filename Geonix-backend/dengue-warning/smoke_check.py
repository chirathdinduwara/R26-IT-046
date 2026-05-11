#!/usr/bin/env python3
"""Minimal smoke check for api.main"""
import sys
try:
    from api import main
    print("✓ api.main imported successfully")
    print(f"  Model path: {main.MODEL_PATH}")
    print(f"  Features count: {len(main.feature_columns)}")
    print(f"  Scaler enabled: {main.scaler_enabled}")
    sys.exit(0)
except ImportError as e:
    print(f"✗ Import failed: {e}")
    sys.exit(1)
except Exception as e:
    print(f"✗ Error: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

