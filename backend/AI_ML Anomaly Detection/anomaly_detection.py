"""
anomaly_detection.py
------------------------------------------------------------------------
SkyGuard AI - runtime inference module. THIS is the file/function the
backend integration teammate calls.

    from anomaly_detection import detect_anomalies
    result_df = detect_anomalies(feature_engineered_df)

INPUT  (required columns - i.e. output of create_features(preprocess_data(raw_df)))
    timestamp, station_id, temperature, humidity, pressure,
    is_missing, physical_range_flag,
    temperature_scaled, humidity_scaled, pressure_scaled,
    temperature_rate, humidity_rate, pressure_rate,
    temperature_rolling_mean/std, humidity_rolling_mean/std, pressure_rolling_mean/std,
    temperature_deviation, humidity_deviation, pressure_deviation,
    temperature_abs_change, humidity_abs_change, pressure_abs_change

OUTPUT  (all input columns preserved, plus:)
    anomaly_score          float [0, 1], higher = more anomalous.
                           NOTE: rescaled per-batch from IsolationForest's
                           decision_function, so it is a *relative* score
                           within the batch, not an absolute universal one.
                           Deterministic-rule hits (missing/frozen/physical
                           range) are floored at 0.85 regardless of the
                           raw model score, since we are certain about those.
    is_anomaly             bool
    severity               "none" / "low" / "medium" / "high" / "critical"
    confidence             float [0, 1]
    predicted_fault_type   str - "Normal" or a fault category
    explanation            str - human-readable reason (lightweight,
                           dependency-free explainability; not SHAP, but
                           gives a genuine per-row "why" for the demo/UI)
    suggested_correction   dict{temperature,humidity,pressure} or None -
                           rolling-mean based imputation for anomalous rows
    sensor_health_status   "healthy" / "degrading" / "faulty" per station,
                           based on rolling anomaly rate (last 50 readings)

MODEL USED: IsolationForest (unsupervised, primary detector) +
RandomForestClassifier (supervised, root-cause only - optional, falls back
to transparent rules if not trained) + hand-written rules for frozen-sensor
and missing-data cases IsolationForest structurally cannot catch well.
------------------------------------------------------------------------
"""

from pathlib import Path

import joblib
import numpy as np
import pandas as pd

# Resolve model dir relative to this file (works on Windows D:\... and Linux /opt/render/...)
# Canonical location is .../AI_ML Anomaly Detection/models/ ; fallback to .../AI_ML Anomaly Detection/ if needed
_this_dir = Path(__file__).resolve().parent
MODEL_DIR = _this_dir / "models"

_iso_forest = None
_root_cause_clf = None
_fault_encoder = None
_feature_config = None


def _resolve_model_dir(model_dir):
    p = Path(model_dir)
    # If passed dir doesn't contain model, try sibling locations
    if not (p / "isolation_forest.joblib").exists():
        for alt in [MODEL_DIR, _this_dir, _this_dir.parent / "models"]:
            if (alt / "isolation_forest.joblib").exists():
                return alt
    return p


def _load_models(model_dir=MODEL_DIR):
    global _iso_forest, _root_cause_clf, _fault_encoder, _feature_config
    if _iso_forest is None:
        model_dir = _resolve_model_dir(model_dir)
        _iso_forest = joblib.load(str(model_dir / "isolation_forest.joblib"))
        _feature_config = joblib.load(str(model_dir / "feature_config.joblib"))
        rc_path = model_dir / "root_cause_classifier.joblib"
        le_path = model_dir / "fault_label_encoder.joblib"
        if rc_path.exists() and le_path.exists():
            _root_cause_clf = joblib.load(str(rc_path))
            _fault_encoder = joblib.load(str(le_path))


def _add_extra_signals(df):
    """Must stay identical to train_model.add_extra_signals."""
    df = df.copy()
    for c in ["temperature_rate", "humidity_rate", "pressure_rate"]:
        if c not in df.columns:
            df[c] = 0.0

    df["temp_pressure_consistency"] = (
        df["temperature_rate"].abs() - df["pressure_rate"].abs()
    ).abs()

    df["humidity_saturation_flag"] = (
        (df["humidity"] > 100) | (df["humidity"] < 0)
    ).astype(int)

    def run_length(series):
        # Assigns the FULL size of the consecutive-identical-value run to
        # every member of that run (not just a rising counter from the
        # 3rd repeat onward) -- so a 5-long frozen run is flagged on all
        # 5 rows, not only the last 2.
        same_as_prev = series.eq(series.shift())
        grp = (~same_as_prev).cumsum()
        return series.groupby(grp).transform("size")

    frozen_runs = []
    for col in ["temperature", "humidity", "pressure"]:
        r = df.groupby("station_id")[col].transform(run_length)
        frozen_runs.append(r)
    df["frozen_run_length"] = np.maximum.reduce(frozen_runs)

    return df


_READABLE = {
    "temperature_scaled": "temperature is far from its normal range",
    "humidity_scaled": "humidity is far from its normal range",
    "pressure_scaled": "pressure is far from its normal range",
    "temperature_rate": "temperature changed abruptly between readings",
    "humidity_rate": "humidity changed abruptly between readings",
    "pressure_rate": "pressure changed abruptly between readings",
    "temperature_deviation": "temperature deviates from its recent rolling average",
    "humidity_deviation": "humidity deviates from its recent rolling average",
    "pressure_deviation": "pressure deviates from its recent rolling average",
    "temp_pressure_consistency": "temperature and pressure are moving inconsistently with each other",
    "humidity_saturation_flag": "humidity is outside the physically valid 0-100% range",
    "frozen_run_length": "sensor is repeating the exact same value over consecutive readings",
}


def _explain_row(row, feature_cols, top_n=3):
    """Fast, dependency-free explainability: ranks which engineered features
    are most 'unusual' for this row, turns that into a plain-English reason."""
    if row.get("is_missing", False):
        return "Reading is missing entirely, consistent with a communication error."
    if row.get("physical_range_flag", False):
        return "Reading falls outside physically possible sensor limits."

    scores = {}
    for f in feature_cols:
        if f in _READABLE and f in row:
            val = row[f]
            scores[f] = abs(val) if pd.notna(val) else 0.0

    top_feats = sorted(scores, key=scores.get, reverse=True)[:top_n]
    reasons = [_READABLE[f] for f in top_feats if scores[f] > 0]
    if not reasons:
        return "No single dominant signal; flagged due to a combined pattern across parameters."
    return "; ".join(reasons).capitalize() + "."


def _rule_based_fault_type(row):
    """Fallback root-cause labeler, used when no trained classifier is
    available (e.g. fault_type labels were too sparse to train on)."""
    if row.get("is_missing", False):
        return "Communication Error"
    if row.get("frozen_run_length", 0) >= 3:
        return "Frozen Sensor"
    if row.get("physical_range_flag", False) or row.get("humidity_saturation_flag", False):
        return "Physical Range Violation"
    rates = [abs(row.get("temperature_rate", 0) or 0),
             abs(row.get("humidity_rate", 0) or 0),
             abs(row.get("pressure_rate", 0) or 0)]
    if max(rates) > 5:
        return "Spike"
    if abs(row.get("temperature_deviation", 0) or 0) > 3:
        return "Drift"
    return "Unusual Pattern"


def detect_anomalies(df, model_dir=MODEL_DIR):
    """
    Main entry point. See module docstring for full input/output spec.
    """
    _load_models(model_dir)
    df = _add_extra_signals(df).reset_index(drop=True)

    feature_cols = _feature_config["isolation_forest_features"]
    for c in feature_cols:
        if c not in df.columns:
            df[c] = 0.0
    X = df[feature_cols].fillna(0.0)

    # ---- Core unsupervised detection ----
    raw_scores = _iso_forest.decision_function(X)   # higher = more normal
    iso_flag = _iso_forest.predict(X) == -1          # True = anomalous

    inverted = -raw_scores
    lo, hi = inverted.min(), inverted.max()
    anomaly_score = (inverted - lo) / (hi - lo) if hi > lo else np.zeros_like(inverted)

    # ---- Deterministic overrides for cases IsolationForest can't catch
    # well on its own (near-zero-variance frozen lines; absence of data) ----
    is_missing = df.get("is_missing", pd.Series(False, index=df.index)).fillna(False).astype(bool)
    physical_flag = df.get("physical_range_flag", pd.Series(False, index=df.index)).fillna(False).astype(bool)
    frozen_flag = df["frozen_run_length"] >= 3

    is_anomaly = iso_flag | is_missing.values | physical_flag.values | frozen_flag.values
    forced = is_missing.values | physical_flag.values | frozen_flag.values
    anomaly_score = np.where(forced, np.maximum(anomaly_score, 0.85), anomaly_score)

    def severity_bucket(score, anomalous):
        if not anomalous:
            return "none"
        if score >= 0.9:
            return "critical"
        if score >= 0.75:
            return "high"
        if score >= 0.55:
            return "medium"
        return "low"

    severity = [severity_bucket(s, a) for s, a in zip(anomaly_score, is_anomaly)]
    confidence = np.where(forced, 0.95, anomaly_score)

    # ---- Root cause ----
    root_cause = []
    if _root_cause_clf is not None:
        rc_features = _feature_config["root_cause_features"]
        for c in rc_features:
            if c not in df.columns:
                df[c] = 0.0
        X_rc = df[rc_features].fillna(0.0)
        preds = _root_cause_clf.predict(X_rc)
        labels = _fault_encoder.inverse_transform(preds)
        for i in range(len(df)):
            root_cause.append(labels[i] if is_anomaly[i] else "Normal")
    else:
        for i, row in df.iterrows():
            root_cause.append(_rule_based_fault_type(row) if is_anomaly[i] else "Normal")

    # ---- Explanation ----
    explanations = []
    for i, row in df.iterrows():
        explanations.append(
            _explain_row(row, feature_cols) if is_anomaly[i]
            else "Reading is within expected range for this station and time."
        )

    # ---- Suggested correction (rolling mean imputation) ----
    suggested_corrections = []
    for i, row in df.iterrows():
        if is_anomaly[i]:
            suggested_corrections.append({
                "temperature": round(float(row.get("temperature_rolling_mean", np.nan)), 2),
                "humidity": round(float(row.get("humidity_rolling_mean", np.nan)), 2),
                "pressure": round(float(row.get("pressure_rolling_mean", np.nan)), 2),
            })
        else:
            suggested_corrections.append(None)

    df["anomaly_score"] = np.round(anomaly_score, 4)
    df["is_anomaly"] = is_anomaly
    df["severity"] = severity
    df["confidence"] = np.round(confidence, 4)
    df["predicted_fault_type"] = root_cause
    df["explanation"] = explanations
    df["suggested_correction"] = suggested_corrections

    # ---- Sensor health status: rolling anomaly rate per station ----
    df["sensor_health_status"] = "healthy"
    for station, g in df.groupby("station_id"):
        rate = g["is_anomaly"].rolling(50, min_periods=5).mean()
        status = pd.cut(
            rate.fillna(0),
            bins=[-0.01, 0.1, 0.3, 1.0],
            labels=["healthy", "degrading", "faulty"],
        )
        df.loc[g.index, "sensor_health_status"] = status.astype(str).values

    return df


if __name__ == "__main__":
    import sys
    input_file = sys.argv[1] if len(sys.argv) > 1 else "data/feature_engineered_weather.csv"
    df = pd.read_csv(input_file)
    result = detect_anomalies(df)
    cols = ["timestamp", "station_id", "temperature", "humidity", "pressure",
            "is_anomaly", "severity", "confidence", "predicted_fault_type",
            "explanation", "sensor_health_status"]
    print(result[cols].head(20).to_string())
    result.to_csv("data/anomaly_results.csv", index=False)
    print("\nSaved data/anomaly_results.csv")
