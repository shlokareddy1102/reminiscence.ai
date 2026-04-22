import { AlertCircle, Bell, X } from "lucide-react";

interface NotificationBannerProps {
  message: string;
  type: "info" | "warning" | "alert";
  onDismiss?: () => void;
}

const NotificationBanner = ({ message, type, onDismiss }: NotificationBannerProps) => {
  const styles = {
    info: { container: "bg-accent/10 border-accent/30", icon: "bg-accent/20 text-accent", text: "text-accent" },
    warning: { container: "bg-warning/10 border-warning/30", icon: "bg-warning/20 text-warning", text: "text-warning" },
    alert: { container: "bg-alert/10 border-alert/30", icon: "bg-alert/20 text-alert", text: "text-alert" },
  };
  const style = styles[type];

  return (
    <div className={`rounded-xl border-2 p-3 animate-fade-in ${style.container}`}>
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${style.icon}`}>
          {type === "alert" ? <AlertCircle className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
        </div>
        
        <div className="flex-1">
          <p className={`text-[10px] font-medium uppercase tracking-wide ${style.text}`}>
            {type === "alert" ? "Important" : type === "warning" ? "Reminder" : "Notice"}
          </p>
          <p className="text-sm font-semibold text-foreground">{message}</p>
        </div>
        
        {onDismiss && (
          <button onClick={onDismiss} className="w-8 h-8 rounded-lg bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>
    </div>
  );
};

export default NotificationBanner;
