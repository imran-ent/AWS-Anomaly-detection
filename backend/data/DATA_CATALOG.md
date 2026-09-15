# METEORA Data Catalog

| Role | File | Rows | Columns | Anomaly | Fault Types | Use |
|------|------|------|---------|---------|-------------|-----|
| **Raw / Base (Normal)** | `backend/data/weather_data.csv` | 842,160 | 6 | none | none | Training IsolationForest, baseline normal behavior |
| **Injected / Labeled Evaluation** | `backend/data/weather_data1.csv` | 842,160 | 8 | 0/1 (5% = 42,108) | Normal, Spike, Drift, Frozen Sensor, Communication Error (10,527 each) | Evaluation (Precision/Recall) + Demo window (last 300/station) |

```
backend/data/
  raw/                    -> points to weather_data.csv (see raw/README.md)
  processed/              -> ephemeral (see processed/README.md)
  synthetic_anomalies/    -> points to weather_data1.csv (see synthetic_anomalies/README.md)
  evaluation/             -> metrics computed on demand (see evaluation/README.md)
  weather_data.csv        <- canonical raw (do not delete)
  weather_data1.csv       <- canonical injected (active by default via DATA_PATH)
```

Active path: `services/data_service.py:DATA_PATH` prefers `weather_data1.csv` if present (injected), falls back to `weather_data.csv`.

Standardized schema after `preprocess_data()`:
```
timestamp (datetime), station_id (AWS001...), city, temperature, humidity, pressure,
is_missing (bool), physical_range_flag (bool),
temperature_scaled, humidity_scaled, pressure_scaled (z-score)
+ anomaly, fault_type if from injected
```

Feature-engineered schema adds:
```
hour, day, month, day_of_week, is_weekend, temperature_rate, humidity_rate, pressure_rate,
temperature_rolling_mean/std, humidity_rolling_mean/std, pressure_rolling_mean/std,
temperature_deviation, humidity_deviation, pressure_deviation,
temperature_abs_change, humidity_abs_change, pressure_abs_change,
temperature_humidity_ratio,
temp_pressure_consistency, humidity_saturation_flag, frozen_run_length (via anomaly_detection)
```

ML output adds:
```
anomaly_score [0,1] per-batch normalized, is_anomaly (bool), severity (none/low/medium/high/critical),
confidence, predicted_fault_type, explanation, suggested_correction, sensor_health_status,
detection_type (NORMAL/UNIVARIATE/MULTIVARIATE/SENSOR_STUCK/COMMUNICATION/PHYSICAL_RANGE),
univariate_param, ground_truth_anomaly/fault_type (if injected)
```

For judges: RAW -> pp -> features -> ML -> cache -> API -> Frontend is single source of truth.
