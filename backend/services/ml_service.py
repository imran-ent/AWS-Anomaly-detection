"""
ML Service - wraps the real anomaly_detection module (IsolationForest + rules).
Uses models in backend/models/ (copied from AI_ML Anomaly Detection/).
Path resolution via pathlib so it works on Windows (D:\\...) and Linux (/opt/render/...).
"""
from pathlib import Path
import sys
import pandas as pd

# Base dir = backend/ (two levels up from services/ml_service.py is not, actually one: services -> backend)
# Path(__file__).resolve().parent = .../backend/services, parent.parent = .../backend
BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_DIR = BASE_DIR / "models"
# AI_ML folder with space in name - handle via Path
AML_DIR = BASE_DIR / "AI_ML Anomaly Detection"
AML_MODELS_DIR = AML_DIR / "models"

# Ensure the AI_ML module is importable
if str(AML_DIR) not in sys.path:
    sys.path.insert(0, str(AML_DIR))


def _get_model_dir() -> Path:
    # Prefer backend/models, then AI_ML/models, then AI_ML top-level (all contain real file)
    for p in [MODEL_DIR, AML_MODELS_DIR, AML_DIR]:
        if (p / "isolation_forest.joblib").exists():
            return p
    # Fallback to MODEL_DIR so caller gets clear FileNotFound with that path
    return MODEL_DIR


def detect_anomalies(df):
    """
    Delegates to anomaly_detection.detect_anomalies which:
    - uses IsolationForest + deterministic rules
    - outputs: anomaly_score, is_anomaly, severity, confidence,
               predicted_fault_type, explanation, suggested_correction,
               sensor_health_status
    Input must be feature-engineered (output of create_features).
    Adds backwards-compatible aliases:
    - df["status"] = "ANOMALY"/"NORMAL"
    - df["anomaly"] = 1/0  (for legacy dashboard code)
    """
    try:
        from anomaly_detection import detect_anomalies as real_detect
    except ImportError as e:
        raise ImportError(
            f"Failed to import anomaly_detection from {AML_DIR}. "
            f"Ensure isolation_forest.joblib exists. Original error: {e}"
        ) from e

    model_dir = _get_model_dir()
    result_df = real_detect(df, model_dir=str(model_dir))

    # Backwards-compatible aliases for older router code that expects "status" / "anomaly"
    result_df["status"] = result_df["is_anomaly"].map(lambda x: "ANOMALY" if x else "NORMAL")
    result_df["anomaly"] = result_df["is_anomaly"].astype(int)

    return result_df
