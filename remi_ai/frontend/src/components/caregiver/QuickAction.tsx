import { LucideIcon } from "lucide-react";

interface QuickActionProps {
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
  variant?: "primary" | "secondary";
}

const QuickAction = ({ label, icon: Icon, onClick, variant = "secondary" }: QuickActionProps) => {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all hover:scale-[1.02] active:scale-[0.98]
        ${variant === "primary" 
          ? "bg-primary text-primary-foreground border-primary shadow-calm hover:shadow-gentle" 
          : "bg-card text-foreground border-border hover:border-primary/30 hover:bg-secondary/50 shadow-gentle"
        }`}
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center
        ${variant === "primary" ? "bg-primary-foreground/20" : "bg-muted"}`}>
        <Icon className="w-4 h-4" />
      </div>
      <span className="font-medium text-xs">{label}</span>
    </button>
  );
};

export default QuickAction;
