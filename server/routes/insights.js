const express = require('express');
const router = express.Router();
const reasoningPipeline = require('../services/reasoningPipeline');
const embeddingService = require('../services/embeddingService');
const interventionAnalysisService = require('../services/interventionAnalysisService');
const featureExtractionService = require('../services/featureExtractionService');
const mlService = require('../services/mlService');
const Patient = require('../models/Patient');
const DailyHealthLog = require('../models/DailyHealthLog');
const InterventionEffect = require('../models/InterventionEffect');

const toClinicalProgressScore = (metrics = {}) => {
  const normalize = (value, max, invert = false) => {
    if (value === null || value === undefined) return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    const bounded = Math.max(0, Math.min(max, parsed));
    const scaled = (bounded / max) * 100;
    return invert ? 100 - scaled : scaled;
  };

  const dimensions = [
    normalize(metrics.moodScore,     10),
    normalize(metrics.sleepHours,    10),
    normalize(metrics.appetiteLevel, 10),
    normalize(metrics.agitationLevel,10, true)
  ].filter((value) => Number.isFinite(value));

  if (!dimensions.length) return null;
  return Math.round(dimensions.reduce((sum, value) => sum + value, 0) / dimensions.length);
};

const percentDelta = (previous, current) => {
  if (!Number.isFinite(previous) || !Number.isFinite(current) || previous === 0) return 0;
  return ((current - previous) / Math.abs(previous)) * 100;
};

const weeklyRate = (logs = [], predicate = () => false) => {
  if (!logs.length) return 0;
  return (logs.filter(predicate).length / logs.length) * 100;
};

const summarizeAiInsights = ({ allLogs = [], anomalyCount = 0 }) => {
  if (!allLogs.length) return [];

  const pivot = Math.max(3, Math.floor(allLogs.length / 2));
  const baseline = allLogs.slice(0, pivot);
  const recent = allLogs.slice(-pivot);

  const confusionDelta = percentDelta(
    weeklyRate(baseline, (log) => log.confusionLevel === 'moderate' || log.confusionLevel === 'severe'),
    weeklyRate(recent, (log) => log.confusionLevel === 'moderate' || log.confusionLevel === 'severe')
  );

  const poorSleepDelta = percentDelta(
    weeklyRate(baseline, (log) => log.sleep === 'poor'),
    weeklyRate(recent, (log) => log.sleep === 'poor')
  );

  const insights = [];

  if (Math.abs(confusionDelta) >= 10) {
    insights.push(`Confusion ${confusionDelta > 0 ? 'increased' : 'decreased'} ${Math.abs(confusionDelta).toFixed(0)}% in the last ${Math.min(10, recent.length)} days`);
  }

  if (Math.abs(poorSleepDelta) >= 10) {
    insights.push(`Poor sleep ${poorSleepDelta > 0 ? 'increased' : 'dropped'} ${Math.abs(poorSleepDelta).toFixed(0)}% versus prior period`);
  }

  insights.push(`${anomalyCount} anomalies detected this week`);

  return insights.slice(0, 3);
};

/**
 * Get AI-generated recommendations for a patient
 * GET /api/insights/:patientId/recommendations
 */
router.get('/:patientId/recommendations', async (req, res) => {
  try {
    const { patientId } = req.params;
    const recommendations = await reasoningPipeline.generateRecommendations(patientId);
    res.json(recommendations);
  } catch (err) {
    console.error('Error generating recommendations:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get patient's trend data
 * GET /api/insights/:patientId/trends
 */
router.get('/:patientId/trends', async (req, res) => {
  try {
    const { patientId } = req.params;
    const { days = 30 } = req.query;
    const patient = await Patient.findById(patientId).lean();

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - Number(days));

    const logs = await DailyHealthLog.find({
      patientId,
      date: { $gte: startDate }
    }).sort({ date: 1 });

    const plainLogs = logs.map((log) => (log.toObject ? log.toObject() : log));

    const anomalyResult = patient
      ? await mlService.detectAnomaly({ patient, logs: plainLogs }).catch(() => null)
      : null;

    const forecastResult = patient
      ? await mlService.forecastDeterioration({ logs: plainLogs, horizonDays: 7 }).catch(() => null)
      : null;

    const anomalyFlags = Array.isArray(anomalyResult?.flags) ? anomalyResult.flags : [];
    const anomalyByLogId = new Map();
    logs.forEach((log, index) => {
      anomalyByLogId.set(String(log._id), Boolean(anomalyFlags[index]));
    });

    if (!logs.length) {
      return res.json({ trends: [], anomalies: [], riskTrend: [], forecast: [], aiInsights: [], message: 'No data for period' });
    }

    // Aggregate by week bucket
    const weeks = {};
    const now = Date.now();

    logs.forEach(log => {
      const logTime = new Date(log.date).getTime();
      const weekKey = Math.floor((now - logTime) / (7 * 24 * 60 * 60 * 1000));

      if (!weeks[weekKey]) {
        weeks[weekKey] = { logs: [], week: weekKey, date: log.date };
      }
      weeks[weekKey].logs.push(log);
    });

    const trends = Object.values(weeks)
      .sort((a, b) => b.week - a.week) // oldest first after reverse in frontend
      .map(w => ({
        week:    w.week,
        date:    w.date,           // use actual log date so frontend label renders
        metrics: interventionAnalysisService.aggregateMetrics(w.logs),
        riskScore: Math.round(mlService.buildForecastHistory(w.logs).reduce((sum, row) => sum + Number(row.risk_score || 0), 0) / Math.max(1, w.logs.length)),
        anomaly: w.logs.some((log) => anomalyByLogId.get(String(log._id))),
        anomalyLabel: (() => {
          const flagged = w.logs.find((log) => anomalyByLogId.get(String(log._id)));
          return flagged ? new Date(flagged.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : null;
        })()
      }));

    const riskTrend = trends.map((item) => ({
      label: new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      date: item.date,
      riskScore: item.riskScore,
      anomaly: item.anomaly
    }));

    const forecast = (forecastResult?.forecast || []).map((entry, index) => ({
      date: entry.ds || entry.date || new Date(Date.now() + (index + 1) * 24 * 60 * 60 * 1000).toISOString(),
      riskScore: Math.max(0, Math.min(100, Math.round(Number(entry.yhat ?? entry.risk_score ?? entry.value ?? 0))))
    }));

    const recentWindowLogs = plainLogs.slice(-7);
    const recentAnomalyCount = Math.max(0, (anomalyFlags.slice(-7).filter(Boolean).length));
    const aiInsights = summarizeAiInsights({
      allLogs: recentWindowLogs.length ? plainLogs.slice(-Math.min(20, plainLogs.length)) : plainLogs,
      anomalyCount: recentAnomalyCount
    });

    res.json({
      trends,
      riskTrend,
      forecast,
      aiInsights,
      anomalies: trends.filter((item) => item.anomaly).map((item) => ({
        label: item.anomalyLabel || new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        message: `Unusual behavior detected on ${item.anomalyLabel || new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
      })),
      modelSource: anomalyResult?.model || 'zscore_fallback'
    });
  } catch (err) {
    console.error('Error getting trends:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Compare intervention outcomes before vs after
 * GET /api/insights/:patientId/interventions/compare
 */
router.get('/:patientId/interventions/compare', async (req, res) => {
  try {
    const { patientId } = req.params;
    const limit = Math.max(1, Math.min(Number.parseInt(req.query.limit, 10) || 12, 30));

    const interventions = await InterventionEffect.find({ patientId })
      .sort({ appliedDate: -1 })
      .limit(limit)
      .lean();

    const rows = interventions.map((entry) => {
      const baseline    = entry.baseline    || {};
      const measurement = entry.measurement || {};
      const deltas      = entry.effects     || {};

      return {
        interventionId:   String(entry._id),
        interventionType: entry.interventionType,
        description:      entry.description,
        appliedDate:      entry.appliedDate,
        outcome:          entry.overallOutcome,
        confidence:       entry.confidence,
        before:           baseline,
        after:            measurement,
        delta:            deltas,
        progressBefore:   toClinicalProgressScore(baseline),
        progressAfter:    toClinicalProgressScore(measurement)
      };
    });

    res.json({ patientId, total: rows.length, interventions: rows });
  } catch (err) {
    console.error('Error comparing interventions:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Record a new intervention
 * POST /api/insights/:patientId/interventions
 */
router.post('/:patientId/interventions', async (req, res) => {
  try {
    const { patientId } = req.params;
    const { type, description } = req.body;
    const userId = req.user?._id || null;

    if (!type || !description) {
      return res.status(400).json({ error: 'type and description required' });
    }

    const effect = await interventionAnalysisService.recordIntervention(
      patientId,
      type,
      description,
      new Date(),
      userId
    );

    res.status(201).json({
      message: 'Intervention recorded. Check outcomes in 7-14 days.',
      interventionId: effect._id
    });
  } catch (err) {
    console.error('Error recording intervention:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Measure intervention outcome
 * POST /api/insights/interventions/:interventionId/measure
 */
router.post('/interventions/:interventionId/measure', async (req, res) => {
  try {
    const { interventionId } = req.params;

    const effect = await InterventionEffect.findById(interventionId);
    if (!effect) {
      return res.status(404).json({ error: 'Intervention not found' });
    }

    const measured = await interventionAnalysisService.measureInterventionOutcome(interventionId);

    res.json({
      outcome:    measured.overallOutcome,
      confidence: measured.confidence,
      effects:    measured.effects,
      message:    `Intervention ${measured.overallOutcome.replace('_', ' ')}`
    });
  } catch (err) {
    console.error('Error measuring outcome:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get caregiver feedback on recommendation
 * POST /api/insights/interventions/:interventionId/feedback
 */
router.post('/interventions/:interventionId/feedback', async (req, res) => {
  try {
    const { interventionId } = req.params;
    const { feedback, notes } = req.body;

    const effect = await InterventionEffect.findByIdAndUpdate(
      interventionId,
      { caregiverFeedback: feedback, caregiverNotes: notes || '' },
      { new: true }
    );

    res.json({ message: 'Feedback recorded', intervention: effect });
  } catch (err) {
    console.error('Error recording feedback:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get similar patients for cohort analysis
 * GET /api/insights/:patientId/similar
 */
router.get('/:patientId/similar', async (req, res) => {
  try {
    const { patientId } = req.params;
    const { topK = 5 } = req.query;

    const similar = await embeddingService.findSimilarPatients(patientId, parseInt(topK));

    res.json({ referencePatientId: patientId, similarPatients: similar });
  } catch (err) {
    console.error('Error finding similar patients:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get successful interventions for a condition
 * GET /api/insights/interventions/successful
 */
router.get('/interventions/successful', async (req, res) => {
  try {
    const { stage = null } = req.query;
    const successful = await interventionAnalysisService.getSuccessfulInterventions('general', stage);
    res.json({ stage, interventions: successful });
  } catch (err) {
    console.error('Error getting successful interventions:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Trigger embedding rebuild for all patients
 * POST /api/insights/embeddings/rebuild
 */
router.post('/embeddings/rebuild', async (req, res) => {
  try {
    res.json({ message: 'Embedding rebuild started in background' });
    embeddingService.embedAllPatients().catch(err => {
      console.error('Error rebuilding embeddings:', err.message);
    });
  } catch (err) {
    console.error('Error starting embedding rebuild:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get patient features and metrics
 * GET /api/insights/:patientId/metrics
 */
router.get('/:patientId/metrics', async (req, res) => {
  try {
    const { patientId } = req.params;
    const { days = 30 } = req.query;

    const features = await featureExtractionService.extractPatientFeatures(patientId, parseInt(days));

    res.json({ patientId, features, extractedAt: new Date() });
  } catch (err) {
    console.error('Error getting metrics:', err.message);
    res.status(500).json({ error: err.message });
  }
});
/**
 * GET /api/insights/:patientId/forecast
 * 7-day Prophet forecast for the frontend forecast tab
 */
router.get('/:patientId/forecast', async (req, res) => {
  try {
    const { patientId } = req.params;
    const horizonDays = Math.max(1, Math.min(30, Number(req.query.horizon_days || 7)));

    const logs = await DailyHealthLog.find({ patientId })
      .sort({ date: -1 })
      .limit(60)
      .lean()
      .then((l) => l.reverse());

    if (!logs.length) {
      return res.json({ forecast: [], trend: 'unknown', early_warning: false, peak_risk_score: null, model: 'none', message: 'No logs available' });
    }

    const result = await mlService.getForecast(patientId, logs, horizonDays);

    if (!result) {
      return res.json({ forecast: [], trend: 'unknown', early_warning: false, peak_risk_score: null, model: 'unavailable' });
    }

    res.json(result);
  } catch (err) {
    console.error('Error getting forecast:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/insights/:patientId/risk-score
 * Current ML risk score for the gauge
 */
router.get('/:patientId/risk-score', async (req, res) => {
  try {
    const { patientId } = req.params;

    const logs = await DailyHealthLog.find({ patientId })
      .sort({ date: -1 })
      .limit(30)
      .lean()
      .then((l) => l.reverse());

    if (!logs.length) {
      return res.json({ risk_score: null, risk_level: 'STABLE', confidence: 0, model: 'no_data' });
    }

    const result = await mlService.getRiskScore(patientId, logs);

    if (!result) {
      // Fall back to patient's stored riskScore
      const patient = await Patient.findById(patientId).lean();
      return res.json({
        risk_score:  patient?.riskScore ?? 30,
        risk_level:  patient?.currentState ?? 'STABLE',
        confidence:  0.5,
        model:       'rule_based_fallback'
      });
    }

    res.json(result);
  } catch (err) {
    console.error('Error getting risk score:', err.message);
    res.status(500).json({ error: err.message });
  }
});
module.exports = router;