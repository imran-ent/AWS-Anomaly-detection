from fastapi import APIRouter
from services.pipeline import run_detection_pipeline

router = APIRouter()


@router.get("/api/dashboard")
def dashboard():

    df = run_detection_pipeline()

    total_records = len(df)

    anomalies = len(
        df[
            df["status"] == "ANOMALY"
        ]
    )

    normal = total_records - anomalies

    return {

        "totalRecords":
        total_records,

        "normalReadings":
        normal,

        "anomaliesDetected":
        anomalies
    }