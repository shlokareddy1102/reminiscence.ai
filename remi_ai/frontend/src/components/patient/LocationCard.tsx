import { MapPin, Home } from "lucide-react";

interface LocationCardProps {
  location: string;
  isSafe: boolean;
}

const LocationCard = ({ location, isSafe }: LocationCardProps) => {
  return (
    <div className="patient-card animate-fade-in !p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          {isSafe ? <Home className="w-5 h-5 text-primary" /> : <MapPin className="w-5 h-5 text-primary" />}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Current Location</p>
          <p className="text-base font-semibold text-foreground">{location}</p>
        </div>
      </div>
      
      {/* Compact map placeholder */}
      <div className="relative w-full h-28 rounded-lg overflow-hidden bg-secondary/50 border border-border">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-1 animate-pulse-gentle">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <p className="text-xs text-muted-foreground">{location}</p>
          </div>
        </div>
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage: `linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)`,
          backgroundSize: '30px 30px'
        }} />
      </div>
      
      {isSafe && (
        <div className="mt-2 flex items-center gap-2 p-2 rounded-lg bg-safe/10 border border-safe/20">
          <div className="w-2 h-2 rounded-full bg-safe animate-pulse-gentle" />
          <p className="text-xs text-safe font-medium">You are at home and safe</p>
        </div>
      )}
    </div>
  );
};

export default LocationCard;
