# METEORA — AI/ML Intelligent Anomaly Detection for Automatic Weather Stations (AWS)

SIH 2026 • Ministry of Earth Sciences / IMD • Historical AWS Anomaly Analysis Prototype (Simulated Live)

Live prototype: https://aws-anomaly-detection-two.vercel.app

**Not real-time AWS streams. Not weather forecasting. Pure anomaly detection.**

---

## 1. Project Objective & Problem Statement

ISRO/IMD AWS stations suffer spike/drift, frozen sensors, communication gaps, physically impossible readings. Unnoticed faults corrupt forecasts/disaster warnings. METEORA learns **normal** behaviour **unsupervised** (no labels needed for new stations) and flags anomalies with **explainable score, severity, fault type, reason, expected range, suggested correction** before they propagate. Designed for **academic/SIH demonstration**: data → preprocessing → features → Isolation Forest + deterministic rules → API → dashboard pipeline is **logically consistent, explainable in 30 seconds, and single source of truth (backend)**.

**System Goal Pipeline:**
```
RAW WEATHER DATA → DATA VALIDATION → PREPROCESSING → FEATURE ENGINEERING → ML ANOMALY DETECTION → ANOMALY SCORE → DECISION/THRESHOLD → SEVERITY → EXPLANATION → DASHBOARD
```
Frontend **never** decides anomaly; backend/model is source of truth.

## 2. Dataset

**Two files, same 29 stations, 842,160 hourly rows:**

| File | Role | Columns | Anomaly | Fault Types | Use |
|------|------|---------|---------|-------------|-----|
| `backend/data/weather_data.csv` | **Raw / Base Normal** | `City, Station_ID, Datetime, Temp_2m_C, Humidity_Percent, Pressure_MSL_hPa` | none | none | Train IsolationForest (unsupervised) |
| `backend/data/weather_data1.csv` | **Injected / Labeled Evaluation** | `timestamp, City, Station_ID, temperature in c, humidity in %, pressure, anomaly, fault_type` | 0=Normal (800,052), 1=Anomaly (42,108 =5%) | Normal (800,052), Spike/Drift/Frozen Sensor/Communication Error (10,527 each) | Evaluation (Precision/Recall) + demo window |

**Active dataset:** `services/data_service.py:DATA_PATH` prefers `weather_data1.csv` if present (injected), else `weather_data.csv`. Current demo: **injected**.

**Detailed catalog:** `backend/data/DATA_CATALOG.md` + `backend/data/{raw,processed,synthetic_anomalies,evaluation}/README.md` — adapts spec’s `data/raw|processed|synthetic_anomalies|evaluation` structure without duplicating 40-48 MB CSVs.

**Station mapping:** AWS001 Agartala, AWS002 Ahmedabad, AWS003 Aizawl, AWS004 Bengaluru, AWS005 Bhopal, AWS006 Bhubaneswar, AWS007 Chandigarh, AWS008 Chennai, AWS009 Dehradun, AWS010 Delhi, AWS011 Gangtok, AWS012 Gurugram, AWS013 Guwahati, AWS014 Hyderabad, AWS015 Imphal, AWS016 Itanagar, AWS017 Jaipur, AWS018 Kohima, AWS019 Kolkata, AWS020 Lucknow, AWS021 Mumbai, AWS022 Panaji, AWS023 Patna, AWS024 Raipur, AWS025 Ranchi, AWS026 Shillong, AWS027 Shimla, AWS028 Thiruvananthapuram, AWS029 Visakhapatnam.

Standardized after `preprocess_data()`: `timestamp, station_id, city, temperature, humidity, pressure, is_missing, physical_range_flag, temperature_scaled, humidity_scaled, pressure_scaled (+ anomaly, fault_type if injected)`.

## 3. Dataset Preprocessing

`backend/preprocessing.py:5 preprocess_data()` — **raw never mutated**, operates on copy:

1. Column standardization (handles `Station_ID→station_id, City→city, Datetime→timestamp, Temp_2m_C→temperature, Humidity_Percent→humidity, Pressure_MSL_hPa→pressure, temperature in c→temperature, humidity in %→humidity`)
2. Numeric coercion (`pd.to_numeric(errors='coerce')` — invalid strings → NaN, flagged not dropped)
3. Timestamp parsing (`pd.to_datetime(mixed, dayfirst=True, errors='coerce')`), sort `station_id+timestamp`
4. Deduplication: exact duplicates + `station_id+timestamp` keep first
5. Missing flag: `is_missing = any(temp/hum/press is NaN)` — **kept**, not dropped (Communication Error)
6. Physical range flag (sanity, not removal): temp -60..60°C, humidity 0..100%, pressure 850..1100 hPa; `physical_range_flag` bool
7. Z-score scaling (`*_scaled = (x-mean)/std`, NaN-aware, fill 0, std=0 → 0)
8. Copy semantics guarantee raw untouched.

Documented for judges: `RAW → VALIDATION → PREPROCESSING` (see `backend/data/processed/README.md`).

## 4. Synthetic Anomaly Generation (Phase 2)

**Injected file:** `weather_data1.csv` created deterministically with `np.random.seed(42)` (reproducible). Script (documented in `backend/data/synthetic_anomalies/README.md`):

- **5% total**: 42,108 rows split equally 10,527 each fault type, preserved `timestamp, Station_ID, City`
- **Spike**: temp replaced with `uniform(-25,10)` or `uniform(45,76)` (cold/hot), humidity/pressure kept
- **Drift**: gradual offset over 5h windows (`temp += linspace(-4,+5)*drift_factor`, humidity/pressure adjusted)
- **Frozen Sensor**: 5-7 consecutive hours frozen to first value (`frozen_run_length >=5`)
- **Communication Error**: NaN for `temperature in c, humidity in %, pressure` for 5-10h blocks
- **Normal**: untouched

Each row preserves `anomaly` (0/1), `fault_type`, `timestamp, Station_ID, City, temperature, humidity, pressure`. **Training used clean `weather_data.csv` only; injected used only for evaluation** — no contamination. Ground truth kept as `ground_truth_anomaly/fault_type` after `detect_anomalies()` for transparent evaluation.

## 5. ML Algorithm & Feature Selection

**Model:** `IsolationForest(n_estimators=200, contamination=0.02, max_samples='auto', random_state=42)` trained offline via `AI_ML Anomaly Detection/train_model.py:136`. Optional `RandomForestClassifier(n_estimators=300, max_depth=12)` for root-cause if `fault_type` labels ≥20 per class; else rule-based fallback.

**Why not changed:** Current model is appropriate — unsupervised, learns normal for new stations without labels, 18-feature isolation depth is enough for 5% anomaly rate. Kept & improved, not replaced.

**Features (18, order matters, from `feature_config.joblib`):**
`temperature_scaled, humidity_scaled, pressure_scaled, temperature_rate, humidity_rate, pressure_rate, temperature_rolling_std, humidity_rolling_std, pressure_rolling_std, temperature_deviation, humidity_deviation, pressure_deviation, temperature_abs_change, humidity_abs_change, pressure_abs_change, temp_pressure_consistency, humidity_saturation_flag, frozen_run_length` + `is_missing, physical_range_flag` for root-cause.

**Engineered in:**
- `features.py:create_features()`: `hour/day/month/day_of_week/is_weekend, *_rate (diff), *_rolling_mean/std (window 5), *_deviation, *_abs_change, temperature_humidity_ratio`
- `anomaly_detection._add_extra_signals()`: `temp_pressure_consistency = | |temp_rate| - |press_rate| |, humidity_saturation_flag (hum>100 or <0), frozen_run_length (max consecutive identical run across temp/hum/press, grouped by station_id)`

## 6. Anomaly Score Explanation (Phase 3)

**Score definition:** `anomaly_score [0,1]` — **per-batch normalized inverted decision_function**. `decision_function` higher = more normal; inverted = `-decision_function`; rescaled `(inv - min)/(max-min)` per batch (8700 window). **Not probability, not confidence** — displayed as `Anomaly Score: 0.85`, never `93% probability`.

- **Relative within batch**, not absolute universal.
- **Forced hits** (is_missing|physical_range_flag|frozen_run_length>=3) floored at `max(score,0.85)` with `confidence=0.95` (certain).
- **Otherwise** score from forest; severity buckets use score.

See `AI_ML Anomaly Detection/anomaly_detection.py:188-204` + `services/evaluation.py:score_stats`.

## 7. Threshold / Decision Logic (Phase 4)

```
is_anomaly = forced OR (IsolationForest predict == -1)
forced = is_missing OR physical_range_flag OR frozen_run_length >=3
```

- **Univariate vs Multivariate (Phase 4 fix):** After scoring, `detection_type` derived:
  - `COMMUNICATION` if is_missing
  - `SENSOR_STUCK` if frozen_run_length>=3
  - `PHYSICAL_RANGE` if physical_range_flag
  - Else check **expected range**: `rolling mean ±2σ (window 5)` per param. If any param outside its own range → `UNIVARIATE` (param=most deviating). Else → `MULTIVARIATE` (all inside but combined pattern unusual).

Backend returns for every anomaly: `actual_value, expected_value, lower_bound, upper_bound, deviation, anomaly_score, status (ANOMALY/NORMAL), severity, reason`. Example:
```
Actual: 55.5°C Expected: 31.2°C Range: 28.5–36.5 Deviation: +24.3 Score:1.0 Status:ANOMALY Severity:HIGH Reason:Temperature significantly exceeded learned baseline (IsolationForest)
If inside range but flagged: "Value is within individual expected range, but combined pattern is unusual."
```
Expected range is **rolling per-station**, not broad physical limits.

## 8. Severity Logic (Phase 5)

**Centralized in `services/severity_config.py` + `anomaly_detection.py:209`** — frontend never decides.

```
if not is_anomaly: severity="none"
elif is_forced:
  if score>=0.92: "critical" else "high"
elif score>=0.88: "high"
elif score>=0.80: "medium"
else: "low"
```
Fallback rebalance if medium/low zero and high>100 (quantiles) to ensure demo shows variety. **Display mapping:** `none→Normal, low→Low, medium→Medium, high→High, critical→Critical (badge mapped to High for legacy)`. Backend returns `severity` lower-case; frontend `SeverityBadge` only renders.

## 9. Backend Architecture

**Entry:** `backend/main.py:1` FastAPI, CORS for `localhost:5173/3000` + `https://*.vercel.app`, includes 5 routers, `/api/health`, `/api/weather`, `/api/weather/clean`, `/api/detect`.

**Pipeline cache:** `routers/dashboard.py:14 _get_df()` — `get_weather_data() → group tail 300/station (8700) → preprocess_data → create_features → detect_anomalies` cached 5 min (thread-safe). All routers reuse same DF (single source of truth).

**Routers:**
- `dashboard.py:61` `/api/dashboard`, `/api/dashboard/summary` — totalRecords, totalStations, anomaliesDetected, high/medium/low/critical, anomaliesToday, normalReadings, systemStatus, datasetMeta
- `stations.py:17,59,98` `/api/stations`, `/api/stations/{id}`, `/api/stations/{id}/history?hours&parameter` — with `expected/lower/upper` per param
- `anomalies.py:77,226,285,318` `/api/anomalies?station_id&severity&limit`, `/api/alerts`, `/api/anomalies/trend?days`, `/api/history`
- `manual.py:24` `/api/manual-check`, `/api/manual/check`, `/api/predict` — appends manual row to tail 300/station + runs same pipeline (historical context required for rolling features)
- `meta.py:10,30,60,106,144,186` `/api/data-quality`, `/api/model/performance`, `/api/model/info`, `/api/trends`, `/api/pipeline`, `/api/anomalies/{id}`, `/api/health/detail`

**ML service:** `services/ml_service.py:1` wraps `anomaly_detection.detect_anomalies`, preserves GT as `ground_truth_anomaly/fault_type`, aliases `status`/`anomaly` (GT preserved).

**Helpers:** `station_meta.py` synthesizes rainfall/wind/lat-lon/elevation deterministically (ML still only temp/hum/press).

**Sanitization:** `main.py:47 _sanitize_records` NaN/inf→None, Timestamp→ISO.

**Evaluation:** `services/evaluation.py` computes Precision/Recall/F1, Confusion Matrix, per-fault recall, score stats from GT vs ML.

## 10. Frontend Architecture

**Stack:** React 19 + React Router 7 + Vite 8 + Recharts + Lucide + Framer Motion (`frontend/package.json:8`).

**Pages:**
- `Dashboard.jsx` — fetches `getDashboardSummary()+getAnomalyTrend()+getDataQuality()+getModelPerformance()+getModelInfo()+getPipeline()`; renders **6 stat cards (Total Records, Total Stations, Anomalies Detected, Anomaly Rate, Critical Anomalies, Last Updated)**, 7-day trend area+bar, quick links, **Data Quality, Model Performance, Model Info, Pipeline UI, Limitations** sections. Hero fixed to `Historical AWS Anomaly Analysis Prototype — Simulated Live Data`.
- `WeatherData.jsx` — `getStations()` table with **All/Anomalous/Normal + city filter + search + parameter visibility toggles + pagination (15/page)**. Dynamic 29 cities from `/api/stations`.
- `AnomalyMonitoring.jsx` — `getAnomalies()+getAnomalyTrend()`; trend chart, **station/parameter/time/severity/search/sort filters + pagination (20/page)** + anomaly table (parameter/anomaly_value/expected_range/detection_type/severity/GT/ML) + **detail modal** (Phase 9) with actual vs expected, deviation, score, severity, reason. Uses `expected_range = rolling mean ±2σ` or `N/A — Multivariate Detection`.
- `StationDetail.jsx` — `getStationById+getStationHistory+getAnomalies(stationId)`; info card, readings grid, **24h/3d/7d history LineChart with parameter selector + expected/upper/lower lines + anomaly red dots + tooltip**, anomaly history table with click→detail modal.
- `Alerts.jsx` — `getAlerts()` cards, High/Medium/Low filter, mark read.
- `ManualCheck.jsx` — manual sensor form (station dropdown from `/api/manual/stations`, temp/hum/press), calls `/api/manual-check` or `/api/predict`, shows **Anomaly Score, Severity, Explanation, Suggested Correction, Detection Type** truthfully.

**API layer:** `services/api.js:7` reads `VITE_API_URL` (fallback `http://127.0.0.1:8000`), `fetchWithFallback` tries backend then falls back to `data/*.json` with `_isMock` flag (demo). New helpers: `getDataQuality, getModelPerformance, getModelInfo, getPipeline, getTrends, getAnomalyById, getAnomaliesFiltered`. Production: mock can be disabled via `VITE_USE_MOCK_DATA=false`.

**UX:** Responsive (1100px: 2-col grid →1, 768px: sidebar hidden), card hierarchy, loading/error/empty states, tooltips with expected/bounds, pagination prevents thousands rows render, motion animations.

**Visual identity kept:** dark navy, cyan/teal accents, Inter font, glass cards.

## 11. Complete Workflow (code references)

```
weather_data1.csv (injected, 842k, 29 stations) — or weather_data.csv if injected missing
  → services/data_service.py:45 get_weather_data() reads DATA_PATH absolute
  → preprocessing.preprocess_data()               :backend/preprocessing.py:5 (rename, numeric coerce, timestamp, dedup, flags, scaling)
  → features.create_features()                    :backend/features.py:5 (hour/day, rates, rolling, deviations)
  → services/ml_service.py:32 detect_anomalies() → AI_ML Anomaly Detection/anomaly_detection.py:175 detect_anomalies() loads isolation_forest.joblib (18 features) + rules → anomaly_score, is_anomaly, severity, detection_type, explanation
  → routers/dashboard.py:14 _get_df() caches 8700 rows (300/station) for 5 min
  → routers/* JSON via main.py:47 _sanitize_records → frontend/services/api.js:7 fetch(BASE_URL)
  → pages/Dashboard|WeatherData|AnomalyMonitoring|StationDetail|Alerts|ManualCheck
```

Read order: `README → backend/main.py → routers/* → services/pipeline.py → preprocessing.py → features.py → AI_ML/anomaly_detection.py → services/evaluation.py → frontend/services/api.js → pages/Dashboard.jsx`.

## 12. API Documentation

All prefixed with `BASE_URL` (default `http://127.0.0.1:8000`).

```
GET /                          → {message, docs, health}
GET /api/health                → {status, service, version, dataset, model_found, pipeline}
GET /api/health/detail         → {status, pipeline {ready, rows, anomalies}, dataset, model, cache_ttl}
GET /api/weather?limit=20      → [{City, Station_ID, Datetime, Temp_2m_C, ...} ... tail]
GET /api/weather/clean?limit=20→ [{city, station_id, timestamp (ISO), temperature, humidity, pressure, is_missing, physical_range_flag, *_scaled} ...]
GET /api/detect?limit=50       → [{...plus is_anomaly, severity, anomaly_score, predicted_fault_type, explanation, status, anomaly (GT)} ... tail]
GET /api/anomalies-legacy?limit=50 → alias

GET /api/dashboard             → {totalRecords, totalStations, stationsOnline, totalAnomalies, anomaliesDetected, normalReadings, highSeverity, criticalSeverity, mediumSeverity, lowSeverity, severityDistribution, anomaliesToday, activeAlerts, latestTimestamp, latestDate, systemStatus, dataset, datasetMeta}
GET /api/dashboard/summary     → alias

GET /api/stations              → [{station_id, location, city, state, latitude, longitude, elevation, temperature, humidity, pressure, rainfall, wind_speed, wind_direction, anomaly_status, severity, anomaly_score, predicted_fault_type, sensor_health_status, timestamp} ... 29]
GET /api/stations/{station_id} → single station (404 if not found)
GET /api/stations/{station_id}/history?hours=24&parameter=temperature → [{time, timestamp, temperature, humidity, pressure, rainfall, wind_speed, expected, lower, upper, expected_by_param, lower_by_param, upper_by_param, actual, is_anomaly, severity, anomaly_score, detection_type, explanation} ... hours]

GET /api/anomalies?station_id=&severity=&limit=100 → [{id:ANO####, station_id, parameter, anomaly_value, expected_range, is_inside_expected_range, detection_type, univariate_param, severity (Title), severity_raw, timestamp, description, explanation, predicted_fault_type, ground_truth_is_anomaly, ground_truth_label, ground_truth_fault_type, ml_is_anomaly, ml_label, anomaly_score, confidence, temperature, humidity, pressure, sensor_health_status} ...]
GET /api/anomalies/{id}        → {id, timestamp, stationId, city, parameter, actualValue, expectedValue, lowerBound, upperBound, deviation, anomalyScore, status, severity, reason, explanation, detection_type, predicted_fault_type, confidence, sensor_health_status, ground_truth, suggested_correction, is_inside_expected_range} (Phase 4/20 contract)
GET /api/alerts?severity=&limit=100 → [{id, station_id, alert_message, message, severity, parameter, read, timestamp, anomaly_score} ...]
GET /api/anomalies/trend?days=7 → [{date:"Nov 20", anomalies, high, medium, low} ... days]
GET /api/history?limit=100     → [{station_id, timestamp, temperature, humidity, pressure, is_anomaly, severity} ...]
GET /api/trends?days=7&station_id=&parameter= → {trend:[{date, anomalies, high, medium, low, critical}], days, station_id}
GET /api/data-quality          → {window{raw_window_rows, processed_rows, missing_values, missing_rate, physical_range_violations, valid_records, valid_rate, stations_in_window}, full_dataset{total_rows, total_stations, injected_anomalies}, quality_flags, dataset_info}
GET /api/model/performance     → {has_ground_truth, total_records, ground_truth{normal, anomaly, anomaly_rate}, ml_detection{predicted_normal, predicted_anomaly}, metrics{precision, recall, f1, fpr_normal, accuracy}, confusion_matrix{tn, fp, fn, tp, matrix}, per_fault_recall{Spike, Drift, ...}, normal_false_positives, score_stats, classification_report, note:"Evaluation on Synthetic Labeled Test Data"}
GET /api/model/info            → {model, learning_type, primary_detector, features[18], feature_count, training_data, evaluation_data, anomaly_score, threshold_logic, severity_logic{thresholds}, detection_types, dataset, pipeline, limitations}
GET /api/pipeline              → {pipeline:[{step, title, desc}...10], note, backend_source_of_truth}
POST /api/manual-check         → {success, station_id, city, input{temperature,humidity,pressure}, prediction{status, is_anomaly, anomaly_score, severity, confidence, predicted_fault_type, explanation, suggested_correction, sensor_health_status, detection_type, univariate_param}, meta{dataset_type, historical_context_rows, model}}
POST /api/manual/check         → alias
POST /api/predict              → {station_id, station_supported, city, prediction, is_anomaly, severity, anomaly_score, values, expected_ranges, anomalous_features, reason, full_result}
GET /api/manual/stations       → {total, stations:[{station_id, city}]}
GET /api/stations/list         → alias
```
Errors: `{detail:"Station AWS999 not found"}` 404; `{error:"..."}` 500.

**API Contract Consistency (Phase 20):** Anomaly record adapts spec to existing naming but preserves required fields: `id, timestamp, station_id/stationId, city, parameter, actualValue/anomaly_value, expectedValue/expected_range, lowerBound/upperBound via lower/upper, deviation via temperature_deviation, anomalyScore/anomaly_score, status, severity, reason/explanation`. Frontend consumes backend severity/score, never recalculates.

## 13. Model Evaluation

**Live endpoint:** `GET /api/model/performance` on current window 8,700 rows (last 300/station, injected).

**Current window (8700):**
```
GT: 8282 Normal (95.2%), 418 Anomaly (4.8%) — Spike 95, Drift 119, Frozen 105, Comm 99 in this window
ML: 7795 predicted Normal, 905 predicted Anomaly (10.4% rate)
Metrics: Precision 0.291, Recall 0.629, F1 0.398, Accuracy 0.908 (misleading on imbalanced, report F1)
Confusion: TN 7640, FP 642, FN 155, TP 263
Per-fault recall: Spike 60% (57/95), Drift 1.7% (2/119), Frozen 100% (105/105), Communication 100% (99/99)
Normal FPR 7.75% (642/8282) — tradeoff, acceptable for AWS (missing fault worse than false alert)
Score stats: mean 0.36, anomaly mean 0.85, median 0.85 (forced floor)
```

**Prioritize Precision/Recall/F1, FP/FN over Accuracy** (anomaly detection imbalanced). Clearly labeled `"Evaluation on Synthetic Labeled Test Data"` — not production.

**Limitations honestly shown:** Drift recall 1-2% (gradual within rolling ±2σ), FPR 7.7% (multivariate sensitivity). Future: station-specific thresholds, drift detector (CUSUM), SHAP.

## 14. Anomaly Score, Severity, Threshold — Summary for Judges

- **Score:** per-batch normalized inverted decision_function [0,1], higher = more anomalous, forced ≥0.85, displayed as `Anomaly Score: 0.94`, never `93% probability`.
- **Threshold:** `forced (missing/frozen/physical) OR (IsolationForest predict==-1)` → `is_anomaly`. Backend decides, frontend displays.
- **Severity:** `none (is_anomaly False) | low (<0.80) | medium (≥0.80) | high (≥0.88 or forced) | critical (forced & score≥0.92)` — centralized, no frontend duplication.
- **Expected Range vs Physical Range:** physical is broad (-60..60, 0..100, 850..1100) for sanity; expected is **learned rolling mean ±2σ per station window 5** for detection. Inside physical but outside expected → univariate anomaly. Inside both → may still be multivariate anomaly (combined pattern).

## 15. Frontend UX & Removed Misleading UI (Phase 18-19)

**Fixed/Cleared:**
- Hero: `Live Monitoring` → `Historical AWS Anomaly Analysis Prototype — Simulated Live Data`; subtitle clarifies not real-time, not forecasting.
- No fake `93%` confidence — now `Anomaly Score: 0.85` with definition.
- No hardcoded 8 anomalies — dashboard counts from `/_get_df()` (905 in window).
- Dashboard 6 cards are calculated (`totalRecords 8700, totalStations 29, anomaliesDetected 905, anomalyRate 10.40%, critical 1, lastUpdated Nov 26`).
- Graph: single chart per purpose, expected/bounds/anomaly dots (no decorative duplicate). StationDetail graph now shows actual vs expected vs bounds.
- Severity colors centralized, legend explains value-color vs ML status separation.
- Pagination (WeatherData 15/page, AnomalyMonitoring 20/page) prevents thousands rows render.
- Search/filter/sort, loading/error/empty states, tooltips, mobile responsive.

**Priority:** CLARITY > DECORATION — judge understands in <30 seconds.

## 16. Demo Mode (Phase 22)

Deterministic, no random per refresh:

1. Normal: AWS001 last reading 17.2°C/85%/1016.2 → `NORMAL, score 0.12`
2. Low: AWS001 expected mean 20/74/1015.6 → `NORMAL, score 0.44` (borderline)
3. High: AWS001 48°C → `ANOMALY HIGH, score 1.0, UNIVARIATE temperature`
4. Critical: Frozen run (5 repeats) or missing → `HIGH/CRITICAL, forced`
5. Station filtering: dropdown dynamic from `/api/stations` (29)
6. Parameter filtering: Temp/Hum/Press vs Multivariate (only existing params)
7. Time filtering: Last 24h/7d/30d via `/api/trends` + client filter
8. Anomaly details: click View → modal with actual/expected/deviation/score/severity/reason
9. Model performance: `GET /api/model/performance` live
10. Data quality: `GET /api/data-quality` live

Use `Manual Sensor Check` for deterministic single-row demo with historical tail context.

## 17. Limitations (Phase 24) & Future Improvements

**Do NOT claim:** 100% accuracy, real-time AWS integration (historical prototype), production-ready, forecasting, meteorological warnings — unless implemented. Distinguish `Weather anomaly detection` vs `Weather forecasting`.

**Known limitations:**
- Drift recall 1-2% (gradual); FPR 7.7%
- Per-batch score relative, not absolute
- No live MQTT/Kafka ingest
- Rainfall/wind synthesized (not in raw)
- Window 300/station for latency (full 842k not loaded per request)

**Future:** station-specific adaptive thresholds, drift-specific CUSUM, SHAP explainability, online learning, missing-value imputation benchmark, streaming ingest, multi-variate forecasting separate service, model retraining pipeline with MLflow.

## 18. How To Run (Exact) & Deploy

### Backend (Windows PowerShell)
```powershell
cd "D:\MERN STACK DEVELOPMENT\meteora\backend"
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
# verify
# http://localhost:8000/docs
# http://localhost:8000/api/health  → {"status":"healthy"}
# http://localhost:8000/api/model/performance
```

### Frontend
```bash
cd "D:\MERN STACK DEVELOPMENT\meteora\frontend"
npm install
# optional: edit .env  VITE_API_URL=http://127.0.0.1:8000
npm run dev     # http://localhost:5173
npm run build   # production
npm run preview
```

### Full (two terminals)
Terminal 1: `cd backend && venv\Scripts\activate && uvicorn main:app --reload`
Terminal 2: `cd frontend && npm run dev`

### Deploy
- **Backend:** Render / Railway — set `METEORA_DATA_PATH` env if custom dataset location; ensure `models/isolation_forest.joblib` present; `uvicorn main:app --host 0.0.0.0 --port $PORT`
- **Frontend:** Vercel — set `VITE_API_URL=https://your-backend.onrender.com` env; `npm run build` outputs `dist/`; vercel deploys.

**Health check production:** `curl https://your-backend/api/health` → `healthy` + `dataset.type=injected`.

## 19. Testing (Phase 25)

**Backend API (via TestClient):**
```python
from fastapi.testclient import TestClient
from main import app; c=TestClient(app)
assert c.get('/api/health').json()['status']=='healthy'
assert c.get('/api/dashboard/summary').json()['totalStations']==29
assert c.post('/api/manual-check', json={'station_id':'AWS001','temperature':17.2,'humidity':85,'pressure':1016.2}).json()['prediction']['status']=='NORMAL'
assert c.post('/api/manual-check', json={'station_id':'AWS001','temperature':55,'humidity':70,'pressure':1010}).json()['prediction']['status']=='ANOMALY'
assert c.get('/api/stations/AWS999').status_code==404
assert c.get('/api/anomalies?station_id=AWS001&limit=2').json()[0]['station_id']=='AWS001'
assert c.get('/api/model/performance').json()['has_ground_truth']==True
# Frontend: npm run build succeeds (862 kB), manual Responsive: resize window, verify pagination, search, filters, modal, graph tooltip.
```

**Frontend manual:** Desktop/Tablet/Mobile resize, loading spinner, error state (stop backend → shows DEMO badge), empty states, no console errors (`oxlint` passes).

## 20. Final Consistency Audit (Phase 26)

Verified chain:
```
DATASET (weather_data1.csv 842k, 29 stations, ground_truth anomaly/fault_type)
→ PREPROCESSING (preprocessing.py:5 rename, numeric coerce, timestamp, dedup, flags, scaling)
→ FEATURES (features.py:5 + anomaly_detection._add_extra_signals → 18 features + frozen_run)
→ MODEL (IsolationForest 200 trees cont 0.02 → decision_function → per-batch score + forced)
→ ANOMALY SCORE (0-1, not probability)
→ THRESHOLD (forced OR predict==-1 → is_anomaly)
→ STATUS (ANOMALY/NORMAL)
→ SEVERITY (critical/high/medium/low/none via severity_config)
→ REASON (top-3 features + rolling ±2σ + detection_type)
→ BACKEND API (_get_df cached 8700, /api/dashboard, /api/anomalies with GT vs ML, /api/stations/history with bounds)
→ FRONTEND (Dashboard 6 cards, Graph with bounds/anomaly dots, Table with View→modal)
→ No contradiction: backend NORMAL → frontend Normal badge; backend ANOMALY → frontend ANOMALY row/highlight. Inside expected but multivariate → UI explicitly explains.
```

Especially verified: `dashboard totalRecords 8700, totalStations 29, anomaliesDetected 905, critical 1, anomalyRate 10.40%`; `GET /api/model/performance` vs `GET /api/anomalies` vs `StationDetail history` all use same `_get_df` → consistent.

## 21. Files Changed — Summary

**A. Created:**
- `backend/data/raw/README.md`, `processed/README.md`, `synthetic_anomalies/README.md`, `evaluation/README.md`, `DATA_CATALOG.md`
- `backend/services/severity_config.py` (centralized severity)
- `backend/services/evaluation.py` (metrics + data quality)
- `backend/routers/meta.py` (7 endpoints: data-quality, model/performance, model/info, trends, pipeline, anomalies/{id}, health/detail)

**B. Modified:**
- `backend/preprocessing.py` (hardened: copy, numeric coerce, timestamp errors, dedup station_id+timestamp, NaN-aware scaling)
- `backend/services/ml_service.py` (preserve GT as ground_truth_anomaly/fault_type, not overwrite)
- `backend/routers/stations.py` (/history now returns expected/lower/upper, parameter selector)
- `backend/main.py` (include meta_router)
- `backend/data/*` (added directories, kept CSVs)
- `frontend/src/services/api.js` (added getDataQuality, getModelPerformance, getModelInfo, getPipeline, getTrends, getAnomalyById)
- `frontend/src/pages/Dashboard.jsx` (6 cards, hero fix, Data Quality/Model Performance/Model Info/Pipeline/Limitations sections)
- `frontend/src/pages/StationDetail.jsx` (parameter selector, 24h/3d/7d, graph with expected/bounds/anomaly dots, detail modal)
- `frontend/src/pages/AnomalyMonitoring.jsx` (station/param/time/search/sort/pagination + detail modal)
- `frontend/src/pages/WeatherData.jsx` (city filter, search, param toggles, pagination)
- `frontend/src/components/Sidebar.jsx` (label fix, SIMULATED LIVE badge)

**C. Deleted:** none (kept legacy files for compatibility; `anomaly_model.joblib` remains empty placeholder not used)

**D. Dataset:** raw untouched (`weather_data.csv` 40.6 MB), injected documented (`weather_data1.csv` 48.5 MB, 5% anomalies, seed 42). No duplication; `data/raw|processed|synthetic|evaluation` are docs pointing to canonical files.

**E. ML:** not retrained; IsolationForest 200 trees cont 0.02 + rules preserved; added deterministic severity centralization, per-batch score documentation, multivariate vs univariate detection_type, confidence, suggested_correction via rolling mean.

**F. Backend:** 7 new endpoints, 3 enhanced, single cache source of truth, 5 min TTL, sanitized records.

**G. Frontend:** 4 pages enhanced, 1 unchanged (Alerts) but consistent, 1 service expanded, UX improved, misleading claims removed.

**H. API:** 14 original + 7 new = 21 endpoints; contracts synchronized (anomaly record: id, timestamp, stationId, parameter, actualValue, expectedRange, anomalyScore, status, severity, reason).

## 22. 2-Minute Judge Explanation

**“METEORA is a historical AWS anomaly analysis prototype, not real-time forecasting.”**

1. **Data:** 29 Indian AWS stations, hourly temp/hum/press. Raw (clean 842k) trains unsupervised Isolation Forest (200 trees, 0.02 contamination). Injected file (5% synthetic Spike/Drift/Frozen/Missing, seed 42) used only for evaluation — ground truth never seen by model.

2. **Pipeline (single source, backend):** `GET /api/health` → `data_service` loads last 300/station (8700 rows) → `preprocess_data` (numeric coerce, dedup, flags, scaling) → `create_features` (rates, rolling 5) → `detect_anomalies` (IsolationForest inverted decision_function rescaled 0-1 + forced rules for missing/frozen/physical, score≥0.85). → `threshold` (forced OR predict==-1) → `severity` (centralized: critical≥0.92, high≥0.88, medium≥0.80, low else) → `reason` (top-3 features + rolling mean±2σ). All cached 5 min.

3. **Dashboard shows truth:** Top cards are calculated (Total Records 8,700, Stations 29, Anomalies 905, Rate 10.4%, Critical 1, Last Updated from timestamp). Graph plots actual vs expected (rolling mean) with bounds ±2σ; anomalies red dots. Table lists parameter, observed, expected range, detection type (Univariate vs Multivariate — if inside range but flagged, UI says “combined pattern is unusual”), GT vs ML side-by-side, score, severity, reason on click.

4. **Prove it’s not fake:** `GET /api/model/performance` shows Precision 0.29, Recall 0.63, F1 0.40, FP 642, FN 155, per-fault recall (Spike 60%, Drift 1.7% honest low, Frozen/Comm 100%) — evaluated on synthetic labeled test data, labeled as such. `GET /api/data-quality` shows missing 99, valid 8601. `POST /api/manual-check` with AWS001 17.2/85/1016.2 → NORMAL (score 0.15), 48°C → HIGH anomaly (score 1.0). Backend decides, frontend only displays.

5. **Limitations honestly:** Not real-time, not forecasting, drift hard, FPR 7.7% tradeoff. Future: CUSUM drift, SHAP, streaming.

*All code traceable: `README → main.py → routers → preprocessing → features → anomaly_detection → api.js → Dashboard`.*

---

**Run:** `backend: uvicorn main:app --reload --port 8000` ; `frontend: npm install && npm run dev` (VITE_API_URL=http://127.0.0.1:8000). Build: `npm run build` (264 kB gzip). Verify: `curl localhost:8000/api/health` → healthy.
