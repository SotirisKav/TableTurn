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
    
    const response = await askGemini(message, history, restaurantId);
    
    console.log('=== AI RESPONSE READY ===');
    console.log('Response to send to frontend:', response);
    
    const responseObj = { 
      response,
      timestamp: new Date().toISOString()
    };
    
    console.log('Final response object:', responseObj);
    
    res.json(responseObj);
    
    console.log('=== RESPONSE SENT ===');
    
  } catch (error) {
    console.error('=== CHAT ROUTE ERROR ===');
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to get AI response' });
  }
});

export default router;