const Task = require('../models/Task');
const Event = require('../models/Event');
const { applyRiskDelta } = require('./riskEngine');

const MISSED_TASK_RISK_DELTA = 12;

const startTaskMonitoring = (io) => {
  setInterval(async () => {
    try {
      const now = new Date();
      const overdueTasks = await Task.find({
        status: 'pending',
        scheduledTime: { $lt: now }
      });

      for (const task of overdueTasks) {
        task.status = 'missed';
        task.confirmedBy = null;
        await task.save();

        const event = await Event.create({
          patientId: task.patientId,
          eventType: 'task_missed',
          category: 'task',
          riskLevel: 'MEDIUM',
          metadata: {
            taskId: task._id,
            title: task.title,
            scheduledTime: task.scheduledTime
          }
        });

        io.to(`caregiver-${task.patientId}`).emit('taskMissed', task);
        io.to(`caregiver-${task.patientId}`).emit('eventCreated', event);

        await applyRiskDelta({
          io,
          patientId: task.patientId,
          delta: MISSED_TASK_RISK_DELTA,
          reason: 'risk_increased_due_to_missed_task',
          category: 'task',
          metadata: { taskId: task._id }
        });
      }
    } catch (error) {
      console.error('Task monitor error:', error.message);
    }
  }, 30000);
};

module.exports = { startTaskMonitoring };
