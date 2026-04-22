"""
Caregiver ML Microservice — FastAPI

Endpoints:
  POST /risk/score           — RF risk score for a patient
  POST /anomaly/detect       — Isolation Forest anomaly/alert detection
  POST /forecast             — Prophet 7-day deterioration forecast
  POST /recommend            — KNN intervention recommendations
  POST /train/risk           — retrain risk model
  POST /train/anomaly        — retrain anomaly model for one patient
  POST /train/interventions  — retrain intervention recommender
  GET  /health               — health check
"""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import Any

from models.risk_model         import risk_model
from models.anomaly_model      import anomaly_model
from models.deterioration_model import deterioration_model
from models.intervention_model  import intervention_model
from models.music_recommender   import music_recommender
 


# ── Startup: load saved models if they exist ────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[ML Service] Loading saved models...")
    risk_model.load()
    print("[ML Service] Ready.")
    yield


app = FastAPI(
    title="Caregiver ML Microservice",
    version="1.0.0",
    lifespan=lifespan,
)


# ── Shared request/response schemas ─────────────────────────────────────────

class LogList(BaseModel):
    """List of DailyHealthLog dicts passed from Node."""
    patient_id: str
    logs: list[dict[str, Any]] = Field(..., min_length=1)

class InterventionTrainRequest(BaseModel):
    intervention_effects: list[dict[str, Any]]

class AnomalyTrainRequest(BaseModel):
    patient_id: str
    logs: list[dict[str, Any]]


class MusicRecommendRequest(BaseModel):
    mood: str = "calm"
    profile: dict[str, Any] = Field(default_factory=dict)
    candidates: list[dict[str, Any]] = Field(default_factory=list)
    limit: int = 8


class MusicImpactRequest(BaseModel):
    sessions: list[dict[str, Any]] = Field(default_factory=list)


def summarize_music_impact(sessions: list[dict[str, Any]]) -> dict[str, Any]:
    total = len(sessions)
    if total == 0:
        return {
            "total_sessions": 0,
            "helpful_rate": 0,
            "avg_score": 0,
            "completion_rate": 0,
        }

    helpful_count = 0
    completed_count = 0
    score_sum = 0.0

    for s in sessions:
        thumbs = s.get("thumbsUp")
        if thumbs is True:
            helpful_count += 1

        if s.get("completed"):
            completed_count += 1

        repeat = float(s.get("repeatCount") or 0)
        skip = s.get("skipAtPercent")
        listened = float(s.get("listenedSeconds") or 0)
        duration = float(s.get("durationSeconds") or 0)

        score = 0.0
        if thumbs is True:
            score += 3.0
        if thumbs is False:
            score -= 3.0
        score += min(repeat * 2.0, 6.0)
        if s.get("completed"):
            score += 1.5
        if skip is not None:
            skip = float(skip)
            if skip < 20:
                score -= 2.0
            elif skip < 50:
                score -= 0.5
            else:
                score += 0.5
        if duration > 0 and listened > 0:
            pct = (listened / duration) * 100
            if pct >= 80:
                score += 1.0
            elif pct >= 50:
                score += 0.3

        score_sum += score

    return {
        "total_sessions": total,
        "helpful_rate": round((helpful_count / total) * 100, 1),
        "avg_score": round(score_sum / total, 2),
        "completion_rate": round((completed_count / total) * 100, 1),
    }


# ── /health ──────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "ok",
        "risk_model_loaded":         risk_model._loaded,
        "intervention_model_loaded": intervention_model._loaded,
    }


# ── /risk/score ──────────────────────────────────────────────────────────────

@app.post("/risk/score")
def risk_score(body: LogList):
    """
    Body: { patient_id, logs: [...DailyHealthLog] }
    Returns: { risk_score, risk_level, confidence, top_factors, model }
    """
    try:
        result = risk_model.predict(body.logs)
        return {"patient_id": body.patient_id, **result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── /anomaly/detect ───────────────────────────────────────────────────────────

@app.post("/anomaly/detect")
def anomaly_detect(body: LogList):
    """
    Body: { patient_id, logs: [...DailyHealthLog] }
    Returns: { today_anomalous, alert_level, consecutive_anomalies, severity, flags }
    """
    try:
        result = anomaly_model.detect(body.patient_id, body.logs)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── /forecast ─────────────────────────────────────────────────────────────────

@app.post("/forecast")
def forecast(body: LogList, horizon_days: int = 7):
    """
    Body: { patient_id, logs: [...DailyHealthLog] }
    Returns: { forecast: [{date, predicted_score, risk_level}], trend, early_warning }
    """
    try:
        result = deterioration_model.predict(body.logs, horizon_days=horizon_days)
        return {"patient_id": body.patient_id, **result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── /recommend ────────────────────────────────────────────────────────────────

@app.post("/recommend")
def recommend(body: LogList, top_k: int = 3):
    """
    Body: { patient_id, logs: [...last 7 days DailyHealthLog] }
    Returns: { recommendations: [{recommendation, confidence, successRate, ...}] }
    """
    try:
        result = intervention_model.recommend(body.logs, top_k=top_k)
        return {"patient_id": body.patient_id, **result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Training endpoints ────────────────────────────────────────────────────────

@app.post("/train/risk")
def train_risk(body: LogList):
    """Retrain the risk model. Pass all available logs."""
    try:
        result = risk_model.train(body.logs)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/train/anomaly")
def train_anomaly(body: AnomalyTrainRequest):
    """Retrain the anomaly model for a single patient."""
    try:
        result = anomaly_model.train_patient(body.patient_id, body.logs)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/train/interventions")
def train_interventions(body: InterventionTrainRequest):
    """Retrain the intervention recommender with InterventionEffect records."""
    try:
        result = intervention_model.train(body.intervention_effects)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/music/recommend")
def music_recommend(body: MusicRecommendRequest):
    """
    Rank candidate tracks for therapeutic music playback.
    """
    try:
        candidates = body.candidates or []
        candidate_ids = [str(item.get("id")) for item in candidates if item.get("id") is not None]
        ranked = music_recommender.recommend(
            patient_id=str((body.profile or {}).get("patient_id") or "anonymous"),
            sessions=[],
            candidate_ids=candidate_ids,
            top_k=body.limit,
        )

        score_map = {str(item.get("trackId")): item.get("score", 0) for item in ranked.get("ranked", [])}
        recommendations = sorted(
            candidates,
            key=lambda item: score_map.get(str(item.get("id")), -9999),
            reverse=True,
        )[: max(1, int(body.limit))]

        return {
            "mood": body.mood,
            "recommendations": recommendations,
            "ranked": ranked.get("ranked", []),
            "model": ranked.get("model", "content_based")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/music/impact")
def music_impact(body: MusicImpactRequest):
    """
    Summarize impact metrics from listening sessions.
    """
    try:
        summary = summarize_music_impact(body.sessions or [])
        return summary
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/music/genres")
def music_genres():
    return {
        "genres": ["ambient", "classical", "instrumental", "acoustic", "jazz", "lofi", "meditation"]
    }

 
class MusicRankRequest(BaseModel):
    patient_id:    str
    sessions:      list[dict[str, Any]]   # ListeningSession docs
    candidate_ids: list[str]              # Jamendo track IDs to rank
    top_k:         int = 20
 
 
class MusicTrainRequest(BaseModel):
    sessions: list[dict[str, Any]]        # all ListeningSession docs
 
 
class SimilarTracksRequest(BaseModel):
    track_id: str
    top_k:    int = 5