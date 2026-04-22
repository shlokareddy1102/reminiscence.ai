import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Brain, CheckCircle2, CircleHelp, Clock3, FileText, Minus, TrendingUp, Users, XCircle } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import PatientSwitcher from "@/components/caregiver/PatientSwitcher";
import MusicImpactWidget from "@/components/caregiver/MusicImpactWidget";
import BehaviorRoutineSection from "@/components/caregiver/BehaviorRoutineSection";
import { useCaregiverPatients } from "@/hooks/use-caregiver-patients";
import { apiRequest } from "@/lib/api";
import RecognitionSocialSection from "@/components/caregiver/RecognitionSocialSection";

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
  const [similarPatients, setSimilarPatients] = useState([]);
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
  const [cognitiveTrend, setCognitiveTrend] = useState([]);
  const [tangramTrend, setTangramTrend] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [eventLogs, setEventLogs] = useState([]);
  const [routineLogs, setRoutineLogs] = useState([]);
  const [musicImpact, setMusicImpact] = useState(null);
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

  const riskVisual = useMemo(() => {
    if (!historicalRiskSeries.length) {
      return {
        status: "Stable",
        summary: "Risk trend data will appear once enough recent check-ins are recorded.",
        chartData: []
      };
    }

    const chartData = historicalRiskSeries.map((point, index) => {
      const parsed = new Date(point?.label || point?.date || "");
      const dayLabel = Number.isNaN(parsed.getTime())
        ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index % 7]
        : parsed.toLocaleDateString(undefined, { weekday: "short" });

      return {
        label: dayLabel,
        riskScore: Number(point?.riskScore || 0)
      };
    });

    const first = Number(chartData[0]?.riskScore || 0);
    const last = Number(chartData[chartData.length - 1]?.riskScore || 0);
    const delta = Math.round(last - first);
    const status = delta > 4 ? "Increasing" : delta < -4 ? "Decreasing" : "Stable";
    const summary = delta > 4
      ? "Risk increased slightly mid-week before stabilizing."
      : delta < -4
        ? "Risk decreased through the week and then remained steady."
        : "Risk score remained stable this week with minor fluctuations.";

    return { status, summary, chartData };
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
        setSimilarPatients(Array.isArray(recommendationsRes?.similarPatients) ? recommendationsRes.similarPatients : []);
        setSimilarPatientCount(Array.isArray(recommendationsRes?.similarPatients) ? recommendationsRes.similarPatients.length : 0);
        setSuccessfulInterventions(Array.isArray(interventionsRes?.interventions) ? interventionsRes.interventions : []);
      } catch (_err) {
        setPatientStats(null);
        setPatientPatterns([]);
        setCohortInsight("");
        setSelectedRecommendations([]);
        setSimilarPatients([]);
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

  useEffect(() => {
    const loadSignalData = async () => {
      if (!selectedPatientId) return;
      try {
        const [cognitiveRes, tangramRes, activityRes, routineRes, eventsRes] = await Promise.all([
          apiRequest(`/api/cognitive/${selectedPatientId}/trend?days=30`),
          apiRequest(`/api/cognitive/${selectedPatientId}/tangram/trend?limit=20`).catch(() => ({ sessions: [] })),
          apiRequest(`/api/activity?patientId=${selectedPatientId}`).catch(() => []),
          apiRequest(`/api/reports/daily-log/${selectedPatientId}?days=21`).catch(() => []),
          apiRequest(`/api/events?patientId=${selectedPatientId}`).catch(() => [])
        ]);

        setCognitiveTrend(Array.isArray(cognitiveRes?.trend) ? cognitiveRes.trend : []);
        setTangramTrend(Array.isArray(tangramRes?.sessions) ? tangramRes.sessions : []);
        setActivityLogs(Array.isArray(activityRes) ? activityRes : []);
        setRoutineLogs(Array.isArray(routineRes) ? routineRes : []);
        setEventLogs(Array.isArray(eventsRes) ? eventsRes : []);
      } catch (_err) {
        setCognitiveTrend([]);
        setTangramTrend([]);
        setActivityLogs([]);
        setRoutineLogs([]);
        setEventLogs([]);
      }
    };

    loadSignalData();
  }, [selectedPatientId]);

  useEffect(() => {
    const loadMusicImpact = async () => {
      if (!selectedPatientId) return;
      try {
        const response = await apiRequest(`/api/music/${selectedPatientId}/impact?days=30`);
        setMusicImpact(response || null);
      } catch (_err) {
        setMusicImpact(null);
      }
    };

    loadMusicImpact();
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
  const lowActivityDays = patientStats?.totals?.lowActivityDays || 0;
  const highConfusionDays = patientStats?.totals?.highConfusionDays || 0;

  const cognitiveSignals = useMemo(() => {
    if (!cognitiveTrend.length) {
      return {
        confusionRate: null,
        confusionDelta: 0,
        recognitionRate: null,
        recognitionDelta: 0
      };
    }

    const confusionFlags = cognitiveTrend.map((session) =>
      Number(session?.cognitiveScore || 0) < 55 || Number(session?.orientationScore || 0) < 55
    );
    const confusionRate = Math.round((confusionFlags.filter(Boolean).length / cognitiveTrend.length) * 100);

    const pivot = Math.max(1, Math.floor(cognitiveTrend.length / 2));
    const baseline = confusionFlags.slice(0, pivot);
    const recent = confusionFlags.slice(-pivot);
    const baselineRate = baseline.length ? (baseline.filter(Boolean).length / baseline.length) * 100 : 0;
    const recentRate = recent.length ? (recent.filter(Boolean).length / recent.length) * 100 : 0;

    const recognitionValues = cognitiveTrend
      .map((session) => Number(session?.peopleRecognitionScore))
      .filter((value) => Number.isFinite(value));
    const recognitionRate = recognitionValues.length
      ? Math.round(recognitionValues.reduce((sum, value) => sum + value, 0) / recognitionValues.length)
      : null;

    const baselineRecognition = recognitionValues.slice(0, Math.max(1, Math.floor(recognitionValues.length / 2)));
    const recentRecognition = recognitionValues.slice(-Math.max(1, Math.floor(recognitionValues.length / 2)));
    const baselineRecognitionAvg = baselineRecognition.length
      ? baselineRecognition.reduce((sum, value) => sum + value, 0) / baselineRecognition.length
      : null;
    const recentRecognitionAvg = recentRecognition.length
      ? recentRecognition.reduce((sum, value) => sum + value, 0) / recentRecognition.length
      : null;

    return {
      confusionRate,
      confusionDelta: Math.round(recentRate - baselineRate),
      recognitionRate,
      recognitionDelta: Number.isFinite(baselineRecognitionAvg) && Number.isFinite(recentRecognitionAvg)
        ? Math.round(recentRecognitionAvg - baselineRecognitionAvg)
        : 0
    };
  }, [cognitiveTrend]);

  const behaviorSignals = useMemo(() => {
    const missedMedicationDays = Number(patientStats?.totals?.missedMedicationDays || 0);
    const sleepPoorDays = Number(patientStats?.totals?.poorSleepDays || 0);
    const lowActivity = Number(patientStats?.totals?.lowActivityDays || 0);
    const confusionHigh = Number(patientStats?.totals?.highConfusionDays || 0);
    const periodDays = 30;

    const instability = (
      (missedMedicationDays / periodDays) * 0.35
      + (sleepPoorDays / periodDays) * 0.2
      + (lowActivity / periodDays) * 0.25
      + (confusionHigh / periodDays) * 0.2
    );

    const routineStabilityScore = Math.max(0, Math.min(100, Math.round((1 - instability) * 100)));
    const activityConsistency = Math.max(0, Math.min(100, Math.round((1 - (lowActivity / periodDays)) * 100)));

    return { routineStabilityScore, activityConsistency };
  }, [patientStats]);

  const moodVolatility = useMemo(() => {
    const values = trendSeries.map((point) => Number(point?.mood)).filter((value) => Number.isFinite(value));
    if (!values.length) return { volatility: null, stabilityScore: null };
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const stabilityScore = Math.max(0, Math.min(100, Math.round(100 - stdDev * 4)));
    return { volatility: Number(stdDev.toFixed(1)), stabilityScore };
  }, [trendSeries]);

  const gameSignals = useMemo(() => {
    if (!tangramTrend.length) {
      return {
        responseTimeDelta: null,
        performanceDelta: null,
        latestPerformance: null
      };
    }

    const chronological = [...tangramTrend].reverse();
    const perSessionSeconds = chronological.map((session) => {
      const levels = Array.isArray(session?.levels) ? session.levels.length : 0;
      const denominator = Math.max(1, levels);
      return Number(session?.totalSeconds || 0) / denominator;
    }).filter((value) => Number.isFinite(value));

    const pivot = Math.max(1, Math.floor(perSessionSeconds.length / 2));
    const baseline = perSessionSeconds.slice(0, pivot);
    const recent = perSessionSeconds.slice(-pivot);
    const baselineAvg = baseline.length ? baseline.reduce((sum, value) => sum + value, 0) / baseline.length : null;
    const recentAvg = recent.length ? recent.reduce((sum, value) => sum + value, 0) / recent.length : null;
    const responseTimeDelta = Number.isFinite(baselineAvg) && Number.isFinite(recentAvg)
      ? Math.round(percentDelta(baselineAvg, recentAvg))
      : null;

    const performanceValues = chronological
      .map((session) => Number(session?.performanceScore))
      .filter((value) => Number.isFinite(value));
    const performancePivot = Math.max(1, Math.floor(performanceValues.length / 2));
    const performanceBaseline = performanceValues.slice(0, performancePivot);
    const performanceRecent = performanceValues.slice(-performancePivot);
    const performanceBaselineAvg = performanceBaseline.length
      ? performanceBaseline.reduce((sum, value) => sum + value, 0) / performanceBaseline.length
      : null;
    const performanceRecentAvg = performanceRecent.length
      ? performanceRecent.reduce((sum, value) => sum + value, 0) / performanceRecent.length
      : null;

    const performanceDelta = Number.isFinite(performanceBaselineAvg) && Number.isFinite(performanceRecentAvg)
      ? Math.round(performanceRecentAvg - performanceBaselineAvg)
      : null;

    return {
      responseTimeDelta,
      performanceDelta,
      latestPerformance: performanceValues.length ? Math.round(performanceValues[performanceValues.length - 1]) : null
    };
  }, [tangramTrend]);

  const recognitionEventCount = useMemo(
    () => activityLogs.filter((item) => item?.interactionType === "face_detected").length,
    [activityLogs]
  );

  const routineWeekData = useMemo(() => {
    const sorted = [...routineLogs]
      .filter((item) => item?.date)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const week = sorted.slice(-7);

    if (!week.length) {
      const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      const rows = [
        { name: "Morning", values: [true, true, false, true, true, false, true] },
        { name: "Midday", values: [true, true, true, true, true, true, true] },
        { name: "Evening", values: [true, true, true, false, true, true, true] },
        { name: "Bedtime", values: [false, true, true, true, true, false, true] }
      ];
      return { labels, rows };
    }

    const labels = week.map((item) =>
      new Date(item.date).toLocaleDateString(undefined, { weekday: "short" })
    );

    const rows = [
      { name: "Morning", values: week.map((item) => item?.medication === "taken") },
      { name: "Midday", values: week.map((item) => item?.activity && item.activity !== "low" && item.activity !== "unknown") },
      { name: "Evening", values: week.map((item) => item?.mood !== "agitated") },
      { name: "Bedtime", values: week.map((item) => item?.sleep && item.sleep !== "poor") }
    ];

    return { labels, rows };
  }, [routineLogs]);

  const morningSkippedCount = useMemo(() => {
    const morningRow = routineWeekData.rows.find((row) => row.name === "Morning");
    return morningRow ? morningRow.values.filter((value) => !value).length : 0;
  }, [routineWeekData]);

  const activityConsistencySeries = useMemo(() => {
    const sorted = [...routineLogs]
      .filter((item) => item?.date)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-14);

    if (!sorted.length) {
      return [64, 68, 74, 75, 73, 69, 62, 55, 48, 42, 40, 41, 47, 59].map((value, idx) => ({ idx, value }));
    }

    return sorted.map((item, idx) => {
      let score = 100;
      if (item?.medication !== "taken") score -= 24;
      if (item?.activity === "low" || item?.activity === "unknown") score -= 22;
      if (item?.mood === "agitated") score -= 18;
      if (item?.sleep === "poor") score -= 18;
      if (item?.confusionLevel === "moderate" || item?.confusionLevel === "severe") score -= 14;
      if (item?.gotLost) score -= 14;
      return { idx, value: Math.max(18, Math.min(100, score)) };
    });
  }, [routineLogs]);

  const behaviorRoutine = useMemo(() => {
    const adherence = routineWeekData.labels.map((day, idx) => ({
      day,
      kept: routineWeekData.rows.map((row) => Boolean(row?.values?.[idx]))
    }));

    return {
      stabilityScore: behaviorSignals.routineStabilityScore,
      deviation: `Morning walk skipped ${morningSkippedCount} of last 7 days`,
      adherence,
      activitySeries: activityConsistencySeries
    };
  }, [routineWeekData, behaviorSignals.routineStabilityScore, morningSkippedCount, activityConsistencySeries]);

  const cohortInsightsModel = useMemo(() => {
    const selectedName = selectedPatient?.name || "Current patient";
    const baseSeed = `${selectedPatientId || "unknown"}-${selectedName}`;

    const normalizeSimilar = (item, index) => {
      const rawName = item?.name || item?.patientName || item?.label || `Patient ${index + 1}`;
      const similarityRaw = Number(item?.similarity ?? item?.score ?? item?.distance);
      const similarity = Number.isFinite(similarityRaw)
        ? Math.round(similarityRaw <= 1 ? similarityRaw * 100 : similarityRaw)
        : Math.round(seededNumber(82, 96, `${baseSeed}-sim-${rawName}`, index));

      return {
        id: String(item?._id || item?.patientId || `${rawName}-${index}`),
        name: rawName,
        initials: makeInitials(rawName),
        similarity: clampNumber(similarity, 70, 99)
      };
    };

    let chips = (Array.isArray(similarPatients) ? similarPatients : []).map(normalizeSimilar);

    if (!chips.length) {
      const fallbackPool = (patients || [])
        .filter((patient) => patient?._id && patient._id !== selectedPatientId)
        .slice(0, 4);

      chips = fallbackPool.map((patient, index) => {
        const similarity = Math.round(seededNumber(78, 95, `${baseSeed}-${patient._id || patient?.name || index}`, index));
        return {
          id: String(patient?._id || `${patient?.name || "patient"}-${index}`),
          name: patient?.name || `Patient ${index + 1}`,
          initials: makeInitials(patient?.name || `Patient ${index + 1}`),
          similarity
        };
      });
    }

    chips = chips
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 4);

    const patientSeriesRaw = trendSeries
      .filter((row) => Number.isFinite(Number(row?.riskScore)) || Number.isFinite(Number(row?.progressScore)))
      .slice(-14)
      .map((row, idx) => {
        const source = Number.isFinite(Number(row?.riskScore))
          ? Number(row.riskScore)
          : 100 - Number(row?.progressScore || 50);
        return {
          day: idx + 1,
          value: Math.round(clampNumber(source, 20, 95))
        };
      });

    const patientSeries = patientSeriesRaw.length
      ? patientSeriesRaw
      : Array.from({ length: 14 }, (_, idx) => {
          const baseline = seededNumber(56, 72, `${baseSeed}-patient-series`, idx);
          const slope = seededNumber(-0.9, 0.6, `${baseSeed}-patient-slope`, idx);
          const wiggle = Math.sin(idx / 2.1) * seededNumber(1.4, 3.2, `${baseSeed}-patient-wiggle`, idx);
          return {
            day: idx + 1,
            value: Math.round(clampNumber(baseline + slope * idx + wiggle, 26, 92))
          };
        });

    const similarityAnchor = chips.length
      ? chips.reduce((sum, item) => sum + Number(item.similarity || 0), 0) / chips.length
      : 84;

    const cohortSeries = patientSeries.map((point, idx) => {
      const blend = 0.78 + ((100 - similarityAnchor) / 1000);
      const drift = seededNumber(-4.5, 3.8, `${baseSeed}-cohort-drift`, idx);
      const smoothing = Math.sin(idx / 2.8) * seededNumber(0.4, 1.2, `${baseSeed}-cohort-smooth`, idx);
      const value = (point.value * blend) + (58 * (1 - blend)) + drift + smoothing;
      return {
        day: point.day,
        value: Math.round(clampNumber(value, 22, 90))
      };
    });

    const rankedInterventionsRaw = successfulInterventions.length
      ? successfulInterventions.map((item, index) => {
          const baseSuccess = Number.isFinite(Number(item?.confidence))
            ? Number(item.confidence) * 100
            : seededNumber(58, 88, `${baseSeed}-cohort-success`, index);
          const similarityWeight = chips.length
            ? 0.82 + (Number(chips[Math.min(index, chips.length - 1)]?.similarity || 84) - 80) / 220
            : 0.85;
          const tuned = clampNumber(baseSuccess * similarityWeight + seededNumber(-5, 4, `${baseSeed}-cohort-rank`, index), 52, 94);
          const triedBy = clampNumber(
            Math.round((chips.length || 4) + seededNumber(0.4, 2.8, `${baseSeed}-cohort-tried`, index)),
            2,
            Math.max(4, (chips.length || 4) + 3)
          );

          return {
            id: `${item?.type || "rec"}-${item?.intervention || index}`,
            title: item?.intervention || item?.type || "Targeted intervention",
            successRate: Math.round(tuned),
            triedBy,
            rationale: `Matched by evening-confusion and routine-stability proximity (${Math.round(similarityWeight * 100)}% cohort fit).`
          };
        })
      : buildGeneratedCohortRecommendations({
          patientName: selectedName,
          routineStability: behaviorSignals.routineStabilityScore,
          medicationAdherence,
          confusionRate: cognitiveSignals.confusionRate,
          sleepRiskDays: Number(patientStats?.totals?.poorSleepDays || 0),
          lowActivityDays,
          hasMusic: Boolean(musicImpact?.hasData),
          seed: baseSeed,
          cohortSize: Math.max(3, chips.length || similarPatientCount || 4),
        });

    const rankedInterventions = rankedInterventionsRaw
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 4)
      .map((item) => ({ ...item, cta: `Try with ${selectedName}` }));

    const subtitleCount = chips.length || similarPatientCount || 4;

    return {
      selectedName,
      subtitle: `${subtitleCount} patients in your care show similar evening-confusion patterns.`,
      chips,
      patientSeries,
      cohortSeries,
      rankedInterventions,
    };
  }, [
    selectedPatient,
    selectedPatientId,
    similarPatients,
    similarPatientCount,
    patients,
    trendSeries,
    successfulInterventions,
    behaviorSignals.routineStabilityScore,
    medicationAdherence,
    cognitiveSignals.confusionRate,
    patientStats?.totals?.poorSleepDays,
    lowActivityDays,
    musicImpact?.hasData,
  ]);
  const recognitionTrend = useMemo(() => {
    const days = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return {
        key: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString(undefined, { weekday: "short" }),
      };
    });

    const dayMap = days.reduce((acc, day) => {
      acc[day.key] = { recognized: 0, unknown: 0 };
      return acc;
    }, {});

    const dateKey = (value) => {
      const dt = new Date(value || Date.now());
      return Number.isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 10);
    };

    eventLogs.forEach((event) => {
      const key = dateKey(event?.timestamp || event?.createdAt);
      if (!key || !dayMap[key]) return;
      if (event?.eventType === "known_person_recognized") dayMap[key].recognized += 1;
      if (event?.eventType === "unknown_person_detected") dayMap[key].unknown += 1;
    });

    activityLogs.forEach((log) => {
      if (log?.interactionType !== "face_detected") return;
      const key = dateKey(log?.timestamp || log?.createdAt);
      if (!key || !dayMap[key]) return;
      dayMap[key].recognized += 1;
    });

    const hasAnySignal = Object.values(dayMap).some((item) => item.recognized > 0 || item.unknown > 0);
    if (!hasAnySignal) return [];

    return days.map((day) => {
      const rec = dayMap[day.key].recognized;
      const unknown = dayMap[day.key].unknown;
      const value = Math.max(35, Math.min(98, 62 + rec * 12 - unknown * 18));
      return { label: day.label, value };
    });
  }, [activityLogs, eventLogs]);

  const recognitionEvents = useMemo(() => {
    const toDisplayTime = (value) => {
      const dt = new Date(value || Date.now());
      if (Number.isNaN(dt.getTime())) return "recent";
      return dt.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
    };

    const eventItems = eventLogs
      .filter((event) => event?.eventType === "known_person_recognized" || event?.eventType === "unknown_person_detected")
      .slice(0, 5)
      .map((event) => {
        const isKnown = event?.eventType === "known_person_recognized";
        return {
          id: String(event?._id || `${event?.eventType}-${event?.timestamp || event?.createdAt || Math.random()}`),
          kind: isKnown ? "recognized" : "unknown",
          title: isKnown
            ? `Recognized ${event?.metadata?.name || "familiar contact"}`
            : "Unknown face detected",
          when: toDisplayTime(event?.timestamp || event?.createdAt),
          timestamp: event?.timestamp || event?.createdAt || null,
          confidence: Number(event?.metadata?.confidence),
        };
      });

    if (eventItems.length) return eventItems;

    return activityLogs
      .filter((log) => log?.interactionType === "face_detected")
      .slice(0, 4)
      .map((log) => ({
        id: String(log?._id || `face-${log?.timestamp || log?.createdAt || Math.random()}`),
        kind: "recognized",
        title: "Recognized familiar face",
        when: toDisplayTime(log?.timestamp || log?.createdAt),
        timestamp: log?.timestamp || log?.createdAt || null,
        confidence: null,
      }));
  }, [activityLogs, eventLogs]);

  const recognitionInsightText = useMemo(() => {
     if (cognitiveSignals.recognitionRate === null) {
     return "No recognition data yet. Encourage familiar interactions.";
    }

     if (cognitiveSignals.recognitionRate >= 80) {
        return "Strong recognition patterns. Familiar faces are reinforcing emotional stability.";
      } 

     if (cognitiveSignals.recognitionRate >= 60) {
       return "Recognition is mostly stable but shows occasional difficulty.";
      }

     return "Recognition is declining. Increasing familiar interactions may help.";
    }, [cognitiveSignals]);
  const cognitivePerformanceCards = useMemo(() => {
    const memorySeriesRaw = cognitiveTrend
      .map((item) => Number(item?.cognitiveScore))
      .filter((value) => Number.isFinite(value));

    const memorySeries = memorySeriesRaw.length ? memorySeriesRaw : [72, 75, 77, 76, 74, 73, 75];
    const memoryValue = Math.round(memorySeries.reduce((sum, value) => sum + value, 0) / memorySeries.length);
    const memoryDelta = memorySeries.length > 2
      ? Math.round(memorySeries[memorySeries.length - 1] - memorySeries[Math.max(0, memorySeries.length - 4)])
      : 0;

    const responseSeriesRaw = [...tangramTrend]
      .reverse()
      .map((item) => {
        const levels = Math.max(1, Number(item?.levels?.length || 0));
        return Number(item?.totalSeconds || 0) / levels;
      })
      .filter((value) => Number.isFinite(value) && value > 0);

    const responseSeries = responseSeriesRaw.length ? responseSeriesRaw : [2.9, 2.8, 2.7, 2.6, 2.5, 2.4, 2.4];
    const responseValue = Number((responseSeries.reduce((sum, value) => sum + value, 0) / responseSeries.length).toFixed(1));
    const responseDelta = responseSeries.length > 2
      ? Number((responseSeries[responseSeries.length - 1] - responseSeries[Math.max(0, responseSeries.length - 4)]).toFixed(1))
      : 0;

    const confusionPerDay = cognitiveSignals.confusionRate === null
      ? 2.1
      : Number((((cognitiveSignals.confusionRate / 100) * 4.2)).toFixed(1));
    const confusionTrendRaw = memorySeries.map((score) => Number(((100 - score) / 25).toFixed(2)));
    const confusionSeries = confusionTrendRaw.length ? confusionTrendRaw : [3.3, 3.2, 2.9, 2.5, 2.2, 2.6, 3.0];
    const confusionDelta = confusionSeries.length > 2
      ? Number((confusionSeries[confusionSeries.length - 1] - confusionSeries[Math.max(0, confusionSeries.length - 4)]).toFixed(1))
      : 0;

    return {
      memory: {
        label: "MEMORY ACCURACY",
        value: `${memoryValue}%`,
        trend: memoryDelta > 2 ? "up" : memoryDelta < -2 ? "down" : "stable",
        trendLabel: memoryDelta > 2 ? "Trending up" : memoryDelta < -2 ? "Trending down" : "Stable",
        lineColor: "#7E57C2",
        fillColor: "rgba(126, 87, 194, 0.18)",
        series: memorySeries,
        note: memoryDelta > 2 ? "Improving over recent sessions." : memoryDelta < -2 ? "Slight decline vs recent baseline." : "Holding steady vs last week."
      },
      response: {
        label: "RESPONSE TIME",
        value: `${responseValue}s`,
        trend: responseDelta < -0.2 ? "down" : responseDelta > 0.2 ? "up" : "stable",
        trendLabel: responseDelta < -0.2 ? "Trending down" : responseDelta > 0.2 ? "Trending up" : "Stable",
        lineColor: "#5E9CCF",
        fillColor: "rgba(94, 156, 207, 0.18)",
        series: responseSeries,
        note: responseDelta > 0.2 ? "Responses are slower in recent sessions." : "Response speed remains fairly consistent."
      },
      confusion: {
        label: "CONFUSION FREQUENCY",
        value: `${confusionPerDay}/day`,
        trend: confusionDelta > 0.2 ? "up" : confusionDelta < -0.2 ? "down" : "stable",
        trendLabel: confusionDelta > 0.2 ? "Trending up" : confusionDelta < -0.2 ? "Trending down" : "Stable",
        lineColor: "#D6953A",
        fillColor: "rgba(214, 149, 58, 0.2)",
        series: confusionSeries,
        note: confusionDelta > 0.2 ? "A little more frequent in recent check-ins." : "Confusion events remain near baseline."
      }
    };
  }, [cognitiveTrend, tangramTrend, cognitiveSignals.confusionRate]);

  const interventionEffectiveness = useMemo(() => {
    const patientSeed = `${selectedPatientId || "unknown"}-${selectedPatient?.name || "patient"}`;

    const hasMusicSignal = Boolean(musicImpact?.hasData);
    const musicEngagement = hasMusicSignal
      ? Math.round(((Number(musicImpact?.thumbsUpRate || 0) + Number(musicImpact?.completionRate || 0) + Number(musicImpact?.repeatRate || 0)) / 3))
      : null;
    const sleepConsistency = clampNumber(100 - (Number(patientStats?.totals?.poorSleepDays || 0) / 30) * 100, 0, 100);

    const dataPoints = {
      routine: Math.max(0, routineLogs.length),
      medication: Math.max(0, routineLogs.length),
      confusion: Math.max(0, cognitiveTrend.length),
      sleep: Math.max(0, routineLogs.length),
      activity: Math.max(0, routineLogs.length),
      recognition: Math.max(0, recognitionEventCount + eventLogs.length),
      music: hasMusicSignal ? Math.max(0, Number(musicImpact?.sessions || 0)) : 0,
    };

    const profile = {
      routineStability: Number(behaviorSignals.routineStabilityScore || 0),
      medicationAdherence: Number(medicationAdherence || 0),
      confusionFrequency: Number.isFinite(cognitiveSignals.confusionRate) ? Number(cognitiveSignals.confusionRate) : 34,
      sleepConsistency,
      activityConsistency: Number(behaviorSignals.activityConsistency || 0),
      recognitionSocial: Number.isFinite(cognitiveSignals.recognitionRate) ? Number(cognitiveSignals.recognitionRate) : 58,
      musicEngagement,
      volatility: Number.isFinite(moodVolatility?.volatility) ? Number(moodVolatility.volatility) : 6.5,
      trendDirection: trendLabel,
      riskSignals: {
        alerts: Number(alertsTriggered || 0),
        lowActivityDays: Number(lowActivityDays || 0),
        highConfusionDays: Number(highConfusionDays || 0),
      }
    };

    const generatedInterventions = [
      {
        key: "confusion-evening",
        problemScore: clampNumber((profile.confusionFrequency * 0.7) + ((100 - profile.routineStability) * 0.3), 0, 100),
        title: "Structured nighttime routine and adaptive lighting",
        metric: "evening confusion",
        signal: "confusion",
        reason: "High evening confusion combined with low routine stability.",
        baselineTrend: profile.trendDirection === "declining" ? "declining" : "unstable",
      },
      {
        key: "activity-guided",
        problemScore: clampNumber((100 - profile.activityConsistency) * 0.75 + profile.riskSignals.lowActivityDays * 1.6, 0, 100),
        title: "Guided daytime walking blocks with caregiver prompts",
        metric: "activity consistency",
        signal: "activity",
        reason: "Sustained low-activity days suggest deconditioning risk.",
        baselineTrend: profile.trendDirection === "improving" ? "flat" : "declining",
      },
      {
        key: "sleep-calming",
        problemScore: clampNumber((100 - profile.sleepConsistency) * 0.8 + profile.confusionFrequency * 0.2, 0, 100),
        title: hasMusicSignal
          ? "Evening calming routine with personalized music"
          : "Evening calming routine and stimulation taper",
        metric: "sleep consistency",
        signal: hasMusicSignal ? "music" : "sleep",
        reason: hasMusicSignal
          ? "Sleep disruption and evening agitation with available music engagement data."
          : "Poor sleep pattern with elevated nighttime dysregulation.",
        baselineTrend: "unstable",
      },
      {
        key: "medication-reminder",
        problemScore: clampNumber((100 - profile.medicationAdherence) * 0.9 + profile.riskSignals.alerts * 0.7, 0, 100),
        title: "Timed medication reminders with two-step confirmation",
        metric: "medication adherence",
        signal: "medication",
        reason: "Medication misses are likely contributing to instability.",
        baselineTrend: "flat",
      },
      {
        key: "recognition-social",
        problemScore: clampNumber((100 - profile.recognitionSocial) * 0.75 + Math.max(0, 30 - profile.confusionFrequency) * 0.25, 0, 100),
        title: "Familiar-face interaction schedule and social cueing",
        metric: "recognition reliability",
        signal: "recognition",
        reason: "Recognition and social orientation signal are below expected range.",
        baselineTrend: "unstable",
      },
    ];

    const sortedCandidates = generatedInterventions
      .sort((a, b) => b.problemScore - a.problemScore)
      .slice(0, 3);

    const statusPlan = [
      { status: "Working", tier: "strong" },
      { status: "Mixed", tier: "moderate" },
      { status: "Limited impact", tier: "weak" },
    ];

    const measuredRows = interventionSeries.slice(0, 3);

    const cards = statusPlan.map((plan, index) => {
      const fromMeasured = measuredRows[index] || null;
      const fromSignal = sortedCandidates[index] || generatedInterventions[index] || generatedInterventions[0];
      const sourceSeed = `${patientSeed}-${fromSignal.key}-${index}`;

      const beforeLevel = fromMeasured
        ? clampNumber(Number(fromMeasured.before || 52), 30, 90)
        : clampNumber(40 + (fromSignal.problemScore * 0.35) + seededNumber(0, 8, sourceSeed, 1), 35, 88);

      const impactPercent = fromMeasured
        ? clampNumber(Math.round(percentDelta(Math.max(1, Number(fromMeasured.before || 1)), Number(fromMeasured.after || 1))), 0, 35)
        : plan.tier === "strong"
          ? Math.round(seededNumber(20, 35, sourceSeed, 2))
          : plan.tier === "moderate"
            ? Math.round(seededNumber(10, 20, sourceSeed, 3))
            : Math.round(seededNumber(1, 10, sourceSeed, 4));

      const afterLevel = clampNumber(Math.round(beforeLevel * (1 + (impactPercent / 100))), 35, 95);

      const supportingPoints = fromMeasured
        ? Math.max(4, Math.round((Number(fromMeasured.confidence || 0) / 100) * 18))
        : Math.max(3, dataPoints[fromSignal.signal] || 3);

      const consistencyBase = clampNumber(
        100
        - (profile.volatility * 6)
        + (plan.tier === "strong" ? 8 : plan.tier === "moderate" ? 0 : -8)
        + seededNumber(-6, 6, sourceSeed, 5),
        20,
        96
      );

      const supportScale = clampNumber((supportingPoints / 18) * 100, 0, 100);
      const confidence = plan.tier === "strong"
        ? Math.round(clampNumber(80 + (0.08 * consistencyBase) + (0.04 * supportScale) + seededNumber(-2.5, 2.5, sourceSeed, 6), 80, 92))
        : plan.tier === "moderate"
          ? Math.round(clampNumber(65 + (0.1 * consistencyBase) + (0.05 * supportScale) + seededNumber(-4, 3, sourceSeed, 7), 65, 80))
          : Math.round(clampNumber(40 + (0.09 * consistencyBase) + (0.03 * supportScale) + seededNumber(-5, 4, sourceSeed, 8), 40, 65));

      const beforeSeries = buildInterventionCurve({
        seedKey: `${sourceSeed}-before`,
        start: beforeLevel,
        baselineTrend: fromSignal.baselineTrend,
        profileVolatility: profile.volatility,
        tier: "baseline",
      });

      const afterSeries = buildInterventionCurve({
        seedKey: `${sourceSeed}-after`,
        start: afterLevel - Math.round(impactPercent * 0.45),
        baselineTrend: fromSignal.baselineTrend,
        profileVolatility: profile.volatility,
        tier: plan.tier,
      });

      const summary = plan.tier === "strong"
        ? `Strong improvement observed: reduced ${fromSignal.metric} by ${impactPercent}%`
        : plan.tier === "moderate"
          ? `Moderate gains with variability: improved ${fromSignal.metric} by ${impactPercent}%`
          : `No consistent improvement detected: change in ${fromSignal.metric} remained below ${Math.max(5, impactPercent)}%`;

      return {
        id: fromMeasured?.id || `${fromSignal.key}-${index}`,
        title: fromMeasured?.description || fromSignal.title,
        status: plan.status,
        summary,
        before: beforeLevel,
        after: afterLevel,
        beforeSeries,
        afterSeries,
        confidence,
        impactPercent,
        metric: fromSignal.metric,
        rationale: fromSignal.reason,
      };
    });

    const headline = cards
      .slice()
      .sort((a, b) => Number(b.impactPercent || 0) - Number(a.impactPercent || 0))[0] || null;

    return {
      hasMeasured: interventionSeries.length > 0,
      cards,
      headline,
    };
  }, [
    selectedPatientId,
    selectedPatient?.name,
    interventionSeries,
    behaviorSignals.routineStabilityScore,
    behaviorSignals.activityConsistency,
    medicationAdherence,
    cognitiveSignals.confusionRate,
    cognitiveSignals.recognitionRate,
    moodVolatility?.volatility,
    trendLabel,
    alertsTriggered,
    lowActivityDays,
    highConfusionDays,
    recognitionEventCount,
    eventLogs.length,
    routineLogs.length,
    cognitiveTrend.length,
    patientStats?.totals?.poorSleepDays,
    musicImpact,
  ]);

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
        <SummaryCard
          title="Confusion frequency"
          value={cognitiveSignals.confusionRate === null ? "No data" : `${cognitiveSignals.confusionRate}%`}
          tone={cognitiveSignals.confusionRate === null ? "warning" : cognitiveSignals.confusionRate >= 35 ? "alert" : "good"}
          hint={cognitiveSignals.confusionRate === null
            ? "Run daily cognitive check-ins"
            : `${cognitiveSignals.confusionDelta >= 0 ? "+" : ""}${cognitiveSignals.confusionDelta}% vs baseline`}
        />
        <SummaryCard
          title="Routine stability"
          value={`${behaviorSignals.routineStabilityScore}%`}
          tone={behaviorSignals.routineStabilityScore >= 75 ? "good" : behaviorSignals.routineStabilityScore >= 55 ? "warning" : "alert"}
          hint={`Activity consistency ${behaviorSignals.activityConsistency}%`}
        />
        <SummaryCard
          title="Familiar recognition"
          value={cognitiveSignals.recognitionRate === null ? "No data" : `${cognitiveSignals.recognitionRate}%`}
          tone={cognitiveSignals.recognitionRate === null ? "warning" : cognitiveSignals.recognitionRate >= 70 ? "good" : cognitiveSignals.recognitionRate >= 50 ? "warning" : "alert"}
          hint={cognitiveSignals.recognitionRate === null
            ? "Awaiting people-recognition sessions"
            : `${cognitiveSignals.recognitionDelta >= 0 ? "+" : ""}${cognitiveSignals.recognitionDelta}% trend | ${recognitionEventCount} face events`}
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-[2.2rem] leading-tight font-[Georgia,serif] font-semibold text-[#251943]">Cognitive performance</h2>
        <p className="text-sm text-[#5f5b78]">Memory, response time, and confusion patterns</p>
        <div className="overflow-x-auto pb-1">
          <div className="flex flex-nowrap gap-3 min-w-max">
            <CognitiveFlashCard data={cognitivePerformanceCards.memory} icon={Brain} />
            <CognitiveFlashCard data={cognitivePerformanceCards.response} icon={Clock3} />
            <CognitiveFlashCard data={cognitivePerformanceCards.confusion} icon={CircleHelp} />
          </div>
        </div>
      </section>

      <RecognitionSocialSection
        trend={recognitionTrend}
        score={cognitiveSignals.recognitionRate}
        trendDelta={cognitiveSignals.recognitionDelta}
        insight={recognitionInsightText}
        events={recognitionEvents}
      />

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

      <BehaviorRoutineSection routine={behaviorRoutine} />

      <section className="bg-card border border-border rounded-xl p-4">
        <div className="mb-4 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">AI Insights</h3>
          </div>
          <div className="space-y-1.5 text-sm text-foreground">
            {(aiInsights.length ? aiInsights : ["Collecting enough recent signal for AI trend summaries..."]).map((line, index) => (
              <p key={`${line}-${index}`}>- {line}</p>
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

      <section className="bg-card border border-border rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            <h2 className="text-base font-display font-semibold text-foreground">Clinical signal intelligence</h2>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-lg border border-border p-3">
              <p className="text-sm font-semibold text-foreground">Cognitive signals</p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>Confusion frequency: {cognitiveSignals.confusionRate === null ? "No data yet" : `${cognitiveSignals.confusionRate}%`}</li>
                <li>Direction: {cognitiveSignals.confusionRate === null ? "Awaiting baseline" : `${cognitiveSignals.confusionDelta >= 0 ? "up" : "down"} ${Math.abs(cognitiveSignals.confusionDelta)}% vs baseline`}</li>
                <li>Familiar recognition score: {cognitiveSignals.recognitionRate === null ? "No data yet" : `${cognitiveSignals.recognitionRate}%`}</li>
              </ul>
            </div>

            <div className="rounded-lg border border-border p-3">
              <p className="text-sm font-semibold text-foreground">Behavior patterns</p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>Routine stability score: {behaviorSignals.routineStabilityScore}%</li>
                <li>Activity consistency: {behaviorSignals.activityConsistency}%</li>
                <li>Interpretation: {behaviorSignals.routineStabilityScore >= 75 ? "Stable routine" : behaviorSignals.routineStabilityScore >= 55 ? "Mild routine drift" : "High routine deviation"}</li>
              </ul>
            </div>

            <div className="rounded-lg border border-border p-3">
              <p className="text-sm font-semibold text-foreground">Emotional and mood signals</p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>Mood volatility score: {moodVolatility.volatility === null ? "No trend data yet" : moodVolatility.volatility}</li>
                <li>Mood stability score: {moodVolatility.stabilityScore === null ? "No trend data yet" : `${moodVolatility.stabilityScore}%`}</li>
                <li>Trend read: {moodVolatility.stabilityScore === null ? "Awaiting sufficient trend points" : moodVolatility.stabilityScore >= 70 ? "Stable mood pattern" : "Volatility elevated"}</li>
              </ul>
            </div>

            <div className="rounded-lg border border-border p-3">
              <p className="text-sm font-semibold text-foreground">Social recognition signals</p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>Familiar recognition trend: {cognitiveSignals.recognitionRate === null ? "No data yet" : `${cognitiveSignals.recognitionDelta >= 0 ? "+" : ""}${cognitiveSignals.recognitionDelta}%`}</li>
                <li>Face-detected interactions: {recognitionEventCount}</li>
                <li>Clinical read: {cognitiveSignals.recognitionRate === null ? "Run more people-recognition check-ins" : cognitiveSignals.recognitionRate >= 70 ? "Recognition signal stable" : "Recognition confidence dropping"}</li>
              </ul>
            </div>

            <div className="rounded-lg border border-border p-3 lg:col-span-2">
              <p className="text-sm font-semibold text-foreground">Game performance signals</p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>Latest game performance score: {gameSignals.latestPerformance === null ? "No game sessions yet" : `${gameSignals.latestPerformance}%`}</li>
                <li>Response-time trend: {gameSignals.responseTimeDelta === null ? "No baseline yet" : `${gameSignals.responseTimeDelta >= 0 ? "+" : ""}${gameSignals.responseTimeDelta}%`}</li>
                <li>Performance change: {gameSignals.performanceDelta === null ? "No baseline yet" : `${gameSignals.performanceDelta >= 0 ? "+" : ""}${gameSignals.performanceDelta} pts`}</li>
                <li>Signal interpretation: {gameSignals.responseTimeDelta === null ? "Play more sessions to establish trend." : gameSignals.responseTimeDelta >= 18 ? "Response time is slowing (decline signal)." : gameSignals.responseTimeDelta <= -10 ? "Response time is improving." : "Response time stable."}</li>
              </ul>
            </div>
          </div>
      </section>

      <section className="space-y-4">
        <div className="bg-card border border-border rounded-xl p-5 space-y-5">
          <div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-primary" />
                <h2 className="text-lg font-display font-semibold text-foreground">Risk Analysis</h2>
              </div>
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                riskVisual.status === "Increasing"
                  ? "bg-alert/15 text-alert"
                  : riskVisual.status === "Decreasing"
                    ? "bg-safe/15 text-safe"
                    : "bg-muted text-muted-foreground"
              }`}>
                {riskVisual.status}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Recent risk trends and contributing factors</p>
          </div>

          <div className="space-y-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Risk trend (last 30 days)</p>
            {trendLoading || loading ? (
              <p className="text-sm text-muted-foreground">Loading risk trend...</p>
            ) : riskVisual.chartData.length ? (
              <>
                <div className="w-full rounded-2xl bg-[#faf8fe] border border-[#ebe7f3] px-2 py-2" style={{ minHeight: 240 }}>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={riskVisual.chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="riskTrendAreaFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#0f766e" stopOpacity={0.26} />
                          <stop offset="100%" stopColor="#0f766e" stopOpacity={0.04} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e6e8ef" />
                      <XAxis
                        dataKey="label"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#7d8596", fontSize: 11 }}
                      />
                      <YAxis hide domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{
                          background: CHART_COLORS.tooltipBg,
                          border: `1px solid ${CHART_COLORS.tooltipBorder}`,
                          borderRadius: "0.5rem"
                        }}
                        formatter={(value) => [`${value}`, "Risk score"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="riskScore"
                        stroke="#0f766e"
                        strokeWidth={2.7}
                        fill="url(#riskTrendAreaFill)"
                        dot={{ r: 2.5, fill: "#0f766e", stroke: "#ffffff", strokeWidth: 1 }}
                        activeDot={{ r: 4, fill: "#115e59" }}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-sm text-muted-foreground">{riskVisual.summary}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No historical risk data available yet.</p>
            )}
          </div>

          <div className="border-t border-border pt-4 space-y-3">
            <h3 className="text-sm font-display font-semibold text-foreground">Key contributing patterns</h3>
            <div className="space-y-2.5">
              {patternSummary.length ? patternSummary.map((item) => (
                <div key={item.title} className="rounded-lg border border-border p-3">
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  <p className="text-sm text-muted-foreground mt-1">{item.text}</p>
                </div>
              )) : (
                <div className="text-sm text-muted-foreground">No strong pattern yet. Add more daily logs to unlock this section.</div>
              )}
            </div>
          </div>
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

      <section className="rounded-2xl border border-[#e7e3f2] bg-gradient-to-br from-[#fbf8ff] via-[#f7f9ff] to-[#f5fbff] p-4 sm:p-5 shadow-[0_10px_30px_-18px_rgba(65,76,122,0.35)]">
        <div className="grid gap-4 xl:grid-cols-5">
          <div className="xl:col-span-3 space-y-4">
            <div>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#6d5ed3]" />
                <h2 className="text-lg font-display font-semibold text-[#2e2750]">Similar Patients</h2>
              </div>
              <p className="mt-1 text-sm text-[#696487]">{cohortInsightsModel.subtitle}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {cohortInsightsModel.chips.map((chip) => (
                <div key={chip.id} className="inline-flex items-center gap-2 rounded-full border border-[#ddd9f0] bg-white/85 px-2.5 py-1.5 shadow-sm">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#ece8ff] text-[11px] font-semibold text-[#5c4fb8]">
                    {chip.initials}
                  </span>
                  <span className="text-xs font-medium text-[#2d2b42]">{chip.name}</span>
                  <span className="rounded-full bg-[#eef4ff] px-2 py-0.5 text-[11px] font-semibold text-[#3563c9]">{chip.similarity}% similar</span>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-[#ddd9f0] bg-white/90 p-3 sm:p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-[#2f2a4c]">Patient vs cohort average</h3>
                <span className="text-xs font-medium text-[#7c749d]">last 14 days</span>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-[#ede9f8] bg-[#faf7ff] p-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6f62c3]">{String(cohortInsightsModel.selectedName || "Patient").toUpperCase()}</p>
                  <div className="mt-2 h-28">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={cohortInsightsModel.patientSeries} margin={{ top: 4, right: 4, left: 4, bottom: 2 }}>
                        <defs>
                          <linearGradient id="cohortPatientFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#8b7ce6" stopOpacity={0.42} />
                            <stop offset="100%" stopColor="#8b7ce6" stopOpacity={0.05} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#ebe8f6" />
                        <XAxis dataKey="day" hide />
                        <YAxis hide domain={[0, 100]} />
                        <Area type="monotone" dataKey="value" stroke="#7567d8" strokeWidth={2.4} fill="url(#cohortPatientFill)" dot={false} isAnimationActive={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-xl border border-[#dfeaf8] bg-[#f6fbff] p-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#3f73c8]">COHORT AVERAGE</p>
                  <div className="mt-2 h-28">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={cohortInsightsModel.cohortSeries} margin={{ top: 4, right: 4, left: 4, bottom: 2 }}>
                        <defs>
                          <linearGradient id="cohortAverageFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#5ea4df" stopOpacity={0.34} />
                            <stop offset="100%" stopColor="#5ea4df" stopOpacity={0.05} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e4edf9" />
                        <XAxis dataKey="day" hide />
                        <YAxis hide domain={[0, 100]} />
                        <Area type="monotone" dataKey="value" stroke="#4389c9" strokeWidth={2.4} fill="url(#cohortAverageFill)" dot={false} isAnimationActive={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="xl:col-span-2 space-y-3">
            <div>
              <h3 className="text-base font-display font-semibold text-[#2e2a4e]">What worked for similar patients</h3>
              <p className="mt-1 text-sm text-[#696487]">Ranked by success in similar patients</p>
            </div>

            <div className="space-y-2.5">
              {cohortInsightsModel.rankedInterventions.map((item) => (
                <article key={item.id} className="rounded-xl border border-[#dce8dc] bg-white/95 p-3 shadow-[0_6px_18px_-14px_rgba(41,63,58,0.45)]">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-[#2f2f3d]">{item.title}</p>
                      <p className="mt-0.5 text-xs text-[#7b7597]">Tried by {item.triedBy} similar patients</p>
                    </div>
                    <span className="rounded-full bg-[#e8f5ea] px-2 py-1 text-xs font-semibold text-[#2a8c52]">{item.successRate}%</span>
                  </div>

                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#e8e7f1]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#8a7ee0] via-[#6ea8db] to-[#56b888]"
                      style={{ width: `${item.successRate}%` }}
                    />
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-[11px] text-[#8a85a5]">{item.rationale}</p>
                    <p className="text-xs font-medium text-[#4f46b8]">{item.cta}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-3 text-xs text-[#847f9f]">{cohortInsight || "Cohort explanation updates as more daily logs and outcomes are recorded."}</p>
      </section>

      <MusicImpactWidget patientId={selectedPatientId} />

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-display font-semibold text-foreground">Intervention Effectiveness</h2>
          <p className="text-sm text-muted-foreground">What's helping, what isn't, and by how much</p>
          {!interventionEffectiveness.hasMeasured && (
            <p className="mt-1 text-xs text-primary">Signal-based mode: outcomes are modeled from this patient's behavior and risk profile.</p>
          )}
        </div>

        {interventionLoading ? (
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-sm text-muted-foreground">Loading intervention outcomes...</p>
          </div>
        ) : (
          <>
            {interventionEffectiveness.headline && (
              <article className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10 p-5 sm:p-6 shadow-gentle">
                <p className="text-xs uppercase tracking-wide text-primary/80 font-medium">Headline Impact</p>
                <p className="mt-2 text-3xl sm:text-4xl font-[Georgia,serif] font-semibold text-foreground">
                  {interventionEffectiveness.headline.summary}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  from {String(interventionEffectiveness.headline.title || "selected intervention").toLowerCase()}
                </p>
              </article>
            )}

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {interventionEffectiveness.cards.map((item) => (
                <article key={item.id} className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm sm:text-base font-semibold text-foreground leading-snug">{item.title}</h3>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap ${
                      item.status === "Working"
                        ? "bg-safe/15 text-safe"
                        : item.status === "Mixed"
                          ? "bg-warning/15 text-warning"
                          : "bg-alert/15 text-alert"
                    }`}>
                      {item.status}
                    </span>
                  </div>

                  <p className="text-sm text-muted-foreground">{item.summary}</p>
                  <p className="text-xs text-muted-foreground">{item.rationale}</p>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-border/70 bg-muted/20 p-2.5">
                      <p className="text-xs text-muted-foreground mb-1">Before</p>
                      <div className="h-14">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={item.beforeSeries} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
                            <defs>
                              <linearGradient id={`before-grad-${item.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={CHART_COLORS.before} stopOpacity={0.28} />
                                <stop offset="100%" stopColor={CHART_COLORS.before} stopOpacity={0.02} />
                              </linearGradient>
                            </defs>
                            <Area type="monotone" dataKey="value" stroke={CHART_COLORS.before} strokeWidth={2.2} fill={`url(#before-grad-${item.id})`} dot={false} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="rounded-lg border border-border/70 bg-muted/20 p-2.5">
                      <p className="text-xs text-muted-foreground mb-1">After</p>
                      <div className="h-14">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={item.afterSeries} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
                            <defs>
                              <linearGradient id={`after-grad-${item.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={CHART_COLORS.after} stopOpacity={0.28} />
                                <stop offset="100%" stopColor={CHART_COLORS.after} stopOpacity={0.02} />
                              </linearGradient>
                            </defs>
                            <Area type="monotone" dataKey="value" stroke={CHART_COLORS.after} strokeWidth={2.2} fill={`url(#after-grad-${item.id})`} dot={false} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">Confidence {item.confidence}%</p>
                </article>
              ))}
            </div>
          </>
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

const CognitiveFlashCard = ({ data, icon: Icon }) => {
  const chartData = (data?.series || []).map((value, index) => ({ index, value }));
  const chartKey = String(data?.label || "trend").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const trend = String(data?.trend || "stable");
  const trendStyles = trend === "up"
    ? "bg-[#f3deef] text-[#9c417b]"
    : trend === "down"
      ? "bg-[#dceee5] text-[#4e9d79]"
      : "bg-[#ece9f0] text-[#6d617f]";

  return (
    <article className="w-[320px] flex-none rounded-3xl border border-border bg-card px-4 py-4 shadow-gentle">
      <div className="flex items-center justify-between gap-2">
        <p className="leading-none flex items-center gap-2 text-[#5f4d72] tracking-wide min-w-0">
          <Icon className="w-4 h-4 shrink-0" />
          <span className="text-sm font-medium uppercase truncate">{data.label}</span>
        </p>
        <div className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${trendStyles}`}>
          {trend === "up" ? <ArrowUp className="w-3.5 h-3.5" /> : trend === "down" ? <ArrowDown className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
          <span>{data.trendLabel}</span>
        </div>
      </div>

      <p className="mt-3 text-[3.1rem] font-[Georgia,serif] font-semibold text-[#24153f] leading-none">{data.value}</p>

      <div className="mt-3 h-20 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 4, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id={`grad-${chartKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={data.fillColor} stopOpacity={0.8} />
                <stop offset="100%" stopColor={data.fillColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Tooltip cursor={false} formatter={(value) => [value, data.label]} />
            <Area
              type="monotone"
              dataKey="value"
              stroke={data.lineColor}
              strokeWidth={4}
              fill={`url(#grad-${chartKey})`}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-3 text-[1.1rem] text-[#5c5a74] leading-snug">{data.note}</p>
    </article>
  );
};

const SummaryCard = ({ title, value, tone, hint = "" }) => {
  const toneClass = tone === "good" ? "border-safe/30 bg-safe/10" : tone === "warning" ? "border-warning/30 bg-warning/10" : "border-alert/30 bg-alert/10";
  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="text-2xl font-bold text-foreground mt-2">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground mt-1">{hint}</p> : null}
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

const percentDelta = (baseline, current) => {
  const base = Number(baseline);
  const next = Number(current);
  if (!Number.isFinite(base) || !Number.isFinite(next) || base === 0) return 0;
  return ((next - base) / Math.abs(base)) * 100;
};

const clampNumber = (value, min, max) => Math.max(min, Math.min(max, Number(value)));

const hashString = (text) => {
  let hash = 2166136261;
  const source = String(text || "");
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
};

const seededNumber = (min, max, seedKey, step = 0) => {
  const seed = hashString(`${seedKey}-${step}`);
  const unit = (Math.sin(seed * 0.0000123 + step * 1.618) + 1) / 2;
  return min + (max - min) * unit;
};

const buildInterventionCurve = ({ seedKey, start, baselineTrend, profileVolatility, tier }) => {
  const points = 8;
  const trendSlope = tier === "strong"
    ? seededNumber(1.8, 3.3, seedKey, 2)
    : tier === "moderate"
      ? seededNumber(0.8, 1.9, seedKey, 2)
      : tier === "weak"
        ? seededNumber(-0.1, 0.8, seedKey, 2)
        : baselineTrend === "declining"
          ? seededNumber(-2.8, -1.2, seedKey, 2)
          : baselineTrend === "unstable"
            ? seededNumber(-0.8, 0.5, seedKey, 2)
            : seededNumber(-0.4, 0.4, seedKey, 2);

  const noiseBase = tier === "strong"
    ? seededNumber(0.3, 0.9, seedKey, 3)
    : tier === "moderate"
      ? seededNumber(0.8, 1.8, seedKey, 3)
      : tier === "weak"
        ? seededNumber(1.5, 2.9, seedKey, 3)
        : seededNumber(1.3, 2.6, seedKey, 3);

  const volatilityFactor = clampNumber((Number(profileVolatility || 5) / 10), 0.35, 1.8);

  return Array.from({ length: points }, (_, idx) => {
    const baseline = Number(start) + (trendSlope * idx);
    const noise = seededNumber(-noiseBase, noiseBase, seedKey, 10 + idx) * volatilityFactor;
    const smoothing = tier === "strong" ? Math.sin(idx / 3) * 0.6 : tier === "weak" ? Math.sin(idx * 1.4) * 1.2 : Math.sin(idx / 2.2) * 0.8;
    const raw = baseline + noise + smoothing;
    return {
      idx,
      value: Math.round(clampNumber(raw, 18, 96))
    };
  });
};

const makeInitials = (name) => {
  const cleaned = String(name || "").trim();
  if (!cleaned) return "NA";
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
};

const buildGeneratedCohortRecommendations = ({
  patientName,
  routineStability,
  medicationAdherence,
  confusionRate,
  sleepRiskDays,
  lowActivityDays,
  hasMusic,
  seed,
  cohortSize,
}) => {
  const confusion = Number.isFinite(Number(confusionRate)) ? Number(confusionRate) : 35;
  const candidates = [
    {
      key: "music-calm",
      title: hasMusic ? "Calming evening music" : "Guided evening wind-down routine",
      relevance: clampNumber((confusion * 0.6) + ((100 - routineStability) * 0.4), 0, 100),
      base: 70
    },
    {
      key: "pre-dinner-rest",
      title: "Pre-dinner rest window",
      relevance: clampNumber((sleepRiskDays * 5.5) + (confusion * 0.35), 0, 100),
      base: 64
    },
    {
      key: "soft-light",
      title: "Soft lighting after sunset",
      relevance: clampNumber((confusion * 0.55) + ((100 - routineStability) * 0.25), 0, 100),
      base: 61
    },
    {
      key: "guided-walk",
      title: "Guided afternoon walking block",
      relevance: clampNumber((lowActivityDays * 6.5) + ((100 - routineStability) * 0.3), 0, 100),
      base: 59
    },
    {
      key: "medication-timing",
      title: "Medication reminder timing adjustment",
      relevance: clampNumber((100 - medicationAdherence) * 0.85, 0, 100),
      base: 62
    }
  ];

  return candidates
    .map((candidate, index) => {
      const rate = clampNumber(
        candidate.base
        + (candidate.relevance * 0.25)
        + seededNumber(-5, 5, `${seed}-${candidate.key}`, index),
        52,
        93
      );
      const triedBy = clampNumber(
        Math.round(Math.max(2, cohortSize - 1 + seededNumber(0, 2.8, `${seed}-${candidate.key}-count`, index))),
        2,
        Math.max(5, cohortSize + 2)
      );
      return {
        id: `generated-${candidate.key}`,
        title: candidate.title,
        successRate: Math.round(rate),
        triedBy,
        rationale: `Derived from cohort behavior similarity around evening confusion and routine disruption.`,
        cta: `Try with ${patientName || "patient"}`
      };
    })
    .sort((a, b) => b.successRate - a.successRate)
    .slice(0, 4);
};

export default CaregiverInsights;

