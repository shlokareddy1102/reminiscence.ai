const axios = require('axios');
const KnownPerson = require('../models/KnownPerson');

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8001';

const buildKnownPeoplePayload = async (patientId = null) => {
  const query = patientId ? { patientId } : {};
  const people = await KnownPerson.find(query).lean();

  return people.map((person) => ({
    id: person._id.toString(),
    name: person.name,
    relationship: person.relationship,
    notes: person.notes || '',
    photo: person.photo,
    photos: Array.isArray(person.photos) ? person.photos : []
  }));
};

async function rebuildPythonIndex(patientId = null) {
  try {
    const people = await buildKnownPeoplePayload(patientId);
    if (people.length === 0) {
      console.log('[face-index] skipped rebuild: no known people in MongoDB');
      return { success: true, skipped: true, peopleCount: 0 };
    }

    const response = await axios.post(`${PYTHON_SERVICE_URL}/rebuild-index`, {
      people
    }, {
      timeout: 30000
    });

    console.log(`[face-index] rebuilt with ${response.data?.stats?.person_count ?? 0} indexed people`);
    return response.data;
  } catch (error) {
    console.error('[face-index] rebuild failed:', error.message);
    return null;
  }
}

function startFaceIndexSync({ patientId = null, intervalMs = 5000 } = {}) {
  let stopped = false;
  let timer = null;

  const attemptSync = async () => {
    if (stopped) return false;
    const result = await rebuildPythonIndex(patientId);
    if (result) {
      if (timer) clearInterval(timer);
      timer = null;
      return true;
    }
    return false;
  };

  attemptSync();

  timer = setInterval(() => {
    attemptSync();
  }, intervalMs);

  return () => {
    stopped = true;
    if (timer) clearInterval(timer);
  };
}

module.exports = {
  rebuildPythonIndex,
  startFaceIndexSync
};