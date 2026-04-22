const router = require('express').Router();
const ActivityLog = require('../models/ActivityLog');
const Event = require('../models/Event');
const Patient = require('../models/Patient');
const { applyRiskDelta } = require('../services/riskEngine');

router.get('/', async (req, res) => {
  try {
    const patientId = req.query.patientId;
    const query = patientId ? { patientId } : {};
    const logs = await ActivityLog.find(query).sort({ timestamp: -1 }).limit(100);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { patientId, interactionType } = req.body;

    const log = await ActivityLog.create({ patientId, interactionType });
    const patient = await Patient.findById(patientId);

    if (patient) {
      patient.lastActivityTime = new Date();
      await patient.save();
    }

    const riskLevel = interactionType === 'inactivity' ? 'MEDIUM' : 'LOW';
    const category = interactionType === 'inactivity' ? 'behavioral' : 'interaction';

    const event = await Event.create({
      patientId,
      eventType: interactionType,
      category,
      riskLevel,
      metadata: { activityLogId: log._id }
    });

    const io = req.app.get('io');
    io.to(`caregiver-${patientId}`).emit('activityLogged', log);
    io.to(`caregiver-${patientId}`).emit('eventCreated', event);

    if (interactionType === 'inactivity') {
      await applyRiskDelta({
        io,
        patientId,
        delta: 10,
        reason: 'risk_increased_due_to_inactivity',
        category: 'behavioral',
        metadata: { activityLogId: log._id }
      });
    }

    res.status(201).json(log);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
