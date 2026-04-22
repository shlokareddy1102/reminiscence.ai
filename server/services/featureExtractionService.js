const DailyHealthLog = require('../models/DailyHealthLog');
const Patient = require('../models/Patient');

const resolveStage = (patient) => {
  const explicit = String(patient?.dementiaSeverity || '').toLowerCase();
  if (['mild', 'moderate', 'severe'].includes(explicit)) return explicit;

  const state = String(patient?.currentState || '').toUpperCase();
  if (state === 'CRITICAL') return 'severe';
  if (state === 'ELEVATED_RISK') return 'moderate';
  return 'mild';
};

/**
 * Feature Extraction Service
 * Converts patient health data into normalized numerical vectors for similarity search
 */

class FeatureExtractionService {
  /**
   * Extract features from a patient's recent health logs
   * @param {String} patientId - Patient ID
   * @param {Number} days - Number of days to look back (default 30)
   * @returns {Object} Feature vector with all metrics
   */
  async extractPatientFeatures(patientId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const logs = await DailyHealthLog.find({
      patientId,
      date: { $gte: startDate }
    }).sort({ date: -1 });

    const patient = await Patient.findById(patientId);

    if (!logs.length || !patient) {
      return this.getEmptyFeatures();
    }

    // Aggregate metrics
    const features = this.aggregateMetrics(logs, patient);
    return features;
  }

  /**
   * Aggregate and normalize metrics from health logs
   */
  aggregateMetrics(logs, patient) {
    const totalDays = logs.length;
    
    // Sum up numerical metrics
    let sumAgitation = 0, validAgitation = 0;
    let sumSleep = 0, validSleep = 0;
    let sumAppetite = 0, validAppetite = 0;
    let sumMood = 0, validMood = 0;
    let sumTasks = 0, sumTasksTotal = 0;
    let sumExercise = 0;
    let sumSocial = 0;
    let sumAlerts = 0;
    
    logs.forEach(log => {
      if (log.agitationLevel !== null && log.agitationLevel !== undefined) {
        sumAgitation += log.agitationLevel;
        validAgitation++;
      }
      if (log.sleepHours !== null && log.sleepHours !== undefined) {
        sumSleep += log.sleepHours;
        validSleep++;
      }
      if (log.appetiteLevel !== null && log.appetiteLevel !== undefined) {
        sumAppetite += log.appetiteLevel;
        validAppetite++;
      }
      if (log.moodScore !== null && log.moodScore !== undefined) {
        sumMood += log.moodScore;
        validMood++;
      }
      sumTasks += log.tasksCompleted || 0;
      sumTasksTotal += log.tasksTotal || 0;
      sumExercise += log.exerciseMinutes || 0;
      sumSocial += log.socialInteractions || 0;
      sumAlerts += log.alertsTriggered || 0;
    });

    // Calculate averages
    const avgAgitation = validAgitation > 0 ? sumAgitation / validAgitation : 5;
    const avgSleep = validSleep > 0 ? sumSleep / validSleep : 6;
    const avgAppetite = validAppetite > 0 ? sumAppetite / validAppetite : 5;
    const avgMood = validMood > 0 ? sumMood / validMood : 5;
    const taskCompletionRate = sumTasksTotal > 0 ? sumTasks / sumTasksTotal : 0.5;
    const avgDailyExercise = sumExercise / totalDays;
    const avgDailySocial = sumSocial / totalDays;
    const avgDailyAlerts = sumAlerts / totalDays;

    // Normalize trending (recent vs older)
    const recentLogs = logs.slice(0, 7);
    const olderLogs = logs.slice(7);
    
    const recentAvgAgitation = recentLogs.reduce((sum, l) => sum + (l.agitationLevel || 5), 0) / recentLogs.length;
    const olderAvgAgitation = olderLogs.length > 0 
      ? olderLogs.reduce((sum, l) => sum + (l.agitationLevel || 5), 0) / olderLogs.length 
      : recentAvgAgitation;
    const agitationTrend = recentAvgAgitation - olderAvgAgitation; // positive = declining

    const recentAvgSleep = recentLogs.reduce((sum, l) => sum + (l.sleepHours || 6), 0) / recentLogs.length;
    const olderAvgSleep = olderLogs.length > 0
      ? olderLogs.reduce((sum, l) => sum + (l.sleepHours || 6), 0) / olderLogs.length
      : recentAvgSleep;
    const sleepTrend = recentAvgSleep - olderAvgSleep; // positive = improving

    // Stage encoding (mild=0, moderate=1, severe=2)
    const stageMap = { mild: 0, moderate: 1, severe: 2 };
    const stage = stageMap[resolveStage(patient)] ?? 1;

    return {
      // Current metrics (normalized to 0-1)
      agitation: this.normalize(avgAgitation, 0, 10),
      sleep: this.normalize(avgSleep, 0, 24),
      appetite: this.normalize(avgAppetite, 0, 10),
      mood: this.normalize(avgMood, 0, 10),
      taskCompletion: taskCompletionRate,
      exerciseMinutes: this.normalize(avgDailyExercise, 0, 120),
      socialInteractions: this.normalize(avgDailySocial, 0, 10),
      alertsTriggered: this.normalize(avgDailyAlerts, 0, 5),
      
      // Trends (change from recent to older)
      agitationTrend: this.normalize(agitationTrend, -5, 5),
      sleepTrend: this.normalize(sleepTrend, -6, 6),
      
      // Patient context
      stage: stage / 2, // normalize to 0-1
      age: this.normalize(patient.age || 70, 40, 95),
      
      // Raw values for context
      raw: {
        avgAgitation,
        avgSleep,
        avgAppetite,
        avgMood,
        taskCompletionRate,
        avgDailyExercise,
        avgDailySocial,
        avgDailyAlerts,
        agitationTrend,
        sleepTrend
      }
    };
  }

  /**
   * Normalize value to 0-1 range
   */
  normalize(value, min, max) {
    if (max === min) return 0.5;
    const normalized = (value - min) / (max - min);
    return Math.max(0, Math.min(1, normalized));
  }

  /**
   * Convert feature object to vector array for embeddings
   */
  featuresToVector(features) {
    return [
      features.agitation,
      features.sleep,
      features.appetite,
      features.mood,
      features.taskCompletion,
      features.exerciseMinutes,
      features.socialInteractions,
      features.alertsTriggered,
      features.agitationTrend,
      features.sleepTrend,
      features.stage,
      features.age
    ];
  }

  /**
   * Get empty/default features
   */
  getEmptyFeatures() {
    return {
      agitation: 0.5,
      sleep: 0.25, // ~6 hours out of 24
      appetite: 0.5,
      mood: 0.5,
      taskCompletion: 0.5,
      exerciseMinutes: 0.3,
      socialInteractions: 0.4,
      alertsTriggered: 0.4,
      agitationTrend: 0,
      sleepTrend: 0,
      stage: 0.5,
      age: 0.5,
      raw: {}
    };
  }

  /**
   * Create text description of patient state for embedding
   */
  createPatientDescription(features, patient) {
    const stage = ['mild', 'moderate', 'severe'][Math.round(features.stage * 2)] || 'moderate';
    const agitationDesc = features.raw.avgAgitation > 6 ? 'highly agitated' : features.raw.avgAgitation > 4 ? 'sometimes agitated' : 'calm';
    const sleepDesc = features.raw.avgSleep < 5 ? 'poor sleep' : features.raw.avgSleep < 7 ? 'disturbed sleep' : 'good sleep';
    const activityDesc = features.raw.avgDailyExercise > 30 ? 'highly active' : features.raw.avgDailyExercise > 10 ? 'moderately active' : 'low activity';
    
    return `${stage} dementia patient, ${agitationDesc}, ${sleepDesc}, ${activityDesc}, mood ${Math.round(features.raw.avgMood)}/10, appetite ${Math.round(features.raw.avgAppetite)}/10, task completion ${Math.round(features.raw.taskCompletion * 100)}%`;
  }
}

module.exports = new FeatureExtractionService();
