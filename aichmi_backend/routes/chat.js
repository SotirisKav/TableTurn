import express from 'express';
import { askGemini } from '../services/AIservice.js';

const router = express.Router();

router.post('/', async (req, res) => {
  const { message, restaurantName, history } = req.body;
  let prompt = message;
  if (restaurantName) {
    prompt = `For the restaurant "${restaurantName}": ${message}`;
  }
  try {
    const aiText = await askGemini(prompt);
    res.json({ text: aiText });
  } catch (err) {
    res.status(500).json({ text: "Sorry, there was an error contacting the AI." });
  }
});

export default router;