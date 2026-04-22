const axios = require('axios');
const PatientEmbeddingCache = require('../models/PatientEmbeddingCache');
const featureExtractionService = require('./featureExtractionService');
const Patient = require('../models/Patient');

/**
 * Embedding Service
 * Generates semantic embeddings for patients and manages FAISS index
 */

class EmbeddingService {
  constructor() {
    this.embeddingModel = process.env.EMBEDDING_MODEL || 'sentence-transformers/all-MiniLM-L6-v2';
    this.huggingFaceApi = process.env.HUGGING_FACE_API_KEY;
    this.faissIndex = null;
    this.patientIdToIndex = new Map(); // maps patientId string to FAISS index number
  }

  /**
   * Generate embedding using Hugging Face API
   */
  async generateEmbedding(text) {
    try {
      const response = await axios.post(
        `https://api-inference.huggingface.co/pipeline/feature-extraction/${this.embeddingModel}`,
        { inputs: text },
        {
          headers: {
            Authorization: `Bearer ${this.huggingFaceApi}`
          }
        }
      );
      
      // Hugging Face returns array of embeddings, take the first
      return Array.isArray(response.data[0]) ? response.data[0] : response.data;
    } catch (err) {
      console.error('Hugging Face embedding error:', err.message);
      // Fallback: return dummy embedding based on text hash
      return this.generateDummyEmbedding(text);
    }
  }

  /**
   * Fallback: generate deterministic dummy embedding from text
   */
  generateDummyEmbedding(text) {
    // Simple hash-based embedding for development/testing
    const hash = text.split('').reduce((h, c) => ((h << 5) - h) + c.charCodeAt(0), 0);
    const seed = Math.abs(hash);
    
    // Generate 384-dimensional vector using seeded random
    const embedding = [];
    for (let i = 0; i < 384; i++) {
      const x = Math.sin(seed * (i + 1)) * 10000;
      embedding.push(x - Math.floor(x));
    }
    return embedding;
  }

  /**
   * Embed a patient (create and cache embedding)
   */
  async embedPatient(patientId) {
    try {
      const patient = await Patient.findById(patientId);
      if (!patient) throw new Error('Patient not found');

      // Extract features
      const features = await featureExtractionService.extractPatientFeatures(patientId);
      
      // Create description
      const description = featureExtractionService.createPatientDescription(features, patient);
      
      // Generate embedding
      const embedding = await this.generateEmbedding(description);
      
      // Cache in database
      let cached = await PatientEmbeddingCache.findOne({ patientId });
      if (!cached) {
        cached = new PatientEmbeddingCache({
          patientId,
          embedding,
          profile: {
            stage: patient.dementiaSeverity || 'moderate',
            age: patient.age,
            gender: patient.gender,
            primaryConditions: patient.primaryConditions || [],
            currentMedications: patient.medications || []
          },
          recentMetrics: features.raw
        });
      } else {
        cached.embedding = embedding;
        cached.recentMetrics = features.raw;
        cached.computedAt = new Date();
      }
      
      await cached.save();
      return { patientId, embedding, features };
    } catch (err) {
      console.error('Error embedding patient:', err.message);
      throw err;
    }
  }

  /**
   * Embed all patients for batch similarity search
   */
  async embedAllPatients() {
    const patients = await Patient.find({ isActive: true });
    const results = [];
    
    for (const patient of patients) {
      try {
        const result = await this.embedPatient(patient._id);
        results.push(result);
      } catch (err) {
        console.error(`Failed to embed patient ${patient._id}:`, err.message);
      }
    }
    
    console.log(`Embedded ${results.length} patients for similarity search`);
    return results;
  }

  /**
   * Find similar patients using Faiss-like cosine similarity
   * (In production, use actual FAISS library for performance)
   */
  async findSimilarPatients(patientId, topK = 5) {
    try {
      const targetEmbedding = await PatientEmbeddingCache.findOne({ patientId });
      if (!targetEmbedding) {
        await this.embedPatient(patientId);
        return this.findSimilarPatients(patientId, topK);
      }

      // Find all other patient embeddings
      const allEmbeddings = await PatientEmbeddingCache.find({
        patientId: { $ne: patientId }
      });

      // Calculate cosine similarity
      const similarities = allEmbeddings.map(cached => ({
        patientId: cached.patientId,
        similarity: this.cosineSimilarity(targetEmbedding.embedding, cached.embedding),
        profile: cached.profile
      }));

      // Sort and return top K
      return similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK);
    } catch (err) {
      console.error('Error finding similar patients:', err.message);
      return [];
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length) return 0;
    
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (normA * normB);
  }

  /**
   * Find similar patients based on a trajectory pattern
   * (Pattern: sequence of metrics changes)
   */
  async findSimilarTrajectories(patientId, windowDays = 14) {
    try {
      // Get this patient's recent logs
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - windowDays);
      
      const DailyHealthLog = require('../models/DailyHealthLog');
      const thisPatientLogs = await DailyHealthLog.find({
        patientId,
        date: { $gte: startDate }
      }).sort({ date: 1 });

      if (thisPatientLogs.length < 3) return [];

      // Create trajectory fingerprint (sequence of changes)
      const trajectory = this.createTrajectoryFingerprint(thisPatientLogs);

      // Find all patients with similar trajectories
      const allPatients = await Patient.find({ isActive: true, _id: { $ne: patientId } });
      const results = [];

      for (const patient of allPatients) {
        const otherLogs = await DailyHealthLog.find({
          patientId: patient._id,
          date: { $gte: startDate }
        }).sort({ date: 1 });

        if (otherLogs.length < 3) continue;

        const otherTrajectory = this.createTrajectoryFingerprint(otherLogs);
        const similarity = this.trajectoryDistance(trajectory, otherTrajectory);

        results.push({
          patientId: patient._id,
          similarity,
          logs: otherLogs
        });
      }

      return results
        .filter(r => r.similarity > 0.6) // Filter high similarity
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 5);
    } catch (err) {
      console.error('Error finding similar trajectories:', err.message);
      return [];
    }
  }

  /**
   * Create a trajectory fingerprint from health log sequence
   */
  createTrajectoryFingerprint(logs) {
    const changes = [];
    for (let i = 1; i < logs.length; i++) {
      const prev = logs[i - 1];
      const curr = logs[i];
      
      changes.push({
        agitationChange: (curr.agitationLevel || 5) - (prev.agitationLevel || 5),
        sleepChange: (curr.sleepHours || 6) - (prev.sleepHours || 6),
        moodChange: (curr.moodScore || 5) - (prev.moodScore || 5)
      });
    }
    return changes;
  }

  /**
   * Calculate similarity between two trajectories
   */
  trajectoryDistance(traj1, traj2) {
    const minLen = Math.min(traj1.length, traj2.length);
    if (minLen === 0) return 0;

    let totalDistance = 0;
    for (let i = 0; i < minLen; i++) {
      const dAgitate = traj1[i].agitationChange - traj2[i].agitationChange;
      const dSleep = traj1[i].sleepChange - traj2[i].sleepChange;
      const dMood = traj1[i].moodChange - traj2[i].moodChange;

      totalDistance += Math.sqrt(dAgitate * dAgitate + dSleep * dSleep + dMood * dMood);
    }

    // Normalize and invert to similarity (0-1)
    const avgDistance = totalDistance / minLen;
    return Math.max(0, 1 - avgDistance / 5); // Normalize by typical max change
  }
}

module.exports = new EmbeddingService();
