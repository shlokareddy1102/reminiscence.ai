import { Activity, AlertCircle, Calendar } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

const ROUTINE_LABELS = ["Morning", "Midday", "Evening", "Bedtime"];

const EmptyState = () => (
  <section>
    <header className="mb-3">
      <h2 className="text-[2rem] leading-tight font-[Georgia,serif] font-semibold text-[#251943]">
        Behavior & routine
      </h2>
      <p className="text-sm text-[#5f5b78]">Stability, adherence, and gentle deviations</p>
    </header>
    <div className="rounded-3xl border border-border bg-card p-6 shadow-gentle">
      <p className="text-foreground font-medium">Log a typical day</p>
      <p className="text-sm text-muted-foreground mt-1">
        Once we know the usual rhythm, we will surface the moments that drift.
      </p>
    </div>
  </section>
);

const BehaviorRoutineSection = ({ routine }) => {
  if (!routine) return <EmptyState />;

  const stability = Number(routine.stabilityScore || 0);
  const size = 220;
  const stroke = 20;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.max(0, Math.min(100, stability)) / 100) * circumference;
  const insights = (() => {
  if (!routine?.adherence) return [];

  const missedByRoutine = [0, 0, 0, 0]; // morning, midday, evening, bedtime
  const days = [];

  routine.adherence.forEach((day) => {
    day.kept.forEach((kept, i) => {
      if (!kept) {
        missedByRoutine[i]++;
        days.push({ day: day.day, type: ROUTINE_LABELS[i] });
      }
    });
  });

  const result = [];

  ROUTINE_LABELS.forEach((label, i) => {
    if (missedByRoutine[i] > 0) {
      result.push(
        `${label} routine missed ${missedByRoutine[i]} time(s) this week`
      );
    }
  });

  // detect time pattern
  if (missedByRoutine[2] > 2) {
    result.push("Evening instability observed (post 6–7PM)");
  }

  if (missedByRoutine[0] > 2) {
    result.push("Morning routine inconsistency detected");
  }

  return result.slice(0, 3);
})();
  return (
    <section className="space-y-2">
      <h2 className="text-[2rem] leading-tight font-[Georgia,serif] font-semibold text-[#251943]">
        Behavior & routine
      </h2>
      <p className="text-sm text-[#5f5b78]">Stability, adherence, and gentle deviations</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
        <article className="rounded-[2rem] border border-border bg-card p-6 shadow-gentle">
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-[#6d6386] tracking-[0.14em] uppercase text-sm flex items-center justify-center gap-2">
                <Activity className="w-5 h-5" />
                Routine stability
              </p>

              <div className="relative mt-4 h-56 w-56 rounded-full mx-auto">
                <svg width={size} height={size} className="-rotate-90">
                  <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="#ece8ef"
                    strokeWidth={stroke}
                  />
                  <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="#E2A341"
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    className="transition-all duration-700"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-[2.8rem] font-[Georgia,serif] leading-none text-[#20163f]">
                    {stability}
                  </p>
                  <p className="text-lg text-[#5f5b78]">/ 100</p>
                </div>
              </div>

              <p className="mt-4 text-sm text-[#5f5b78] max-w-[16rem] mx-auto">
                {stability >= 80
                  ? "Routines are remarkably steady this week."
                  : stability >= 60
                    ? "Mostly steady - a few moments slipped."
                    : "Routines are wobbling - gentle support may help."}
              </p>
            </div>
          </div>
        </article>

        <article className="rounded-[2rem] border border-border bg-card p-6 shadow-gentle">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[#6d6386] tracking-[0.14em] uppercase text-sm flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Daily routines kept
              </p>
              <p className="mt-2 text-[1.9rem] font-[Georgia,serif] leading-none text-[#20163f]">Last 7 days</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f4ead8] px-3 py-1.5 text-[#d59237] text-sm">
              <AlertCircle className="w-4 h-4" />
              {routine.deviation}
            </span>
          </div>

          <div className="mt-5 space-y-2">
            <div className="grid grid-cols-7 gap-2 px-1">
              {routine.adherence.map((day) => (
                <p key={day.day} className="text-center text-sm text-[#6a6384]">{day.day}</p>
              ))}
            </div>

            {ROUTINE_LABELS.map((label, rowIndex) => (
              <div key={label} className="grid grid-cols-7 gap-2">
                {routine.adherence.map((day) => (
                  <div
                    key={`${day.day}-${label}`}
                    title={`${label} - ${day.kept[rowIndex] ? "kept" : "missed"}`}
                    className={cn(
                      "h-9 rounded-full",
                      day.kept[rowIndex] ? "bg-[#94bea7]" : "bg-[#e9e6ee]"
                    )}
                  />
                ))}
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-[#625b7d]">
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-[#94bea7]" />
                Kept
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-[#e9e6ee]" />
                Missed
              </span>
            </div>
            <p>Morning | Midday | Evening | Bedtime</p>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between text-[#5f5b78] text-sm mb-2">
              <p>Activity consistency</p>
              <p>last 14 days</p>
            </div>
            <div className="h-24 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={routine.activitySeries} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="behavior-consistency" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(126, 87, 194, 0.25)" />
                      <stop offset="100%" stopColor="rgba(126, 87, 194, 0)" />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#7E57C2"
                    strokeWidth={4}
                    fill="url(#behavior-consistency)"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
};

export default BehaviorRoutineSection;

