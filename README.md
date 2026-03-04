# reminiscence.ai 
## Context-Aware Dementia Assistance Web Application

---

## 1. Overview

reminiscence.ai is a **context-aware dementia assistance web application** designed to support individuals with early to mid-stage dementia while enabling caregivers to monitor and assist them in real time.

Unlike traditional reminder or productivity applications that rely on active user interaction, reminiscence.ai is designed to operate in a **passive, always-on manner**, reducing the cognitive burden on patients. The system observes context, provides timely reminders and reassurance, and escalates situations to caregivers when required.

The project is implemented as a **web application using the MERN stack**, enhanced with an **AI decision-making agent** and **Large Language Models (LLMs)** for intelligent behavior and natural language interaction.

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
- React.js
- HTML, CSS, JavaScript
- Progressive Web App (PWA) principles

### Backend
- Node.js
- Express.js
- REST APIs

### Database
- MongoDB  
  - User profiles  
  - Tasks and reminders  
  - Interaction logs  
  - Alert history  
### AI/ML Components
### 1. Facial Recognition (OpenCV + Face Recognition Library)
### Detection Models:
  ### MediaPipe Face Detection :
  - Lightweight, CPU-optimized
  - Real-time performance for one-on-one interactions
  ### YOLOv8n :
  - Robust multi-face detection
  - Handles group gatherings, varying distances, partial occlusion
### Recognition Model:
  ### InsightFace (ArcFace) - Face identification
  - 512-dimensional embeddings
  - 98%+ accuracy on standard benchmarks
  - Works with both detection pathways
### 2.RAG (Retrieval Augmented Generation) System 🧠:
- Temporal Awareness: Prioritizes recent conversations (weighted by recency)
- Relationship Context: Understands family relationships and their significance
- Plan Extraction: Automatically identifies upcoming meetings, appointments, promises
- Emotion-Aware: Detects important emotional topics (health concerns, celebrations)
- Multi-Person Conversations: Tracks group discussions and who said what
- Privacy-Preserving: Embeddings are anonymized; original audio can be deleted


### AI Layer
- AI agent for decision-making
- Large Language Models for natural language generation

### Real-Time Communication
- WebSockets

---

## 10. Scope of the Project

- Designed for early to mid-stage dementia
- Academic and demonstrative in nature
- Focuses on system design, AI integration, and usability
- Not intended for medical diagnosis or clinical treatment

---

## 11. Limitations

- Browser-based sensing has inherent constraints
- Face recognition and precise location tracking are conceptual or limited
- LLM outputs are simplified and controlled
- Hardware integration is minimal

---

## 12. Future Enhancements

- Advanced computer vision for face recognition
- Wearable sensor integration
- Emotion-aware assistance
- Multilingual support
- More autonomous AI agent behavior
- Offline-first capabilities

---

## 13. Conclusion

reminiscence.ai demonstrates how **modern web technologies**, **AI agents**, and **Large Language Models** can be combined to build a realistic, ethical, and context-aware dementia assistance system.

By transferring cognitive responsibility from the patient to the system, the project aims to improve safety, independence, and caregiver awareness in a scalable web-based solution.

---

