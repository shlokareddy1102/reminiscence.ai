"""
Intervention Recommender — K-Nearest Neighbours on InterventionEffect history

Finds patients whose feature profile most closely matches the current patient,
then surfaces interventions that worked for them.

Falls back to rule-based recommendations (same as current reasoningPipeline)
when not enough InterventionEffect data exists.
"""

import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import StandardScaler

from utils.feature_engineering import log_to_features, FEATURE_COLUMNS

MODEL_DIR  = Path(__file__).parent.parent / "saved_models"
KNN_PATH   = MODEL_DIR / "intervention_knn.joblib"
SCL_PATH   = MODEL_DIR / "intervention_scaler.joblib"
DATA_PATH  = MODEL_DIR / "intervention_data.joblib"   # stores the raw effect rows


class InterventionModel:

    def __init__(self):
        self.knn     = None
        self.scaler  = None
        self.effects = []     # list of dicts with baseline features + outcome
        self._loaded = False

    # ── Training ────────────────────────────────────────────────────────────

    def train(self, intervention_effects: list[dict]) -> dict:
        """
        intervention_effects: list of InterventionEffect documents from MongoDB
        Each must have: baseline (metrics dict), overallOutcome, interventionType,
                        description, confidence
        """
        positive = [
            e for e in intervention_effects
            if e.get("overallOutcome") in ("positive", "significantly_positive")
               and e.get("confidence", 0) >= 0.55
        ]

        if len(positive) < 5:
            return {"status": "skipped", "reason": "Need ≥5 positive InterventionEffect records"}

        rows = []
        for e in positive:
            baseline = e.get("baseline", {})
            feats = log_to_features(baseline)    # reuse feature engineering
            rows.append({
                **feats,
                "_description":       e.get("description", ""),
                "_interventionType":  e.get("interventionType", "other"),
                "_outcome":           e.get("overallOutcome", ""),
                "_confidence":        float(e.get("confidence", 0.5)),
            })

        df = pd.DataFrame(rows)
        X  = df[FEATURE_COLUMNS].values

        scaler = StandardScaler()
        X_sc   = scaler.fit_transform(X)

        knn = NearestNeighbors(n_neighbors=min(5, len(rows)), metric="euclidean", n_jobs=-1)
        knn.fit(X_sc)

        MODEL_DIR.mkdir(exist_ok=True)
        joblib.dump(knn,   KNN_PATH)
        joblib.dump(scaler, SCL_PATH)
        joblib.dump(rows,  DATA_PATH)

        self.knn     = knn
        self.scaler  = scaler
        self.effects = rows
        self._loaded = True

        return {"status": "trained", "positive_effects_used": len(positive)}

    # ── Inference ────────────────────────────────────────────────────────────

    def _load(self):
        if KNN_PATH.exists() and SCL_PATH.exists() and DATA_PATH.exists():
            self.knn     = joblib.load(KNN_PATH)
            self.scaler  = joblib.load(SCL_PATH)
            self.effects = joblib.load(DATA_PATH)
            self._loaded = True

    def recommend(self, recent_logs: list[dict], top_k: int = 3) -> dict:
        """
        recent_logs: last 7 days of DailyHealthLog dicts for the patient.
        Returns top_k intervention recommendations ranked by similarity + confidence.
        """
        if not self._loaded:
            self._load()

        if not self._loaded or not self.effects:
            return self._rule_fallback(recent_logs, top_k)

        # Average features over recent logs to get patient's current profile
        if not recent_logs:
            return self._rule_fallback(recent_logs, top_k)

        feat_rows = [log_to_features(log) for log in recent_logs]
        avg_feats = {k: float(np.mean([r[k] for r in feat_rows])) for k in FEATURE_COLUMNS}
        X_query   = np.array([[avg_feats[c] for c in FEATURE_COLUMNS]])
        X_sc      = self.scaler.transform(X_query)

        distances, indices = self.knn.kneighbors(X_sc)
        distances  = distances[0]
        indices    = indices[0]

        seen        = set()
        recs        = []
        for dist, idx in zip(distances, indices):
            e = self.effects[idx]
            key = e["_description"]
            if key in seen:
                continue
            seen.add(key)
            # similarity score: closer distance = higher similarity
            similarity = float(np.exp(-dist))
            recs.append({
                "recommendation":  e["_description"],
                "interventionType": e["_interventionType"],
                "confidence":      round(float(e["_confidence"]) * similarity, 3),
                "successRate":     round(similarity, 3),
                "reasoning":       f"Worked for patients with a similar behavioral profile (similarity {round(similarity*100)}%).",
                "safetyLevel":     _safety_level(e["_interventionType"]),
            })
            if len(recs) >= top_k:
                break

        return {
            "recommendations": recs,
            "model":           "knn_collaborative",
            "similar_effects": len(indices),
        }

    def _rule_fallback(self, logs: list[dict], top_k: int) -> dict:
        """Mirrors the fallback logic in CaregiverInsights.jsx."""
        recs = []
        if not logs:
            return {"recommendations": [], "model": "rule_fallback", "similar_effects": 0}

        poor_sleep = sum(1 for l in logs if l.get("sleep") == "poor")
        missed_med = sum(1 for l in logs if l.get("medication") == "missed")
        low_activity = sum(1 for l in logs if l.get("activity") == "low")

        if poor_sleep >= 2:
            recs.append({
                "recommendation": "Stabilize the bedtime routine and reduce evening stimulation.",
                "interventionType": "schedule_change",
                "confidence": 0.72, "successRate": 0.61, "safetyLevel": "medium",
                "reasoning": "Poor sleep has repeated across recent logs.",
            })
        if missed_med >= 1:
            recs.append({
                "recommendation": "Use stronger medication prompts and caregiver confirmation.",
                "interventionType": "medication_change",
                "confidence": 0.75, "successRate": 0.64, "safetyLevel": "high",
                "reasoning": "Medication adherence dropped in the recent period.",
            })
        if low_activity >= 2:
            recs.append({
                "recommendation": "Add short guided movement blocks during the day.",
                "interventionType": "activity_added",
                "confidence": 0.69, "successRate": 0.58, "safetyLevel": "medium",
                "reasoning": "Low activity is showing up consistently.",
            })
        if not recs:
            recs.append({
                "recommendation": "Continue current routine and keep daily logs flowing.",
                "interventionType": "other",
                "confidence": 0.58, "successRate": 0.5, "safetyLevel": "low",
                "reasoning": "Not enough signal for a stronger recommendation yet.",
            })

        return {
            "recommendations": recs[:top_k],
            "model":           "rule_fallback",
            "similar_effects": 0,
        }


def _safety_level(intervention_type: str) -> str:
    high   = {"medication_change"}
    low    = {"environment_change", "activity_added"}
    return "high" if intervention_type in high else "low" if intervention_type in low else "medium"


# Singleton
intervention_model = InterventionModel()