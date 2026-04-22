/**
 * PatientMusic.jsx  —  /patient/music
 *
 * Full music therapy page:
 *  - Personalised "For You" + Calm + Energetic sections
 *  - Search bar (Jamendo search)
 *  - Full audio player with progress bar
 *  - Behaviour tracking (play time, skip, repeat, thumbs)
 *  - Calm + reassuring UI with large tap targets (dementia-friendly)
 */

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Play, Pause, SkipForward, SkipBack, Repeat,
  ThumbsUp, ThumbsDown, Search, Music2, Volume2,
  Wind, Zap, Heart, ChevronRight, Loader2
} from "lucide-react";
import PatientLayout from "@/components/patient/PatientLayout";
import { apiRequest } from "@/lib/api";
import { getPatientPreviewId } from "@/lib/auth";

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtTime = (s) => {
  if (!s || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

const getTimeOfDay = () => {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  if (h < 21) return "evening";
  return "night";
};

const TEMPO_SECTIONS = [
  { key: "forYou",    label: "For You 🎵",       icon: Heart,  color: "text-primary" },
  { key: "calm",      label: "Calm & Relaxing 🌙", icon: Wind,   color: "text-blue-500" },
  { key: "energetic", label: "Uplifting 🌟",       icon: Zap,    color: "text-amber-500" },
];

// ── Track card ────────────────────────────────────────────────────────────────
const TrackCard = ({ track, isPlaying, onPlay }) => (
  <button
    type="button"
    onClick={() => onPlay(track)}
    className={`flex items-center gap-3 w-full rounded-2xl border p-3
                text-left transition-all hover-lift
                ${isPlaying
                  ? "border-primary/40 bg-primary/8"
                  : "border-border bg-card hover:border-primary/20"
                }`}
    style={{ background: isPlaying ? "hsl(205 56% 46% / 0.07)" : undefined }}
  >
    {/* Album art */}
    <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-muted relative">
      {track.imageUrl
        ? <img src={track.imageUrl} alt={track.name}
            className="w-full h-full object-cover" />
        : <div className="w-full h-full flex items-center justify-center">
            <Music2 className="w-6 h-6 text-muted-foreground" />
          </div>
      }
      {isPlaying && (
        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
          <div className="flex gap-0.5 items-end h-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-1 bg-primary rounded-full animate-pulse-gentle"
                style={{
                  height: `${[60, 100, 75][i - 1]}%`,
                  animationDelay: `${i * 150}ms`
                }} />
            ))}
          </div>
        </div>
      )}
    </div>

    <div className="flex-1 min-w-0">
      <p className={`font-semibold truncate leading-tight ${isPlaying ? "text-primary" : "text-foreground"}`}
        style={{ fontSize: "1rem" }}>
        {track.name}
      </p>
      <p className="text-sm text-muted-foreground truncate mt-0.5">{track.artist}</p>
      <div className="flex items-center gap-2 mt-1">
        {track.tempo && (
          <span className={`text-xs px-2 py-0.5 rounded-full border ${
            track.tempo === "low" || track.tempo === "calm"
              ? "border-blue-200 bg-blue-50 text-blue-600"
              : track.tempo === "high" || track.tempo === "energetic"
                ? "border-amber-200 bg-amber-50 text-amber-600"
                : "border-border bg-muted/50 text-muted-foreground"
          }`}>
            {track.tempo === "low" || track.tempo === "calm" ? "Calm"
             : track.tempo === "high" || track.tempo === "energetic" ? "Energetic"
             : "Medium"}
          </span>
        )}
        {track.genre && (
          <span className="text-xs text-muted-foreground">{track.genre}</span>
        )}
      </div>
    </div>

    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
  </button>
);

// ── Main page ─────────────────────────────────────────────────────────────────
const PatientMusic = () => {
  const [patientId,    setPatientId]    = useState(null);
  const [recs,         setRecs]         = useState({ forYou: [], calm: [], energetic: [] });
  const [searchQuery,  setSearchQuery]  = useState("");
  const [searchResults,setSearchResults]= useState([]);
  const [searching,    setSearching]    = useState(false);
  const [loading,      setLoading]      = useState(true);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying,    setIsPlaying]    = useState(false);
  const [progress,     setProgress]     = useState(0);    // 0-100
  const [currentTime,  setCurrentTime]  = useState(0);
  const [duration,     setDuration]     = useState(0);
  const [repeatMode,   setRepeatMode]   = useState(false);
  const [sessionId,    setSessionId]    = useState(null);
  const [repeatCount,  setRepeatCount]  = useState(0);
  const [activeSection,setActiveSection]= useState("forYou");

  const audioRef       = useRef(null);
  const trackStartRef  = useRef(null);
  const sessionEndedRef= useRef(false);

  // ── Load patient ID ─────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const previewId = getPatientPreviewId();
        const patient   = await apiRequest(
          previewId ? `/api/patient/${previewId}` : "/api/patient"
        );
        if (patient?._id) setPatientId(patient._id);
      } catch {}
    };
    load();
  }, []);

  // ── Load recommendations ────────────────────────────────────────────────────
  useEffect(() => {
    if (!patientId) return;
    setLoading(true);
    apiRequest(`/api/music/${patientId}/recommendations`)
      .then((r) => setRecs({
        forYou:    r?.forYou    || [],
        calm:      r?.calm      || [],
        energetic: r?.energetic || [],
      }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [patientId]);

  // ── Audio event listeners ───────────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    const onLoadedMetadata = () => {
      setDuration(audio.duration || 0);
    };

    const onEnded = () => {
      setIsPlaying(false);
      if (repeatMode) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
        setRepeatCount((c) => c + 1);
        updateSession({ completed: false, repeatCount: repeatCount + 1 });
      } else {
        updateSession({ completed: true });
      }
    };

    audio.addEventListener("timeupdate",     onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended",          onEnded);

    return () => {
      audio.removeEventListener("timeupdate",     onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended",          onEnded);
    };
  }, [repeatMode, repeatCount, sessionId]);

  // ── Start a listening session when track changes ────────────────────────────
  const startSession = useCallback(async (track) => {
    if (!patientId || !track?.id) return;
    try {
      const res = await apiRequest(`/api/music/${patientId}/session`, {
        method: "POST",
        body: JSON.stringify({
          trackId:         track.id,
          trackName:       track.name,
          artistName:      track.artist,
          genre:           track.genre,
          tempo:           track.tempo,
          durationSeconds: track.duration || 0,
        }),
      });
      setSessionId(res?.sessionId || null);
      sessionEndedRef.current = false;
      trackStartRef.current   = Date.now();
    } catch {}
  }, [patientId]);

  // ── Update session in backend ───────────────────────────────────────────────
  const updateSession = useCallback(async (updates = {}) => {
    if (!sessionId || !patientId || sessionEndedRef.current) return;
    const listenedSeconds = trackStartRef.current
      ? Math.floor((Date.now() - trackStartRef.current) / 1000)
      : 0;
    try {
      await apiRequest(`/api/music/${patientId}/session/${sessionId}/update`, {
        method: "POST",
        body: JSON.stringify({ listenedSeconds, ...updates }),
      });
      if (updates.completed || updates.skipAtPercent != null) {
        sessionEndedRef.current = true;
      }
    } catch {}
  }, [sessionId, patientId]);

  // ── Play a track ────────────────────────────────────────────────────────────
  const playTrack = useCallback(async (track) => {
    const audio = audioRef.current;
    if (!audio || !track?.audioUrl) return;

    // End current session if switching tracks mid-play
    if (currentTrack && currentTrack.id !== track.id && isPlaying) {
      const skipPct = duration > 0 ? Math.round((currentTime / duration) * 100) : null;
      await updateSession({ skipAtPercent: skipPct });
    }

    setCurrentTrack(track);
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
    setRepeatCount(0);

    audio.src = track.audioUrl;
    audio.load();

    try {
      await audio.play();
      setIsPlaying(true);
      await startSession(track);
    } catch (err) {
      console.error("Audio play error:", err);
    }
  }, [currentTrack, isPlaying, currentTime, duration, updateSession, startSession]);

  // ── Toggle play/pause ───────────────────────────────────────────────────────
  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  // ── Skip forward in current section ────────────────────────────────────────
  const skipForward = async () => {
    const list = activeList();
    if (!list.length) return;
    const idx  = list.findIndex((t) => t.id === currentTrack?.id);
    const next = list[(idx + 1) % list.length];
    if (next) {
      const skipPct = duration > 0 ? Math.round((currentTime / duration) * 100) : null;
      await updateSession({ skipAtPercent: skipPct });
      playTrack(next);
    }
  };

  const skipBack = () => {
    const audio = audioRef.current;
    if (audio) { audio.currentTime = 0; setCurrentTime(0); setProgress(0); }
  };

  // ── Thumbs ──────────────────────────────────────────────────────────────────
  const sendThumb = async (up) => {
    await updateSession({ thumbsUp: up });
  };

  // ── Seek ────────────────────────────────────────────────────────────────────
  const handleSeek = (e) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect  = e.currentTarget.getBoundingClientRect();
    const pct   = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = pct * duration;
  };

  // ── Search ──────────────────────────────────────────────────────────────────
  const handleSearch = async (q) => {
    setSearchQuery(q);
    if (!q.trim() || !patientId) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await apiRequest(
        `/api/music/${patientId}/search?q=${encodeURIComponent(q)}`
      );
      setSearchResults(res?.tracks || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const activeList = () => {
    if (searchQuery.trim()) return searchResults;
    return recs[activeSection] || [];
  };

  const allTracks = [...recs.forYou, ...recs.calm, ...recs.energetic];

  return (
    <PatientLayout>
      <audio ref={audioRef} preload="metadata" />

      <div className="max-w-2xl mx-auto w-full space-y-4 pb-48">

        {/* Header */}
        <section className="glass rounded-3xl p-5 hover-lift">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-2xl bg-primary/12 flex items-center justify-center">
              <Music2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground">Music</h1>
              <p className="text-sm text-muted-foreground">Songs chosen just for you</p>
            </div>
          </div>
        </section>

        {/* Search */}
        <section className="bg-card border border-border rounded-2xl px-4 py-3">
          <div className="flex items-center gap-2">
            {searching
              ? <Loader2 className="w-5 h-5 text-muted-foreground animate-spin shrink-0" />
              : <Search className="w-5 h-5 text-muted-foreground shrink-0" />
            }
            <input
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search for a song or artist…"
              className="flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground/60
                         focus:outline-none"
              style={{ fontSize: "1.05rem" }}
            />
            {searchQuery && (
              <button type="button" onClick={() => { setSearchQuery(""); setSearchResults([]); }}
                className="text-xs text-muted-foreground hover:text-foreground px-2">
                Clear
              </button>
            )}
          </div>
        </section>

        {/* Section tabs — only when not searching */}
        {!searchQuery.trim() && (
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {TEMPO_SECTIONS.map((sec) => {
              const Icon = sec.icon;
              return (
                <button key={sec.key} type="button"
                  onClick={() => setActiveSection(sec.key)}
                  className={`shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-2xl
                               border text-sm font-medium transition-all ${
                    activeSection === sec.key
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {sec.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Track list */}
        <section className="space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              <span>Loading songs for you…</span>
            </div>
          ) : activeList().length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Music2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>{searchQuery ? "No songs found. Try a different search." : "No songs available right now."}</p>
            </div>
          ) : (
            activeList().map((track) => (
              <TrackCard
                key={track.id}
                track={track}
                isPlaying={isPlaying && currentTrack?.id === track.id}
                onPlay={playTrack}
              />
            ))
          )}
        </section>
      </div>

      {/* ── Sticky player ── */}
      {currentTrack && (
        <div className="fixed bottom-0 left-0 right-0 z-40"
          style={{
            background: "hsl(0 0% 100% / 0.95)",
            backdropFilter: "blur(20px)",
            borderTop: "1px solid hsl(206 25% 88%)",
            boxShadow: "0 -8px 32px -8px hsl(205 56% 46% / 0.15)",
          }}
        >
          {/* Progress bar — tap to seek */}
          <div className="h-1.5 bg-muted cursor-pointer" onClick={handleSeek}>
            <div className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${progress}%` }} />
          </div>

          <div className="px-4 py-3">
            {/* Track info */}
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-muted shrink-0">
                {currentTrack.imageUrl
                  ? <img src={currentTrack.imageUrl} alt={currentTrack.name}
                      className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center">
                      <Music2 className="w-5 h-5 text-muted-foreground" />
                    </div>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground truncate" style={{ fontSize: "1rem" }}>
                  {currentTrack.name}
                </p>
                <p className="text-sm text-muted-foreground truncate">{currentTrack.artist}</p>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span>{fmtTime(currentTime)}</span>
                <span>/</span>
                <span>{fmtTime(duration)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between">
              {/* Thumbs down */}
              <button type="button" onClick={() => sendThumb(false)}
                className="w-10 h-10 rounded-full border border-border flex items-center justify-center
                           text-muted-foreground hover:text-red-500 hover:border-red-200 transition-colors">
                <ThumbsDown className="w-4 h-4" />
              </button>

              {/* Prev */}
              <button type="button" onClick={skipBack}
                className="w-11 h-11 rounded-full border border-border flex items-center justify-center
                           text-muted-foreground hover:text-foreground transition-colors">
                <SkipBack className="w-5 h-5" />
              </button>

              {/* Play / Pause */}
              <button type="button" onClick={togglePlay}
                className="w-16 h-16 rounded-full bg-primary text-primary-foreground
                           flex items-center justify-center shadow-calm
                           hover:bg-primary/90 active:scale-95 transition-all">
                {isPlaying
                  ? <Pause className="w-7 h-7"  />
                  : <Play  className="w-7 h-7 ml-0.5" />
                }
              </button>

              {/* Next */}
              <button type="button" onClick={skipForward}
                className="w-11 h-11 rounded-full border border-border flex items-center justify-center
                           text-muted-foreground hover:text-foreground transition-colors">
                <SkipForward className="w-5 h-5" />
              </button>

              {/* Thumbs up */}
              <button type="button" onClick={() => sendThumb(true)}
                className="w-10 h-10 rounded-full border border-border flex items-center justify-center
                           text-muted-foreground hover:text-emerald-500 hover:border-emerald-200 transition-colors">
                <ThumbsUp className="w-4 h-4" />
              </button>
            </div>

            {/* Repeat toggle */}
            <div className="flex justify-center mt-2">
              <button type="button" onClick={() => setRepeatMode((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                            border transition-colors ${
                  repeatMode
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground"
                }`}
              >
                <Repeat className="w-3.5 h-3.5" />
                Repeat
              </button>
            </div>
          </div>
        </div>
      )}
    </PatientLayout>
  );
};

export default PatientMusic;