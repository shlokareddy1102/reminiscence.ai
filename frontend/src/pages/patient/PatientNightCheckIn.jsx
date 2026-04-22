import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, Mic, Sparkles } from "lucide-react";
import PatientLayout from "@/components/patient/PatientLayout";

const prompts = [
  {
    id: "mood",
    question: "How was your day today?",
    type: "choice",
    options: ["Wonderful", "Good", "Okay", "A bit hard"],
  },
  {
    id: "people",
    question: "Who did you see or spend time with today?",
    type: "voice",
    placeholder: "Tap the microphone and share your thoughts...",
  },
  {
    id: "activity",
    question: "What was one thing you enjoyed doing today?",
    type: "voice",
    placeholder: "You can say things like: I listened to music, I went for a walk...",
  },
  {
    id: "medication",
    question: "Did you take your medicines today?",
    type: "choice",
    options: ["Yes, all of them", "I took some", "Not yet", "I need help"],
  },
  {
    id: "feelingNow",
    question: "On a scale of 1 to 5, how are you feeling now?",
    type: "choice",
    options: ["1", "2", "3", "4", "5"],
  },
];

const PatientNightCheckIn = () => {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [draftVoice, setDraftVoice] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [finished, setFinished] = useState(false);
  const recognitionRef = useRef(null);

  const card = prompts[index];

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || "")
        .join(" ")
        .trim();
      setDraftVoice(transcript);
      if (transcript) {
        setAnswers((prev) => ({ ...prev, [card.id]: transcript }));
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    setSpeechSupported(true);

    return () => {
      recognition.stop();
    };
  }, [card.id]);

  useEffect(() => {
    const currentAnswer = answers[card.id];
    setDraftVoice(typeof currentAnswer === "string" ? currentAnswer : "");
  }, [card.id, answers]);

  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);

  const chooseOption = (option) => {
    setAnswers((prev) => ({ ...prev, [card.id]: option }));
  };

  const handleVoiceInput = (event) => {
    const value = event.target.value;
    setDraftVoice(value);
    setAnswers((prev) => ({ ...prev, [card.id]: value }));
  };

  const toggleListening = () => {
    const recognition = recognitionRef.current;
    if (!recognition || !speechSupported) return;

    if (isListening) {
      recognition.stop();
      setIsListening(false);
      return;
    }

    setDraftVoice((prev) => prev || "");
    setIsListening(true);
    recognition.start();
  };

  const canContinue = card.type === "voice"
    ? Boolean((answers[card.id] || "").trim())
    : Boolean(answers[card.id]);

  const nextCard = () => {
    if (!canContinue) return;
    if (index < prompts.length - 1) {
      setIndex((v) => v + 1);
      return;
    }
    setFinished(true);
  };

  const restart = () => {
    setIndex(0);
    setAnswers({});
    setDraftVoice("");
    setIsListening(false);
    setFinished(false);
  };

  return (
    <PatientLayout>
      <div className="max-w-3xl mx-auto w-full pb-10 space-y-5">
        {!finished ? (
          <>
            <div className="flex items-center justify-center gap-3 pt-2">
              {prompts.map((prompt, i) => (
                <span
                  key={prompt.id}
                  className={`rounded-full transition-all ${
                    i === index ? "h-3 w-10 bg-primary" : "h-3 w-3 bg-primary/35"
                  }`}
                />
              ))}
            </div>

            <section className="max-w-2xl mx-auto rounded-3xl border border-border bg-card px-4 py-5 sm:px-6 sm:py-6 shadow-calm">
              <div className="mb-5">
                <p className="text-base sm:text-lg text-primary font-semibold">
                  Question {index + 1} of {prompts.length}
                </p>
                <h2 className="mt-3 text-2xl sm:text-3xl leading-tight font-display font-semibold text-foreground">
                  {card.question}
                </h2>
              </div>

              {card.type === "choice" ? (
                <div className="flex flex-wrap justify-center gap-3">
                  {card.options.map((option) => {
                    const selected = answers[card.id] === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => chooseOption(option)}
                        className={`w-[10.75rem] sm:w-[12rem] min-h-14 rounded-2xl border px-3 py-3 text-center text-base sm:text-lg font-medium transition-all ${
                          selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-foreground hover:border-primary/40"
                        }`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={toggleListening}
                    disabled={!speechSupported}
                    className={`w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground px-4 py-3.5 text-lg sm:text-xl font-semibold transition-opacity ${
                      !speechSupported ? "opacity-50 cursor-not-allowed" : "hover:opacity-95"
                    }`}
                  >
                    <Mic className="w-5 h-5" />
                    {isListening ? "Listening..." : "Tap to speak"}
                  </button>

                  <textarea
                    value={draftVoice}
                    onChange={handleVoiceInput}
                    placeholder={card.placeholder}
                    className="w-full min-h-24 rounded-2xl border border-border bg-secondary px-4 py-3 text-base italic text-foreground/80 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />

                  {!speechSupported && (
                    <p className="text-sm text-muted-foreground">
                      Speech is not available in this browser. You can type your answer above.
                    </p>
                  )}
                </div>
              )}

              <div className="mt-5 flex justify-center">
                <button
                  type="button"
                  onClick={nextCard}
                  disabled={!canContinue}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border px-6 py-3 text-lg font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {index === prompts.length - 1 ? "Finish" : "Continue"}
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </section>
          </>
        ) : (
          <section className="max-w-3xl mx-auto rounded-3xl border border-primary/20 bg-primary/10 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-primary/20 text-primary flex items-center justify-center shrink-0">
                <Check className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-2xl font-display font-bold text-foreground">Check-in complete</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  You completed {answeredCount} reflection cards tonight. Great job.
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-border bg-card p-4">
              <p className="text-base font-medium text-foreground inline-flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Your selected responses
              </p>
              <ul className="mt-3 space-y-2 text-base text-muted-foreground">
                {prompts.map((prompt) => (
                  <li key={prompt.id}>
                    <span className="font-semibold text-foreground">{prompt.question}</span>
                    <span> - {answers[prompt.id] || "Skipped"}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={restart}
                className="rounded-xl border border-border px-4 py-2.5 text-base font-medium text-foreground"
              >
                Start again
              </button>
              <button
                type="button"
                onClick={() => navigate("/patient")}
                className="rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-base font-semibold"
              >
                Back to dashboard
              </button>
            </div>
          </section>
        )}
      </div>
    </PatientLayout>
  );
};

export default PatientNightCheckIn;
