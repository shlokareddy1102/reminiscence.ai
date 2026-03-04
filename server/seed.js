const mongoose = require('mongoose');
const Patient = require('./models/Patient');
const Task = require('./models/Task');
const Event = require('./models/Event');
const Alert = require('./models/Alert');
const ActivityLog = require('./models/ActivityLog');
const KnownPerson = require('./models/KnownPerson');

const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/reminiscence';

const seedDatabase = async () => {
  try {
    await mongoose.connect(mongoUri);

    await Promise.all([
      Patient.deleteMany({}),
      Task.deleteMany({}),
      Event.deleteMany({}),
      Alert.deleteMany({}),
      ActivityLog.deleteMany({}),
      KnownPerson.deleteMany({})
    ]);

    const patient = await Patient.create({
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
    console.log(`Patient ID: ${patient._id}`);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

seedDatabase();
