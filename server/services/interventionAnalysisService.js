const DailyHealthLog = require('../models/DailyHealthLog');
const InterventionEffect = require('../models/InterventionEffect');

const resolveStage = (patient) => {
  const explicit = String(patient?.dementiaSeverity || '').toLowerCase();
  if (['mild', 'moderate', 'severe'].includes(explicit)) return explicit;

  const state = String(patient?.currentState || '').toUpperCase();
  if (state === 'CRITICAL') return 'severe';
  if (state === 'ELEVATED_RISK') return 'moderate';
  return 'mild';
};

// Categorical → numeric conversion maps (all on 0–10 scale)
const MOOD_MAP     = { calm: 8, confused: 4, agitated: 2 };
const SLEEP_MAP    = { good: 8, disturbed: 5, poor: 2 };
const APPETITE_MAP = { normal: 8, skipped: 2, unknown: null };
const ACTIVITY_MAP = { high: 9, medium: 6, low: 3, unknown: null };

/**
 * Intervention Analysis Service
 * Tracks intervention effectiveness and builds knowledge base
 */
class InterventionAnalysisService {
  /**
   * Record intervention and create baseline measurement
   */
  async recordIntervention(patientId, interventionType, description, appliedDate, userId) {
    try {
      const baselineStartDate = new Date(appliedDate);
      baselineStartDate.setDate(baselineStartDate.getDate() - 7);
      const baselineEndDate = new Date(appliedDate);

      const baselineLogs = await DailyHealthLog.find({
        patientId,
        date: { $gte: baselineStartDate, $lt: baselineEndDate }
      }).sort({ date: 1 });

      if (baselineLogs.length === 0) {
        throw new Error('Insufficient baseline data (need at least 1 day before intervention)');
      }

      const baseline = this.aggregateMetrics(baselineLogs);

      const effect = new InterventionEffect({
        patientId,
        interventionType,
        description,
        appliedDate,
        baselineStartDate,
        baselineEndDate,
        baseline,
        initiatedBy: userId,
        createdBy: userId
      });

      await effect.save();
      return effect;
    } catch (err) {
      console.error('Error recording intervention:', err.message);
      throw err;
    }
  }

  /**
   * Measure intervention outcomes (call 7-14 days after intervention)
   */
  async measureInterventionOutcome(interventionEffectId) {
    try {
      const effect = await InterventionEffect.findById(interventionEffectId);
      if (!effect) throw new Error('InterventionEffect not found');

      const measurementStartDate = new Date(effect.appliedDate);
      measurementStartDate.setDate(measurementStartDate.getDate() + 7);
      const measurementEndDate = new Date(effect.appliedDate);
      measurementEndDate.setDate(measurementEndDate.getDate() + 14);

      const measurementLogs = await DailyHealthLog.find({
        patientId: effect.patientId,
        date: { $gte: measurementStartDate, $lte: measurementEndDate }
      }).sort({ date: 1 });

      if (measurementLogs.length === 0) {
        throw new Error('No measurement data available yet');
      }

      const measurement = this.aggregateMetrics(measurementLogs);
      const effects = this.calculateEffectSize(effect.baseline, measurement);
      const overallOutcome = this.assessOutcome(effects);
      const confidence = this.calculateConfidence(measurementLogs.length);

      effect.measurement = measurement;
      effect.effects = effects;
      effect.overallOutcome = overallOutcome;
      effect.confidence = confidence;
      effect.measurementStartDate = measurementStartDate;
      effect.measurementEndDate = measurementEndDate;

      await effect.save();
      return effect;
    } catch (err) {
      console.error('Error measuring intervention outcome:', err.message);
      throw err;
    }
  }

  /**
   * Aggregate health metrics from logs.
   * Prefers stored numeric fields; falls back to categorical fields
   * so charts render even when numeric fields are null.
   */
  aggregateMetrics(logs) {
    const metrics = {
      agitationLevel: null,
      sleepHours: null,
      appetiteLevel: null,
      moodScore: null,
      tasksCompleted: 0,
      exerciseMinutes: 0,
      socialInteractions: 0,
      alertsTriggered: 0
    };

    let agitationCount = 0, sleepCount = 0, appetiteCount = 0, moodCount = 0;

    logs.forEach(log => {
      // ── moodScore: prefer numeric field, fall back to categorical mood ──
      const moodNum = log.moodScore ?? MOOD_MAP[log.mood] ?? null;
      if (moodNum !== null) {
        metrics.moodScore = (metrics.moodScore || 0) + moodNum;
        moodCount++;
      }

      // ── sleepHours: prefer numeric field, fall back to categorical sleep ──
      const sleepNum = log.sleepHours ?? SLEEP_MAP[log.sleep] ?? null;
      if (sleepNum !== null) {
        metrics.sleepHours = (metrics.sleepHours || 0) + sleepNum;
        sleepCount++;
      }

      // ── appetiteLevel: prefer numeric field, fall back to food category ──
      const appetiteNum = log.appetiteLevel ?? APPETITE_MAP[log.food] ?? null;
      if (appetiteNum !== null) {
        metrics.appetiteLevel = (metrics.appetiteLevel || 0) + appetiteNum;
        appetiteCount++;
      }

      // ── agitationLevel: prefer numeric field, fall back to mood category ──
      const agitationNum =
        log.agitationLevel ??
        (log.mood === 'agitated' ? 8 : log.mood === 'confused' ? 5 : 2);
      if (agitationNum !== null) {
        metrics.agitationLevel = (metrics.agitationLevel || 0) + agitationNum;
        agitationCount++;
      }

      metrics.tasksCompleted     += log.tasksCompleted || 0;
      metrics.exerciseMinutes    += log.exerciseMinutes || 0;
      metrics.socialInteractions += log.socialInteractions || 0;
      metrics.alertsTriggered    += log.alertsTriggered || 0;
    });

    if (agitationCount > 0) metrics.agitationLevel /= agitationCount;
    if (sleepCount > 0)     metrics.sleepHours     /= sleepCount;
    if (appetiteCount > 0)  metrics.appetiteLevel  /= appetiteCount;
    if (moodCount > 0)      metrics.moodScore      /= moodCount;

    return metrics;
  }

  /**
   * Calculate effect size (change from baseline to measurement)
   */
  calculateEffectSize(baseline, measurement) {
    return {
      agitationLevel:    baseline.agitationLevel !== null ? measurement.agitationLevel - baseline.agitationLevel : null,
      sleepHours:        baseline.sleepHours     !== null ? measurement.sleepHours     - baseline.sleepHours     : null,
      appetiteLevel:     baseline.appetiteLevel  !== null ? measurement.appetiteLevel  - baseline.appetiteLevel  : null,
      moodScore:         baseline.moodScore      !== null ? measurement.moodScore      - baseline.moodScore      : null,
      tasksCompleted:    measurement.tasksCompleted    - baseline.tasksCompleted,
      exerciseMinutes:   measurement.exerciseMinutes   - baseline.exerciseMinutes,
      socialInteractions:measurement.socialInteractions - baseline.socialInteractions,
      alertsTriggered:   baseline.alertsTriggered - measurement.alertsTriggered // lower is better
    };
  }

  /**
   * Assess overall outcome based on effect sizes
   */
  assessOutcome(effects) {
    const positiveMetrics = [];
    const negativeMetrics = [];

    const improvementMetrics = [
      { key: 'sleepHours',         threshold: 0.5 },
      { key: 'appetiteLevel',      threshold: 0.5 },
      { key: 'moodScore',          threshold: 0.5 },
      { key: 'exerciseMinutes',    threshold: 10  },
      { key: 'socialInteractions', threshold: 0.5 },
      { key: 'tasksCompleted',     threshold: 0.5 }
    ];

    const improvementMetricsNegative = [
      { key: 'agitationLevel',  threshold: 1 },
      { key: 'alertsTriggered', threshold: 1 }
    ];

    improvementMetrics.forEach(({ key, threshold }) => {
      if (effects[key] !== null && effects[key] >  threshold) positiveMetrics.push(key);
      if (effects[key] !== null && effects[key] < -threshold) negativeMetrics.push(key);
    });

    improvementMetricsNegative.forEach(({ key, threshold }) => {
      if (effects[key] !== null && effects[key] >  threshold) positiveMetrics.push(key);
      if (effects[key] !== null && effects[key] < -threshold) negativeMetrics.push(key);
    });

    if (positiveMetrics.length >= 3) return 'significantly_positive';
    if (positiveMetrics.length >= 2) return 'positive';
    if (negativeMetrics.length >= 2) return 'negative';
    if (negativeMetrics.length >= 1) return 'significantly_negative';
    return 'neutral';
  }

  /**
   * Calculate confidence based on data quality
   */
  calculateConfidence(dataPoints) {
    return Math.min(0.95, 0.5 + (dataPoints / 14) * 0.45);
  }

  /**
   * Get successful interventions for a condition
   */
  async getSuccessfulInterventions(condition, stage) {
    try {
      const successfulEffects = await InterventionEffect.find({
        overallOutcome: { $in: ['positive', 'significantly_positive'] },
        confidence: { $gte: 0.6 }
      })
        .populate('patientId', 'currentState dementiaSeverity')
        .limit(20);

      let filtered = successfulEffects;
      if (stage) {
        filtered = successfulEffects.filter(e => resolveStage(e.patientId) === stage);
      }

      return filtered.map(e => ({
        intervention: e.description,
        type:         e.interventionType,
        effects:      e.effects,
        confidence:   e.confidence,
        stage:        resolveStage(e.patientId)
      }));
    } catch (err) {
      console.error('Error getting successful interventions:', err.message);
      return [];
    }
  }

  /**
   * Get intervention success rate
   */
  async getInterventionSuccessRate(interventionType, stage = null) {
    try {
      const query = { interventionType, overallOutcome: { $ne: 'unknown' } };

      const all = await InterventionEffect.countDocuments(query);
      const successful = await InterventionEffect.countDocuments({
        ...query,
        overallOutcome: { $in: ['positive', 'significantly_positive'] }
      });

      return {
        interventionType,
        totalTrials:    all,
        successfulTrials: successful,
        successRate:    all > 0 ? successful / all : 0
      };
    } catch (err) {
      console.error('Error getting success rate:', err.message);
      return null;
    }
  }
}

module.exports = new InterventionAnalysisService();