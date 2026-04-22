/**
 * routes/companion.js
 *
 * Groq proxy for CompanionBot — keeps API key server-side only.
 *
 * POST /api/companion/chat
 *   body:    { messages: [{role, content}], systemPrompt: string }
 *   returns: { reply: string }
 */

const router = require('express').Router();
const axios  = require('axios');

const GROQ_URL   = process.env.GROQ_API_URL  || 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = process.env.GROQ_MODEL    || 'llama-3.1-8b-instant';
const GROQ_KEY   = process.env.GROQ_API_KEY;

const SAFE_FALLBACK = 'I am right here with you. Tell me how you are feeling.';

router.post('/chat', async (req, res) => {
  if (!GROQ_KEY) {
    return res.json({ reply: SAFE_FALLBACK });
  }

  const { messages = [], systemPrompt = '' } = req.body;

  if (!Array.isArray(messages) || !messages.length) {
    return res.status(400).json({ error: 'messages array is required.' });
  }

  const groqMessages = [
    {
      role:    'system',
      content: systemPrompt || 'You are Mira, a warm, gentle companion for a dementia patient. Be calm and reassuring. Max 2 short sentences.',
    },
    ...messages.slice(-10).map((m) => ({
      role:    m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content || '').slice(0, 500),
    })),
  ];

  try {
    const response = await axios.post(
      GROQ_URL,
      {
        model:       GROQ_MODEL,
        temperature: 0.55,
        max_tokens:  160,
        messages:    groqMessages,
      },
      {
        headers: {
          Authorization:  `Bearer ${GROQ_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    const reply = response.data?.choices?.[0]?.message?.content?.trim() || '';
    return res.json({ reply: reply || SAFE_FALLBACK });

  } catch (err) {
    console.error('[Companion] Groq error:', err?.response?.data || err.message);
    return res.json({ reply: SAFE_FALLBACK });
  }
});

module.exports = router;