const mongoose = require('mongoose');

const MusicProfileSchema = new mongoose.Schema({
  patientId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, unique: true },
  birthYear:        { type: Number, default: null },
  goldenEraStart:   { type: Number, default: null },  // birthYear + 10
  goldenEraEnd:     { type: Number, default: null },  // birthYear + 25
  preferredGenres:  { type: [String], default: [] },  // ['jazz', 'classical', 'folk']
  preferredTempo:   { type: String, enum: ['calm', 'medium', 'energetic', 'mixed'], default: 'mixed' },
  knownFavourites:  { type: [String], default: [] },  // artist or song names caregiver typed
  language:         { type: String, default: 'en' },
  therapyEnabled:   { type: Boolean, default: true },
  createdBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

module.exports = mongoose.model('MusicProfile', MusicProfileSchema);