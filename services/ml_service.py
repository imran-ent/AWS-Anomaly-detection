import joblib
import pandas as pd

model = joblib.load(
    "models/anomaly_model.joblib"
)


def detect_anomalies(df):

    features = df[
        [
            "temperature",
            "humidity",
            "pressure"
        ]
    ]

    predictions = model.predict(features)

    df["anomaly"] = predictions

    return df