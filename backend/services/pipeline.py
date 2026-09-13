from services.data_service import get_weather_data
from services.preprocessing import preprocess_data
from services.features import create_features
from services.ml_service import detect_anomalies


def run_detection_pipeline(limit=None, sample_tail=None):
    """
    End-to-end pipeline: LOAD -> PREPROCESS -> FEATURES -> ML DETECT
    limit: optionally limit raw rows for speed (e.g., 50000)
    sample_tail: if set, return only last N rows (for API efficiency)
    """

    # 1. Load
    df = get_weather_data(limit=limit) if limit else get_weather_data()

    # 2. Clean
    df = preprocess_data(df)

    # 3. Features
    df = create_features(df)

    # 4. ML Detection
    df = detect_anomalies(df)

    if sample_tail:
        df = df.tail(sample_tail)

    return df