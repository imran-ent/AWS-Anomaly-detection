import pandas as pd
import numpy as np


def create_features(df):
    df = df.copy()

    df["timestamp"] = pd.to_datetime(df["timestamp"])

    df = df.sort_values(
        ["station_id", "timestamp"]
    ).reset_index(drop=True)

    df["hour"] = df["timestamp"].dt.hour
    df["day"] = df["timestamp"].dt.day
    df["month"] = df["timestamp"].dt.month
    df["day_of_week"] = df["timestamp"].dt.dayofweek

    df["is_weekend"] = (
        df["day_of_week"] >= 5
    ).astype(int)

    df["temperature_rate"] = (
        df.groupby("station_id")["temperature"].diff()
    )

    df["humidity_rate"] = (
        df.groupby("station_id")["humidity"].diff()
    )

    df["pressure_rate"] = (
        df.groupby("station_id")["pressure"].diff()
    )

    window = 5

    df["temperature_rolling_mean"] = (
        df.groupby("station_id")["temperature"]
        .transform(
            lambda x: x.rolling(window, min_periods=1).mean()
        )
    )

    df["humidity_rolling_mean"] = (
        df.groupby("station_id")["humidity"]
        .transform(
            lambda x: x.rolling(window, min_periods=1).mean()
        )
    )

    df["pressure_rolling_mean"] = (
        df.groupby("station_id")["pressure"]
        .transform(
            lambda x: x.rolling(window, min_periods=1).mean()
        )
    )

    df["temperature_rolling_std"] = (
        df.groupby("station_id")["temperature"]
        .transform(
            lambda x: x.rolling(window, min_periods=2).std()
        )
    )

    df["humidity_rolling_std"] = (
        df.groupby("station_id")["humidity"]
        .transform(
            lambda x: x.rolling(window, min_periods=2).std()
        )
    )

    df["pressure_rolling_std"] = (
        df.groupby("station_id")["pressure"]
        .transform(
            lambda x: x.rolling(window, min_periods=2).std()
        )
    )

    df["temperature_deviation"] = (
        df["temperature"] - df["temperature_rolling_mean"]
    )

    df["humidity_deviation"] = (
        df["humidity"] - df["humidity_rolling_mean"]
    )

    df["pressure_deviation"] = (
        df["pressure"] - df["pressure_rolling_mean"]
    )

    df["temperature_abs_change"] = (
        df["temperature_rate"].abs()
    )

    df["humidity_abs_change"] = (
        df["humidity_rate"].abs()
    )

    df["pressure_abs_change"] = (
        df["pressure_rate"].abs()
    )

    df["temperature_humidity_ratio"] = (
        df["temperature"] / (df["humidity"] + 1)
    )

    df = df.replace(
        [np.inf, -np.inf],
        np.nan
    )

    return df


if __name__ == "__main__":
    input_file = "data/cleaned_weather_data.csv"
    output_file = "data/feature_engineered_weather.csv"

    df = pd.read_csv(input_file)

    feature_df = create_features(df)

    feature_df.to_csv(
        output_file,
        index=False
    )

    print("Feature engineering completed successfully!")
    print("Output file:", output_file)
    print("Dataset shape:", feature_df.shape)
    print(feature_df.head())
