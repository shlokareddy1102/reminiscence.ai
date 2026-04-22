const mongoose = require('mongoose');

const InterventionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['medication_change', 'activity_added', 'activity_removed', 'schedule_change', 'environment_change', 'other'],
    required: true
  },
  description: { type: String, required: true },
  initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  appliedDate: { type: Date, required: true }
}, { _id: true });

const DailyHealthLogSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  date: { type: Date, required: true, index: true },
  
  // Categorical metrics (backward compatible)
  mood: { type: String, enum: ['calm', 'confused', 'agitated'], required: true },
  confusionLevel: { type: String, enum: ['none', 'mild', 'moderate', 'severe'], default: 'none' },
  gotLost: { type: Boolean, default: false },
  medication: { type: String, enum: ['taken', 'missed', 'unknown'], required: true },
  sleep: { type: String, enum: ['good', 'disturbed', 'poor'], required: true },
  food: { type: String, enum: ['normal', 'skipped', 'unknown'], required: true },
  activity: { type: String, enum: ['high', 'medium', 'low', 'unknown'], required: true },
  
  // Numerical metrics (1-10 scales for AI reasoning)
  agitationLevel: { type: Number, min: 0, max: 10, default: null },
  confusionEpisodes: { type: Number, default: 0 },
  sleepHours: { type: Number, min: 0, max: 24, default: null },
  appetiteLevel: { type: Number, min: 0, max: 10, default: null },
  moodScore: { type: Number, min: 0, max: 10, default: null },
  
  // Activities
  tasksCompleted: { type: Number, default: 0 },
  tasksTotal: { type: Number, default: 0 },
  exerciseMinutes: { type: Number, default: 0 },
  socialInteractions: { type: Number, default: 0 },
  
  // Safety
  alertsTriggered: { type: Number, default: 0 },
  locationIncidents: { type: Number, default: 0 },
  sosEvents: { type: Number, default: 0 },
  
  // Intervention tracking
  interventions: [InterventionSchema],
  
  // Source tracking
  medicationSource: { type: String, enum: ['auto', 'manual'], default: 'auto' },
  activitySource: { type: String, enum: ['auto', 'manual'], default: 'auto' },
  foodSource: { type: String, enum: ['auto', 'manual'], default: 'auto' },
  interventionNotes: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  
  // Embedding for similarity search
  embeddingId: { type: String, default: null }
}, { timestamps: true });

DailyHealthLogSchema.index({ patientId: 1, date: 1 }, { unique: true });
DailyHealthLogSchema.index({ patientId: 1, createdAt: -1 });

module.exports = mongoose.model('DailyHealthLog', DailyHealthLogSchema);
