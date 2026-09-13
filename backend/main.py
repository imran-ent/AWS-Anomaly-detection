from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
import pandas as pd
import numpy as np
import math
import threading

from services.data_service import get_weather_data
from services.preprocessing import preprocess_data
from services.pipeline import run_detection_pipeline
from routers.dashboard import router as dashboard_router
from routers.stations import router as stations_router
from routers.anomalies import router as anomalies_router
from routers.manual import router as manual_router

app = FastAPI(
    title="METEORA API",
    description="AI/ML Weather Station Anomaly Detection — SIH 2026",
    version="2.0.0",
)

# CORS for frontend — keep centralized; allow both localhost and 127.0.0.1 (vite uses 5173)
# Use explicit origins for dev; regex covers both hostname variants and any localhost port.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        # Local development
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:3000",

        # Production frontend
        "https://aws-anomaly-detection-two.vercel.app",
        "https://aws-anomaly-detection-nvlljyqsw-imran-ents-projects.vercel.app",
        "https://aws-anomaly-detection-72xs.onrender.com",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app|http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def _sanitize_records(df: pd.DataFrame, tail: int = None):
    """Convert DataFrame to JSON-safe records: handle NaN, Timestamp, numpy types."""
    # Work on a copy to avoid mutating the cached DataFrame (prevents h11 Content-Length race)
    if tail:
        df = df.tail(tail).copy()
    else:
        df = df.copy()
    # Replace NaN/inf with None for JSON
    df = df.replace([np.inf, -np.inf], np.nan)
    # Convert timestamps to ISO strings
    for col in df.columns:
        if pd.api.types.is_datetime64_any_dtype(df[col]):
            df[col] = df[col].apply(lambda x: x.isoformat() if pd.notna(x) else None)
    records = df.to_dict(orient="records")
    # Further sanitize each value
    safe = []
    for rec in records:
        s = {}
        for k, v in rec.items():
            if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                s[k] = None
            elif isinstance(v, (np.integer,)):
                s[k] = int(v)
            elif isinstance(v, (np.floating,)):
                s[k] = float(v) if not math.isnan(float(v)) else None
            elif isinstance(v, (pd.Timestamp,)):
                s[k] = v.isoformat()
            elif isinstance(v, (np.bool_,)):
                s[k] = bool(v)
            else:
                s[k] = v
        safe.append(s)
    return safe

@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    # Avoid 404 noise when browser requests /favicon.ico from backend origin.
    # 204 must have no body, so use plain Response (JSONResponse with content=None would send 'null' and cause h11 Content-Length error).
    return Response(status_code=204)

@app.get("/")
def home():
    return {"message": "METEORA Backend Running", "docs": "/docs", "health": "/api/health"}

@app.get("/api/health")
def health():
    try:
        from services.data_service import get_active_dataset_info
        from pathlib import Path
        dataset_info = get_active_dataset_info()
    except Exception as e:
        dataset_info = {"error": str(e)}
    # Check model file
    from pathlib import Path as _P
    base = _P(__file__).resolve().parent
    model_candidates = [
        base / "models" / "isolation_forest.joblib",
        base / "AI_ML Anomaly Detection" / "models" / "isolation_forest.joblib",
        base / "AI_ML Anomaly Detection" / "isolation_forest.joblib",
    ]
    model_found = any(p.exists() for p in model_candidates)
    # Try pipeline status
    pipeline_status = "unknown"
    pipeline_error = None
    try:
        from routers.dashboard import _get_df
        df = _get_df()
        pipeline_status = "ready"
    except Exception as e:
        pipeline_status = "error"
        pipeline_error = str(e)
    return {
        "status": "healthy" if pipeline_status == "ready" else "degraded",
        "service": "METEORA Backend",
        "version": "2.0.0",
        "dataset": dataset_info,
        "model_found": model_found,
        "model_paths_checked": [str(p) for p in model_candidates],
        "pipeline": pipeline_status,
        "pipeline_error": pipeline_error,
    }

@app.get("/api/weather")
def weather(limit: int = Query(20, ge=1, le=1000)):
    try:
        df = get_weather_data()
        return _sanitize_records(df, tail=limit)
    except FileNotFoundError as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Weather load failed: {e}"})

@app.get("/api/weather/clean")
def clean_weather(limit: int = Query(20, ge=1, le=1000)):
    try:
        df = get_weather_data()
        # use last 1000 per station for meaningful scaling? but for clean endpoint just tail raw then clean
        # to keep scaling stable, take tail per station
        if "Station_ID" in df.columns:
            df = df.groupby("Station_ID").tail(500)
        cleaned_df = preprocess_data(df)
        return _sanitize_records(cleaned_df, tail=limit)
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Cleaning failed: {e}"})

@app.get("/api/detect")
def detect(limit: int = Query(50, ge=1, le=500)):
    try:
        # Use cached pipeline via dashboard helper for speed
        from routers.dashboard import _get_df
        df = _get_df()
        return _sanitize_records(df, tail=limit)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": f"Detection failed: {e}"})

@app.get("/api/anomalies-legacy")
def anomalies_legacy(limit: int = Query(50, ge=1, le=500)):
    """Legacy endpoint kept for compatibility; new canonical is /api/anomalies via anomalies router"""
    try:
        from routers.dashboard import _get_df
        df = _get_df()
        if "is_anomaly" in df.columns:
            anomalies = df[df["is_anomaly"] == True]
        elif "status" in df.columns:
            anomalies = df[df["status"] == "ANOMALY"]
        else:
            anomalies = df.iloc[0:0]
        return _sanitize_records(anomalies, tail=limit)
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

# Startup warm-up: pre-compute ML cache so first concurrent frontend requests don't all block on cold 3-4s compute
# Without this, 4 parallel fetches (dashboard+stations+alerts+trend) would queue on _CACHE_LOCK and timeout.
@app.on_event("startup")
def warm_cache():
    def _warm():
        try:
            from routers.dashboard import _get_df
            _get_df()
            print("[METEORA] cache warmed successfully")
        except Exception as e:
            print(f"[METEORA] cache warm failed: {e}")
    # Run in daemon thread so startup doesn't block (uvicorn startup must return quickly)
    threading.Thread(target=_warm, daemon=True).start()

# Include routers (dashboard, stations, anomalies, manual)
app.include_router(dashboard_router)
app.include_router(stations_router)
app.include_router(anomalies_router)
app.include_router(manual_router)
