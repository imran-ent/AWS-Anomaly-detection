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

    CRITICAL: Preserves injected ground-truth columns as ground_truth_anomaly /
    ground_truth_fault_type so evaluation is not lost. Legacy 'anomaly' alias
    now only created if no GT exists; otherwise GT is preserved under new names.
    Adds backwards-compatible aliases:
    - df["status"] = "ANOMALY"/"NORMAL"
    - df["anomaly"] = 1/0 ONLY if no GT column exists (otherwise GT preserved)
    """
    try:
        from anomaly_detection import detect_anomalies as real_detect
    except ImportError as e:
        raise ImportError(
            f"Failed to import anomaly_detection from {AML_DIR}. "
            f"Ensure isolation_forest.joblib exists. Original error: {e}"
        ) from e

    # Preserve GT before detection mutates (detect adds extra signals but keeps columns)
    has_gt_anomaly = "anomaly" in df.columns
    has_gt_fault = "fault_type" in df.columns
    gt_anomaly_series = df["anomaly"].copy() if has_gt_anomaly else None
    gt_fault_series = df["fault_type"].copy() if has_gt_fault else None

    model_dir = _get_model_dir()
    result_df = real_detect(df, model_dir=str(model_dir))

    # Preserve GT under explicit names (source of truth for evaluation)
    if has_gt_anomaly and gt_anomaly_series is not None:
        result_df["ground_truth_anomaly"] = gt_anomaly_series.values
        result_df["ground_truth_label"] = gt_anomaly_series.map(lambda x: "Anomaly" if int(x)==1 else "Normal" if pd.notna(x) else "Unknown")
        # Also keep 'anomaly' as GT for backward compat with evaluation code that expects GT there
        # AND keep 'ml_anomaly' as prediction
        result_df["anomaly"] = gt_anomaly_series.values  # GT stays in 'anomaly' for transparency
        result_df["ml_is_anomaly"] = result_df["is_anomaly"]
        result_df["ml_anomaly"] = result_df["is_anomaly"].astype(int)
    else:
        # No GT present -> create legacy alias from prediction (live data mode)
        result_df["anomaly"] = result_df["is_anomaly"].astype(int)

    if has_gt_fault and gt_fault_series is not None:
        result_df["ground_truth_fault_type"] = gt_fault_series.values
        # predicted_fault_type already is ML prediction

    # Status alias (NORMAL/ANOMALY) always is ML prediction
    result_df["status"] = result_df["is_anomaly"].map(lambda x: "ANOMALY" if x else "NORMAL")

    return result_df
