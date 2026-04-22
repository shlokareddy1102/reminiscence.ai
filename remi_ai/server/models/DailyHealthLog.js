const mongoose = require('mongoose');

const DailyHealthLogSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  date: { type: Date, required: true, index: true },
  mood: { type: String, enum: ['calm', 'confused', 'agitated'], required: true },
  confusionLevel: { type: String, enum: ['none', 'mild', 'moderate', 'severe'], default: 'none' },
  gotLost: { type: Boolean, default: false },
  medication: { type: String, enum: ['taken', 'missed', 'unknown'], required: true },
  sleep: { type: String, enum: ['good', 'disturbed', 'poor'], required: true },
  food: { type: String, enum: ['normal', 'skipped', 'unknown'], required: true },
  activity: { type: String, enum: ['high', 'medium', 'low', 'unknown'], required: true },
  medicationSource: { type: String, enum: ['auto', 'manual'], default: 'auto' },
  activitySource: { type: String, enum: ['auto', 'manual'], default: 'auto' },
  foodSource: { type: String, enum: ['auto', 'manual'], default: 'auto' },
  interventionNotes: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

DailyHealthLogSchema.index({ patientId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DailyHealthLog', DailyHealthLogSchema);
