const axios = require('axios');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL
  || process.env.PYTHON_ML_SERVICE_URL
  || 'http://localhost:5003';

const client = axios.create({
  baseURL: ML_SERVICE_URL,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json'
  }
});

const MOOD_SCORE = {
  calm: 90,
  confused: 55,
  agitated: 25
};

const CONFUSION_SCORE = {
  none: 5,
  mild: 35,
  moderate: 65,
  severe: 95
};

const SLEEP_HOURS = {
  good: 8,
  disturbed: 6,
  poor: 4.5
};

const ACTIVITY_MINUTES = {
  high: 60,
  medium: 30,
  low: 10,
  unknown: 20
};

const MEDICATION_ADHERENCE = {
  taken: 1,
  missed: 0,
  unknown: 0.5
};

const GENDER_CODE = {
  female: 0,
  male: 1,
  other: 2,
  unknown: 3
};

const SEVERITY_CODE = {
  mild: 0,
  moderate: 1,
  severe: 2
};

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const normalizeText = (value, fallback = 'unknown') => {
  const text = String(value ?? '').trim().toLowerCase();
  return text || fallback;
};

const normalizeSeverity = (severityOrState) => {
  const value = normalizeText(severityOrState, 'moderate');
  if (['mild', 'mild_risk', 'stable'].includes(value)) return 'mild';
  if (['moderate', 'elevated_risk'].includes(value)) return 'moderate';
  if (['severe', 'critical'].includes(value)) return 'severe';
  return value;
};

const mapMoodScore = (mood) => MOOD_SCORE[normalizeText(mood, 'calm')] ?? 50;

const mapConfusionScore = (confusionLevel) => CONFUSION_SCORE[normalizeText(confusionLevel, 'none')] ?? 35;

const mapSleepHours = (sleep) => SLEEP_HOURS[normalizeText(sleep, 'unknown')] ?? 6;

const mapActivityMinutes = (activity) => ACTIVITY_MINUTES[normalizeText(activity, 'unknown')] ?? 20;

const mapMedicationAdherence = (medication) => MEDICATION_ADHERENCE[normalizeText(medication, 'unknown')] ?? 0.5;

const mapGender = (gender) => GENDER_CODE[normalizeText(gender, 'unknown')] ?? 3;

const mapSeverity = (severity) => SEVERITY_CODE[normalizeText(severity, 'moderate')] ?? 1;

const buildPatientPayload = ({ patient = {}, log = {} }) => ({
  patient_id: String(patient._id || patient.id || log.patientId || ''),
  age: Number(patient.age || 0),
  gender: normalizeText(patient.gender, 'unknown'),
  severity: normalizeSeverity(patient.dementiaSeverity || patient.currentState || 'moderate'),
  sleep_hours: mapSleepHours(log.sleep),
  mood_score: mapMoodScore(log.mood),
  confusion_score: mapConfusionScore(log.confusionLevel),
  activity_minutes: mapActivityMinutes(log.activity),
  medication_adherence: mapMedicationAdherence(log.medication),
  agitation_score: Math.max(mapMoodScore(log.mood), mapConfusionScore(log.confusionLevel)),
  got_lost: Boolean(log.gotLost),
  gender_code: mapGender(patient.gender),
  severity_code: mapSeverity(patient.dementiaSeverity || patient.currentState)
});

const buildObservationPayload = ({ patient = {}, log = {} }) => ({
  age: Number(patient.age || 0),
  gender: normalizeText(patient.gender, 'unknown'),
  severity: normalizeSeverity(patient.dementiaSeverity || patient.currentState || 'moderate'),
  sleep_hours: mapSleepHours(log.sleep),
  mood_score: mapMoodScore(log.mood),
  confusion_score: mapConfusionScore(log.confusionLevel),
  activity_minutes: mapActivityMinutes(log.activity),
  medication_adherence: mapMedicationAdherence(log.medication),
  agitation_score: Math.max(mapMoodScore(log.mood), mapConfusionScore(log.confusionLevel)),
  got_lost: Boolean(log.gotLost),
  gender_code: mapGender(patient.gender),
  severity_code: mapSeverity(patient.dementiaSeverity || patient.currentState)
});

const buildForecastHistory = (logs = []) => logs.map((log) => ({
  date: log.date || log.createdAt || new Date().toISOString(),
  risk_score: clamp(
    50
    + (normalizeText(log.mood, 'calm') === 'agitated' ? 15 : normalizeText(log.mood, 'calm') === 'confused' ? 8 : -6)
    + (normalizeText(log.confusionLevel, 'none') === 'severe' ? 14 : normalizeText(log.confusionLevel, 'none') === 'moderate' ? 9 : normalizeText(log.confusionLevel, 'none') === 'mild' ? 4 : -2)
    + (log.gotLost ? 15 : -1)
    + (normalizeText(log.medication, 'unknown') === 'missed' ? 12 : normalizeText(log.medication, 'unknown') === 'taken' ? -2 : 2)
    + (normalizeText(log.sleep, 'unknown') === 'poor' ? 10 : normalizeText(log.sleep, 'unknown') === 'disturbed' ? 5 : -4)
    + (normalizeText(log.food, 'unknown') === 'skipped' ? 7 : normalizeText(log.food, 'unknown') === 'normal' ? -1 : 1)
    + (normalizeText(log.activity, 'unknown') === 'low' ? 6 : normalizeText(log.activity, 'unknown') === 'high' ? -4 : 0),
    0,
    100
  )
}));

const request = async (path, payload = {}, method = 'post') => {
  try {
    const response = method === 'get'
      ? await client.get(path, { params: payload })
      : await client.post(path, payload);

    return response.data;
  } catch (error) {
    const message = error.response?.data?.detail
      || error.response?.data?.error
      || error.message
      || 'ML service request failed';
    throw new Error(message);
  }
};

const health = async () => request('/health', {}, 'get');

const trainAll = async () => request('/train', {});

const predictRisk = async ({ patient, log }) => request('/risk/predict', {
  patient: buildPatientPayload({ patient, log })
});

const detectAnomaly = async ({ patient, logs = [] }) => request('/anomaly/detect', {
  patient_id: String(patient?._id || patient?.id || ''),
  observations: logs.map((log) => buildObservationPayload({ patient, log }))
});

const forecastDeterioration = async ({ logs = [], horizonDays = 7 }) => request('/deterioration/forecast', {
  history: buildForecastHistory(logs),
  horizon_days: horizonDays
});

const recommendIntervention = async ({ patient, candidates = [], topK = 3 }) => request('/intervention/recommend', {
  patient: buildPatientPayload({ patient, log: {} }),
  candidates,
  top_k: topK
});

module.exports = {
  ML_SERVICE_URL,
  health,
  trainAll,
  predictRisk,
  detectAnomaly,
  forecastDeterioration,
  recommendIntervention,
  buildPatientPayload,
  buildObservationPayload,
  buildForecastHistory,
  clamp
};