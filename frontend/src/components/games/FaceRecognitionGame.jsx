import { useEffect, useMemo, useState } from "react";
import { getKnownPeople } from "@/lib/knownPeople";

const pickRandom = (items) => items[Math.floor(Math.random() * items.length)];
const shuffle = (items) => [...items].sort(() => Math.random() - 0.5);

const choosePhoto = (person) => {
  if (Array.isArray(person?.photos) && person.photos.length) return person.photos[0];
  return person?.photoUrl || "";
};

const FaceRecognitionGame = ({ patientId }) => {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState(null);
  const [options, setOptions] = useState([]);
  const [answered, setAnswered] = useState(false);
  const [lastCorrect, setLastCorrect] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  const canPlay = people.length >= 2;

  const startRound = (sourcePeople = people) => {
    if (!sourcePeople.length) return;
    const selected = pickRandom(sourcePeople);
    const wrongPool = sourcePeople.filter((p) => p.id !== selected.id);
    const distractors = shuffle(wrongPool).slice(0, 2);
    const nextOptions = shuffle([selected, ...distractors]);

    setCurrent(selected);
    setOptions(nextOptions);
    setAnswered(false);
    setLastCorrect(false);
  };

  useEffect(() => {
    if (!patientId) return;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const list = await getKnownPeople(patientId);
        setPeople(list);
        if (list.length >= 2) startRound(list);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load people for the game.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [patientId]);

  const progressLabel = useMemo(() => {
    if (!score.total) return "No answers yet";
    const pct = Math.round((score.correct / score.total) * 100);
    return `${score.correct}/${score.total} correct (${pct}%)`;
  }, [score]);

  const handleAnswer = (choice) => {
    if (!current || answered) return;
    const isCorrect = choice.id === current.id;
    setAnswered(true);
    setLastCorrect(isCorrect);
    setScore((prev) => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1
    }));
  };

  if (!patientId) {
    return <p className="text-sm text-muted-foreground">Loading patient context...</p>;
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading game...</p>;
  }

  if (error) {
    return <p className="text-sm text-alert">{error}</p>;
  }

  if (!canPlay) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
        <p className="font-semibold text-foreground">Face Recognition</p>
        <p className="text-sm text-muted-foreground">
          Add at least 2 known people from caregiver side to start this game.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-display font-semibold text-foreground">Who is this person?</h2>
        <p className="text-xs text-muted-foreground">Score: {progressLabel}</p>
      </div>

      {current ? (
        <div className="space-y-3">
          <img
            src={choosePhoto(current)}
            alt="Recognize familiar person"
            className="w-44 h-44 rounded-xl object-cover border border-border"
          />

          <div className="grid sm:grid-cols-2 gap-2">
            {options.map((option) => (
              <button
                key={option.id}
                type="button"
                disabled={answered}
                onClick={() => handleAnswer(option)}
                className="min-h-11 rounded-xl border border-border px-3 py-2 text-sm font-medium hover:bg-muted/50 disabled:opacity-80"
              >
                {option.name}
              </button>
            ))}
          </div>

          {answered ? (
            <div className="rounded-xl border border-border bg-muted/50 p-3 text-sm">
              {lastCorrect ? (
                <p className="text-safe font-medium">Great job! You remembered well.</p>
              ) : (
                <p className="text-foreground">
                  This is your {current.relation || "family member"}, {current.name}. You are safe and supported.
                </p>
              )}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => startRound()}
            className="min-h-11 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
          >
            {answered ? "Next Person" : "Skip"}
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default FaceRecognitionGame;
