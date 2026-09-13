"""
Re-export feature engineering from backend/features.py for pipeline compatibility.
"""
import sys
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from features import create_features  # noqa: F401, E402

__all__ = ["create_features"]
