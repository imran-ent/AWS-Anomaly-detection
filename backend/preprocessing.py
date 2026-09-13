import pandas as pd
import numpy as np


def preprocess_data(df):
    """
    Cleans raw weather data for the METEORA anomaly detection pipeline.

    Input columns expected:
        timestamp, station_id, temperature, humidity, pressure
        (optional: anomaly, fault_type -- kept as-is if present, used for
        ML training only, not required for live data)

    Output columns:
        timestamp, station_id, temperature, humidity, pressure,
        is_missing, physical_range_flag,
        temperature_scaled, humidity_scaled, pressure_scaled
        (+ anomaly, fault_type if they were present in the input)

    Steps performed:
        1. Standardize column names (handles old-style names too)
        2. Parse timestamp, sort by station_id + timestamp
        3. Remove duplicate rows
        4. Flag missing sensor readings (kept as NaN, not dropped/filled --
           missing values are the "Communication Error" anomaly itself)
        5. Flag physically impossible readings (sanity check only, values
           are NOT removed so genuine Spike anomalies are preserved)
        6. Add standardized (z-score scaled) versions of temperature,
           humidity, pressure for ML model input
    """

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

    # 2. Parse timestamp and sort
    df["timestamp"] = pd.to_datetime(df["timestamp"], format="mixed", dayfirst=True)
    df = df.sort_values(["station_id", "timestamp"]).reset_index(drop=True)

    # 3. Remove duplicates
    df = df.drop_duplicates()

    # 4. Flag missing values (do not fill/drop -- these are Communication Error anomalies)
    df["is_missing"] = df[["temperature", "humidity", "pressure"]].isna().any(axis=1)

    # 5. Physical range check (flag only, not removal)
    temp_ok = df["temperature"].between(-60, 60) | df["is_missing"]
    humidity_ok = df["humidity"].between(0, 100) | df["is_missing"]
    pressure_ok = df["pressure"].between(850, 1100) | df["is_missing"]
    df["physical_range_flag"] = ~(temp_ok & humidity_ok & pressure_ok)

    # 6. Scale numeric columns for ML input (keep raw columns too)
    for col in ["temperature", "humidity", "pressure"]:
        mean_val = df[col].mean()
        std_val = df[col].std()
        df[col + "_scaled"] = (df[col] - mean_val) / std_val

    return df


# ---------- Quick manual test when running this file directly ----------
if __name__ == "__main__":
    raw_df = pd.read_csv("weather_data.csv")
    cleaned_df = preprocess_data(raw_df)
    cleaned_df.to_csv("cleaned_weather_data.csv", index=False)
    print("Saved cleaned_weather_data.csv")
    print(cleaned_df.shape)
    print(cleaned_df.head())
