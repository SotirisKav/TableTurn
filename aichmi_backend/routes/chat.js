import express from 'express';
import { askGemini } from '../services/AIService.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    console.log('=== CHAT ROUTE CALLED ===');
    console.log('Request body:', req.body);
    
    const { message, history = [], restaurantId = null } = req.body;
    
    if (!message) {
      console.log('No message provided');
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log('Calling askGemini with:', { message, historyLength: history.length, restaurantId });
    
    const result = await askGemini(message, history, restaurantId);
    
    console.log('=== AI RESPONSE READY ===');
    console.log('Response type:', result.type);
    console.log('Response to send to frontend:', result.response);
    
    // Send the result as-is (it already has the correct structure)
    res.json({
      ...result,
      timestamp: new Date().toISOString()
    });
    
    console.log('=== RESPONSE SENT ===');
    
  } catch (error) {
    console.error('=== CHAT ROUTE ERROR ===');
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to get AI response' });
  }
});

export default router;