"""
Evaluation service — computes ML performance on synthetic labeled test data.
Uses ground_truth columns (anomaly/fault_type from injected dataset), NOT ml predictions.
"""
from pathlib import Path
import pandas as pd
import numpy as np

def compute_evaluation(df: pd.DataFrame):
    """
    Expects df after detect_anomalies with preserved GT:
      - ground_truth_anomaly OR anomaly (GT)
      - fault_type OR ground_truth_fault_type (GT)
      - is_anomaly / ml_is_anomaly (ML prediction)
      - severity, anomaly_score, detection_type

    Returns dict with precision, recall, F1, confusion matrix, per-fault recall, counts.
    If no GT present (clean dataset), returns has_ground_truth=False.
    """
    # Check for GT
    gt_col = None
    if "ground_truth_anomaly" in df.columns:
        gt_col = "ground_truth_anomaly"
    elif "anomaly" in df.columns and "is_anomaly" in df.columns:
        # anomaly may be GT if preserved; check if its distribution differs from is_anomaly
        # For injected dataset, anomaly is GT (0/1) and is_anomaly is ML bool
        # For clean, they are same (ml alias). Use fault_type to disambiguate
        if "fault_type" in df.columns and "ground_truth_fault_type" in df.columns:
            gt_col = "ground_truth_anomaly"
        elif "fault_type" in df.columns:
            # Check if fault_type has variety beyond Normal -> injected
            unique_faults = df["fault_type"].dropna().unique()
            has_injected = any(x in ["Spike","Drift","Frozen Sensor","Communication Error"] for x in unique_faults)
            if has_injected:
                gt_col = "anomaly"  # anomaly is GT in this case (preserved)
            else:
                gt_col = None
        else:
            gt_col = None
    # Fallback: if df has 'anomaly' and 'ground_truth_anomaly' not present but ml_is_anomaly exists, then anomaly is GT
    if gt_col is None and "anomaly" in df.columns and "ml_is_anomaly" in df.columns:
        gt_col = "anomaly"
    elif gt_col is None and "anomaly" in df.columns and "ground_truth_anomaly" not in df.columns:
        # Check for injected via fault_type
        if "fault_type" in df.columns:
            vals = df["fault_type"].dropna().unique().tolist()
            if any(v != "Normal" for v in vals):
                gt_col = "anomaly"

    if gt_col is None or gt_col not in df.columns:
        return {
            "has_ground_truth": False,
            "message": "No ground truth (anomaly) column found — running on clean dataset, evaluation not applicable.",
            "dataset_type": "clean",
        }

    try:
        from sklearn.metrics import precision_score, recall_score, f1_score, confusion_matrix, classification_report
        y_true = df[gt_col].astype(int).fillna(0).values
        # ML prediction
        if "ml_is_anomaly" in df.columns:
            y_pred = df["ml_is_anomaly"].astype(bool).astype(int).values
        elif "is_anomaly" in df.columns:
            y_pred = df["is_anomaly"].astype(bool).astype(int).values
        else:
            return {"has_ground_truth": False, "message": "No ML prediction column found"}

        # Handle case where all GT are same (edge)
        support_anom = int((y_true == 1).sum())
        support_norm = int((y_true == 0).sum())
        total = len(y_true)

        # Compute with zero_division=0
        precision = float(precision_score(y_true, y_pred, zero_division=0))
        recall = float(recall_score(y_true, y_pred, zero_division=0))
        f1 = float(f1_score(y_true, y_pred, zero_division=0))

        cm = confusion_matrix(y_true, y_pred, labels=[0,1])
        # cm is [[TN, FP], [FN, TP]]
        tn, fp, fn, tp = int(cm[0,0]), int(cm[0,1]), int(cm[1,0]), int(cm[1,1])

        # Per-fault-type recall (only for GT anomalies)
        fault_col = "ground_truth_fault_type" if "ground_truth_fault_type" in df.columns else "fault_type"
        per_fault = {}
        if fault_col in df.columns:
            for ft in df[fault_col].dropna().unique():
                if ft == "Normal":
                    continue
                mask = df[fault_col] == ft
                if mask.sum() == 0:
                    continue
                y_true_ft = y_true[mask.values] if hasattr(mask, 'values') else y_true[mask]
                y_pred_ft = y_pred[mask.values] if hasattr(mask, 'values') else y_pred[mask]
                # Recall for this fault type: detected / total of this type (all are anomalies, so TP rate)
                detected = int(y_pred_ft.sum())
                total_ft = int(mask.sum())
                recall_ft = float(detected / total_ft) if total_ft > 0 else 0.0
                per_fault[str(ft)] = {"total": total_ft, "detected": detected, "recall": round(recall_ft, 3)}

        # Normal false positive rate
        normal_mask = df[fault_col] == "Normal" if fault_col in df.columns else (y_true == 0)
        # If fault_col not reliable, fallback to y_true
        if fault_col in df.columns and (df[fault_col] == "Normal").sum() > 0:
            normal_total = int((df[fault_col] == "Normal").sum())
            normal_fp = int(y_pred[df[fault_col] == "Normal"].sum())
        else:
            normal_total = int((y_true == 0).sum())
            # FP among normal GT
            normal_fp = int(((y_true == 0) & (y_pred == 1)).sum())
        fpr = float(normal_fp / normal_total) if normal_total > 0 else 0.0

        # Anomaly score stats
        score_stats = {}
        if "anomaly_score" in df.columns:
            scores = df["anomaly_score"].dropna()
            if len(scores) > 0:
                score_stats = {
                    "mean": round(float(scores.mean()), 4),
                    "std": round(float(scores.std()), 4),
                    "min": round(float(scores.min()), 4),
                    "max": round(float(scores.max()), 4),
                    "median": round(float(scores.median()), 4),
                }
            anom_scores = df[df["ml_is_anomaly"] == True]["anomaly_score"].dropna() if "ml_is_anomaly" in df.columns else df[df["is_anomaly"]==True]["anomaly_score"].dropna()
            if len(anom_scores) > 0:
                score_stats["anomaly_mean"] = round(float(anom_scores.mean()),4)
                score_stats["anomaly_median"] = round(float(anom_scores.median()),4)

        report = classification_report(y_true, y_pred, digits=3, output_dict=True, zero_division=0)

        return {
            "has_ground_truth": True,
            "dataset_type": "injected",
            "total_records": total,
            "ground_truth": {
                "normal": support_norm,
                "anomaly": support_anom,
                "anomaly_rate": round(support_anom / total, 4) if total > 0 else 0,
            },
            "ml_detection": {
                "predicted_normal": int((y_pred == 0).sum()),
                "predicted_anomaly": int((y_pred == 1).sum()),
                "predicted_anomaly_rate": round(float((y_pred==1).mean()),4),
            },
            "metrics": {
                "precision": round(precision, 3),
                "recall": round(recall, 3),
                "f1": round(f1, 3),
                "fpr_normal": round(fpr, 4),
                "accuracy": round(float((y_true == y_pred).mean()), 4),
            },
            "confusion_matrix": {
                "tn": tn, "fp": fp, "fn": fn, "tp": tp,
                "matrix": [[tn, fp],[fn, tp]],
                "labels": ["0=Normal","1=Anomaly"]
            },
            "per_fault_recall": per_fault,
            "normal_false_positives": {"fp": normal_fp, "total_normal": normal_total, "fpr": round(fpr,4)},
            "score_stats": score_stats,
            "classification_report": report,
            "note": "Evaluation on Synthetic Labeled Test Data (last 300/station window, injected anomalies). NOT production accuracy.",
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"has_ground_truth": False, "error": str(e), "message": f"Evaluation failed: {e}"}

def compute_data_quality(df_raw_sample=None, df_processed=None, df_raw_full_info=None):
    """
    Computes data quality metrics from raw vs processed.
    df_processed is the cached DF after preprocess (has is_missing, physical_range_flag etc)
    df_raw_sample is the same window before preprocess (for missing/duplicate calc)
    """
    try:
        from services.data_service import get_active_dataset_info
        import pandas as pd
        from pathlib import Path
        from services.data_service import DATA_PATH

        # Use processed DF for counts
        if df_processed is None:
            from routers.dashboard import _get_df
            df_processed = _get_df()
            # Also get raw tail for quality calc
            from services.data_service import get_weather_data
            raw = get_weather_data()
            if "Station_ID" in raw.columns:
                df_raw_sample = raw.groupby("Station_ID").tail(300)
            else:
                df_raw_sample = raw.tail(8700)

        total_processed = len(df_processed)
        total_raw_window = len(df_raw_sample) if df_raw_sample is not None else total_processed

        # Missing in raw sample (before preprocess)
        missing_raw = 0
        if df_raw_sample is not None:
            # Count rows where any of temp/hum/pressure is NaN (using raw column names)
            cols = []
            for c in ["Temp_2m_C", "temperature in c", "temperature", "Humidity_Percent", "humidity in %", "humidity", "Pressure_MSL_hPa", "pressure"]:
                if c in df_raw_sample.columns:
                    cols.append(c)
            # Alternatively count NaN in those cols
            if cols:
                # Group cols by param: temp variants, hum variants, press variants
                temp_cols = [c for c in cols if "temp" in c.lower()]
                hum_cols = [c for c in cols if "humid" in c.lower()]
                press_cols = [c for c in cols if "press" in c.lower()]
                # Use the actual cols present in raw_sample: they are Temp_2m_C style OR temperature in c style
                # For injected file: temperature in c, humidity in %, pressure
                check_cols = []
                if "temperature in c" in df_raw_sample.columns:
                    check_cols.extend(["temperature in c", "humidity in %", "pressure"])
                elif "Temp_2m_C" in df_raw_sample.columns:
                    check_cols.extend(["Temp_2m_C", "Humidity_Percent", "Pressure_MSL_hPa"])
                elif "temperature" in df_raw_sample.columns:
                    check_cols.extend(["temperature", "humidity", "pressure"])
                if check_cols:
                    missing_raw = int(df_raw_sample[check_cols].isna().any(axis=1).sum())
                else:
                    missing_raw = int(df_raw_sample.isna().any(axis=1).sum())

        # From processed flags (ground truth)
        is_missing_processed = int(df_processed["is_missing"].sum()) if "is_missing" in df_processed.columns else missing_raw
        physical_flag = int(df_processed["physical_range_flag"].sum()) if "physical_range_flag" in df_processed.columns else 0
        duplicate_handled = total_raw_window - total_processed  # approximate if dedup removed rows; but current cache doesn't drop many
        # For full dataset info
        full_rows = 842160  # known
        try:
            info = get_active_dataset_info()
            if info.get("active_path"):
                p = Path(info["active_path"])
                if p.exists():
                    # Could count but known
                    pass
        except:
            info = {}

        valid = total_processed - is_missing_processed - physical_flag
        # Station counts
        stations = int(df_processed["station_id"].nunique()) if "station_id" in df_processed.columns else 0

        return {
            "window": {
                "raw_window_rows": total_raw_window,
                "processed_rows": total_processed,
                "missing_values": is_missing_processed,
                "missing_rate": round(is_missing_processed / total_processed, 4) if total_processed else 0,
                "physical_range_violations": physical_flag,
                "valid_records": valid,
                "valid_rate": round(valid / total_processed, 4) if total_processed else 0,
                "stations_in_window": stations,
            },
            "full_dataset": {
                "total_rows": 842160,
                "total_stations": 29,
                "anomaly_rate_injected": 0.05,
                "injected_anomalies": 42108,
                "normal": 800052,
                "note": "Full dataset is 842,160 hourly rows across 29 stations (5 Aug 2022 onward, injected file). Window is last 300/station (8,700 rows) for API latency.",
            },
            "quality_flags": {
                "is_missing": "bool flag per row (any of temp/hum/press is NaN) — Communication Error",
                "physical_range_flag": "bool flag per row (temp -60..60, hum 0..100, press 850..1100)",
                "duplicates_removed": "exact duplicates + station_id+timestamp duplicates keep first (in preprocess_data)",
            },
            "dataset_info": info,
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e)}
