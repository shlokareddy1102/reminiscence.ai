import { useState } from "react";

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

const shuffle = (items) => [...items].sort(() => Math.random() - 0.5);
const buildSequence = (length) => shuffle(DIGITS).slice(0, length);

const SequenceGame = () => {
  const [length, setLength] = useState(3);
  const [sequence, setSequence] = useState(buildSequence(3));
  const [phase, setPhase] = useState("show");
  const [input, setInput] = useState("");
  const [result, setResult] = useState(null);
  const [streak, setStreak] = useState(0);

  const startRecall = () => {
    setPhase("recall");
    setInput("");
    setResult(null);
  };

  const submit = () => {
    const expected = sequence.join(" ");
    const normalized = input
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .join(" ");
    const ok = normalized === expected;
    setResult(ok);

    if (ok) {
      setStreak((prev) => prev + 1);
      const nextLength = Math.min(length + 1, 7);
      setLength(nextLength);
      setSequence(buildSequence(nextLength));
      setPhase("show");
      setInput("");
      return;
    }

    setStreak(0);
  };

  const tryAgain = () => {
    setSequence(buildSequence(length));
    setPhase("show");
    setInput("");
    setResult(null);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-display font-semibold text-foreground">Sequence Game</h2>
        <p className="text-xs text-muted-foreground">Streak: {streak}</p>
      </div>

      {phase === "show" ? (
        <>
          <p className="text-sm text-muted-foreground">Remember this sequence in order.</p>
          <div className="rounded-xl border border-border bg-muted/40 px-4 py-5 text-center text-2xl font-display tracking-wider text-foreground">
            {sequence.join("  ")}
          </div>
          <button type="button" onClick={startRecall} className="min-h-11 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">
            Hide and answer
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">Type numbers in order, separated by spaces.</p>
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Example: 4 1 8"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <div className="flex items-center gap-2">
            <button type="button" onClick={submit} className="min-h-11 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">
              Check
            </button>
            <button type="button" onClick={tryAgain} className="min-h-11 px-4 rounded-xl border border-border text-sm font-semibold">
              New sequence
            </button>
          </div>

          {result === true ? (
            <p className="text-sm text-safe">Correct. Nice focus. Next round is slightly harder.</p>
          ) : null}
          {result === false ? (
            <p className="text-sm text-warning">Not quite. Try a fresh sequence and keep it calm.</p>
          ) : null}
        </>
      )}
    </div>
  );
};

export default SequenceGame;
