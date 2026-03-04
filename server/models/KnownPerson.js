const mongoose = require('mongoose');

const KnownPersonSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  name: { type: String, required: true },
  relationship: { type: String, required: true },
  notes: { type: String, default: '' },
  photo: { type: String, required: true },
  lastVisitedTime: { type: Date, default: null },
  visitCount: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('KnownPerson', KnownPersonSchema);
