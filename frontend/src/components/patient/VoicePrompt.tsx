import { Volume2, Bot } from "lucide-react";

interface VoicePromptProps {
  message: string;
  isAiGenerated?: boolean;
}

const VoicePrompt = ({ message, isAiGenerated = true }: VoicePromptProps) => {
  const handleSpeak = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="patient-card animate-fade-in !p-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center flex-shrink-0">
          <Bot className="w-5 h-5 text-accent" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-xs font-medium text-accent">Reminiscence Assistant</p>
            {isAiGenerated && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">AI</span>
            )}
          </div>
          <p className="text-sm text-foreground leading-relaxed">{message}</p>
        </div>
        
        <button
          onClick={handleSpeak}
          className="w-9 h-9 rounded-lg bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors flex-shrink-0"
          aria-label="Play voice prompt"
        >
          <Volume2 className="w-4 h-4 text-primary" />
        </button>
      </div>
    </div>
  );
};

export default VoicePrompt;
