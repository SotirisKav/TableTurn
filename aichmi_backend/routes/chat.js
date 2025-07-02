const express = require('express');
const axios = require('axios');
const router = express.Router();

router.post('/', async (req, res) => {
  const { message, restaurantName, history } = req.body;
  try {
    const openaiRes = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: restaurantName ? `You are an AI assistant helping with reservations for ${restaurantName}.` : 'You are an AI assistant for a Greek restaurant reservation platform.' },
          ...(history || []).map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text })),
          { role: 'user', content: message }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    const aiMessage = openaiRes.data.choices[0].message.content;
    res.json({ text: aiMessage });
  } catch (err) {
    res.status(500).json({ error: 'AI service error', details: err.message });
  }
});

module.exports = router; 