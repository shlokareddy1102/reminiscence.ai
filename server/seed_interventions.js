const mongoose = require('mongoose');
const Patient = require('./models/Patient');
const InterventionEffect = require('./models/InterventionEffect');
const connectDB = require('./config/db');

const parseArgs = () => {
  const args = process.argv.slice(2);
  const flags = {};
  for (let index = 0; index < args.length; index += 1) {
    const entry = args[index];
    if (!entry.startsWith('--')) continue;
    const [key, inlineValue] = entry.slice(2).split('=');
    if (inlineValue !== undefined) {
      flags[key] = inlineValue;
      continue;
    }
    const nextValue = args[index + 1];
    if (nextValue && !nextValue.startsWith('--')) {
      flags[key] = nextValue;
      index += 1;
    } else {
      flags[key] = 'true';
    }
  }
  return flags;
};

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

const buildEffect = (seedIndex) => {
  const baseline = {
    agitationLevel: clamp(6.6 - seedIndex * 0.15 + Math.random() * 0.8, 2.8, 8.5),
    sleepHours: clamp(5.2 + seedIndex * 0.18 + Math.random(), 4.8, 8.5),
    appetiteLevel: clamp(5.0 + seedIndex * 0.12 + Math.random() * 0.7, 3.8, 8.5),
    moodScore: clamp(4.8 + seedIndex * 0.1 + Math.random() * 0.8, 2.8, 8.5),
    tasksCompleted: clamp(2.2 + seedIndex * 0.18 + Math.random(), 0.8, 6.5),
    exerciseMinutes: clamp(6 + seedIndex * 0.9 + Math.random() * 6, 4, 38),
    socialInteractions: clamp(1.8 + seedIndex * 0.2 + Math.random() * 1.5, 0.5, 7),
    alertsTriggered: clamp(4 - seedIndex * 0.25 + Math.random() * 1.2, 1, 6)
  };

  const measurement = {
    agitationLevel: clamp(baseline.agitationLevel - (0.9 + Math.random() * 1.4), 0.5, 10),
    sleepHours: clamp(baseline.sleepHours + (0.8 + Math.random() * 1.5), 0.5, 10),
    appetiteLevel: clamp(baseline.appetiteLevel + (0.5 + Math.random() * 1.2), 0.5, 10),
    moodScore: clamp(baseline.moodScore + (0.9 + Math.random() * 1.4), 0.5, 10),
    tasksCompleted: baseline.tasksCompleted + (1 + Math.random() * 2),
    exerciseMinutes: baseline.exerciseMinutes + (5 + Math.random() * 10),
    socialInteractions: baseline.socialInteractions + (0.5 + Math.random() * 2.5),
    alertsTriggered: clamp(baseline.alertsTriggered - (1 + Math.random() * 2), 0, 10)
  };

  const effects = {
    agitationLevel: measurement.agitationLevel - baseline.agitationLevel,
    sleepHours: measurement.sleepHours - baseline.sleepHours,
    appetiteLevel: measurement.appetiteLevel - baseline.appetiteLevel,
    moodScore: measurement.moodScore - baseline.moodScore,
    tasksCompleted: measurement.tasksCompleted - baseline.tasksCompleted,
    exerciseMinutes: measurement.exerciseMinutes - baseline.exerciseMinutes,
    socialInteractions: measurement.socialInteractions - baseline.socialInteractions,
    alertsTriggered: baseline.alertsTriggered - measurement.alertsTriggered
  };

  return {
    interventionType: seedIndex % 4 === 0 ? 'schedule_change' : seedIndex % 4 === 1 ? 'environment_change' : seedIndex % 4 === 2 ? 'activity_added' : 'medication_change',
    description: [
      'Simplified morning routine with visual cue cards',
      'Reduced evening noise and lighting in living space',
      'Added short guided walk after lunch',
      'Adjusted reminder timing for medication and hydration'
    ][seedIndex % 4],
    appliedDate: new Date(Date.now() - (28 - seedIndex * 3) * 24 * 60 * 60 * 1000),
    baselineStartDate: new Date(Date.now() - (35 - seedIndex * 3) * 24 * 60 * 60 * 1000),
    baselineEndDate: new Date(Date.now() - (28 - seedIndex * 3) * 24 * 60 * 60 * 1000),
    measurementStartDate: new Date(Date.now() - (21 - seedIndex * 3) * 24 * 60 * 60 * 1000),
    measurementEndDate: new Date(Date.now() - (14 - seedIndex * 3) * 24 * 60 * 60 * 1000),
    baseline,
    measurement,
    effects,
    overallOutcome: seedIndex % 3 === 0 ? 'significantly_positive' : 'positive',
    confidence: 0.72 + (seedIndex % 3) * 0.06,
    caregiverFeedback: seedIndex % 2 === 0 ? 'yes' : 'partially',
    caregiverNotes: 'Seeded positive intervention outcome for model training.',
    createdBy: null,
    initiatedBy: null
  };
};

const main = async () => {
  const flags = parseArgs();
  await connectDB();

  const patientId = flags.patientId || null;
  const patient = patientId
    ? await Patient.findById(patientId).lean()
    : await Patient.findOne({}).sort({ createdAt: 1 }).lean();

  if (!patient) {
    throw new Error('No patient found to seed interventions for.');
  }

  await InterventionEffect.deleteMany({ patientId: patient._id });

  const docs = Array.from({ length: Number(flags.count || 8) }, (_, index) => ({
    patientId: patient._id,
    ...buildEffect(index)
  }));

  await InterventionEffect.insertMany(docs);

  console.log(`Seeded ${docs.length} intervention effects for ${patient.name || patient._id}`);
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
