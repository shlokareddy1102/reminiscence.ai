import { useState, useEffect } from "react";

const COLORS = ["RED", "BLUE", "GREEN", "YELLOW"];

const COLOR_MAP = {
  RED: "#ef4444",
  BLUE: "#3b82f6",
  GREEN: "#10b981",
  YELLOW: "#f59e0b",
};

export default function ReactionGame({ stage = "early", onComplete }) {
  const [target, setTarget] = useState("");
  const [options, setOptions] = useState([]);
  const [startTime, setStartTime] = useState(null);
  const [results, setResults] = useState([]);
  const [round, setRound] = useState(0);
  const [feedback, setFeedback] = useState("");

  const maxRounds = 5;

  // 🎯 Stage config
  const config = {
    early: { optionCount: 4 },
    middle: { optionCount: 2 },
  };

  // 🎮 Start round
  const startRound = () => {
    const count = config[stage].optionCount;
    const shuffled = [...COLORS].sort(() => 0.5 - Math.random()).slice(0, count);

    const newTarget = shuffled[Math.floor(Math.random() * shuffled.length)];

    setOptions(shuffled);
    setTarget(newTarget);
    setStartTime(Date.now());
    setFeedback("");
  };

  useEffect(() => {
    startRound();
  }, []);

  // 🎯 Handle click
  const handleClick = (color) => {
    const reactionTime = Date.now() - startTime;
    const correct = color === target;

    setResults((prev) => [
      ...prev,
      { correct, reactionTime },
    ]);

    // 🧠 Dementia-safe feedback
    if (correct) {
      setFeedback("Nice! You got it 🌟");
    } else {
      setFeedback(`That’s okay 💛 It was ${target}`);
    }

    setTimeout(() => {
      if (round + 1 < maxRounds) {
        setRound((r) => r + 1);
        startRound();
      } else {
        finishGame();
      }
    }, 1200);
  };

  // 📊 Finish
  const finishGame = () => {
    const accuracy =
      results.filter((r) => r.correct).length / results.length;

    const avgTime =
      results.reduce((sum, r) => sum + r.reactionTime, 0) / results.length;

    const finalResult = {
      game: "reaction",
      accuracy,
      avgReactionTime: avgTime,
      attempts: results.length,
    };

    if (onComplete) onComplete(finalResult);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-6">

      {/* 🎯 Instruction */}
      <h2 className="text-xl mb-4 font-semibold">
        Tap <span className="font-bold">{target}</span>
      </h2>

      {/* 🎮 Buttons */}
      <div className="grid grid-cols-2 gap-4">
        {options.map((c) => (
          <button
            key={c}
            onClick={() => handleClick(c)}
            className="w-24 h-24 rounded-xl shadow-md transition-transform active:scale-90"
            style={{ backgroundColor: COLOR_MAP[c] }}
          />
        ))}
      </div>

      {/* 💬 Feedback */}
      {feedback && (
        <p className="mt-6 text-lg">
          {feedback}
        </p>
      )}

      {/* 🔢 Progress */}
      <p className="mt-4 text-sm text-gray-500">
        Round {round + 1} / {maxRounds}
      </p>
    </div>
  );
}