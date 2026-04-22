interface TrendBarsProps {
  title: string;
  data: number[];
  colorClass?: string;
}

const TrendBars = ({ title, data, colorClass = "bg-primary" }: TrendBarsProps) => {
  const safeData = data.length ? data : [0, 0, 0, 0, 0, 0, 0];

  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground mb-2">{title}</p>
      <div className="h-20 flex items-end gap-1.5">
        {safeData.map((point, idx) => (
          <div
            key={`${title}-${idx}`}
            className="flex-1 bg-muted rounded-sm overflow-hidden"
            aria-label={`${title} day ${idx + 1}: ${point}`}
          >
            <div
              className={`w-full ${colorClass} rounded-sm transition-all duration-500`}
              style={{ height: `${Math.max(8, Math.min(100, point))}%` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default TrendBars;
