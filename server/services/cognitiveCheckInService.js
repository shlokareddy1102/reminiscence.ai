const axios = require('axios');
const KnownPerson = require('../models/KnownPerson');
const DailyHealthLog = require('../models/DailyHealthLog');
const CognitiveSession = require('../models/CognitiveSession');

const GROQ_API_URL = process.env.GROQ_API_URL || 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

const startOfDay = (dateInput = new Date()) => {
  const value = new Date(dateInput);
  value.setHours(0, 0, 0, 0);
  return value;
};

const normalize = (value) => String(value || '').trim().toLowerCase();

const idkResponse = (response) => {
  const text = normalize(response);
  return text.includes("don't remember")
    || text.includes('dont remember')
    || text.includes('not sure')
    || text.includes('forgot')
    || text.includes('i do not know')
    || text === 'idk';
};

const toneFromResponse = (response = '') => {
  const text = normalize(response);
  if (!text) return 'neutral';
  if (/happy|good|great|calm|nice|better|fine/.test(text)) return 'positive';
  if (/sad|upset|angry|worried|bad|scared|tired/.test(text)) return 'negative';
  return 'neutral';
};

const mapFoodHint = (food) => {
  if (food === 'normal') return 'You had your usual meals today.';
  if (food === 'skipped') return 'You skipped at least one meal today.';
  return 'Your meal pattern was not fully captured today.';
};

const mapActivityHint = (activity) => {
  if (activity === 'high') return 'You were active and moved around well today.';
  if (activity === 'medium') return 'You had moderate activity through the day.';
  if (activity === 'low') return 'You were mostly resting today.';
  return 'Your activity pattern was not fully captured today.';
};

const buildCoreQuestions = ({ knownPeople, latestLog, today }) => {
  const dayName = today.toLocaleDateString(undefined, { weekday: 'long' });
  const person = knownPeople[0] || null;
  const rotation = today.getDate() % 3;

  const dayRecallPool = [
    {
      category: 'day_recall',
      prompt: 'What did you eat today?',
      expectedAnswer: latestLog?.food || 'unknown',
      supportiveHint: mapFoodHint(latestLog?.food)
    },
    {
      category: 'day_recall',
      prompt: 'What did you do in the morning?',
      expectedAnswer: latestLog?.activity || 'unknown',
      supportiveHint: mapActivityHint(latestLog?.activity)
    },
    {
      category: 'day_recall',
      prompt: 'Did you go outside today?',
      expectedAnswer: latestLog?.activity === 'high' || latestLog?.activity === 'medium' ? 'yes' : 'no',
      supportiveHint: latestLog?.activity === 'high' || latestLog?.activity === 'medium'
        ? 'You did move around today, including outside activity.'
        : 'You stayed mostly indoors today.'
    }
  ];

  const orientationPool = [
    {
      category: 'orientation',
      prompt: 'What day is it today?',
      expectedAnswer: dayName,
      supportiveHint: `That is okay. Today is ${dayName}.`,
      options: []
    },
    {
      category: 'orientation',
      prompt: 'Where are you right now?',
      expectedAnswer: 'home',
      supportiveHint: 'That is okay. You are at home and safe.',
      options: ['Home', 'Hospital', 'Outside']
    }
  ];

  const emotionalQuestion = {
    category: 'emotional_reflection',
    prompt: 'How was your day? Did anything make you happy or upset?',
    expectedAnswer: '',
    supportiveHint: 'Thank you for sharing. Your feelings matter.',
    options: []
  };

  const peopleQuestion = person
    ? {
        category: 'people_recognition',
        prompt: 'Do you remember who this is?',
        expectedAnswer: person.name,
        supportiveHint: `That is okay. This is ${person.name}, your ${person.relationship}.`,
        image: person.photo || ''
      }
    : null;

  if (rotation === 0) {
    return [dayRecallPool[0], peopleQuestion, orientationPool[0], emotionalQuestion].filter(Boolean);
  }

  if (rotation === 1) {
    return [dayRecallPool[1], orientationPool[0], orientationPool[1], emotionalQuestion].filter(Boolean);
  }

  return [peopleQuestion, dayRecallPool[2], orientationPool[1], emotionalQuestion].filter(Boolean);
};

const addContextAwareQuestions = ({ questions, latestLog }) => {
  const enriched = [...questions];

  if (latestLog?.activity === 'low' || latestLog?.activity === 'unknown') {
    enriched.push({
      category: 'follow_up',
      prompt: 'Would you like a short walk or stretch later today?',
      expectedAnswer: 'yes',
      supportiveHint: 'Small movement helps your mind and body feel better.',
      options: ['Yes', 'Maybe later', 'No']
    });
  }

  if (latestLog?.gotLost || latestLog?.confusionLevel === 'moderate' || latestLog?.confusionLevel === 'severe') {
    enriched.push({
      category: 'follow_up',
      prompt: 'Are you feeling clear and safe right now?',
      expectedAnswer: 'yes',
      supportiveHint: 'That is okay. You are safe, and your care team is here for you.',
      options: ['Yes', 'A little confused', 'No']
    });
  }

  return enriched.slice(0, 6);
};

const safeParseJson = (text) => {
  try {
    return JSON.parse(text);
  } catch (_err) {
    return null;
  }
};

const adaptQuestionsWithGroq = async ({ questions, latestLog }) => {
  if (!process.env.GROQ_API_KEY) return questions;

  try {
    const prompt = {
      context: {
        activity: latestLog?.activity || 'unknown',
        sleep: latestLog?.sleep || 'unknown',
        confusionLevel: latestLog?.confusionLevel || 'none'
      },
      questions: questions.map((q) => ({ prompt: q.prompt, category: q.category }))
    };

    const response = await axios.post(
      GROQ_API_URL,
      {
        model: GROQ_MODEL,
        temperature: 0.3,
        max_tokens: 500,
        messages: [
          {
            role: 'system',
            content: 'Rewrite each prompt in a warm, supportive dementia-care tone. Return strict JSON array of strings with same length as input.'
          },
          {
            role: 'user',
            content: JSON.stringify(prompt)
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 8000
      }
    );

    const content = response.data?.choices?.[0]?.message?.content || '';
    const rewritten = safeParseJson(content);
    if (!Array.isArray(rewritten) || rewritten.length !== questions.length) return questions;

    return questions.map((q, index) => ({
      ...q,
      prompt: String(rewritten[index] || q.prompt)
    }));
  } catch (_err) {
    return questions;
  }
};

const withQuestionIds = (questions) => questions.map((question, index) => ({
  questionId: `q${index + 1}_${Date.now()}`,
  options: Array.isArray(question.options) ? question.options : [],
  image: question.image || '',
  ...question
}));

const buildSessionQuestions = async ({ patientId }) => {
  const today = startOfDay();
  const [knownPeople, recentLogs] = await Promise.all([
    KnownPerson.find({ patientId }).sort({ updatedAt: -1 }).limit(3).lean(),
    DailyHealthLog.find({ patientId }).sort({ date: -1 }).limit(7).lean()
  ]);

  const latestLog = recentLogs[0] || null;
  const core = buildCoreQuestions({ knownPeople, latestLog, today });
  const enriched = addContextAwareQuestions({ questions: core, latestLog });
  const adapted = await adaptQuestionsWithGroq({ questions: enriched, latestLog });
  return withQuestionIds(adapted);
};

const evaluateQuestion = (question, response, sessionDate) => {
  const text = String(response || '').trim();
  const normalizedText = normalize(text);

  if (!text || idkResponse(text)) {
    return {
      response: text,
      recallAccuracy: 'low',
      confusionSignal: 'high',
      score: 0.2,
      supportiveFeedback: question.supportiveHint || 'That is okay. We will practice together gently.'
    };
  }

  if (question.category === 'people_recognition') {
    const expected = normalize(question.expectedAnswer).split(' ')[0];
    const correct = expected && normalizedText.includes(expected);
    return {
      response: text,
      recallAccuracy: correct ? 'high' : 'low',
      confusionSignal: correct ? 'low' : 'medium',
      score: correct ? 1 : 0.2,
      supportiveFeedback: correct
        ? 'Great recall. You recognized a familiar face.'
        : (question.supportiveHint || 'That is okay. Familiar faces become easier with practice.')
    };
  }

  if (question.category === 'orientation') {
    const expected = normalize(question.expectedAnswer);
    const todayDay = normalize(new Date(sessionDate).toLocaleDateString(undefined, { weekday: 'long' }));
    const matched = expected === 'home'
      ? /home|house/.test(normalizedText)
      : normalizedText.includes(expected) || normalizedText.includes(todayDay);

    return {
      response: text,
      recallAccuracy: matched ? 'high' : 'low',
      confusionSignal: matched ? 'low' : 'medium',
      score: matched ? 1 : 0.2,
      supportiveFeedback: matched ? 'Nice orientation check.' : (question.supportiveHint || 'That is okay. We will keep this gentle and consistent.')
    };
  }

  if (question.category === 'emotional_reflection') {
    const tone = toneFromResponse(text);
    return {
      response: text,
      recallAccuracy: text.length > 6 ? 'high' : 'medium',
      confusionSignal: 'low',
      score: text.length > 6 ? 1 : 0.6,
      emotionalTone: tone,
      supportiveFeedback: 'Thank you for sharing that. Your feelings are important.'
    };
  }

  const medium = text.length >= 8;
  const high = medium && !idkResponse(text);
  return {
    response: text,
    recallAccuracy: high ? 'high' : 'medium',
    confusionSignal: high ? 'low' : 'medium',
    score: high ? 1 : 0.6,
    supportiveFeedback: high
      ? 'Nice memory recall.'
      : (question.supportiveHint || 'Thanks for trying. That was helpful.')
  };
};

const avgPercent = (items = []) => {
  if (!items.length) return 0;
  const avg = items.reduce((sum, item) => sum + Number(item.score || 0), 0) / items.length;
  return Math.round(avg * 100);
};

const summarizeTrend = (current, baseline) => {
  const delta = current - baseline;
  if (delta >= 5) return 'improving';
  if (delta <= -5) return 'declining';
  return 'stable';
};

module.exports = {
  startOfDay,
  buildSessionQuestions,
  evaluateQuestion,
  avgPercent,
  summarizeTrend
};
