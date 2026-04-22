import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getTangramTrend, submitTangramSession } from "@/lib/cognitiveGames";

const PIECE_PATHS = {
  largeTriangle: "M 10 110 L 110 110 L 110 10 Z",
  mediumTriangle: "M 16 96 L 96 96 L 96 16 Z",
  smallTriangle: "M 22 82 L 82 82 L 82 22 Z",
  square: "M 28 28 L 88 28 L 88 88 L 28 88 Z",
  parallelogram: "M 24 88 L 84 88 L 100 32 L 40 32 Z",
};

const SILHOUETTES = {
  Cat: (
    <g>
      <path d="M122 92 L164 52 L204 92 L204 140 L170 174 L170 266 L114 266 L114 174 L86 146 L122 112 Z" />
      <path d="M132 58 L148 28 L166 58 Z" />
      <path d="M178 58 L196 28 L212 58 Z" />
      <path d="M170 266 L228 266 L270 226 L224 226 Z" />
    </g>
  ),
  House: (
    <g>
      <path d="M80 142 L170 58 L260 142 Z" />
      <path d="M106 142 L234 142 L234 270 L106 270 Z" />
      <path d="M154 192 L186 192 L186 270 L154 270 Z" />
      <path d="M118 170 L146 170 L146 198 L118 198 Z" />
    </g>
  ),
  Boat: (
    <g>
      <path d="M72 222 L244 222 L206 266 L112 266 Z" />
      <path d="M166 92 L166 222" strokeWidth="18" strokeLinecap="round" />
      <path d="M170 96 L246 164 L170 164 Z" />
      <path d="M166 88 L194 98 L166 108 Z" />
    </g>
  ),
  Bird: (
    <g>
      <path d="M96 182 L168 114 L220 140 L194 186 L140 220 Z" />
      <path d="M138 142 L92 74 L178 108 Z" />
      <path d="M218 134 L248 118 L234 152 Z" />
      <path d="M172 108 L196 72 L218 92 L192 124 Z" />
      <circle cx="214" cy="92" r="10" />
    </g>
  ),
  Rocket: (
    <g>
      <path d="M170 38 L214 88 L214 222 L170 264 L126 222 L126 88 Z" />
      <path d="M170 22 L194 56 L146 56 Z" />
      <path d="M126 198 L88 232 L126 246 Z" />
      <path d="M214 198 L252 232 L214 246 Z" />
      <circle cx="170" cy="132" r="20" />
      <path d="M150 264 L170 304 L190 264 Z" />
    </g>
  ),
};

const INTRO_PIECES = [
  { key: "a", shape: "largeTriangle", color: "#f2ac1f", x: 34, y: 16, rotate: 0, scale: 1.16 },
  { key: "b", shape: "largeTriangle", color: "#1f7a3d", x: 38, y: 136, rotate: 180, scale: 1.16 },
  { key: "c", shape: "parallelogram", color: "#6e87bd", x: 146, y: 44, rotate: 45, scale: 1.06 },
  { key: "d", shape: "mediumTriangle", color: "#e98d8d", x: 176, y: 120, rotate: 315, scale: 1.06 },
  { key: "e", shape: "square", color: "#ef4444", x: 294, y: 98, rotate: 45, scale: 0.92 },
  { key: "f", shape: "smallTriangle", color: "#4b2c77", x: 196, y: 4, rotate: 90, scale: 0.9 },
  { key: "g", shape: "smallTriangle", color: "#3557a5", x: 196, y: 198, rotate: 270, scale: 0.9 },
];

const SLOT_LAYOUTS = {
  Cat: {
    body: { x: 138, y: 168 },
    head: { x: 170, y: 104 },
    ear: { x: 172, y: 68 },
    tail: { x: 230, y: 238 },
  },
  House: {
    roof_left: { x: 132, y: 108 },
    roof_right: { x: 204, y: 108 },
    wall: { x: 170, y: 182 },
    door: { x: 170, y: 236 },
    window: { x: 130, y: 182 },
  },
  Boat: {
    hull_left: { x: 136, y: 238 },
    hull_right: { x: 202, y: 238 },
    mast: { x: 168, y: 154 },
    sail: { x: 214, y: 148 },
    flag: { x: 188, y: 96 },
  },
  Bird: {
    wing: { x: 138, y: 132 },
    body: { x: 184, y: 178 },
    neck: { x: 200, y: 122 },
    head: { x: 216, y: 92 },
    beak: { x: 246, y: 126 },
    tail: { x: 114, y: 164 },
  },
  Rocket: {
    nose: { x: 170, y: 78 },
    body_top: { x: 170, y: 132 },
    body_bottom: { x: 170, y: 190 },
    window: { x: 170, y: 132 },
    left_fin: { x: 122, y: 222 },
    right_fin: { x: 218, y: 222 },
    flame: { x: 170, y: 264 },
  },
};

const TANGRAM_LEVELS = [
  {
    id: 1,
    name: "Cat",
    target: "Place each tangram piece into the matching slot to form a cat.",
    slots: [
      { id: "body", label: "Body", pieceId: "large_green" },
      { id: "head", label: "Head", pieceId: "square_red" },
      { id: "ear", label: "Ear", pieceId: "small_purple" },
      { id: "tail", label: "Tail", pieceId: "parallelogram_blue" },
    ],
    pieces: [
      { id: "large_green", label: "Large Triangle", color: "#1f7a3d", shape: "largeTriangle" },
      { id: "square_red", label: "Square", color: "#ef4444", shape: "square" },
      { id: "small_purple", label: "Small Triangle", color: "#4b2c77", shape: "smallTriangle" },
      { id: "parallelogram_blue", label: "Parallelogram", color: "#6e87bd", shape: "parallelogram" },
    ],
  },
  {
    id: 2,
    name: "House",
    target: "Build a house shape by mapping each piece correctly.",
    slots: [
      { id: "roof_left", label: "Roof Left", pieceId: "large_orange" },
      { id: "roof_right", label: "Roof Right", pieceId: "large_green" },
      { id: "wall", label: "Wall", pieceId: "square_red" },
      { id: "door", label: "Door", pieceId: "small_blue" },
      { id: "window", label: "Window", pieceId: "small_purple" },
    ],
    pieces: [
      { id: "large_orange", label: "Large Triangle", color: "#f2ac1f", shape: "largeTriangle" },
      { id: "large_green", label: "Large Triangle", color: "#1f7a3d", shape: "largeTriangle" },
      { id: "square_red", label: "Square", color: "#ef4444", shape: "square" },
      { id: "small_blue", label: "Small Triangle", color: "#3557a5", shape: "smallTriangle" },
      { id: "small_purple", label: "Small Triangle", color: "#4b2c77", shape: "smallTriangle" },
    ],
  },
  {
    id: 3,
    name: "Boat",
    target: "Assemble the boat from hull, sail, and mast pieces.",
    slots: [
      { id: "hull_left", label: "Hull Left", pieceId: "medium_pink" },
      { id: "hull_right", label: "Hull Right", pieceId: "parallelogram_blue" },
      { id: "mast", label: "Mast", pieceId: "small_blue" },
      { id: "sail", label: "Sail", pieceId: "large_orange" },
      { id: "flag", label: "Flag", pieceId: "small_purple" },
    ],
    pieces: [
      { id: "medium_pink", label: "Medium Triangle", color: "#e98d8d", shape: "mediumTriangle" },
      { id: "parallelogram_blue", label: "Parallelogram", color: "#6e87bd", shape: "parallelogram" },
      { id: "small_blue", label: "Small Triangle", color: "#3557a5", shape: "smallTriangle" },
      { id: "large_orange", label: "Large Triangle", color: "#f2ac1f", shape: "largeTriangle" },
      { id: "small_purple", label: "Small Triangle", color: "#4b2c77", shape: "smallTriangle" },
    ],
  },
  {
    id: 4,
    name: "Bird",
    target: "Fit all pieces to create a bird silhouette.",
    slots: [
      { id: "wing", label: "Wing", pieceId: "large_orange" },
      { id: "body", label: "Body", pieceId: "large_green" },
      { id: "neck", label: "Neck", pieceId: "medium_pink" },
      { id: "head", label: "Head", pieceId: "square_red" },
      { id: "beak", label: "Beak", pieceId: "small_blue" },
      { id: "tail", label: "Tail", pieceId: "small_purple" },
    ],
    pieces: [
      { id: "large_orange", label: "Large Triangle", color: "#f2ac1f", shape: "largeTriangle" },
      { id: "large_green", label: "Large Triangle", color: "#1f7a3d", shape: "largeTriangle" },
      { id: "medium_pink", label: "Medium Triangle", color: "#e98d8d", shape: "mediumTriangle" },
      { id: "square_red", label: "Square", color: "#ef4444", shape: "square" },
      { id: "small_blue", label: "Small Triangle", color: "#3557a5", shape: "smallTriangle" },
      { id: "small_purple", label: "Small Triangle", color: "#4b2c77", shape: "smallTriangle" },
    ],
  },
  {
    id: 5,
    name: "Rocket",
    target: "Complete the rocket with nose, body, and fins.",
    slots: [
      { id: "nose", label: "Nose", pieceId: "small_purple" },
      { id: "body_top", label: "Body Top", pieceId: "large_orange" },
      { id: "body_bottom", label: "Body Bottom", pieceId: "large_green" },
      { id: "window", label: "Window", pieceId: "square_red" },
      { id: "left_fin", label: "Left Fin", pieceId: "small_blue" },
      { id: "right_fin", label: "Right Fin", pieceId: "medium_pink" },
      { id: "flame", label: "Flame", pieceId: "parallelogram_blue" },
    ],
    pieces: [
      { id: "small_purple", label: "Small Triangle", color: "#4b2c77", shape: "smallTriangle" },
      { id: "large_orange", label: "Large Triangle", color: "#f2ac1f", shape: "largeTriangle" },
      { id: "large_green", label: "Large Triangle", color: "#1f7a3d", shape: "largeTriangle" },
      { id: "square_red", label: "Square", color: "#ef4444", shape: "square" },
      { id: "small_blue", label: "Small Triangle", color: "#3557a5", shape: "smallTriangle" },
      { id: "medium_pink", label: "Medium Triangle", color: "#e98d8d", shape: "mediumTriangle" },
      { id: "parallelogram_blue", label: "Parallelogram", color: "#6e87bd", shape: "parallelogram" },
    ],
  },
];

const getImprovementText = (levels) => {
  if (!Array.isArray(levels) || levels.length < 2) return "stable";
  const first = levels.slice(0, Math.floor(levels.length / 2));
  const second = levels.slice(Math.floor(levels.length / 2));
  const firstScore = first.reduce((sum, item) => sum + item.seconds + item.attempts * 8, 0) / first.length;
  const secondScore = second.reduce((sum, item) => sum + item.seconds + item.attempts * 8, 0) / second.length;
  if (firstScore - secondScore >= 8) return "improving";
  if (secondScore - firstScore >= 8) return "declining";
  return "stable";
};

const SvgPiece = ({ piece, size = 84, ghost = false }) => (
  <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true" className="shrink-0">
    <path
      d={PIECE_PATHS[piece.shape] || PIECE_PATHS.square}
      fill={piece.color}
      fillOpacity={ghost ? 0.18 : 1}
      stroke={ghost ? "#bfd0ef" : "rgba(15,23,42,0.12)"}
      strokeWidth={ghost ? 3 : 2}
      strokeLinejoin="round"
    />
  </svg>
);

const TangramGame = ({ patientId }) => {
  const [view, setView] = useState("intro");
  const [levelIndex, setLevelIndex] = useState(0);
  const [placements, setPlacements] = useState({});
  const [seconds, setSeconds] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [levelResults, setLevelResults] = useState([]);
  const [feedback, setFeedback] = useState("");
  const [savedSummary, setSavedSummary] = useState(null);
  const [trendContext, setTrendContext] = useState([]);
  const [saving, setSaving] = useState(false);
  const [isBoardHover, setIsBoardHover] = useState(false);
  const [draggingPieceId, setDraggingPieceId] = useState("");

  const level = TANGRAM_LEVELS[levelIndex];
  const isLastLevel = levelIndex === TANGRAM_LEVELS.length - 1;

  useEffect(() => {
    if (view !== "play") return undefined;
    const timer = setInterval(() => setSeconds((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [levelIndex, view]);

  useEffect(() => {
    if (!patientId) return;
    getTangramTrend(patientId, 8)
      .then((data) => setTrendContext(Array.isArray(data?.sessions) ? data.sessions : []))
      .catch(() => setTrendContext([]));
  }, [patientId]);

  const usedPieceIds = useMemo(() => new Set(Object.values(placements)), [placements]);
  const unplacedPieces = useMemo(
    () => level.pieces.filter((piece) => !usedPieceIds.has(piece.id)),
    [level.pieces, usedPieceIds]
  );

  const assignPiece = (slotId, pieceId) => {
    if (!pieceId) return;
    setPlacements((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        if (next[key] === pieceId) delete next[key];
      });
      next[slotId] = pieceId;
      return next;
    });
  };

  const removePieceFromBoard = (pieceId) => {
    setPlacements((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        if (next[key] === pieceId) delete next[key];
      });
      return next;
    });
  };

  const assignToClosestSlot = (pieceId, x, y) => {
    const layout = SLOT_LAYOUTS[level.name];
    const openSlots = level.slots.filter((slot) => placements[slot.id] !== pieceId);
    if (!layout || !openSlots.length) return;

    const closestSlot = openSlots.reduce((best, slot) => {
      const point = layout[slot.id];
      if (!point) return best;
      const distance = Math.hypot(point.x - x, point.y - y);
      if (!best || distance < best.distance) return { slotId: slot.id, distance };
      return best;
    }, null);

    if (!closestSlot) return;
    assignPiece(closestSlot.slotId, pieceId);
  };

  const resetLevel = () => {
    setPlacements({});
    setSeconds(0);
    setFeedback("");
  };

  const validateLevel = async () => {
    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);
    const allCorrect = level.slots.every((slot) => placements[slot.id] === slot.pieceId);

    if (!allCorrect) {
      setFeedback("Not quite yet. Keep trying calmly.");
      return;
    }

    const currentResult = {
      levelNumber: level.id,
      attempts: nextAttempts,
      seconds,
      solved: true,
    };

    const nextResults = [...levelResults, currentResult];
    setLevelResults(nextResults);

    if (!isLastLevel) {
      setFeedback("Great! Moving to the next tangram.");
      setLevelIndex((prev) => prev + 1);
      setPlacements({});
      setSeconds(0);
      setAttempts(0);
      return;
    }

    setFeedback("Excellent session completed.");
    if (!patientId) return;

    setSaving(true);
    try {
      const result = await submitTangramSession(patientId, nextResults);
      setSavedSummary(result?.summary || null);
      setTrendContext((prev) => [result?.session, ...(prev || [])].filter(Boolean).slice(0, 8));
    } catch (_err) {
      setSavedSummary(null);
    } finally {
      setSaving(false);
    }
  };

  const restartSession = () => {
    setView("intro");
    setLevelIndex(0);
    setPlacements({});
    setSeconds(0);
    setAttempts(0);
    setLevelResults([]);
    setFeedback("");
    setSavedSummary(null);
  };

  const localTrend = getImprovementText(levelResults);

  if (view === "intro") {
    return (
      <div className="rounded-3xl border-4 border-[#2f58a7] bg-white p-6 sm:p-8">
        <div className="grid md:grid-cols-[1.05fr_1fr] gap-6 items-center">
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-4"
          >
            <h2 className="text-4xl sm:text-6xl leading-none font-black text-black">
              Tangram
              <br />
              <span className="text-red-500">G</span>
              <span className="text-green-700">a</span>
              <span className="text-blue-700">m</span>
              <span className="text-yellow-500">e</span>
            </h2>
            <p className="text-emerald-700 text-lg font-semibold">Play, drag, and create</p>
            <motion.button
              type="button"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setView("play")}
              className="rounded-full bg-[#f5b223] text-white px-6 py-3 text-lg font-bold shadow-md"
            >
              See figures
            </motion.button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="h-72"
          >
            <svg viewBox="0 0 390 280" className="h-full w-full overflow-visible">
              {INTRO_PIECES.map((piece, index) => (
                <motion.g
                  key={piece.key}
                  initial={{ opacity: 0, x: piece.x - 18, y: piece.y + 18, rotate: piece.rotate - 8 }}
                  animate={{
                    opacity: 1,
                    x: piece.x,
                    y: [piece.y, piece.y - 6, piece.y],
                    rotate: piece.rotate,
                  }}
                  transition={{
                    delay: index * 0.08,
                    duration: 1.4,
                    repeat: Infinity,
                    repeatDelay: 1.2,
                  }}
                >
                  <g transform={`translate(${piece.x}, ${piece.y}) rotate(${piece.rotate}) scale(${piece.scale})`}>
                    <path d={PIECE_PATHS[piece.shape]} fill={piece.color} stroke="rgba(15,23,42,0.08)" strokeWidth="2" />
                  </g>
                </motion.g>
              ))}
            </svg>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border-4 border-[#2f58a7] bg-white p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-2xl sm:text-3xl font-display font-bold text-black">The {level.name.toLowerCase()}</h2>
        <p className="text-sm text-muted-foreground">
          Level {levelIndex + 1}/{TANGRAM_LEVELS.length} | Time: {seconds}s | Attempts: {attempts}
        </p>
      </div>

      <p className="text-sm text-muted-foreground max-w-2xl">
        Drag the pieces onto the silhouette where you think they fit. There are no hints.
      </p>

      <section className="grid md:grid-cols-[1.1fr_0.9fr] gap-5">
        <div className="rounded-[30px] border-[10px] border-[#b7c4e5] p-4 bg-[#f8fbff] min-h-[420px]">
          <div
            className={`relative h-full min-h-[360px] rounded-[26px] bg-white/85 overflow-hidden transition ${
              isBoardHover ? "ring-4 ring-primary/35 bg-primary/5" : ""
            }`}
            onDragOver={(event) => event.preventDefault()}
            onDragEnter={() => setIsBoardHover(true)}
            onDragLeave={() => setIsBoardHover(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsBoardHover(false);
              const pieceId = event.dataTransfer.getData("pieceId");
              if (!pieceId) return;
              const rect = event.currentTarget.getBoundingClientRect();
              const x = ((event.clientX - rect.left) / rect.width) * 340;
              const y = ((event.clientY - rect.top) / rect.height) * 320;
              assignToClosestSlot(pieceId, x, y);
              setDraggingPieceId("");
            }}
          >
            <svg viewBox="0 0 340 320" className="absolute inset-0 h-full w-full pointer-events-none">
              <g fill="#c7d8f7" fillOpacity="0.4" stroke="#5b7ec7" strokeOpacity="0.95" strokeWidth="10" strokeLinejoin="round" strokeLinecap="round">
                {SILHOUETTES[level.name]}
              </g>
            </svg>

            {draggingPieceId ? (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 rounded-full bg-primary/90 text-primary-foreground text-xs px-3 py-1">
                Drop on the silhouette
              </div>
            ) : null}

            {level.slots.map((slot) => {
              const pieceId = placements[slot.id];
              const piece = level.pieces.find((item) => item.id === pieceId);
              const point = SLOT_LAYOUTS[level.name]?.[slot.id];
              if (!piece || !point) return null;

              return (
                <motion.div
                  key={`${slot.id}-${piece.id}`}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData("pieceId", piece.id);
                    setDraggingPieceId(piece.id);
                    removePieceFromBoard(piece.id);
                  }}
                  onDragEnd={() => setDraggingPieceId("")}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`absolute z-20 -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing transition ${
                    draggingPieceId === piece.id ? "scale-110 drop-shadow-xl" : ""
                  }`}
                  style={{ left: `${(point.x / 340) * 100}%`, top: `${(point.y / 320) * 100}%` }}
                >
                  <SvgPiece piece={piece} size={84} />
                </motion.div>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-[#e3e8f6] p-3">
            <p className="text-sm text-muted-foreground">Drag pieces to the puzzle board.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {unplacedPieces.map((piece) => (
              <motion.button
                key={piece.id}
                type="button"
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData("pieceId", piece.id);
                  setDraggingPieceId(piece.id);
                }}
                onDragEnd={() => setDraggingPieceId("")}
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className={`rounded-2xl border px-3 py-3 text-left border-primary/40 transition ${
                  draggingPieceId === piece.id ? "ring-2 ring-primary/60 scale-105 shadow-lg" : ""
                }`}
                style={{ backgroundColor: `${piece.color}20` }}
              >
                <div className="flex items-center gap-3">
                  <SvgPiece piece={piece} size={56} />
                  <div>
                    <span className="block font-semibold" style={{ color: piece.color }}>
                      {piece.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Drag to board
                    </span>
                  </div>
                </div>
              </motion.button>
            ))}
            {!unplacedPieces.length ? (
              <p className="text-sm text-muted-foreground sm:col-span-2">All pieces are on the board.</p>
            ) : null}
          </div>
        </div>
      </section>

      <div className="flex items-center gap-2 flex-wrap">
        <motion.button
          type="button"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
          onClick={validateLevel}
          className="min-h-11 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
        >
          Check Level
        </motion.button>
        <motion.button
          type="button"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
          onClick={resetLevel}
          className="min-h-11 px-4 rounded-xl border border-border text-sm font-semibold"
        >
          Reset Level
        </motion.button>
        <motion.button
          type="button"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setView("intro")}
          className="min-h-11 px-4 rounded-xl border border-border text-sm font-semibold"
        >
          Intro
        </motion.button>
      </div>

      {feedback ? <p className="text-sm text-foreground">{feedback}</p> : null}

      <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm">
        <p className="font-medium text-foreground">Session behavior insight</p>
        <p className="text-muted-foreground mt-1">
          Current session trend: <span className="font-semibold text-foreground">{localTrend}</span>
        </p>
        {savedSummary ? (
          <p className="text-muted-foreground mt-1">
            Saved: {savedSummary.totalAttempts} attempts, {savedSummary.totalSeconds}s total, overall trend{" "}
            <span className="font-semibold text-foreground">{savedSummary.trend}</span>.
          </p>
        ) : null}
        {!savedSummary && !saving && levelResults.length === TANGRAM_LEVELS.length ? (
          <p className="text-warning mt-1">Session complete, but patient context is missing so data was not saved.</p>
        ) : null}
        {saving ? <p className="text-muted-foreground mt-1">Saving session...</p> : null}
      </div>

      <div className="rounded-xl border border-border p-3 text-sm">
        <p className="font-medium text-foreground">Recent Tangram sessions</p>
        {trendContext.length ? (
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {trendContext.slice(0, 5).map((session, idx) => (
              <li key={session?._id || session?.id || idx}>
                {new Date(session.playedAt).toLocaleDateString()} - {session.totalAttempts} attempts, {session.totalSeconds}s, {session.trend}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground mt-1">No previous tangram sessions yet.</p>
        )}
      </div>

      <motion.button
        type="button"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={restartSession}
        className="min-h-11 px-4 rounded-xl border border-border text-sm font-semibold"
      >
        Restart Full Tangram Session
      </motion.button>
    </div>
  );
};

export default TangramGame;
