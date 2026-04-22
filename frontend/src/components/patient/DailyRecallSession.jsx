import { useEffect, useMemo, useState } from "react";
import { Brain, RefreshCw, Send, Sparkles } from "lucide-react";
import { apiRequest } from "@/lib/api";

const categoryLabel = {
  day_recall: "Day Recall",
  people_recognition: "People Recognition",
  orientation: "Orientation",
  emotional_reflection: "Emotional Reflection",
  follow_up: "Follow-up"
};

const DailyRecallSession = ({ patientId, onAnnouncement }) => {
  const [session, setSession] = useState(null);
  const [trend, setTrend] = useState([]);
  const [messages, setMessages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [draft, setDraft] = useState("");
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const progress = useMemo(() => {
    if (!session?.questions?.length) return 0;
    return Math.round((currentIndex / session.questions.length) * 100);
  }, [session, currentIndex]);

  const currentQuestion = session?.questions?.[currentIndex] || null;

  const pushAssistantMessage = (text, extras = {}) => {
    setMessages((prev) => [...prev, { role: "assistant", text, ...extras }]);
  };

  const pushPatientMessage = (text) => {
    setMessages((prev) => [...prev, { role: "patient", text }]);
  };

  const askQuestion = (question, index) => {
    if (!question) return;
    const prompt = `${index + 1}. ${question.prompt}`;
    pushAssistantMessage(prompt, {
      category: categoryLabel[question.category] || "Question",
      image: question.image || "",
      options: Array.isArray(question.options) ? question.options : []
    });
    onAnnouncement?.(question.prompt);
  };

  const loadSession = async () => {
    if (!patientId) return;
    setLoading(true);
    setError("");

    try {
      const [sessionRes, trendRes] = await Promise.all([
        apiRequest(`/api/cognitive/${patientId}/session`),
        apiRequest(`/api/cognitive/${patientId}/trend?days=14`)
      ]);

      setSession(sessionRes?.session || null);
      setTrend(Array.isArray(trendRes?.trend) ? trendRes.trend : []);
      setMessages([]);
      setCurrentIndex(0);
      setDraft("");
      setAnswers({});
      setResult(null);

      if (sessionRes?.session?.questions?.length) {
        pushAssistantMessage("Hi, I am here with you. We will do a short, gentle memory check-in together.");
        askQuestion(sessionRes.session.questions[0], 0);
      }
    } catch (err) {
      setError(err.message || "Unable to load recall session.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSession();
  }, [patientId]);

  const setAnswer = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const submitSession = async (finalAnswers) => {
    if (!session?._id) return;
    setSubmitting(true);
    setError("");

    try {
      const payload = {
        sessionId: session._id,
        answers: (session.questions || []).map((q) => ({
          questionId: q.questionId,
          response: finalAnswers[q.questionId] || ""
        }))
      };

      const response = await apiRequest(`/api/cognitive/${patientId}/submit`, {
        method: "POST",
        body: JSON.stringify(payload)
      });

      setResult(response);
      setSession(response?.session || session);
      onAnnouncement?.(`Check-in complete. Cognitive score today is ${response?.summary?.cognitiveScore || 0}.`);

      const trendRes = await apiRequest(`/api/cognitive/${patientId}/trend?days=14`);
      setTrend(Array.isArray(trendRes?.trend) ? trendRes.trend : []);

      const summaryText = `Thank you. Today\'s cognitive score is ${response?.summary?.cognitiveScore || 0}. Trend is ${response?.summary?.recallTrend || "stable"}.`;
      pushAssistantMessage(summaryText);
    } catch (err) {
      setError(err.message || "Unable to submit session.");
    } finally {
      setSubmitting(false);
    }
  };

  const goNext = async (responseText) => {
    if (!currentQuestion) return;
    const trimmed = String(responseText || "").trim();
    if (!trimmed) return;

    pushPatientMessage(trimmed);

    const nextAnswers = {
      ...answers,
      [currentQuestion.questionId]: trimmed
    };
    setAnswer(currentQuestion.questionId, trimmed);
    setDraft("");

    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);

    if (nextIndex >= (session?.questions?.length || 0)) {
      pushAssistantMessage("Thank you for sharing. I am saving your check-in now.");
      await submitSession(nextAnswers);
      return;
    }

    pushAssistantMessage("Thank you. Let us continue gently.");
    askQuestion(session.questions[nextIndex], nextIndex);
  };

  const latestTrend = trend.length ? trend[trend.length - 1] : null;

  return (
    <section className="glass rounded-3xl p-4 sm:p-5 hover-lift space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-display font-semibold flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            Nightly Cognitive Check-in
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            A short daily recall session to reinforce memory, comfort, and early decline detection.
          </p>
        </div>
        <button
          type="button"
          onClick={loadSession}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-medium hover:bg-muted/60"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {error ? <p className="text-sm text-alert">{error}</p> : null}
      {loading ? <p className="text-sm text-muted-foreground">Loading recall session...</p> : null}

      {session?.questions?.length ? (
        <>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">Progress: {progress}%</p>

          <div className="rounded-xl border border-border bg-card/70 p-3 space-y-3 max-h-[420px] overflow-y-auto">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`flex ${message.role === "patient" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${message.role === "patient" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                  {message.category ? <p className="text-[10px] uppercase tracking-wide opacity-75 mb-1">{message.category}</p> : null}
                  <p className="text-sm leading-relaxed">{message.text}</p>
                  {message.image ? (
                    <img
                      src={message.image}
                      alt="Known person"
                      className="w-24 h-24 rounded-lg object-cover border border-border mt-2"
                    />
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          {currentQuestion ? (
            <>
              {Array.isArray(currentQuestion.options) && currentQuestion.options.length ? (
                <div className="flex flex-wrap gap-2">
                  {currentQuestion.options.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => goNext(option)}
                      className="px-3 py-1.5 text-xs rounded-full border border-border hover:bg-muted/50"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="flex items-end gap-2">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  rows={2}
                  placeholder="Type your answer..."
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  disabled={submitting || !String(draft).trim()}
                  onClick={() => goNext(draft)}
                  className="inline-flex items-center gap-1.5 min-h-10 px-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60"
                >
                  <Send className="w-4 h-4" />
                  Send
                </button>
              </div>

              <button
                type="button"
                disabled={submitting}
                onClick={() => goNext("I don't remember")}
                className="text-xs text-primary hover:underline"
              >
                I don't remember
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="w-3.5 h-3.5" />
              Session completed.
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            Keep it calm and short: 3 to 6 questions each session.
          </div>
        </>
      ) : null}

      {result?.summary ? (
        <div className="rounded-xl border border-primary/25 bg-primary/10 p-3 space-y-1.5">
          <p className="text-sm font-semibold text-foreground">Cognitive Score Today: {result.summary.cognitiveScore}</p>
          <p className="text-xs text-muted-foreground">Recall trend: {result.summary.recallTrend}</p>
          <p className="text-xs text-muted-foreground">Orientation: {result.summary.orientationScore} · People recognition: {result.summary.peopleRecognitionScore}</p>

          {Array.isArray(result?.reinforcement) && result.reinforcement.length ? (
            <div className="pt-1 space-y-1">
              {result.reinforcement.map((item) => (
                <p key={item.questionId} className="text-xs text-foreground">{item.message}</p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {latestTrend ? (
        <p className="text-xs text-muted-foreground">Last recorded score: {latestTrend.cognitiveScore} on {latestTrend.label}.</p>
      ) : null}
    </section>
  );
};

export default DailyRecallSession;
