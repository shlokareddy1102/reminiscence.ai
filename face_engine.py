import os
import cv2
import faiss
import numpy as np
from pymongo import MongoClient
from config import *
from insightface.app import FaceAnalysis
from collections import Counter

class FaceEngine:

    def __init__(self):
        self.client = MongoClient(MONGO_URI)
        self.db = self.client[DB_NAME]
        self.collection = self.db[COLLECTION_NAME]

        self.app = FaceAnalysis(name="buffalo_l")
        self.app.prepare(ctx_id=-1)

        self.index = faiss.IndexFlatIP(DIMENSION)
        self.mongo_ids = []  # maps FAISS position → Mongo _id

    def normalize(self, emb):
        return emb / np.linalg.norm(emb)

    # -----------------------------
    # BUILD INDEX FROM ALL FOLDERS
    # -----------------------------
    def rebuild_index(self):

        self.index = faiss.IndexFlatIP(DIMENSION)
        self.mongo_ids = []

        members = self.collection.find({})

        for member in members:
            folder = member["photoFolderPath"]

            if not os.path.exists(folder):
                continue

            for file in os.listdir(folder):
                if file.lower().endswith((".jpg", ".png", ".jpeg")):

                    path = os.path.join(folder, file)
                    img = cv2.imread(path)

                    if img is None:
                        continue

                    faces = self.app.get(img)
                    if len(faces) == 0:
                        continue

                    embedding = faces[0].embedding.astype("float32")
                    embedding = self.normalize(embedding)

                    self.index.add(np.array([embedding]))
                    self.mongo_ids.append(member["_id"])

        print("FAISS rebuilt. Total vectors:", self.index.ntotal)

    # -----------------------------
    # SEARCH (MULTI-VOTE)
    # -----------------------------
    def search(self, frame):

        faces = self.app.get(frame)
        results = []

        for face in faces:

            embedding = face.embedding.astype("float32")
            embedding = self.normalize(embedding)

            if self.index.ntotal == 0:
                continue

            D, I = self.index.search(np.array([embedding]), TOP_K)

            similarities = D[0]
            indices = I[0]

            valid_matches = []

            for sim, idx in zip(similarities, indices):
                if sim > THRESHOLD:
                    mongo_id = self.mongo_ids[idx]
                    valid_matches.append(mongo_id)

            if len(valid_matches) == 0:
                results.append({
                    "name": "Unknown",
                    "relation": "",
                    "similarity": float(similarities[0]),
                    "bbox": face.bbox.astype(int)
                })
                continue

            # Majority vote
            most_common_id = Counter(valid_matches).most_common(1)[0][0]
            member = self.collection.find_one({"_id": most_common_id})

            results.append({
                "name": member["name"],
                "relation": member["relation"],
                "similarity": float(similarities[0]),
                "bbox": face.bbox.astype(int)
            })

        return results
