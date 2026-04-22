const mongoose = require('mongoose');

const PatientEmbeddingCacheSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, unique: true, index: true },
  
  // Feature vector (384-dimensional from sentence-transformers by default)
  embedding: { type: [Number], required: true },
  
  // FAISS index ID (if using FAISS for vector search)
  faissIndexId: { type: Number, default: null },
  
  // Current patient profile summary for context
  profile: {
    stage: { type: String, enum: ['mild', 'moderate', 'severe'], default: 'moderate' },
    age: Number,
    gender: String,
    primaryConditions: [String],
    currentMedications: [String]
  },
  
  // Last 30 days aggregate metrics (for embedding context)
  recentMetrics: {
    avgAgitationLevel: Number,
    avgSleepHours: Number,
    avgAppetiteLevel: Number,
    avgMoodScore: Number,
    avgTaskCompletion: Number,
    avgExerciseMinutes: Number,
    socialInteractionsPerWeek: Number
  },
  
  // When this embedding was computed
  computedAt: { type: Date, default: Date.now },
  
  // Which version of feature extraction was used
  embeddingVersion: { type: String, default: '1.0' }
}, { timestamps: true });

PatientEmbeddingCacheSchema.index({ updatedAt: -1 });

module.exports = mongoose.model('PatientEmbeddingCache', PatientEmbeddingCacheSchema);
