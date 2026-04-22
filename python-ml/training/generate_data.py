from __future__ import annotations

import os
import random
from datetime import datetime, timedelta

from dotenv import load_dotenv
from pymongo import MongoClient


load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://127.0.0.1:27017")
MONGODB_DB = os.getenv("MONGODB_DB", "reminiscence")
SEED_DAYS = int(os.getenv("SEED_DAILY_LOG_DAYS", "90"))

client = MongoClient(MONGODB_URI)
db = client[MONGODB_DB]

patients = list(db["patients"].find({}, {"_id": 1, "name": 1, "age": 1}).limit(10))

if not patients:
    raise SystemExit(f"No patients found in {MONGODB_DB}. Add a patient first, then re-run this script.")

collection = db["dailyhealthlogs"]


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def weighted_choice(values: list[str], weights: list[float]) -> str:
    return random.choices(values, weights=weights, k=1)[0]


def random_walk(previous: float, drift: float, low: float, high: float, volatility: float) -> float:
    return clamp(previous + drift + random.uniform(-volatility, volatility), low, high)


def build_log(day_index: int, state: dict[str, float]) -> dict:
    bad_day = random.random() < 0.18
    spike_day = random.random() < 0.08
    calmer_day = random.random() < 0.14

    mood_score = random_walk(state["mood_score"], -0.05 if bad_day else 0.06, 1, 10, 1.4)
    sleep_hours = random_walk(state["sleep_hours"], -0.12 if bad_day else 0.08, 2, 9, 0.9)
    activity_minutes = random_walk(state["activity_minutes"], -4 if bad_day else 3, 0, 75, 10)
    confusion_score = random_walk(state["confusion_score"], 0.28 if bad_day else -0.06, 0, 10, 1.0)
    agitation_score = random_walk(state["agitation_score"], 0.22 if bad_day else -0.07, 0, 10, 1.1)
    appetite_score = random_walk(state["appetite_score"], -0.02 if bad_day else 0.04, 0, 10, 0.8)

    if spike_day:
      mood_score = clamp(mood_score - random.uniform(1.5, 3.5), 1, 10)
      sleep_hours = clamp(sleep_hours - random.uniform(1.0, 2.0), 2, 9)
      activity_minutes = clamp(activity_minutes - random.uniform(10, 20), 0, 75)
      confusion_score = clamp(confusion_score + random.uniform(1.5, 3.5), 0, 10)
      agitation_score = clamp(agitation_score + random.uniform(1.5, 3.5), 0, 10)

    if calmer_day:
      mood_score = clamp(mood_score + random.uniform(0.6, 1.6), 1, 10)
      sleep_hours = clamp(sleep_hours + random.uniform(0.3, 1.2), 2, 9)
      activity_minutes = clamp(activity_minutes + random.uniform(5, 14), 0, 75)
      confusion_score = clamp(confusion_score - random.uniform(0.5, 1.2), 0, 10)
      agitation_score = clamp(agitation_score - random.uniform(0.4, 1.0), 0, 10)

    mood = "calm" if mood_score >= 7.2 else "confused" if mood_score >= 4.6 else "agitated"
    confusion = "none" if confusion_score < 1.8 else "mild" if confusion_score < 4.5 else "moderate" if confusion_score < 7.2 else "severe"
    sleep = "good" if sleep_hours >= 7.1 else "disturbed" if sleep_hours >= 5.2 else "poor"
    food = "normal" if appetite_score >= 6.6 else "skipped" if appetite_score < 4.2 else "unknown"
    activity = "high" if activity_minutes >= 38 else "medium" if activity_minutes >= 18 else "low"
    medication = weighted_choice(["taken", "missed", "unknown"], [0.82 if not bad_day else 0.58, 0.12 if bad_day else 0.06, 0.06 if bad_day else 0.12])

    confusion_episodes = 0 if confusion == "none" else 1 if confusion == "mild" else 2 if confusion == "moderate" else 4
    got_lost = bool(confusion in {"moderate", "severe"} and random.random() < 0.55) or bool(random.random() < 0.05 and bad_day)
    alerts_triggered = 1 if (mood == "agitated" or got_lost or medication == "missed") and random.random() < 0.7 else 0
    location_incidents = 1 if got_lost else 0
    sos_events = 1 if spike_day and random.random() < 0.2 else 0

    state["mood_score"] = mood_score
    state["sleep_hours"] = sleep_hours
    state["activity_minutes"] = activity_minutes
    state["confusion_score"] = confusion_score
    state["agitation_score"] = agitation_score
    state["appetite_score"] = appetite_score

    return {
      "date": datetime.utcnow() - timedelta(days=day_index),
      "mood": mood,
      "confusionLevel": confusion,
      "gotLost": got_lost,
      "medication": medication,
      "sleep": sleep,
      "food": food,
      "activity": activity,
      "agitationLevel": round(agitation_score, 1),
      "confusionEpisodes": confusion_episodes,
      "sleepHours": round(sleep_hours, 1),
      "appetiteLevel": round(appetite_score, 1),
      "moodScore": round(mood_score, 1),
      "tasksCompleted": max(0, int(round(clamp(4 + (mood_score - 5) / 2 + random.uniform(-1.5, 1.5), 0, 7)))),
      "tasksTotal": random.randint(4, 7),
      "exerciseMinutes": max(0, int(round(activity_minutes))),
      "socialInteractions": max(0, int(round(clamp(3 + (mood_score - 5) / 2 + random.uniform(-2, 2), 0, 7)))),
      "alertsTriggered": alerts_triggered,
      "locationIncidents": location_incidents,
      "sosEvents": sos_events,
      "medicationSource": "auto",
      "activitySource": "auto",
      "foodSource": "auto",
      "interventionNotes": "Synthetic messy training data",
      "riskSeed": max(0, min(100, round(48 + (10 - mood_score) * 4 + (10 - sleep_hours) * 3 + confusion_score * 2 + (5 if got_lost else 0) + (10 if medication == 'missed' else 0))))
    }


upserted = 0

for patient in patients:
    patient_id = patient["_id"]
    collection.delete_many({"patientId": patient_id})

    # Each patient gets a different baseline so the UI does not look cloned.
    state = {
        "mood_score": random.uniform(5.4, 8.2),
        "sleep_hours": random.uniform(5.8, 8.4),
        "activity_minutes": random.uniform(12, 42),
        "confusion_score": random.uniform(1.0, 5.8),
        "agitation_score": random.uniform(1.0, 5.6),
        "appetite_score": random.uniform(4.8, 8.4)
    }

    for day_index in range(SEED_DAYS - 1, -1, -1):
        log = build_log(day_index, state)
        log["patientId"] = patient_id
        collection.insert_one(log)
        upserted += 1

print(f"Inserted {upserted} messy synthetic daily logs for {len(patients)} patient(s) in {MONGODB_DB}.dailyhealthlogs")