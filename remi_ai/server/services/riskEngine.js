const Patient = require('../models/Patient');
const Event = require('../models/Event');
const Alert = require('../models/Alert');

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

const createStateAlert = async ({ io, patient, state, riskScore }) => {
  const riskLevel = mapScoreToRiskLevel(riskScore);

  const alert = await Alert.create({
    patientId: patient._id,
    message: `${patient.name} is now in ${state.replace('_', ' ')} state (score: ${riskScore}).`,
    riskLevel
  });

  io.to(`caregiver-${patient._id}`).emit('alertGenerated', alert);
};

const applyRiskDelta = async ({ io, patientId, delta, reason, category = 'behavioral', metadata = {} }) => {
  const patient = await Patient.findById(patientId);
  if (!patient) return null;

  const previousState = patient.currentState;
  const nextScore = Math.max(0, patient.riskScore + delta);
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
  applyRiskDelta,
  mapScoreToRiskLevel
};
