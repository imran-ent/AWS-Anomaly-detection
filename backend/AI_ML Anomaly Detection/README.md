# Pipeline Overview

The raw AWS dataset (~842,000 hourly records across multiple stations, containing temperature, humidity, pressure, and ground-truth anomaly/fault labels) is first cleaned by the preprocessing stage, which standardizes columns, parses timestamps, removes duplicates, and flags missing or physically invalid readings without deleting them. The feature engineering stage then adds time-based attributes, rate-of-change values, rolling averages, rolling standard deviations, and deviation-from-average metrics for each parameter. The output of this stage is the input to the AI/ML anomaly detection module described below.

---

# train_model.py

Offline training script for the anomaly detection system. Trains an Isolation Forest model on the feature-engineered dataset to learn normal temperature, humidity, and pressure behavior without requiring labeled examples. Where sufficient labeled fault data exists, it additionally trains a Random Forest classifier to distinguish between fault categories (Spike, Drift, Frozen Sensor, Communication Error). Also computes two additional signals not present in the upstream pipeline: a temperature-pressure consistency measure and a frozen-sensor run-length indicator. Outputs trained model files to the `models/` folder. Run once, or whenever training data is updated.

---

# anomaly_detection.py

Runtime module exposing the function `detect_anomalies(df)`, used by the backend for live anomaly checking. Loads the trained models from `models/` and applies them to incoming data. Computes an anomaly score and severity level for each reading, applies deterministic override rules for cases the model alone cannot reliably catch (missing data, frozen sensors, physically impossible values), classifies the likely fault type, generates a plain-language explanation, proposes a corrected value where applicable, and tracks each station's ongoing sensor health status.

---

# isolation_forest.joblib

Serialized, pre-trained Isolation Forest model produced by `train_model.py`. Stores the model's learned parameters so it can be reused for detection without retraining. Loaded automatically inside `anomaly_detection.py` and used to score incoming readings for anomaly likelihood. Must remain in the `models/` folder alongside the other model artifacts.


---

# feature_config.joblib

Serialized record of the exact feature columns used during training, in the required order. Ensures that the same set of inputs is used consistently during both training and live detection, preventing mismatches if the pipeline is modified later. Loaded automatically inside `anomaly_detection.py`.

##LIBERARIES USED IN THE CODE:  pandas , numpy , scikit-learn and joblib
