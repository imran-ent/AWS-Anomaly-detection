from fastapi import APIRouter, HTTPException, Query
from services.station_meta import get_station_meta, synth_rainfall, synth_wind, synth_wind_dir
import pandas as pd
import time

router = APIRouter()

# Reuse dashboard cache if available
from routers.dashboard import _get_df

def _latest_per_station(df):
    # df already has timestamp sorted; get last row per station
    df_sorted = df.sort_values(["station_id", "timestamp"])
    latest = df_sorted.groupby("station_id").tail(1)
    return latest

@router.get("/api/stations")
def list_stations():
    df = _get_df()
    latest = _latest_per_station(df)
    stations = []
    for _, row in latest.iterrows():
        sid = row["station_id"]
        city = row.get("city", None)
        # city may be NaN after preprocessing scaling; fallback
        if pd.isna(city) or not city:
            city = sid
        meta = get_station_meta(sid, city if isinstance(city, str) else None)
        # synthetic fields
        rainfall = synth_rainfall(row)
        wind_speed = synth_wind(row)
        is_anom = bool(row.get("is_anomaly", False))
        stations.append({
            "station_id": sid,
            "location": meta["location"],
            "city": meta["city"],
            "state": meta["state"],
            "latitude": meta["latitude"],
            "longitude": meta["longitude"],
            "elevation": meta["elevation"],
            "temperature": round(float(row.get("temperature", 0)), 1) if pd.notna(row.get("temperature")) else None,
            "humidity": round(float(row.get("humidity", 0)), 1) if pd.notna(row.get("humidity")) else None,
            "pressure": round(float(row.get("pressure", 0)), 1) if pd.notna(row.get("pressure")) else None,
            "rainfall": rainfall,
            "wind_speed": wind_speed,
            "wind_direction": synth_wind_dir(sid),
            "anomaly_status": is_anom,
            "is_anomaly": is_anom,
            "severity": row.get("severity", "none"),
            "anomaly_score": float(row.get("anomaly_score", 0)) if pd.notna(row.get("anomaly_score")) else 0,
            "predicted_fault_type": row.get("predicted_fault_type", "Normal"),
            "sensor_health_status": row.get("sensor_health_status", "healthy"),
            "timestamp": row["timestamp"].isoformat() if pd.notna(row["timestamp"]) else None,
        })
    # sort by station_id
    stations.sort(key=lambda x: x["station_id"])
    return stations

@router.get("/api/stations/{station_id}")
def get_station(station_id: str):
    df = _get_df()
    # filter for this station
    sub = df[df["station_id"] == station_id]
    if sub.empty:
        raise HTTPException(status_code=404, detail=f"Station {station_id} not found")
    latest = sub.sort_values("timestamp").iloc[-1]
    city = latest.get("city", None)
    if pd.isna(city) or not city or not isinstance(city, str):
        city = station_id
    meta = get_station_meta(station_id, city)
    rainfall = synth_rainfall(latest)
    wind_speed = synth_wind(latest)
    return {
        "station_id": station_id,
        "location": meta["location"],
        "city": meta["city"],
        "state": meta["state"],
        "latitude": meta["latitude"],
        "longitude": meta["longitude"],
        "elevation": meta["elevation"],
        "temperature": round(float(latest.get("temperature", 0)), 1) if pd.notna(latest.get("temperature")) else None,
        "humidity": round(float(latest.get("humidity", 0)), 1) if pd.notna(latest.get("humidity")) else None,
        "pressure": round(float(latest.get("pressure", 0)), 1) if pd.notna(latest.get("pressure")) else None,
        "rainfall": rainfall,
        "wind_speed": wind_speed,
        "wind_direction": synth_wind_dir(station_id),
        "anomaly_status": bool(latest.get("is_anomaly", False)),
        "is_anomaly": bool(latest.get("is_anomaly", False)),
        "severity": latest.get("severity", "none"),
        "anomaly_score": float(latest.get("anomaly_score", 0)) if pd.notna(latest.get("anomaly_score")) else 0,
        "predicted_fault_type": latest.get("predicted_fault_type", "Normal"),
        "explanation": latest.get("explanation", ""),
        "sensor_health_status": latest.get("sensor_health_status", "healthy"),
        "timestamp": latest["timestamp"].isoformat() if pd.notna(latest["timestamp"]) else None,
    }

@router.get("/api/stations/{station_id}/history")
def station_history(station_id: str, hours: int = Query(24, ge=1, le=720)):
    df = _get_df()
    sub = df[df["station_id"] == station_id]
    if sub.empty:
        raise HTTPException(status_code=404, detail=f"Station {station_id} not found")
    # take last N rows; hours corresponds to rows since hourly data
    sub_sorted = sub.sort_values("timestamp").tail(hours)
    history = []
    for _, row in sub_sorted.iterrows():
        history.append({
            "time": row["timestamp"].isoformat() if pd.notna(row["timestamp"]) else None,
            "timestamp": row["timestamp"].isoformat() if pd.notna(row["timestamp"]) else None,
            "temperature": round(float(row.get("temperature", 0)), 1) if pd.notna(row.get("temperature")) else None,
            "humidity": round(float(row.get("humidity", 0)), 1) if pd.notna(row.get("humidity")) else None,
            "pressure": round(float(row.get("pressure", 0)), 1) if pd.notna(row.get("pressure")) else None,
            "rainfall": synth_rainfall(row),
            "wind_speed": synth_wind(row),
            "is_anomaly": bool(row.get("is_anomaly", False)),
            "severity": row.get("severity", "none"),
            "anomaly_score": float(row.get("anomaly_score", 0)) if pd.notna(row.get("anomaly_score")) else 0,
        })
    return history
