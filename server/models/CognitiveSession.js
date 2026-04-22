const mongoose = require('mongoose');

const CognitiveQuestionSchema = new mongoose.Schema({
  questionId: { type: String, required: true },
  category: {
    type: String,
    enum: ['day_recall', 'people_recognition', 'orientation', 'emotional_reflection', 'follow_up'],
    required: true
  },
  prompt: { type: String, required: true },
  expectedAnswer: { type: String, default: '' },
  supportiveHint: { type: String, default: '' },
  options: { type: [String], default: [] },
  image: { type: String, default: '' },
  response: { type: String, default: '' },
  recallAccuracy: { type: String, enum: ['high', 'medium', 'low'], default: 'low' },
  confusionSignal: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
  score: { type: Number, min: 0, max: 1, default: 0 },
  supportiveFeedback: { type: String, default: '' }
}, { _id: false });

const CognitiveSessionSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  sessionDate: { type: Date, required: true, index: true },
  sessionLabel: { type: String, default: 'Nightly Cognitive Check-in' },
  status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
  questions: { type: [CognitiveQuestionSchema], default: [] },
  cognitiveScore: { type: Number, min: 0, max: 100, default: 0 },
  orientationScore: { type: Number, min: 0, max: 100, default: 0 },
  peopleRecognitionScore: { type: Number, min: 0, max: 100, default: 0 },
  recallTrend: { type: String, enum: ['improving', 'declining', 'stable'], default: 'stable' },
  emotionalTone: { type: String, enum: ['positive', 'neutral', 'negative'], default: 'neutral' },
  declineAlerted: { type: Boolean, default: false }
}, { timestamps: true });

CognitiveSessionSchema.index({ patientId: 1, sessionDate: 1 }, { unique: true });

module.exports = mongoose.model('CognitiveSession', CognitiveSessionSchema);
