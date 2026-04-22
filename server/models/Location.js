const mongoose = require('mongoose');

const LocationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  role: { type: String, enum: ['patient', 'caregiver'], required: true },
  coordinates: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    accuracy: { type: Number, default: 0 } // meters
  },
  timestamp: { type: Date, default: Date.now },
  address: { type: String, default: '' }, // Optional reverse geocoded address
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Index for efficient queries
LocationSchema.index({ userId: 1, timestamp: -1 });
LocationSchema.index({ patientId: 1, timestamp: -1 });
LocationSchema.index({ patientId: 1, role: 1, isActive: 1 });

module.exports = mongoose.model('Location', LocationSchema);
