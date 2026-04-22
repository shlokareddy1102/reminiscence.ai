import { useMemo, useState } from "react";

const OBJECT_BANK = [
  "Keys",
  "Apple",
  "Book",
  "Clock",
  "Cup",
  "Scarf",
  "Chair",
  "Flower",
  "Phone",
  "Spoon"
];

const shuffle = (items) => [...items].sort(() => Math.random() - 0.5);

const buildRound = () => {
  const shown = shuffle(OBJECT_BANK).slice(0, 4);
  const options = shuffle([...shown, ...shuffle(OBJECT_BANK.filter((o) => !shown.includes(o))).slice(0, 2)]);
  return { shown, options };
};

const MemoryObjectsGame = () => {
  const [round, setRound] = useState(buildRound);
  const [phase, setPhase] = useState("preview");
  const [selected, setSelected] = useState([]);
  const [score, setScore] = useState({ correct: 0, rounds: 0 });

  const result = useMemo(() => {
    if (phase !== "result") return null;
    const correctCount = selected.filter((item) => round.shown.includes(item)).length;
    return {
      correctCount,
      perfect: correctCount === round.shown.length
    };
  }, [phase, round, selected]);

  const startRecall = () => setPhase("question");

  const toggleChoice = (item) => {
    setSelected((prev) => {
      if (prev.includes(item)) return prev.filter((i) => i !== item);
      return [...prev, item];
    });
  };

  const submitRound = () => {
    const correctCount = selected.filter((item) => round.shown.includes(item)).length;
    setScore((prev) => ({
      correct: prev.correct + correctCount,
      rounds: prev.rounds + 1
    }));
    setPhase("result");
  };

  const nextRound = () => {
    setRound(buildRound());
    setSelected([]);
    setPhase("preview");
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-display font-semibold text-foreground">Memory Objects</h2>
        <p className="text-xs text-muted-foreground">Points: {score.correct}</p>
      </div>

      {phase === "preview" ? (
        <>
          <p className="text-sm text-muted-foreground">Memorize these 4 objects.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {round.shown.map((item) => (
              <div key={item} className="rounded-xl border border-border bg-muted/40 px-3 py-4 text-center text-sm font-medium">
                {item}
              </div>
            ))}
          </div>
          <button type="button" onClick={startRecall} className="min-h-11 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">
            I am ready
          </button>
        </>
      ) : null}

      {phase === "question" ? (
        <>
          <p className="text-sm text-muted-foreground">Select the objects you just saw.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {round.options.map((item) => {
              const isActive = selected.includes(item);
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleChoice(item)}
                  className={`min-h-11 rounded-xl border px-3 py-2 text-sm ${isActive ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted/50"}`}
                >
                  {item}
                </button>
              );
            })}
          </div>
          <button type="button" onClick={submitRound} className="min-h-11 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">
            Check answers
          </button>
        </>
      ) : null}

      {phase === "result" && result ? (
        <>
          <div className="rounded-xl border border-border bg-muted/50 p-3 text-sm space-y-1">
            <p className="font-medium text-foreground">You remembered {result.correctCount} out of {round.shown.length}.</p>
            <p className="text-muted-foreground">
              {result.perfect ? "Excellent recall. Great focus!" : `The correct set was: ${round.shown.join(", ")}.`}
            </p>
          </div>
          <button type="button" onClick={nextRound} className="min-h-11 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">
            Next round
          </button>
        </>
      ) : null}
    </div>
  );
};

export default MemoryObjectsGame;
