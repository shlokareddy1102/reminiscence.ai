const router = require('express').Router();
const CalendarEvent = require('../models/CalendarEvent');

// Get all calendar events for a patient
router.get('/', async (req, res) => {
  try {
    const { patientId, startDate, endDate } = req.query;

    if (!patientId) {
      return res.status(400).json({ message: 'patientId is required' });
    }

    const query = { patientId };

    // Filter by date range if provided
    if (startDate || endDate) {
      query.startTime = {};
      if (startDate) query.startTime.$gte = new Date(startDate);
      if (endDate) query.startTime.$lte = new Date(endDate);
    }

    const events = await CalendarEvent.find(query)
      .sort({ startTime: 1 })
      .populate('createdBy', 'name email')
      .lean();

    res.json(events);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get upcoming events (next 7 days)
router.get('/upcoming', async (req, res) => {
  try {
    const { patientId } = req.query;

    if (!patientId) {
      return res.status(400).json({ message: 'patientId is required' });
    }

    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const events = await CalendarEvent.find({
      patientId,
      startTime: { $gte: now, $lte: sevenDaysLater },
      completed: false
    })
      .sort({ startTime: 1 })
      .limit(10)
      .lean();

    res.json(events);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new calendar event
router.post('/', async (req, res) => {
  try {
    const {
      patientId,
      title,
      description,
      eventType,
      startTime,
      endTime,
      allDay,
      location,
      reminder,
      recurring
    } = req.body;

    if (!patientId || !title || !eventType || !startTime) {
      return res.status(400).json({ 
        message: 'patientId, title, eventType, and startTime are required' 
      });
    }

    const event = await CalendarEvent.create({
      patientId,
      title,
      description,
      eventType,
      startTime: new Date(startTime),
      endTime: endTime ? new Date(endTime) : null,
      allDay,
      location,
      reminder,
      recurring,
      createdBy: req.user?.id || null
    });

    const populatedEvent = await CalendarEvent.findById(event._id)
      .populate('createdBy', 'name email')
      .lean();

    // Emit socket event for real-time sync
    const io = req.app.get('io');
    if (io) {
      io.to(`caregiver-${patientId}`).emit('calendarEventCreated', populatedEvent);
      io.to(`patient-${patientId}`).emit('calendarEventCreated', populatedEvent);
    }

    res.status(201).json(populatedEvent);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update a calendar event
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Convert date strings to Date objects
    if (updates.startTime) updates.startTime = new Date(updates.startTime);
    if (updates.endTime) updates.endTime = new Date(updates.endTime);

    const event = await CalendarEvent.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    )
      .populate('createdBy', 'name email')
      .lean();

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Emit socket event for real-time sync
    const io = req.app.get('io');
    if (io) {
      io.to(`caregiver-${event.patientId}`).emit('calendarEventUpdated', event);
      io.to(`patient-${event.patientId}`).emit('calendarEventUpdated', event);
    }

    res.json(event);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark event as completed
router.put('/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;

    const event = await CalendarEvent.findByIdAndUpdate(
      id,
      { completed: true },
      { new: true }
    )
      .populate('createdBy', 'name email')
      .lean();

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`caregiver-${event.patientId}`).emit('calendarEventCompleted', event);
      io.to(`patient-${event.patientId}`).emit('calendarEventCompleted', event);
    }

    res.json(event);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a calendar event
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const event = await CalendarEvent.findByIdAndDelete(id).lean();

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`caregiver-${event.patientId}`).emit('calendarEventDeleted', { id });
      io.to(`patient-${event.patientId}`).emit('calendarEventDeleted', { id });
    }

    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
