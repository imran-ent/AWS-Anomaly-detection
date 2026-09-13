"""
Re-export preprocessing from backend/preprocessing.py for pipeline compatibility.
Keeps a single source of truth.
"""
import sys
import os

# Ensure backend root is on path so `preprocessing` resolves
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from preprocessing import preprocess_data  # noqa: F401, E402

__all__ = ["preprocess_data"]
