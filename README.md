# METEORA — AI/ML Intelligent Anomaly Detection for Automatic Weather Stations (AWS)

SIH 2026 • Ministry of Earth Sciences / IMD

## 1. Project Overview
METEORA is an end-to-end system that detects sensor faults and extreme weather anomalies from Automatic Weather Station (AWS) telemetry in real time. It ingests hourly readings (temperature, humidity, pressure) from 29 stations across India, cleans and engineers features, runs an unsupervised Isolation Forest + rule-based overrides, and surfaces anomalies, severity, root-cause, and sensor health on a live dashboard.

**Live flow:** `Raw CSV → Preprocessing → Feature Engineering → Isolation Forest → Backend API → Frontend Dashboard`

## 2. Problem We Solve
ISRO/IMD AWS stations suffer from spike/drift, frozen sensors, communication gaps, and physically impossible readings. Unnoticed faults corrupt forecasts and disaster warnings. METEORA learns *normal* behaviour unsupervised (no labels needed for new stations) and flags anomalies with an explainable score, fault type, and suggested correction before they propagate.

## 3. Complete Workflow
```
Dataset (data/weather_data.csv, 842k hourly rows, 29 stations)
  ↓
Preprocessing (backend/preprocessing.py :: preprocess_data)
  ├─ rename City/Station_ID/Datetime/Temp_2m_C/Humidity_Percent/Pressure_MSL_hPa
  ├─ parse timestamp (dayfirst), sort station_id+timestamp, dedup
  ├─ flag is_missing / physical_range_flag (do not drop)
  └─ add temperature/humidity/pressure_scaled (z-score)
  ↓
Feature Engineering (backend/features.py :: create_features)
  ├─ hour/day/month/day_of_week/is_weekend
  ├─ temperature/humidity/pressure_rate (diff), abs_change
  ├─ rolling mean/std (window 5), deviations
  └─ temperature_humidity_ratio
  ↓
AI/ML Detection (backend/AI_ML Anomaly Detection/anomaly_detection.py :: detect_anomalies)
  ├─ derives temp_pressure_consistency, humidity_saturation_flag, frozen_run_length
  ├─ IsolationForest (200 trees, contamination 0.02) on 18 features → anomaly_score [0,1], is_anomaly
  ├─ deterministic overrides: is_missing|physical_range|frozen_run>=3 → forced anomaly (score ≥0.85)
  ├─ severity: critical ≥0.9, high ≥0.75, medium ≥0.55, low otherwise, none if normal
  ├─ predicted_fault_type via RandomForestClassifier if trained else rule-based (Spike/Frozen/etc)
  ├─ explanation, suggested_correction (rolling mean), sensor_health_status (rolling 50 anomaly rate)
  └─ also adds status="ANOMALY"/"NORMAL", anomaly=1/0 aliases
  ↓
Backend API (backend/main.py + routers/* + services/pipeline.py)
  ↓
Frontend Dashboard (frontend/src/pages/* via services/api.js)
```

## 4. Folder Structure
```
METEORA/
├── backend/
│   ├── main.py                    # FastAPI app, CORS, /api/health|weather|detect, includes routers
│   ├── preprocessing.py           # raw → cleaned (kept at root, single source of truth)
│   ├── features.py                # cleaned → feature-engineered
│   ├── data/
│   │   └── weather_data.csv       # 842k rows, 6 cols: City,Station_ID,Datetime,Temp_2m_C,Humidity_Percent,Pressure_MSL_hPa
│   ├── models/
│   │   ├── isolation_forest.joblib# copied from AI_ML folder (18 features)
│   │   ├── feature_config.joblib  # feature order (copied)
│   │   └── anomaly_model.joblib   # legacy empty placeholder (not used)
│   ├── AI_ML Anomaly Detection/
│   │   ├── anomaly_detection.py   # real inference: detect_anomalies(df)
│   │   ├── train_model.py         # offline trainer (IsolationForest + optional RandomForest)
│   │   ├── isolation_forest.joblib
│   │   ├── feature_config.joblib
│   │   └── models/                # mirror for anomaly_detection default MODEL_DIR
│   ├── services/
│   │   ├── data_service.py        # get_weather_data() with absolute path
│   │   ├── preprocessing.py       # re-export from backend/preprocessing.py
│   │   ├── features.py            # re-export from backend/features.py
│   │   ├── ml_service.py          # wraps anomaly_detection.detect_anomalies + aliases
│   │   ├── pipeline.py            # run_detection_pipeline(): load→preprocess→features→detect
│   │   ├── station_meta.py        # synthetic rainfall/wind/lat-lon for frontend completeness
│   │   ├── fault_classifier.py    # legacy simple classifier (kept, not used in pipeline)
│   │   └── severity.py            # legacy get_severity(score)
│   ├── routers/
│   │   ├── dashboard.py           # /api/dashboard & /api/dashboard/summary (cached)
│   │   ├── stations.py            # /api/stations, /api/stations/{id}, /history
│   │   └── anomalies.py           # /api/anomalies, /api/alerts, /trend, /history
│   ├── requirements.txt
│   └── venv/
├── frontend/
│   ├── src/
│   │   ├── App.jsx                # Router: /, /weather, /anomalies, /stations/:id, /alerts
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx      # hero, stat cards, 7-day trend area+bar
│   │   │   ├── WeatherData.jsx    # station table with filter
│   │   │   ├── AnomalyMonitoring.jsx # anomaly table + severity trend
│   │   │   ├── StationDetail.jsx  # info card + readings + 24h history line chart
│   │   │   └── Alerts.jsx         # alert cards with read toggle
│   │   ├── components/
│   │   │   ├── Sidebar.jsx
│   │   │   ├── TopBar.jsx
│   │   │   └── Badges.jsx
│   │   ├── services/
│   │   │   └── api.js             # fetch(BASE_URL) with mock fallback; BASE_URL via VITE_API_URL
│   │   └── data/                  # mock JSON fallback if backend unreachable
│   ├── .env / .env.example
│   ├── vite.config.js
│   └── package.json
└── README.md (this file)
```

## 5. Backend Explanation
**Entry:** `backend/main.py:1` — FastAPI app, CORS allows `localhost:5173/3000`, includes 3 routers, exposes `/`, `/api/health`, `/api/weather`, `/api/weather/clean`, `/api/detect`.

**Data flow:**  
`main.py:/api/weather` → `services/data_service.py:8 get_weather_data()` reads `data/weather_data.csv` via absolute path.  
`/api/weather/clean` → `preprocess_data()` then tail 20.  
`/api/detect` & dashboard/stations/anomalies → `routers/dashboard.py:15 _get_df()` which does `get_weather_data() → group-tail(300 per station, 8700 rows) → preprocess_data → create_features → detect_anomalies` and caches 5 min for speed. All other routers reuse this cached DF.

**Routes:** via `routers/dashboard.py:27`, `routers/stations.py:16,42,73`, `routers/anomalies.py:20,57,95,128`.

**ML integration:** `services/ml_service.py:1` delegates to `AI_ML Anomaly Detection/anomaly_detection.py:161 detect_anomalies` using `models/isolation_forest.joblib` + `feature_config.joblib` (18 features). Adds `status`/`anomaly` aliases for legacy code.

**Helpers:** `services/station_meta.py:1` synthesizes rainfall (`max(0,(humidity-75)*0.8)+(1002-pressure)*1.2`), wind (`8+|1010-pressure|*0.6`), and static lat/lon/state per city so frontend tables/charts have complete rows even though raw CSV lacks those columns.

**Sanitization:** `main.py:27 _sanitize_records()` replaces NaN/inf→None, converts Timestamps→ISO, numpy→python types for JSON.

## 6. ML Explanation
**Model:** `IsolationForest(n_estimators=200, contamination=0.02, random_state=42)` trained in `AI_ML Anomaly Detection/train_model.py:136`. Optional `RandomForestClassifier(n_estimators=300)` for root-cause if `fault_type` labels ≥20 per class exist; otherwise rule-based fallback.

**Input features (18, order matters, from `feature_config.joblib`):**  
`temperature_scaled, humidity_scaled, pressure_scaled, temperature_rate, humidity_rate, pressure_rate, temperature_rolling_std, humidity_rolling_std, pressure_rolling_std, temperature_deviation, humidity_deviation, pressure_deviation, temperature_abs_change, humidity_abs_change, pressure_abs_change, temp_pressure_consistency, humidity_saturation_flag, frozen_run_length` plus `is_missing, physical_range_flag` for root-cause.

**Output per row:** `anomaly_score [0,1]` (inverted decision_function rescaled per-batch, forced ≥0.85), `is_anomaly bool`, `severity none/low/medium/high/critical`, `confidence`, `predicted_fault_type (Normal/Spike/Frozen Sensor/Physical Range Violation/Communication Error/Unusual Pattern plus learned labels)`, `explanation` (top-3 unusual features humanized), `suggested_correction {temp,humid,press: rolling_mean}`, `sensor_health_status healthy/degrading/faulty (rolling 50 anomaly rate)`.

**How detection works:** Isolation Forest scores isolation depth; lower decision_function = more anomalous. Scores inverted & min-max scaled per batch. Rows with missing, impossible physics, or ≥3 identical consecutive values are forced anomalies regardless of forest score. Severity thresholds carve score into buckets. Explainability ranks absolute engineered feature values.

## 7. Frontend Explanation
**Stack:** React 19 + React Router 7 + Vite 8 + Recharts + Lucide + Framer Motion (`frontend/package.json:8`).

**Pages:**  
- `Dashboard.jsx:104` — fetches `getDashboardSummary()` + `getAnomalyTrend()`, renders 4 stat cards, 7-day area & bar charts, quick links.  
- `WeatherData.jsx:52` — `getStations()` table with All/Anomalous/Normal filters, color-coded Temp/Humidity/Wind, row click → station detail.  
- `AnomalyMonitoring.jsx:59` — `getAnomalies()` + trend, severity pills, filter row, table of parameter/anomaly_value/expected_range/severity.  
- `StationDetail.jsx:80` — `getStationById` + `getStationHistory` + `getAnomalies(stationId)`, info card, current readings grid, 24h LineChart with toggles, anomaly history table.  
- `Alerts.jsx:57` — `getAlerts()` with High/Medium/Low filter, unread dot, mark-all-read.

**API integration:** `services/api.js:7` reads `import.meta.env.VITE_API_URL` (fallback `http://localhost:8000`), `fetchWithFallback()` tries backend then falls back to local `data/*.json` so UI never blanks during offline demos. All 7 exported functions match router endpoints exactly.

**Environment:** `VITE_API_URL` in `.env` (frontend root). CORS handled by backend. Loading spinners, error states, and `formatTime` (Asia/Kolkata) preserved.

## 8. API Documentation
All prefixed with `BASE_URL` (default `http://localhost:8000`).

```
GET /                          → {message, docs, health}
GET /api/health                → {status: "healthy", service, version}
GET /api/weather?limit=20      → [{City, Station_ID, Datetime, Temp_2m_C, Humidity_Percent, Pressure_MSL_hPa} ... tail]
GET /api/weather/clean?limit=20→ [{city, station_id, timestamp (ISO), temperature, humidity, pressure, is_missing, physical_range_flag, *_scaled} ...]
GET /api/detect?limit=50       → [{...plus is_anomaly, severity, anomaly_score, predicted_fault_type, explanation, status, anomaly} ... tail]
GET /api/anomalies-legacy?limit=50 → legacy alias (same as /api/anomalies but raw df slice)

GET /api/dashboard             → {totalRecords, totalStations, normalReadings, anomaliesDetected, highSeverity, mediumSeverity, lowSeverity, anomaliesToday, activeAlerts, systemStatus}
GET /api/dashboard/summary     → alias of above

GET /api/stations              → [{station_id, location, city, state, latitude, longitude, elevation, temperature, humidity, pressure, rainfall, wind_speed, wind_direction, anomaly_status, severity, anomaly_score, predicted_fault_type, sensor_health_status, timestamp} ... 29]
GET /api/stations/{station_id} → single station object (404 if not found)
GET /api/stations/{station_id}/history?hours=24 → [{time, timestamp, temperature, humidity, pressure, rainfall, wind_speed, is_anomaly, severity, anomaly_score} ... hours]

GET /api/anomalies?station_id=&severity=&limit=100 → [{id, station_id, parameter, anomaly_value, expected_range, severity (Title-Case), severity_raw, timestamp, description, explanation, predicted_fault_type, anomaly_score, confidence, temperature, humidity, pressure, sensor_health_status} ...]
GET /api/alerts?severity=&limit=100 → [{id, station_id, alert_message, message, severity, parameter, read, timestamp, anomaly_score} ...]
GET /api/anomalies/trend?days=7 → [{date: "Nov 20", anomalies, high, medium, low} ... days]
GET /api/history?limit=100     → [{station_id, timestamp, temperature, humidity, pressure, is_anomaly, severity} ...]
```
Errors: `{detail: "Station AWS999 not found"}` with 404; `{error: "..."}` with 500 for dataset/model missing.

## 9. How Data Flows Through the Code
```
1. User opens http://localhost:5173 → App.jsx mounts, Dashboard.jsx useEffect calls getDashboardSummary() & getAnomalyTrend()
2. services/api.js → fetch http://localhost:8000/api/dashboard/summary → backend/routers/dashboard.py:_get_df()
3.   _get_df() → services/data_service.py:get_weather_data() reads D:/.../backend/data/weather_data.csv (842k rows)
              → group tail 300/station (8700 rows) → preprocessing.py:preprocess_data() renames & scales
              → features.py:create_features() adds rates/rolling/deviations
              → services/ml_service.py:detect_anomalies() → AI_ML Anomaly Detection/anomaly_detection.py:detect_anomalies() loads isolation_forest.joblib + feature_config.joblib → scores & flags
4. dashboard.py computes totalRecords/normal/anomalies/high/medium/low → JSON → frontend renders stat cards
5. Recharts trend: anomalies router groups anomalies by date_only for last 7 days
6. WeatherData page: getStations() → routers/stations.py:list_stations() → _latest_per_station() + station_meta synth → table
7. Click station → StationDetail: getStationById + history + anomalies filtered → line chart + anomaly table
8. Alerts page: getAlerts() → anomalies.py:list_alerts() derives alert_message from explanation → cards
```
Read order for new teammates: `README → backend/main.py → routers/* → services/pipeline.py → preprocessing.py → features.py → AI_ML/anomaly_detection.py → frontend/services/api.js → pages/Dashboard.jsx`

## 10. How To Run

### Backend (Windows PowerShell)
```bash
cd "D:\MERN STACK DEVELOPMENT\meteora\backend"
# create venv if not exists
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
# ensure models are present (already copied)
# run server (auto-reload)
uvicorn main:app --reload --host 0.0.0.0 --port 8000
# verify
# http://localhost:8000/docs  (Swagger)
# http://localhost:8000/api/health
```

### Frontend
```bash
cd "D:\MERN STACK DEVELOPMENT\meteora\frontend"
npm install
# configure backend URL (optional, defaults to localhost:8000)
# edit .env: VITE_API_URL=http://localhost:8000
npm run dev
# open http://localhost:5173
# production build
npm run build
npm run preview
```

### Full Project (two terminals)
Terminal 1: `cd backend && venv\Scripts\activate && uvicorn main:app --reload`
Terminal 2: `cd frontend && npm run dev`

## 11. Integration Report

### What Already Existed (reused as-is)
- `backend/preprocessing.py` (clean logic) & `backend/features.py` (feature logic) — kept, only fixed rename_map
- `backend/AI_ML Anomaly Detection/anomaly_detection.py` + `train_model.py` + `isolation_forest.joblib` + `feature_config.joblib` — reused without retraining
- `backend/data/weather_data.csv` (842k rows) — untouched
- `frontend` UI: all 5 pages, components, CSS, mock `data/*.json` — preserved, no redesign
- `backend/services/fault_classifier.py`, `severity.py` — kept for reference
- `backend/.gitignore`, `frontend/vite.config.js`, `package.json` — kept

### What Was Integrated
- Wired `RAW CSV → preprocess → features → Isolation Forest → API → Frontend` into one cached pipeline (`services/pipeline.py` + `routers/dashboard.py:_get_df()`)
- Connected frontend `api.js` from mock-only to live `fetch(BASE_URL)` with mock fallback
- Synthesized missing frontend fields (rainfall, wind, lat/lon) deterministically via `station_meta.py`

### What Was Changed (minimum necessary)
| File | Why |
|------|-----|
| `backend/preprocessing.py:32` | Added `City→city, Datetime→timestamp, Temp_2m_C→temperature, Humidity_Percent→humidity, Pressure_MSL_hPa→pressure` to handle actual CSV |
| `backend/services/data_service.py` | Absolute `BASE_DIR` path + FileNotFound handling + `limit` param |
| `backend/services/preprocessing.py` | Replaced empty file with re-export from root `preprocessing.py` |
| `backend/services/features.py` | Replaced empty file with re-export from root `features.py` |
| `backend/services/ml_service.py` | Replaced broken 3-feature `anomaly_model.joblib` stub with wrapper around real `anomaly_detection.detect_anomalies` + aliases `status/anomaly` |
| `backend/services/pipeline.py` | Added `limit/sample_tail` params and docstring |
| `backend/services/station_meta.py` | **New** — synthetic rainfall/wind/coords to bridge dataset ↔ frontend contract |
| `backend/routers/dashboard.py` | Fixed `status=="ANOMALY"` bug → `is_anomaly`, added cache, full metrics, alias `/summary` |
| `backend/routers/stations.py` | **New** (was empty) — 3 endpoints with meta + history |
| `backend/routers/anomalies.py` | **New** (was empty) — anomalies/alerts/trend with severity mapping & expected_range |
| `backend/main.py` | Fixed imports, CORS for all localhost ports, added `_sanitize_records`, included 3 routers, added `/api/weather/clean` robustness |
| `backend/requirements.txt` | Populated from actual venv freeze |
| `backend/models/isolation_forest.joblib`, `feature_config.joblib` | Copied from `AI_ML Anomaly Detection/` (also `. /models/` mirror created) |
| `frontend/src/services/api.js` | Replaced delay/mock-only with `fetch(BASE_URL)` + fallback |
| `frontend/.env`, `.env.example` | **New** — `VITE_API_URL` config |

### What Was NOT Changed
- No file deleted. No working ML logic replaced. No dataset replaced. No frontend design/colors/layout altered. No fake anomaly generation (all scores from real Isolation Forest + rules). No duplicate preprocessing inside routes.

### Complete Final Workflow (verified)
```
weather_data.csv (29 stations, 842k)
  → data_service.get_weather_data()               :backend/services/data_service.py:8
  → preprocessing.preprocess_data()               :backend/preprocessing.py:5
  → features.create_features()                    :backend/features.py:5
  → ml_service.detect_anomalies() → anomaly_detection.detect_anomalies() :backend/AI_ML Anomaly Detection/anomaly_detection.py:161
  → pipeline.run_detection_pipeline()             :backend/services/pipeline.py:8
  → routers/dashboard|stations|anomalies          :backend/routers/*
  → main.py FastAPI JSON                          :backend/main.py:27
  → frontend/services/api.js fetch                :frontend/src/services/api.js:7
  → pages/Dashboard|WeatherData|AnomalyMonitoring|StationDetail|Alerts :frontend/src/pages/*
```

### How To Understand The Code (reading order)
1. This README
2. `backend/main.py` (entry, CORS, sanitizer)
3. `backend/routers/dashboard.py`, `stations.py`, `anomalies.py` (API shapes)
4. `backend/services/pipeline.py` (one-line pipeline)
5. `backend/preprocessing.py` (column renames, flags, scaling)
6. `backend/features.py` (rates, rolling, deviations)
7. `backend/AI_ML Anomaly Detection/anomaly_detection.py` (IsolationForest, overrides, severity, explanation)
8. `frontend/src/services/api.js` (BASE_URL + fallback)
9. `frontend/src/pages/Dashboard.jsx` (integration proof)

### How To Run (exact)
See §10 above. Backend health: `curl http://localhost:8000/api/health` → `{"status":"healthy"}`. Frontend dev: `http://localhost:5173` auto-proxy via `VITE_API_URL`.

### Integration Issues & Resolutions
- **Empty services/preprocessing.py & features.py** → re-exported root modules. `pipeline.py` was broken import.
- **`models/anomaly_model.joblib` 0 bytes** → replaced `ml_service.py` to load real `isolation_forest.joblib` (18 features) from `models/` and `AI_ML/.../models/` mirror.
- **`preprocessing.rename_map` missing `Datetime`/`Temp_2m_C`/etc** → added 4 mappings; otherwise `KeyError: timestamp`.
- **Dashboard checked `status=="ANOMALY"` but model outputs `is_anomaly` bool** → added alias columns + dual checks.
- **Dataset has 29 stations (Agartala…Visakhapatnam) but frontend mock has 15 (Chennai…)** → frontend now renders dynamic 29, fallback mock keeps demo alive if backend down.
- **Raw CSV lacks rainfall/wind/elevation/lat-lon expected by frontend tables/charts** → synthesized deterministically in `station_meta.py` (documented, not faked as real sensor data; ML still only uses temp/humid/press).
- **Full 842k pipeline ~4-8s per request** → cached last 300/station (8700 rows) for 5 min; history uses tail slices.
- **`anomaly_detection.MODEL_DIR` expected `models/` subfolder** → created `AI_ML Anomaly Detection/models/` mirror.
- **Scikit-learn version mismatch (1.8.0 vs 1.9.1) InconsistentVersionWarning** → safe to ignore (ExtraTree/IsolationForest); model loads and predicts correctly (verified).
- **Vite `VITE_API_URL` not set → fetch defaults to `http://localhost:8000`** → added `.env` + fallback.

All endpoints tested via `fastapi.testclient.TestClient` (200 OK). Frontend `npm run build` succeeds (862 kB bundle). No silent failures.

