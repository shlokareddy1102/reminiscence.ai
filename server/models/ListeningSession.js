const mongoose = require('mongoose');

const ListeningSessionSchema = new mongoose.Schema({
  patientId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  trackId:         { type: String, required: true },   // Jamendo track ID
  trackName:       { type: String, default: '' },
  artistName:      { type: String, default: '' },
  genre:           { type: String, default: '' },
  tempo:           { type: String, enum: ['calm', 'medium', 'energetic'], default: 'medium' },
  era:             { type: String, default: '' },       // e.g. "1970s"
  durationSeconds: { type: Number, default: 0 },        // full track duration
  listenedSeconds: { type: Number, default: 0 },        // how long they actually listened
  skipAtPercent:   { type: Number, default: null },      // null = no skip, 0-100 = skipped at %
  completed:       { type: Boolean, default: false },
  repeatCount:     { type: Number, default: 0 },
  thumbsUp:        { type: Boolean, default: null },    // explicit signal
  moodBefore:      { type: Number, default: null },     // moodScore from that day's log
  moodAfter:       { type: Number, default: null },     // moodScore from next log entry
  agitationBefore: { type: Number, default: null },
  agitationAfter:  { type: Number, default: null },
  timeOfDay:       { type: String, enum: ['morning', 'afternoon', 'evening', 'night'], default: 'morning' },
  sessionDate:     { type: Date, default: Date.now, index: true },
}, { timestamps: true });

ListeningSessionSchema.index({ patientId: 1, trackId: 1 });
ListeningSessionSchema.index({ patientId: 1, sessionDate: -1 });

module.exports = mongoose.model('ListeningSession', ListeningSessionSchema);