const router = require('express').Router();
const Patient = require('../models/Patient');

router.get('/list', async (_req, res) => {
  try {
    const patients = await Patient.find({}).sort({ createdAt: 1 }).lean();
    res.json(patients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (_req, res) => {
  try {
    const patient = await Patient.findOne().sort({ createdAt: 1 });
    if (!patient) return res.status(404).json({ message: 'No patient found' });
    res.json(patient);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:patientId', async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.patientId);
    if (!patient) return res.status(404).json({ message: 'Patient not found' });
    res.json(patient);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
