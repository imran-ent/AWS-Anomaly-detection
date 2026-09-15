# Synthetic Anomalies — METEORA

**Labeled evaluation dataset:** `backend/data/weather_data1.csv`
**Size:** 842,160 rows (same as raw), same 29 stations, same hourly timestamps
**Ground truth columns:** `anomaly` (0=normal, 1=anomaly), `fault_type` (Normal, Spike, Drift, Frozen Sensor, Communication Error)
**Distribution:** 800,052 Normal (95%), 10,527 per fault type (each 1.25%, total 42,108 anomalies = 5%)

## How synthetic anomalies were injected (reproducible, seed 42)

The injected dataset was created by a deterministic Python script (not re-run in repo; documented for judges):

```python
import pandas as pd, numpy as np
np.random.seed(42)
df = pd.read_csv("weather_data.csv")  # raw clean
# Select 5% of rows stratified across stations
# Split equally into 4 fault types (n=10527 each)
```

1. **Spike (`fault_type=Spike`)**: temperature replaced with random outlier uniform:
   - 50% hot spike: `temp = np.random.uniform(45, 76)` (up to +30C above normal)
   - 50% cold spike: `temp = np.random.uniform(-25, 10)` (extreme drop)
   - Humidity/pressure kept original (tests univariate temperature spike)
   - Example: Bhopal AWS005 06-08-2022 04:00 temp 55.5°C vs normal ~26°C

2. **Drift (`fault_type=Drift`)**: gradual offset added over 5-hour windows:
   - Pick start row per station, then for next 5 hours: `temp += linspace(-4, +5) * drift_factor`
   - Also adjusts humidity/pressure consistently (e.g., humidity += drift, pressure -= drift*1.5)
   - Simulates sensor calibration drift
   - Example: Raipur AWS024 05-08-2022 03:00-07:00 temp drifted from 22.3→17.4 while humidity 99→100

3. **Sensor Stuck / Frozen Sensor (`fault_type=Frozen Sensor`)**: consecutive repetition:
   - For 5-7 consecutive hours per block: `temp, humidity, pressure` frozen to first value in block
   - All 3 values identical across 5+ rows → `frozen_run_length >=5`
   - Example: Raipur AWS024 05-08-2022 09:00-13:00 all rows 28.6°C, 75%, 1003.1 hPa

4. **Communication Error (`fault_type=Communication Error`)**: missing values:
   - Set `temperature in c, humidity in %, pressure = NaN` for 5-10 consecutive hours
   - Represents AWS telemetry dropout
   - Example: Ranchi AWS025 05-08-2022 05:00-09:00 all NaN

5. **Normal (`fault_type=Normal`, anomaly=0)**: untouched original hourly reading

All transformations:
- Used `np.random.seed(42)` fixed seed for reproducibility
- Preserved original `timestamp, City, Station_ID`
- Each anomaly row kept `original values` implicitly via normal rows; modified values are current values

## Fields present

```
timestamp, City, Station_ID, temperature in c, humidity in %, pressure, anomaly, fault_type
```

After `preprocess_data()`, these become:

```
timestamp, city, station_id, temperature, humidity, pressure, anomaly (GT), fault_type (GT), is_missing, physical_range_flag, *_scaled, ...
```

After `detect_anomalies()`, added (GT preserved in `ground_truth_anomaly` and `ground_truth_fault_type`):

```
anomaly_score [0,1] (per-batch normalized), is_anomaly (ML), severity, confidence, predicted_fault_type (ML), detection_type
```

## Important distinction (for judges)

- **Training data:** `weather_data.csv` (clean) used to train IsolationForest unsupervised (no labels needed)
- **Evaluation data:** `weather_data1.csv` (injected) used ONLY to measure Precision/Recall/F1 (never contaminated training)
- **Demo window:** last 300 rows per station (8,700 rows, ~12.5 days) from injected file → shows realistic mix of normal + injected anomalies

Ground truth `anomaly` is NEVER used by the model at inference; only for `GET /api/model/performance` evaluation.
