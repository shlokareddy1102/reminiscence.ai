const router = require('express').Router();
const mongoose = require('mongoose');
const WebsiteSession = require('../models/WebsiteSession');

const formatDuration = (seconds) => {
  const safeSeconds = Math.max(0, Math.round(seconds || 0));
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${mins}m ${secs}s`;
};

router.post('/session/start', async (req, res) => {
  try {
    const { clientId, userId, role = 'guest', pagePath = '/' } = req.body;

    if (!clientId) {
      return res.status(400).json({ message: 'clientId is required' });
    }

    const session = await WebsiteSession.create({
      clientId,
      userId: userId && mongoose.Types.ObjectId.isValid(userId) ? userId : null,
      role,
      pagePath,
      startedAt: new Date(),
      isActive: true
    });

    res.json({ sessionId: session._id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const endSessionById = async (sessionId) => {
  if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) {
    return null;
  }

  const session = await WebsiteSession.findById(sessionId);
  if (!session || !session.isActive) {
    return null;
  }

  session.endedAt = new Date();
  session.durationSeconds = Math.max(0, Math.round((session.endedAt.getTime() - session.startedAt.getTime()) / 1000));
  session.isActive = false;
  await session.save();

  return session;
};

router.post('/session/end', async (req, res) => {
  try {
    const { sessionId } = req.body;
    await endSessionById(sessionId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/session/end-beacon', async (req, res) => {
  try {
    const { sessionId } = req.body;
    await endSessionById(sessionId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/overview', async (_req, res) => {
  try {
    const sessions = await WebsiteSession.find({}).select('clientId startedAt endedAt durationSeconds isActive').lean();

    const uniqueVisitors = new Set(sessions.map((session) => session.clientId).filter(Boolean)).size;

    const nowMs = Date.now();
    const durations = sessions.map((session) => {
      if (session.durationSeconds && session.durationSeconds > 0) {
        return session.durationSeconds;
      }

      const startedMs = new Date(session.startedAt).getTime();
      const endedMs = session.endedAt ? new Date(session.endedAt).getTime() : nowMs;
      return Math.max(0, Math.round((endedMs - startedMs) / 1000));
    });

    const averageTimeSeconds = durations.length
      ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
      : 0;

    res.json({
      visitorCount: uniqueVisitors,
      averageTimeSeconds,
      averageTimeDisplay: formatDuration(averageTimeSeconds)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
