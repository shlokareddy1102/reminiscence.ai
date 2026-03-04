const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  title: { type: String, required: true },
  type: { type: String, enum: ['medication', 'appointment', 'meal'], required: true },
  scheduledTime: { type: Date, required: true },
  status: { type: String, enum: ['pending', 'completed', 'missed'], default: 'pending' },
  confirmedBy: { type: String, enum: ['button', 'voice', null], default: null }
}, { timestamps: true });

module.exports = mongoose.model('Task', TaskSchema);
