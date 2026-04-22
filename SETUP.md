# reminiscence.ai - Setup and Installation Guide

## Overview

**reminiscence.ai** is a context-aware dementia assistance system built with the MERN stack (MongoDB, Express, React, Node.js) and **Python-based face recognition** using InsightFace + FAISS.

## Architecture

### Backend Services
- **Node.js Backend** (port 5001): Express API, Socket.io, MongoDB
- **Python Face Service** (port 5002): InsightFace + FAISS face recognition microservice
- **MongoDB** (port 27017): Database for patients, tasks, events, known people

### Frontend
- **React + Vite** (port 5173): Patient and caregiver dashboards

### Key Technologies
- **Face Detection**: MediaPipe BlazeFace (browser-based)
- **Face Recognition**: InsightFace ArcFace embeddings with FAISS vector search (Python microservice)
- **Real-time Communication**: Socket.io
- **Task Monitoring**: Background service with risk scoring state machine

---

## Prerequisites

### 1. Install Node.js (v18+)
```bash
# macOS
brew install node

# Verify installation
node --version  # Should be v18 or higher
npm --version
```

### 2. Install MongoDB
```bash
# macOS
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community

# Verify MongoDB is running
mongosh --eval "db.version()"
```

### 3. Install Python (v3.8-3.11 recommended)
```bash
# macOS (Python 3 is usually pre-installed)
python3 --version

# If you have Python 3.14+ and encounter issues:
brew install python@3.11
alias python3=/opt/homebrew/opt/python@3.11/bin/python3.11
```

**Important**: 
- **Python 3.9-3.11**: Best compatibility (recommended)
- **Python 3.12+**: May work but some dependencies need newer versions
- **Python 3.14**: Latest onnxruntime/insightface versions will be used
- **Python 3.7 or older**: Not supported

---

## Installation

### Option 1: One-Command Startup (Recommended)

```bash
# Clone or navigate to project directory
cd /path/to/reminiscence.ai

# Run the automated startup script
./start.sh
```

This script will:
1. Check MongoDB is running
2. Create Python virtual environment and install dependencies
3. Seed demo data
4. Start Python face recognition service (port 5002)
5. Start Node.js backend (port 5001) and React frontend (port 5173)

### Option 2: Manual Setup

#### Step 1: Install Node.js Dependencies
```bash
cd /path/to/reminiscence.ai

# Install root dependencies
npm install

# Install frontend dependencies
cd frontend_lovable
npm install
cd ..
```

#### Step 2: Setup Python Virtual Environment
```bash
cd server/python_service

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate  # macOS/Linux
# OR
venv\Scripts\activate  # Windows

# Install Python dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

**Note**: First run will download InsightFace models (~350MB). This happens automatically.

#### Step 3: Seed Database
```bash
# From project root
npm run seed
```

This creates:
- Demo patient (Alice Johnson, age 74)
- 3 sample tasks
- 2 known people with photos (Emma Johnson, Nurse Daniel)

#### Step 4: Start Services Manually

**Terminal 1** - Python Face Service:
```bash
cd server/python_service
source venv/bin/activate
python app.py
```

**Terminal 2** - Node.js Backend + React Frontend:
```bash
cd /path/to/reminiscence.ai
npm run dev
```

---

## Accessing the Application

Once all services are running:

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:5173 | Patient and caregiver dashboards |
| Backend API | http://localhost:5001 | REST API |
| Python Service | http://localhost:5002 | Face recognition endpoints |
| MongoDB | mongodb://127.0.0.1:27017/reminiscence | Database |

### Demo Credentials

**Caregiver Account**:
- Email: `caregiver@test.com`
- Password: `password123`

**Patient Account**:
- Email: `patient@test.com`
- Password: `password123`

---

## Testing Face Recognition

### 1. Upload Known People (Caregiver Dashboard)

1. Navigate to http://localhost:5173
2. Log in as caregiver
3. Scroll to "Add Known Person" section
4. Fill form:
   - Name: e.g., "John Doe"
   - Relationship: e.g., "Son"
   - Photo: Upload a clear frontal face photo (JPEG/PNG)
5. Click "Add Person"

**Note**: The FAISS index automatically rebuilds when you add/remove people.

### 2. Test Recognition (Patient Dashboard)

1. Log in as patient (or open in incognito mode with patient credentials)
2. Allow camera access when prompted
3. Click "Recognize Someone" button
4. Position face in camera view

**What happens**:
- MediaPipe detects face(s) in video frame
- Each face crop is sent to Python service
- InsightFace generates 512-dim ArcFace embedding
- FAISS searches for nearest match in index
- Results displayed with confidence score, name, relationship, last visited time
- Track IDs persist across frames (stable labeling)
- Green bbox = recognized person, Orange bbox = unknown
- Visit count auto-increments (throttled to 60s per person)

---

## Architecture Details

### Face Recognition Pipeline

1. **Browser (Patient Dashboard)**:
   - MediaPipe BlazeFace detects faces in video stream
   - Extracts bounding box coordinates
   - SimpleTracker assigns stable track IDs to each face
   - Crops face region to base64 JPEG

2. **Node.js Backend** (`/api/known-people/recognize`):
   - Receives base64 face crop from browser
   - Proxies request to Python service
   - Returns match results

3. **Python Service**:
   - Decodes base64 to OpenCV image
   - InsightFace extracts 512-dim ArcFace embedding
   - FAISS searches indexed embeddings (L2 distance)
   - Returns top match with distance/confidence

4. **Browser (continued)**:
   - Matches track IDs to recognition results via IoU (Intersection over Union)
   - Persists person-to-trackId mapping
   - Draws overlay canvas with bboxes and labels
   - Throttles backend updates (visit tracking)

### FAISS Index Management

The FAISS index is **automatically rebuilt** when:
- A known person is added (POST `/api/known-people`)
- A known person is deleted (DELETE `/api/known-people/:id`)
- Manual rebuild triggered (POST `/api/known-people/rebuild-index`)

**Performance**:
- Embedding extraction: ~50-100ms per face (CPU)
- FAISS search: <1ms for up to 1000 people
- Total recognition latency: ~100-200ms per face

---

## Configuration

### Environment Variables

Create `.env` file in project root (optional):

```bash
# MongoDB
MONGO_URI=mongodb://127.0.0.1:27017/reminiscence

# Python Service
PYTHON_SERVICE_URL=http://localhost:5002
PYTHON_SERVICE_PORT=5002

# Node.js Backend
PORT=5001

# Allowed frontend origins for CORS + Socket.io
CLIENT_ORIGIN=http://localhost:5173,http://localhost:8080

# Frontend API base URL
VITE_API_BASE_URL=http://localhost:5001
```

### Adjust Recognition Threshold

**Backend** (`/server/routes/knownPeople.js`):
```javascript
// Lower threshold = more strict matching (fewer false positives)
// Higher threshold = more lenient (more false positives)
threshold: 0.6  // Default L2 distance threshold for InsightFace
```

**Frontend API call site** (`/frontend_lovable/src/pages/patient/PatientHome.jsx`):
```javascript
const response = await api.post('/api/known-people/recognize', {
  image: imageBase64,
  top_k: 1,        // Return top 1 match
  threshold: 0.6   // L2 distance threshold
});
```

**Recommended thresholds**:
- 0.4-0.5: Very strict (high accuracy, may miss some matches)
- 0.6: Balanced (default)
- 0.7-0.8: Lenient (may have false positives)

---

## Troubleshooting

### Python Service Won't Start

**Issue**: `Import "insightface" could not be resolved`

**Solution**:
```bash
cd server/python_service
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

If InsightFace install fails, try:
```bash
pip install onnxruntime==1.17.1
pip install insightface==0.7.3
```

---

### FAISS Index Empty

**Issue**: Recognition returns "No match" for known people

**Solution**: Manually rebuild index:
```bash
curl -X POST http://localhost:5002/rebuild-index \
  -H "Content-Type: application/json" \
  -d '{"people": []}'
```

Or trigger from backend:
```bash
curl -X POST http://localhost:5001/api/known-people/rebuild-index \
  -H "Content-Type: application/json" \
  -d '{"patientId": "PATIENT_ID_HERE"}'
```

---

### MongoDB Connection Error

**Issue**: `MongooseServerSelectionError: connect ECONNREFUSED 127.0.0.1:27017`

**Solution**:
```bash
# Check if MongoDB is running
brew services list

# Start MongoDB
brew services start mongodb-community

# Verify connection
mongosh
```

---

### Camera Not Working

**Issue**: "Camera not ready yet" or black video feed

**Solution**:
1. Allow camera permissions in browser
2. Ensure no other app is using the camera
3. Refresh page
4. Try a different browser (Chrome/Edge recommended)

---

### Python Service Returns 503

**Issue**: `Python service unavailable` error in browser

**Solution**:
1. Check Python service is running: `curl http://localhost:5002/health`
2. Check logs for errors
3. Restart Python service:
   ```bash
   cd server/python_service
   source venv/bin/activate
   python app.py
   ```

---

## GPU Acceleration (Optional)

For faster face recognition on systems with NVIDIA GPU:

```bash
cd server/python_service
source venv/bin/activate

# Uninstall CPU versions
pip uninstall onnxruntime faiss-cpu

# Install GPU versions
pip install onnxruntime-gpu
pip install faiss-gpu

# Update face_engine.py
# Change: providers=['CPUExecutionProvider']
# To: providers=['CUDAExecutionProvider', 'CPUExecutionProvider']
```

**Performance improvement**: ~5-10x faster embedding extraction (5-10ms per face)

---

## Project Structure

```
reminiscence.ai/
├── frontend_lovable/            # React frontend
│   └── src/
│       ├── pages/
│       │   ├── patient/PatientHome.jsx
│       │   └── caregiver/CaregiverDashboard.jsx
│       └── lib/api.js
├── server/                      # Node.js backend
│   ├── models/                  # Mongoose schemas
│   │   ├── Patient.js
│   │   ├── Task.js
│   │   ├── Event.js
│   │   ├── Alert.js
│   │   └── KnownPerson.js
│   ├── routes/                  # Express routes
│   │   ├── patient.js
│   │   ├── tasks.js
│   │   ├── events.js
│   │   ├── alerts.js
│   │   ├── activity.js
│   │   └── knownPeople.js       # Face recognition proxy
│   ├── services/                # Background services
│   │   ├── monitoringService.js # Task deadline checking
│   │   ├── riskEngine.js        # Risk scoring state machine
│   │   └── bootstrapService.js  # Demo data seeding
│   ├── sockets/                 # Socket.io handlers
│   │   └── index.js
│   ├── python_service/          # Python face recognition
│   │   ├── app.py               # Flask server
│   │   ├── face_engine.py       # InsightFace + FAISS
│   │   ├── requirements.txt
│   │   └── README.md
│   ├── server.js                # Express app entry
│   └── seed.js                  # Database seeding
├── package.json
├── start.sh                     # One-command startup script
└── SETUP.md                     # This file
```

---

## Technologies Used

### Frontend
- React 18.3.1
- Vite 5.4.21
- Tailwind CSS 3.4.17
- MediaPipe Tasks Vision 0.10.14 (BlazeFace face detection)
- react-webcam 7.2.0
- Socket.io-client 4.8.3

### Backend
- Node.js 25.6.0
- Express 5.2.1
- MongoDB + Mongoose 9.2.4
- Socket.io 4.8.3
- Multer 2.1.0 (file uploads)

### Python Microservice
- Flask 3.0.0
- InsightFace 0.7.3 (ArcFace embeddings)
- FAISS 1.8.0 (vector similarity search)
- OpenCV 4.9.0
- ONNXRuntime 1.17.1

---

## Next Steps / Future Enhancements

- [ ] **Multi-photo per person**: Upload multiple reference images for better accuracy
- [ ] **Incremental FAISS updates**: Avoid full rebuild on every upload
- [ ] **GPU acceleration**: Default to GPU if available
- [ ] **Mobile responsive UI**: Optimize for tablets
- [ ] **JWT authentication**: Currently auth models exist but not enforced
- [ ] **Cloud deployment**: Docker containers + AWS/GCP
- [ ] **Audio reminders**: Text-to-speech for task notifications
- [ ] **Activity trends**: Weekly/monthly analytics for caregivers

---

## License

ISC

## Support

For issues or questions:
1. Check this guide's Troubleshooting section
2. Review Python service logs: `server/python_service/`
3. Review Node.js logs: Terminal output from `npm run dev`
4. Check browser console for frontend errors

---

**Enjoy using reminiscence.ai! 🧠💙**
