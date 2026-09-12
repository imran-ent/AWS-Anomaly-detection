from services.data_service import get_weather_data
from services.preprocessing import preprocess_data
from services.features import create_features
from services.ml_service import detect_anomalies


def run_detection_pipeline():

    # 1. Load
    df = get_weather_data()

    # 2. Clean
    df = preprocess_data(df)

    # 3. Features
    df = create_features(df)

    # 4. ML Detection
    df = detect_anomalies(df)

    return df