const router = require('express').Router();
const Location = require('../models/Location');
const SOSAlert = require('../models/SOSAlert');

// Update user's location
router.post('/update', async (req, res) => {
  try {
    const { userId, patientId, role, latitude, longitude, accuracy, address } = req.body;

    if (!userId || !patientId || !role || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ 
        message: 'userId, patientId, role, latitude, and longitude are required' 
      });
    }

    // Deactivate previous locations for this user
    await Location.updateMany(
      { userId, isActive: true },
      { isActive: false }
    );

    // Create new location record
    const location = await Location.create({
      userId,
      patientId,
      role,
      coordinates: { latitude, longitude, accuracy: accuracy || 0 },
      address: address || '',
      timestamp: new Date(),
      isActive: true
    });

    // Emit real-time update via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(`caregiver-${patientId}`).emit('locationUpdated', {
        userId,
        role,
        location: {
          latitude,
          longitude,
          accuracy,
          address,
          timestamp: location.timestamp
        }
      });
      io.to(`patient-${patientId}`).emit('locationUpdated', {
        userId,
        role,
        location: {
          latitude,
          longitude,
          accuracy,
          address,
          timestamp: location.timestamp
        }
      });
    }

    res.json(location);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all current locations for a patient's care team
router.get('/team/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;

    const locations = await Location.find({ 
      patientId, 
      isActive: true 
    })
      .populate('userId', 'name email role')
      .sort({ timestamp: -1 })
      .lean();

    res.json(locations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get location history for a user
router.get('/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50 } = req.query;

    const locations = await Location.find({ userId })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .lean();

    res.json(locations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Trigger SOS alert
router.post('/sos', async (req, res) => {
  try {
    const { userId, patientId, latitude, longitude, accuracy, address } = req.body;

    if (!userId || !patientId || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ 
        message: 'userId, patientId, latitude, and longitude are required' 
      });
    }

    // Create SOS alert
    const sosAlert = await SOSAlert.create({
      patientId,
      triggeredBy: userId,
      location: { latitude, longitude, accuracy: accuracy || 0 },
      address: address || '',
      status: 'active',
      timestamp: new Date()
    });

    const populatedAlert = await SOSAlert.findById(sosAlert._id)
      .populate('triggeredBy', 'name email role')
      .lean();

    // Emit urgent real-time alert via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(`caregiver-${patientId}`).emit('sosAlertTriggered', populatedAlert);
      io.to(`patient-${patientId}`).emit('sosAlertTriggered', populatedAlert);
    }

    res.status(201).json(populatedAlert);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Acknowledge SOS alert
router.put('/sos/:id/acknowledge', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, notes } = req.body;

    const sosAlert = await SOSAlert.findByIdAndUpdate(
      id,
      {
        status: 'acknowledged',
        acknowledgedBy: userId,
        acknowledgedAt: new Date(),
        notes: notes || ''
      },
      { new: true }
    )
      .populate('triggeredBy', 'name email role')
      .populate('acknowledgedBy', 'name email role')
      .lean();

    if (!sosAlert) {
      return res.status(404).json({ message: 'SOS alert not found' });
    }

    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
      io.to(`caregiver-${sosAlert.patientId}`).emit('sosAlertAcknowledged', sosAlert);
      io.to(`patient-${sosAlert.patientId}`).emit('sosAlertAcknowledged', sosAlert);
    }

    res.json(sosAlert);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Resolve SOS alert
router.put('/sos/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const sosAlert = await SOSAlert.findByIdAndUpdate(
      id,
      {
        status: 'resolved',
        resolvedAt: new Date(),
        notes: notes || sosAlert.notes
      },
      { new: true }
    )
      .populate('triggeredBy', 'name email role')
      .populate('acknowledgedBy', 'name email role')
      .lean();

    if (!sosAlert) {
      return res.status(404).json({ message: 'SOS alert not found' });
    }

    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
      io.to(`caregiver-${sosAlert.patientId}`).emit('sosAlertResolved', sosAlert);
      io.to(`patient-${sosAlert.patientId}`).emit('sosAlertResolved', sosAlert);
    }

    res.json(sosAlert);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get active SOS alerts for a patient
router.get('/sos/active/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;

    const alerts = await SOSAlert.find({ 
      patientId, 
      status: { $in: ['active', 'acknowledged'] }
    })
      .populate('triggeredBy', 'name email role')
      .populate('acknowledgedBy', 'name email role')
      .sort({ timestamp: -1 })
      .lean();

    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get SOS alert history
router.get('/sos/history/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const { limit = 20 } = req.query;

    const alerts = await SOSAlert.find({ patientId })
      .populate('triggeredBy', 'name email role')
      .populate('acknowledgedBy', 'name email role')
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .lean();

    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
