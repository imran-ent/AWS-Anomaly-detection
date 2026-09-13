from pathlib import Path
import pandas as pd
import os

# Resolve data paths relative to backend root, not cwd — works on Windows and Linux (Render)
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
# Primary: injected anomaly dataset (contains anomaly + fault_type ground truth)
# Fallback: clean base dataset
INJECTED_PATH = DATA_DIR / "weather_data1.csv"
CLEAN_PATH = DATA_DIR / "weather_data.csv"
# Allow override via env for deployment flexibility
ENV_PATH = os.getenv("METEORA_DATA_PATH")
if ENV_PATH:
    DATA_PATH = Path(ENV_PATH)
else:
    # Prefer injected dataset if it exists — this is the demo/evaluation dataset that
    # actually contains anomalies (Spike/Drift/Frozen/Communication Error). Clean dataset
    # remains as fallback if injected is missing.
    DATA_PATH = INJECTED_PATH if INJECTED_PATH.exists() else CLEAN_PATH


def get_active_dataset_info():
    """Return which dataset file is currently active (for /api/health and logging)."""
    exists = DATA_PATH.exists()
    has_injected_cols = False
    detected_type = "unknown"
    if exists:
        try:
            cols = pd.read_csv(DATA_PATH, nrows=0).columns.tolist()
            has_injected_cols = "anomaly" in cols and "fault_type" in cols
            detected_type = "injected" if has_injected_cols else "clean"
        except Exception:
            pass
    return {
        "active_path": str(DATA_PATH),
        "exists": exists,
        "type": detected_type,
        "has_ground_truth": has_injected_cols,
        "injected_exists": INJECTED_PATH.exists(),
        "clean_exists": CLEAN_PATH.exists(),
    }


def get_weather_data(limit=None):
    """
    Load raw weather data. limit optionally caps rows for faster API responses.
    Active path is injected dataset by default (weather_data1.csv).
    """
    if not DATA_PATH.exists():
        # try fallback explicitly
        fallback = INJECTED_PATH if DATA_PATH == CLEAN_PATH else CLEAN_PATH
        if fallback.exists():
            alt = fallback
        else:
            raise FileNotFoundError(f"Dataset not found at {DATA_PATH} (fallback {fallback} also missing)")
        # use fallback
        target = alt
    else:
        target = DATA_PATH
    if limit:
        df = pd.read_csv(target, nrows=limit)
    else:
        df = pd.read_csv(target)
    return df