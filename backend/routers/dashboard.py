from fastapi import APIRouter
from services.pipeline import run_detection_pipeline
import pandas as pd
import threading

router = APIRouter()

# Simple in-memory cache (5 min) — thread-safe to avoid parallel heavy ML runs
# that would block uvicorn's threadpool and cause ERR_CONNECTION_RESET.
_CACHE = {"df": None, "ts": 0, "meta": {}}
_CACHE_LOCK = threading.Lock()
import time

def _get_df():
    # Fast path without lock
    now = time.time()
    if _CACHE["df"] is not None and now - _CACHE["ts"] <= 300:
        return _CACHE["df"]
    with _CACHE_LOCK:
        # Double-check after acquiring lock
        now = time.time()
        if _CACHE["df"] is not None and now - _CACHE["ts"] <= 300:
            return _CACHE["df"]
        # Use last 300 per station => ~8700 rows, fast and recent
        # Centralized pipeline is the single source of truth for all routers
        import pandas as pd
        from services.data_service import get_weather_data, get_active_dataset_info
        from services.preprocessing import preprocess_data
        from services.features import create_features
        from services.ml_service import detect_anomalies
        raw = get_weather_data()
        # Handle both original column naming (Station_ID) and already-normalized (station_id)
        if "Station_ID" in raw.columns:
            tail_per_station = raw.groupby("Station_ID").tail(300)
        elif "station_id" in raw.columns:
            tail_per_station = raw.groupby("station_id").tail(300)
        else:
            tail_per_station = raw.tail(8700)
        df = preprocess_data(tail_per_station)
        df = create_features(df)
        df = detect_anomalies(df)
        _CACHE["df"] = df
        _CACHE["ts"] = now
        try:
            _CACHE["meta"] = get_active_dataset_info()
        except Exception:
            _CACHE["meta"] = {}
        return df

def get_processed_results():
    """Centralized accessor for the cached processed DataFrame + meta (single source of truth)."""
    df = _get_df()
    return df, _CACHE.get("meta", {})

def clear_cache():
    with _CACHE_LOCK:
        _CACHE["df"] = None
        _CACHE["ts"] = 0
        _CACHE["meta"] = {}

@router.get("/api/dashboard")
def dashboard():
    try:
        df = _get_df()
        meta = _CACHE.get("meta", {})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e), "totalRecords": 0, "normalReadings": 0, "anomaliesDetected": 0, "totalStations": 0, "systemStatus": "Degraded"}
    total_records = len(df)
    # support both new (is_anomaly) and legacy (status) columns
    if "is_anomaly" in df.columns:
        anomalies = int(df["is_anomaly"].sum())
    elif "status" in df.columns:
        anomalies = int((df["status"] == "ANOMALY").sum())
    else:
        anomalies = 0
    normal = total_records - anomalies
    unique_stations = int(df["station_id"].nunique()) if "station_id" in df.columns else 0
    # severity breakdown — use actual ML output
    sev_counts = {}
    if "severity" in df.columns and "is_anomaly" in df.columns:
        sev_counts = df[df["is_anomaly"]]["severity"].value_counts().to_dict()
    high = int(sev_counts.get("high", 0) + sev_counts.get("critical", 0))
    critical = int(sev_counts.get("critical", 0))
    medium = int(sev_counts.get("medium", 0))
    low = int(sev_counts.get("low", 0))
    # system status reflects whether pipeline succeeded
    system_status = "Operational" if total_records > 0 else "Degraded"
    # If active dataset has ground truth, expose it for transparency (not used for counting)
    dataset_type = meta.get("type", "unknown")

    return {
        "totalRecords": total_records,
        "totalStations": unique_stations,
        "normalReadings": normal,
        "anomaliesDetected": anomalies,
        "totalAnomalies": anomalies,  # canonical key for frontend clarity
        "highSeverity": high,
        "criticalSeverity": critical,
        "mediumSeverity": medium,
        "lowSeverity": low,
        "severityDistribution": {"high": high, "critical": critical, "medium": medium, "low": low, "none": int(sev_counts.get("none", 0))},
        # aliases for frontend Dashboard.jsx which expects slightly different keys
        "anomaliesToday": anomalies,
        "anomaliesInWindow": anomalies,
        "activeAlerts": high + medium,  # high+medium require attention; low is info
        "systemStatus": system_status,
        "dataset": dataset_type,
        "datasetMeta": meta,
    }

@router.get("/api/dashboard/summary")
def dashboard_summary():
    # alias for frontend getDashboardSummary
    return dashboard()
