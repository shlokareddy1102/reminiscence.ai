import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

type Point = { label: string; mood: number; sleep: number; activity: number };

type Props = {
  data: Point[];
};

export default function DashboardVitalsChart({ data }: Props) {
  const chartData = data.length
    ? data
    : [
        { label: "—", mood: 0, sleep: 0, activity: 0 },
        { label: "—", mood: 0, sleep: 0, activity: 0 }
      ];

  return (
    <div className="rounded-2xl border border-border/80 bg-card/80 p-4 shadow-md backdrop-blur-sm transition-shadow duration-300 hover:shadow-lg">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">7-day signals</p>
      <p className="text-sm font-display font-semibold text-foreground mb-4">Mood, sleep & activity</p>
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={32} />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: "1px solid hsl(var(--border))",
                boxShadow: "0 8px 24px -8px hsl(var(--foreground) / 0.15)"
              }}
            />
            <Line type="monotone" dataKey="mood" name="Mood" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} animationDuration={600} />
            <Line type="monotone" dataKey="sleep" name="Sleep" stroke="hsl(var(--warning))" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} animationDuration={600} />
            <Line type="monotone" dataKey="activity" name="Activity" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} animationDuration={600} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
