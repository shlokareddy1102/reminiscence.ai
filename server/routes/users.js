const router = require('express').Router();
const User = require('../models/User');

// Get all caregivers for patient registration dropdown
router.get('/caregivers', async (_req, res) => {
  try {
    const caregivers = await User.find({ role: 'caregiver' })
      .select('_id name email')
      .sort('name');
    res.json(caregivers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;