import { ArrowDown, ArrowUp, Heart, Minus, Sparkles, Users } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const avg = (values) => {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
};

const statusFromDelta = (delta) => {
  if (delta > 2) return "improving";
  if (delta < -2) return "declining";
  return "stable";
};

const badgeForStatus = (status) => {
  if (status === "improving") {
    return {
      label: "Improving",
      icon: ArrowUp,
      className: "text-emerald-700 bg-emerald-100"
    };
  }

  if (status === "declining") {
    return {
      label: "Declining",
      icon: ArrowDown,
      className: "text-rose-700 bg-rose-100"
    };
  }

  return {
    label: "Stable",
    icon: Minus,
    className: "text-[#6f6a88] bg-[#ece9f4]"
  };
};

const buildSyntheticModel = () => {
  const series = [83, 84, 85, 84, 82, 86, 87].map((value, index) => ({
    label: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index],
    value
  }));

  const events = [
    {
      id: "demo-1",
      kind: "recognized",
      title: "Recognized daughter Sarah",
      when: "yesterday at 4:12 PM",
      timestamp: Date.now() - (24 * 60 * 60 * 1000)
    },
    {
      id: "demo-2",
      kind: "recognized",
      title: "Recognized neighbor Helen",
      when: "2 days ago at 6:08 PM",
      timestamp: Date.now() - (2 * 24 * 60 * 60 * 1000)
    },
    {
      id: "demo-3",
      kind: "recognized",
      title: "Recognized caregiver Daniel",
      when: "3 days ago at 7:25 PM",
      timestamp: Date.now() - (3 * 24 * 60 * 60 * 1000)
    },
    {
      id: "demo-4",
      kind: "unknown",
      title: "Unfamiliar face (low confidence)",
      when: "4 days ago at 1:44 PM",
      timestamp: Date.now() - (4 * 24 * 60 * 60 * 1000),
      confidence: 0.43
    }
  ];

  return {
    isDemo: true,
    score: 85,
    status: "stable",
    series,
    events,
    summary: "Recognition remains stable. Familiar interactions are reinforcing emotional grounding.",
    bullets: [
      "Most recognition events occur in the evening.",
      "Slight dip mid-week with recovery by weekend.",
      "No persistent unfamiliar-face alerts recently."
    ],
    recommendation: "Encourage one familiar interaction today to reinforce memory and emotional reassurance."
  };
};

const buildModel = ({ trend, score, trendDelta, insight, events }) => {
  const hasRealTrend = Array.isArray(trend) && trend.length > 0;
  const hasRealScore = Number.isFinite(score);
  const hasRealEvents = Array.isArray(events) && events.length > 0;
  const hasRealData = hasRealTrend || hasRealScore || hasRealEvents;

  if (!hasRealData) {
    return buildSyntheticModel();
  }

  const series = hasRealTrend
    ? trend.map((point, index) => ({
        label: point?.label || `Day ${index + 1}`,
        value: clamp(Math.round(Number(point?.value) || 0), 35, 99)
      }))
    : [];

  const inferredScore = hasRealScore
    ? Math.round(Number(score))
    : Math.round(avg(series.map((point) => point.value)) || 78);

  const safeSeries = series.length
    ? series
    : [
        -3, -2, -1, 0, 1, 2, 3
      ].map((offset, index) => ({
        label: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index],
        value: clamp(inferredScore + offset, 40, 98)
      }));

  const seriesDelta = (safeSeries[safeSeries.length - 1]?.value || inferredScore)
    - (safeSeries[0]?.value || inferredScore);
  const effectiveDelta = Number.isFinite(trendDelta) ? trendDelta : seriesDelta;
  const status = statusFromDelta(effectiveDelta);

  const normalizedEvents = hasRealEvents
    ? events.map((event, index) => ({
        id: event?.id || `event-${index}`,
        kind: event?.kind === "unknown" ? "unknown" : "recognized",
        title: event?.title || "Recognition event",
        when: event?.when || "recent",
        timestamp: event?.timestamp || null,
        confidence: Number.isFinite(event?.confidence) ? event.confidence : null
      }))
    : [];

  const unknownCount = normalizedEvents.filter((event) => event.kind === "unknown").length;

  const peakPeriod = (() => {
    const hours = normalizedEvents
      .map((event) => new Date(event.timestamp || 0))
      .filter((dt) => !Number.isNaN(dt.getTime()))
      .map((dt) => dt.getHours());

    if (!hours.length) return "Recognition timing is still being established.";
    const eveningCount = hours.filter((h) => h >= 17 && h <= 21).length;
    const morningCount = hours.filter((h) => h >= 6 && h <= 11).length;
    const afternoonCount = hours.filter((h) => h >= 12 && h <= 16).length;

    if (eveningCount >= morningCount && eveningCount >= afternoonCount) {
      return "Most recognition events occur in the evening.";
    }
    if (morningCount >= afternoonCount) {
      return "Most recognition events occur in the morning.";
    }
    return "Most recognition events occur in the afternoon.";
  })();

  const dipPoint = safeSeries.reduce((minPoint, point) => (point.value < minPoint.value ? point : minPoint), safeSeries[0]);
  const dipText = `${dipPoint.label} shows the lowest recognition confidence this week.`;
  const unknownText = unknownCount
    ? `${unknownCount} unfamiliar-face alert${unknownCount > 1 ? "s" : ""} need closer monitoring.`
    : "No unfamiliar-face alerts recently.";

  let summary = insight;
  if (!summary) {
    if (inferredScore >= 82) {
      summary = "Recognition remains stable. Familiar interactions are reinforcing emotional grounding.";
    } else if (inferredScore >= 68) {
      summary = "Recognition is fair with occasional lapses. Consistent familiar contact can improve confidence.";
    } else {
      summary = "Recognition confidence is softer this week. Structured familiar interactions are recommended.";
    }
  }

  const recommendation = inferredScore >= 80
    ? "Keep one familiar check-in daily to maintain emotional reassurance and orientation."
    : "Encourage one familiar interaction today to reinforce memory and emotional reassurance.";

  return {
    isDemo: false,
    score: inferredScore,
    status,
    series: safeSeries,
    events: normalizedEvents,
    summary,
    bullets: [peakPeriod, dipText, unknownText],
    recommendation
  };
};

const RecognitionSocialSection = ({
  trend = [],
  score = null,
  trendDelta = 0,
  insight = "",
  events = []
}) => {
  const model = buildModel({ trend, score, trendDelta, insight, events });
  const badge = badgeForStatus(model.status);
  const BadgeIcon = badge.icon;
  const eventCount = model.events.length;
  const seriesValues = model.series.map((point) => Number(point.value)).filter((value) => Number.isFinite(value));
  const seriesMin = seriesValues.length ? Math.min(...seriesValues) : 70;
  const seriesMax = seriesValues.length ? Math.max(...seriesValues) : 90;
  const yMin = clamp(Math.floor(seriesMin - 6), 0, 95);
  const yMax = clamp(Math.ceil(seriesMax + 6), 5, 100);

  return (
    <section className="space-y-2">
      <h2 className="text-[2rem] leading-tight font-[Georgia,serif] font-semibold text-[#251943]">
        Recognition & social signals
      </h2>
      <p className="text-sm text-[#5f5b78]">Familiar faces and the warmth of recent moments</p>
      {model.isDemo && (
        <p className="inline-flex items-center gap-1.5 text-xs rounded-full bg-[#efe9fb] text-[#664ca0] px-3 py-1 font-medium">
          <Sparkles className="w-3.5 h-3.5" />
          Demo data shown for preview
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]">
        <article className="rounded-[2rem] border border-[#e7e3ef] bg-white p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="inline-flex items-center gap-2 text-[#675f84] uppercase tracking-[0.14em] text-xs sm:text-sm font-semibold">
              <Users className="w-4 h-4" />
              Familiar face recognition
            </div>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${badge.className}`}>
              <BadgeIcon className="w-4 h-4" />
              {badge.label}
            </span>
          </div>

          <p className="text-5xl sm:text-6xl font-[Georgia,serif] text-[#2d2155] mb-3">
            {model.score}%
          </p>

          <div className="w-full rounded-2xl bg-[#faf8fe] border border-[#ebe7f3] px-2 py-2" style={{ minHeight: 220 }}>
            <ResponsiveContainer width="100%" height={204}>
              <AreaChart data={model.series} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="recognitionAreaFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7E57C2" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#7E57C2" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#ece7f5" strokeDasharray="3 3" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#7f7898", fontSize: 11 }} />
                <YAxis hide domain={[yMin, yMax]} />
                <Tooltip
                  cursor={{ stroke: "#d6cfee", strokeWidth: 1 }}
                  contentStyle={{ borderRadius: "12px", border: "1px solid #e7e3ef" }}
                  formatter={(value) => [`${value}%`, "Recognition"]}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#6F4CAF"
                  strokeWidth={3}
                  fill="url(#recognitionAreaFill)"
                  isAnimationActive={false}
                  dot={{ r: 2.5, fill: "#6F4CAF", stroke: "#ffffff", strokeWidth: 1 }}
                  activeDot={{ r: 4, fill: "#5d3ea6" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <p className="mt-3 text-sm text-[#5f5b78]">{eventCount} recognition events this week</p>
        </article>

        <article className="rounded-[2rem] border border-[#e7e3ef] bg-[#fdfcff] p-5 sm:p-6 flex flex-col shadow-sm">
          <p className="inline-flex items-center gap-2 text-[#675f84] uppercase tracking-[0.14em] text-xs sm:text-sm font-semibold">
            <Heart className="w-4 h-4" />
            Social & emotional insight
          </p>

          <p className="mt-4 text-base leading-relaxed text-[#413764] font-medium">{model.summary}</p>

          <ul className="mt-4 space-y-2 text-sm text-[#5f5b78]">
            {model.bullets.map((bullet, index) => (
              <li key={`${bullet}-${index}`} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#8b74c2]" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>

          {model.events.length > 0 && (
            <div className="mt-4 rounded-xl border border-[#ebe7f3] bg-white/80 p-3">
              <p className="text-xs uppercase tracking-wide text-[#6f6a88] font-semibold mb-2">Recent recognition moments</p>
              <div className="space-y-1.5">
                {model.events.slice(0, 3).map((event) => (
                  <p key={event.id} className="text-sm text-[#5f5b78]">
                    <span className="font-medium text-[#3f3562]">{event.title}</span>
                    <span> - {event.when}</span>
                  </p>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 rounded-xl border border-[#d8f0df] bg-[#f3fbf5] p-3.5">
            <p className="text-sm text-[#2f5f3a] font-semibold">Recommendation</p>
            <p className="text-sm text-[#3f5c45] mt-1 leading-relaxed">{model.recommendation}</p>
          </div>
        </article>
      </div>
    </section>
  );
};

export default RecognitionSocialSection;
