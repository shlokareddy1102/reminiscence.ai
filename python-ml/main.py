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