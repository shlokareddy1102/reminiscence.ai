/**
 * CompanionBot.jsx
 *
 * Warm AI companion for dementia patients — Mira.
 * Features:
 *  - Floating heart button (always visible)
 *  - Evening reminder banner at 8pm
 *  - Full-screen calm chat + FLASHCARD check-in mode
 *  - Night-time palette when evening
 *  - Voice input (Web Speech API) + TTS output
 *  - Groq-powered free chat via /api/companion/chat
 *  - Nightly check-in via /api/cognitive endpoints (flashcard UI)
 *  - Memory/photo playback from /api/known-people
 *  - Emergency detection → notifies caregiver
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Heart, X, Mic, MicOff, Send, Volume2, VolumeX,
  AlertCircle, Moon, Sun, Star, ChevronRight, RotateCcw
} from "lucide-react";
import { apiRequest } from "@/lib/api";

// ── Constants ─────────────────────────────────────────────────────────────────
const COMPANION_NAME = "Mira";

const GREETINGS_DAY = [
  "Hello! I am so happy you are here. How are you feeling today?",
  "Good to see you. I am right here with you. What is on your mind?",
  "Hi there. I am here whenever you need me. How is your day going?",
];

const GREETINGS_EVENING = [
  "Good evening. I am here with you. Ready for our gentle check-in?",
  "It is a lovely evening. Shall we do your memory moment together?",
  "Good evening. I have been looking forward to our little chat tonight.",
];

const EMERGENCY_KEYWORDS = [
  "help", "scared", "afraid", "emergency", "fallen", "fell",
  "hurt", "pain", "lost", "confused", "don't know where",
  "cannot breathe", "chest", "dizzy", "alone", "nobody", "please help"
];

const CATEGORY_CONFIG = {
  day_recall:          { icon: "☀️", label: "Thinking About Today",  color: "#f59e0b", bg: "hsl(39 86% 96%)"  },
  people_recognition:  { icon: "👤", label: "Familiar Faces",        color: "#3b82f6", bg: "hsl(213 94% 96%)" },
  orientation:         { icon: "🌍", label: "Where You Are",         color: "#10b981", bg: "hsl(152 69% 95%)" },
  emotional_reflection:{ icon: "💭", label: "How You Feel",          color: "#a78bfa", bg: "hsl(263 70% 96%)" },
  follow_up:           { icon: "🌱", label: "A Little More",         color: "#16a34a", bg: "hsl(142 71% 95%)" },
};

const AFFIRM_MESSAGES = [
  "That is wonderful. ✨",
  "Thank you for sharing that. 💛",
  "You are doing so well. 🌸",
  "I love hearing that. Keep going. ✨",
  "That is a beautiful answer. 💙",
  "Thank you. You are doing great. 🌟",
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const isEvening = () => {
  const h = new Date().getHours();
  return h >= 19;
};

const detectEmergency = (text) =>
  EMERGENCY_KEYWORDS.some((kw) => String(text || "").toLowerCase().includes(kw));

const randItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

const speak = (text, rate = 0.86, pitch = 1.05) => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.rate  = rate;
  utt.pitch = pitch;
  const voices = window.speechSynthesis.getVoices();
  const warm = voices.find(
    (v) => v.lang.startsWith("en") && /female|woman|samantha|karen|victoria|moira/i.test(v.name)
  );
  if (warm) utt.voice = warm;
  window.speechSynthesis.speak(utt);
};

const stopSpeech = () => {
  if (typeof window !== "undefined" && "speechSynthesis" in window)
    window.speechSynthesis.cancel();
};

// ── Groq proxy call ───────────────────────────────────────────────────────────
const groqChat = async (messages, systemPrompt) => {
  try {
    const res = await apiRequest("/api/companion/chat", {
      method: "POST",
      body: JSON.stringify({ messages, systemPrompt }),
    });
    return res?.reply || "";
  } catch {
    return "";
  }
};

const buildSystemPrompt = (name) => `
You are ${COMPANION_NAME}, a warm and gentle AI companion for ${name}, who has dementia.
Rules:
- Be reassuring, calm, never clinical
- Max 2 short sentences per reply
- Never correct harshly — always validate feelings first
- If confused: "You are safe at home."
- If emergency mention: express care, offer to contact care team
- For memories/family: engage warmly
- End every reply with a gentle question or invitation
- Tone: kind, patient friend who is always calm and present
`.trim();

// ── Evening reminder banner ───────────────────────────────────────────────────
const ReminderBanner = ({ name, onStart, onDismiss }) => (
  <div
    className="fixed bottom-24 right-4 left-4 sm:left-auto sm:w-80 z-50 animate-fade-in"
    style={{ filter: "drop-shadow(0 8px 24px hsl(205 56% 46% / 0.25))" }}
  >
    <div className="rounded-3xl overflow-hidden border border-primary/20"
      style={{ background: "linear-gradient(135deg, hsl(218 44% 98%) 0%, hsl(205 56% 95%) 100%)" }}>
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
            <Moon className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground leading-tight">
              Good evening, {name} ✨
            </p>
            <p className="text-xs text-muted-foreground">Time for your memory moment</p>
          </div>
          <button type="button" onClick={onDismiss}
            className="ml-auto w-6 h-6 rounded-full flex items-center justify-center
                       text-muted-foreground hover:bg-muted/50">
            <X className="w-3 h-3" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
          Mira is ready for your gentle nightly check-in. It only takes a few minutes.
        </p>
        <button type="button" onClick={onStart}
          className="w-full py-2.5 rounded-2xl bg-primary text-primary-foreground
                     text-sm font-semibold hover:bg-primary/90 transition-colors">
          Start with Mira 🌙
        </button>
      </div>
    </div>
  </div>
);

// ── Floating trigger button ───────────────────────────────────────────────────
const FloatingButton = ({ onClick, hasUnread, evening }) => (
  <button type="button" onClick={onClick} aria-label="Open Mira"
    className="fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full shadow-calm
               flex items-center justify-center hover:scale-105 active:scale-95
               transition-all duration-200 breathe"
    style={{
      background: evening
        ? "linear-gradient(135deg, hsl(263 55% 65%) 0%, hsl(205 56% 46%) 100%)"
        : "hsl(var(--primary))",
      boxShadow: "0 8px 32px -8px hsl(205 56% 46% / 0.55)",
    }}
  >
    <Heart className="w-7 h-7 text-white" fill="currentColor" />
    {hasUnread && (
      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-alert
                       border-2 border-background animate-pulse-gentle" />
    )}
  </button>
);

// ── Flashcard component ───────────────────────────────────────────────────────
const FlashCard = ({ question, index, total, onAnswer, onIDontRemember, ttsEnabled, evening }) => {
  const cfg   = CATEGORY_CONFIG[question.category] || CATEGORY_CONFIG.day_recall;
  const [affirm, setAffirm] = useState("");

  useEffect(() => {
    if (ttsEnabled) speak(question.prompt);
    setAffirm("");
  }, [question.questionId]);

  const handleOption = (opt) => {
    setAffirm(randItem(AFFIRM_MESSAGES));
    setTimeout(() => onAnswer(opt), 900);
  };

  return (
    <div className="flex-1 flex flex-col px-4 pb-4 animate-fade-in">
      {/* Progress dots */}
      <div className="flex justify-center gap-2 py-4">
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className={`h-2 rounded-full transition-all duration-300 ${
            i < index ? "w-2 bg-primary" :
            i === index ? "w-6 bg-primary" :
            "w-2 bg-muted"
          }`} />
        ))}
      </div>

      {/* Card */}
      <div className="flex-1 flex flex-col rounded-3xl overflow-hidden border border-border/50"
        style={{
          background: evening
            ? "linear-gradient(160deg, hsl(260 25% 14%) 0%, hsl(260 20% 18%) 100%)"
            : `linear-gradient(160deg, ${cfg.bg} 0%, hsl(0 0% 100%) 60%)`,
          boxShadow: "0 16px 48px -16px hsl(205 56% 46% / 0.2)",
        }}
      >
        {/* Category badge */}
        <div className="px-5 pt-5 pb-2 flex items-center gap-2">
          <span className="text-xl">{cfg.icon}</span>
          <span className="text-xs uppercase tracking-widest font-semibold"
            style={{ color: evening ? "hsl(260 15% 65%)" : cfg.color }}>
            {cfg.label}
          </span>
          <span className="ml-auto text-xs" style={{ color: evening ? "hsl(260 15% 50%)" : "hsl(215 16% 60%)" }}>
            {index + 1} of {total}
          </span>
        </div>

        {/* Photo for people recognition */}
        {question.image && (
          <div className="mx-5 mb-3 rounded-2xl overflow-hidden"
            style={{ height: "180px" }}>
            <img src={question.image} alt="Familiar person"
              className="w-full h-full object-cover" />
          </div>
        )}

        {/* Question text */}
        <div className="flex-1 flex items-center px-5 pb-4">
          <p className={`font-semibold leading-snug ${evening ? "text-white" : "text-foreground"}`}
            style={{ fontSize: "1.35rem" }}>
            {question.prompt}
          </p>
        </div>

        {/* Affirm overlay */}
        {affirm && (
          <div className="absolute inset-0 flex items-center justify-center rounded-3xl"
            style={{ background: "hsl(0 0% 0% / 0.35)" }}>
            <p className="text-2xl font-bold text-white text-center px-6">{affirm}</p>
          </div>
        )}
      </div>

      {/* Option buttons */}
      {Array.isArray(question.options) && question.options.length > 0 ? (
        <div className="mt-4 space-y-2">
          {question.options.map((opt) => (
            <button key={opt} type="button" onClick={() => handleOption(opt)}
              className="w-full py-4 rounded-2xl border text-base font-medium
                         transition-all active:scale-98 hover:border-primary/50"
              style={{
                background: evening ? "hsl(260 20% 20%)" : "hsl(0 0% 100%)",
                borderColor: evening ? "hsl(260 20% 28%)" : "hsl(206 25% 88%)",
                color: evening ? "hsl(260 15% 90%)" : "hsl(220 28% 20%)",
                fontSize: "1.1rem",
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      ) : (
        // Free-text answer input
        <FreeTextAnswer
          onSubmit={handleOption}
          evening={evening}
          ttsEnabled={ttsEnabled}
        />
      )}

      {/* I don't remember */}
      <button type="button" onClick={onIDontRemember}
        className="mt-3 text-center text-sm underline-offset-2 hover:underline"
        style={{ color: evening ? "hsl(260 15% 55%)" : "hsl(215 16% 55%)" }}>
        I don't remember
      </button>
    </div>
  );
};

// ── Free text answer inside flashcard ────────────────────────────────────────
const FreeTextAnswer = ({ onSubmit, evening, ttsEnabled }) => {
  const [val, setVal] = useState("");
  const recognRef = useRef(null);
  const [listening, setListening] = useState(false);

  const doVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    if (listening) { recognRef.current?.stop(); setListening(false); return; }
    const r = new SR();
    r.lang = "en-US";
    r.onresult = (e) => {
      const t = e.results[0]?.[0]?.transcript || "";
      if (t.trim()) { setVal(t); setTimeout(() => onSubmit(t), 300); }
      setListening(false);
    };
    r.onerror = r.onend = () => setListening(false);
    recognRef.current = r;
    r.start();
    setListening(true);
  };

  return (
    <div className="mt-4 space-y-2">
      <div className="flex gap-2">
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && val.trim()) onSubmit(val); }}
          placeholder="Type your answer…"
          className="flex-1 rounded-2xl border px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/30"
          style={{
            background: evening ? "hsl(260 20% 20%)" : "white",
            borderColor: evening ? "hsl(260 20% 28%)" : "hsl(206 25% 88%)",
            color: evening ? "hsl(260 15% 90%)" : "hsl(220 28% 20%)",
            fontSize: "1.05rem",
          }}
        />
        <button type="button" onClick={doVoice}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-all ${
            listening ? "bg-alert border-alert text-white animate-pulse-gentle"
                      : "border-border text-muted-foreground hover:bg-muted/50"
          }`}
          style={{ background: listening ? undefined : evening ? "hsl(260 20% 20%)" : undefined }}
        >
          {listening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>
      </div>
      {val.trim() && (
        <button type="button" onClick={() => onSubmit(val)}
          className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground
                     text-base font-semibold hover:bg-primary/90 transition-colors">
          Send ✨
        </button>
      )}
    </div>
  );
};

// ── Chat bubble ───────────────────────────────────────────────────────────────
const Bubble = ({ msg, onSpeak, evening }) => {
  const isBot = msg.role === "assistant";
  return (
    <div className={`flex items-end gap-2 ${isBot ? "justify-start" : "justify-end"}`}>
      {isBot && (
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
          style={{ background: evening ? "hsl(260 20% 22%)" : "hsl(205 56% 46% / 0.12)" }}>
          <Heart className="w-4 h-4 text-primary" />
        </div>
      )}
      <div className={`max-w-[78%] group`}>
        <div className={`rounded-3xl px-4 py-3 leading-relaxed ${
          isBot ? "rounded-tl-sm" : "rounded-br-sm"
        }`}
          style={{
            fontSize: "1.05rem",
            background: isBot
              ? evening ? "hsl(260 20% 20%)" : "hsl(206 30% 94%)"
              : "hsl(var(--primary))",
            color: isBot
              ? evening ? "hsl(260 15% 88%)" : "hsl(220 28% 20%)"
              : "white",
          }}
        >
          {msg.text}
          {msg.image && (
            <img src={msg.image} alt="Memory"
              className="mt-2 w-36 h-36 rounded-2xl object-cover border border-border/50" />
          )}
          {Array.isArray(msg.options) && msg.options.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {msg.options.map((opt) => (
                <button key={opt} type="button" onClick={() => msg.onOption?.(opt)}
                  className="text-sm px-3 py-1.5 rounded-full border transition-colors"
                  style={{
                    borderColor: evening ? "hsl(260 20% 35%)" : "hsl(205 56% 46% / 0.3)",
                    color: "hsl(var(--primary))",
                    background: evening ? "hsl(260 20% 22%)" : "hsl(205 56% 46% / 0.08)",
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>
        {isBot && (
          <button type="button" onClick={() => onSpeak(msg.text)}
            className="mt-1 ml-1 opacity-0 group-hover:opacity-50 transition-opacity">
            <Volume2 className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}
      </div>
    </div>
  );
};

// ── Emergency banner ──────────────────────────────────────────────────────────
const EmergencyBanner = ({ onAlert, onDismiss, evening }) => (
  <div className="mx-4 mb-3 rounded-2xl border border-alert/40 bg-alert/10 p-3 flex items-center gap-3 animate-fade-in">
    <AlertCircle className="w-5 h-5 text-alert shrink-0" />
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-foreground">Are you okay?</p>
      <p className="text-xs text-muted-foreground">Your caregiver can be notified right away.</p>
    </div>
    <div className="flex gap-2">
      <button type="button" onClick={onAlert}
        className="px-3 py-1.5 rounded-xl bg-alert text-white text-xs font-semibold">
        Notify
      </button>
      <button type="button" onClick={onDismiss}
        className="px-3 py-1.5 rounded-xl border border-border text-xs">
        I'm fine
      </button>
    </div>
  </div>
);

// ── Session complete card ─────────────────────────────────────────────────────
const SessionComplete = ({ result, evening }) => {
  const score = result?.summary?.cognitiveScore ?? 0;
  const trend = result?.summary?.recallTrend ?? "stable";
  const msg = score >= 75
    ? "You remembered beautifully tonight. 🌟"
    : score >= 50
      ? "You did wonderfully. Every answer matters. 💛"
      : "Thank you for trying. That took courage. 🌸";

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8 animate-fade-in">
      <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 breathe"
        style={{ background: evening ? "hsl(260 20% 22%)" : "hsl(205 56% 46% / 0.12)" }}>
        <Star className="w-10 h-10 text-primary" fill="currentColor" />
      </div>
      <h2 className={`text-2xl font-bold text-center mb-2 ${evening ? "text-white" : "text-foreground"}`}>
        Check-in Complete
      </h2>
      <p className={`text-center text-base mb-6 ${evening ? "hsl(260 15% 65%)" : ""}`}
        style={{ color: evening ? "hsl(260 15% 65%)" : "hsl(215 16% 45%)" }}>
        {msg}
      </p>
      <div className="w-full rounded-3xl p-5 mb-4"
        style={{
          background: evening
            ? "linear-gradient(135deg, hsl(260 25% 18%) 0%, hsl(260 20% 22%) 100%)"
            : "linear-gradient(135deg, hsl(205 56% 96%) 0%, hsl(160 30% 96%) 100%)",
          border: "1px solid hsl(205 56% 46% / 0.2)",
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <span className={`text-sm ${evening ? "text-slate-400" : "text-muted-foreground"}`}>Memory score</span>
          <span className="text-2xl font-bold text-primary">{score}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className={`text-sm ${evening ? "text-slate-400" : "text-muted-foreground"}`}>Trend</span>
          <span className={`text-sm font-semibold capitalize ${
            trend === "improving" ? "text-emerald-500" :
            trend === "declining" ? "text-red-400" : "text-primary"
          }`}>{trend}</span>
        </div>
      </div>
      <p className={`text-sm text-center ${evening ? "text-slate-400" : "text-muted-foreground"}`}>
        Sleep well. I will be here tomorrow. 🌙
      </p>
    </div>
  );
};

// ── MAIN CompanionBot ─────────────────────────────────────────────────────────
const CompanionBot = ({ patientId, patientName = "there" }) => {
  const [open,           setOpen]           = useState(false);
  const [mode,           setMode]           = useState("chat"); // chat | checkin | complete
  const [messages,       setMessages]       = useState([]);
  const [draft,          setDraft]          = useState("");
  const [listening,      setListening]      = useState(false);
  const [ttsEnabled,     setTtsEnabled]     = useState(true);
  const [loading,        setLoading]        = useState(false);
  const [hasUnread,      setHasUnread]      = useState(false);
  const [showEmergency,  setShowEmergency]  = useState(false);
  const [showReminder,   setShowReminder]   = useState(false);
  const [memories,       setMemories]       = useState([]);
  const [session,        setSession]        = useState(null);
  const [cardIndex,      setCardIndex]      = useState(0);
  const [sessionAnswers, setSessionAnswers] = useState({});
  const [checkinResult,  setCheckinResult]  = useState(null);
  const [evening,        setEvening]        = useState(isEvening());

  const bottomRef  = useRef(null);
  const recognRef  = useRef(null);
  const reminderShownRef = useRef(false);

  // ── Update evening flag every minute ─────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setEvening(isEvening()), 60_000);
    return () => clearInterval(t);
  }, []);

  // ── Evening reminder at 8pm ───────────────────────────────────────────────
  useEffect(() => {
    if (reminderShownRef.current) return;
    const now  = new Date();
    const h    = now.getHours();
    const m    = now.getMinutes();
    if (h === 20 && m < 5 && !open) {
      setTimeout(() => {
        setShowReminder(true);
        setHasUnread(true);
        reminderShownRef.current = true;
      }, 2000);
    }
    // Also show if it's already past 8pm and they haven't opened yet
    if (h >= 20 && !open && !reminderShownRef.current) {
      setTimeout(() => {
        setShowReminder(true);
        setHasUnread(true);
        reminderShownRef.current = true;
      }, 3000);
    }
  }, []);

  // ── Load memories when opening ────────────────────────────────────────────
  useEffect(() => {
    if (!open || !patientId || memories.length) return;
    apiRequest(`/api/known-people?patientId=${patientId}`)
      .then((r) => setMemories(Array.isArray(r) ? r : []))
      .catch(() => {});
  }, [open, patientId]);

  // ── Scroll to bottom ──────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Welcome on first open ─────────────────────────────────────────────────
  useEffect(() => {
    if (!open || messages.length > 0) return;
    const pool = evening ? GREETINGS_EVENING : GREETINGS_DAY;
    const msg  = randItem(pool);
    pushBot(msg);
    if (ttsEnabled) speak(msg);

    if (evening) {
      setTimeout(() => {
        pushBot("It is evening time. Would you like to do your gentle memory check-in with me? 🌙", {
          options: ["Yes, let's do it 🌙", "Maybe later", "Just chat"],
          onOption: handleCheckinOption,
        });
      }, 1000);
    }
  }, [open]);

  // ── TTS cleanup ───────────────────────────────────────────────────────────
  useEffect(() => { if (!ttsEnabled) stopSpeech(); }, [ttsEnabled]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const pushBot = useCallback((text, extras = {}) => {
    setMessages((p) => [...p, { role: "assistant", text, ...extras }]);
    if (!open) setHasUnread(true);
  }, [open]);

  const pushUser = useCallback((text) => {
    setMessages((p) => [...p, { role: "user", text }]);
  }, []);

  // ── Check-in option handler ───────────────────────────────────────────────
  const handleCheckinOption = (opt) => {
    pushUser(opt);
    if (opt.includes("Yes")) {
      startCheckin();
    } else if (opt === "Just chat") {
      pushBot("Of course! I am right here. What would you like to talk about? 💛");
    } else {
      pushBot("No worries at all. I am here whenever you are ready. Just tap me anytime. 🌸");
    }
  };

  // ── Start flashcard check-in ──────────────────────────────────────────────
  const startCheckin = async () => {
     console.log("Starting check-in for:", patientId);
    if (!patientId) {
      pushBot("I could not start the check-in right now. Let us just chat.");
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest(`/api/cognitive/${patientId}/session`);
      console.log("SESSION RESPONSE:", res);
      const s   = res?.session;
      if (!s?.questions?.length) {
        pushBot("I could not load the check-in right now. Let us just chat instead. 💛");
        return;
      }
      setSession(s);
      setCardIndex(0);
      setSessionAnswers({});
      setMode("checkin");
      if (ttsEnabled) speak(s.questions[0].prompt);
    } catch {
      pushBot("Something small went wrong. Let us have a nice chat instead. 💛");
    } finally {
      setLoading(false);
    }
  };

  // ── Handle flashcard answer ───────────────────────────────────────────────
  const handleCardAnswer = async (answer) => {
    const question = session?.questions?.[cardIndex];
    if (!question) return;

    const newAnswers = { ...sessionAnswers, [question.questionId]: answer };
    setSessionAnswers(newAnswers);

    const nextIndex = cardIndex + 1;
    if (nextIndex >= session.questions.length) {
      await submitCheckin(newAnswers);
      return;
    }
    setCardIndex(nextIndex);
    if (ttsEnabled) setTimeout(() => speak(session.questions[nextIndex].prompt), 600);
  };

  const handleIDontRemember = () => {
    handleCardAnswer("I don't remember");
  };

  // ── Submit check-in ───────────────────────────────────────────────────────
  const submitCheckin = async (answers) => {
    if (!session?._id || !patientId) return;
    setLoading(true);
    try {
      const payload = {
        sessionId: session._id,
        answers: (session.questions || []).map((q) => ({
          questionId: q.questionId,
          response:   answers[q.questionId] || "",
        })),
      };
      const res = await apiRequest(`/api/cognitive/${patientId}/submit`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setCheckinResult(res);
      setMode("complete");
      const score = res?.summary?.cognitiveScore ?? 0;
      if (ttsEnabled) speak(`You did wonderfully. Your memory score today is ${score}. Sleep well.`);
    } catch {
      pushBot("Something small went wrong saving your check-in, but that is okay. You did amazing. 🌸");
      setMode("chat");
    } finally {
      setLoading(false);
    }
  };

  // ── Free chat send ────────────────────────────────────────────────────────
  const sendMessage = async (text) => {
    // 🚀 INTENT DETECTION (CRITICAL FIX)
    const lower = trimmed.toLowerCase();

    if (
      lower.includes("quiz") ||
      lower.includes("check-in") ||
      lower.includes("checkin") ||
      lower.includes("cognitive")
    ) {
    pushBot("Got it — let’s start your night check-in. 🌙");
    startCheckin();
    return;
    }
    const trimmed = String(text || "").trim();
    if (!trimmed || loading) return;
    setDraft("");
    pushUser(trimmed);

    if (detectEmergency(trimmed)) {
      setShowEmergency(true);
      const msg = "I hear you. You are safe. Would you like me to let your care team know right now?";
      pushBot(msg);
      if (ttsEnabled) speak(msg);
      return;
    }

    if (/memory|photo|picture|remember|family|familiar/i.test(trimmed) && memories.length) {
      const person = randItem(memories);
      const msg = `Here is someone special: ${person.name}${person.relationship ? `, your ${person.relationship}` : ""}. 💛`;
      pushBot(msg, { image: person.photo || "" });
      if (ttsEnabled) speak(msg);
      return;
    }

    setLoading(true);
    try {
      const history = messages.slice(-8).map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.text,
      }));
      history.push({ role: "user", content: trimmed });
      const reply = await groqChat(history, buildSystemPrompt(patientName));
      const final = reply || "I am right here with you. Tell me more, I am listening. 💛";
      pushBot(final);
      if (ttsEnabled) speak(final);
    } catch {
      const fallback = "I am always here for you. 💛";
      pushBot(fallback);
      if (ttsEnabled) speak(fallback);
    } finally {
      setLoading(false);
    }
  };

  // ── Emergency notify ──────────────────────────────────────────────────────
  const handleEmergencyAlert = async () => {
    setShowEmergency(false);
    try {
      await apiRequest("/api/alerts", {
        method: "POST",
        body: JSON.stringify({
          patientId,
          message: `${patientName} may need assistance — triggered via companion bot.`,
          riskLevel: "HIGH",
        }),
      });
      const msg = "I have let your care team know. They will be with you very soon. You are not alone. 💛";
      pushBot(msg);
      if (ttsEnabled) speak(msg);
    } catch {
      const msg = "I tried to reach your care team. Please also press the 'Contact Care Team' button if you need urgent help.";
      pushBot(msg);
      if (ttsEnabled) speak(msg);
    }
  };

  // ── Voice input (chat mode) ───────────────────────────────────────────────
  const toggleVoice = () => {
    if (listening) { recognRef.current?.stop(); setListening(false); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { pushBot("Voice is not available on this device, but you can type below. 💛"); return; }
    const r = new SR();
    r.lang = "en-US";
    r.onresult = (e) => {
      const t = e.results[0]?.[0]?.transcript || "";
      if (t.trim()) { setDraft(t); sendMessage(t); }
      setListening(false);
    };
    r.onerror = r.onend = () => setListening(false);
    recognRef.current = r;
    r.start();
    setListening(true);
  };

  const bgStyle = evening
    ? { background: "linear-gradient(160deg, hsl(260 25% 10%) 0%, hsl(260 20% 14%) 100%)" }
    : { background: "linear-gradient(160deg, hsl(218 44% 98%) 0%, hsl(205 56% 96%) 60%, hsl(160 30% 97%) 100%)" };

  const headerBg = evening
    ? "hsl(260 25% 12% / 0.95)"
    : "hsl(0 0% 100% / 0.88)";

  return (
    <>
      {/* Evening reminder banner */}
      {showReminder && !open && (
        <ReminderBanner
          name={patientName}
          onStart={() => { setShowReminder(false); setOpen(true); setHasUnread(false); }}
          onDismiss={() => setShowReminder(false)}
        />
      )}

      {/* Floating button */}
      {!open && (
        <FloatingButton
          onClick={() => { setOpen(true); setHasUnread(false); setShowReminder(false); }}
          hasUnread={hasUnread}
          evening={evening}
        />
      )}

      {/* Full-screen modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col" style={bgStyle}>

          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-4 border-b shrink-0"
            style={{
              background: headerBg,
              backdropFilter: "blur(16px)",
              borderColor: evening ? "hsl(260 20% 20%)" : "hsl(206 25% 88%)",
            }}
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center breathe"
              style={{ background: evening ? "hsl(260 20% 22%)" : "hsl(205 56% 46% / 0.12)" }}>
              <Heart className="w-5 h-5 text-primary" fill="currentColor" />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-semibold text-base leading-tight ${evening ? "text-white" : "text-foreground"}`}>
                {COMPANION_NAME}
              </p>
              <p className="text-xs" style={{ color: evening ? "hsl(260 15% 55%)" : "hsl(215 16% 55%)" }}>
                {loading    ? "Thinking…"
                 : mode === "checkin"  ? `Question ${cardIndex + 1} of ${session?.questions?.length ?? "?"}`
                 : mode === "complete" ? "Check-in complete 🌙"
                 : evening             ? "Here with you tonight"
                 :                      "Here with you"}
              </p>
            </div>

            {/* Return to chat from complete */}
            {mode === "complete" && (
              <button type="button" onClick={() => { setMode("chat"); }}
                className="flex items-center gap-1 text-xs text-primary px-3 py-1.5 rounded-full border border-primary/30">
                <RotateCcw className="w-3 h-3" /> Chat
              </button>
            )}

            <button type="button" onClick={() => setTtsEnabled((v) => !v)}
              className="w-9 h-9 rounded-full flex items-center justify-center border transition-colors"
              style={{
                borderColor: evening ? "hsl(260 20% 28%)" : "hsl(206 25% 88%)",
                color: evening ? "hsl(260 15% 65%)" : "hsl(215 16% 55%)",
                background: "transparent",
              }}
            >
              {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button type="button" onClick={() => { setOpen(false); stopSpeech(); }}
              className="w-9 h-9 rounded-full flex items-center justify-center border transition-colors"
              style={{
                borderColor: evening ? "hsl(260 20% 28%)" : "hsl(206 25% 88%)",
                color: evening ? "hsl(260 15% 65%)" : "hsl(215 16% 55%)",
                background: "transparent",
              }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Emergency banner */}
          {showEmergency && (
            <EmergencyBanner
              onAlert={handleEmergencyAlert}
              onDismiss={() => setShowEmergency(false)}
              evening={evening}
            />
          )}

          {/* ── FLASHCARD MODE ── */}
          {mode === "checkin" && session?.questions?.[cardIndex] && (
            <div className="flex-1 flex flex-col overflow-hidden relative">
              <FlashCard
                question={session.questions[cardIndex]}
                index={cardIndex}
                total={session.questions.length}
                onAnswer={handleCardAnswer}
                onIDontRemember={handleIDontRemember}
                ttsEnabled={ttsEnabled}
                evening={evening}
              />
            </div>
          )}

          {/* ── COMPLETE MODE ── */}
          {mode === "complete" && (
            <div className="flex-1 overflow-y-auto">
              <SessionComplete result={checkinResult} evening={evening} />
            </div>
          )}

          {/* ── CHAT MODE ── */}
          {mode === "chat" && (
            <>
            <div className="px-4">
                <button
                      onClick={startCheckin}
                      className="mb-2 px-4 py-2 bg-red-500 text-white rounded-lg"
                   >
                TEST CHECKIN
                </button>
            </div>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {messages.map((msg, i) => (
                  <Bubble key={i} msg={msg}
                    onSpeak={(t) => { if (ttsEnabled) speak(t); }}
                    evening={evening}
                  />
                ))}
                {loading && (
                  <div className="flex items-end gap-2">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: evening ? "hsl(260 20% 22%)" : "hsl(205 56% 46% / 0.12)" }}>
                      <Heart className="w-4 h-4 text-primary" />
                    </div>
                    <div className="rounded-3xl rounded-tl-sm px-4 py-3 flex gap-1"
                      style={{ background: evening ? "hsl(260 20% 20%)" : "hsl(206 30% 94%)" }}>
                      {[0, 1, 2].map((i) => (
                        <span key={i} className="w-2 h-2 rounded-full bg-primary/50 animate-pulse-gentle"
                          style={{ animationDelay: `${i * 200}ms` }} />
                      ))}
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Quick chips — only at start */}
              {messages.length <= 2 && (
                <div className="px-4 pb-2 flex gap-2 overflow-x-auto"
                  style={{ scrollbarWidth: "none" }}>
                  {[
                    { label: "Show me a memory 📷", msg: "Show me a memory" },
                    { label: "I feel confused 😔",  msg: "I feel confused and not sure where I am" },
                    { label: "Start check-in 🧠",   action: startCheckin },
                    { label: "I need help 🆘",       msg: "I need help, I am scared" },
                  ].map((q) => (
                    <button key={q.label} type="button"
                      onClick={() => q.action ? q.action() : sendMessage(q.msg)}
                      className="shrink-0 px-3 py-2 rounded-full text-xs font-medium border
                                 whitespace-nowrap transition-colors hover:opacity-80"
                      style={{
                        borderColor: evening ? "hsl(260 20% 28%)" : "hsl(205 56% 46% / 0.3)",
                        color: "hsl(var(--primary))",
                        background: evening
                          ? "hsl(205 56% 46% / 0.12)"
                          : "hsl(205 56% 46% / 0.06)",
                      }}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Input bar */}
              <div className="px-4 pb-6 pt-2 border-t shrink-0"
                style={{
                  background: evening ? "hsl(260 25% 12% / 0.95)" : "hsl(0 0% 100% / 0.9)",
                  backdropFilter: "blur(8px)",
                  borderColor: evening ? "hsl(260 20% 20%)" : "hsl(206 25% 88%)",
                }}
              >
                <div className="flex items-end gap-2">
                  <button type="button" onClick={toggleVoice}
                    className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 border transition-all ${
                      listening ? "bg-alert border-alert text-white animate-pulse-gentle" : ""
                    }`}
                    style={!listening ? {
                      borderColor: evening ? "hsl(260 20% 28%)" : "hsl(206 25% 88%)",
                      color: evening ? "hsl(260 15% 65%)" : "hsl(215 16% 55%)",
                      background: evening ? "hsl(260 20% 18%)" : "transparent",
                    } : {}}
                  >
                    {listening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>

                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage(draft);
                      }
                    }}
                    rows={1}
                    placeholder={listening ? "Listening…" : "Type or use your voice…"}
                    className="flex-1 rounded-2xl border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/30"
                    style={{
                      fontSize: "1rem",
                      resize: "none",
                      lineHeight: "1.5",
                      background: evening ? "hsl(260 20% 18%)" : "white",
                      borderColor: evening ? "hsl(260 20% 28%)" : "hsl(206 25% 88%)",
                      color: evening ? "hsl(260 15% 88%)" : "hsl(220 28% 20%)",
                    }}
                  />

                  <button type="button"
                    disabled={loading || !draft.trim()}
                    onClick={() => sendMessage(draft)}
                    className="w-11 h-11 rounded-full bg-primary text-primary-foreground
                               flex items-center justify-center shrink-0
                               hover:bg-primary/90 disabled:opacity-40 transition-all"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};

export default CompanionBot;