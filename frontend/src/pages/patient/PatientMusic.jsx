/**
 * PatientMusic.jsx  —  /patient/music
 *
 * Redesigned to match the reference UI:
 * - Greeting header with date/time
 * - Search bar
 * - "Recommended for you" 2-column grid of track cards
 * - "Playlists you might like" horizontal scroll section
 * - "Calm & Relaxing" and "Uplifting" sections
 * - Sticky bottom player
 * - All behaviour tracking preserved
 */

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Play, Pause, SkipForward, SkipBack, Repeat,
  ThumbsUp, ThumbsDown, Search, Music2,
  Heart, Loader2, X
} from "lucide-react";
import PatientLayout from "@/components/patient/PatientLayout";
import { apiRequest } from "@/lib/api";
import { getPatientPreviewId } from "@/lib/auth";

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtTime = (s) => {
  if (!s || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
};

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

const todayLabel = () =>
  new Date().toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric"
  });

const PLAYLISTS = [
  { key: "calm",      label: "Calming",              sub: "Soft and soothing",       color: "#f3edff", icon: "🌙" },
  { key: "memories",  label: "Memories from Youth",  sub: "From the 1940s & 50s",    color: "#f7f1ff", icon: "💛" },
  { key: "energetic", label: "Sing-Along Classics",  sub: "Familiar favourites",     color: "#ece2ff", icon: "🎵" },
];

// ── Track card (2-col grid style) ─────────────────────────────────────────────
const TrackCard = ({ track, isPlaying, onPlay }) => (
  <button type="button" onClick={() => onPlay(track)}
    className="flex items-center gap-3 rounded-2xl border bg-white p-3 text-left
               transition-all hover:shadow-md hover:border-primary/30 active:scale-[0.98]"
    style={{
      border: isPlaying ? "1.5px solid hsl(var(--primary))" : "1.5px solid hsl(var(--border))",
      background: isPlaying ? "hsl(var(--primary) / 0.08)" : "white",
    }}
  >
    {/* Art */}
    <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-muted shrink-0">
      {track.imageUrl
        ? <img src={track.imageUrl} alt={track.name} className="w-full h-full object-cover" />
        : <div className="w-full h-full flex items-center justify-center bg-primary/10">
            <Music2 className="w-6 h-6 text-primary/50" />
          </div>
      }
      {isPlaying && (
        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
          <div className="flex gap-0.5 items-end h-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-1 rounded-full bg-primary animate-pulse-gentle"
                style={{ height: `${[55, 100, 70][i - 1]}%`, animationDelay: `${i * 120}ms` }} />
            ))}
          </div>
        </div>
      )}
    </div>

    {/* Info */}
    <div className="flex-1 min-w-0">
      <p className={`font-semibold leading-tight truncate ${isPlaying ? "text-primary" : "text-foreground"}`}
        style={{ fontSize: "0.95rem" }}>
        {track.name}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5 truncate">
        {track.artist}{track.era ? ` · ${track.era}` : ""}
      </p>
    </div>

    {/* Play button */}
    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-primary">
      {isPlaying
        ? <Pause className="w-4 h-4 text-white" />
        : <Play className="w-4 h-4 text-white ml-0.5" />
      }
    </div>
  </button>
);

// ── Playlist card (horizontal scroll) ────────────────────────────────────────
const PlaylistCard = ({ playlist, tracks, onPlay }) => (
  <button type="button"
    onClick={() => tracks[0] && onPlay(tracks[0])}
    className="shrink-0 w-48 rounded-2xl overflow-hidden text-left transition-all
               hover:shadow-lg active:scale-[0.97]"
    style={{ background: playlist.color, border: "1px solid hsl(var(--border))" }}
  >
    <div className="p-4">
      <p className="text-2xl mb-2">{playlist.icon}</p>
      <p className="font-bold text-foreground text-sm leading-tight">{playlist.label}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{playlist.sub}</p>
      <p className="text-xs text-muted-foreground mt-2">{tracks.length} songs</p>
    </div>
  </button>
);

// ── Main ──────────────────────────────────────────────────────────────────────
const PatientMusic = () => {
  const [patientId,     setPatientId]     = useState(null);
  const [patientName,   setPatientName]   = useState("there");
  const [recs,          setRecs]          = useState({ forYou: [], calm: [], energetic: [] });
  const [searchQuery,   setSearchQuery]   = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching,     setSearching]     = useState(false);
  const [loading,       setLoading]       = useState(true);
  const [currentTrack,  setCurrentTrack]  = useState(null);
  const [isPlaying,     setIsPlaying]     = useState(false);
  const [progress,      setProgress]      = useState(0);
  const [currentTime,   setCurrentTime]   = useState(0);
  const [duration,      setDuration]      = useState(0);
  const [repeatMode,    setRepeatMode]    = useState(false);
  const [sessionId,     setSessionId]     = useState(null);
  const [repeatCount,   setRepeatCount]   = useState(0);

  const audioRef      = useRef(null);
  const trackStartRef = useRef(null);
  const sessionEndRef = useRef(false);
  const searchTimer   = useRef(null);

  // ── Load patient ────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const pid     = getPatientPreviewId();
        const patient = await apiRequest(pid ? `/api/patient/${pid}` : "/api/patient");
        if (patient?._id)  setPatientId(patient._id);
        if (patient?.name) setPatientName(patient.name.split(" ")[0]);
      } catch {}
    };
    load();
  }, []);

  // ── Load recommendations ────────────────────────────────────────────────────
  useEffect(() => {
    if (!patientId) return;
    setLoading(true);
    apiRequest(`/api/music/${patientId}/recommendations`)
      .then((r) => setRecs({ forYou: r?.forYou || [], calm: r?.calm || [], energetic: r?.energetic || [] }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [patientId]);

  // ── Audio events ────────────────────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => {
      setCurrentTime(audio.currentTime);
      if (audio.duration) setProgress((audio.currentTime / audio.duration) * 100);
    };
    const onMeta  = () => setDuration(audio.duration || 0);
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

    audio.addEventListener("timeupdate",     onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended",          onEnded);
    return () => {
      audio.removeEventListener("timeupdate",     onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended",          onEnded);
    };
  }, [repeatMode, repeatCount, sessionId]);

  // ── Session helpers ─────────────────────────────────────────────────────────
  const startSession = useCallback(async (track) => {
    if (!patientId || !track?.id) return;
    try {
      const res = await apiRequest(`/api/music/${patientId}/session`, {
        method: "POST",
        body: JSON.stringify({
          trackId: track.id, trackName: track.name,
          artistName: track.artist, genre: track.genre,
          tempo: track.tempo, durationSeconds: track.duration || 0,
        }),
      });
      setSessionId(res?.sessionId || null);
      sessionEndRef.current   = false;
      trackStartRef.current   = Date.now();
    } catch {}
  }, [patientId]);

  const updateSession = useCallback(async (updates = {}) => {
    if (!sessionId || !patientId || sessionEndRef.current) return;
    const listenedSeconds = trackStartRef.current
      ? Math.floor((Date.now() - trackStartRef.current) / 1000) : 0;
    try {
      await apiRequest(`/api/music/${patientId}/session/${sessionId}/update`, {
        method: "POST",
        body: JSON.stringify({ listenedSeconds, ...updates }),
      });
      if (updates.completed || updates.skipAtPercent != null)
        sessionEndRef.current = true;
    } catch {}
  }, [sessionId, patientId]);

  // ── Play ────────────────────────────────────────────────────────────────────
  const playTrack = useCallback(async (track) => {
    const audio = audioRef.current;
    if (!audio || !track?.audioUrl) return;

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

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) { audio.pause(); setIsPlaying(false); }
    else           { audio.play().catch(() => {}); setIsPlaying(true); }
  };

  const skipForward = async () => {
    const list = currentList();
    if (!list.length) return;
    const idx  = list.findIndex((t) => t.id === currentTrack?.id);
    const next = list[(idx + 1) % list.length];
    if (next) {
      await updateSession({ skipAtPercent: duration > 0 ? Math.round((currentTime / duration) * 100) : null });
      playTrack(next);
    }
  };

  const skipBack = () => {
    const audio = audioRef.current;
    if (audio) { audio.currentTime = 0; setCurrentTime(0); setProgress(0); }
  };

  const sendThumb = async (up) => { await updateSession({ thumbsUp: up }); };

  const handleSeek = (e) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = pct * duration;
  };

  const currentList = () => {
    if (searchQuery.trim()) return searchResults;
    return [...recs.forYou, ...recs.calm, ...recs.energetic];
  };

  // ── Search with debounce ────────────────────────────────────────────────────
  const handleSearch = (q) => {
    setSearchQuery(q);
    clearTimeout(searchTimer.current);
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await apiRequest(`/api/music/${patientId}/search?q=${encodeURIComponent(q)}`);
        setSearchResults(res?.tracks || []);
      } catch { setSearchResults([]); }
      finally  { setSearching(false); }
    }, 400);
  };

  const isCurrentTrack = (t) => isPlaying && currentTrack?.id === t.id;

  return (
    <PatientLayout>
      <audio ref={audioRef} preload="metadata" />

      {/* pb-36 so sticky player doesn't overlap last content */}
      <div className="max-w-6xl mx-auto w-full pb-36 space-y-6 px-1">

        {/* ── Greeting header ── */}
        <section className="pt-2">
          <p className="text-sm text-muted-foreground">{todayLabel()}</p>
          <h1 className="text-2xl font-bold text-foreground mt-0.5">
            {greeting()}, {patientName}
          </h1>
        </section>

        {/* ── Search ── */}
        <section className="relative">
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-white px-4 py-3 shadow-sm">
            {searching
              ? <Loader2 className="w-5 h-5 text-muted-foreground animate-spin shrink-0" />
              : <Search  className="w-5 h-5 text-muted-foreground shrink-0" />
            }
            <input
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search a song or artist…"
              className="flex-1 bg-transparent text-base text-foreground
                         placeholder:text-muted-foreground/60 focus:outline-none"
            />
            {searchQuery && (
              <button type="button" onClick={() => { setSearchQuery(""); setSearchResults([]); }}>
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </section>

        {/* ── Search results ── */}
        {searchQuery.trim() && (
          <section>
            <h2 className="text-base font-bold text-foreground mb-3">Results</h2>
            {searchResults.length === 0 && !searching && (
              <p className="text-sm text-muted-foreground">No songs found. Try a different search.</p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {searchResults.map((track) => (
                <TrackCard key={track.id} track={track}
                  isPlaying={isCurrentTrack(track)} onPlay={playTrack} />
              ))}
            </div>
          </section>
        )}

        {/* ── Main content (hidden while searching) ── */}
        {!searchQuery.trim() && (
          <>
            {/* ── Recommended for you ── */}
            <section>
              <h2 className="text-lg font-bold text-foreground mb-3">Recommended for you</h2>
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-20 rounded-2xl bg-muted/50 animate-pulse-gentle" />
                  ))}
                </div>
              ) : recs.forYou.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Songs will appear here as your preferences are learned.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {recs.forYou.slice(0, 6).map((track) => (
                    <TrackCard key={track.id} track={track}
                      isPlaying={isCurrentTrack(track)} onPlay={playTrack} />
                  ))}
                </div>
              )}
            </section>

            {/* ── Playlists you might like ── */}
            <section>
              <h2 className="text-lg font-bold text-foreground mb-3">Playlists you might like</h2>
              <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
                {PLAYLISTS.map((pl) => {
                  const tracks = pl.key === "calm"
                    ? recs.calm
                    : pl.key === "energetic"
                      ? recs.energetic
                      : recs.forYou;
                  return (
                    <PlaylistCard key={pl.key} playlist={pl} tracks={tracks} onPlay={playTrack} />
                  );
                })}
              </div>
            </section>

            {/* ── Calm & Relaxing ── */}
            {recs.calm.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">🌙</span>
                  <h2 className="text-lg font-bold text-foreground">Calm & Relaxing</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {recs.calm.slice(0, 4).map((track) => (
                    <TrackCard key={track.id} track={track}
                      isPlaying={isCurrentTrack(track)} onPlay={playTrack} />
                  ))}
                </div>
              </section>
            )}

            {/* ── Uplifting ── */}
            {recs.energetic.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">🌟</span>
                  <h2 className="text-lg font-bold text-foreground">Uplifting Songs</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {recs.energetic.slice(0, 4).map((track) => (
                    <TrackCard key={track.id} track={track}
                      isPlaying={isCurrentTrack(track)} onPlay={playTrack} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {/* ── Sticky bottom player ── */}
      {currentTrack && (
        <div className="fixed bottom-0 left-0 right-0 z-40"
          style={{
            background: "hsl(var(--card) / 0.97)",
            backdropFilter: "blur(20px)",
            borderTop: "1px solid hsl(var(--border))",
            boxShadow: "0 -4px 24px -4px hsl(var(--primary) / 0.2)",
          }}
        >
          {/* Seek bar */}
          <div className="h-1 bg-muted cursor-pointer" onClick={handleSeek}>
            <div className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${progress}%` }} />
          </div>

          <div className="max-w-2xl mx-auto px-4 py-3">
            {/* Track info row */}
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-xl overflow-hidden bg-muted shrink-0">
                {currentTrack.imageUrl
                  ? <img src={currentTrack.imageUrl} alt={currentTrack.name}
                      className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center bg-primary/10">
                      <Music2 className="w-5 h-5 text-primary/50" />
                    </div>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground truncate text-sm">{currentTrack.name}</p>
                <p className="text-xs text-muted-foreground truncate">{currentTrack.artist}</p>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {fmtTime(currentTime)} / {fmtTime(duration)}
              </span>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => sendThumb(false)}
                className="w-9 h-9 rounded-full border border-border flex items-center justify-center
                           text-muted-foreground hover:text-red-400 hover:border-red-200 transition-colors">
                <ThumbsDown className="w-4 h-4" />
              </button>

              <button type="button" onClick={skipBack}
                className="w-10 h-10 rounded-full border border-border flex items-center justify-center
                           text-muted-foreground hover:text-foreground transition-colors">
                <SkipBack className="w-5 h-5" />
              </button>

              <button type="button" onClick={togglePlay}
                className="w-14 h-14 rounded-full bg-primary text-white flex items-center
                           justify-center shadow-calm hover:bg-primary/90 active:scale-95 transition-all">
                {isPlaying
                  ? <Pause className="w-6 h-6" />
                  : <Play  className="w-6 h-6 ml-0.5" />
                }
              </button>

              <button type="button" onClick={skipForward}
                className="w-10 h-10 rounded-full border border-border flex items-center justify-center
                           text-muted-foreground hover:text-foreground transition-colors">
                <SkipForward className="w-5 h-5" />
              </button>

              <button type="button" onClick={() => sendThumb(true)}
                className="w-9 h-9 rounded-full border border-border flex items-center justify-center
                           text-muted-foreground hover:text-emerald-500 hover:border-emerald-200 transition-colors">
                <ThumbsUp className="w-4 h-4" />
              </button>
            </div>

            {/* Repeat toggle */}
            <div className="flex justify-center mt-2">
              <button type="button" onClick={() => setRepeatMode((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs
                            border transition-colors ${
                  repeatMode
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-border text-muted-foreground"
                }`}>
                <Repeat className="w-3 h-3" /> Repeat
              </button>
            </div>
          </div>
        </div>
      )}
    </PatientLayout>
  );
};

export default PatientMusic;
