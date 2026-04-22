import { useEffect, useRef, useState } from "react";
import { Upload, UserPlus, X, Trash2, Users } from "lucide-react";
import {
  KnownPerson,
  getKnownPeople,
  addKnownPerson,
  removeKnownPerson,
} from "@/lib/knownPeople";

type KnownPeopleManagerProps = {
  patientId?: string | null;
};

const KnownPeopleManager = ({ patientId }: KnownPeopleManagerProps) => {
  const [people, setPeople] = useState<KnownPerson[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("");
  const [notes, setNotes] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleAdd = async () => {
    if (!patientId || !name.trim() || !relation.trim() || !photoFile) return;

    try {
      setIsSaving(true);
      setError(null);
      const person = await addKnownPerson({
        patientId,
        name: name.trim(),
        relation: relation.trim(),
        notes: notes.trim(),
        photoFile
      });
      setPeople((prev) => [...prev, person]);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add person");
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
    setName("");
    setRelation("");
    setNotes("");
    setPhotoFile(null);
    setPhotoPreview(null);
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
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Add
          </button>
        )}
      </div>

      {isAdding && (
        <div className="border border-border rounded-lg p-3 mb-3 space-y-2 animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Add a person</span>
            <button onClick={resetForm} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Photo upload */}
          {!photoPreview ? (
            <label className="flex flex-col items-center gap-1 border-2 border-dashed border-border rounded-lg p-4 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors">
              <Upload className="w-5 h-5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Upload photo</span>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
            </label>
          ) : (
            <div className="relative w-24 h-24 mx-auto">
              <img src={photoPreview} alt="Preview" className="w-24 h-24 rounded-xl object-cover" />
              <button
                onClick={() => {
                  setPhotoFile(null);
                  setPhotoPreview(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-alert text-alert-foreground flex items-center justify-center"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

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

          <button
            onClick={handleAdd}
            disabled={isSaving || !patientId || !name.trim() || !relation.trim() || !photoFile}
            className="w-full py-2 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-40"
          >
            {isSaving ? "Saving..." : "Save Person"}
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
              <div className="p-2">
                <p className="text-sm font-medium text-foreground truncate">{person.name}</p>
                <p className="text-xs text-muted-foreground truncate">{person.relation}</p>
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
