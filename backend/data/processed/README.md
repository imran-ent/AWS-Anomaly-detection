# Processed Data — METEORA

Derived from raw via `backend/preprocessing.py::preprocess_data()` + `backend/features.py::create_features()`

**Not stored as static CSV** for repo size reasons; generated on demand via pipeline:
```
raw CSV -> preprocess_data() -> create_features() -> detect_anomalies() -> cached DF (~8,700 rows: last 300 per station)
```

Steps (see `preprocessing.py:5`):
1. Column standardization (handles City/Station_ID/Datetime/Temp_2m_C etc)
2. Numeric coercion (invalid strings -> NaN)
3. Timestamp parsing (dayfirst, mixed), sorting station_id+timestamp
4. Deduplication (exact + station_id+timestamp keep first)
5. Missing flag (`is_missing`)
6. Physical range flag (`physical_range_flag`): temp -60..60, humidity 0..100, pressure 850..1100
7. Z-score scaling (`*_scaled`, NaN filled 0)

Feature engineering (`features.py:create_features`):
hour, day, month, day_of_week, is_weekend, temperature/humidity/pressure_rate, rolling mean/std (window 5), deviation, abs_change, temperature_humidity_ratio
+ extra signals in `anomaly_detection._add_extra_signals`: temp_pressure_consistency, humidity_saturation_flag, frozen_run_length

Output: `timestamp, station_id, city, temperature, humidity, pressure, is_missing, physical_range_flag, *_scaled, <features>, anomaly_score, is_anomaly, severity, ...`

Processed data is ephemeral (in-memory cache); persisted only for debugging via `GET /api/weather/clean`.
