const router = require('express').Router();
const Task = require('../models/Task');
const Event = require('../models/Event');
const ActivityLog = require('../models/ActivityLog');
const Patient = require('../models/Patient');
const { applyRiskDelta } = require('../services/riskEngine');

router.post('/', async (req, res) => {
  try {
    const { patientId, title, type, scheduledTime } = req.body;
    const task = await Task.create({ patientId, title, type, scheduledTime });

    const event = await Event.create({
      patientId,
      eventType: 'task_created',
      category: 'task',
      riskLevel: 'LOW',
      metadata: {
        taskId: task._id,
        title: task.title,
        scheduledTime: task.scheduledTime
      }
    });

    const io = req.app.get('io');
    io.to(`caregiver-${patientId}`).emit('taskCreated', task);
    io.to(`caregiver-${patientId}`).emit('eventCreated', event);

    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const patientId = req.query.patientId;
    const query = patientId ? { patientId } : {};
    const tasks = await Task.find(query).sort({ scheduledTime: 1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/complete', async (req, res) => {
  try {
    const { taskId, confirmedBy = 'button' } = req.body;
    const task = await Task.findById(taskId);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    task.status = 'completed';
    task.confirmedBy = confirmedBy;
    await task.save();

    await ActivityLog.create({
      patientId: task.patientId,
      interactionType: confirmedBy === 'voice' ? 'voice_confirmation' : 'button_press'
    });

    const patient = await Patient.findById(task.patientId);
    if (patient) {
      patient.lastActivityTime = new Date();
      await patient.save();
    }

    const event = await Event.create({
      patientId: task.patientId,
      eventType: 'task_completed',
      category: 'task',
      riskLevel: 'LOW',
      metadata: {
        taskId: task._id,
        title: task.title,
        confirmedBy
      }
    });

    const io = req.app.get('io');
    io.to(`caregiver-${task.patientId}`).emit('taskCompleted', task);
    io.to(`caregiver-${task.patientId}`).emit('eventCreated', event);

    await applyRiskDelta({
      io,
      patientId: task.patientId,
      delta: -6,
      reason: 'risk_decreased_due_to_task_completion',
      category: 'interaction',
      metadata: { taskId: task._id, confirmedBy }
    });

    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
