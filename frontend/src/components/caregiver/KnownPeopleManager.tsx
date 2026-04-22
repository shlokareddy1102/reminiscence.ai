import { useEffect, useRef, useState } from "react";
import { Upload, UserPlus, X, Trash2, Users, Camera } from "lucide-react";
import {
  KnownPerson,
  getKnownPeople,
  addKnownPerson,
  addKnownPersonPhoto,
  removeKnownPerson,
} from "@/lib/knownPeople";

type KnownPeopleManagerProps = {
  patientId?: string | null;
};

type ExistingPhotoTarget = {
  id: string;
  name: string;
};

const KnownPeopleManager = ({ patientId }: KnownPeopleManagerProps) => {
  const [people, setPeople] = useState<KnownPerson[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [existingPhotoTarget, setExistingPhotoTarget] = useState<ExistingPhotoTarget | null>(null);
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("");
  const [notes, setNotes] = useState("");
  const [photoData, setPhotoData] = useState<string>("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoMode, setPhotoMode] = useState<"upload" | "camera">("upload");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const loadPeople = async () => {
      if (!patientId) {
        setPeople([]);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const list = await getKnownPeople(patientId);
        setPeople(list);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load known people");
      } finally {
        setIsLoading(false);
      }
    };

    loadPeople();
  }, [patientId]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraError(null);
      setCameraActive(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to open camera";
      setCameraError(message);
      setCameraActive(false);
    }
  };

  const setPhotoFromDataUrl = (dataUrl: string) => {
    setPhotoData(dataUrl);
    setPhotoPreview(dataUrl);
  };

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPhotoFromDataUrl(String(ev.target?.result || ""));
    };
    reader.readAsDataURL(file);
  };

  const captureCameraPhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setPhotoFromDataUrl(canvas.toDataURL("image/jpeg"));
    stopCamera();
  };

  const handleSave = async () => {
    if (!patientId || !photoPreview) return;
    if (!existingPhotoTarget && (!name.trim() || !relation.trim())) return;

    try {
      setIsSaving(true);
      setError(null);

      if (existingPhotoTarget) {
        const updated = await addKnownPersonPhoto(existingPhotoTarget.id, photoData);
        setPeople((prev) => prev.map((person) => (person.id === updated.id ? updated : person)));
      } else {
        const person = await addKnownPerson({
          patientId,
          name: name.trim(),
          relation: relation.trim(),
          notes: notes.trim(),
          photoData
        });
        setPeople((prev) => [...prev, person]);
      }

      resetForm();
      const refreshed = await getKnownPeople(patientId);
      setPeople(refreshed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save person");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      setError(null);
      await removeKnownPerson(id);
      setPeople((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove person");
    }
  };

  const resetForm = () => {
    setIsAdding(false);
    setExistingPhotoTarget(null);
    setName("");
    setRelation("");
    setNotes("");
    setPhotoData("");
    setPhotoPreview(null);
    setCameraError(null);
    stopCamera();
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="bg-card rounded-xl border border-border p-4 shadow-gentle">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
            <Users className="w-4 h-4 text-accent" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-foreground">Known People</h3>
            <p className="text-[11px] text-muted-foreground">Upload faces and info to improve patient dashboard recognition</p>
          </div>
        </div>
        {!isAdding && (
          <button
            onClick={() => {
              setExistingPhotoTarget(null);
              setIsAdding(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Add
          </button>
        )}
      </div>

      {isAdding && (
        <div className="border border-border rounded-lg p-3 mb-3 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="text-sm font-medium text-foreground">
                {existingPhotoTarget ? `Add photo for ${existingPhotoTarget.name}` : "Add a person"}
              </span>
              <p className="text-[11px] text-muted-foreground">
                {existingPhotoTarget ? "Capture or import another clear face photo." : "Choose camera or upload to store a real face photo."}
              </p>
            </div>
            <button onClick={resetForm} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPhotoMode("upload")}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium border transition-colors ${photoMode === "upload" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"}`}
            >
              Import photo
            </button>
            <button
              type="button"
              onClick={() => setPhotoMode("camera")}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium border transition-colors ${photoMode === "camera" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"}`}
            >
              Take photo
            </button>
          </div>

          {photoMode === "upload" ? (
            <div>
              {!photoPreview ? (
                <label className="flex flex-col items-center gap-1 border-2 border-dashed border-border rounded-lg p-4 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors">
                  <Upload className="w-5 h-5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Upload photo</span>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
                </label>
              ) : (
                <div className="relative w-28 h-28 mx-auto">
                  <img src={photoPreview} alt="Preview" className="w-28 h-28 rounded-xl object-cover" />
                  <button
                    onClick={() => {
                      setPhotoData("");
                      setPhotoPreview(null);
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-alert text-alert-foreground flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="rounded-xl overflow-hidden border border-border bg-black/90">
                <video ref={videoRef} className="w-full h-52 object-cover" autoPlay playsInline muted />
                <canvas ref={canvasRef} className="hidden" />
              </div>
              <div className="flex gap-2">
                {!cameraActive ? (
                  <button
                    type="button"
                    onClick={startCamera}
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2"
                  >
                    <Camera className="w-4 h-4" />
                    Start camera
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={captureCameraPhoto}
                      className="flex-1 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
                    >
                      Capture photo
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
                    >
                      Stop
                    </button>
                  </>
                )}
              </div>
              {cameraError && <p className="text-xs text-alert">{cameraError}</p>}
              {photoPreview && (
                <div className="relative w-28 h-28 mx-auto">
                  <img src={photoPreview} alt="Preview" className="w-28 h-28 rounded-xl object-cover" />
                  <button
                    onClick={() => setPhotoData("")}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-alert text-alert-foreground flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          )}

          {!existingPhotoTarget && (
            <>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name (e.g. Sarah)"
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                value={relation}
                onChange={(e) => setRelation(e.target.value)}
                placeholder="Relation (e.g. Wife, Daughter)"
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes (optional)"
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </>
          )}

          <button
            onClick={handleSave}
            disabled={isSaving || !patientId || !photoPreview || (!existingPhotoTarget && (!name.trim() || !relation.trim()))}
            className="w-full py-2 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-40"
          >
            {isSaving ? "Saving..." : existingPhotoTarget ? "Add Photo" : "Save Person"}
          </button>
        </div>
      )}

      {error && <p className="text-xs text-alert mb-2">{error}</p>}
      {!patientId && <p className="text-xs text-warning mb-2">Patient context unavailable. Reload after login.</p>}
      {isLoading && <p className="text-xs text-muted-foreground mb-2">Loading known people...</p>}

      {/* People list */}
      {people.length === 0 && !isAdding ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          No people added yet. Add photos so Josh can identify familiar faces.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {people.map((person) => (
            <div key={person.id} className="relative group rounded-xl border border-border overflow-hidden bg-muted/30">
              <img src={person.photoUrl} alt={person.name} className="w-full h-24 object-cover" />
              <div className="p-2 space-y-1">
                <p className="text-sm font-medium text-foreground truncate">{person.name}</p>
                <p className="text-xs text-muted-foreground truncate">{person.relation}</p>
                <button
                  type="button"
                  onClick={() => {
                    setExistingPhotoTarget({ id: person.id, name: person.name });
                    setIsAdding(true);
                    setError(null);
                    setPhotoMode("upload");
                    setPhotoData("");
                    setPhotoPreview(null);
                    setCameraError(null);
                    stopCamera();
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                  className="text-[11px] font-medium text-primary hover:underline"
                >
                  Add photo
                </button>
              </div>
              <button
                onClick={() => handleRemove(person.id)}
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-alert/80 text-alert-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default KnownPeopleManager;
