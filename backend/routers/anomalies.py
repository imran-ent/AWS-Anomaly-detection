from fastapi import APIRouter, Query
from routers.dashboard import _get_df
from services.station_meta import synth_rainfall, synth_wind
import pandas as pd
from datetime import datetime, timedelta

router = APIRouter()

def _severity_map(s):
    # normalize lower-case backend severity to Title-Case frontend
    m = {"critical": "High", "high": "High", "medium": "Medium", "low": "Low", "none": "Low"}
    return m.get(str(s).lower(), "Low")

def _param_from_fault(row):
    """
    Truthful parameter mapping - NOW uses detection_type from ML pipeline as primary source.
    - UNIVARIATE -> return the actual violating param (univariate_param)
    - MULTIVARIATE -> multivariate pattern
    - SENSOR_STUCK / COMMUNICATION / PHYSICAL_RANGE -> respective types
    Fallback to old heuristic if detection_type not present (backward compat).
    """
    dt = str(row.get("detection_type", "")).upper()
    if dt in ("MULTIVARIATE", "SENSOR_STUCK", "COMMUNICATION", "PHYSICAL_RANGE"):
        # These are all multivariate/special - not single param anomaly
        if dt == "SENSOR_STUCK":
            return "multivariate"
        if dt == "COMMUNICATION":
            return "multivariate"
        if dt == "PHYSICAL_RANGE":
            # physical range often humidity but treat as univariate humidity for clarity
            # keep as humidity if needed, but spec says distinguish
            return "humidity"
        return "multivariate"
    if dt == "UNIVARIATE":
        param = row.get("univariate_param")
        if param in ("temperature", "humidity", "pressure"):
            return param
        # fallback: pick largest deviation
        devs = {
            "temperature": abs(row.get("temperature_deviation", 0) or 0),
            "humidity": abs(row.get("humidity_deviation", 0) or 0),
            "pressure": abs(row.get("pressure_deviation", 0) or 0),
        }
        return max(devs, key=devs.get) if max(devs.values()) > 0 else "multivariate"
    # Fallback old heuristic for backward compat if detection_type missing
    ft = str(row.get("predicted_fault_type", "")).lower()
    if "communication" in ft:
        return "multivariate"
    if "frozen" in ft:
        devs = {
            "temperature": abs(row.get("temperature_deviation", 0) or 0),
            "humidity": abs(row.get("humidity_deviation", 0) or 0),
            "pressure": abs(row.get("pressure_deviation", 0) or 0),
        }
        if max(devs.values()) > 1:
            return max(devs, key=devs.get)
        return "multivariate"
    if "spike" in ft:
        rates = {
            "temperature": abs(row.get("temperature_rate", 0) or 0),
            "humidity": abs(row.get("humidity_rate", 0) or 0),
            "pressure": abs(row.get("pressure_rate", 0) or 0),
        }
        return max(rates, key=rates.get) if max(rates.values()) > 0 else "multivariate"
    if "physical" in ft or "saturation" in ft:
        return "humidity"
    devs = {
        "temperature": abs(row.get("temperature_deviation", 0) or 0),
        "humidity": abs(row.get("humidity_deviation", 0) or 0),
        "pressure": abs(row.get("pressure_deviation", 0) or 0),
    }
    max_dev = max(devs.values()) if devs else 0
    if max_dev < 1.0:
        return "multivariate"
    return max(devs, key=devs.get) if max_dev > 0 else "multivariate"

@router.get("/api/anomalies")
def list_anomalies(station_id: str = Query(None), severity: str = Query(None), limit: int = Query(100, ge=1, le=1000)):
    df = _get_df()
    # unwrap Query defaults when called directly (e.g., in tests) — isinstance check
    if station_id is not None and not isinstance(station_id, str):
        try: station_id = station_id.default  # type: ignore
        except: station_id = None
    if severity is not None and not isinstance(severity, str):
        try: severity = severity.default  # type: ignore
        except: severity = None
    # FastAPI Query objects for limit have .default; handle int unwrap
    if not isinstance(limit, int):
        try: limit = int(limit.default)  # type: ignore
        except: limit = 100
    # total count before pagination (for frontend to show "Showing X of Y")
    total_anomalies = int(df["is_anomaly"].sum()) if "is_anomaly" in df.columns else 0
    # filter anomalies only
    if "is_anomaly" in df.columns:
        anomalies = df[df["is_anomaly"] == True].copy()
    elif "status" in df.columns:
        anomalies = df[df["status"] == "ANOMALY"].copy()
    else:
        anomalies = df.iloc[0:0].copy()

    if station_id:
        anomalies = anomalies[anomalies["station_id"] == station_id]
    # severity filter (frontend uses High/Medium/Low)
    if severity and isinstance(severity, str) and severity.lower() != "all":
        sev_lower = severity.lower()
        if sev_lower == "high":
            anomalies = anomalies[anomalies["severity"].isin(["high", "critical"])]
        else:
            anomalies = anomalies[anomalies["severity"] == sev_lower]

    filtered_total = len(anomalies)
    anomalies = anomalies.sort_values("timestamp", ascending=False).head(limit)

    result = []
    for idx, row in anomalies.iterrows():
        param = _param_from_fault(row)
        detection_type = str(row.get("detection_type", "UNKNOWN")).upper()
        # For MULTIVARIATE / SENSOR_STUCK / COMMUNICATION: do NOT show misleading univariate range
        is_multivariate = detection_type in ("MULTIVARIATE", "SENSOR_STUCK", "COMMUNICATION")
        if is_multivariate:
            # Spec: Parameter: Multivariate Pattern, Value: N/A, Expected Range: N/A — Multivariate Detection
            expected_range = "N/A — Multivariate Detection"
            is_inside = None
            val = None
            # Keep param as multivariate for display
            display_param = "multivariate"
            # For SENSOR_STUCK/COMM show specific detection basis
            if detection_type == "SENSOR_STUCK":
                expected_range = "N/A — Sensor Stuck (frozen values)"
            elif detection_type == "COMMUNICATION":
                expected_range = "N/A — Communication Error (missing data)"
        else:
            # UNIVARIATE or PHYSICAL_RANGE: show actual param's value and its own rolling range
            if param == "multivariate":
                # fallback: if detection says UNIVARIATE but param still multivariate, treat as multivariate
                expected_range = "N/A — Multivariate Detection"
                is_inside = None
                val = None
                display_param = "multivariate"
            else:
                val = row.get(param, row.get("temperature"))
                display_param = param
                mean_col = f"{display_param}_rolling_mean"
                std_col = f"{display_param}_rolling_std"
                mean_val = row.get(mean_col)
                std_val = row.get(std_col)
                is_inside = None
                if pd.notna(mean_val) and pd.notna(std_val) and std_val not in (0, None):
                    lo = round(float(mean_val - 2*std_val), 1)
                    hi = round(float(mean_val + 2*std_val), 1)
                    expected_range = f"{lo} - {hi}"
                    if pd.notna(val):
                        try:
                            is_inside = lo <= float(val) <= hi
                        except:
                            is_inside = None
                    # Invariant: UNIVARIATE must be outside range; if inside, something wrong - fallback to multivariate
                    if is_inside is True:
                        # This would be contradictory - reclassify display as multivariate
                        # But we keep UNIVARIATE param but log warning
                        print(f"[METEORA] WARNING UNIVARIATE {param} value {val} inside range {expected_range} at {row.get('timestamp')} station {row.get('station_id')} - should be MULTIVARIATE")
                else:
                    fallbacks = {"temperature": "15 - 38", "humidity": "30 - 85", "pressure": "990 - 1025"}
                    expected_range = fallbacks.get(display_param, "N/A")
        severity_title = _severity_map(row.get("severity"))
        ts = row["timestamp"].isoformat() if pd.notna(row["timestamp"]) else None
        # Ground Truth vs ML Prediction - separate display
        # Injected dataset has 'anomaly' (0/1) and 'fault_type' (Normal, Spike, etc)
        gt_anom_raw = row.get("anomaly", None)
        gt_is_anomaly = None
        gt_label = None
        if pd.notna(gt_anom_raw):
            try:
                gt_is_anomaly = bool(int(gt_anom_raw) == 1)
                gt_label = "Anomaly" if gt_is_anomaly else "Normal"
            except:
                gt_is_anomaly = None
        elif "anomaly" in row and row["anomaly"] is not None:
            gt_is_anomaly = bool(row["anomaly"])
            gt_label = "Anomaly" if gt_is_anomaly else "Normal"
        # If anomaly column missing, mark Not Available
        if gt_is_anomaly is None and pd.isna(gt_anom_raw):
            gt_label_display = "Not Available"
        else:
            gt_label_display = gt_label

        ground_fault = row.get("fault_type", None)
        if pd.isna(ground_fault):
            ground_fault = None
        # Also handle case where GT says Normal but ML says HIGH - keep both visible for judge comparison
        ml_is_anomaly = bool(row.get("is_anomaly", False))
        result.append({
            "id": f"ANO{idx:04d}",
            "station_id": row["station_id"],
            "parameter": param,
            "display_parameter": display_param if 'display_param' in locals() else param,
            "anomaly_value": round(float(val), 1) if val is not None and pd.notna(val) else None,
            "expected_range": expected_range,
            "is_inside_expected_range": is_inside,
            "detection_type": detection_type,
            "univariate_param": row.get("univariate_param"),
            "severity": severity_title,
            "severity_raw": row.get("severity"),
            "timestamp": ts,
            "time": ts,
            "description": row.get("explanation", "") or row.get("predicted_fault_type", ""),
            "explanation": row.get("explanation", ""),
            "predicted_fault_type": row.get("predicted_fault_type", ""),
            # Separate GT vs ML for judge transparency
            "ground_truth_is_anomaly": gt_is_anomaly,
            "ground_truth_label": gt_label_display,
            "ground_truth_fault_type": ground_fault,
            "ml_is_anomaly": ml_is_anomaly,
            "ml_label": "Anomaly" if ml_is_anomaly else "Normal",
            "anomaly_score": float(row.get("anomaly_score", 0)) if pd.notna(row.get("anomaly_score")) else 0,
            "confidence": float(row.get("confidence", 0)) if "confidence" in row and pd.notna(row.get("confidence")) else None,
            "temperature": round(float(row.get("temperature", 0)),1) if pd.notna(row.get("temperature")) else None,
            "humidity": round(float(row.get("humidity",0)),1) if pd.notna(row.get("humidity")) else None,
            "pressure": round(float(row.get("pressure",0)),1) if pd.notna(row.get("pressure")) else None,
            "sensor_health_status": row.get("sensor_health_status", "unknown"),
        })
    # Return with pagination metadata header via response is not available here; frontend can fetch dashboard for total
    # For now, also expose totals in a wrapper if client checks? Keep list for backward compat, but add header via extra endpoint
    return result

@router.get("/api/alerts")
def list_alerts(severity: str = Query(None), limit: int = Query(100, ge=1, le=500)):
    # Alerts are derived from anomalies with high/medium severity
    if severity is not None and not isinstance(severity, str):
        try: severity = severity.default  # type: ignore
        except: severity = None
    if not isinstance(limit, int):
        try: limit = int(limit.default)  # type: ignore
        except: limit = 100
    df = _get_df()
    if "is_anomaly" in df.columns:
        anomalies = df[df["is_anomaly"] == True].copy()
    else:
        anomalies = df.iloc[0:0].copy()
    # Only high/critical and medium produce alerts; low also but mark as read true?
    anomalies = anomalies[anomalies["severity"].isin(["high","critical","medium","low"])]
    anomalies = anomalies.sort_values("timestamp", ascending=False).head(limit)
    alerts = []
    for idx, row in anomalies.sort_values("timestamp", ascending=False).iterrows():
        param = _param_from_fault(row)
        severity_title = _severity_map(row.get("severity"))
        is_high = severity_title == "High"
        # Determine read: low severity assumed read, high unread (for demo)
        read = severity_title == "Low"
        ts = row["timestamp"].isoformat() if pd.notna(row["timestamp"]) else None
        # Build alert message from explanation — handle NaN for Communication Error
        expl = row.get("explanation", "") or row.get("predicted_fault_type", "Anomaly detected")
        def fmt(v, suffix=""):
            if pd.isna(v):
                return "N/A"
            try:
                return f"{round(float(v),1)}{suffix}"
            except:
                return str(v)
        temp = fmt(row.get("temperature"), "°C")
        hum = fmt(row.get("humidity"), "%")
        press = fmt(row.get("pressure"), " hPa")
        if severity_title == "High":
            prefix = "CRITICAL:"
        elif severity_title == "Medium":
            prefix = "WARNING:"
        else:
            prefix = "INFO:"
        msg = f"{prefix} {expl} at {row['station_id']} — Temp {temp}, Humidity {hum}, Pressure {press}."
        alerts.append({
            "id": f"ALT{idx:04d}",
            "station_id": row["station_id"],
            "alert_message": msg,
            "message": msg,
            "severity": severity_title,
            "parameter": param,
            "read": read,
            "timestamp": ts,
            "anomaly_score": float(row.get("anomaly_score", 0)) if pd.notna(row.get("anomaly_score")) else 0,
        })
    if severity and isinstance(severity, str) and severity.lower() != "all":
        alerts = [a for a in alerts if a["severity"].lower() == severity.lower()]
    return alerts

@router.get("/api/anomalies/trend")
def anomaly_trend(days: int = Query(7, ge=1, le=30)):
    if not isinstance(days, int):
        try: days = int(days.default)  # type: ignore
        except: days = 7
    df = _get_df()
    if "is_anomaly" not in df.columns:
        return []
    anomalies = df[df["is_anomaly"] == True].copy()
    if anomalies.empty:
        # return zeros
        return [{"date": (datetime.now() - timedelta(days=i)).strftime("%b %d"), "anomalies": 0, "high": 0, "medium": 0, "low": 0} for i in reversed(range(days))]
    # Group by date
    anomalies["date_only"] = pd.to_datetime(anomalies["timestamp"]).dt.date
    # Get last N days
    max_date = anomalies["date_only"].max()
    dates = [max_date - timedelta(days=i) for i in reversed(range(days))]
    trend = []
    for d in dates:
        day_slice = anomalies[anomalies["date_only"] == d]
        total = len(day_slice)
        high = len(day_slice[day_slice["severity"].isin(["high","critical"])])
        medium = len(day_slice[day_slice["severity"] == "medium"])
        low = len(day_slice[day_slice["severity"] == "low"])
        trend.append({
            "date": d.strftime("%b %d"),
            "anomalies": total,
            "high": high,
            "medium": medium,
            "low": low,
        })
    return trend

@router.get("/api/history")
def all_history(limit: int = Query(100, ge=1, le=1000)):
    if not isinstance(limit, int):
        try: limit = int(limit.default)  # type: ignore
        except: limit = 100
    df = _get_df()
    # return recent history across all stations (tail)
    recent = df.sort_values("timestamp").tail(limit)
    out = []
    for _, row in recent.iterrows():
        out.append({
            "station_id": row["station_id"],
            "timestamp": row["timestamp"].isoformat() if pd.notna(row["timestamp"]) else None,
            "temperature": round(float(row.get("temperature",0)),1) if pd.notna(row.get("temperature")) else None,
            "humidity": round(float(row.get("humidity",0)),1) if pd.notna(row.get("humidity")) else None,
            "pressure": round(float(row.get("pressure",0)),1) if pd.notna(row.get("pressure")) else None,
            "is_anomaly": bool(row.get("is_anomaly", False)),
            "severity": row.get("severity", "none"),
        })
    return out
