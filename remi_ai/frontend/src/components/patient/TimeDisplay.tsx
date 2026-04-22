import { useState, useEffect } from "react";
import { format } from "date-fns";

const TimeDisplay = () => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="text-center animate-fade-in">
      <p className="text-2xl font-display font-bold text-foreground">
        {format(currentTime, "h:mm a")}
      </p>
      <p className="text-sm text-muted-foreground">
        {format(currentTime, "EEEE, MMMM d, yyyy")}
      </p>
    </div>
  );
};

export default TimeDisplay;
