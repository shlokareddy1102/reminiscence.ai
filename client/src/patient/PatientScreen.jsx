import { useEffect, useMemo, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';
import { api } from '../lib/api';
import { SimpleTracker } from './tracker';

const VOICE_PHRASES = ['i took it', 'i have taken my medicine', 'done'];

const reassuranceMessages = [
  'You are at home. Everything is okay.',
  'You are safe. Your caregiver is connected.',
  'Take your time. You are doing well today.'
];

const formatTime = (date) =>
  new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date);

const formatDate = (date) =>
  new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  }).format(date);

const toBbox = (detection) => {
  const box = detection.boundingBox;
  if (!box) return null;

  const x1 = Math.max(0, Math.floor(box.originX));
  const y1 = Math.max(0, Math.floor(box.originY));
  const x2 = Math.max(x1 + 1, Math.floor(box.originX + box.width));
  const y2 = Math.max(y1 + 1, Math.floor(box.originY + box.height));

  return [x1, y1, x2, y2];
};

const iou = (a, b) => {
  const xA = Math.max(a[0], b[0]);
  const yA = Math.max(a[1], b[1]);
  const xB = Math.min(a[2], b[2]);
  const yB = Math.min(a[3], b[3]);

  const inter = Math.max(0, xB - xA) * Math.max(0, yB - yA);
  const areaA = Math.max(1, (a[2] - a[0]) * (a[3] - a[1]));
  const areaB = Math.max(1, (b[2] - b[0]) * (b[3] - b[1]));
  return inter / (areaA + areaB - inter);
};

/**
 * Convert video frame crop to base64 data URI for Python service.
 * Adds padding around the face for better InsightFace detection.
 */
const bboxToBase64 = (video, bbox) => {
  const [x1, y1, x2, y2] = bbox;
  
  // Add 30% padding around face for better detection
  const w = x2 - x1;
  const h = y2 - y1;
  const padX = w * 0.3;
  const padY = h * 0.3;
  
  // Padded coordinates (clamped to video bounds)
  const px1 = Math.max(0, Math.floor(x1 - padX));
  const py1 = Math.max(0, Math.floor(y1 - padY));
  const px2 = Math.min(video.videoWidth, Math.ceil(x2 + padX));
  const py2 = Math.min(video.videoHeight, Math.ceil(y2 + padY));
  
  const paddedW = px2 - px1;
  const paddedH = py2 - py1;
  
  const canvas = document.createElement('canvas');
  // Use larger canvas for better quality (min 300px)
  const targetSize = Math.max(300, Math.max(paddedW, paddedH));
  canvas.width = targetSize;
  canvas.height = targetSize;
  
  const ctx = canvas.getContext('2d');
  // Fill with neutral background
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, targetSize, targetSize);
  
  // Draw padded face crop centered
  const offsetX = (targetSize - paddedW) / 2;
  const offsetY = (targetSize - paddedH) / 2;
  ctx.drawImage(video, px1, py1, paddedW, paddedH, offsetX, offsetY, paddedW, paddedH);
  
  return canvas.toDataURL('image/jpeg', 0.95);
};

const PatientScreen = () => {
  const [patient, setPatient] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [knownPeople, setKnownPeople] = useState([]);
  const [trackedFaces, setTrackedFaces] = useState([]);
  const [now, setNow] = useState(new Date());
  const [detectorReady, setDetectorReady] = useState(false);
  const [faceStatus, setFaceStatus] = useState('Checking presence...');
  const [lastFaceSeen, setLastFaceSeen] = useState(Date.now());
  const [listening, setListening] = useState(false);
  const [recognitionResult, setRecognitionResult] = useState(null);
  const [recognitionBusy, setRecognitionBusy] = useState(false);

  const webcamRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const detectorRef = useRef(null);
  const trackerRef = useRef(new SimpleTracker(85));
  const trackIdToNameRef = useRef({});
  const lastVisitedSentAtRef = useRef({});
  const inactivityLoggedAtRef = useRef(0);
  const lastFaceEventAtRef = useRef(0);
  const lastReminderSpokenTaskRef = useRef(null);
  const recognitionRef = useRef(null);

  const activeTask = useMemo(() => {
    const dueTasks = tasks
      .filter((task) => task.status === 'pending')
      .filter((task) => new Date(task.scheduledTime).getTime() <= Date.now());

    return dueTasks[0] || null;
  }, [tasks]);

  const reassurance = useMemo(() => {
    const idx = now.getMinutes() % reassuranceMessages.length;
    return reassuranceMessages[idx];
  }, [now]);

  const timeAwareGreeting = useMemo(() => {
    const hour = now.getHours();
    const salutation = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const day = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(now);
    return `${salutation}. Today is ${day}.`;
  }, [now]);

  const speak = (text) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  };

  const refreshPatientAndTasks = async () => {
    const patientRes = await api.get('/api/patient');
    const patientData = patientRes.data;
    setPatient(patientData);

    const [taskRes, knownPeopleRes] = await Promise.all([
      api.get('/api/tasks', { params: { patientId: patientData._id } }),
      api.get('/api/known-people', { params: { patientId: patientData._id } })
    ]);

    setTasks(taskRes.data);
    setKnownPeople(knownPeopleRes.data);
  };

  const markTaskComplete = async (taskId, confirmedBy) => {
    await api.post('/api/tasks/complete', { taskId, confirmedBy });
    await refreshPatientAndTasks();
  };

  const drawOverlay = (faces) => {
    const canvas = overlayCanvasRef.current;
    const video = webcamRef.current?.video;
    if (!canvas || !video) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    faces.forEach((face) => {
      const [x1, y1, x2, y2] = face.bbox;
      ctx.strokeStyle = face.name === 'Unknown' ? '#f97316' : '#16a34a';
      ctx.lineWidth = 2;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

      const label = `ID ${face.trackId} - ${face.name}`;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x1, Math.max(0, y1 - 24), ctx.measureText(label).width + 14, 22);
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px sans-serif';
      ctx.fillText(label, x1 + 6, Math.max(15, y1 - 8));
    });
  };

  useEffect(() => {
    refreshPatientAndTasks();

    const timer = setInterval(() => setNow(new Date()), 1000);
    const taskPoll = setInterval(refreshPatientAndTasks, 15000);

    return () => {
      clearInterval(timer);
      clearInterval(taskPoll);
    };
  }, []);

  useEffect(() => {
    const setupFaceDetector = async () => {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      );

      detectorRef.current = await FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite'
        },
        runningMode: 'VIDEO'
      });

      setDetectorReady(true);
    };

    setupFaceDetector().catch(() => setFaceStatus('Face detection unavailable'));
  }, []);

  useEffect(() => {
    if (!patient || !detectorReady) return;

    const interval = setInterval(async () => {
      const video = webcamRef.current?.video;
      if (!video || video.readyState < 2 || !detectorRef.current) return;

      const detections = detectorRef.current.detectForVideo(video, Date.now());
      const count = detections.detections?.length || 0;

      if (count > 0) {
        setLastFaceSeen(Date.now());
        setFaceStatus(count > 1 ? 'Multiple faces detected' : 'Face detected');

        if (Date.now() - lastFaceEventAtRef.current > 30000) {
          lastFaceEventAtRef.current = Date.now();
          await api.post('/api/activity', {
            patientId: patient._id,
            interactionType: 'face_detected'
          });
        }
      } else {
        setFaceStatus('No face currently detected');
      }

      const inactiveMs = Date.now() - lastFaceSeen;
      if (inactiveMs > 90_000 && Date.now() - inactivityLoggedAtRef.current > 90_000) {
        inactivityLoggedAtRef.current = Date.now();
        await api.post('/api/activity', {
          patientId: patient._id,
          interactionType: 'inactivity'
        });
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [patient, detectorReady, lastFaceSeen]);

  useEffect(() => {
    if (!activeTask) {
      lastReminderSpokenTaskRef.current = null;
      return;
    }

    if (lastReminderSpokenTaskRef.current !== activeTask._id) {
      lastReminderSpokenTaskRef.current = activeTask._id;
      speak(`It's time for your task. ${activeTask.title}.`);
    }
  }, [activeTask]);

  useEffect(() => {
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = async (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase();
      const matched = VOICE_PHRASES.some((phrase) => transcript.includes(phrase));

      if (matched && activeTask) {
        await markTaskComplete(activeTask._id, 'voice');
      }
    };

    recognition.onerror = () => setListening(false);
    recognition.onend = () => {
      if (listening) recognition.start();
    };

    recognitionRef.current = recognition;
  }, [activeTask, listening]);

  useEffect(() => {
    if (!recognitionRef.current) return undefined;

    if (listening) {
      recognitionRef.current.start();
    } else {
      recognitionRef.current.stop();
    }

    return () => recognitionRef.current?.stop();
  }, [listening]);

  const detectKnownPerson = async () => {
    const video = webcamRef.current?.video;
    if (!video || !detectorRef.current) {
      setRecognitionResult({ type: 'error', message: 'Camera not ready yet.' });
      return;
    }

    const detections = detectorRef.current.detectForVideo(video, Date.now());
    const boxes = (detections.detections || []).map(toBbox).filter(Boolean);

    if (boxes.length === 0) {
      setTrackedFaces([]);
      setRecognitionResult({ type: 'none', message: 'No face detected. Please face the camera.' });
      drawOverlay([]);
      return;
    }

    setRecognitionBusy(true);

    try {
      const recognitionCandidates = [];

      // Send each detected face crop to Python service for recognition
      for (const bbox of boxes) {
        const imageBase64 = bboxToBase64(video, bbox);
        
        try {
          const response = await api.post('/api/known-people/recognize', {
            image: imageBase64,
            top_k: 1,
            threshold: 1.2  // L2 distance threshold (higher = more lenient)
          });
          
          const matches = response.data.matches || [];
          const bestMatch = matches[0] || null;
          
          // Debug logging
          console.log('Recognition response:', {
            matchesFound: matches.length,
            bestMatch: bestMatch ? {
              name: bestMatch.person_id,
              distance: bestMatch.distance,
              confidence: bestMatch.confidence
            } : 'none'
          });
          
          // Find corresponding person from knownPeople state
          let person = null;
          if (bestMatch) {
            person = knownPeople.find(p => p._id === bestMatch.person_id) || null;
          }
          
          recognitionCandidates.push({
            bbox,
            person,
            score: bestMatch?.confidence || 0,
            distance: bestMatch?.distance || 999
          });
        } catch (error) {
          console.warn('Recognition failed for face crop:', error.message);
          recognitionCandidates.push({ bbox, person: null, score: 0, distance: 999 });
        }
      }

      const tracks = trackerRef.current.update(boxes);
      const nextTracked = [];

      for (const [trackId, bbox] of Object.entries(tracks)) {
        let matchedCandidate = null;
        let bestIou = 0;

        for (const candidate of recognitionCandidates) {
          const score = iou(bbox, candidate.bbox);
          if (score > bestIou) {
            bestIou = score;
            matchedCandidate = candidate;
          }
        }

        if (matchedCandidate?.person && !trackIdToNameRef.current[trackId]) {
          trackIdToNameRef.current[trackId] = matchedCandidate.person;
        }

        const trackedPerson = trackIdToNameRef.current[trackId] || null;

        if (trackedPerson) {
          const lastSent = lastVisitedSentAtRef.current[trackedPerson._id] || 0;
          if (Date.now() - lastSent > 60000) {
            lastVisitedSentAtRef.current[trackedPerson._id] = Date.now();
            const updated = await api.put(`/api/known-people/${trackedPerson._id}/mark-visited`);
            const updatedPerson = updated.data;
            trackIdToNameRef.current[trackId] = updatedPerson;
            setKnownPeople((prev) => prev.map((p) => (p._id === updatedPerson._id ? updatedPerson : p)));
          }
        }

        const person = trackIdToNameRef.current[trackId] || null;
        nextTracked.push({
          trackId,
          bbox,
          name: person?.name || 'Unknown',
          relationship: person?.relationship || '',
          lastVisitedTime: person?.lastVisitedTime || null,
          score: matchedCandidate?.score || 0
        });
      }

      setTrackedFaces(nextTracked);
      drawOverlay(nextTracked);

      const firstKnown = nextTracked.find((item) => item.name !== 'Unknown');
      if (firstKnown) {
        setRecognitionResult({
          type: 'match',
          score: firstKnown.score,
          person: {
            name: firstKnown.name,
            relationship: firstKnown.relationship,
            lastVisitedTime: firstKnown.lastVisitedTime
          }
        });
        speak(`This is ${firstKnown.name}, your ${firstKnown.relationship}.`);
      } else {
        console.warn(`No match found. Detected ${nextTracked.length} face(s)`);
        setRecognitionResult({ 
          type: 'none', 
          message: `Detected ${nextTracked.length} face(s) but no confident match. Try better lighting or different angle.` 
        });
      }
    } finally {
      setRecognitionBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-calmBg via-sky-50 to-emerald-50 p-8 text-calmText">
      <div className="mx-auto max-w-6xl">
        <header className="rounded-3xl bg-calmCard/95 p-8 shadow-sm backdrop-blur">
          <p className="text-2xl text-calmMuted">{timeAwareGreeting}</p>
          <h1 className="mt-2 text-5xl font-semibold">{formatTime(now)}</h1>
          <p className="mt-2 text-2xl">{formatDate(now)}</p>
          <p className="mt-6 text-2xl text-calmAccent">{reassurance}</p>
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl bg-calmCard p-6 shadow-sm">
            <h2 className="text-2xl font-semibold">Presence Monitor</h2>
            <p className="mt-2 text-lg text-calmMuted">{faceStatus}</p>
            <div className="relative mt-4 overflow-hidden rounded-2xl border border-slate-200">
              <Webcam
                ref={webcamRef}
                audio={false}
                mirrored
                className="h-72 w-full object-cover"
                screenshotFormat="image/jpeg"
              />
              <canvas ref={overlayCanvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
            </div>
            <button
              className={`mt-4 rounded-xl px-5 py-3 text-lg font-medium text-white ${
                listening ? 'bg-red-500' : 'bg-calmAccent'
              }`}
              onClick={() => setListening((prev) => !prev)}
            >
              {listening ? 'Stop Voice Listening' : 'Start Voice Listening'}
            </button>

            <button
              className="mt-3 w-full rounded-xl bg-blue-600 px-5 py-3 text-lg font-medium text-white"
              onClick={detectKnownPerson}
              disabled={recognitionBusy}
            >
              {recognitionBusy ? 'Detecting...' : 'Detect Who Is Here'}
            </button>

            {recognitionResult && (
              <div
                className={`mt-4 rounded-2xl p-4 ${
                  recognitionResult.type === 'match'
                    ? 'border border-emerald-200 bg-emerald-50'
                    : 'border border-amber-200 bg-amber-50'
                }`}
              >
                {recognitionResult.type === 'match' ? (
                  <>
                    <p className="text-lg font-semibold">{recognitionResult.person.name}</p>
                    <p className="text-calmMuted">Relation: {recognitionResult.person.relationship}</p>
                    <p className="text-calmMuted">
                      Last visited:{' '}
                      {recognitionResult.person.lastVisitedTime
                        ? new Date(recognitionResult.person.lastVisitedTime).toLocaleString()
                        : 'First visit'}
                    </p>
                    <p className="text-xs text-calmMuted">
                      Match confidence: {(recognitionResult.score * 100).toFixed(1)}%
                    </p>
                  </>
                ) : (
                  <p className="text-calmMuted">{recognitionResult.message}</p>
                )}
              </div>
            )}

            {trackedFaces.length > 0 && (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
                <p className="text-sm font-semibold text-slate-600">Tracked Faces</p>
                <div className="mt-2 space-y-2">
                  {trackedFaces.map((face) => (
                    <div key={`${face.trackId}-${face.name}`} className="rounded-lg bg-slate-50 p-2 text-sm">
                      ID {face.trackId} • {face.name}
                      {face.relationship ? ` (${face.relationship})` : ''}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="rounded-3xl bg-calmCard p-6 shadow-sm">
            <h2 className="text-2xl font-semibold">Today’s Tasks</h2>
            <div className="mt-4 space-y-3">
              {tasks.map((task) => (
                <div key={task._id} className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xl font-medium">{task.title}</p>
                  <p className="text-calmMuted">
                    {task.type} • {new Date(task.scheduledTime).toLocaleTimeString()}
                  </p>
                  <p className="mt-1 text-sm uppercase tracking-wide text-calmAccent">{task.status}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-3xl bg-calmCard p-6 shadow-sm">
          <h2 className="text-2xl font-semibold">People You Might Know</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {knownPeople.map((person) => (
              <div key={person._id} className="rounded-2xl border border-slate-200 p-3">
                <img src={person.photo} alt={person.name} className="h-32 w-full rounded-xl object-cover" />
                <p className="mt-2 text-lg font-semibold">{person.name}</p>
                <p className="text-calmMuted">{person.relationship}</p>
                <p className="text-xs text-calmMuted">
                  Visited: {person.lastVisitedTime ? new Date(person.lastVisitedTime).toLocaleString() : 'Not yet'}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {activeTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 p-6">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-10 text-center shadow-2xl">
            <p className="text-2xl text-calmMuted">Reminder</p>
            <h3 className="mt-3 text-4xl font-semibold">It’s time for your task</h3>
            <p className="mt-4 text-2xl">{activeTask.title}</p>
            <button
              className="mt-8 rounded-2xl bg-green-600 px-10 py-5 text-3xl font-semibold text-white"
              onClick={() => markTaskComplete(activeTask._id, 'button')}
            >
              I’ve taken it
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientScreen;
