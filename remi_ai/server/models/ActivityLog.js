const mongoose = require('mongoose');

const ActivityLogSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  interactionType: {
    type: String,
    enum: ['button_press', 'voice_confirmation', 'face_detected', 'inactivity'],
    required: true
  },
  timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('ActivityLog', ActivityLogSchema);
