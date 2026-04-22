"""
Training script — run once to bootstrap all models from MongoDB data.

Usage:
    python training/train_all.py

Re-run any time you want to refresh the models with new data.
Models are saved to saved_models/ and hot-reloaded by the FastAPI app.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.db import fetch_all_logs, fetch_patient_logs, fetch_intervention_effects
from models.risk_model import risk_model
from models.anomaly_model import anomaly_model
from models.intervention_model import intervention_model


def main():
    print("=" * 60)
    print("Caregiver ML — Model Training")
    print("=" * 60)

    # ── 1. Risk model ────────────────────────────────────────────
    print("\n[1/3] Training Risk Model (Random Forest)...")
    all_logs = fetch_all_logs(days=180)
    print(f"  Loaded {len(all_logs)} log entries across all patients")

    if len(all_logs) >= 10:
        result = risk_model.train(all_logs)
        print(f"  Trained on {result['samples_trained']} samples")
        print(f"  Feature count: {result['feature_count']}")
        acc = result['classification_report'].get('accuracy', 'n/a')
        print(f"  Accuracy: {acc}")
    else:
        print("  SKIPPED — need at least 10 log entries")

    # ── 2. Anomaly model (per patient) ───────────────────────────
    print("\n[2/3] Training Anomaly Models (Isolation Forest per patient)...")
    patient_ids = list(set(str(log["patientId"]) for log in all_logs))
    print(f"  Found {len(patient_ids)} patients")

    trained = 0
    for pid in patient_ids:
        patient_logs = [l for l in all_logs if str(l["patientId"]) == pid]
        result = anomaly_model.train_patient(pid, patient_logs)
        if result["status"] == "trained":
            trained += 1
            print(f"  ✓ Patient {pid[:8]}... — {result['samples_used']} samples")
        else:
            print(f"  ✗ Patient {pid[:8]}... — {result['reason']}")

    print(f"  Trained {trained}/{len(patient_ids)} patient models")

    # ── 3. Intervention recommender ──────────────────────────────
    print("\n[3/3] Training Intervention Recommender (KNN)...")
    effects = fetch_intervention_effects()
    print(f"  Loaded {len(effects)} InterventionEffect records")

    result = intervention_model.train(effects)
    print(f"  Status: {result['status']}")
    if result['status'] == 'trained':
        print(f"  Positive effects used: {result['positive_effects_used']}")
    else:
        print(f"  Reason: {result.get('reason', '')}")

    print("\n" + "=" * 60)
    print("Training complete. Models saved to saved_models/")
    print("=" * 60)


if __name__ == "__main__":
    main()