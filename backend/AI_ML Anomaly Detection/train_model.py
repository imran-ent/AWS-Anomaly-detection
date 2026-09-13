"""
train_model.py
------------------------------------------------------------------------
SkyGuard AI - AI/ML Anomaly Detection layer for Automatic Weather Stations
(Ministry of Earth Sciences / IMD - SIH 2026)

WHAT THIS TRAINS
    1. IsolationForest              -> unsupervised anomaly detector.
       Learns "normal" temperature/humidity/pressure behaviour without
       needing labels, so it generalises to a brand-new AWS station that
       has no history of confirmed faults. This is the PRIMARY detector.

    2. RandomForestClassifier       -> supervised root-cause classifier.
       Trained ONLY on the rows the dataset already labels as anomalous
       (anomaly == 1), to answer "given this IS an anomaly, what kind is
       it?" (Spike / Drift / Frozen / Communication Error / ...). This is
       a separate job from detection itself. If fault_type labels are too
       sparse or unknown, this step is skipped and anomaly_detection.py
       falls back to a transparent rule-based root-cause labeler instead.

HOW TO RUN (offline, once, whenever new training data is available)
    python train_model.py --input data/feature_engineered_weather.csv

INPUT
    A CSV that is the output of:
        features.create_features(preprocessing.preprocess_data(raw_df))
    i.e. must contain at least:
        station_id, temperature, humidity, pressure,
        temperature_scaled, humidity_scaled, pressure_scaled,
        temperature_rate, humidity_rate, pressure_rate,
        temperature_rolling_mean/std, humidity_rolling_mean/std,
        pressure_rolling_mean/std,
        temperature_deviation, humidity_deviation, pressure_deviation,
        temperature_abs_change, humidity_abs_change, pressure_abs_change,
        is_missing, physical_range_flag
    Optional (used for training/evaluation only, NOT required for
    live/streaming data): anomaly, fault_type

OUTPUT (written to --output_dir, default ./models/)
    isolation_forest.joblib        the trained unsupervised detector
    root_cause_classifier.joblib   (only if usable fault_type labels exist)
    fault_label_encoder.joblib     (only if the classifier above was trained)
    feature_config.joblib          exact feature list + order used, so
                                    anomaly_detection.py stays in sync
------------------------------------------------------------------------
"""

import argparse
import os

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.metrics import classification_report, f1_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder

# Feature set used by the unsupervised anomaly detector. Order matters for
# some model internals and MUST match anomaly_detection.py exactly.

ISOLATION_FOREST_FEATURES = [
    "temperature_scaled", "humidity_scaled", "pressure_scaled",
    "temperature_rate", "humidity_rate", "pressure_rate",
    "temperature_rolling_std", "humidity_rolling_std", "pressure_rolling_std",
    "temperature_deviation", "humidity_deviation", "pressure_deviation",
    "temperature_abs_change", "humidity_abs_change", "pressure_abs_change",
    "temp_pressure_consistency", "humidity_saturation_flag", "frozen_run_length",
]

# Root-cause classifier gets a couple of extra binary flags on top, since
# those are strong direct signals of *why*, even though they're too blunt
# to use as the main anomaly score.
ROOT_CAUSE_FEATURES = ISOLATION_FOREST_FEATURES + ["is_missing", "physical_range_flag"]


def add_extra_signals(df):
   
    df = df.copy()

    for c in ["temperature_rate", "humidity_rate", "pressure_rate"]:
        if c not in df.columns:
            df[c] = 0.0

    df["temp_pressure_consistency"] = (
        df["temperature_rate"].abs() - df["pressure_rate"].abs()
    ).abs()

    df["humidity_saturation_flag"] = (
        (df["humidity"] > 100) | (df["humidity"] < 0)
    ).astype(int)

    def run_length(series):
        # Full run size assigned to every member of the run (see matching
        # note in anomaly_detection.py's copy of this function).
        same_as_prev = series.eq(series.shift())
        grp = (~same_as_prev).cumsum()
        return series.groupby(grp).transform("size")

    frozen_runs = []
    for col in ["temperature", "humidity", "pressure"]:
        r = df.groupby("station_id")[col].transform(run_length)
        frozen_runs.append(r)
    df["frozen_run_length"] = np.maximum.reduce(frozen_runs)

    return df


def prepare_training_data(df):
    df = add_extra_signals(df)
    for col in ISOLATION_FOREST_FEATURES:
        if col not in df.columns:
            df[col] = 0.0
    # First 1-4 rows per station have NaN rate/rolling-std (not enough
    # history yet) -- 0 correctly encodes "no signal of abnormal change".
    df[ISOLATION_FOREST_FEATURES] = df[ISOLATION_FOREST_FEATURES].fillna(0.0)
    return df


def train(input_csv, output_dir="models", contamination=0.02):
    os.makedirs(output_dir, exist_ok=True)
    df = pd.read_csv(input_csv)
    df = prepare_training_data(df)

    has_labels = "anomaly" in df.columns

    # ---- 1. Unsupervised anomaly detector ----
    if has_labels:
        normal_df = df[df["anomaly"] == 0]
        train_source = normal_df if len(normal_df) > 1000 else df
    else:
        train_source = df

    X_train = train_source[ISOLATION_FOREST_FEATURES]

    iso_forest = IsolationForest(
        n_estimators=200,
        contamination=contamination,
        max_samples="auto",
        random_state=42,
        n_jobs=-1,
    )
    iso_forest.fit(X_train)
    joblib.dump(iso_forest, os.path.join(output_dir, "isolation_forest.joblib"))
    print(f"[OK] IsolationForest trained on {len(X_train)} rows "
          f"({'known-normal only' if has_labels else 'all rows, unlabeled'}).")

    if has_labels:
        preds = (iso_forest.predict(df[ISOLATION_FOREST_FEATURES]) == -1).astype(int)
        f1 = f1_score(df["anomaly"], preds)
        print(f"[EVAL] IsolationForest vs ground truth -> F1 = {f1:.3f}")
        print(classification_report(df["anomaly"], preds, digits=3))

    # ---- 2. Supervised root-cause classifier ----
    if has_labels and "fault_type" in df.columns:
        anomaly_rows = df[df["anomaly"] == 1].copy()
        anomaly_rows = anomaly_rows[anomaly_rows["fault_type"].notna()]
        anomaly_rows = anomaly_rows[anomaly_rows["fault_type"].str.lower() != "normal"]

        label_counts = anomaly_rows["fault_type"].value_counts()
        usable_labels = label_counts[label_counts >= 20].index
        anomaly_rows = anomaly_rows[anomaly_rows["fault_type"].isin(usable_labels)]

        if anomaly_rows["fault_type"].nunique() >= 2 and len(anomaly_rows) >= 50:
            le = LabelEncoder()
            y = le.fit_transform(anomaly_rows["fault_type"])
            X = anomaly_rows[ROOT_CAUSE_FEATURES].fillna(0.0)

            X_tr, X_te, y_tr, y_te = train_test_split(
                X, y, test_size=0.2, random_state=42, stratify=y
            )
            clf = RandomForestClassifier(
                n_estimators=300, max_depth=12, random_state=42,
                class_weight="balanced", n_jobs=-1,
            )
            clf.fit(X_tr, y_tr)
            acc = clf.score(X_te, y_te)
            print(f"[OK] Root-cause classifier trained on {len(anomaly_rows)} anomalous rows. "
                  f"Test accuracy = {acc:.3f}")
            print(classification_report(y_te, clf.predict(X_te),
                                         target_names=le.classes_, digits=3))

            joblib.dump(clf, os.path.join(output_dir, "root_cause_classifier.joblib"))
            joblib.dump(le, os.path.join(output_dir, "fault_label_encoder.joblib"))
        else:
            print("[WARN] Not enough distinct/well-populated fault_type labels "
                  "to train a root-cause classifier. Rule-based fallback will be used.")
    else:
        print("[WARN] No fault_type ground truth found. Rule-based root-cause "
              "fallback in anomaly_detection.py will be used instead.")

    joblib.dump(
        {"isolation_forest_features": ISOLATION_FOREST_FEATURES,
         "root_cause_features": ROOT_CAUSE_FEATURES},
        os.path.join(output_dir, "feature_config.joblib"),
    )
    print(f"[DONE] Artifacts saved to ./{output_dir}/")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="data/feature_engineered_weather.csv")
    parser.add_argument("--output_dir", default="models")
    parser.add_argument("--contamination", type=float, default=0.02)
    args = parser.parse_args()
    train(args.input, args.output_dir, args.contamination)
