import { LucideIcon } from "lucide-react";

interface StatusCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  status?: "safe" | "warning" | "alert" | "neutral";
}

const StatusCard = ({ title, value, subtitle, icon: Icon, status = "neutral" }: StatusCardProps) => {
  const statusStyles = {
    safe: "bg-safe/10 border-safe/20 text-safe",
    warning: "bg-warning/10 border-warning/20 text-warning",
    alert: "bg-alert/10 border-alert/20 text-alert",
    neutral: "bg-muted border-border text-muted-foreground",
  };

  return (
    <div className="bg-card rounded-xl border border-border p-4 shadow-gentle animate-fade-in">
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${statusStyles[status]}`}>
          <Icon className="w-4 h-4" />
        </div>
        {status !== "neutral" && (
          <div className={`w-2 h-2 rounded-full ml-auto ${
            status === "safe" ? "bg-safe" : 
            status === "warning" ? "bg-warning" : "bg-alert"
          } animate-pulse-gentle`} />
        )}
      </div>
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className="text-lg font-display font-bold text-foreground">{value}</p>
      {subtitle && (
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
};

export default StatusCard;
