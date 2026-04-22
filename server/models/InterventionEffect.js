const mongoose = require('mongoose');

const InterventionEffectSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  interventionType: {
    type: String,
    enum: ['medication_change', 'activity_added', 'activity_removed', 'schedule_change', 'environment_change', 'other'],
    required: true
  },
  description: { type: String, required: true },
  
  // Timing
  appliedDate: { type: Date, required: true, index: true },
  baselineStartDate: { type: Date, required: true }, // 7 days before
  baselineEndDate: { type: Date, required: true },
  measurementStartDate: { type: Date, required: true }, // immediately after
  measurementEndDate: { type: Date, required: true }, // 7-14 days after
  
  // Baseline metrics (before intervention)
  baseline: {
    agitationLevel: Number,
    sleepHours: Number,
    appetiteLevel: Number,
    moodScore: Number,
    tasksCompleted: Number,
    exerciseMinutes: Number,
    socialInteractions: Number,
    alertsTriggered: Number
  },
  
  // Measurement metrics (after intervention)
  measurement: {
    agitationLevel: Number,
    sleepHours: Number,
    appetiteLevel: Number,
    moodScore: Number,
    tasksCompleted: Number,
    exerciseMinutes: Number,
    socialInteractions: Number,
    alertsTriggered: Number
  },
  
  // Effect size calculation (measurement - baseline)
  effects: {
    agitationLevel: Number,
    sleepHours: Number,
    appetiteLevel: Number,
    moodScore: Number,
    tasksCompleted: Number,
    exerciseMinutes: Number,
    socialInteractions: Number,
    alertsTriggered: Number
  },
  
  // Overall assessment
  overallOutcome: {
    type: String,
    enum: ['significantly_positive', 'positive', 'neutral', 'negative', 'significantly_negative', 'unknown'],
    default: 'unknown'
  },
  
  // Confidence (0-1)
  confidence: { type: Number, min: 0, max: 1, default: 0.5 },
  
  // Clinical assessment
  caregiverFeedback: { type: String, enum: ['yes', 'no', 'partially', null], default: null },
  caregiverNotes: { type: String, default: '' },
  
  // References
  initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

InterventionEffectSchema.index({ patientId: 1, appliedDate: -1 });
InterventionEffectSchema.index({ interventionType: 1 });
InterventionEffectSchema.index({ overallOutcome: 1 });

module.exports = mongoose.model('InterventionEffect', InterventionEffectSchema);
