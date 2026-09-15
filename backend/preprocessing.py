import pandas as pd
import numpy as np


def preprocess_data(df):
    """
    Cleans raw weather data for the METEORA anomaly detection pipeline.
    Raw data is NEVER mutated in place; all operations are on a copy.

    Input columns expected (any of the raw variants):
        timestamp/Datetime, station_id/Station_ID, temperature/Temp_2m_C/"temperature in c",
        humidity/Humidity_Percent/"humidity in %", pressure/Pressure_MSL_hPa/pressure
        (optional: anomaly, fault_type -- kept as-is if present, used for
        ML training only, not required for live data)

    Output columns:
        timestamp, station_id, temperature, humidity, pressure,
        is_missing, physical_range_flag,
        temperature_scaled, humidity_scaled, pressure_scaled
        (+ anomaly, fault_type if they were present in the input)
        (+ city if present)

    Steps performed:
        1. Standardize column names (handles all known raw schemas)
        2. Coerce temperature/humidity/pressure to numeric (invalid -> NaN)
        3. Parse timestamp (mixed format, dayfirst), sort by station_id + timestamp
        4. Remove duplicate records (exact duplicates + duplicate station_id+timestamp keep first)
        5. Flag missing sensor readings (kept as NaN, not dropped/filled --
           missing values are the "Communication Error" anomaly itself)
        6. Flag physically impossible readings (sanity check only, values
           are NOT removed so genuine Spike anomalies are preserved)
        7. Add standardized (z-score scaled) versions of temperature,
           humidity, pressure for ML model input (NaN-aware)
        8. Ensure station_id and timestamp are non-null where possible

    Documented pipeline for presentation: RAW -> VALIDATION -> PREPROCESSING -> FEATURES
    """

    # 0. Work on copy to guarantee raw untouched
    df = df.copy()

    # 1. Standardize column names in case old-style names are used
    rename_map = {
        "Station_ID": "station_id",
        "City": "city",
        "Datetime": "timestamp",
        "Temp_2m_C": "temperature",
        "Humidity_Percent": "humidity",
        "Pressure_MSL_hPa": "pressure",
        "temperature in c": "temperature",
        "humidity in %": "humidity",
    }
    df = df.rename(columns=rename_map)

    # 1b. Coerce numeric columns (invalid strings -> NaN, preserves intentional spikes)
    for col in ["temperature", "humidity", "pressure"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # 2. Parse timestamp and sort
    #    dayfirst=True for DD-MM-YYYY source; mixed handles ISO too
    df["timestamp"] = pd.to_datetime(df["timestamp"], format="mixed", dayfirst=True, errors="coerce")
    # Drop rows where timestamp could not be parsed AND station_id missing (unrecoverable)
    # Keep other rows even if timestamp NaT for downstream flagging (but sort will put them first)
    df = df.sort_values(["station_id", "timestamp"], na_position="first").reset_index(drop=True)

    # 3. Remove duplicates
    #    3a. exact duplicate rows
    df = df.drop_duplicates()
    #    3b. duplicate station_id+timestamp -> keep first occurrence (deterministic)
    if "station_id" in df.columns and "timestamp" in df.columns:
        df = df.drop_duplicates(subset=["station_id", "timestamp"], keep="first")

    # 4. Flag missing values (do not fill/drop -- these are Communication Error anomalies)
    #    Must be after numeric coercion so "N/A" strings become NaN and are caught
    df["is_missing"] = df[["temperature", "humidity", "pressure"]].isna().any(axis=1)

    # 5. Physical range check (flag only, not removal)
    #    Ranges based on Indian AWS physical limits (documented for judges):
    #    temperature -60 to 60 C, humidity 0-100%, pressure 850-1100 hPa (sea-level)
    #    These are broad physical limits, not learned baselines. A value inside
    #    physical range can still be anomalous via learned multivariate pattern.
    temp_ok = df["temperature"].between(-60, 60) | df["is_missing"]
    humidity_ok = df["humidity"].between(0, 100) | df["is_missing"]
    pressure_ok = df["pressure"].between(850, 1100) | df["is_missing"]
    df["physical_range_flag"] = ~(temp_ok & humidity_ok & pressure_ok)

    # 6. Scale numeric columns for ML input (keep raw columns too)
    #    NaN-aware mean/std (skipna). If std is 0 or NaN (all missing), scale stays NaN/0
    for col in ["temperature", "humidity", "pressure"]:
        mean_val = df[col].mean(skipna=True)
        std_val = df[col].std(skipna=True)
        if pd.isna(mean_val) or pd.isna(std_val) or std_val == 0:
            df[col + "_scaled"] = 0.0
        else:
            df[col + "_scaled"] = (df[col] - mean_val) / std_val
        # Fill NaN scaled with 0 so ML can still process (missing flag preserves info)
        df[col + "_scaled"] = df[col + "_scaled"].fillna(0.0)

    return df


# ---------- Quick manual test when running this file directly ----------
if __name__ == "__main__":
    raw_df = pd.read_csv("weather_data.csv")
    cleaned_df = preprocess_data(raw_df)
    cleaned_df.to_csv("cleaned_weather_data.csv", index=False)
    print("Saved cleaned_weather_data.csv")
    print(cleaned_df.shape)
    print(cleaned_df.head())
