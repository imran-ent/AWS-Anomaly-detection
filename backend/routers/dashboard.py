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
    # Consistency check: high+medium+low should == anomalies (critical counted in high)
    # Note: severity 'critical' is subset of high, so high already includes critical
    # So high_raw + medium + low + critical? Actually high includes critical, so check:
    # total_anomalies = high_raw_without_critical? Use sev_counts directly
    # For validation, compute raw sum
    _raw_high = int(sev_counts.get("high", 0))
    _calc_total = _raw_high + critical + medium + low if critical > 0 else _raw_high + medium + low
    # But we treat high as including critical for display; for validation use raw counts
    # Simpler: sum all anomaly severities should equal anomalies
    if anomalies != sum(v for k, v in sev_counts.items() if k != "none"):
        print(f"[METEORA] WARNING severity sum mismatch: anomalies={anomalies} severity_sum={sum(v for k,v in sev_counts.items() if k!='none')} counts={sev_counts}")
    # Compute anomaliesToday as latest date's anomalies (single source of truth for graph)
    anomalies_today = 0
    latest_timestamp = None
    try:
        # timestamp column is datetime after preprocessing
        latest_ts = pd.to_datetime(df["timestamp"]).max()
        latest_timestamp = latest_ts.isoformat() if pd.notna(latest_ts) else None
        latest_date = latest_ts.date() if pd.notna(latest_ts) else None
        if latest_date is not None and "is_anomaly" in df.columns:
            # anomalies on latest date only
            date_only = pd.to_datetime(df["timestamp"]).dt.date
            anomalies_today = int(df[(date_only == latest_date) & (df["is_anomaly"] == True)].shape[0])
            # Also breakdown for today
            today_slice = df[(date_only == latest_date) & (df["is_anomaly"] == True)]
            if not today_slice.empty and "severity" in today_slice.columns:
                t_counts = today_slice["severity"].value_counts().to_dict()
                # log for consistency verification
                pass
            # Validate: latest day graph value should equal anomalies_today
            # This will be checked by frontend via /api/anomalies/trend last entry
        else:
            anomalies_today = anomalies  # fallback
    except Exception as e:
        print(f"[METEORA] anomaliesToday calc failed: {e}")
        anomalies_today = anomalies

    system_status = "Operational" if total_records > 0 else "Degraded"
    dataset_type = meta.get("type", "unknown")

    return {
        "totalRecords": total_records,
        "totalStations": unique_stations,
        "stationsOnline": unique_stations,  # same as totalStations since all stations have data in window
        "totalAnomalies": anomalies,
        "anomaliesDetected": anomalies,
        "totalAnomaliesInWindow": anomalies,
        "normalReadings": normal,
        "highSeverity": high,
        "criticalSeverity": critical,
        "mediumSeverity": medium,
        "lowSeverity": low,
        "severityDistribution": {"high": high, "critical": critical, "medium": medium, "low": low, "none": int(sev_counts.get("none", 0))},
        "anomaliesToday": anomalies_today,
        "anomaliesInWindow": anomalies,
        "activeAlerts": high + medium,  # high+medium require attention; low is info
        "latestTimestamp": latest_timestamp,
        "latestDate": str(latest_date) if 'latest_date' in locals() and latest_date else None,
        "systemStatus": system_status,
        "dataset": dataset_type,
        "datasetMeta": meta,
    }

@router.get("/api/dashboard/summary")
def dashboard_summary():
    # alias for frontend getDashboardSummary
    return dashboard()
