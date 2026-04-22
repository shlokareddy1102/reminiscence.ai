"""
Risk Score Model — Random Forest Classifier + Regressor

Replaces the hand-tuned computeDailyRiskDelta heuristic in reports.js.

Output:
  risk_score  : 0-100 continuous score
  risk_level  : STABLE | MILD_RISK | ELEVATED_RISK | CRITICAL
  confidence  : model probability for the predicted class
  feature_importance: top factors driving the score
"""

import os
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report

from utils.feature_engineering import (
    logs_to_dataframe, rolling_features, compute_rule_based_delta, FEATURE_COLUMNS
)

MODEL_DIR  = Path(__file__).parent.parent / "saved_models"
CLF_PATH   = MODEL_DIR / "risk_classifier.joblib"
REG_PATH   = MODEL_DIR / "risk_regressor.joblib"
ENC_PATH   = MODEL_DIR / "risk_label_encoder.joblib"

RISK_THRESHOLDS = {"STABLE": 20, "MILD_RISK": 40, "ELEVATED_RISK": 70}


def score_to_label(score: float) -> str:
    if score >= 70: return "CRITICAL"
    if score >= 40: return "ELEVATED_RISK"
    if score >= 20: return "MILD_RISK"
    return "STABLE"


def _build_labels(logs: list[dict]) -> np.ndarray:
    """
    Generate training labels by applying the rule-based delta formula
    cumulatively, then bucketing into risk classes.
    """
    labels = []
    cumulative = 50.0          # start at neutral midpoint
    for log in logs:
        delta = compute_rule_based_delta(log)
        cumulative = float(np.clip(cumulative + delta * 0.4, 0, 100))
        labels.append(score_to_label(cumulative))
    return np.array(labels)


def _build_scores(logs: list[dict]) -> np.ndarray:
    """Continuous risk score labels for the regressor."""
    scores = []
    cumulative = 50.0
    for log in logs:
        delta = compute_rule_based_delta(log)
        cumulative = float(np.clip(cumulative + delta * 0.4, 0, 100))
        scores.append(cumulative)
    return np.array(scores)


class RiskModel:
    def __init__(self):
        self.clf = None          # RandomForestClassifier (risk level)
        self.reg = None          # RandomForestRegressor  (risk score 0-100)
        self.enc = LabelEncoder()
        self._loaded = False

    # ── Training ────────────────────────────────────────────────────────────

    def train(self, logs: list[dict]) -> dict:
        if len(logs) < 10:
            raise ValueError("Need at least 10 log entries to train the risk model.")

        df     = logs_to_dataframe(logs)
        df     = rolling_features(df, window=3)
        X      = df.values
        y_cls  = _build_labels(logs)
        y_reg  = _build_scores(logs)

        self.enc.fit(y_cls)
        y_enc = self.enc.transform(y_cls)

        X_tr, X_te, yc_tr, yc_te, yr_tr, yr_te = train_test_split(
            X, y_enc, y_reg, test_size=0.2, random_state=42
        )

        self.clf = RandomForestClassifier(
            n_estimators=200, max_depth=8, min_samples_leaf=2,
            class_weight="balanced", random_state=42, n_jobs=-1
        )
        self.clf.fit(X_tr, yc_tr)

        self.reg = RandomForestRegressor(
            n_estimators=200, max_depth=8, min_samples_leaf=2,
            random_state=42, n_jobs=-1
        )
        self.reg.fit(X_tr, yr_tr)

        MODEL_DIR.mkdir(exist_ok=True)
        joblib.dump(self.clf, CLF_PATH)
        joblib.dump(self.reg, REG_PATH)
        joblib.dump(self.enc, ENC_PATH)
        self._loaded = True

        yc_pred = self.clf.predict(X_te)
        present_labels = np.unique(np.concatenate([yc_te, yc_pred]))
        present_names = self.enc.inverse_transform(present_labels)
        report = classification_report(
            yc_te,
            yc_pred,
            labels=present_labels,
            target_names=present_names,
            output_dict=True,
            zero_division=0
        )
        return {
            "samples_trained": len(logs),
            "classification_report": report,
            "feature_count": X.shape[1],
        }

    # ── Inference ───────────────────────────────────────────────────────────

    def load(self):
        if CLF_PATH.exists() and REG_PATH.exists() and ENC_PATH.exists():
            self.clf = joblib.load(CLF_PATH)
            self.reg = joblib.load(REG_PATH)
            self.enc = joblib.load(ENC_PATH)
            self._loaded = True

    def predict(self, logs: list[dict]) -> dict:
        """
        logs: list of recent DailyHealthLog dicts for one patient (most
              recent last). Uses last log as today + rolling window context.
        """
        if not self._loaded or self.clf is None:
            # Graceful fallback: use rule-based delta when model not trained
            return self._fallback(logs)

        df  = logs_to_dataframe(logs)
        df  = rolling_features(df, window=3)
        X   = df.values[-1].reshape(1, -1)   # only predict on today's row

        risk_score  = float(np.clip(self.reg.predict(X)[0], 0, 100))
        proba       = self.clf.predict_proba(X)[0]
        class_idx   = int(np.argmax(proba))
        risk_level  = self.enc.inverse_transform([class_idx])[0]
        confidence  = float(proba[class_idx])

        # Feature importance for the top features (uses classifier)
        feat_names  = list(df.columns)
        importances = self.clf.feature_importances_
        top_n       = 5
        top_idx     = np.argsort(importances)[::-1][:top_n]
        top_factors = [
            {"feature": feat_names[i], "importance": round(float(importances[i]), 3)}
            for i in top_idx
        ]

        return {
            "risk_score":         round(risk_score, 1),
            "risk_level":         risk_level,
            "confidence":         round(confidence, 3),
            "top_factors":        top_factors,
            "model":              "random_forest",
        }

    def _fallback(self, logs: list[dict]) -> dict:
        """Rule-based fallback identical to reports.js when model not ready."""
        if not logs:
            return {"risk_score": 50.0, "risk_level": "MILD_RISK",
                    "confidence": 0.5, "top_factors": [], "model": "rule_based"}

        cumulative = 50.0
        for log in logs[-7:]:          # last 7 days
            delta = compute_rule_based_delta(log)
            cumulative = float(np.clip(cumulative + delta * 0.4, 0, 100))

        level = score_to_label(cumulative)
        return {
            "risk_score":  round(cumulative, 1),
            "risk_level":  level,
            "confidence":  0.6,
            "top_factors": [],
            "model":       "rule_based_fallback",
        }


# Singleton
risk_model = RiskModel()