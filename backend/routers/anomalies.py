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
    ft = str(row.get("predicted_fault_type", "")).lower()
    # map fault to parameter
    if "frozen" in ft:
        return "temperature"
    if "spike" in ft:
        # decide which param spiked most
        rates = {
            "temperature": abs(row.get("temperature_rate", 0) or 0),
            "humidity": abs(row.get("humidity_rate", 0) or 0),
            "pressure": abs(row.get("pressure_rate", 0) or 0),
        }
        return max(rates, key=rates.get) if max(rates.values())>0 else "temperature"
    if "physical" in ft or "saturation" in ft:
        return "humidity"
    if "communication" in ft:
        return "pressure"
    # default: pick largest deviation
    devs = {
        "temperature": abs(row.get("temperature_deviation", 0) or 0),
        "humidity": abs(row.get("humidity_deviation", 0) or 0),
        "pressure": abs(row.get("pressure_deviation", 0) or 0),
    }
    return max(devs, key=devs.get) if max(devs.values())>0 else "temperature"

@router.get("/api/anomalies")
def list_anomalies(station_id: str = Query(None), severity: str = Query(None), limit: int = Query(100, ge=1, le=1000)):
    df = _get_df()
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
    if severity and severity.lower() != "all":
        # backend severities are lower-case: critical/high/medium/low
        sev_lower = severity.lower()
        # map High -> critical/high
        if sev_lower == "high":
            anomalies = anomalies[anomalies["severity"].isin(["high", "critical"])]
        else:
            anomalies = anomalies[anomalies["severity"] == sev_lower]

    anomalies = anomalies.sort_values("timestamp", ascending=False).head(limit)

    result = []
    for idx, row in anomalies.iterrows():
        param = _param_from_fault(row)
        # anomaly_value is the value of that param
        val = row.get(param, row.get("temperature"))
        # expected range: use rolling mean +- 2*std
        mean_col = f"{param}_rolling_mean"
        std_col = f"{param}_rolling_std"
        mean_val = row.get(mean_col)
        std_val = row.get(std_col)
        if pd.notna(mean_val) and pd.notna(std_val) and std_val not in (0, None):
            lo = round(float(mean_val - 2*std_val), 1)
            hi = round(float(mean_val + 2*std_val), 1)
            expected_range = f"{lo}-{hi}"
        else:
            # fallback static ranges
            fallbacks = {"temperature": "15-38", "humidity": "30-85", "pressure": "990-1025", "rainfall": "0-20", "wind_speed": "0-25"}
            expected_range = fallbacks.get(param, "N/A")
        severity_title = _severity_map(row.get("severity"))
        ts = row["timestamp"].isoformat() if pd.notna(row["timestamp"]) else None
        result.append({
            "id": f"ANO{idx:04d}",
            "station_id": row["station_id"],
            "parameter": param,
            "anomaly_value": round(float(val), 1) if pd.notna(val) else None,
            "expected_range": expected_range,
            "severity": severity_title,
            "severity_raw": row.get("severity"),
            "timestamp": ts,
            "time": ts,
            "description": row.get("explanation", "") or row.get("predicted_fault_type", ""),
            "explanation": row.get("explanation", ""),
            "predicted_fault_type": row.get("predicted_fault_type", ""),
            "anomaly_score": float(row.get("anomaly_score", 0)) if pd.notna(row.get("anomaly_score")) else 0,
            "confidence": float(row.get("confidence", 0)) if "confidence" in row and pd.notna(row.get("confidence")) else None,
            "temperature": round(float(row.get("temperature", 0)),1) if pd.notna(row.get("temperature")) else None,
            "humidity": round(float(row.get("humidity",0)),1) if pd.notna(row.get("humidity")) else None,
            "pressure": round(float(row.get("pressure",0)),1) if pd.notna(row.get("pressure")) else None,
            "sensor_health_status": row.get("sensor_health_status", "unknown"),
        })
    return result

@router.get("/api/alerts")
def list_alerts(severity: str = Query(None), limit: int = Query(100, ge=1, le=500)):
    # Alerts are derived from anomalies with high/medium severity
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
        # Build alert message from explanation
        expl = row.get("explanation", "") or row.get("predicted_fault_type", "Anomaly detected")
        temp = row.get("temperature")
        hum = row.get("humidity")
        press = row.get("pressure")
        if severity_title == "High":
            prefix = "CRITICAL:"
        elif severity_title == "Medium":
            prefix = "WARNING:"
        else:
            prefix = "INFO:"
        msg = f"{prefix} {expl} at {row['station_id']} — Temp {temp}°C, Humidity {hum}%, Pressure {press} hPa."
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
    if severity and severity.lower() != "all":
        alerts = [a for a in alerts if a["severity"].lower() == severity.lower()]
    return alerts

@router.get("/api/anomalies/trend")
def anomaly_trend(days: int = Query(7, ge=1, le=30)):
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
