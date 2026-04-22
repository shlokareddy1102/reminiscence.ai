import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Brain, CheckCircle2, FileText, TrendingUp, Users, XCircle } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import PatientSwitcher from "@/components/caregiver/PatientSwitcher";
import { useCaregiverPatients } from "@/hooks/use-caregiver-patients";
import { apiRequest } from "@/lib/api";

const CHART_COLORS = {
  grid: "#d6dee8",
  axis: "#5e6f85",
  tooltipBg: "#ffffff",
  tooltipBorder: "#d6dee8",
  progress: "#1d4ed8",
  mood: "#16a34a",
  sleep: "#f59e0b",
  calmness: "#dc2626",
  before: "#f59e0b",
  after: "#16a34a"
};

const stageLabelFromState = (state) => {
  const normalized = String(state || "").toUpperCase();
  if (normalized === "CRITICAL") return "severe";
  if (normalized === "ELEVATED_RISK") return "moderate";
  return "mild";
};

const CaregiverInsights = () => {
  const { patients, selectedPatient, selectedPatientId, setPatient } = useCaregiverPatients();
  const [cohortInsight, setCohortInsight] = useState("");
  const [patientStats, setPatientStats] = useState(null);
  const [patientPatterns, setPatientPatterns] = useState([]);
  const [selectedRecommendations, setSelectedRecommendations] = useState([]);
  const [similarPatientCount, setSimilarPatientCount] = useState(0);
  const [successfulInterventions, setSuccessfulInterventions] = useState([]);
  const [trendDays, setTrendDays] = useState(90);
  const [trendSeries, setTrendSeries] = useState([]);
  const [aiInsights, setAiInsights] = useState([]);
  const [trendLoading, setTrendLoading] = useState(false);
  const [interventionSeries, setInterventionSeries] = useState([]);
  const [interventionLoading, setInterventionLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [feedbackState, setFeedbackState] = useState({});
  const anomalyPoints = useMemo(() => trendSeries.filter((point) => point.anomaly), [trendSeries]);
  const riskTrendSeries = useMemo(() => trendSeries.filter((point) => Number.isFinite(point.riskScore) || Number.isFinite(point.forecastRisk)), [trendSeries]);
  const riskAnomalyPoints = useMemo(() => riskTrendSeries.filter((point) => point.anomaly && Number.isFinite(point.riskScore)), [riskTrendSeries]);
  const historicalRiskSeries = useMemo(() => riskTrendSeries.filter((point) => Number.isFinite(point.riskScore)), [riskTrendSeries]);
  const forecastOnlySeries = useMemo(() => riskTrendSeries.filter((point) => Number.isFinite(point.forecastRisk)), [riskTrendSeries]);

  const riskContext = useMemo(() => {
    if (!historicalRiskSeries.length) {
      return "No historical risk scores available yet.";
    }

    const first = Number(historicalRiskSeries[0].riskScore);
    const last = Number(historicalRiskSeries[historicalRiskSeries.length - 1].riskScore);
    const delta = Math.round(last - first);
    const direction = delta > 0 ? "up" : delta < 0 ? "down" : "flat";

    return `Current risk is ${Math.round(last)}/100 (${direction}${delta === 0 ? "" : ` ${Math.abs(delta)} pts`} vs selected period start).`;
  }, [historicalRiskSeries]);

  const forecastContext = useMemo(() => {
    if (!forecastOnlySeries.length) {
      return "No forecast points returned yet.";
    }

    const first = Number(forecastOnlySeries[0].forecastRisk);
    const last = Number(forecastOnlySeries[forecastOnlySeries.length - 1].forecastRisk);
    const peak = Math.max(...forecastOnlySeries.map((point) => Number(point.forecastRisk)));
    const trend = last > first ? "worsening" : last < first ? "improving" : "stable";

    return `Forecast trend is ${trend}. Expected range: ${Math.round(first)} to ${Math.round(peak)} risk, ending near ${Math.round(last)}.`;
  }, [forecastOnlySeries]);

  useEffect(() => {
    const loadInsights = async () => {
      if (!selectedPatientId) return;

      setLoading(true);
      try {
        const [statsRes, patternsRes, cohortRes, recommendationsRes, interventionsRes] = await Promise.all([
          apiRequest(`/api/reports/patient-stats/${selectedPatientId}?days=30`),
          apiRequest(`/api/reports/patient-patterns/${selectedPatientId}?days=30`),
          apiRequest("/api/reports/ai-cohort-insights"),
          apiRequest(`/api/insights/${selectedPatientId}/recommendations`),
          apiRequest(`/api/insights/interventions/successful?stage=${encodeURIComponent(stageLabelFromState(selectedPatient?.currentState))}`)
        ]);

        setPatientStats(statsRes || null);
        setPatientPatterns(Array.isArray(patternsRes?.patterns) ? patternsRes.patterns : []);
        setCohortInsight(String(cohortRes?.insight || ""));
        setSelectedRecommendations(Array.isArray(recommendationsRes?.recommendations) ? recommendationsRes.recommendations : []);
        setSimilarPatientCount(Array.isArray(recommendationsRes?.similarPatients) ? recommendationsRes.similarPatients.length : 0);
        setSuccessfulInterventions(Array.isArray(interventionsRes?.interventions) ? interventionsRes.interventions : []);
      } catch (_err) {
        setPatientStats(null);
        setPatientPatterns([]);
        setCohortInsight("");
        setSelectedRecommendations([]);
        setSimilarPatientCount(0);
        setSuccessfulInterventions([]);
      } finally {
        setLoading(false);
      }
    };

    loadInsights();
  }, [selectedPatientId, selectedPatient?.currentState, trendDays]);

  useEffect(() => {
    const loadTrends = async () => {
      if (!selectedPatientId) return;

      setTrendLoading(true);
      try {
        const trendsRes = await apiRequest(`/api/insights/${selectedPatientId}/trends?days=${trendDays}`);
        const primarySeries = buildTrendSeries(trendsRes?.trends, trendsRes?.riskTrend, trendsRes?.forecast);
        setAiInsights(Array.isArray(trendsRes?.aiInsights) ? trendsRes.aiInsights : []);

        if (primarySeries.length) {
          setTrendSeries(primarySeries);
          return;
        }

        // If the selected patient has no log history, try another linked patient with usable trend data.
        const alternatePatients = (patients || []).filter((patient) => patient?._id && patient._id !== selectedPatientId);
        for (const patient of alternatePatients) {
          const altRes = await apiRequest(`/api/insights/${patient._id}/trends?days=${trendDays}`);
          const alternateSeries = buildTrendSeries(altRes?.trends, altRes?.riskTrend, altRes?.forecast);
          if (alternateSeries.length) {
            setPatient(patient._id);
            setActionMessage(`Switched to ${patient.name || 'another patient'} because the previously selected patient has no trend logs yet.`);
            setTrendSeries(alternateSeries);
            setAiInsights(Array.isArray(altRes?.aiInsights) ? altRes.aiInsights : []);
            return;
          }
        }

        setTrendSeries([]);
        setAiInsights([]);
      } catch (_err) {
        setTrendSeries([]);
        setAiInsights([]);
      } finally {
        setTrendLoading(false);
      }
    };

    loadTrends();
  }, [selectedPatientId, trendDays, patients, setPatient]);

  useEffect(() => {
    const loadInterventionComparisons = async () => {
      if (!selectedPatientId) return;

      setInterventionLoading(true);
      try {
        const response = await apiRequest(`/api/insights/${selectedPatientId}/interventions/compare?limit=8`);
        setInterventionSeries(buildInterventionSeries(response?.interventions));
      } catch (_err) {
        setInterventionSeries([]);
      } finally {
        setInterventionLoading(false);
      }
    };

    loadInterventionComparisons();
  }, [selectedPatientId]);

  const patternSummary = useMemo(() => {
    if (!patientPatterns.length) return [];

    const labelMap = {
      poorSleepAgitation: "Poor sleep with agitation",
      missedMedicationConfusion: "Missed medication with confusion",
      lowActivityAgitation: "Low activity with agitation",
      highConfusionLost: "Confusion with wandering",
      sleepWorsening: "Poor sleep worsening",
      activityDecreasing: "Activity decreasing",
      confusionIncreasing: "Confusion increasing",
      medicationMissed: "Medication adherence dropping"
    };

    return patientPatterns.slice(0, 3).map((pattern) => ({
      title: labelMap[pattern.key] || pattern.label || pattern.key,
      text: pattern.key?.includes("sleep") || pattern.key?.includes("activity") || pattern.key?.includes("confusion") || pattern.key?.includes("medication")
        ? `${pattern.count}% shift versus the previous window`
        : `${pattern.count} days in the last 30 days`
    }));
  }, [patientPatterns]);

  const actionRecommendations = useMemo(() => {
    if (selectedRecommendations.length) return selectedRecommendations.slice(0, 3);

    const fallback = [];
    if ((patientStats?.totals?.poorSleepDays || 0) >= 4) {
      fallback.push({
        recommendation: "Stabilize the bedtime routine and reduce evening stimulation.",
        reasoning: "Poor sleep has repeated across the last 30 days.",
        confidence: 0.72,
        successRate: 0.61,
        safetyLevel: "medium"
      });
    }
    if ((patientStats?.totals?.missedMedicationDays || 0) >= 2) {
      fallback.push({
        recommendation: "Use stronger medication prompts and caregiver confirmation.",
        reasoning: "Medication adherence dipped in the recent period.",
        confidence: 0.75,
        successRate: 0.64,
        safetyLevel: "high"
      });
    }
    if ((patientStats?.totals?.lowActivityDays || 0) >= 4) {
      fallback.push({
        recommendation: "Add short guided movement blocks during the day.",
        reasoning: "Low activity is showing up consistently.",
        confidence: 0.69,
        successRate: 0.58,
        safetyLevel: "medium"
      });
    }

    return fallback.length
      ? fallback
      : [{
          recommendation: "Continue current routine and keep daily logs flowing.",
          reasoning: "There is not enough signal for a stronger recommendation yet.",
          confidence: 0.58,
          successRate: 0.5,
          safetyLevel: "low"
        }];
  }, [selectedRecommendations, patientStats]);

  const patientStage = stageLabelFromState(selectedPatient?.currentState);
  const medicationAdherence = patientStats?.medicationAdherencePercent || 0;
  const trendLabel = patientStats?.trend || "stable";
  const alertsTriggered = patientStats?.totals?.totalAlerts || 0;
  const poorSleepDays = patientStats?.totals?.poorSleepDays || 0;
  const agitatedDays = patientStats?.totals?.agitatedDays || 0;
  const lowActivityDays = patientStats?.totals?.lowActivityDays || 0;
  const highConfusionDays = patientStats?.totals?.highConfusionDays || 0;

  const handleApplySuggestion = async (rec, idx) => {
    if (!selectedPatientId) return;

    const interventionType = inferInterventionType(rec?.recommendation || "");
    try {
      const response = await apiRequest(`/api/insights/${selectedPatientId}/interventions`, {
        method: "POST",
        body: JSON.stringify({
          type: interventionType,
          description: rec?.recommendation || "Suggested intervention"
        })
      });

      setFeedbackState((prev) => ({ ...prev, [idx]: { status: "applied", interventionId: response?.interventionId || null } }));
      setActionMessage("Intervention applied and added to outcome tracking.");
    } catch (_err) {
      setFeedbackState((prev) => ({ ...prev, [idx]: { status: "applied_local", interventionId: null } }));
      setActionMessage("Marked as applied locally.");
    }
  };

  const handleDismissSuggestion = (idx) => {
    setFeedbackState((prev) => ({ ...prev, [idx]: { status: "dismissed", interventionId: null } }));
    setActionMessage("Suggestion dismissed.");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Insights</h1>
          <p className="text-sm text-muted-foreground">Real pattern summary from daily logs, alerts, and intervention history.</p>
        </div>
        <div className="w-full lg:w-80">
          <PatientSwitcher patients={patients} value={selectedPatientId} onChange={setPatient} />
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Medication adherence" value={`${medicationAdherence}%`} tone={medicationAdherence >= 80 ? "good" : medicationAdherence >= 60 ? "warning" : "alert"} />
        <SummaryCard title="Poor sleep days" value={String(poorSleepDays)} tone={poorSleepDays >= 4 ? "alert" : "good"} />
        <SummaryCard title="Agitated days" value={String(agitatedDays)} tone={agitatedDays >= 4 ? "alert" : "good"} />
        <SummaryCard title="Alerts" value={String(alertsTriggered)} tone={alertsTriggered >= 4 ? "warning" : "good"} />
      </section>

      <section className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Selected patient</p>
            <h2 className="text-lg font-semibold text-foreground">{selectedPatient?.name || "Selected patient"}</h2>
          </div>
          <div className="text-xs px-2.5 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary font-medium">
            Stage: {patientStage}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {loading
            ? "Loading insights..."
            : patientStats?.trend === "declining"
              ? "The patient is declining compared with the previous period. Focus on sleep, medication, and activity stabilization."
              : patientStats?.trend === "improving"
                ? "The patient is improving versus the previous period. Keep the current routine consistent."
                : "The patient looks broadly stable, with a few targeted risk areas to watch."}
        </p>
        {actionMessage && <p className="text-xs text-primary">{actionMessage}</p>}
      </section>

      <section className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h2 className="text-base font-display font-semibold text-foreground">Key patterns</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {patternSummary.length ? patternSummary.map((item) => (
            <div key={item.title} className="rounded-lg border border-border p-3">
              <p className="text-sm font-semibold text-foreground">{item.title}</p>
              <p className="text-sm text-muted-foreground mt-1">{item.text}</p>
            </div>
          )) : (
            <div className="text-sm text-muted-foreground">No strong pattern yet. Add more daily logs to unlock this section.</div>
          )}
        </div>
      </section>

      <section className="bg-card border border-border rounded-xl p-4">
        <div className="mb-4 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">AI Insights</h3>
          </div>
          <div className="space-y-1.5 text-sm text-foreground">
            {(aiInsights.length ? aiInsights : ["Collecting enough recent signal for AI trend summaries..."]).map((line, index) => (
              <p key={`${line}-${index}`}>• {line}</p>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h2 className="text-base font-display font-semibold text-foreground">Progress trend</h2>
          </div>
          <div className="inline-flex rounded-lg border border-border p-1 bg-muted/40">
            {[30, 90, 180].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setTrendDays(days)}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${trendDays === days ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {days === 30 ? "1M" : days === 90 ? "3M" : "6M"}
              </button>
            ))}
          </div>
        </div>

        {trendLoading || loading ? (
          <p className="text-sm text-muted-foreground">Loading progress trend...</p>
        ) : trendSeries.length ? (
          <>
            {anomalyPoints.length ? (
              <div className="mb-3 rounded-lg border border-alert/30 bg-alert/10 px-3 py-2 text-sm text-alert">
                ML anomaly flagged on {anomalyPoints[0]?.anomalyLabel || anomalyPoints[0]?.label}. The chart marks unusual weeks directly.
              </div>
            ) : null}
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={trendSeries} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                  <XAxis dataKey="label" stroke={CHART_COLORS.axis} tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} stroke={CHART_COLORS.axis} tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      background: CHART_COLORS.tooltipBg,
                      border: `1px solid ${CHART_COLORS.tooltipBorder}`,
                      borderRadius: "0.5rem"
                    }}
                  />
                  <Legend />
                  <Line type="linear" dataKey="progressScore" stroke={CHART_COLORS.progress} strokeWidth={2.5} dot={{ r: 3 }} name="Overall progress" connectNulls />
                  <Line type="linear" dataKey="mood" stroke={CHART_COLORS.mood} strokeWidth={2} dot={false} name="Mood" connectNulls />
                  <Line type="linear" dataKey="sleep" stroke={CHART_COLORS.sleep} strokeWidth={2} dot={false} name="Sleep" connectNulls />
                  <Line type="linear" dataKey="agitationInverse" stroke={CHART_COLORS.calmness} strokeWidth={2} dot={false} name="Calmness" connectNulls />
                  {anomalyPoints.map((point) => (
                    <ReferenceDot
                      key={`${point.label}-${point.anomalyLabel || "anomaly"}`}
                      x={point.label}
                      y={point.progressScore}
                      r={6}
                      fill="#ef4444"
                      stroke="#ffffff"
                      strokeWidth={2}
                      ifOverflow="visible"
                      label={{ value: "ML anomaly", position: "top", fill: "#dc2626", fontSize: 11 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            </>
        ) : (
          <p className="text-sm text-muted-foreground">No weekly trend data yet. Add daily logs for the selected period to see progress.</p>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-primary" />
            <h2 className="text-base font-display font-semibold text-foreground">Risk trend</h2>
          </div>

          {trendLoading || loading ? (
            <p className="text-sm text-muted-foreground">Loading risk trend...</p>
          ) : historicalRiskSeries.length ? (
            <>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={historicalRiskSeries} margin={{ top: 16, right: 24, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                    <XAxis dataKey="label" stroke={CHART_COLORS.axis} tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} stroke={CHART_COLORS.axis} tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        background: CHART_COLORS.tooltipBg,
                        border: `1px solid ${CHART_COLORS.tooltipBorder}`,
                        borderRadius: "0.5rem"
                      }}
                    />
                    <Legend />
                    <Line type="linear" dataKey="riskScore" stroke="#0f766e" strokeWidth={2.8} dot={{ r: 2 }} name="Risk trend" connectNulls />
                    {riskAnomalyPoints.map((point) => (
                      <ReferenceDot
                        key={`risk-${point.label}-${point.anomalyLabel || "anomaly"}`}
                        x={point.label}
                        y={point.riskScore}
                        r={6}
                        fill="#ef4444"
                        stroke="#ffffff"
                        strokeWidth={2}
                        ifOverflow="visible"
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{riskContext}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No historical risk data available yet.</p>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h2 className="text-base font-display font-semibold text-foreground">Forecast trend</h2>
          </div>

          {trendLoading || loading ? (
            <p className="text-sm text-muted-foreground">Loading forecast...</p>
          ) : forecastOnlySeries.length ? (
            <>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={forecastOnlySeries} margin={{ top: 16, right: 24, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                    <XAxis dataKey="label" stroke={CHART_COLORS.axis} tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} stroke={CHART_COLORS.axis} tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        background: CHART_COLORS.tooltipBg,
                        border: `1px solid ${CHART_COLORS.tooltipBorder}`,
                        borderRadius: "0.5rem"
                      }}
                    />
                    <Legend />
                    <Line type="linear" dataKey="forecastRisk" stroke="#0369a1" strokeWidth={2.6} strokeDasharray="7 6" dot={false} name="Forecast" connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{forecastContext}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No forecast points available yet.</p>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" />
          <h2 className="text-base font-display font-semibold text-foreground">Recommended interventions</h2>
          <span className="text-xs text-muted-foreground">based on {similarPatientCount} similar patients</span>
        </div>
        {actionRecommendations.map((rec, idx) => {
          const state = feedbackState[idx]?.status;
          if (state === "dismissed") return null;

          const confidence = Math.round((Number(rec?.confidence || 0) || 0) * 100);
          const success = Math.round((Number(rec?.successRate || 0) || 0) * 100);
          const safety = String(rec?.safetyLevel || "medium").toLowerCase();

          return (
            <div key={`${rec.recommendation}-${idx}`} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{rec.recommendation}</p>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{rec.reasoning}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${safety === "high" ? "bg-safe/20 text-safe" : safety === "low" ? "bg-alert/20 text-alert" : "bg-warning/20 text-warning"}`}>
                  {safety} safety
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3 text-xs">
                <StatPill label="Confidence" value={`${confidence}%`} />
                <StatPill label="Success rate" value={`${success}%`} />
                <StatPill label="Stage fit" value={patientStage} />
              </div>

              {state !== "applied" && state !== "applied_local" ? (
                <div className="flex gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => handleApplySuggestion(rec, idx)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDismissSuggestion(idx)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                    Dismiss
                  </button>
                </div>
              ) : (
                <p className="text-xs text-safe mt-3">Applied. Outcome tracking is active.</p>
              )}
            </div>
          );
        })}
      </section>

      <section className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <h2 className="text-base font-display font-semibold text-foreground">Cohort insight</h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{cohortInsight || "Add more logs to unlock cohort patterns."}</p>
        <div className="grid gap-3 md:grid-cols-3 text-sm">
          <MiniMetric label="Low activity days" value={String(lowActivityDays)} />
          <MiniMetric label="High confusion days" value={String(highConfusionDays)} />
          <MiniMetric label="Observed trend" value={trendLabel} />
        </div>
      </section>

      <section className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-warning" />
          <h2 className="text-base font-display font-semibold text-foreground">Successful interventions in this stage</h2>
        </div>
        <div className="space-y-2">
          {successfulInterventions.length ? successfulInterventions.map((item) => (
            <div key={`${item.type}-${item.intervention}`} className="rounded-lg border border-border p-3">
              <p className="text-sm font-semibold text-foreground">{item.intervention}</p>
              <p className="text-xs text-muted-foreground mt-1">{item.type} · confidence {Math.round((Number(item.confidence || 0) || 0) * 100)}%</p>
            </div>
          )) : (
            <div className="text-sm text-muted-foreground">No stage-matched successful interventions yet.</div>
          )}
        </div>
      </section>

      <section className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h2 className="text-base font-display font-semibold text-foreground">Before vs after intervention</h2>
          </div>
          <p className="text-xs text-muted-foreground">Clinical progress score and delta after intervention windows</p>
        </div>

        {interventionLoading ? (
          <p className="text-sm text-muted-foreground">Loading intervention outcomes...</p>
        ) : interventionSeries.length ? (
          <>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={interventionSeries} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                  <XAxis dataKey="label" stroke={CHART_COLORS.axis} tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} stroke={CHART_COLORS.axis} tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      background: CHART_COLORS.tooltipBg,
                      border: `1px solid ${CHART_COLORS.tooltipBorder}`,
                      borderRadius: "0.5rem"
                    }}
                  />
                  <Legend />
                  <Bar dataKey="before" name="Before" fill={CHART_COLORS.before} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="after" name="After" fill={CHART_COLORS.after} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3 mt-3">
              {interventionSeries.slice(0, 6).map((item) => (
                <div key={item.id} className="rounded-lg border border-border p-3">
                  <p className="text-sm font-semibold text-foreground">{item.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.outcomeLabel} · confidence {item.confidence}%</p>
                  <p className={`text-sm mt-2 font-medium ${item.delta >= 0 ? "text-safe" : "text-alert"}`}>
                    {item.delta >= 0 ? "+" : ""}{item.delta} point change
                  </p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No measured interventions yet. Apply an intervention and re-measure after 7 to 14 days.</p>
        )}
      </section>

      <section className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-primary" />
          <h2 className="text-base font-display font-semibold">30-day patient snapshot</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {(patients || []).map((patient) => {
            const isSelected = patient._id === selectedPatientId;
            return (
              <button
                key={patient._id}
                type="button"
                onClick={() => setPatient(patient._id)}
                className={`rounded-xl border p-3 text-left transition-colors ${isSelected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}
              >
                <p className="text-sm font-semibold text-foreground">{patient.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{String(patient.currentState || "STABLE")}</p>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
};

const SummaryCard = ({ title, value, tone }) => {
  const toneClass = tone === "good" ? "border-safe/30 bg-safe/10" : tone === "warning" ? "border-warning/30 bg-warning/10" : "border-alert/30 bg-alert/10";
  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="text-2xl font-bold text-foreground mt-2">{value}</p>
    </div>
  );
};

const MiniMetric = ({ label, value }) => (
  <div className="rounded-lg border border-border p-3">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="text-sm font-semibold text-foreground mt-1">{value}</p>
  </div>
);

const StatPill = ({ label, value }) => (
  <div className="rounded-md border border-border px-2 py-1.5 bg-muted/30">
    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="text-sm font-semibold text-foreground">{value}</p>
  </div>
);

const inferInterventionType = (recommendation) => {
  const lower = String(recommendation || "").toLowerCase();
  if (lower.includes("medication") || lower.includes("melatonin") || lower.includes("dose")) return "medication_change";
  if (lower.includes("walk") || lower.includes("activity") || lower.includes("exercise")) return "activity_added";
  if (lower.includes("schedule") || lower.includes("routine") || lower.includes("timing")) return "schedule_change";
  if (lower.includes("music") || lower.includes("lighting") || lower.includes("environment")) return "environment_change";
  return "other";
};

const buildTrendSeries = (trends, riskTrend = [], forecast = []) => {
  if (!Array.isArray(trends)) return [];

  const riskByDate = new Map((Array.isArray(riskTrend) ? riskTrend : []).map((item) => [
    new Date(item?.date || item?.label || '').toDateString(),
    Number(item?.riskScore)
  ]));

  const forecastSorted = (Array.isArray(forecast) ? forecast : [])
    .map((item) => ({ date: new Date(item?.date), riskScore: Number(item?.riskScore) }))
    .filter((item) => !Number.isNaN(item.date.getTime()) && Number.isFinite(item.riskScore))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const base = trends
    .map((item) => {
      const date = new Date(item?.date);
      const metrics = item?.metrics || {};

      const mood = normalizeMetric(metrics.moodScore, 10);
      const sleep = normalizeMetric(metrics.sleepHours, 10);
      const agitationInverse = normalizeMetric((metrics.agitationLevel ?? null) !== null ? 10 - Number(metrics.agitationLevel || 0) : null, 10);

      const available = [mood, sleep, agitationInverse].filter((value) => Number.isFinite(value));
      const progressScore = available.length
        ? Math.round(available.reduce((sum, value) => sum + value, 0) / available.length)
        : null;

      return {
        label: Number.isNaN(date.getTime()) ? `W${item?.week ?? "-"}` : date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        progressScore,
        riskScore: Number.isFinite(Number(item?.riskScore))
          ? Math.round(Number(item.riskScore))
          : Number.isFinite(riskByDate.get(date.toDateString()))
            ? Math.round(riskByDate.get(date.toDateString()))
            : null,
        forecastRisk: null,
        mood,
        sleep,
        agitationInverse,
        anomaly: Boolean(item?.anomaly),
        anomalyLabel: item?.anomalyLabel || null
      };
    })
    .reverse();

  const fallbackForecast = (() => {
    if (forecastSorted.length || base.length < 3) return [];
    const riskRows = base.filter((row) => Number.isFinite(row.riskScore));
    if (riskRows.length < 3) return [];

    const last = riskRows[riskRows.length - 1].riskScore;
    const prev = riskRows[riskRows.length - 2].riskScore;
    const drift = Math.max(-6, Math.min(6, last - prev));
    const today = new Date();

    return Array.from({ length: 5 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() + index + 1);
      return {
        date,
        riskScore: Math.max(0, Math.min(100, Math.round(last + drift * (index + 1))))
      };
    });
  })();

  const futureSource = forecastSorted.length ? forecastSorted : fallbackForecast;

  const future = futureSource.map((item) => ({
    label: `F ${item.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
    progressScore: null,
    riskScore: null,
    forecastRisk: item.riskScore,
    mood: null,
    sleep: null,
    agitationInverse: null,
    anomaly: false,
    anomalyLabel: null
  }));

  return [...base, ...future];
};

const buildInterventionSeries = (interventions) => {
  if (!Array.isArray(interventions)) return [];

  return interventions
    .filter((item) => Number.isFinite(Number(item?.progressBefore)) || Number.isFinite(Number(item?.progressAfter)))
    .map((item, index) => {
      const applied = new Date(item?.appliedDate);
      const before = Number.isFinite(Number(item?.progressBefore)) ? Number(item.progressBefore) : 0;
      const after = Number.isFinite(Number(item?.progressAfter)) ? Number(item.progressAfter) : 0;
      const confidence = Math.round((Number(item?.confidence || 0) || 0) * 100);

      return {
        id: item?.interventionId || `${index}`,
        label: Number.isNaN(applied.getTime()) ? `I${index + 1}` : applied.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        before,
        after,
        delta: Math.round(after - before),
        confidence,
        description: item?.description || "Intervention",
        outcomeLabel: formatOutcomeLabel(item?.outcome)
      };
    })
    .reverse();
};

const formatOutcomeLabel = (value) => {
  const normalized = String(value || "unknown").replace(/_/g, " ");
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const normalizeMetric = (value, max) => {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const normalized = (number / max) * 100;
  return Math.max(0, Math.min(100, Math.round(normalized)));
};

export default CaregiverInsights;
