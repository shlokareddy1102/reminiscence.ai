const mongoose = require('mongoose');
const dotenv = require('dotenv');
const DailyHealthLog = require('./models/DailyHealthLog');
const Patient = require('./models/Patient');

dotenv.config();

const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/reminiscence';

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

const parseArgs = () => {
  const args = process.argv.slice(2);
  const parsed = {
    patientId: process.env.PATIENT_ID || null,
    days: Number.parseInt(process.env.SEED_DAILY_LOG_DAYS || '90', 10),
    keepExisting: false
  };

  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (token === '--patientId' && args[i + 1]) {
      parsed.patientId = args[i + 1];
      i += 1;
      continue;
    }

    if (token === '--days' && args[i + 1]) {
      parsed.days = Number.parseInt(args[i + 1], 10);
      i += 1;
      continue;
    }

    if (token === '--keep-existing') {
      parsed.keepExisting = true;
    }
  }

  if (!Number.isFinite(parsed.days) || parsed.days <= 0) {
    parsed.days = 90;
  }

  return parsed;
};

const buildLog = (date, isEarlyBad) => ({
  date,
  mood: isEarlyBad
    ? rand(['confused', 'agitated', 'agitated'])
    : rand(['calm', 'calm', 'confused']),
  confusionLevel: isEarlyBad
    ? rand(['moderate', 'severe', 'mild'])
    : rand(['none', 'none', 'mild']),
  gotLost: isEarlyBad ? Math.random() < 0.25 : Math.random() < 0.05,
  medication: isEarlyBad
    ? rand(['missed', 'missed', 'taken'])
    : rand(['taken', 'taken', 'unknown']),
  sleep: isEarlyBad
    ? rand(['poor', 'disturbed', 'poor'])
    : rand(['good', 'good', 'disturbed']),
  food: rand(['normal', 'normal', 'skipped']),
  activity: isEarlyBad
    ? rand(['low', 'low', 'medium'])
    : rand(['medium', 'high', 'medium']),
  tasksCompleted: Math.floor(Math.random() * 5),
  tasksTotal: 5,
  exerciseMinutes: Math.floor(Math.random() * 30),
  socialInteractions: Math.floor(Math.random() * 4),
  alertsTriggered: isEarlyBad ? Math.floor(Math.random() * 3) : 0,
  medicationSource: 'auto',
  activitySource: 'auto',
  foodSource: 'auto',
  interventionNotes: 'Seeded synthetic daily log'
});

const getTargetPatient = async (requestedPatientId) => {
  if (requestedPatientId) {
    const patient = await Patient.findById(requestedPatientId).lean();
    if (!patient) {
      throw new Error(`Patient not found for id: ${requestedPatientId}`);
    }
    return patient;
  }

  const patient = await Patient.findOne({}).sort({ createdAt: 1 }).lean();
  if (!patient) {
    throw new Error('No patients found. Create/seed a patient first.');
  }
  return patient;
};

const seedDailyLogs = async () => {
  const options = parseArgs();

  try {
    await mongoose.connect(mongoUri);

    const patient = await getTargetPatient(options.patientId);
    const patientId = patient._id;

    if (!options.keepExisting) {
      await DailyHealthLog.deleteMany({ patientId });
    }

    const logs = [];
    for (let i = options.days - 1; i >= 0; i -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const weekNum = Math.floor(i / 7);
      const isEarlyBad = weekNum > 8;
      logs.push({
        patientId,
        ...buildLog(date, isEarlyBad)
      });
    }

    await DailyHealthLog.insertMany(logs, { ordered: false });

    console.log(`✓ Seeded ${logs.length} daily logs for patient ${patientId} (${patient.name || 'unknown'})`);
    console.log(`  Collection: dailyhealthlogs`);
    console.log(`  Database: ${mongoose.connection.db.databaseName}`);
  } catch (error) {
    console.error('Error seeding daily logs:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

seedDailyLogs();
