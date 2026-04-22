const router = require('express').Router();
const Event = require('../models/Event');

router.get('/', async (req, res) => {
  try {
    const patientId = req.query.patientId;
    const query = patientId ? { patientId } : {};

    const events = await Event.find(query)
      .sort({ timestamp: -1 })
      .limit(100);

    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
