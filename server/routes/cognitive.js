const router = require('express').Router();
const mongoose = require('mongoose');
const { authenticateToken } = require('../middleware/auth');
const CognitiveSession = require('../models/CognitiveSession');
const Alert = require('../models/Alert');
const { applyRiskDelta } = require('../services/riskEngine');
const {
  startOfDay,
  buildSessionQuestions,
  evaluateQuestion,
  avgPercent,
  summarizeTrend
} = require('../services/cognitiveCheckInService');

const asObjectId = (id) => (mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null);

router.get('/:patientId/session', authenticateToken, async (req, res) => {
  try {
    const { patientId } = req.params;
    const objectId = asObjectId(patientId);
    if (!objectId) return res.status(400).json({ message: 'Invalid patientId' });

    const sessionDate = startOfDay();

    let session = await CognitiveSession.findOne({ patientId: objectId, sessionDate }).lean();
    if (session && session.status === 'completed') {
      return res.json({ session, reuse: true });
    }

    if (!session) {
      const questions = await buildSessionQuestions({ patientId: objectId });
      session = await CognitiveSession.create({
        patientId: objectId,
        sessionDate,
        sessionLabel: 'Nightly Cognitive Check-in',
        status: 'pending',
        questions
      });
      return res.json({ session, reuse: false });
    }

    return res.json({ session, reuse: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post('/:patientId/submit', authenticateToken, async (req, res) => {
  try {
    const { patientId } = req.params;
    const objectId = asObjectId(patientId);
    if (!objectId) return res.status(400).json({ message: 'Invalid patientId' });

    const { sessionId, answers = [] } = req.body;
    const answerMap = new Map((Array.isArray(answers) ? answers : []).map((item) => [String(item.questionId), String(item.response || '')]));

    const session = await CognitiveSession.findOne({ _id: sessionId, patientId: objectId });
    if (!session) return res.status(404).json({ message: 'Session not found' });

    const evaluated = session.questions.map((question) => {
      const response = answerMap.get(String(question.questionId)) || '';
      const result = evaluateQuestion(question, response, session.sessionDate);
      return {
        ...question.toObject(),
        response: result.response,
        recallAccuracy: result.recallAccuracy,
        confusionSignal: result.confusionSignal,
        score: result.score,
        supportiveFeedback: result.supportiveFeedback
      };
    });

    const cognitiveScore = avgPercent(evaluated);
    const orientationScore = avgPercent(evaluated.filter((q) => q.category === 'orientation'));
    const peopleRecognitionScore = avgPercent(evaluated.filter((q) => q.category === 'people_recognition'));

    const emotionalQuestion = evaluated.find((q) => q.category === 'emotional_reflection');
    const emotionalText = String(emotionalQuestion?.response || '').toLowerCase();
    const emotionalTone = /sad|upset|angry|worried|bad/.test(emotionalText)
      ? 'negative'
      : /happy|good|great|calm|fine/.test(emotionalText)
        ? 'positive'
        : 'neutral';

    const previousSessions = await CognitiveSession.find({
      patientId: objectId,
      status: 'completed',
      _id: { $ne: session._id }
    }).sort({ sessionDate: -1 }).limit(7).lean();

    const baseline = previousSessions.length
      ? Math.round(previousSessions.reduce((sum, item) => sum + Number(item.cognitiveScore || 0), 0) / previousSessions.length)
      : cognitiveScore;

    const recallTrend = summarizeTrend(cognitiveScore, baseline);

    session.questions = evaluated;
    session.status = 'completed';
    session.cognitiveScore = cognitiveScore;
    session.orientationScore = orientationScore;
    session.peopleRecognitionScore = peopleRecognitionScore;
    session.recallTrend = recallTrend;
    session.emotionalTone = emotionalTone;

    let declineAlert = null;
    if (previousSessions.length && baseline - cognitiveScore >= 15 && !session.declineAlerted) {
      declineAlert = await Alert.create({
        patientId: objectId,
        message: 'Memory recall dropped this week. Please review the latest cognitive check-in.',
        riskLevel: 'MEDIUM'
      });
      session.declineAlerted = true;
    }

    await session.save();

    const confusionCount = evaluated.filter((q) => q.confusionSignal === 'high').length;
    const mappedSignals = {
      recallAccuracy: cognitiveScore >= 75 ? 'high' : cognitiveScore >= 45 ? 'medium' : 'low',
      confusionLevel: confusionCount >= 2 ? 'high' : confusionCount === 1 ? 'medium' : 'low'
    };

    // Cognitive outcomes should influence ongoing risk trend, not stay siloed.
    const io = req.app.get('io');
    if (cognitiveScore < 40 || mappedSignals.confusionLevel === 'high') {
      await applyRiskDelta({
        io,
        patientId: objectId,
        delta: 8,
        reason: 'cognitive_recall_drop',
        category: 'cognitive',
        metadata: {
          cognitiveScore,
          confusionLevel: mappedSignals.confusionLevel
        }
      });
    } else if (cognitiveScore >= 75 && mappedSignals.confusionLevel === 'low') {
      await applyRiskDelta({
        io,
        patientId: objectId,
        delta: -4,
        reason: 'cognitive_recall_stable',
        category: 'cognitive',
        metadata: {
          cognitiveScore,
          confusionLevel: mappedSignals.confusionLevel
        }
      });
    }

    const reinforcement = evaluated
      .filter((q) => q.recallAccuracy === 'low' && q.supportiveFeedback)
      .map((q) => ({ questionId: q.questionId, message: q.supportiveFeedback }))
      .slice(0, 3);

    return res.json({
      session,
      mappedSignals,
      declineAlert,
      reinforcement,
      summary: {
        cognitiveScore,
        recallTrend,
        orientationScore,
        peopleRecognitionScore
      }
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get('/:patientId/trend', authenticateToken, async (req, res) => {
  try {
    const { patientId } = req.params;
    const objectId = asObjectId(patientId);
    if (!objectId) return res.status(400).json({ message: 'Invalid patientId' });

    const days = Math.max(7, Math.min(Number(req.query.days) || 30, 180));
    const since = startOfDay(new Date(Date.now() - days * 24 * 60 * 60 * 1000));

    const sessions = await CognitiveSession.find({
      patientId: objectId,
      status: 'completed',
      sessionDate: { $gte: since }
    }).sort({ sessionDate: 1 }).lean();

    const trend = sessions.map((item) => ({
      date: item.sessionDate,
      label: new Date(item.sessionDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      cognitiveScore: item.cognitiveScore,
      orientationScore: item.orientationScore,
      peopleRecognitionScore: item.peopleRecognitionScore,
      recallTrend: item.recallTrend
    }));

    return res.json({ trend, total: trend.length });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;
