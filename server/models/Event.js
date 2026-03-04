const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  eventType: { type: String, required: true },
  category: {
    type: String,
    enum: ['task', 'behavioral', 'environmental', 'interaction'],
    required: true
  },
  riskLevel: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], required: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  timestamp: { type: Date, default: Date.now },
  handled: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Event', EventSchema);
