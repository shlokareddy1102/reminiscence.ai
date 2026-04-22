require('dotenv').config();

const mongoose = require('mongoose');
const User = require('../server/models/User');
const Patient = require('../server/models/Patient');
const DailyHealthLog = require('../server/models/DailyHealthLog');
const InterventionEffect = require('../server/models/InterventionEffect');

const avg = (arr, key) => {
  const vals = arr.map((x) => Number(x[key])).filter(Number.isFinite);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
};

const sum = (arr, key) => arr.map((x) => Number(x[key] || 0)).reduce((a, b) => a + b, 0);

const aggregateMetrics = (logs) => ({
  agitationLevel: avg(logs, 'agitationLevel'),
  sleepHours: avg(logs, 'sleepHours'),
  appetiteLevel: avg(logs, 'appetiteLevel'),
  moodScore: avg(logs, 'moodScore'),
  tasksCompleted: sum(logs, 'tasksCompleted'),
  exerciseMinutes: sum(logs, 'exerciseMinutes'),
  socialInteractions: sum(logs, 'socialInteractions'),
  alertsTriggered: sum(logs, 'alertsTriggered')
});

const ensureLast30DaysLogs = async (patientId) => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  for (let d = 29; d >= 0; d -= 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - d);

    const week = Math.floor((29 - d) / 7);
    const improving = d < 14;

    const baseMood = improving ? 7.2 : 5.3;
    const baseSleep = improving ? 7.0 : 5.8;
    const baseAgitation = improving ? 3.3 : 5.9;
    const wobble = Math.sin((29 - d) / 3) * 0.5;

    const moodScore = Math.max(1, Math.min(10, Number((baseMood + wobble).toFixed(1))));
    const sleepHours = Math.max(3, Math.min(10, Number((baseSleep + wobble * 0.6).toFixed(1))));
    const agitationLevel = Math.max(0, Math.min(10, Number((baseAgitation - wobble * 0.7).toFixed(1))));
    const appetiteLevel = Math.max(1, Math.min(10, Number((6.8 + (improving ? 0.4 : 0) + wobble * 0.3).toFixed(1))));

    const mood = moodScore >= 7 ? 'calm' : moodScore >= 5 ? 'confused' : 'agitated';
    const sleep = sleepHours >= 6.5 ? 'good' : sleepHours >= 5.2 ? 'disturbed' : 'poor';
    const activity = agitationLevel <= 3 ? 'high' : agitationLevel <= 6 ? 'medium' : 'low';
    const confusionLevel = mood === 'calm' ? 'none' : mood === 'confused' ? (week >= 2 ? 'mild' : 'moderate') : 'moderate';

    await DailyHealthLog.findOneAndUpdate(
      { patientId, date },
      {
        $setOnInsert: {
          patientId,
          date,
          mood,
          confusionLevel,
          gotLost: week === 0 && !improving && d % 9 === 0,
          medication: d % 11 === 0 ? 'missed' : 'taken',
          sleep,
          food: d % 13 === 0 ? 'skipped' : 'normal',
          activity,
          agitationLevel,
          sleepHours,
          appetiteLevel,
          moodScore,
          tasksCompleted: improving ? 4 : 2,
          tasksTotal: 5,
          exerciseMinutes: improving ? 22 : 12,
          socialInteractions: improving ? 3 : 1,
          alertsTriggered: improving ? 0 : 1,
          locationIncidents: 0,
          sosEvents: 0,
          medicationSource: 'manual',
          activitySource: 'manual',
          foodSource: 'manual',
          interventionNotes: 'demo backfill for insights'
        }
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
  }
};

const ensureMeasuredIntervention = async (patientId) => {
  const interventionCount = await InterventionEffect.countDocuments({ patientId });
  if (interventionCount > 0) return;

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const start = new Date(now);
  start.setDate(now.getDate() - 29);

  const last30 = await DailyHealthLog.find({ patientId, date: { $gte: start } }).sort({ date: 1 }).lean();
  if (last30.length < 28) return;

  const baselineLogs = last30.slice(0, 14);
  const measurementLogs = last30.slice(14, 28);

  const baseline = aggregateMetrics(baselineLogs);
  const measurement = aggregateMetrics(measurementLogs);

  await InterventionEffect.create({
    patientId,
    interventionType: 'schedule_change',
    description: 'Introduced a consistent sleep and medication routine.',
    appliedDate: new Date(last30[14].date),
    baselineStartDate: new Date(last30[0].date),
    baselineEndDate: new Date(last30[13].date),
    measurementStartDate: new Date(last30[14].date),
    measurementEndDate: new Date(last30[27].date),
    baseline,
    measurement,
    effects: {
      agitationLevel: Number((measurement.agitationLevel - baseline.agitationLevel).toFixed(2)),
      sleepHours: Number((measurement.sleepHours - baseline.sleepHours).toFixed(2)),
      appetiteLevel: Number((measurement.appetiteLevel - baseline.appetiteLevel).toFixed(2)),
      moodScore: Number((measurement.moodScore - baseline.moodScore).toFixed(2)),
      tasksCompleted: measurement.tasksCompleted - baseline.tasksCompleted,
      exerciseMinutes: measurement.exerciseMinutes - baseline.exerciseMinutes,
      socialInteractions: measurement.socialInteractions - baseline.socialInteractions,
      alertsTriggered: baseline.alertsTriggered - measurement.alertsTriggered
    },
    overallOutcome: 'positive',
    confidence: 0.84,
    caregiverNotes: 'Auto-generated demo intervention for graph visibility'
  });
};

const run = async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/reminiscence';
  await mongoose.connect(mongoUri);

  const caregiver = await User.findOne({ role: 'caregiver' }).lean();
  if (!caregiver) {
    throw new Error('No caregiver found');
  }

  const patients = await Patient.find({ caregiverIds: caregiver._id }).lean();
  if (!patients.length) {
    throw new Error('No caregiver-linked patients found');
  }

  for (const patient of patients) {
    await ensureLast30DaysLogs(patient._id);
    await ensureMeasuredIntervention(patient._id);

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const start = new Date(now);
    start.setDate(now.getDate() - 29);

    const logs = await DailyHealthLog.find({ patientId: patient._id, date: { $gte: start } }).select('date').lean();
    const interventions = await InterventionEffect.countDocuments({ patientId: patient._id });

    const weekBuckets = new Set(
      logs.map((log) => Math.floor((now - new Date(log.date)) / (7 * 24 * 60 * 60 * 1000)))
    );

    console.log(`${patient.name}: last30=${logs.length}, weeklyBuckets=${weekBuckets.size}, interventions=${interventions}`);
  }

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
