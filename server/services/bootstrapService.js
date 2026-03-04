const Patient = require('../models/Patient');
const Task = require('../models/Task');

const ensureDemoData = async () => {
  let patient = await Patient.findOne();

  if (!patient) {
    patient = await Patient.create({
      name: 'Alice Johnson',
      age: 74,
      riskScore: 8,
      currentState: 'STABLE',
      lastActivityTime: new Date(),
      caregivers: [
        { name: 'Emma Johnson', role: 'family', priorityLevel: 1 },
        { name: 'Nurse Daniel', role: 'medical', priorityLevel: 2 }
      ]
    });
  }

  const taskCount = await Task.countDocuments({ patientId: patient._id });
  if (taskCount === 0) {
    const now = new Date();

    await Task.insertMany([
      {
        patientId: patient._id,
        title: 'Take morning blood pressure medicine',
        type: 'medication',
        scheduledTime: new Date(now.getTime() + 2 * 60000),
        status: 'pending'
      },
      {
        patientId: patient._id,
        title: 'Lunch and hydration check',
        type: 'meal',
        scheduledTime: new Date(now.getTime() + 10 * 60000),
        status: 'pending'
      },
      {
        patientId: patient._id,
        title: 'Physical therapy video call',
        type: 'appointment',
        scheduledTime: new Date(now.getTime() + 20 * 60000),
        status: 'pending'
      }
    ]);
  }

  return patient;
};

module.exports = { ensureDemoData };
