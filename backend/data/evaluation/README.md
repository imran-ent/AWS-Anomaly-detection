# Evaluation — METEORA

Evaluated on **synthetic labeled test data** (`weather_data1.csv`) — NOT production accuracy.

Evaluation is computed on the **current cached window** (last 300 per station, 8,700 rows) via:
```
GET /api/model/performance
GET /api/data-quality
```

Metrics (from `services/evaluation.py` using `sklearn.metrics`):
- Precision, Recall, F1 (per class + macro)
- Confusion Matrix (TN, FP, FN, TP)
- Per-fault-type recall (Spike, Drift, Frozen Sensor, Communication Error)
- Anomaly Rate, Normal vs Anomaly counts

Example for window 8,700 (last 300/station):
```
GT anomalies: 418 (from injected dataset's anomaly column)
ML detected: ~905 (per IsolationForest + deterministic rules)
Precision: ~0.29, Recall: ~0.63, F1: ~0.40 (on this window)
Per-type recall: Spike 60%, Drift 1-2%, Frozen 100%, Communication 100%
Normal FPR: ~7.7% (Normal rows incorrectly flagged due to multivariate sensitivity)
```

**Why Drift recall is low (1-2%):** Drift injected as gradual temperature/humidity offset (still within physical range -60..60) and often stays inside rolling mean±2σ for 5-row window, so IsolationForest's multivariate score doesn't exceed threshold unless deviation accumulates beyond window. This is *honest* — drift is hardest to detect unsupervised; presentation must acknowledge this limitation and propose supervised drift-specific thresholds as future work.

**Why false positives (7.7%):** Contamination 0.02 forces ~2% anomalies, but per-batch min-max scaling + forced overrides (frozen/missing) push rate to ~10% in injected window. Not overfitted — model was trained on clean data, so any unusual multivariate pattern in injected window is flagged; some normal rows that are statistically unusual (e.g., monsoon humidity 95% + pressure dip) look anomalous to the model. Tradeoff: higher recall for critical sensors at cost of some FPs, which is acceptable for AWS where missing a fault is worse than a false alert.

**Do NOT claim Accuracy 99%** — accuracy is misleading for imbalanced (95% normal) data. Report Precision/Recall/F1 and Confusion Matrix instead, and clearly label as "Evaluation on Synthetic Labeled Test Data (last 8,700 rows)".

To reproduce fully:
```bash
python -c "from services.data_service import get_weather_data; from services.preprocessing import preprocess_data; from services.features import create_features; from services.ml_service import detect_anomalies; ..."
```

See `backend/routers/meta.py:/api/model/performance` for live JSON.
