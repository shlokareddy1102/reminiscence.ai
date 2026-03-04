# Face Recognition Python Service

Production-grade face recognition microservice using InsightFace (ArcFace) embeddings and FAISS vector search.

## Setup

1. **Install Python dependencies**:
```bash
cd server/python_service
pip install -r requirements.txt
```

2. **Download InsightFace models** (first run will auto-download):
The service will automatically download the buffalo_l model on first use (~350MB).

3. **Start the service**:
```bash
python app.py
```

The service will run on port 5002 by default.

## Endpoints

### POST /rebuild-index
Rebuild the FAISS index with known people photos.

**Request**:
```json
{
  "people": [
    {
      "id": "64fa...",
      "name": "Alice Johnson",
      "relationship": "Daughter",
      "photo": "data:image/png;base64,iVBORw0KG..."
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "message": "Index rebuilt with 2 people",
  "stats": {
    "total_indexed": 2,
    "embedding_dim": 512,
    "person_count": 2
  }
}
```

### POST /recognize
Recognize a face in the provided image crop.

**Request**:
```json
{
  "image": "data:image/png;base64,iVBORw0KG...",
  "top_k": 1,
  "threshold": 0.6
}
```

**Response**:
```json
{
  "matches": [
    {
      "person_id": "64fa...",
      "name": "Alice Johnson",
      "relationship": "Daughter",
      "distance": 0.23,
      "confidence": 0.93
    }
  ],
  "found": true
}
```

### GET /health
Health check endpoint.

### GET /stats
Get current FAISS index statistics.

## Architecture

- **InsightFace**: State-of-the-art face recognition using ArcFace embeddings (512-dimensional)
- **FAISS**: Facebook AI Similarity Search for efficient vector matching
- **Flask**: Lightweight HTTP server for Node.js backend integration

## Performance

- Embedding extraction: ~50-100ms per face (CPU)
- FAISS search: <1ms for databases up to 1000 people
- GPU acceleration available with `onnxruntime-gpu` and `faiss-gpu`
