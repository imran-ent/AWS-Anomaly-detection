from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from services.data_service import get_weather_data
from services.preprocessing import preprocess_data
from services.pipeline import run_detection_pipeline
from routers.dashboard import router as dashboard_router

app = FastAPI(
    title="METEORA API",
    description="AI/ML Weather Station Anomaly Detection"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {
        "message": "METEORA Backend Running"
    }
@app.get("/api/health")
def health():
    return {
        "status": "healthy",
        "service": "METEORA Backend"
    }
@app.get("/api/weather")
def weather():

    df = get_weather_data()

    return df.tail(20).to_dict(
        orient="records"
    )
@app.get("/api/weather/clean")

def clean_weather():

    df = get_weather_data()

    cleaned_df = preprocess_data(df)

    return cleaned_df.tail(20).to_dict(
        orient="records"
    )
@app.get("/api/detect")
def detect():

    df = run_detection_pipeline()

    return df.tail(50).to_dict(
        orient="records"
    )
@app.get("/api/anomalies")
def anomalies():

    df = run_detection_pipeline()

    anomalies = df[
        df["status"] == "ANOMALY"
    ]

    return anomalies.to_dict(
        orient="records"
    )
app.include_router(
    dashboard_router
)