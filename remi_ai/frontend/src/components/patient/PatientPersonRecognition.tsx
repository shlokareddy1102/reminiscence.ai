import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, User, Heart, SwitchCamera } from "lucide-react";
import {
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(true);

  const speakMessage = (message: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
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
    } catch (_err) {
      setError("Camera access failed. Please allow camera permissions.");
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
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
      setError(err instanceof Error ? err.message : "Recognition failed");
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
          </div>

          {/* Capture button */}
          <button
            onClick={handleCapture}
            className="py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 active:scale-[0.98] transition-all"
          >
            <Camera className="w-5 h-5" />
            Take Photo
          </button>
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
              </div>
            </div>
          )}

          {noMatch && (
            <div className="bg-warning/10 border border-warning/20 rounded-lg p-2 animate-fade-in text-center">
              <p className="text-sm font-display font-semibold text-foreground">Not recognized</p>
              <p className="text-xs text-muted-foreground">Ask caregiver to add photo</p>
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
