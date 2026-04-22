"""
Anomaly Detection Model — Isolation Forest (per-patient)

Replaces fixed-threshold alerts (agitation > 7 → alert) with anomaly
detection on each patient's own baseline, so alerts fire when behaviour
deviates from *their* normal rather than a global cutoff.

One model is stored per patient: saved_models/anomaly_{patientId}.joblib
"""

import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

from utils.feature_engineering import logs_to_dataframe, FEATURE_COLUMNS

MODEL_DIR = Path(__file__).parent.parent / "saved_models"

# Contamination = expected proportion of anomalous days in normal operations.
# ~10% feels right for a dementia patient (1 rough day per 10 days).
CONTAMINATION = 0.10


def _model_path(patient_id: str) -> Path:
    return MODEL_DIR / f"anomaly_{patient_id}.joblib"

def _scaler_path(patient_id: str) -> Path:
    return MODEL_DIR / f"anomaly_scaler_{patient_id}.joblib"


class AnomalyModel:
    """Per-patient Isolation Forest wrapper."""

    def __init__(self):
        self._models:  dict[str, IsolationForest] = {}
        self._scalers: dict[str, StandardScaler]  = {}

    # ── Training ────────────────────────────────────────────────────────────

    def train_patient(self, patient_id: str, logs: list[dict]) -> dict:
        """
        Build/rebuild the anomaly model for one patient.
        Minimum 14 days of logs recommended.
        """
        if len(logs) < 7:
            return {"status": "skipped", "reason": "Need at least 7 logs", "patient_id": patient_id}

        df      = logs_to_dataframe(logs)
        scaler  = StandardScaler()
        X       = scaler.fit_transform(df[FEATURE_COLUMNS].values)

        model = IsolationForest(
            n_estimators=100,
            contamination=CONTAMINATION,
            random_state=42,
            n_jobs=-1,
        )
        model.fit(X)

        MODEL_DIR.mkdir(exist_ok=True)
        joblib.dump(model,  _model_path(patient_id))
        joblib.dump(scaler, _scaler_path(patient_id))

        self._models[patient_id]  = model
        self._scalers[patient_id] = scaler

        return {
            "status":       "trained",
            "patient_id":   patient_id,
            "samples_used": len(logs),
        }

    # ── Inference ───────────────────────────────────────────────────────────

    def _load_patient(self, patient_id: str) -> bool:
        mp = _model_path(patient_id)
        sp = _scaler_path(patient_id)
        if mp.exists() and sp.exists():
            self._models[patient_id]  = joblib.load(mp)
            self._scalers[patient_id] = joblib.load(sp)
            return True
        return False

    def detect(self, patient_id: str, logs: list[dict]) -> dict:
        """
        Detect anomalies in the supplied logs.
        Returns a flag for each log day plus an overall alert recommendation.
        logs should be ordered oldest → newest.
        """
        if patient_id not in self._models:
            self._load_patient(patient_id)

        if patient_id not in self._models:
            # No trained model yet — use z-score simple fallback
            return self._zscore_fallback(patient_id, logs)

        model  = self._models[patient_id]
        scaler = self._scalers[patient_id]

        df = logs_to_dataframe(logs)
        X  = scaler.transform(df[FEATURE_COLUMNS].values)

        # Isolation Forest: -1 = anomaly, 1 = normal
        raw_predictions  = model.predict(X)           # array of -1 / 1
        anomaly_scores   = model.score_samples(X)     # lower = more anomalous

        flags = (raw_predictions == -1).tolist()

        # Severity: normalise anomaly score to 0-1 (higher = more anomalous)
        min_s, max_s = anomaly_scores.min(), anomaly_scores.max()
        range_s = max_s - min_s if max_s != min_s else 1.0
        severity = ((anomaly_scores - min_s) / range_s)
        severity = (1 - severity).tolist()            # invert: 1 = most anomalous

        today_anomalous    = bool(flags[-1]) if flags else False
        today_severity     = round(float(severity[-1]), 3) if severity else 0.0
        consecutive_anomalies = 0
        for f in reversed(flags):
            if f:
                consecutive_anomalies += 1
            else:
                break

        alert_level = "none"
        if today_anomalous and consecutive_anomalies >= 3:
            alert_level = "HIGH"
        elif today_anomalous and consecutive_anomalies >= 2:
            alert_level = "MEDIUM"
        elif today_anomalous:
            alert_level = "LOW"

        return {
            "patient_id":             patient_id,
            "today_anomalous":        today_anomalous,
            "today_severity":         today_severity,
            "consecutive_anomalies":  consecutive_anomalies,
            "alert_level":            alert_level,
            "flags":                  flags,
            "model":                  "isolation_forest",
        }

    def _zscore_fallback(self, patient_id: str, logs: list[dict]) -> dict:
        """Simple Z-score anomaly detection when no trained model exists."""
        if len(logs) < 3:
            return {
                "patient_id": patient_id, "today_anomalous": False,
                "today_severity": 0.0, "consecutive_anomalies": 0,
                "alert_level": "none", "flags": [], "model": "zscore_fallback"
            }

        df      = logs_to_dataframe(logs)
        X       = df[FEATURE_COLUMNS].values
        means   = X[:-1].mean(axis=0)
        stds    = X[:-1].std(axis=0) + 1e-6
        today   = X[-1]
        z       = np.abs((today - means) / stds)
        anomalous = bool(z.max() > 2.5)
        severity  = round(float(np.clip(z.max() / 4.0, 0, 1)), 3)

        return {
            "patient_id":            patient_id,
            "today_anomalous":       anomalous,
            "today_severity":        severity,
            "consecutive_anomalies": 1 if anomalous else 0,
            "alert_level":           "MEDIUM" if anomalous else "none",
            "flags":                 [False] * (len(logs) - 1) + [anomalous],
            "model":                 "zscore_fallback",
        }


# Singleton
anomaly_model = AnomalyModel()