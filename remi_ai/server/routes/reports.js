const router = require('express').Router();
const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const Patient = require('../models/Patient');
const Alert = require('../models/Alert');
const Event = require('../models/Event');
const Task = require('../models/Task');
const ActivityLog = require('../models/ActivityLog');
const Report = require('../models/Report');
const DailyHealthLog = require('../models/DailyHealthLog');
const { applyRiskDelta } = require('../services/riskEngine');

const DAILY_ENUMS = {
  mood: ['calm', 'confused', 'agitated'],
  confusionLevel: ['none', 'mild', 'moderate', 'severe'],
  sleep: ['good', 'disturbed', 'poor'],
  gotLost: [true, false]
};

const toDayStart = (dateInput) => {
  const date = dateInput ? new Date(dateInput) : new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

const validateDailyPayload = (payload) => {
  for (const [field, allowed] of Object.entries(DAILY_ENUMS)) {
    if (!allowed.includes(payload[field])) {
      return `Invalid ${field}. Allowed values: ${allowed.join(', ')}`;
    }
  }
  return null;
};

const deriveAutomaticSignals = async ({ patientId, dayStart }) => {
  const dayEnd = new Date(dayStart);
  dayEnd.setHours(23, 59, 59, 999);

  const [tasks, interactions, events] = await Promise.all([
    Task.find({ patientId, scheduledTime: { $gte: dayStart, $lte: dayEnd } }).lean(),
    ActivityLog.find({ patientId, timestamp: { $gte: dayStart, $lte: dayEnd } }).lean(),
    Event.find({ patientId, timestamp: { $gte: dayStart, $lte: dayEnd } }).lean()
  ]);

  const medTasks = tasks.filter((task) => task.type === 'medication');
  const mealTasks = tasks.filter((task) => task.type === 'meal');

  const medCompleted = medTasks.filter((task) => task.status === 'completed').length;
  const medAdherence = medTasks.length ? medCompleted / medTasks.length : null;
  const medication = medAdherence == null ? 'unknown' : medAdherence >= 0.8 ? 'taken' : 'missed';

  const mealCompleted = mealTasks.filter((task) => task.status === 'completed').length;
  const mealAdherence = mealTasks.length ? mealCompleted / mealTasks.length : null;
  const food = mealAdherence == null ? 'unknown' : mealAdherence >= 0.5 ? 'normal' : 'skipped';

  const activityCount = interactions.length + events.filter((event) => event.category === 'interaction').length;
  const activity = activityCount === 0 ? 'unknown' : activityCount >= 8 ? 'high' : activityCount >= 3 ? 'medium' : 'low';

  return {
    medication,
    food,
    activity
  };
};

const computeDailyRiskDelta = ({ mood, confusionLevel, gotLost, medication, sleep, food, activity }) => {
  const scoreMap = {
    mood: { calm: -6, confused: 8, agitated: 15 },
    confusionLevel: { none: -2, mild: 4, moderate: 9, severe: 14 },
    gotLost: { true: 15, false: -1 },
    medication: { taken: -2, missed: 12, unknown: 2 },
    sleep: { good: -4, disturbed: 5, poor: 10 },
    food: { normal: -1, skipped: 7, unknown: 1 },
    activity: { high: -4, medium: 0, low: 6, unknown: 1 }
  };

  return scoreMap.mood[mood]
    + scoreMap.confusionLevel[confusionLevel]
    + scoreMap.gotLost[String(gotLost)]
    + scoreMap.medication[medication]
    + scoreMap.sleep[sleep]
    + scoreMap.food[food]
    + scoreMap.activity[activity];
};

const buildDailyInsights = ({ todayLog, recentLogs }) => {
  const insights = [];
  const recommendations = [];

  if (todayLog.sleep === 'poor' && todayLog.mood === 'agitated') {
    insights.push('Poor sleep appears linked to agitation today.');
    recommendations.push('Stabilize bedtime routine and reduce evening stimulation.');
  }

  if (todayLog.medication === 'missed' && (todayLog.mood === 'confused' || todayLog.mood === 'agitated')) {
    insights.push('Missed medication may be contributing to confusion/agitation.');
    recommendations.push('Use structured reminders and confirm adherence with caregiver check-ins.');
  }

  if (todayLog.gotLost) {
    insights.push('Disorientation/lost behavior was reported today.');
    recommendations.push('Use reassurance mode and location-aware prompts with caregiver escalation.');
  }

  if (todayLog.confusionLevel === 'moderate' || todayLog.confusionLevel === 'severe') {
    insights.push('Higher confusion level observed today.');
    recommendations.push('Prioritize familiar cues and reduce environmental stimulation.');
  }

  if (todayLog.activity === 'low' && todayLog.mood !== 'calm') {
    insights.push('Low activity is associated with behavioral strain today.');
    recommendations.push('Introduce short guided activity blocks with familiar tasks.');
  }

  const poorSleepDays = recentLogs.filter((log) => log.sleep === 'poor').length;
  if (poorSleepDays >= 3) {
    insights.push('Repeated poor sleep observed across recent logs.');
    recommendations.push('Discuss sleep management strategy with clinician.');
  }

  const missedMedDays = recentLogs.filter((log) => log.medication === 'missed').length;
  if (missedMedDays >= 2) {
    insights.push('Medication adherence dropped in recent days.');
  }

  const baseline = recentLogs.slice(0, 3);
  const recent = recentLogs.slice(-3);
  const score = (log) => computeDailyRiskDelta(log);
  const baselineAvg = baseline.length ? baseline.reduce((sum, log) => sum + score(log), 0) / baseline.length : 0;
  const recentAvg = recent.length ? recent.reduce((sum, log) => sum + score(log), 0) / recent.length : 0;

  let trend = 'stable';
  if (recentAvg - baselineAvg > 4) trend = 'worsening';
  else if (baselineAvg - recentAvg > 4) trend = 'improving';

  if (trend === 'worsening') {
    insights.push('Condition appears to be declining compared to recent baseline.');
  }

  if (recommendations.length === 0) {
    recommendations.push('Continue current routine and monitor next 48 hours.');
  }

  return {
    trend,
    insights,
    recommendations
  };
};

const METRIC_SCORE = {
  mood: { calm: 90, confused: 55, agitated: 25 },
  sleep: { good: 90, disturbed: 55, poor: 25 },
  activity: { high: 90, medium: 60, low: 30, unknown: 40 },
  medication: { taken: 100, missed: 25, unknown: 45 }
};

const average = (values = []) => (values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0);

const summarizeDirection = ({ metricName, current, previous, higherIsBetter = true }) => {
  const delta = Number((current - previous).toFixed(1));
  const absDelta = Math.abs(delta);

  if (absDelta < 2) {
    return {
      metric: metricName,
      current: Number(current.toFixed(1)),
      previous: Number(previous.toFixed(1)),
      delta,
      direction: 'stable',
      label: `${metricName} stable`
    };
  }

  const improved = higherIsBetter ? delta > 0 : delta < 0;
  return {
    metric: metricName,
    current: Number(current.toFixed(1)),
    previous: Number(previous.toFixed(1)),
    delta,
    direction: improved ? 'improving' : 'declining',
    label: `${metricName} ${improved ? 'improving' : 'declining'}`
  };
};

const buildPatientSignalSummary = (logs = []) => {
  const total = Math.max(logs.length, 1);
  const poorSleepRate = (logs.filter((log) => log.sleep === 'poor').length / total) * 100;
  const agitatedRate = (logs.filter((log) => log.mood === 'agitated').length / total) * 100;
  const missedMedRate = (logs.filter((log) => log.medication === 'missed').length / total) * 100;
  const lowActivityRate = (logs.filter((log) => log.activity === 'low').length / total) * 100;
  const highConfusionRate = (
    logs.filter((log) => log.confusionLevel === 'moderate' || log.confusionLevel === 'severe').length / total
  ) * 100;

  return {
    poorSleepRate,
    agitatedRate,
    missedMedRate,
    lowActivityRate,
    highConfusionRate
  };
};

// Capture daily health log and generate AI-style supportive report.
router.post('/daily-log', async (req, res) => {
  try {
    const { patientId, date, mood, confusionLevel = 'none', gotLost = false, sleep, interventionNotes = '' } = req.body;
    if (!patientId) return res.status(400).json({ message: 'patientId is required' });

    const payloadError = validateDailyPayload({ mood, confusionLevel, gotLost, sleep });
    if (payloadError) return res.status(400).json({ message: payloadError });

    const patient = await Patient.findById(patientId);
    if (!patient) return res.status(404).json({ message: 'Patient not found' });

    const logDate = toDayStart(date);
    const automaticSignals = await deriveAutomaticSignals({ patientId, dayStart: logDate });
    const log = await DailyHealthLog.findOneAndUpdate(
      { patientId, date: logDate },
      {
        patientId,
        date: logDate,
        mood,
        confusionLevel,
        gotLost,
        medication: automaticSignals.medication,
        sleep,
        food: automaticSignals.food,
        activity: automaticSignals.activity,
        medicationSource: 'auto',
        foodSource: 'auto',
        activitySource: 'auto',
        interventionNotes,
        createdBy: req.user?.id || null
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    const recentLogs = await DailyHealthLog.find({ patientId }).sort({ date: 1 }).limit(14).lean();
    const analysis = buildDailyInsights({ todayLog: log, recentLogs });

    const io = req.app.get('io');
    const delta = computeDailyRiskDelta(log);
    await applyRiskDelta({
      io,
      patientId,
      delta,
      reason: 'daily_log_assessment',
      category: 'behavioral',
      metadata: {
        mood,
        confusionLevel,
        gotLost,
        medication: automaticSignals.medication,
        sleep,
        food: automaticSignals.food,
        activity: automaticSignals.activity
      }
    });

    const summary = [
      `Mood: ${mood}`,
      `Confusion: ${confusionLevel}`,
      `Lost incident: ${gotLost ? 'Yes' : 'No'}`,
      `Medication: ${automaticSignals.medication} (auto)`,
      `Sleep: ${sleep}`,
      `Food: ${automaticSignals.food} (auto)`,
      `Activity: ${automaticSignals.activity} (auto)`,
      analysis.trend === 'worsening'
        ? 'Trend: condition appears to be worsening versus recent baseline.'
        : analysis.trend === 'improving'
          ? 'Trend: condition appears to be improving versus recent baseline.'
          : 'Trend: condition appears stable versus recent baseline.'
    ].join(' | ');

    const report = await Report.findOneAndUpdate(
      { patientId, reportType: 'daily', startDate: logDate, endDate: logDate },
      {
        patientId,
        reportType: 'daily',
        startDate: logDate,
        endDate: logDate,
        generatedAt: new Date(),
        summary,
        recommendations: analysis.recommendations,
        riskTrend: analysis.trend === 'worsening' ? 'declining' : analysis.trend,
        totalEvents: 1,
        createdBy: req.user?.id || null
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    res.json({
      log,
      report: {
        id: report._id,
        summary,
        autoSignals: {
          medication: automaticSignals.medication,
          food: automaticSignals.food,
          activity: automaticSignals.activity
        },
        insights: analysis.insights,
        recommendations: analysis.recommendations,
        note: 'This is a supportive AI-generated report, not a medical diagnosis.'
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/daily-log/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const days = Math.max(1, Math.min(60, Number(req.query.days || 7)));
    const start = new Date();
    start.setDate(start.getDate() - days + 1);
    start.setHours(0, 0, 0, 0);

    const logs = await DailyHealthLog.find({
      patientId,
      date: { $gte: start }
    }).sort({ date: 1 }).lean();

    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/patient-stats/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const days = Math.max(1, Math.min(90, Number(req.query.days || 30)));
    const start = new Date();
    start.setDate(start.getDate() - days + 1);
    start.setHours(0, 0, 0, 0);

    const [logs, alerts] = await Promise.all([
      DailyHealthLog.find({ patientId, date: { $gte: start } }).sort({ date: 1 }).lean(),
      Alert.find({ patientId, createdAt: { $gte: start } }).lean()
    ]);

    const totals = {
      totalLogs: logs.length,
      missedMedicationDays: logs.filter((log) => log.medication === 'missed').length,
      poorSleepDays: logs.filter((log) => log.sleep === 'poor').length,
      agitatedDays: logs.filter((log) => log.mood === 'agitated').length,
      highConfusionDays: logs.filter((log) => log.confusionLevel === 'moderate' || log.confusionLevel === 'severe').length,
      lostIncidents: logs.filter((log) => log.gotLost).length,
      lowActivityDays: logs.filter((log) => log.activity === 'low').length,
      skippedFoodDays: logs.filter((log) => log.food === 'skipped').length,
      totalAlerts: alerts.length,
      highRiskAlerts: alerts.filter((alert) => alert.riskLevel === 'HIGH').length
    };

    const adherencePercent = totals.totalLogs
      ? Math.round(((totals.totalLogs - totals.missedMedicationDays) / totals.totalLogs) * 100)
      : 0;

    const trendWindow = logs.slice(-7);
    const stableMoodDays = trendWindow.filter((log) => log.mood === 'calm').length;
    const trend = stableMoodDays >= 5 ? 'improving' : stableMoodDays <= 2 ? 'declining' : 'stable';

    res.json({
      periodDays: days,
      totals,
      medicationAdherencePercent: adherencePercent,
      trend
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/patient-patterns/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const days = Math.max(1, Math.min(90, Number(req.query.days || 30)));
    const start = new Date();
    start.setDate(start.getDate() - days + 1);
    start.setHours(0, 0, 0, 0);

    const logs = await DailyHealthLog.find({ patientId, date: { $gte: start } }).sort({ date: 1 }).lean();
    if (!logs.length) {
      return res.json({
        periodDays: days,
        patterns: [],
        recommendation: 'Add daily logs to unlock patient-specific patterns.'
      });
    }

    const patternCounts = {
      poorSleepAgitation: logs.filter((log) => log.sleep === 'poor' && log.mood === 'agitated').length,
      missedMedicationConfusion: logs.filter((log) => log.medication === 'missed' && log.mood === 'confused').length,
      lowActivityAgitation: logs.filter((log) => log.activity === 'low' && log.mood === 'agitated').length,
      highConfusionLost: logs.filter((log) => (log.confusionLevel === 'moderate' || log.confusionLevel === 'severe') && log.gotLost).length
    };

    const patterns = Object.entries(patternCounts)
      .filter(([, count]) => count > 0)
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count);

    const topPattern = patterns[0]?.key || null;
    let recommendation = 'Keep routine stable and continue monitoring.';
    if (topPattern === 'poorSleepAgitation') recommendation = 'Prioritize sleep stabilization to reduce agitation episodes.';
    if (topPattern === 'missedMedicationConfusion') recommendation = 'Strengthen medication reminders and adherence checks.';
    if (topPattern === 'lowActivityAgitation') recommendation = 'Introduce brief structured movement sessions during the day.';
    if (topPattern === 'highConfusionLost') recommendation = 'Enable stronger orientation prompts and caregiver escort protocols.';

    res.json({ periodDays: days, patterns, recommendation });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/ai-cohort-insights', async (_req, res) => {
  try {
    const logs = await DailyHealthLog.find({}).lean();
    if (logs.length === 0) {
      return res.json({
        cohortSize: 0,
        commonPatterns: [],
        insight: 'No cohort data yet. Start adding daily logs to unlock pattern insights.'
      });
    }

    const signatureStats = new Map();
    for (const log of logs) {
      const signature = `sleep:${log.sleep}|mood:${log.mood}|confusion:${log.confusionLevel}|lost:${log.gotLost}|medication:${log.medication}|activity:${log.activity}`;
      signatureStats.set(signature, (signatureStats.get(signature) || 0) + 1);
    }

    const sortedPatterns = Array.from(signatureStats.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([signature, count]) => ({ signature, count }));

    const poorSleepAgitation = logs.filter((log) => log.sleep === 'poor' && log.mood === 'agitated').length;
    const poorSleepRate = Math.round((poorSleepAgitation / logs.length) * 100);
    const highConfusionLost = logs.filter((log) => (log.confusionLevel === 'moderate' || log.confusionLevel === 'severe') && log.gotLost).length;
    const highConfusionLostRate = Math.round((highConfusionLost / logs.length) * 100);

    res.json({
      cohortSize: new Set(logs.map((log) => String(log.patientId))).size,
      commonPatterns: sortedPatterns,
      insight: highConfusionLostRate >= 20
        ? `In this cohort, high confusion with lost behavior appears in about ${highConfusionLostRate}% of logs; orientation support should be prioritized.`
        : poorSleepRate >= 30
          ? `In this cohort, poor sleep is associated with agitation in about ${poorSleepRate}% of logs.`
          : 'Current cohort shows mixed patterns; continue collecting logs for stronger confidence.'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/comparison-intelligence/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const currentDays = Math.max(3, Math.min(30, Number(req.query.currentDays || 7)));
    const previousDays = Math.max(3, Math.min(30, Number(req.query.previousDays || 7)));
    const cohortDays = Math.max(7, Math.min(90, Number(req.query.cohortDays || 30)));

    const patient = await Patient.findById(patientId).lean();
    if (!patient) return res.status(404).json({ message: 'Patient not found' });

    const now = new Date();
    const currentStart = toDayStart(new Date(now.getTime() - (currentDays - 1) * 24 * 60 * 60 * 1000));
    const previousStart = toDayStart(new Date(currentStart.getTime() - previousDays * 24 * 60 * 60 * 1000));
    const cohortStart = toDayStart(new Date(now.getTime() - (cohortDays - 1) * 24 * 60 * 60 * 1000));

    const [patientLogs, cohortLogs] = await Promise.all([
      DailyHealthLog.find({ patientId, date: { $gte: previousStart } }).sort({ date: 1 }).lean(),
      DailyHealthLog.find({ date: { $gte: cohortStart } }).sort({ date: 1 }).lean()
    ]);

    const currentWindow = patientLogs.filter((log) => log.date >= currentStart);
    const previousWindow = patientLogs.filter((log) => log.date >= previousStart && log.date < currentStart);

    const currentMood = average(currentWindow.map((log) => METRIC_SCORE.mood[log.mood] || 0));
    const previousMood = average(previousWindow.map((log) => METRIC_SCORE.mood[log.mood] || 0));

    const currentSleep = average(currentWindow.map((log) => METRIC_SCORE.sleep[log.sleep] || 0));
    const previousSleep = average(previousWindow.map((log) => METRIC_SCORE.sleep[log.sleep] || 0));

    const currentActivity = average(currentWindow.map((log) => METRIC_SCORE.activity[log.activity] || 0));
    const previousActivity = average(previousWindow.map((log) => METRIC_SCORE.activity[log.activity] || 0));

    const currentMedication = average(currentWindow.map((log) => METRIC_SCORE.medication[log.medication] || 0));
    const previousMedication = average(previousWindow.map((log) => METRIC_SCORE.medication[log.medication] || 0));

    const currentAgitationRate = average(currentWindow.map((log) => (log.mood === 'agitated' ? 100 : 0)));
    const previousAgitationRate = average(previousWindow.map((log) => (log.mood === 'agitated' ? 100 : 0)));

    const trendMetrics = [
      summarizeDirection({ metricName: 'Sleep', current: currentSleep, previous: previousSleep, higherIsBetter: true }),
      summarizeDirection({ metricName: 'Mood', current: currentMood, previous: previousMood, higherIsBetter: true }),
      summarizeDirection({ metricName: 'Medication adherence', current: currentMedication, previous: previousMedication, higherIsBetter: true }),
      summarizeDirection({ metricName: 'Activity', current: currentActivity, previous: previousActivity, higherIsBetter: true }),
      summarizeDirection({ metricName: 'Agitation', current: currentAgitationRate, previous: previousAgitationRate, higherIsBetter: false })
    ];

    const selfDeclineSignals = trendMetrics.filter((m) => m.direction === 'declining').length;
    const selfStatus = selfDeclineSignals >= 3
      ? 'declining'
      : selfDeclineSignals >= 2
        ? 'slight_decline'
        : trendMetrics.some((m) => m.direction === 'improving')
          ? 'improving'
          : 'stable';

    const selfSummary = selfStatus === 'declining'
      ? 'Condition is declining compared to the previous period.'
      : selfStatus === 'slight_decline'
        ? 'Condition is slightly declining compared to the previous period.'
        : selfStatus === 'improving'
          ? 'Condition is improving compared to the previous period.'
          : 'Condition appears stable compared to the previous period.';

    const logsByPatient = cohortLogs.reduce((acc, log) => {
      const key = String(log.patientId);
      if (!acc[key]) acc[key] = [];
      acc[key].push(log);
      return acc;
    }, {});

    const targetSignals = buildPatientSignalSummary(logsByPatient[String(patientId)] || []);
    const targetPatternFlags = {
      poorSleep: targetSignals.poorSleepRate >= 40,
      missedMeds: targetSignals.missedMedRate >= 30,
      lowActivity: targetSignals.lowActivityRate >= 40,
      highConfusion: targetSignals.highConfusionRate >= 30
    };

    const similarPatientIds = Object.entries(logsByPatient)
      .filter(([id]) => id !== String(patientId))
      .map(([id, logs]) => {
        const s = buildPatientSignalSummary(logs);
        const flags = {
          poorSleep: s.poorSleepRate >= 40,
          missedMeds: s.missedMedRate >= 30,
          lowActivity: s.lowActivityRate >= 40,
          highConfusion: s.highConfusionRate >= 30
        };

        const overlap = Object.keys(flags).reduce(
          (count, key) => (flags[key] === targetPatternFlags[key] ? count + 1 : count),
          0
        );

        return { id, overlap, stats: s, logs };
      })
      .filter((p) => p.overlap >= 3);

    const cohortCount = similarPatientIds.length;
    const agitationAmongSimilar = cohortCount
      ? Math.round((similarPatientIds.filter((p) => p.stats.agitatedRate >= 30).length / cohortCount) * 100)
      : 0;

    const worseningAmongSimilar = cohortCount
      ? Math.round(
        (similarPatientIds.filter((p) => {
          const midpoint = Math.floor(p.logs.length / 2) || 1;
          const firstHalf = p.logs.slice(0, midpoint);
          const secondHalf = p.logs.slice(midpoint);
          const firstRisk = average(firstHalf.map((log) => computeDailyRiskDelta(log)));
          const secondRisk = average(secondHalf.map((log) => computeDailyRiskDelta(log)));
          return secondRisk - firstRisk > 4;
        }).length / cohortCount) * 100
      )
      : 0;

    const crossInsight = cohortCount
      ? `Among ${cohortCount} similar patients, ${agitationAmongSimilar}% show agitation when sleep quality is poor.`
      : 'Not enough similar-patient data yet. Continue logging to unlock stronger cohort insights.';

    const recommendedActions = [];
    if (targetSignals.poorSleepRate >= 40) recommendedActions.push('Improve sleep routine and reduce evening stimulation.');
    if (targetSignals.missedMedRate >= 30) recommendedActions.push('Strengthen medication reminder and confirmation workflow.');
    if (targetSignals.lowActivityRate >= 40) recommendedActions.push('Introduce short guided daytime movement blocks.');
    if (recommendedActions.length === 0) recommendedActions.push('Maintain current care routine and continue daily logging.');

    const combinedRisk = (selfStatus === 'declining' || selfStatus === 'slight_decline') && worseningAmongSimilar >= 50
      ? 'early_risk'
      : selfStatus === 'declining'
        ? 'watch_closely'
        : 'stable';

    const combinedMessage = combinedRisk === 'early_risk'
      ? 'Early risk detected based on personal decline and similar patient patterns.'
      : combinedRisk === 'watch_closely'
        ? 'Personal trend shows decline. Monitor closely over the next 7-10 days.'
        : 'No strong short-term deterioration signal detected.';

    res.json({
      patientId,
      windows: {
        currentDays,
        previousDays,
        cohortDays
      },
      selfComparison: {
        status: selfStatus,
        summary: selfSummary,
        metrics: trendMetrics
      },
      crossPatientComparison: {
        similarPatientCount: cohortCount,
        agitationPercentWhenPoorSleep: agitationAmongSimilar,
        worseningPercent: worseningAmongSimilar,
        insight: crossInsight,
        recommendedActions
      },
      combinedIntelligence: {
        level: combinedRisk,
        message: combinedMessage
      },
      note: 'Supportive intelligence only. Not a medical diagnosis.'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/medical-report-comparison/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const days = Math.max(7, Math.min(180, Number(req.query.days || 60)));

    const since = new Date();
    since.setDate(since.getDate() - days + 1);
    since.setHours(0, 0, 0, 0);

    const [patientReports, cohortReports] = await Promise.all([
      Report.find({ patientId, generatedAt: { $gte: since } })
        .sort({ generatedAt: -1 })
        .lean(),
      Report.find({ generatedAt: { $gte: since } }).lean()
    ]);

    if (!patientReports.length) {
      return res.json({
        periodDays: days,
        patient: {
          reportCount: 0,
          latestTrend: 'unknown',
          decliningPercent: 0,
          avgRiskScore: 0,
          avgHighRiskAlerts: 0
        },
        cohort: {
          reportCount: cohortReports.length,
          decliningPercent: 0,
          avgRiskScore: 0,
          avgHighRiskAlerts: 0
        },
        insight: 'No medical reports available yet for this patient. Generate daily/weekly reports to enable comparison.',
        recommendation: 'Start consistent report generation for at least 2 weeks.'
      });
    }

    const toPercent = (value) => Math.round(value * 100);
    const avg = (arr, mapper) => (arr.length ? arr.reduce((sum, item) => sum + mapper(item), 0) / arr.length : 0);

    const patientDecliningRate = avg(patientReports, (r) => (r.riskTrend === 'declining' ? 1 : 0));
    const patientAvgRisk = avg(patientReports, (r) => Number(r.averageRiskScore || 0));
    const patientAvgHighRiskAlerts = avg(patientReports, (r) => Number(r.highRiskAlerts || 0));

    const cohortDecliningRate = avg(cohortReports, (r) => (r.riskTrend === 'declining' ? 1 : 0));
    const cohortAvgRisk = avg(cohortReports, (r) => Number(r.averageRiskScore || 0));
    const cohortAvgHighRiskAlerts = avg(cohortReports, (r) => Number(r.highRiskAlerts || 0));

    const latest = patientReports[0];
    const patientDecliningPercent = toPercent(patientDecliningRate);
    const cohortDecliningPercent = toPercent(cohortDecliningRate);
    const patientAboveCohortDecline = patientDecliningPercent - cohortDecliningPercent;

    let insight = 'Report trajectory is broadly aligned with similar patients.';
    if (patientAboveCohortDecline >= 15) {
      insight = `Declining report trend is ${patientAboveCohortDecline}% higher than cohort baseline in the last ${days} days.`;
    } else if (patientAboveCohortDecline <= -10) {
      insight = `Declining report trend is ${Math.abs(patientAboveCohortDecline)}% lower than cohort baseline, indicating stronger stability.`;
    }

    let recommendation = 'Maintain current care plan and continue weekly report review.';
    if (patientAboveCohortDecline >= 15 || patientAvgHighRiskAlerts > cohortAvgHighRiskAlerts + 1) {
      recommendation = 'Escalate proactive monitoring and review sleep/medication adherence with clinician.';
    } else if (patientAvgRisk < cohortAvgRisk - 8) {
      recommendation = 'Current plan appears effective. Keep reinforcement of routines that are working.';
    }

    res.json({
      periodDays: days,
      patient: {
        reportCount: patientReports.length,
        latestTrend: latest?.riskTrend || 'unknown',
        decliningPercent: patientDecliningPercent,
        avgRiskScore: Number(patientAvgRisk.toFixed(1)),
        avgHighRiskAlerts: Number(patientAvgHighRiskAlerts.toFixed(1))
      },
      cohort: {
        reportCount: cohortReports.length,
        decliningPercent: cohortDecliningPercent,
        avgRiskScore: Number(cohortAvgRisk.toFixed(1)),
        avgHighRiskAlerts: Number(cohortAvgHighRiskAlerts.toFixed(1))
      },
      delta: {
        decliningPercent: patientDecliningPercent - cohortDecliningPercent,
        avgRiskScore: Number((patientAvgRisk - cohortAvgRisk).toFixed(1)),
        avgHighRiskAlerts: Number((patientAvgHighRiskAlerts - cohortAvgHighRiskAlerts).toFixed(1))
      },
      insight,
      recommendation
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper to get date range based on report type
const getDateRange = (reportType) => {
  const endDate = new Date();
  const startDate = new Date();

  switch (reportType) {
    case 'weekly':
      startDate.setDate(endDate.getDate() - 7);
      break;
    case 'monthly':
      startDate.setMonth(endDate.getMonth() - 1);
      break;
    case 'yearly':
      startDate.setFullYear(endDate.getFullYear() - 1);
      break;
    default:
      startDate.setDate(endDate.getDate() - 7);
  }

  return { startDate, endDate };
};

// Helper to generate PDF report
const generatePDF = (reportData) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const fileName = `patient_report_${reportData.patientId}_${Date.now()}.pdf`;
    const filePath = path.join(__dirname, '../reports', fileName);

    // Create reports directory if it doesn't exist
    const reportsDir = path.dirname(filePath);
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Title
    doc.fontSize(24).font('Helvetica-Bold').text('Patient Health Report', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
    doc.moveDown();

    // Patient Info
    doc.fontSize(14).font('Helvetica-Bold').text('Patient Information', { underline: true });
    doc.fontSize(11).font('Helvetica');
    doc.text(`Name: ${reportData.patientName}`);
    doc.text(`Age: ${reportData.patientAge}`);
    doc.text(`Report Period: ${reportData.reportType.toUpperCase()}`);
    doc.text(`Date Range: ${reportData.startDate.toLocaleDateString()} - ${reportData.endDate.toLocaleDateString()}`);
    doc.moveDown();

    // Summary Metrics
    doc.fontSize(14).font('Helvetica-Bold').text('Summary Metrics', { underline: true });
    doc.fontSize(11).font('Helvetica');
    doc.text(`Total Alerts: ${reportData.totalAlerts}`, { continued: true });
    doc.text(`  |  High Risk Alerts: ${reportData.highRiskAlerts}`);
    doc.text(`Total Events: ${reportData.totalEvents}`);
    doc.text(`Average Risk Score: ${reportData.averageRiskScore.toFixed(2)}/100`);
    doc.moveDown();

    // Risk Assessment
    doc.fontSize(14).font('Helvetica-Bold').text('Risk Assessment', { underline: true });
    doc.fontSize(11).font('Helvetica');
    
    const trendColor = reportData.riskTrend === 'improving' ? 'Improving ✓' : reportData.riskTrend === 'stable' ? 'Stable —' : 'Declining ✗';
    doc.text(`Risk Trend: ${trendColor}`);
    doc.text(`Deterioration Rate: ${reportData.deteriorationRate > 0 ? '+' : ''}${reportData.deteriorationRate.toFixed(1)}%`);
    doc.moveDown();

    // Current State History
    if (reportData.stateChanges && reportData.stateChanges.length > 0) {
      doc.fontSize(14).font('Helvetica-Bold').text('State Changes', { underline: true });
      doc.fontSize(11).font('Helvetica');
      reportData.stateChanges.forEach(change => {
        doc.text(`• ${change}`);
      });
      doc.moveDown();
    }

    // Alert Breakdown
    doc.fontSize(14).font('Helvetica-Bold').text('Alert Breakdown', { underline: true });
    doc.fontSize(11).font('Helvetica');
    doc.text(`Low Risk: ${reportData.alertBreakdown?.low || 0}`);
    doc.text(`Medium Risk: ${reportData.alertBreakdown?.medium || 0}`);
    doc.text(`High Risk: ${reportData.alertBreakdown?.high || 0}`);
    doc.moveDown();

    // Recommendations
    if (reportData.recommendations && reportData.recommendations.length > 0) {
      doc.fontSize(14).font('Helvetica-Bold').text('Clinical Recommendations', { underline: true });
      doc.fontSize(11).font('Helvetica');
      reportData.recommendations.forEach(rec => {
        doc.text(`• ${rec}`, { align: 'left' });
      });
      doc.moveDown();
    }

    // Summary
    if (reportData.summary) {
      doc.fontSize(14).font('Helvetica-Bold').text('Summary', { underline: true });
      doc.fontSize(11).font('Helvetica');
      doc.text(reportData.summary, { align: 'left' });
    }

    doc.end();

    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
  });
};

// Generate report and return as download
router.post('/generate', async (req, res) => {
  try {
    const { patientId, reportType } = req.body;
    const userId = req.user?.id || null;

    if (!patientId || !reportType) {
      return res.status(400).json({ message: 'patientId and reportType are required' });
    }

    const { startDate, endDate } = getDateRange(reportType);

    // Fetch patient info
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Fetch alerts and events in date range
    const [alerts, events] = await Promise.all([
      Alert.find({
        patientId,
        timestamp: { $gte: startDate, $lte: endDate }
      }).lean(),
      Event.find({
        patientId,
        timestamp: { $gte: startDate, $lte: endDate }
      }).lean()
    ]);

    // Calculate metrics
    const highRiskAlerts = alerts.filter(a => a.riskLevel === 'HIGH').length;
    const mediumRiskAlerts = alerts.filter(a => a.riskLevel === 'MEDIUM').length;
    const lowRiskAlerts = alerts.filter(a => a.riskLevel === 'LOW').length;
    
    const averageRiskScore = alerts.length > 0
      ? Math.round(alerts.reduce((sum, a) => sum + (a.riskLevel === 'HIGH' ? 80 : a.riskLevel === 'MEDIUM' ? 50 : 20), 0) / alerts.length)
      : 0;

    // Calculate deterioration trend
    const firstHalf = alerts.slice(0, Math.floor(alerts.length / 2)).length;
    const secondHalf = alerts.slice(Math.floor(alerts.length / 2)).length;
    let deteriorationRate = 0;
    let riskTrend = 'stable';
    
    if (firstHalf > 0) {
      deteriorationRate = ((secondHalf - firstHalf) / firstHalf) * 100;
      riskTrend = deteriorationRate > 5 ? 'declining' : deteriorationRate < -5 ? 'improving' : 'stable';
    }

    // Extract state changes
    const stateChanges = events
      .filter(e => e.eventType === 'state_change')
      .map(e => `${e.metadata?.oldState || 'UNKNOWN'} → ${e.metadata?.newState || 'UNKNOWN'} on ${new Date(e.timestamp).toLocaleDateString()}`)
      .slice(-10); // Last 10 state changes

    // Generate recommendations
    const recommendations = [];
    if (highRiskAlerts > 5) {
      recommendations.push('Increase monitoring frequency due to high alert count.');
    }
    if (riskTrend === 'declining') {
      recommendations.push('Consider medication review or intervention plan adjustment.');
    }
    if (events.length === 0) {
      recommendations.push('Ensure monitoring systems are functioning properly.');
    } else {
      recommendations.push('Continue current care plan with regular monitoring.');
    }

    // Create summary
    const summary = `Patient ${patient.name} (Age ${patient.age}) showed a ${riskTrend} trend with ${highRiskAlerts} high-risk alerts and ${alerts.length} total alerts during the ${reportType} reporting period. Average risk score: ${averageRiskScore}/100.`;

    // Generate PDF
    const reportData = {
      patientId,
      patientName: patient.name,
      patientAge: patient.age,
      reportType,
      startDate,
      endDate,
      totalAlerts: alerts.length,
      highRiskAlerts,
      totalEvents: events.length,
      averageRiskScore,
      stateChanges,
      riskTrend,
      deteriorationRate,
      alertBreakdown: { low: lowRiskAlerts, medium: mediumRiskAlerts, high: highRiskAlerts },
      recommendations,
      summary
    };

    const pdfPath = await generatePDF(reportData);

    // Save report record to DB
    const report = await Report.create({
      patientId,
      reportType,
      startDate,
      endDate,
      totalAlerts: alerts.length,
      highRiskAlerts,
      totalEvents: events.length,
      averageRiskScore,
      stateChanges,
      riskTrend,
      deteriorationRate,
      summary,
      recommendations,
      pdfPath,
      createdBy: userId
    });

    // Send file as download
    res.download(pdfPath, `patient_report_${patient.name}_${reportType}.pdf`, (err) => {
      if (err) console.error('Download error:', err);
    });
  } catch (error) {
    console.error('Report generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get report history for a patient
router.get('/history/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;

    const reports = await Report.find({ patientId })
      .select('reportType startDate endDate generatedAt riskTrend deteriorationRate totalAlerts')
      .sort({ generatedAt: -1 })
      .limit(20)
      .lean();

    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
