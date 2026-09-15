# Raw Data — METEORA

**Location:** `backend/data/weather_data.csv` (canonical raw)
**Alternative name (legacy):** same file, also referenced as `data/raw/weather_data.csv`

- Source: Original Indian Cities hourly weather dataset (Kaggle / IMD historical)
- Rows: 842,160
- Stations: 29 (AWS001–AWS029, Agartala … Visakhapatnam)
- Columns: `City, Station_ID, Datetime, Temp_2m_C, Humidity_Percent, Pressure_MSL_hPa`
- No missing values, no labels — this is the **BASE / NORMAL** dataset
- Training: IsolationForest trained on normal behavior (contamination 0.02, 200 trees)
- **DO NOT MODIFY** — all preprocessing outputs derived copies

Raw data is untouched by preprocessing; `preprocessing.preprocess_data()` operates on a copy.
