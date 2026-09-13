"""
Manual Sensor Anomaly Check — METEORA
Lets operators submit a single live sensor reading for a known station and
get truthful ML prediction using the *existing* pipeline.

Why historical context is required:
The trained IsolationForest expects 18 features including rolling mean/std,
deviation, rates, frozen_run_length etc.  Those are computed from
features.create_features() which groups by station_id and uses a 5-row
rolling window.  A lone row has NaN for all rate/rolling columns, so we
must prepend recent historical rows for that station, then treat the manual
input as the *latest* observation.  This keeps the feature generation
identical to training/inference.

Flow for manual input (e.g. AWS001, T=55, H=96, P=1000):
  raw tail (300 per station, 8700 rows, same as dashboard cache)
    + manual row (timestamp=now, City from station, Station_ID, raw sensor cols)
    ↓ preprocess_data()    (existing, same as team)
    ↓ create_features()    (existing, adds rolling/lag/time)
    ↓ detect_anomalies()   (existing IsolationForest + rules)
    → take last row for station_id → is_anomaly, anomaly_score, severity etc

We NEVER retrain the model.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import pandas as pd
from datetime import datetime
from pathlib import Path

router = APIRouter(tags=["manual"])


class ManualCheckRequest(BaseModel):
    station_id: str = Field(..., description="Station ID, e.g. AWS001")
    temperature: float = Field(..., description="Temperature in °C")
    humidity: float = Field(..., description="Humidity in %")
    pressure: float = Field(..., description="Pressure in hPa")


# --- helpers ---------------------------------------------------------------

def _get_data_path() -> Path:
    from services.data_service import DATA_PATH, INJECTED_PATH, CLEAN_PATH
    # DATA_PATH is already resolved to injected or clean
    return DATA_PATH


def _valid_stations() -> set:
    """Fast unique Station_ID set without loading full dataset."""
    path = _get_data_path()
    try:
        # pandas can read only one column quickly
        vals = pd.read_csv(path, usecols=["Station_ID"])["Station_ID"].unique()
        return set(str(v) for v in vals)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read station list: {e}")


def _station_city(station_id: str) -> str:
    path = _get_data_path()
    try:
        # read last occurrence of station to get City
        # small optimisation: tail per station may be needed, but reading single station is fine
        df = pd.read_csv(path, usecols=["Station_ID", "City"])
        sub = df[df["Station_ID"] == station_id]
        if not sub.empty:
            return str(sub.iloc[-1]["City"])
    except Exception:
        pass
    return station_id  # fallback


def _load_tail_plus_manual(station_id: str, temperature: float, humidity: float, pressure: float):
    """
    Load tail 300 per station (8700 rows) + append manual reading as latest.
    Returns combined raw DataFrame ready for preprocess_data().
    Materializes *exact* raw schema to avoid duplicate columns after rename.
    """
    from services.data_service import get_weather_data
    raw = get_weather_data()  # 842k rows, includes City, Station_ID, timestamp, etc.
    # Detect column names for tail grouping
    if "Station_ID" in raw.columns:
        tail = raw.groupby("Station_ID").tail(300).copy()
        city = _station_city(station_id)
        # Build manual row with exactly the same columns as raw (to avoid duplicate after rename_map)
        ts_val = datetime.now().isoformat(sep=" ", timespec="seconds")
        manual = {}
        # Match raw's timestamp column name
        if "timestamp" in raw.columns:
            manual["timestamp"] = ts_val
        elif "Datetime" in raw.columns:
            manual["Datetime"] = ts_val
        else:
            manual["timestamp"] = ts_val
        # Core raw columns — use names present in raw
        if "City" in raw.columns:
            manual["City"] = city
        if "Station_ID" in raw.columns:
            manual["Station_ID"] = station_id
        # Temperature column
        if "temperature in c" in raw.columns:
            manual["temperature in c"] = float(temperature)
        elif "Temp_2m_C" in raw.columns:
            manual["Temp_2m_C"] = float(temperature)
        else:
            # fallback normalized name (rare)
            manual["temperature"] = float(temperature)
        # Humidity
        if "humidity in %" in raw.columns:
            manual["humidity in %"] = float(humidity)
        elif "Humidity_Percent" in raw.columns:
            manual["Humidity_Percent"] = float(humidity)
        else:
            manual["humidity"] = float(humidity)
        # Pressure
        if "pressure" in raw.columns:
            manual["pressure"] = float(pressure)
        elif "Pressure_MSL_hPa" in raw.columns:
            manual["Pressure_MSL_hPa"] = float(pressure)
        else:
            manual["pressure"] = float(pressure)
        # Optional ground-truth cols if file has them (manual input has no ground truth)
        if "anomaly" in raw.columns:
            manual["anomaly"] = 0
        if "fault_type" in raw.columns:
            manual["fault_type"] = "Normal"

        tail = pd.concat([tail, pd.DataFrame([manual])], ignore_index=True)
        return tail, city
    else:
        # unknown schema — fallback tail 8700
        tail = raw.tail(8700).copy()
        city = _station_city(station_id)
        ts_val = datetime.now().isoformat(sep=" ", timespec="seconds")
        manual = {
            "timestamp": ts_val,
            "City": city,
            "Station_ID": station_id,
            "temperature in c": float(temperature),
            "humidity in %": float(humidity),
            "pressure": float(pressure),
        }
        if "anomaly" in raw.columns:
            manual["anomaly"] = 0
        if "fault_type" in raw.columns:
            manual["fault_type"] = "Normal"
        tail = pd.concat([tail, pd.DataFrame([manual])], ignore_index=True)
        return tail, city


# --- API endpoints ---------------------------------------------------------

@router.get("/api/manual/stations")
def list_manual_stations():
    """Dropdown source: actual unique Station_ID values from dataset."""
    path = _get_data_path()
    try:
        df = pd.read_csv(path, usecols=["Station_ID", "City"])
        uniq = df.drop_duplicates(subset=["Station_ID"]).sort_values("Station_ID")
        stations = [
            {"station_id": str(row["Station_ID"]), "city": str(row["City"])}
            for _, row in uniq.iterrows()
        ]
        return {"total": len(stations), "stations": stations}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list stations: {e}")


@router.get("/api/stations/list")
def stations_list_alias():
    """Alias for frontend convenience; same as /api/manual/stations."""
    return list_manual_stations()


def _run_manual_check(payload: ManualCheckRequest):
    station_id = str(payload.station_id).strip()
    if not station_id:
        raise HTTPException(status_code=400, detail="Station ID is required")

    # Validate Station_ID exists (backend must not trust frontend)
    valid = _valid_stations()
    if station_id not in valid:
        raise HTTPException(status_code=400, detail=f"Unsupported Station ID: {station_id}. Valid: {sorted(valid)[:5]}... ({len(valid)} total)")

    # Validate numerics (pydantic already checks type, but also check NaN)
    import math
    for name, val in [("temperature", payload.temperature), ("humidity", payload.humidity), ("pressure", payload.pressure)]:
        if val is None or (isinstance(val, float) and (math.isnan(val) or math.isinf(val))):
            raise HTTPException(status_code=400, detail=f"{name} must be a valid number")

    # Build combined frame with historical context
    try:
        combined_raw, city = _load_tail_plus_manual(
            station_id, float(payload.temperature), float(payload.humidity), float(payload.pressure)
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to prepare manual input: {e}")

    # Run existing pipeline: preprocessing → features → ML (NO retrain)
    try:
        from services.preprocessing import preprocess_data
        from services.features import create_features
        from services.ml_service import detect_anomalies
        df_p = preprocess_data(combined_raw)
        df_f = create_features(df_p)
        df_r = detect_anomalies(df_f)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"ML pipeline failed: {e}")

    # Extract the manual reading's result (last row for this station)
    try:
        sub = df_r[df_r["station_id"] == station_id]
        if sub.empty:
            raise HTTPException(status_code=500, detail="Pipeline produced no rows for requested station")
        # sort by timestamp ensures manual is last
        sub = sub.sort_values("timestamp")
        row = sub.iloc[-1]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to extract result: {e}")

    is_anom = bool(row.get("is_anomaly", False))
    # anomaly_score is relative per batch [0,1]
    score = row.get("anomaly_score", None)
    # Convert NaN to None for JSON
    if pd.isna(score):
        score = None
    else:
        try:
            score = round(float(score), 4)
        except:
            score = None

    # Build truthful response — distinguish ML prediction vs ground truth
    # Manual input has no ground truth fault_type, so we only return ML prediction.
    # If model is multivariate, explanation will say so; we do NOT falsely claim "temperature sensor faulty"
    predicted_fault = row.get("predicted_fault_type", "Normal")
    explanation = row.get("explanation", "")
    severity = row.get("severity", "none")
    confidence = row.get("confidence", None)
    if pd.isna(confidence):
        confidence = None
    else:
        try:
            confidence = round(float(confidence), 4)
        except:
            confidence = None
    # Suggested correction is truthful rolling-mean imputation if anomaly
    suggested = row.get("suggested_correction", None)
    # sanitize suggested (may contain NaN)
    if isinstance(suggested, dict):
        for k in list(suggested.keys()):
            v = suggested[k]
            if pd.isna(v):
                suggested[k] = None

    return {
        "success": True,
        "station_id": station_id,
        "city": city,
        "input": {
            "temperature": float(payload.temperature),
            "humidity": float(payload.humidity),
            "pressure": float(payload.pressure),
        },
        "prediction": {
            "status": "ANOMALY" if is_anom else "NORMAL",
            "is_anomaly": is_anom,
            "anomaly_score": score,
            "severity": severity,
            "confidence": confidence,
            "predicted_fault_type": predicted_fault,
            "explanation": explanation,
            "suggested_correction": suggested,
            "sensor_health_status": row.get("sensor_health_status", "unknown"),
        },
        "meta": {
            "dataset_type": "injected" if "anomaly" in combined_raw.columns else "clean",
            "historical_context_rows": int(len(combined_raw) - 1),
            "model": "IsolationForest + deterministic rules",
            "feature_count": 18,
            "note": "Anomaly is multivariate pattern unless explanation specifies single parameter; fault_type is ML prediction, not ground truth (manual input has no ground truth)",
        },
    }


@router.post("/api/manual-check")
def manual_check(payload: ManualCheckRequest):
    """Canonical endpoint per spec."""
    return _run_manual_check(payload)


@router.post("/api/manual/check")
def manual_check_alias(payload: ManualCheckRequest):
    """Alias for convenience."""
    return _run_manual_check(payload)
