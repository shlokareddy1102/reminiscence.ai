const router = require('express').Router();
const Patient = require('../models/Patient');

// Get all patients for a caregiver
router.get('/caregiver/:caregiverId', async (req, res) => {
  try {
    const patients = await Patient.find({ caregiverId: req.params.caregiverId })
      .sort('-lastActive');
    res.json(patients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;