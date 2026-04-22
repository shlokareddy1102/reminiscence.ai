const router = require('express').Router();
const Alert = require('../models/Alert');

router.get('/', async (req, res) => {
  try {
    const patientId = req.query.patientId;
    const query = patientId ? { patientId } : {};

    const alerts = await Alert.find(query)
      .sort({ timestamp: -1 })
      .limit(50);

    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/acknowledge', async (req, res) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { acknowledged: true },
      { new: true }
    );

    res.json(alert);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Acknowledge alert
router.put('/:id/acknowledge', async (req, res) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { acknowledged: true },
      { new: true }
    );
    res.json(alert);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;