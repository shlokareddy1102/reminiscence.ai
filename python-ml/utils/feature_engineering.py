"""
Feature engineering: converts raw DailyHealthLog documents into numeric
feature vectors that the ML models can consume.

Mirrors the categorical mappings already in interventionAnalysisService.js
so both sides of the stack agree on what numbers mean.
"""

import numpy as np
import pandas as pd

# ── Categorical → numeric maps (0-10 scale, same as Node service) ──────────
MOOD_MAP        = {"calm": 8, "confused": 4, "agitated": 2}
SLEEP_MAP       = {"good": 8, "disturbed": 5, "poor": 2}
FOOD_MAP        = {"normal": 8, "skipped": 2, "unknown": 4}
ACTIVITY_MAP    = {"high": 9, "medium": 6, "low": 3, "unknown": 4}
MEDICATION_MAP  = {"taken": 9, "missed": 1, "unknown": 4}
CONFUSION_MAP   = {"none": 0, "mild": 3, "moderate": 6, "severe": 10}


def log_to_features(log: dict) -> dict:
    """
    Convert a single DailyHealthLog dict to a flat numeric feature dict.
    Prefers stored numeric fields; falls back to categorical conversion.
    """
    mood_num       = log.get("moodScore")       or MOOD_MAP.get(log.get("mood", "calm"), 5)
    sleep_num      = log.get("sleepHours")      or SLEEP_MAP.get(log.get("sleep", "good"), 5)
    appetite_num   = log.get("appetiteLevel")   or FOOD_MAP.get(log.get("food", "normal"), 5)
    agitation_num  = log.get("agitationLevel")  or (10 - MOOD_MAP.get(log.get("mood", "calm"), 5))
    activity_num   = ACTIVITY_MAP.get(log.get("activity", "medium"), 5)
    medication_num = MEDICATION_MAP.get(log.get("medication", "unknown"), 4)
    confusion_num  = CONFUSION_MAP.get(log.get("confusionLevel", "none"), 0)

    return {
        "mood_score":       float(mood_num),
        "sleep_score":      float(sleep_num),
        "appetite_score":   float(appetite_num),
        "agitation_score":  float(agitation_num),
        "activity_score":   float(activity_num),
        "medication_score": float(medication_num),
        "confusion_score":  float(confusion_num),
        "got_lost":         float(1 if log.get("gotLost") else 0),
        "tasks_completed":  float(log.get("tasksCompleted", 0)),
        "exercise_minutes": float(log.get("exerciseMinutes", 0)),
        "social_interactions": float(log.get("socialInteractions", 0)),
        "alerts_triggered": float(log.get("alertsTriggered", 0)),
    }


FEATURE_COLUMNS = [
    "mood_score", "sleep_score", "appetite_score", "agitation_score",
    "activity_score", "medication_score", "confusion_score", "got_lost",
    "tasks_completed", "exercise_minutes", "social_interactions", "alerts_triggered",
]


def logs_to_dataframe(logs: list[dict]) -> pd.DataFrame:
    """Convert a list of log dicts to a feature DataFrame."""
    rows = [log_to_features(log) for log in logs]
    if not rows:
        return pd.DataFrame(columns=FEATURE_COLUMNS)
    df = pd.DataFrame(rows)[FEATURE_COLUMNS]
    return df.fillna(df.median(numeric_only=True))


def rolling_features(df: pd.DataFrame, window: int = 3) -> pd.DataFrame:
    """
    Append rolling-window stats (mean + std over last N days).
    Gives the model short-term trend context beyond a single day.
    """
    rolled = df[FEATURE_COLUMNS].rolling(window=window, min_periods=1)
    means = rolled.mean().add_suffix(f"_roll{window}m")
    stds  = rolled.std(ddof=0).fillna(0).add_suffix(f"_roll{window}s")
    return pd.concat([df, means, stds], axis=1)


def compute_rule_based_delta(log: dict) -> float:
    """
    Reproduce the exact computeDailyRiskDelta from reports.js so the ML
    model can use the rule-based score as one of its input features.
    """
    score_map = {
        "mood":           {"calm": -6,  "confused": 8,  "agitated": 15},
        "confusionLevel": {"none": -2,  "mild": 4,      "moderate": 9, "severe": 14},
        "gotLost":        {"True": 15,  "False": -1},
        "medication":     {"taken": -2, "missed": 12,   "unknown": 2},
        "sleep":          {"good": -4,  "disturbed": 5, "poor": 10},
        "food":           {"normal": -1,"skipped": 7,   "unknown": 1},
        "activity":       {"high": -4,  "medium": 0,    "low": 6,   "unknown": 1},
    }
    delta  = score_map["mood"].get(log.get("mood", "calm"), 0)
    delta += score_map["confusionLevel"].get(log.get("confusionLevel", "none"), 0)
    delta += score_map["gotLost"].get(str(log.get("gotLost", False)), 0)
    delta += score_map["medication"].get(log.get("medication", "unknown"), 2)
    delta += score_map["sleep"].get(log.get("sleep", "good"), 0)
    delta += score_map["food"].get(log.get("food", "normal"), 0)
    delta += score_map["activity"].get(log.get("activity", "medium"), 0)
    return float(delta)