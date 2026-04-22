/**
 * MusicImpactWidget.jsx
 *
 * Add to CaregiverInsights.jsx — shows whether music therapy is clinically helping.
 * Import and drop it anywhere inside the insights page.
 *
 * Usage:
 *   import MusicImpactWidget from "@/components/caregiver/MusicImpactWidget";
 *   <MusicImpactWidget patientId={selectedPatientId} />
 */

import { useEffect, useState } from "react";
import { Music2, TrendingUp, TrendingDown, Minus, SkipForward, Repeat2, ThumbsUp } from "lucide-react";
import { apiRequest } from "@/lib/api";

const MusicImpactWidget = ({ patientId }) => {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [days,    setDays]    = useState(30);

  useEffect(() => {
    if (!patientId) return;
    setLoading(true);
    apiRequest(`/api/music/${patientId}/impact?days=${days}`)
      .then((r) => setData(r || null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [patientId, days]);

  if (loading) {
    return (
      <section className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Music2 className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Music therapy impact</h2>
        </div>
        <p className="text-xs text-muted-foreground">Loading…</p>
      </section>
    );
  }

  if (!data?.hasData) {
    return (
      <section className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Music2 className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Music therapy impact</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          No listening sessions yet. Once the patient uses the Music page, impact data will appear here.
        </p>
      </section>
    );
  }

  const signalColor = data.helpingSignal === "positive"
    ? "text-emerald-600"
    : data.helpingSignal === "negative"
      ? "text-red-500"
      : "text-amber-500";

  const signalBg = data.helpingSignal === "positive"
    ? "bg-emerald-50 border-emerald-200"
    : data.helpingSignal === "negative"
      ? "bg-red-50 border-red-200"
      : "bg-amber-50 border-amber-200";

  const SignalIcon = data.helpingSignal === "positive"
    ? TrendingUp
    : data.helpingSignal === "negative"
      ? TrendingDown
      : Minus;

  const moodDelta = data.moodWithMusic !== null && data.moodWithoutMusic !== null
    ? (data.moodWithMusic - data.moodWithoutMusic).toFixed(1)
    : null;

  const agitDelta = data.agitationWithMusic !== null && data.agitationWithoutMusic !== null
    ? (data.agitationWithoutMusic - data.agitationWithMusic).toFixed(1)
    : null;

  return (
    <section className="bg-card border border-border rounded-2xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Music2 className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Music therapy impact</h2>
          <span className="text-xs text-muted-foreground">{data.sessions} sessions</span>
        </div>
        <div className="inline-flex rounded-lg border border-border p-1 bg-muted/40">
          {[14, 30, 60].map((d) => (
            <button key={d} type="button" onClick={() => setDays(d)}
              className={`px-2 py-0.5 text-xs rounded-md transition-colors ${
                days === d ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Signal banner */}
      <div className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 ${signalBg}`}>
        <SignalIcon className={`w-4 h-4 shrink-0 ${signalColor}`} />
        <p className={`text-xs font-medium ${signalColor}`}>{data.helpingMessage}</p>
      </div>

      {/* Mood + agitation comparison */}
      {(moodDelta !== null || agitDelta !== null) && (
        <div className="grid grid-cols-2 gap-2">
          {moodDelta !== null && (
            <div className="rounded-xl border border-border p-3 bg-muted/20">
              <p className="text-xs text-muted-foreground">Mood on music days</p>
              <p className={`text-lg font-bold mt-0.5 ${Number(moodDelta) >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {Number(moodDelta) >= 0 ? "+" : ""}{moodDelta}
              </p>
              <p className="text-xs text-muted-foreground">vs non-music days</p>
            </div>
          )}
          {agitDelta !== null && (
            <div className="rounded-xl border border-border p-3 bg-muted/20">
              <p className="text-xs text-muted-foreground">Agitation on music days</p>
              <p className={`text-lg font-bold mt-0.5 ${Number(agitDelta) >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {Number(agitDelta) >= 0 ? "-" : "+"}{Math.abs(agitDelta)}
              </p>
              <p className="text-xs text-muted-foreground">vs non-music days</p>
            </div>
          )}
        </div>
      )}

      {/* Engagement metrics */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { icon: ThumbsUp,    label: "Liked",     value: `${data.thumbsUpRate ?? 0}%` },
          { icon: Repeat2,     label: "Replayed",  value: `${data.repeatRate ?? 0}%`   },
          { icon: SkipForward, label: "Completed",  value: `${data.completionRate ?? 0}%` },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-xl border border-border p-2.5 bg-muted/20 text-center">
            <Icon className="w-4 h-4 text-primary mx-auto mb-1" />
            <p className="text-sm font-bold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Top tracks */}
      {data.topTracks?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Most replayed
          </p>
          <div className="space-y-1.5">
            {data.topTracks.slice(0, 3).map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold
                                 flex items-center justify-center shrink-0 text-[10px]">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-foreground truncate block">{t.name}</span>
                  <span className="text-muted-foreground">{t.artist}</span>
                </div>
                <span className="text-muted-foreground shrink-0">{t.count + t.repeats}×</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Most skipped */}
      {data.mostSkipped?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Skipped early
          </p>
          <div className="space-y-1">
            {data.mostSkipped.map((t, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-foreground truncate">{t.name}</span>
                <span className="text-red-400 shrink-0 ml-2">{t.count}× skipped</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default MusicImpactWidget;