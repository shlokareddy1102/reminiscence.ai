const mongoose = require('mongoose');

const CalendarEventSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  eventType: { 
    type: String, 
    enum: ['appointment', 'birthday', 'social', 'medication', 'other'], 
    required: true 
  },
  startTime: { type: Date, required: true },
  endTime: { type: Date },
  allDay: { type: Boolean, default: false },
  location: { type: String, default: '' },
  reminder: {
    enabled: { type: Boolean, default: true },
    minutesBefore: { type: Number, default: 30 }
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  completed: { type: Boolean, default: false },
  recurring: {
    enabled: { type: Boolean, default: false },
    frequency: { type: String, enum: ['daily', 'weekly', 'monthly', 'yearly'], default: 'daily' }
  }
}, { timestamps: true });

// Index for efficient queries
CalendarEventSchema.index({ patientId: 1, startTime: 1 });
CalendarEventSchema.index({ patientId: 1, eventType: 1 });

module.exports = mongoose.model('CalendarEvent', CalendarEventSchema);
