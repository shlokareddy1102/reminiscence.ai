const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const Patient = require('./models/Patient');
const Task = require('./models/Task');
const Event = require('./models/Event');
const Alert = require('./models/Alert');
const ActivityLog = require('./models/ActivityLog');
const KnownPerson = require('./models/KnownPerson');
const User = require('./models/User');

const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/reminiscence';
const randomHex = (bytes) => crypto.randomBytes(bytes).toString('hex');

const seedDatabase = async () => {
  try {
    await mongoose.connect(mongoUri);

    await Promise.all([
      User.deleteMany({}),
      Patient.deleteMany({}),
      Task.deleteMany({}),
      Event.deleteMany({}),
      Alert.deleteMany({}),
      ActivityLog.deleteMany({}),
      KnownPerson.deleteMany({})
    ]);

    const caregiverEmail = process.env.SEED_CAREGIVER_EMAIL || `caregiver.${randomHex(4)}@local.invalid`;
    const patientEmail = process.env.SEED_PATIENT_EMAIL || `patient.${randomHex(4)}@local.invalid`;
    const seedPassword = process.env.SEED_PASSWORD || randomHex(16);

    // Create demo caregiver user
    const caregiver = await User.create({
      name: 'Emma Johnson',
      email: caregiverEmail,
      password: await bcrypt.hash(seedPassword, 10),
      role: 'caregiver'
    });

    // Create demo patient user
    const patientUser = await User.create({
      name: 'Alice Johnson',
      email: patientEmail,
      password: await bcrypt.hash(seedPassword, 10),
      role: 'patient'
    });

    const patient = await Patient.create({
      userId: patientUser._id,
      name: 'Alice Johnson',
      age: 74,
      riskScore: 18,
      currentState: 'STABLE',
      lastActivityTime: new Date(Date.now() - 4 * 60 * 1000),
      caregivers: [
        { name: 'Emma Johnson', role: 'family', priorityLevel: 1 },
        { name: 'Nurse Daniel', role: 'medical', priorityLevel: 2 }
      ]
    });

    // Link patient to user
    patientUser.patientId = patient._id;
    await patientUser.save();

    const now = Date.now();

    await Task.insertMany([
      {
        patientId: patient._id,
        title: 'Take morning blood pressure medicine',
        type: 'medication',
        scheduledTime: new Date(now - 5 * 60 * 1000),
        status: 'pending'
      },
      {
        patientId: patient._id,
        title: 'Eat lunch',
        type: 'meal',
        scheduledTime: new Date(now + 10 * 60 * 1000),
        status: 'pending'
      },
      {
        patientId: patient._id,
        title: 'Join memory-clinic video appointment',
        type: 'appointment',
        scheduledTime: new Date(now + 30 * 60 * 1000),
        status: 'pending'
      }
    ]);

    await Event.insertMany([
      {
        patientId: patient._id,
        eventType: 'daily_system_bootstrap',
        category: 'environmental',
        riskLevel: 'LOW',
        metadata: { source: 'seed' }
      },
      {
        patientId: patient._id,
        eventType: 'face_detected',
        category: 'interaction',
        riskLevel: 'LOW',
        metadata: { confidence: 0.87 }
      }
    ]);

    await ActivityLog.insertMany([
      {
        patientId: patient._id,
        interactionType: 'face_detected',
        timestamp: new Date(now - 2 * 60 * 1000)
      },
      {
        patientId: patient._id,
        interactionType: 'button_press',
        timestamp: new Date(now - 40 * 60 * 1000)
      }
    ]);

    await KnownPerson.insertMany([
      {
        patientId: patient._id,
        name: 'Emma Johnson',
        relationship: 'Daughter',
        notes: 'Usually visits in the evening with tea.',
        photo: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2QzZTVmZiIvPjxjaXJjbGUgY3g9IjEwMCIgY3k9IjcwIiByPSIzMCIgZmlsbD0iI2ZiYzQ5MCIvPjxyZWN0IHg9IjYwIiB5PSIxMDUiIHdpZHRoPSI4MCIgaGVpZ2h0PSI2MCIgcng9IjMwIiBmaWxsPSIjZjViZTdiIi8+PC9zdmc+'
      },
      {
        patientId: patient._id,
        name: 'Nurse Daniel',
        relationship: 'Nurse',
        notes: 'Comes for medication checks every afternoon.',
        photo: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2U2ZmJlNSIvPjxjaXJjbGUgY3g9IjEwMCIgY3k9IjcwIiByPSIzMCIgZmlsbD0iI2YxYzI3YyIvPjxyZWN0IHg9IjYwIiB5PSIxMDUiIHdpZHRoPSI4MCIgaGVpZ2h0PSI2MCIgcng9IjMwIiBmaWxsPSIjNjhkMzkxIi8+PC9zdmc+'
      }
    ]);

    console.log('Database seeded successfully.');
  console.log('Seed users created with non-demo credentials. Use SEED_CAREGIVER_EMAIL, SEED_PATIENT_EMAIL, and SEED_PASSWORD to control values.');
    console.log(`\nCaregiver User ID: ${caregiver._id}`);
    console.log(`Patient User ID: ${patientUser._id}`);
    console.log(`Patient Record ID: ${patient._id}\n`);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

seedDatabase();
