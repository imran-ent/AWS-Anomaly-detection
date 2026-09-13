from fastapi import APIRouter
from services.pipeline import run_detection_pipeline
import pandas as pd
import threading

router = APIRouter()

# Simple in-memory cache (5 min) — thread-safe to avoid parallel heavy ML runs
# that would block uvicorn's threadpool and cause ERR_CONNECTION_RESET.
_CACHE = {"df": None, "ts": 0}
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
        import pandas as pd
        from services.data_service import get_weather_data
        from services.preprocessing import preprocess_data
        from services.features import create_features
        from services.ml_service import detect_anomalies
        raw = get_weather_data()
        tail_per_station = raw.groupby("Station_ID").tail(300) if "Station_ID" in raw.columns else raw.tail(8700)
        df = preprocess_data(tail_per_station)
        df = create_features(df)
        df = detect_anomalies(df)
        _CACHE["df"] = df
        _CACHE["ts"] = now
        return df

@router.get("/api/dashboard")
def dashboard():
    try:
        df = _get_df()
    except Exception as e:
        return {"error": str(e), "totalRecords": 0, "normalReadings": 0, "anomaliesDetected": 0}
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
    # severity breakdown
    sev_counts = {}
    if "severity" in df.columns:
        sev_counts = df[df["is_anomaly"]]["severity"].value_counts().to_dict() if "is_anomaly" in df.columns else {}
    high = int(sev_counts.get("high", 0) + sev_counts.get("critical", 0))
    medium = int(sev_counts.get("medium", 0))
    low = int(sev_counts.get("low", 0))

    return {
        "totalRecords": total_records,
        "totalStations": unique_stations,
        "normalReadings": normal,
        "anomaliesDetected": anomalies,
        "highSeverity": high,
        "mediumSeverity": medium,
        "lowSeverity": low,
        # aliases for frontend Dashboard.jsx which expects slightly different keys
        "anomaliesToday": anomalies,
        "activeAlerts": high + medium,  # treat high+medium as active
        "systemStatus": "Operational",
    }

@router.get("/api/dashboard/summary")
def dashboard_summary():
    # alias for frontend getDashboardSummary
    return dashboard()
