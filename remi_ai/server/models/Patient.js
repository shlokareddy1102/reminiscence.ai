const mongoose = require('mongoose');

const CaregiverSchema = new mongoose.Schema({
  name: { type: String, required: true },
  role: { type: String, enum: ['family', 'medical'], required: true },
  priorityLevel: { type: Number, default: 1 }
}, { _id: false });

const PatientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  age: { type: Number, required: true },
  riskScore: { type: Number, default: 0 },
  currentState: {
    type: String,
    enum: ['STABLE', 'MILD_RISK', 'ELEVATED_RISK', 'CRITICAL'],
    default: 'STABLE'
  },
  lastActivityTime: { type: Date, default: Date.now },
  caregivers: { type: [CaregiverSchema], default: [] }
}, { timestamps: true });

module.exports = mongoose.model('Patient', PatientSchema);