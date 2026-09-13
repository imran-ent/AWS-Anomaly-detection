import os
import pandas as pd

# Resolve data path relative to backend root, not cwd
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(BASE_DIR, "data", "weather_data.csv")


def get_weather_data(limit=None):
    """
    Load raw weather data. limit optionally caps rows for faster API responses.
    """
    if not os.path.exists(DATA_PATH):
        raise FileNotFoundError(f"Dataset not found at {DATA_PATH}")
    if limit:
        df = pd.read_csv(DATA_PATH, nrows=limit)
    else:
        df = pd.read_csv(DATA_PATH)
    return df