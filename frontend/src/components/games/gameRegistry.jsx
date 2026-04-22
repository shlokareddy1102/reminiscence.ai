import { BrainCircuit, Layers, UserCircle2 } from "lucide-react";
import ReactionGame from "@/components/games/fitt&hick";
import FaceRecognitionGame from "@/components/games/FaceRecognitionGame";
import MemoryObjectsGame from "@/components/games/MemoryObjectsGame";
import SequenceGame from "@/components/games/SequenceGame";
import TangramGame from "@/components/games/TangramGame";

export const gameModules = [
  {
    id: "reaction",
    route: "reaction",
    label: "Reaction Game",
    description: "Tap the matching color as fast as you can",
    icon: BrainCircuit,
    component: ReactionGame,
    buildProps: () => ({ stage: "early" }),
  },
  {
    id: "face",
    route: "face",
    label: "Face Recognition",
    description: "Recognize familiar faces with gentle reinforcement",
    icon: UserCircle2,
    component: FaceRecognitionGame,
    buildProps: ({ patientId }) => ({ patientId }),
  },
  {
    id: "memory",
    route: "memory",
    label: "Memory Objects",
    description: "Recall everyday objects from short memory prompts",
    icon: Layers,
    component: MemoryObjectsGame,
  },
  {
    id: "sequence",
    route: "sequence",
    label: "Sequence Game",
    description: "Remember and repeat short number sequences",
    icon: BrainCircuit,
    component: SequenceGame,
  },
  {
    id: "tangram",
    route: "tangram",
    label: "Tangram",
    description: "Solve multi-level tangram puzzles with timing",
    icon: Layers,
    component: TangramGame,
    buildProps: ({ patientId }) => ({ patientId }),
  },
];

export const defaultGameRoute = gameModules[0]?.route || "reaction";
