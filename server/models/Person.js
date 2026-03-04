const mongoose = require('mongoose');

const PersonSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  name: { type: String, required: true },
  relationship: { type: String, required: true },
  photo: { type: String }, // Base64 or URL
  description: String,
  importance: { type: Number, default: 5 },
  lastSeen: Date,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Person', PersonSchema);