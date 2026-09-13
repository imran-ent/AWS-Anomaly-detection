from pathlib import Path
import pandas as pd

# Resolve data path relative to backend root, not cwd — works on Windows and Linux (Render)
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_PATH = BASE_DIR / "data" / "weather_data.csv"


def get_weather_data(limit=None):
    """
    Load raw weather data. limit optionally caps rows for faster API responses.
    """
    if not DATA_PATH.exists():
        raise FileNotFoundError(f"Dataset not found at {DATA_PATH}")
    if limit:
        df = pd.read_csv(DATA_PATH, nrows=limit)
    else:
        df = pd.read_csv(DATA_PATH)
    return df