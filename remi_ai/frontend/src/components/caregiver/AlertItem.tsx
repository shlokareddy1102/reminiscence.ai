import { Clock, MapPin, AlertCircle, ChevronRight } from "lucide-react";

interface AlertItemProps {
  id: string;
  type: "missed" | "confusion" | "location" | "medication";
  title: string;
  description: string;
  time: string;
  location?: string;
  suggestedAction: string;
  severity: "low" | "medium" | "high";
}

const AlertItem = ({ 
  title, 
  description, 
  time, 
  location, 
  suggestedAction, 
  severity 
}: AlertItemProps) => {
  const severityStyles = {
    low: "border-l-accent",
    medium: "border-l-warning",
    high: "border-l-alert",
  };

  return (
    <div className={`bg-card rounded-lg border border-border border-l-4 ${severityStyles[severity]} p-3 shadow-gentle animate-fade-in hover:shadow-calm transition-shadow cursor-pointer`}>
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0
          ${severity === "high" ? "bg-alert/10 text-alert" : 
            severity === "medium" ? "bg-warning/10 text-warning" : "bg-accent/10 text-accent"}`}>
          <AlertCircle className="w-4 h-4" />
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground mb-1">{description}</p>
          
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> {time}
            </span>
            {location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {location}
              </span>
            )}
          </div>
          
          <p className="text-xs mt-1">
            <span className="font-medium text-primary">Suggested: </span>
            <span className="text-muted-foreground">{suggestedAction}</span>
          </p>
        </div>
        
        <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      </div>
    </div>
  );
};

export default AlertItem;
