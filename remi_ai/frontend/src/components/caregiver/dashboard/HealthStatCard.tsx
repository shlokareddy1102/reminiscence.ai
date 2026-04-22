import { LucideIcon } from "lucide-react";

type Tone = "good" | "warning" | "critical";

interface HealthStatCardProps {
  title: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  tone: Tone;
}

const toneStyles: Record<Tone, { icon: string; dot: string }> = {
  good: {
    icon: "bg-safe/12 text-safe border border-safe/20",
    dot: "bg-safe"
  },
  warning: {
    icon: "bg-warning/12 text-warning border border-warning/20",
    dot: "bg-warning"
  },
  critical: {
    icon: "bg-alert/12 text-alert border border-alert/20",
    dot: "bg-alert"
  }
};

const HealthStatCard = ({ title, value, hint, icon: Icon, tone }: HealthStatCardProps) => {
  const style = toneStyles[tone];

  return (
    <article className="bg-card border border-border rounded-xl p-4 shadow-gentle hover:shadow-calm hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${style.icon}`}>
          <Icon className="w-5 h-5" />
        </div>
        <span className={`w-2 h-2 rounded-full mt-1 ${style.dot} animate-pulse-gentle`} />
      </div>

      <p className="text-xs text-muted-foreground mt-3">{title}</p>
      <p className="text-2xl font-display font-bold text-foreground leading-tight mt-1">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{hint}</p>
    </article>
  );
};

export default HealthStatCard;
