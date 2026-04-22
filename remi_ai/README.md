# reminiscence.ai 
## Context-Aware Dementia Assistance Web Application

![Stack](https://img.shields.io/badge/MongoDB-47A248?style=flat&logo=mongodb&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=flat&logo=express&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=flat&logo=python&logoColor=white)

---

## 🚀 Quick Start for New Users

### Prerequisites
Before running this project, ensure you have:
1. **Node.js** (v18 or higher): [Download here](https://nodejs.org/)
2. **MongoDB** (v6 or higher): [Installation guide](https://www.mongodb.com/docs/manual/installation/)
3. **Python** (3.9-3.11 recommended): Usually pre-installed on Mac/Linux, [Windows download](https://www.python.org/downloads/)

### Installation Steps

```bash
# 1. Clone this repository
git clone https://github.com/shlokareddy1102/reminiscence.ai.git
cd reminiscence.ai

# 2. Make sure MongoDB is running
# macOS (using Homebrew):
brew services start mongodb-community

# Linux:
sudo systemctl start mongod

# Windows: MongoDB should auto-start as a service

# 3. Run the automated setup script (recommended)
chmod +x start.sh
./start.sh
```

**That's it!** 🎉 The `start.sh` script will:
- Install all Node.js dependencies
- Create a Python virtual environment
- Install Python packages (InsightFace, FAISS, OpenCV, Flask)
- Seed demo data (patients, tasks, caregivers)
- Start all three services (Backend, Python, Frontend)

### Accessing the Application

Once the services start, open your browser to: **http://localhost:5173**

**Demo Login Credentials:**
- **Caregiver Dashboard**: `caregiver@test.com` / `password123`
- **Patient Dashboard**: `patient@test.com` / `password123`

### Services & Ports

| Service | Port | Status Check |
|---------|------|--------------|
| React Frontend | 5173 | http://localhost:5173 |
| Node.js Backend | 5001 | http://localhost:5001/health |
| Python Face Service | 5002 | http://localhost:5002/health |
| MongoDB | 27017 | `mongosh` command |

### Testing Face Recognition

1. Log in as **Caregiver** → Navigate to "Add Known Person"
2. Upload a clear frontal face photo (good lighting, no glasses)
3. Fill in name and relationship → Click "Add Person"
4. Log in as **Patient** (in incognito/another browser)
5. Click "Recognize Someone" → Position your face in camera
6. System will recognize you and speak your name! 🎤

### Troubleshooting

If something goes wrong:

```bash
# Check if MongoDB is running
brew services list  # macOS
sudo systemctl status mongod  # Linux

# Restart all services (kill existing processes)
lsof -ti TCP:5001 | xargs kill -9
lsof -ti TCP:5002 | xargs kill -9
lsof -ti TCP:5173 | xargs kill -9

# Run setup again
./start.sh
```

For detailed setup instructions, configuration options, and troubleshooting, see **[SETUP.md](SETUP.md)**.

### Primary Frontend

The active React frontend for this MERN app is `frontend_lovable/`.

### Recommended Commands

```bash
# Install dependencies
npm install
npm --prefix frontend_lovable install

# Run full stack in development mode (backend + primary React frontend)
npm run dev

# Run backend smoke checks (health + auth login)
npm run smoke
```

### Production-Style Local Run

```bash
# Build frontend once
npm run client:build

# Start backend + preview frontend
npm run start:full
```

---

## 1. Overview

reminiscence.ai is a **context-aware dementia assistance web application** designed to support individuals with early to mid-stage dementia while enabling caregivers to monitor and assist them in real time.

Unlike traditional reminder or productivity applications that rely on active user interaction, reminiscence.ai is designed to operate in a **passive, always-on manner**, reducing the cognitive burden on patients. The system observes context, provides timely reminders and reassurance, and escalates situations to caregivers when required.

The project is implemented as a **web application using the MERN stack**, enhanced with **production-grade face recognition** (InsightFace + FAISS) and **real-time monitoring** capabilities.

---

## 2. Motivation

Dementia patients often experience:
- Memory loss related to tasks, people, and locations
- Difficulty navigating digital interfaces
- Increased dependence on caregivers
- Anxiety due to confusion and uncertainty

Most existing digital tools assume that the user:
- Remembers to open the app
- Understands notifications
- Can navigate menus independently

This assumption is unreliable for individuals with cognitive decline.  
reminiscence.ai aims to address this gap by shifting responsibility from the user to the system itself.

---

## 3. Problem Statement

There is a lack of web-based systems that provide **passive, context-aware assistance** to dementia patients while simultaneously enabling **real-time caregiver involvement**.

Existing applications fail to:
- Adapt to the user’s cognitive limitations
- Operate without active interaction
- Provide caregivers with continuous situational awareness

A system is required that minimizes cognitive load, adapts to context, and ensures safety through intelligent monitoring.

---

## 4. Objectives

The key objectives of the reminiscence.ai project are:

1. Reduce cognitive effort required from dementia patients  
2. Provide timely reminders and reassurance  
3. Detect missed tasks and abnormal behavior patterns  
4. Notify caregivers in real time when intervention is needed  
5. Demonstrate the integration of AI agents and LLMs in a web application  
6. Follow ethical and non-clinical design principles  

---

## 5. Stakeholders

The reminiscence.ai system involves multiple stakeholders:

### 5.1 Dementia Patient
- Primary beneficiary
- Interacts passively with the system
- Receives reminders, prompts, and reassurance

### 5.2 Caregiver
- Primary supervisor
- Monitors patient status via a web dashboard
- Responds to alerts and notifications

### 5.3 Family Members
- Secondary support stakeholders
- Receive limited updates or alerts
- Provide emotional support

### 5.4 System Administrator
- Manages configuration and system maintenance
- Controls access and permissions

### 5.5 AI Agent & LLM System
- Central decision-making component
- Evaluates context and generates responses

---

## 6. Stakeholders, Roles & Interactions  
### (Digital Pumpkin Model)

The system follows the **Digital Pumpkin Model**, where the application acts as a central digital entity mediating all interactions.

- Stakeholders do not directly depend on each other
- All contextual data flows through the system
- The AI agent evaluates the situation
- Actions are triggered based on system reasoning

This model ensures:
- Reduced cognitive stress on patients
- Centralized control and safety
- Clear accountability

---

## 7. Core Features

### 7.1 Patient-Side Features
- Always-on web interface (kiosk / PWA-style)
- Minimal and dementia-friendly UI
- Voice-based reminders and reassurance
- Task and appointment reminders
- Location awareness
- No login or navigation required

### 7.2 Caregiver-Side Features
- Web-based dashboard
- Real-time alerts using WebSockets
- Patient activity and status monitoring
- Location view
- Alert history and logs

### 7.3 AI & Intelligence Features
- AI agent for context evaluation and decision-making
- Rule-based escalation logic
- LLM-generated natural language prompts
- Controlled and safety-focused responses

---

## 8. System Architecture (High-Level)

1. Patient interface runs continuously on a device
2. Contextual data (tasks, time, interaction signals) is sent to the backend
3. AI agent evaluates the situation
4. LLM generates appropriate prompts or messages
5. Caregiver dashboard receives real-time updates and alerts

---

## 9. Tech Stack

### Frontend
- **React** 18.3.1 with Vite 5.4.21
- **Tailwind CSS** 3.4.17 for styling
- **MediaPipe Tasks Vision** 0.10.14 (BlazeFace detection)
- **react-webcam** 7.2.0 for camera access
- **Socket.io-client** 4.8.3 for real-time updates
- Web Speech API for voice commands

### Backend
- **Node.js** 25.6.0 with Express 5.2.1
- **MongoDB** with Mongoose 9.2.4
- **Socket.io** 4.8.3 for WebSocket communication
- **Multer** 2.1.0 for file uploads
- REST APIs for all operations

### Database (MongoDB)
- **Patient** profiles and demographics
- **Tasks** with scheduling and deadlines
- **Events** and activity logs
- **Alerts** for caregivers
- **KnownPerson** with face embeddings
- Real-time monitoring and risk scoring

### AI/ML Components

#### Face Recognition Pipeline
1. **Detection**: MediaPipe BlazeFace (browser-based)
   - Lightweight, CPU-optimized
   - Real-time face detection in webcam feed
   - Bounding box extraction

2. **Recognition**: InsightFace + FAISS (Python microservice)
   - **InsightFace** (ArcFace model): 512-dimensional embeddings
   - **FAISS** IndexFlatL2: L2 distance vector search
   - 98%+ accuracy on standard benchmarks
   - Face matching threshold: 1.2 (L2 distance)

3. **Tracking**: SimpleTracker
   - Stable track IDs across frames
   - IoU (Intersection over Union) matching
   - 85px center-distance threshold

#### Python Microservice
- **Flask** 3.1.3 API server
- **InsightFace** 0.7.3: buffalo_l model
- **FAISS** 1.13.2: Vector similarity search
- **OpenCV** 4.13.0: Image processing
- **NumPy** 2.4.2: Array operations
- **onnxruntime** 1.24.2: Model inference

#### Background Services
- **Monitoring Service**: 30-second interval task checking
- **Risk Engine**: 4-state machine (STABLE → MILD → ELEVATED → CRITICAL)
- **Bootstrap Service**: Demo data seeding

### Real-Time Communication
- **Socket.io**: Bidirectional event-based communication
- Events: alerts, task updates, recognition notifications, risk changes

---

## 10. Project Structure

```
reminiscence.ai/
├── frontend_lovable/                # React frontend (Vite)
│   ├── src/
│   │   ├── pages/                   # Route pages
│   │   │   ├── patient/PatientHome.jsx
│   │   │   └── caregiver/CaregiverDashboard.jsx
│   │   ├── lib/api.js               # API client
│   │   └── App.jsx                  # Root component with routing
│   ├── package.json
│   └── vite.config.ts
│
├── server/                          # Node.js backend (Express)
│   ├── models/                      # Mongoose schemas
│   │   ├── Patient.js               # Patient demographics & risk scores
│   │   ├── Task.js                  # Task scheduling & deadlines
│   │   ├── Event.js                 # Activity event logging
│   │   ├── Alert.js                 # Caregiver alerts
│   │   ├── ActivityLog.js           # Detailed activity logs
│   │   ├── KnownPerson.js           # Known people with photos
│   │   └── User.js                  # Authentication
│   ├── routes/                      # Express route handlers
│   │   ├── patient.js               # Patient CRUD operations
│   │   ├── tasks.js                 # Task management
│   │   ├── knownPeople.js           # Face recognition API proxy
│   │   ├── alerts.js                # Alert endpoints
│   │   ├── events.js                # Event logging
│   │   ├── activityLogs.js          # Activity log retrieval
│   │   └── auth.js                  # Login/register
│   ├── services/                    # Background services
│   │   ├── monitoringService.js     # Task deadline checker (30s)
│   │   ├── riskEngine.js            # Risk state machine
│   │   └── bootstrapService.js      # Seed demo data
│   ├── sockets/                     # Socket.io event handlers
│   │   └── index.js                 # Real-time event broadcasting
│   ├── python_service/              # Python face recognition
│   │   ├── app.py                   # Flask server (port 5002)
│   │   ├── face_engine.py           # InsightFace + FAISS engine
│   │   ├── requirements.txt         # Python dependencies
│   │   └── venv/                    # Virtual environment (auto-created)
│   ├── uploads/                     # Known person photos
│   ├── seed.js                      # Database seeding script
│   └── server.js                    # Express app entry point
│
├── start.sh                         # One-command startup script
├── SETUP.md                         # Detailed setup instructions
├── README.md                        # This file
├── package.json                     # Root dependencies
└── .gitignore                       # Excludes node_modules, venv, etc.
```

### Key Files to Understand

**Frontend:**
- [frontend_lovable/src/pages/patient/PatientHome.jsx](frontend_lovable/src/pages/patient/PatientHome.jsx) - Main patient UI
- [frontend_lovable/src/pages/caregiver/CaregiverDashboard.jsx](frontend_lovable/src/pages/caregiver/CaregiverDashboard.jsx) - Caregiver management dashboard

**Backend:**
- [server/server.js](server/server.js) - Express app initialization, starts monitoring service
- [server/routes/knownPeople.js](server/routes/knownPeople.js) - Face recognition API proxy to Python service
- [server/services/monitoringService.js](server/services/monitoringService.js) - Background task monitoring (30s intervals)
- [server/services/riskEngine.js](server/services/riskEngine.js) - Risk scoring state machine

**Python Service:**
- [server/python_service/app.py](server/python_service/app.py) - Flask API with /recognize, /rebuild-index endpoints
- [server/python_service/face_engine.py](server/python_service/face_engine.py) - InsightFace + FAISS core logic

---

## 11. Scope of the Project

- Designed for early to mid-stage dementia
- Academic and demonstrative in nature
- Focuses on system design, AI integration, and usability
- Not intended for medical diagnosis or clinical treatment

---

## 11. Limitations

- Browser-based sensing has inherent constraints
- Face recognition accuracy depends on lighting and camera quality
- Currently CPU-only (GPU acceleration available but not configured by default)
- Hardware integration is minimal

---

## 11.5 Manual Setup (Alternative to start.sh)

If you prefer to set up services manually instead of using the automated script:

### Step 1: Install Node.js Dependencies

```bash
# Root dependencies
npm install

# Frontend dependencies
cd frontend_lovable
npm install
cd ..
```

### Step 2: Set Up Python Environment

```bash
cd server/python_service
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt
cd ../..
```

### Step 3: Seed Database

```bash
npm run seed
```

### Step 4: Start Services (3 separate terminals)

**Terminal 1 - Python Face Service:**
```bash
cd server/python_service
source venv/bin/activate
python app.py
```

**Terminal 2 - Node.js Backend:**
```bash
npm run server
```

**Terminal 3 - React Frontend:**
```bash
npm run client:dev
```

MongoDB must be running separately on port 27017.

### Configuration Options

Create a `.env` file in the project root (optional):

```env
# MongoDB
MONGO_URI=mongodb://127.0.0.1:27017/reminiscence

# Backend
PORT=5001
CLIENT_ORIGIN=http://localhost:5173,http://localhost:8080

# Python Service
PYTHON_SERVICE_URL=http://localhost:5002
PYTHON_SERVICE_PORT=5002

# Frontend
VITE_API_BASE_URL=http://localhost:5001
```

### Quick API Smoke Test

```bash
# Backend must already be running on http://localhost:5001
npm run smoke

# Optional custom credentials / API base URL
SMOKE_EMAIL=caregiver@test.com SMOKE_PASSWORD=password123 npm run smoke
SMOKE_API_BASE_URL=http://localhost:5001 npm run smoke
```

### Adjust Face Recognition Threshold

Edit `server/routes/knownPeople.js` to change matching sensitivity:

```javascript
const response = await api.post('/api/known-people/recognize', {
  image: imageBase64,
  top_k: 1,
  threshold: 1.2  // Lower = stricter (0.6-1.5 recommended)
});
```

**Threshold recommendations:**
- `0.6`: Very strict
- `0.8`: Strict (good for controlled lighting)
- `1.0`: Balanced
- `1.2`: Lenient (default, works well for webcams)
- `1.5`: Very lenient

---

## 11.6 Advanced Troubleshooting

### Python Service Issues

**Problem**: Python packages won't install
```bash
cd server/python_service
source venv/bin/activate
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
```

**Problem**: InsightFace model download fails (500MB+ model)
- Be patient on first run - model downloads automatically
- Check internet connection
- Ensure sufficient disk space (~1GB free)

**Problem**: FAISS not working on Apple Silicon (M1/M2)
```bash
# Use conda instead
conda install -c conda-forge faiss-cpu
```

### MongoDB Connection Issues

```bash
# Check if MongoDB is running
ps aux | grep mongod

# Start MongoDB (macOS)
brew services start mongodb-community

# Start MongoDB (Linux)
sudo systemctl start mongod
sudo systemctl enable mongod
```

### Port Conflicts

```bash
# Kill processes on specific ports
lsof -ti TCP:5001 | xargs kill -9  # Backend
lsof -ti TCP:5002 | xargs kill -9  # Python
lsof -ti TCP:5173 | xargs kill -9  # Frontend
```

### Recognition Issues

**Face not detected:**
- Ensure good front-facing lighting
- Position face directly toward camera
- Check Python logs for "No face detected"

**Face detected but not recognized:**
- Check distance in Python logs (should be < 1.2)
- Increase threshold to 1.5
- Re-upload known person photo with better quality

**Rebuild FAISS index manually:**
```bash
curl -X POST http://localhost:5002/rebuild-index
```

---

## 12. Future Enhancements

- [ ] **Multi-photo per person**: Upload multiple photos per known person for better coverage under different conditions
- [ ] **GPU Acceleration**: Use `faiss-gpu` and `onnxruntime-gpu` for 5-10x faster recognition
- [ ] **Incremental FAISS updates**: Avoid full index rebuild on every upload
- [ ] **JWT Authentication**: Enable token-based authentication (models already exist)
- [ ] **Mobile responsive UI**: Optimize for tablet and mobile devices
- [ ] **Audio reminders**: Text-to-speech for task reminders
- [ ] **Weekly/monthly analytics**: Trend analysis for caregivers
- [ ] **Medication inventory**: Track medication schedule and refills
- [ ] **Multilingual support**: Support for multiple languages
- [ ] **Emotion detection**: Facial expression analysis for distress detection
- [ ] **Wearable integration**: Connect smart watches for activity monitoring
- [ ] **Cloud deployment**: Docker containerization + AWS/GCP deployment
- [ ] **Offline-first PWA**: Progressive Web App with offline capabilities
- [ ] **RAG system**: Conversation tracking with retrieval augmented generation

---

## 13. Contributing

Contributions are welcome! To contribute:

1. Fork this repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit your changes: `git commit -m "Add feature"`
4. Push to branch: `git push origin feature-name`
5. Submit a Pull Request

### Development Guidelines

- Follow existing code style (ESLint + Prettier configured)
- Test face recognition with various lighting conditions
- Update SETUP.md if adding new dependencies
- Write descriptive commit messages

---

## 14. License

This project is licensed under the **ISC License**.

---

## 15. Conclusion

reminiscence.ai demonstrates how **modern web technologies**, **production-grade face recognition** (InsightFace + FAISS), and **real-time monitoring** can be combined to build a practical, ethical, and context-aware dementia assistance system.

By transferring cognitive responsibility from the patient to the system, the project aims to improve safety, independence, and caregiver awareness in a scalable web-based solution.

### Key Achievements

✅ **Full-Stack MERN Architecture**: MongoDB, Express, React, Node.js with real-time Socket.io  
✅ **Production Face Recognition**: InsightFace (512-dim ArcFace) + FAISS vector search  
✅ **Background Monitoring**: Automated task checking every 30 seconds  
✅ **Risk State Machine**: Dynamic 4-state scoring (STABLE → MILD → ELEVATED → CRITICAL)  
✅ **Real-Time Alerts**: Instant caregiver notifications via WebSocket  
✅ **Voice Interaction**: Speech recognition for hands-free task completion  
✅ **Multi-Face Tracking**: Stable track IDs with IoU matching  
✅ **One-Command Setup**: Automated installation script for rapid deployment  

### Support & Documentation

- **Setup Guide**: [SETUP.md](SETUP.md) for detailed installation
- **GitHub Issues**: Report bugs or request features
- **Demo Credentials**: `caregiver@test.com` / `password123`

**Built with ❤️ for dementia care**

---