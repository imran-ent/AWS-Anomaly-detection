"""
ML Service - wraps the real anomaly_detection module (IsolationForest + rules).
Uses models in backend/models/ (copied from AI_ML Anomaly Detection/).
"""
import os
import sys
import joblib
import pandas as pd

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_DIR = os.path.join(BASE_DIR, "models")
# Fallback to AI_ML folder if models not yet copied
FALLBACK_MODEL_DIR = os.path.join(BASE_DIR, "AI_ML Anomaly Detection")

# Ensure the AI_ML module is importable
AML_PATH = os.path.join(BASE_DIR, "AI_ML Anomaly Detection")
if AML_PATH not in sys.path:
    sys.path.insert(0, AML_PATH)

# Prefer backend/models, fallback to AI_ML folder
_effective_model_dir = MODEL_DIR if os.path.exists(os.path.join(MODEL_DIR, "isolation_forest.joblib")) else FALLBACK_MODEL_DIR


def _get_model_dir():
    # Re-check in case files were added after import
    if os.path.exists(os.path.join(MODEL_DIR, "isolation_forest.joblib")):
        return MODEL_DIR
    return FALLBACK_MODEL_DIR


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
            f"Failed to import anomaly_detection from {AML_PATH}. "
            f"Ensure isolation_forest.joblib exists. Original error: {e}"
        ) from e

    model_dir = _get_model_dir()
    result_df = real_detect(df, model_dir=model_dir)

    # Backwards-compatible aliases for older router code that expects "status" / "anomaly"
    result_df["status"] = result_df["is_anomaly"].map(lambda x: "ANOMALY" if x else "NORMAL")
    result_df["anomaly"] = result_df["is_anomaly"].astype(int)

    return result_df
