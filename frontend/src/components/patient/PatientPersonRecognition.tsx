import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Loader2, User, Heart, SwitchCamera } from "lucide-react";
import {
  KnownPerson,
  getKnownPeople,
  RecognitionMatch,
  markKnownPersonVisited,
  recognizePerson,
  reportUnknownPerson,
} from "@/lib/knownPeople";

type PatientPersonRecognitionProps = {
  patientId?: string | null;
  onAnnouncement?: (message: string) => void;
};

const PatientPersonRecognition = ({ patientId, onAnnouncement }: PatientPersonRecognitionProps) => {
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [matchedPerson, setMatchedPerson] = useState<RecognitionMatch | null>(null);
  const [noMatch, setNoMatch] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [knownPeople, setKnownPeople] = useState<KnownPerson[]>([]);
  const [faceBoxes, setFaceBoxes] = useState<Array<{ x: number; y: number; width: number; height: number }>>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewFrameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(true);
  const [faceDetectorSupported, setFaceDetectorSupported] = useState(true);
  const detectorRef = useRef<any>(null);
  const detectTimerRef = useRef<number | null>(null);

  const speakMessage = (message: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  };

  const getCameraErrorMessage = (err: unknown) => {
    const e = err as { name?: string; message?: string };

    if (typeof window !== "undefined") {
      const host = window.location.hostname;
      const isLocalhost = host === "localhost" || host === "127.0.0.1";
      const isHttps = window.location.protocol === "https:";
      if (!isHttps && !isLocalhost) {
        return "Camera access requires HTTPS or localhost. Open the app on http://localhost:5173 for camera features.";
      }
    }

    if (e?.name === "NotAllowedError") {
      return "Camera permission denied. Allow camera access in browser settings and retry.";
    }

    if (e?.name === "NotFoundError") {
      return "No camera device found. Connect a camera and retry.";
    }

    if (e?.name === "NotReadableError") {
      return "Camera is currently used by another app. Close other camera apps and retry.";
    }

    return "Camera access failed. Please allow camera permissions and retry.";
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setError(null);
      setCameraActive(true);
    } catch (err) {
      setError(getCameraErrorMessage(err));
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (detectTimerRef.current != null) {
      window.clearInterval(detectTimerRef.current);
      detectTimerRef.current = null;
    }

    setFaceBoxes([]);
  };

  const startFaceDetection = async () => {
    if (typeof window === "undefined") return;
    const FaceDetectorCtor = (window as any).FaceDetector;
    if (!FaceDetectorCtor || !videoRef.current) {
      setFaceDetectorSupported(false);
      return;
    }

    setFaceDetectorSupported(true);

    try {
      if (!detectorRef.current) {
        detectorRef.current = new FaceDetectorCtor({ fastMode: true, maxDetectedFaces: 3 });
      }
    } catch (_err) {
      return;
    }

    if (detectTimerRef.current != null) {
      window.clearInterval(detectTimerRef.current);
    }

    detectTimerRef.current = window.setInterval(async () => {
      if (!videoRef.current || !cameraActive) return;
      if (videoRef.current.readyState < 2) return;

      try {
        const detections = await detectorRef.current.detect(videoRef.current);
        const boxes = (detections || []).map((d: any) => {
          const b = d.boundingBox || { x: 0, y: 0, width: 0, height: 0 };
          return {
            x: b.x,
            y: b.y,
            width: b.width,
            height: b.height
          };
        });
        setFaceBoxes(boxes);
      } catch (_err) {
        // Ignore intermittent detector frame errors.
      }
    }, 450);
  };

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadKnownPeople = async () => {
      if (!patientId) {
        setKnownPeople([]);
        return;
      }

      try {
        const people = await getKnownPeople(patientId);
        if (mounted) {
          setKnownPeople(people);
        }
      } catch (_err) {
        if (mounted) {
          setKnownPeople([]);
        }
      }
    };

    loadKnownPeople();

    return () => {
      mounted = false;
    };
  }, [patientId]);

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg");
      setCapturedImage(dataUrl);
      setCameraActive(false);
      stopCamera();
      runRecognition(dataUrl);
    }
  };

  const runRecognition = async (image: string) => {
    setIsAnalyzing(true);
    setMatchedPerson(null);
    setNoMatch(false);
    setError(null);

    try {
      const result = await recognizePerson(image);
      if (result.found && result.matches.length > 0) {
        const bestMatch = result.matches[0];
        setMatchedPerson(bestMatch);
        const relation = (bestMatch.relationship || "familiar person").toLowerCase();
        const message = `This is ${bestMatch.name}, your ${relation}.`;
        speakMessage(message);
        onAnnouncement?.(message);
        if (bestMatch.person_id) {
          await markKnownPersonVisited(bestMatch.person_id);
        }
      } else {
        setNoMatch(true);
        const message = "I do not recognize this person.";
        speakMessage(message);
        onAnnouncement?.(message);
        if (patientId) {
          await reportUnknownPerson(patientId, image);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Recognition failed";
      if (message.toLowerCase().includes("python service unavailable")) {
        setError("Python face service unavailable. Start it with npm run dev (now includes python:dev) or ensure port 5002 is running.");
      } else {
        setError(message);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const reset = async () => {
    setCapturedImage(null);
    setMatchedPerson(null);
    setNoMatch(false);
    await startCamera();
  };

  useEffect(() => {
    if (!cameraActive) return;
    startFaceDetection();

    return () => {
      if (detectTimerRef.current != null) {
        window.clearInterval(detectTimerRef.current);
        detectTimerRef.current = null;
      }
    };
  }, [cameraActive]);

  const renderedBoxes = useMemo(() => {
    if (!videoRef.current || !previewFrameRef.current) return [];

    const vw = videoRef.current.videoWidth || 0;
    const vh = videoRef.current.videoHeight || 0;
    const cw = previewFrameRef.current.clientWidth || 0;
    const ch = previewFrameRef.current.clientHeight || 0;
    if (!vw || !vh || !cw || !ch) return [];

    const scale = Math.min(cw / vw, ch / vh);
    const renderedW = vw * scale;
    const renderedH = vh * scale;
    const offsetX = (cw - renderedW) / 2;
    const offsetY = (ch - renderedH) / 2;

    return faceBoxes.map((box) => ({
      left: offsetX + box.x * scale,
      top: offsetY + box.y * scale,
      width: box.width * scale,
      height: box.height * scale
    }));
  }, [faceBoxes, capturedImage, cameraActive]);

  const matchedKnownPerson = useMemo(() => {
    if (!matchedPerson?.person_id) return null;
    return knownPeople.find((p) => p.id === matchedPerson.person_id) || null;
  }, [matchedPerson, knownPeople]);

  return (
    <div className="patient-card !p-3 flex flex-col">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Camera className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-display font-bold text-foreground">Who is this?</h2>
          <p className="text-[10px] text-muted-foreground">Point camera</p>
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {!capturedImage ? (
        <div className="flex flex-col gap-2">
          {/* Camera preview — fills available space */}
          <div
            ref={previewFrameRef}
            className="relative w-full aspect-square mx-auto rounded-2xl overflow-hidden bg-foreground/90"
            style={{ maxHeight: "70vh" }}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-contain bg-foreground/90"
              style={{ transform: "scaleX(1)" }}
            />

            {renderedBoxes.map((box, idx) => (
              <div
                key={`face-${idx}`}
                className="absolute border-2 border-safe rounded-lg shadow-[0_0_0_1px_rgba(0,0,0,0.25)]"
                style={{
                  left: `${box.left}px`,
                  top: `${box.top}px`,
                  width: `${box.width}px`,
                  height: `${box.height}px`
                }}
              >
                <span className="absolute -top-6 left-0 text-[10px] px-1.5 py-0.5 rounded bg-safe text-safe-foreground font-medium">
                  Face detected
                </span>
              </div>
            ))}

            {!cameraActive && (
              <div className="absolute inset-0 bg-gradient-to-br from-foreground/80 via-foreground/90 to-foreground flex items-center justify-center">
                <div className="text-center space-y-3">
                  <div className="w-24 h-24 rounded-full border-2 border-primary-foreground/30 mx-auto flex items-center justify-center">
                    <User className="w-12 h-12 text-primary-foreground/40" />
                  </div>
                  <p className="text-sm text-primary-foreground/50">Camera inactive</p>
                </div>
              </div>
            )}

            {/* Scanning overlay corners */}
            <div className="absolute top-4 left-4 w-10 h-10 border-t-3 border-l-3 border-primary rounded-tl-lg" />
            <div className="absolute top-4 right-4 w-10 h-10 border-t-3 border-r-3 border-primary rounded-tr-lg" />
            <div className="absolute bottom-4 left-4 w-10 h-10 border-b-3 border-l-3 border-primary rounded-bl-lg" />
            <div className="absolute bottom-4 right-4 w-10 h-10 border-b-3 border-r-3 border-primary rounded-br-lg" />

            {/* Recording indicator */}
            <div className="absolute top-4 right-16 flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-alert animate-pulse-gentle" />
              <span className="text-xs text-primary-foreground/60 font-medium">{cameraActive ? "LIVE" : "OFF"}</span>
            </div>

            {cameraActive && (
              <div className="absolute bottom-3 left-3 rounded-lg bg-foreground/50 px-2 py-1 text-[11px] text-primary-foreground/85">
                {faceBoxes.length > 0
                  ? `${faceBoxes.length} face${faceBoxes.length > 1 ? "s" : ""} detected`
                  : faceDetectorSupported
                    ? "Scanning for face..."
                    : "Bounding-box detector unavailable in this browser"}
              </div>
            )}
          </div>

          {!faceDetectorSupported && (
            <div className="rounded-lg border border-warning/30 bg-warning/10 p-2 text-xs text-foreground">
              Live face boxes are only available in browsers that support the FaceDetector API (Chrome/Edge). Recognition still works after taking a photo.
            </div>
          )}

          {/* Capture button */}
          <button
            onClick={handleCapture}
            disabled={!cameraActive}
            className="py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 active:scale-[0.98] transition-all"
          >
            <Camera className="w-5 h-5" />
            Take Photo
          </button>

          {error && (
            <div className="bg-alert/10 border border-alert/20 rounded-lg p-2 text-center space-y-2">
              <p className="text-xs text-alert">{error}</p>
              <button
                type="button"
                onClick={startCamera}
                className="text-xs px-3 py-1 rounded-lg border border-border bg-card hover:bg-muted transition-colors"
              >
                Retry Camera
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div
            className="relative w-full aspect-square mx-auto rounded-2xl overflow-hidden"
            style={{ maxHeight: "70vh" }}
          >
            <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
            {isAnalyzing && (
              <div className="absolute inset-0 bg-foreground/30 flex items-center justify-center">
                <div className="flex items-center gap-1 bg-card px-3 py-2 rounded-lg shadow-calm">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-sm font-medium">Identifying...</span>
                </div>
              </div>
            )}
          </div>

          {matchedPerson && (
            <div className="bg-safe/10 border border-safe/20 rounded-lg p-2 animate-fade-in text-center space-y-1">
              <div className="w-12 h-12 rounded-full mx-auto border-2 border-safe/30 bg-safe/15 flex items-center justify-center">
                <User className="w-6 h-6 text-safe" />
              </div>
              <div>
                <p className="text-sm font-display font-bold text-foreground flex items-center justify-center gap-1">
                  <User className="w-4 h-4 text-safe" /> {matchedPerson.name}
                </p>
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <Heart className="w-3 h-3 text-primary" /> {matchedPerson.relationship}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Confidence: {Math.round((matchedPerson.confidence || 0) * 100)}%
                </p>
                {matchedKnownPerson?.notes && (
                  <p className="text-[11px] text-muted-foreground mt-1">{matchedKnownPerson.notes}</p>
                )}
                {matchedKnownPerson?.lastVisitedTime && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Last seen: {new Date(matchedKnownPerson.lastVisitedTime).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          )}

          {noMatch && (
            <div className="bg-warning/10 border border-warning/20 rounded-lg p-2 animate-fade-in text-center">
              <p className="text-sm font-display font-semibold text-foreground">Not recognized</p>
              <p className="text-xs text-muted-foreground">Ask caregiver to add a clear real-face photo, then rebuild index from the known-people route if needed.</p>
            </div>
          )}

          {error && (
            <div className="bg-alert/10 border border-alert/20 rounded-lg p-2 text-center">
              <p className="text-xs text-alert">{error}</p>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={reset} className="flex-1 py-2 rounded-xl border border-border bg-card text-foreground font-medium text-sm hover:bg-muted active:scale-[0.98] transition-all flex items-center justify-center gap-1">
              <SwitchCamera className="w-4 h-4" /> Retake
            </button>
            <button
              onClick={() => capturedImage && runRecognition(capturedImage)}
              disabled={isAnalyzing || !capturedImage}
              className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              Re-check
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientPersonRecognition;
