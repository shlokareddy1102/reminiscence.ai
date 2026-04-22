const mongoose = require('mongoose');

const SOSAlertSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  triggeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  location: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    accuracy: { type: Number, default: 0 }
  },
  address: { type: String, default: '' },
  status: { 
    type: String, 
    enum: ['active', 'acknowledged', 'resolved'], 
    default: 'active' 
  },
  acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  acknowledgedAt: { type: Date },
  resolvedAt: { type: Date },
  notes: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

// Index for quick lookup of active SOS alerts
SOSAlertSchema.index({ patientId: 1, status: 1, timestamp: -1 });

module.exports = mongoose.model('SOSAlert', SOSAlertSchema);
