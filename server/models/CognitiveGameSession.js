const mongoose = require('mongoose');

const CognitiveGameLevelSchema = new mongoose.Schema({
  levelNumber: { type: Number, required: true },
  attempts: { type: Number, required: true, min: 1 },
  seconds: { type: Number, required: true, min: 0 },
  solved: { type: Boolean, default: true }
}, { _id: false });

const CognitiveGameSessionSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  gameType: { type: String, enum: ['tangram'], default: 'tangram', index: true },
  playedAt: { type: Date, default: Date.now, index: true },
  levels: { type: [CognitiveGameLevelSchema], default: [] },
  totalAttempts: { type: Number, default: 0, min: 0 },
  totalSeconds: { type: Number, default: 0, min: 0 },
  performanceScore: { type: Number, default: 0, min: 0, max: 100 },
  trend: { type: String, enum: ['improving', 'declining', 'stable'], default: 'stable' }
}, { timestamps: true });

module.exports = mongoose.model('CognitiveGameSession', CognitiveGameSessionSchema);
