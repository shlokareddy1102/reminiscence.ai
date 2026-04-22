const Patient = require('../models/Patient');
const Event = require('../models/Event');
const Alert = require('../models/Alert');
const mlService = require('./mlService');

const calculateStateFromScore = (riskScore) => {
  if (riskScore >= 70) return 'CRITICAL';
  if (riskScore >= 40) return 'ELEVATED_RISK';
  if (riskScore >= 20) return 'MILD_RISK';
  return 'STABLE';
};

const mapScoreToRiskLevel = (riskScore) => {
  if (riskScore >= 70) return 'HIGH';
  if (riskScore >= 40) return 'HIGH';
  if (riskScore >= 20) return 'MEDIUM';
  return 'LOW';
};

const normalizeRiskLevel = (riskLevel, riskScore) => {
  const value = String(riskLevel || '').trim().toUpperCase();
  if (['LOW', 'MEDIUM', 'HIGH'].includes(value)) {
    return value;
  }

  return mapScoreToRiskLevel(riskScore);
};

const computeHeuristicDailyRiskDelta = ({ mood, confusionLevel, gotLost, medication, sleep, food, activity }) => {
  const scoreMap = {
    mood: { calm: -6, confused: 8, agitated: 15 },
    confusionLevel: { none: -2, mild: 4, moderate: 9, severe: 14 },
    gotLost: { true: 15, false: -1 },
    medication: { taken: -2, missed: 12, unknown: 2 },
    sleep: { good: -4, disturbed: 5, poor: 10 },
    food: { normal: -1, skipped: 7, unknown: 1 },
    activity: { high: -4, medium: 0, low: 6, unknown: 1 }
  };

  return (scoreMap.mood[String(mood)] || 0)
    + (scoreMap.confusionLevel[String(confusionLevel)] || 0)
    + (scoreMap.gotLost[String(gotLost)] || 0)
    + (scoreMap.medication[String(medication)] || 0)
    + (scoreMap.sleep[String(sleep)] || 0)
    + (scoreMap.food[String(food)] || 0)
    + (scoreMap.activity[String(activity)] || 0);
};

const scorePatientAssessment = async ({ patient, log, recentLogs = [] }) => {
  const fallbackScore = () => {
    const baseScore = Number(patient?.riskScore || 0);
    const delta = computeHeuristicDailyRiskDelta(log || {});
    const score = Math.max(0, Math.min(100, Math.round(baseScore + delta)));

    return {
      riskScore: score,
      riskLevel: mapScoreToRiskLevel(score),
      source: 'heuristic',
      anomaly: null
    };
  };

  try {
    const predicted = await mlService.predictRisk({ patient, log });
    const riskScore = Math.max(0, Math.min(100, Math.round(Number(predicted?.risk_score ?? predicted?.riskScore ?? patient?.riskScore ?? 0))));
    const riskLevel = normalizeRiskLevel(predicted?.risk_level || predicted?.riskLevel, riskScore);

    let anomaly = null;
    if (recentLogs.length >= 5) {
      try {
        anomaly = await mlService.detectAnomaly({ patient, logs: recentLogs });
      } catch (_error) {
        anomaly = null;
      }
    }

    return {
      riskScore,
      riskLevel,
      source: 'ml',
      anomaly
    };
  } catch (_error) {
    return fallbackScore();
  }
};

const createStateAlert = async ({ io, patient, state, riskScore }) => {
  const riskLevel = mapScoreToRiskLevel(riskScore);

  const alert = await Alert.create({
    patientId: patient._id,
    message: `${patient.name} is now in ${state.replace('_', ' ')} state (score: ${riskScore}).`,
    riskLevel
  });

  io.to(`caregiver-${patient._id}`).emit('alertGenerated', alert);
};

const createAnomalyAlert = async ({ io, patient, anomaly }) => {
  const alert = await Alert.create({
    patientId: patient._id,
    message: 'Unusual daily pattern detected by the ML anomaly model.',
    riskLevel: anomaly?.is_anomaly ? 'HIGH' : 'MEDIUM'
  });

  io.to(`caregiver-${patient._id}`).emit('alertGenerated', alert);
  return alert;
};

const applyRiskDelta = async ({ io, patientId, delta, reason, category = 'behavioral', metadata = {} }) => {
  const patient = await Patient.findById(patientId);
  if (!patient) return null;

  const previousState = patient.currentState;
  const currentScore = Number(patient.riskScore || 0);
  const nextScore = Math.max(0, currentScore + Number(delta || 0));
  const nextState = calculateStateFromScore(nextScore);

  patient.riskScore = nextScore;
  patient.currentState = nextState;
  await patient.save();

  const riskLevel = mapScoreToRiskLevel(nextScore);
  const stateEvent = await Event.create({
    patientId,
    eventType: reason,
    category,
    riskLevel,
    metadata: {
      ...metadata,
      riskScore: nextScore,
      state: nextState
    }
  });

  io.to(`caregiver-${patient._id}`).emit('riskUpdated', {
    patientId,
    riskScore: nextScore,
    currentState: nextState,
    event: stateEvent
  });

  if (previousState !== nextState) {
    io.to(`caregiver-${patient._id}`).emit('stateChanged', {
      patientId,
      previousState,
      currentState: nextState,
      riskScore: nextScore
    });

    if (nextState === 'ELEVATED_RISK' || nextState === 'CRITICAL') {
      await createStateAlert({ io, patient, state: nextState, riskScore: nextScore });
    }
  }

  return patient;
};

module.exports = {
  calculateStateFromScore,
  createAnomalyAlert,
  applyRiskDelta,
  mapScoreToRiskLevel,
  normalizeRiskLevel,
  scorePatientAssessment,
  computeHeuristicDailyRiskDelta
};
