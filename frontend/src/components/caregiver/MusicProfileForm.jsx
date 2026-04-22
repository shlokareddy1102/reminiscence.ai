/**
 * MusicProfileForm.jsx
 *
 * Caregiver sets patient music preferences.
 * Add this to the patient profile/settings page in the caregiver dashboard.
 *
 * Usage:
 *   import MusicProfileForm from "@/components/caregiver/MusicProfileForm";
 *   <MusicProfileForm patientId={selectedPatientId} />
 */

import { useEffect, useState } from "react";
import { Music2, Save, CheckCircle2 } from "lucide-react";
import { apiRequest } from "@/lib/api";

const GENRE_OPTIONS = [
  "classical", "jazz", "folk", "pop", "rock", "bollywood",
  "devotional", "oldies", "blues", "country", "instrumental",
];

const TEMPO_OPTIONS = [
  { value: "calm",      label: "Calm only",           desc: "Relaxing, slow tempo" },
  { value: "medium",    label: "Medium",               desc: "Balanced energy" },
  { value: "energetic", label: "Uplifting only",       desc: "Higher tempo, cheerful" },
  { value: "mixed",     label: "Mixed (recommended)",  desc: "A blend of both" },
];

const MusicProfileForm = ({ patientId }) => {
  const [birthYear,        setBirthYear]        = useState("");
  const [preferredGenres,  setPreferredGenres]  = useState([]);
  const [preferredTempo,   setPreferredTempo]   = useState("mixed");
  const [knownFavourites,  setKnownFavourites]  = useState("");
  const [saved,            setSaved]            = useState(false);
  const [saving,           setSaving]           = useState(false);

  useEffect(() => {
    if (!patientId) return;
    apiRequest(`/api/music/${patientId}/profile`)
      .then((p) => {
        if (!p) return;
        setBirthYear(p.birthYear ? String(p.birthYear) : "");
        setPreferredGenres(p.preferredGenres || []);
        setPreferredTempo(p.preferredTempo || "mixed");
        setKnownFavourites((p.knownFavourites || []).join(", "));
      })
      .catch(() => {});
  }, [patientId]);

  const toggleGenre = (g) => {
    setPreferredGenres((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    );
  };

  const handleSave = async () => {
    if (!patientId) return;
    setSaving(true);
    try {
      await apiRequest(`/api/music/${patientId}/profile`, {
        method: "POST",
        body: JSON.stringify({
          birthYear:       birthYear ? Number(birthYear) : null,
          preferredGenres,
          preferredTempo,
          knownFavourites: knownFavourites
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {}
    finally { setSaving(false); }
  };

  const goldenEra = birthYear
    ? `${Number(birthYear) + 10}–${Number(birthYear) + 25}`
    : null;

  return (
    <section className="bg-card border border-border rounded-2xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Music2 className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Music therapy preferences</h2>
      </div>

      {/* Birth year */}
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1.5">
          Patient birth year
        </label>
        <input
          type="number"
          value={birthYear}
          onChange={(e) => setBirthYear(e.target.value)}
          placeholder="e.g. 1952"
          min="1920" max="2005"
          className="w-full rounded-xl border border-border bg-background px-3 py-2
                     text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        {goldenEra && (
          <p className="text-xs text-primary mt-1">
            Golden era: {goldenEra} — songs from these years will be prioritised
          </p>
        )}
      </div>

      {/* Genres */}
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1.5">
          Preferred genres (select all that apply)
        </label>
        <div className="flex flex-wrap gap-2">
          {GENRE_OPTIONS.map((g) => (
            <button key={g} type="button" onClick={() => toggleGenre(g)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border capitalize transition-colors ${
                preferredGenres.includes(g)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Tempo */}
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1.5">
          Preferred tempo
        </label>
        <div className="grid grid-cols-2 gap-2">
          {TEMPO_OPTIONS.map((t) => (
            <button key={t.value} type="button" onClick={() => setPreferredTempo(t.value)}
              className={`rounded-xl border p-3 text-left transition-colors ${
                preferredTempo === t.value
                  ? "border-primary bg-primary/8"
                  : "border-border hover:border-primary/30"
              }`}
              style={{ background: preferredTempo === t.value ? "hsl(205 56% 46% / 0.07)" : undefined }}
            >
              <p className={`text-xs font-semibold ${preferredTempo === t.value ? "text-primary" : "text-foreground"}`}>
                {t.label}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Known favourites */}
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1.5">
          Known favourite artists or songs (comma separated)
        </label>
        <input
          value={knownFavourites}
          onChange={(e) => setKnownFavourites(e.target.value)}
          placeholder="e.g. Kishore Kumar, Lata Mangeshkar, old Hindi songs"
          className="w-full rounded-xl border border-border bg-background px-3 py-2
                     text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <p className="text-xs text-muted-foreground mt-1">
          The system will search Jamendo for similar music
        </p>
      </div>

      <button type="button" onClick={handleSave} disabled={saving}
        className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground
                   text-sm font-semibold flex items-center justify-center gap-2
                   hover:bg-primary/90 disabled:opacity-60 transition-colors">
        {saved
          ? <><CheckCircle2 className="w-4 h-4" /> Saved</>
          : saving
            ? "Saving…"
            : <><Save className="w-4 h-4" /> Save preferences</>
        }
      </button>
    </section>
  );
};

export default MusicProfileForm;