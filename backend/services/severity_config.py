"""
Centralized severity configuration — SINGLE SOURCE OF TRUTH.
Both anomaly_detection.py and routers/frontend MUST use these thresholds.
Do NOT duplicate thresholds in React.
"""

# Severity thresholds for anomaly_score [0,1] per-batch normalized
# Higher = more anomalous (inverted IsolationForest decision_function)
SEVERITY_THRESHOLDS = {
    # Forced deterministic anomalies (frozen >=3, missing, physical range)
    # are at least HIGH; only score >=0.92 becomes CRITICAL
    "forced_critical": 0.92,
    # Statistical (IsolationForest) anomalies
    "high": 0.88,      # >=0.88 -> HIGH (or forced fallback)
    "medium": 0.80,    # >=0.80 -> MEDIUM
    # else -> LOW (<0.80)
    # NORMAL -> none (is_anomaly==False)
}

SEVERITY_LABELS = ["NORMAL", "LOW", "MEDIUM", "HIGH", "CRITICAL"]
# Backend stores lower-case: "none", "low", "medium", "high", "critical"
# Frontend displays Title-Case: "Low", "Medium", "High" (critical mapped to High for backward compat)
# But new spec exposes CRITICAL explicitly

def get_severity(score: float, is_anomaly: bool, is_forced: bool) -> str:
    """Deterministic severity bucket — mirrors anomaly_detection.py logic."""
    if not is_anomaly:
        return "none"
    if is_forced:
        if score >= SEVERITY_THRESHOLDS["forced_critical"]:
            return "critical"
        return "high"
    if score >= SEVERITY_THRESHOLDS["high"]:
        return "high"
    if score >= SEVERITY_THRESHOLDS["medium"]:
        return "medium"
    return "low"

def severity_to_display(sev: str) -> str:
    m = {"critical": "Critical", "high": "High", "medium": "Medium", "low": "Low", "none": "Normal"}
    return m.get(str(sev).lower(), "Low")

def severity_color(sev: str) -> str:
    m = {"critical": "#ef4444", "high": "#ef4444", "medium": "#f97316", "low": "#facc15", "none": "#00c896"}
    return m.get(str(sev).lower(), "#4a6d8c")
