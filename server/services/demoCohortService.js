const Patient = require('../models/Patient');
const Task = require('../models/Task');
const Alert = require('../models/Alert');
const DailyHealthLog = require('../models/DailyHealthLog');
const InterventionEffect = require('../models/InterventionEffect');
const Report = require('../models/Report');

const STAGE_BY_STATE = {
  STABLE: 'mild',
  MILD_RISK: 'mild',
  ELEVATED_RISK: 'moderate',
  CRITICAL: 'severe'
};

const toStage = (patient) => {
  if (!patient) return 'moderate';
  const explicit = String(patient.dementiaSeverity || '').toLowerCase();
  if (['mild', 'moderate', 'severe'].includes(explicit)) return explicit;
  return STAGE_BY_STATE[String(patient.currentState || '').toUpperCase()] || 'moderate';
};

const startOfDay = (date) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

const daysAgo = (days) => startOfDay(new Date(Date.now() - days * 24 * 60 * 60 * 1000));

const average = (values = []) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);

const aggregateLogs = (logs = []) => ({
  agitationLevel: average(logs.map((log) => Number(log.agitationLevel ?? (log.mood === 'agitated' ? 8 : log.mood === 'confused' ? 5 : 2)))),
  sleepHours: average(logs.map((log) => Number(log.sleepHours ?? (log.sleep === 'poor' ? 4 : log.sleep === 'disturbed' ? 6 : 7.5)))),
  appetiteLevel: average(logs.map((log) => Number(log.appetiteLevel ?? (log.food === 'skipped' ? 4 : 7)))),
  moodScore: average(logs.map((log) => Number(log.moodScore ?? (log.mood === 'agitated' ? 3 : log.mood === 'confused' ? 5 : 8)))),
  tasksCompleted: logs.reduce((sum, log) => sum + Number(log.tasksCompleted || 0), 0),
  exerciseMinutes: logs.reduce((sum, log) => sum + Number(log.exerciseMinutes || 0), 0),
  socialInteractions: logs.reduce((sum, log) => sum + Number(log.socialInteractions || 0), 0),
  alertsTriggered: logs.reduce((sum, log) => sum + Number(log.alertsTriggered || 0), 0)
});

const buildLog = ({
  patientId,
  daysBack,
  mood,
  sleep,
  medication,
  food,
  activity,
  confusionLevel = 'none',
  gotLost = false,
  agitationLevel,
  sleepHours,
  appetiteLevel,
  moodScore,
  tasksCompleted,
  tasksTotal,
  exerciseMinutes,
  socialInteractions,
  alertsTriggered,
  locationIncidents,
  sosEvents
}) => ({
  patientId,
  date: daysAgo(daysBack),
  mood,
  confusionLevel,
  gotLost,
  medication,
  sleep,
  food,
  activity,
  agitationLevel,
  sleepHours,
  appetiteLevel,
  moodScore,
  tasksCompleted,
  tasksTotal,
  exerciseMinutes,
  socialInteractions,
  alertsTriggered,
  locationIncidents,
  sosEvents,
  medicationSource: 'manual',
  activitySource: 'manual',
  foodSource: 'manual',
  interventionNotes: ''
});

const profileConfig = {
  stable: {
    agitation: 2.8,
    sleepHours: 7.2,
    appetite: 7.4,
    moodScore: 7.8,
    tasks: 4,
    exercise: 26,
    social: 3,
    alerts: 0.3,
    confusion: 'none',
    gotLostChance: 0.01
  },
  sleep_risk: {
    agitation: 5.8,
    sleepHours: 5.3,
    appetite: 5.8,
    moodScore: 5.1,
    tasks: 3,
    exercise: 14,
    social: 2,
    alerts: 1.1,
    confusion: 'mild',
    gotLostChance: 0.03
  },
  confusion_risk: {
    agitation: 7.0,
    sleepHours: 4.8,
    appetite: 5.1,
    moodScore: 4.2,
    tasks: 2,
    exercise: 9,
    social: 1,
    alerts: 1.8,
    confusion: 'moderate',
    gotLostChance: 0.08
  }
};

const bounded = (value, min, max) => Math.max(min, Math.min(max, value));

const periodicNoise = (offset, amplitude = 1) => {
  const a = Math.sin(offset / 4) * amplitude;
  const b = Math.cos(offset / 9) * amplitude * 0.6;
  return a + b;
};

const profileTrendShift = (profile, offset) => {
  // Early period is noisier/worse; recent period shows mild improvement for demo storytelling.
  const oldPeriod = offset > 75;
  const recentPeriod = offset < 35;

  if (profile === 'stable') {
    if (oldPeriod) return { mood: -0.4, sleep: -0.3, agitation: 0.4, alerts: 0.3 };
    if (recentPeriod) return { mood: 0.5, sleep: 0.4, agitation: -0.4, alerts: -0.2 };
    return { mood: 0, sleep: 0, agitation: 0, alerts: 0 };
  }

  if (profile === 'sleep_risk') {
    if (oldPeriod) return { mood: -0.6, sleep: -0.7, agitation: 0.7, alerts: 0.4 };
    if (recentPeriod) return { mood: 0.7, sleep: 0.8, agitation: -0.8, alerts: -0.4 };
    return { mood: 0, sleep: 0, agitation: 0, alerts: 0 };
  }

  if (oldPeriod) return { mood: -0.5, sleep: -0.5, agitation: 0.5, alerts: 0.5 };
  if (recentPeriod) return { mood: 0.4, sleep: 0.5, agitation: -0.5, alerts: -0.3 };
  return { mood: 0, sleep: 0, agitation: 0, alerts: 0 };
};

const deriveQualitativeState = ({ moodScore, sleepHours, agitationLevel, confusionLevel }) => {
  const mood = moodScore >= 7 ? 'calm' : moodScore >= 5 ? 'confused' : 'agitated';
  const sleep = sleepHours >= 6.5 ? 'good' : sleepHours >= 5.2 ? 'disturbed' : 'poor';
  const activity = agitationLevel <= 3 ? 'high' : agitationLevel <= 6 ? 'medium' : 'low';

  let derivedConfusion = confusionLevel;
  if (moodScore < 4.3 && agitationLevel > 7) derivedConfusion = 'severe';
  else if (moodScore < 5.3) derivedConfusion = derivedConfusion === 'none' ? 'mild' : derivedConfusion;

  return { mood, sleep, activity, confusionLevel: derivedConfusion };
};

const buildPatientSeries = (patientId, profile) => {
  const baseline = profileConfig[profile] || profileConfig.sleep_risk;
  const logs = [];

  for (let offset = 119; offset >= 0; offset -= 1) {
    const trend = profileTrendShift(profile, offset);
    const noise = periodicNoise(offset, 0.8);

    const agitationLevel = bounded(baseline.agitation + trend.agitation + noise, 0, 10);
    const sleepHours = bounded(baseline.sleepHours + trend.sleep - noise * 0.3, 3, 9);
    const appetiteLevel = bounded(baseline.appetite + noise * 0.4, 2, 10);
    const moodScore = bounded(baseline.moodScore + trend.mood - noise * 0.4, 1, 10);
    const tasksCompleted = bounded(Math.round(baseline.tasks + noise * 0.7), 0, 5);
    const tasksTotal = 5;
    const exerciseMinutes = bounded(Math.round(baseline.exercise + noise * 6), 0, 50);
    const socialInteractions = bounded(Math.round(baseline.social + noise * 0.6), 0, 5);
    const alertsTriggered = bounded(Math.round(baseline.alerts + trend.alerts + Math.max(0, noise * 0.6)), 0, 4);

    const isMissedMedication = (profile !== 'stable' && offset % 11 === 0) || (profile === 'confusion_risk' && offset % 7 === 0);
    const isSkippedFood = (profile !== 'stable' && offset % 13 === 0);
    const gotLost = profile === 'confusion_risk' ? (offset % 23 === 0 || (offset < 20 && offset % 10 === 0)) : Math.random() < baseline.gotLostChance;
    const locationIncidents = gotLost ? 1 : 0;

    const qualitative = deriveQualitativeState({
      moodScore,
      sleepHours,
      agitationLevel,
      confusionLevel: baseline.confusion
    });

    logs.push(buildLog({
      patientId,
      daysBack: offset,
      mood: qualitative.mood,
      sleep: qualitative.sleep,
      medication: isMissedMedication ? 'missed' : 'taken',
      food: isSkippedFood ? 'skipped' : 'normal',
      activity: qualitative.activity,
      confusionLevel: qualitative.confusionLevel,
      gotLost,
      agitationLevel: Number(agitationLevel.toFixed(1)),
      sleepHours: Number(sleepHours.toFixed(1)),
      appetiteLevel: Number(appetiteLevel.toFixed(1)),
      moodScore: Number(moodScore.toFixed(1)),
      tasksCompleted,
      tasksTotal,
      exerciseMinutes,
      socialInteractions,
      alertsTriggered,
      locationIncidents,
      sosEvents: profile === 'confusion_risk' && offset % 45 === 0 ? 1 : 0
    }));
  }

  return logs;
};

const buildIntervention = ({ patientId, interventionType, description, logs, offsetDays = 14 }) => {
  const sortedLogs = [...logs].sort((a, b) => a.date - b.date);
  const anchorDate = daysAgo(offsetDays);
  const baselineStartDate = daysAgo(offsetDays + 14);
  const baselineEndDate = daysAgo(offsetDays + 1);
  const measurementStartDate = daysAgo(offsetDays);
  const measurementEndDate = daysAgo(Math.max(0, offsetDays - 13));

  const baselineLogs = sortedLogs.filter((log) => log.date >= baselineStartDate && log.date <= baselineEndDate);
  const measurementLogs = sortedLogs.filter((log) => log.date >= measurementStartDate && log.date <= measurementEndDate);

  if (!baselineLogs.length || !measurementLogs.length) return null;

  const baseline = aggregateLogs(baselineLogs);
  const measurement = aggregateLogs(measurementLogs);

  const effects = {
    agitationLevel: Number((measurement.agitationLevel - baseline.agitationLevel).toFixed(2)),
    sleepHours: Number((measurement.sleepHours - baseline.sleepHours).toFixed(2)),
    appetiteLevel: Number((measurement.appetiteLevel - baseline.appetiteLevel).toFixed(2)),
    moodScore: Number((measurement.moodScore - baseline.moodScore).toFixed(2)),
    tasksCompleted: measurement.tasksCompleted - baseline.tasksCompleted,
    exerciseMinutes: measurement.exerciseMinutes - baseline.exerciseMinutes,
    socialInteractions: measurement.socialInteractions - baseline.socialInteractions,
    alertsTriggered: baseline.alertsTriggered - measurement.alertsTriggered
  };

  const positiveSignals = [
    effects.sleepHours > 0.3,
    effects.moodScore > 0.3,
    effects.exerciseMinutes > 0,
    effects.socialInteractions > 0,
    effects.alertsTriggered > 0,
    effects.agitationLevel < 0
  ].filter(Boolean).length;

  return {
    patientId,
    interventionType,
    description,
    appliedDate: anchorDate,
    baselineStartDate,
    baselineEndDate,
    measurementStartDate,
    measurementEndDate,
    baseline,
    measurement,
    effects,
    overallOutcome: positiveSignals >= 4 ? 'positive' : 'neutral',
    confidence: 0.82,
    initiatedBy: null,
    createdBy: null
  };
};

const deriveReportTrend = (logs) => {
  if (logs.length < 2) return { riskTrend: 'stable', deteriorationRate: 0 };

  const midpoint = Math.floor(logs.length / 2);
  const baseline = aggregateLogs(logs.slice(0, midpoint));
  const recent = aggregateLogs(logs.slice(midpoint));
  const baselineRisk = Number(baseline.agitationLevel || 0) + Number((baseline.sleepHours ? 8 - baseline.sleepHours : 0));
  const recentRisk = Number(recent.agitationLevel || 0) + Number((recent.sleepHours ? 8 - recent.sleepHours : 0));
  const delta = recentRisk - baselineRisk;

  return {
    riskTrend: delta > 0.6 ? 'declining' : delta < -0.6 ? 'improving' : 'stable',
    deteriorationRate: Number((delta * 8).toFixed(2))
  };
};

const buildReportDocs = ({ patientId, logs }) => {
  if (!logs.length) return [];

  const docs = [];
  const sorted = [...logs].sort((a, b) => a.date - b.date);

  // Weekly reports for the last 12 weeks.
  for (let i = 0; i < 12; i += 1) {
    const end = daysAgo(i * 7);
    const start = daysAgo(i * 7 + 6);
    const windowLogs = sorted.filter((log) => log.date >= start && log.date <= end);
    if (!windowLogs.length) continue;

    const trend = deriveReportTrend(windowLogs);
    docs.push({
      patientId,
      reportType: 'weekly',
      startDate: start,
      endDate: end,
      generatedAt: end,
      totalAlerts: windowLogs.reduce((sum, log) => sum + Number(log.alertsTriggered || 0), 0),
      highRiskAlerts: windowLogs.filter((log) => Number(log.alertsTriggered || 0) >= 2).length,
      totalEvents: windowLogs.length,
      averageRiskScore: Number(average(windowLogs.map((log) => Number(log.agitationLevel || 0) * 10)).toFixed(1)),
      stateChanges: [],
      riskTrend: trend.riskTrend,
      deteriorationRate: trend.deteriorationRate,
      summary: 'Demo weekly report generated from seeded daily health logs.',
      recommendations: ['Continue monitoring sleep and medication adherence.', 'Review caregiver interventions from this period.'],
      createdBy: null
    });
  }

  // Monthly report for last 30 days.
  const monthlyStart = daysAgo(29);
  const monthlyEnd = daysAgo(0);
  const monthlyLogs = sorted.filter((log) => log.date >= monthlyStart && log.date <= monthlyEnd);
  if (monthlyLogs.length) {
    const trend = deriveReportTrend(monthlyLogs);
    docs.push({
      patientId,
      reportType: 'monthly',
      startDate: monthlyStart,
      endDate: monthlyEnd,
      generatedAt: monthlyEnd,
      totalAlerts: monthlyLogs.reduce((sum, log) => sum + Number(log.alertsTriggered || 0), 0),
      highRiskAlerts: monthlyLogs.filter((log) => Number(log.alertsTriggered || 0) >= 2).length,
      totalEvents: monthlyLogs.length,
      averageRiskScore: Number(average(monthlyLogs.map((log) => Number(log.agitationLevel || 0) * 10)).toFixed(1)),
      stateChanges: [],
      riskTrend: trend.riskTrend,
      deteriorationRate: trend.deteriorationRate,
      summary: 'Demo monthly report generated from seeded daily health logs.',
      recommendations: ['Prioritize recurring interventions with positive outcomes.', 'Use comparative patient dashboard for cohort calibration.'],
      createdBy: null
    });
  }

  return docs;
};

const seedTasks = async (patientId, prefix) => {
  const existingCount = await Task.countDocuments({ patientId });
  if (existingCount > 0) return;

  const now = Date.now();
  await Task.insertMany([
    {
      patientId,
      title: `${prefix} medication review`,
      type: 'medication',
      scheduledTime: new Date(now + 30 * 60 * 1000),
      status: 'pending'
    },
    {
      patientId,
      title: `${prefix} short walk`,
      type: 'appointment',
      scheduledTime: new Date(now + 90 * 60 * 1000),
      status: 'pending'
    }
  ]);
};

const seedAlerts = async (patientId, messages) => {
  const existingCount = await Alert.countDocuments({ patientId });
  if (existingCount > 0) return;

  await Alert.insertMany(messages.map((message) => ({
    patientId,
    ...message
  })));
};

const profileFromPatient = (patient) => {
  const state = String(patient?.currentState || '').toUpperCase();
  if (state === 'CRITICAL') return 'confusion_risk';
  if (state === 'ELEVATED_RISK') return 'sleep_risk';
  return 'stable';
};

const ensurePatientDemoData = async ({ patient, caregiverUser, profile, alerts, interventionType, interventionDescription }) => {
  const [logCount, interventionCount, reportCount] = await Promise.all([
    DailyHealthLog.countDocuments({ patientId: patient._id }),
    InterventionEffect.countDocuments({ patientId: patient._id }),
    Report.countDocuments({ patientId: patient._id })
  ]);

  let logs = [];
  if (logCount === 0) {
    logs = buildPatientSeries(patient._id, profile);
    await DailyHealthLog.insertMany(logs);
  }

  await seedTasks(patient._id, String(patient.name || 'Patient').split(' ')[0]);
  await seedAlerts(patient._id, alerts);

  const sourceLogs = logs.length
    ? logs
    : await DailyHealthLog.find({ patientId: patient._id }).sort({ date: 1 }).lean();

  if (interventionCount === 0 && sourceLogs.length) {
    const interventionCandidates = [
      buildIntervention({
        patientId: patient._id,
        interventionType,
        description: interventionDescription,
        logs: sourceLogs,
        offsetDays: 70
      }),
      buildIntervention({
        patientId: patient._id,
        interventionType: 'schedule_change',
        description: 'Adjusted daily routine to reduce evening confusion and improve sleep quality.',
        logs: sourceLogs,
        offsetDays: 42
      }),
      buildIntervention({
        patientId: patient._id,
        interventionType: 'activity_added',
        description: 'Added guided light activity blocks and caregiver check-ins.',
        logs: sourceLogs,
        offsetDays: 21
      })
    ].filter(Boolean);

    if (interventionCandidates.length) {
      await InterventionEffect.insertMany(interventionCandidates);
    }
  }

  if (reportCount === 0 && sourceLogs.length) {
    const reportDocs = buildReportDocs({ patientId: patient._id, logs: sourceLogs });
    if (reportDocs.length) {
      await Report.insertMany(reportDocs);
    }
  }

  if (!Array.isArray(patient.caregiverIds) || !patient.caregiverIds.some((id) => String(id) === String(caregiverUser._id))) {
    patient.caregiverIds = Array.isArray(patient.caregiverIds) ? patient.caregiverIds : [];
    patient.caregiverIds.push(caregiverUser._id);
  }

  if (!Array.isArray(patient.caregivers) || !patient.caregivers.length) {
    patient.caregivers = [
      { name: caregiverUser.name || 'Caregiver', role: 'family', priorityLevel: 1 },
      { name: 'Support Nurse', role: 'medical', priorityLevel: 2 }
    ];
  }

  await patient.save();
};

const ensureCaregiverDemoCohort = async (caregiverUser) => {
  if (!caregiverUser?._id) {
    return { created: [], existing: [] };
  }

  const patientDefinitions = [
    {
      name: 'Alice Johnson',
      age: 74,
      riskScore: 18,
      currentState: 'STABLE',
      profile: 'stable',
      alerts: [{ message: 'Low activity monitor check completed.', riskLevel: 'LOW', acknowledged: true }],
      interventionType: 'activity_added',
      interventionDescription: 'Added a structured morning walk after breakfast.'
    },
    {
      name: 'George Patel',
      age: 79,
      riskScore: 48,
      currentState: 'ELEVATED_RISK',
      profile: 'sleep_risk',
      alerts: [
        { message: 'Two nights of poor sleep followed by agitation.', riskLevel: 'HIGH', acknowledged: false },
        { message: 'Medication adherence dropped below target.', riskLevel: 'MEDIUM', acknowledged: true }
      ],
      interventionType: 'schedule_change',
      interventionDescription: 'Moved evening reminders earlier and kept bedtime routine consistent.'
    },
    {
      name: 'Nora Lee',
      age: 71,
      riskScore: 12,
      currentState: 'STABLE',
      profile: 'stable',
      alerts: [{ message: 'Routine wellness check recorded.', riskLevel: 'LOW', acknowledged: true }],
      interventionType: 'activity_added',
      interventionDescription: 'Maintained daily social and mobility routine with light reminders.'
    },
    {
      name: 'Mary Chen',
      age: 82,
      riskScore: 66,
      currentState: 'CRITICAL',
      profile: 'confusion_risk',
      alerts: [
        { message: 'Orientation prompt needed after a disoriented walk.', riskLevel: 'HIGH', acknowledged: false },
        { message: 'Missed medication and short sleep window detected.', riskLevel: 'HIGH', acknowledged: false }
      ],
      interventionType: 'environment_change',
      interventionDescription: 'Added clearer lighting, labels, and a calmer evening environment.'
    }
  ];

  const existingPatients = await Patient.find({ caregiverIds: caregiverUser._id }).sort({ createdAt: 1 });

  for (const patient of existingPatients) {
    await ensurePatientDemoData({
      patient,
      caregiverUser,
      profile: profileFromPatient(patient),
      alerts: [{ message: 'Demo insight backfill completed for this patient.', riskLevel: 'LOW', acknowledged: true }],
      interventionType: 'schedule_change',
      interventionDescription: 'Added a consistency-focused routine to improve sleep and reduce agitation.'
    });
  }

  const existingNames = new Set(existingPatients.map((patient) => String(patient.name || '').trim().toLowerCase()));
  const missingDefinitions = patientDefinitions.filter((definition) => !existingNames.has(definition.name.toLowerCase()));

  if (!missingDefinitions.length) {
    return { created: [], existing: existingPatients };
  }

  const createdPatients = [];

  for (const definition of missingDefinitions) {
    const patient = await Patient.create({
      name: definition.name,
      age: definition.age,
      riskScore: definition.riskScore,
      currentState: definition.currentState,
      lastActivityTime: new Date(),
      caregivers: [
        { name: caregiverUser.name, role: 'family', priorityLevel: 1 },
        { name: 'Support Nurse', role: 'medical', priorityLevel: 2 }
      ],
      caregiverIds: [caregiverUser._id]
    });

    await ensurePatientDemoData({
      patient,
      caregiverUser,
      profile: definition.profile,
      alerts: definition.alerts,
      interventionType: definition.interventionType,
      interventionDescription: definition.interventionDescription
    });

    createdPatients.push({ ...patient.toObject() });
  }

  return { created: createdPatients, existing: existingPatients };
};

module.exports = { ensureCaregiverDemoCohort, toStage };
