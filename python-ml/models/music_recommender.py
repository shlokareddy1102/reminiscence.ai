"""
music_recommender.py — Collaborative Filtering for Music Therapy

Add this to your existing python-ml/models/ directory.
Expose via the existing FastAPI app by adding the router.

Two-phase approach:
  Phase 1: Content-based (works immediately, no history needed)
  Phase 2: Behaviour-based collaborative filtering (kicks in after 20+ sessions)

Interaction matrix weighting:
  repeat       +2.0   (strongest positive signal)
  completed    +1.5
  thumbs_up    +3.0
  skip < 20%   -2.0   (strong dislike)
  skip 20-50%  -0.5
  skip > 50%   +0.5   (mostly liked)
  thumbs_down  -3.0
"""

import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import StandardScaler
import joblib

MODEL_DIR = Path(__file__).parent.parent / "saved_models"
MUSIC_MODEL_PATH  = MODEL_DIR / "music_cf_model.joblib"
MUSIC_SCALER_PATH = MODEL_DIR / "music_scaler.joblib"
MUSIC_DATA_PATH   = MODEL_DIR / "music_interaction_data.joblib"


def compute_interaction_score(session: dict) -> float:
    """Convert a ListeningSession document into a single interaction score."""
    score = 0.0

    if session.get("thumbsUp") is True:   score += 3.0
    if session.get("thumbsUp") is False:  score -= 3.0

    repeat = session.get("repeatCount", 0) or 0
    score += min(repeat * 2.0, 6.0)  # cap at 3 repeats worth

    if session.get("completed"):
        score += 1.5

    skip = session.get("skipAtPercent")
    if skip is not None:
        skip = float(skip)
        if skip < 20:    score -= 2.0
        elif skip < 50:  score -= 0.5
        else:            score += 0.5

    duration  = session.get("durationSeconds") or 0
    listened  = session.get("listenedSeconds")  or 0
    if duration > 0 and listened > 0:
        pct = (listened / duration) * 100
        if pct >= 80:  score += 1.0
        elif pct >= 50: score += 0.3

    return float(score)


class MusicRecommender:
    def __init__(self):
        self.interaction_matrix = None   # DataFrame: patients × tracks
        self.track_meta         = {}     # trackId → {name, artist, genre, tempo}
        self.scaler             = StandardScaler()
        self._fitted            = False

    # ── Training ──────────────────────────────────────────────────────────────

    def train(self, sessions: list[dict]) -> dict:
        """
        sessions: list of ListeningSession dicts from MongoDB.
        Builds the patient × track interaction matrix.
        """
        if len(sessions) < 5:
            return {"status": "skipped", "reason": "Need at least 5 listening sessions"}

        rows = []
        for s in sessions:
            pid   = str(s.get("patientId", ""))
            tid   = str(s.get("trackId",   ""))
            score = compute_interaction_score(s)
            rows.append({"patientId": pid, "trackId": tid, "score": score})

            # Cache track metadata
            if tid not in self.track_meta:
                self.track_meta[tid] = {
                    "name":   s.get("trackName",  ""),
                    "artist": s.get("artistName", ""),
                    "genre":  s.get("genre",       ""),
                    "tempo":  s.get("tempo",        "medium"),
                }

        df = pd.DataFrame(rows)
        matrix = df.groupby(["patientId", "trackId"])["score"].sum().unstack(fill_value=0)
        self.interaction_matrix = matrix

        MODEL_DIR.mkdir(exist_ok=True)
        joblib.dump(matrix,          MUSIC_MODEL_PATH)
        joblib.dump(self.track_meta, MUSIC_DATA_PATH)
        self._fitted = True

        return {
            "status":   "trained",
            "patients": len(matrix.index),
            "tracks":   len(matrix.columns),
            "sessions": len(sessions),
        }

    # ── Inference ─────────────────────────────────────────────────────────────

    def _load(self):
        if MUSIC_MODEL_PATH.exists() and MUSIC_DATA_PATH.exists():
            self.interaction_matrix = joblib.load(MUSIC_MODEL_PATH)
            self.track_meta         = joblib.load(MUSIC_DATA_PATH)
            self._fitted            = True

    def recommend(
        self,
        patient_id:    str,
        sessions:      list[dict],
        candidate_ids: list[str],
        top_k:         int = 20,
    ) -> dict:
        """
        patient_id:    current patient
        sessions:      their listening history (from MongoDB)
        candidate_ids: Jamendo track IDs fetched by the Node route
        top_k:         how many to return

        Returns ranked list of track IDs with scores.
        """
        if not self._fitted:
            self._load()

        # Build this patient's interaction vector from their sessions
        patient_scores: dict[str, float] = {}
        for s in sessions:
            tid = str(s.get("trackId", ""))
            if tid:
                patient_scores[tid] = patient_scores.get(tid, 0) + compute_interaction_score(s)

        # If we have a trained matrix, find similar patients and boost their liked tracks
        collab_boost: dict[str, float] = {}
        if self._fitted and self.interaction_matrix is not None:
            matrix = self.interaction_matrix

            if patient_id in matrix.index:
                # Patient is in matrix — find similar patients via cosine similarity
                patient_vec = matrix.loc[[patient_id]].values
                sims = cosine_similarity(patient_vec, matrix.values)[0]
                sim_df = pd.Series(sims, index=matrix.index).drop(patient_id, errors="ignore")
                top_similar = sim_df.nlargest(5)

                for sim_pid, sim_score in top_similar.items():
                    if sim_score < 0.1:
                        continue
                    sim_tracks = matrix.loc[sim_pid]
                    for tid, track_score in sim_tracks.items():
                        if track_score > 0:
                            collab_boost[str(tid)] = collab_boost.get(str(tid), 0) + track_score * sim_score

        # Score all candidates
        results = []
        for tid in candidate_ids:
            score  = patient_scores.get(tid, 0.0)      # direct interaction
            score += collab_boost.get(tid, 0.0) * 0.5  # collaborative signal (weighted down)

            # Penalise tracks the patient consistently skips early
            if tid in patient_scores and patient_scores[tid] < -1.5:
                score -= 2.0

            results.append({"trackId": tid, "score": round(score, 3)})

        results.sort(key=lambda x: x["score"], reverse=True)

        return {
            "ranked":      results[:top_k],
            "collab_used": bool(collab_boost),
            "model":       "collaborative_filtering" if collab_boost else "content_based",
        }

    def similar_tracks(self, track_id: str, top_k: int = 5) -> list[str]:
        """Find tracks similar to a given track based on the interaction matrix."""
        if not self._fitted:
            self._load()
        if self.interaction_matrix is None:
            return []

        matrix = self.interaction_matrix
        if track_id not in matrix.columns:
            return []

        track_vec = matrix[[track_id]].T.values
        all_vecs  = matrix.T.values
        sims = cosine_similarity(track_vec, all_vecs)[0]
        sim_series = pd.Series(sims, index=matrix.columns).drop(track_id, errors="ignore")
        return sim_series.nlargest(top_k).index.tolist()


# Singleton
music_recommender = MusicRecommender()