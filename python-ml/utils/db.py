"""
Shared MongoDB connection for training scripts.
Production inference uses data passed via the API, not direct DB reads,
so the FastAPI app itself does not import this module.
"""

import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

_client: MongoClient | None = None


def get_db():
    global _client
    if _client is None:
        uri = os.getenv("MONGODB_URI") or os.getenv("MONGO_URI") or "mongodb://localhost:27017"
        _client = MongoClient(uri)
    db_name = os.getenv("MONGODB_DB") or os.getenv("MONGO_DB") or "reminiscence"
    return _client[db_name]


def fetch_all_logs(days: int = 180) -> list[dict]:
    """Fetch recent DailyHealthLog documents across all patients."""
    from datetime import datetime, timedelta
    db = get_db()
    since = datetime.utcnow() - timedelta(days=days)
    cursor = db["dailyhealthlogs"].find(
        {
            "date": {"$gte": since},
            "patientId": {"$exists": True, "$ne": None}
        },
        {"_id": 0, "patientId": 1, "date": 1,
         "mood": 1, "confusionLevel": 1, "gotLost": 1,
         "medication": 1, "sleep": 1, "food": 1, "activity": 1,
         "agitationLevel": 1, "sleepHours": 1, "appetiteLevel": 1,
         "moodScore": 1, "tasksCompleted": 1, "exerciseMinutes": 1,
         "socialInteractions": 1, "alertsTriggered": 1}
    ).sort("date", 1)
    return list(cursor)


def fetch_patient_logs(patient_id: str, days: int = 90) -> list[dict]:
    from datetime import datetime, timedelta
    db = get_db()
    since = datetime.utcnow() - timedelta(days=days)
    cursor = db["dailyhealthlogs"].find(
        {"patientId": patient_id, "date": {"$gte": since}},
    ).sort("date", 1)
    return list(cursor)


def fetch_intervention_effects() -> list[dict]:
    db = get_db()
    cursor = db["interventioneffects"].find(
        {"overallOutcome": {"$in": ["positive", "significantly_positive",
                                    "negative", "significantly_negative", "neutral"]}},
        {"_id": 0, "baseline": 1, "measurement": 1, "overallOutcome": 1,
         "interventionType": 1, "confidence": 1}
    )
    return list(cursor)