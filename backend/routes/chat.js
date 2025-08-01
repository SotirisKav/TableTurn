import express from 'express';
import { askGemini } from '../services/AIService.js';
import AgentOrchestrator from '../services/agents/AgentOrchestrator.js';

const router = express.Router();

// Initialize the multi-agent orchestrator
const orchestrator = new AgentOrchestrator();

router.post('/', async (req, res) => {
  try {
    console.log('=== MULTI-AGENT CHAT ROUTE CALLED ===');
    console.log('Request body:', req.body);
    
    const { message, history = [], restaurantId = null, useMultiAgent = true, sessionId = null } = req.body;
    
    // Use default restaurant ID (1 for Lofaki Taverna) if none provided
    const effectiveRestaurantId = restaurantId || 1;
    
    if (!message) {
      console.log('No message provided');
      return res.status(400).json({ error: 'Message is required' });
    }

    let result;
    
    if (useMultiAgent) {
      console.log('🎭 Using Multi-Agent System');
      console.log('Processing with orchestrator:', { message, historyLength: history.length, restaurantId: effectiveRestaurantId });
      
      result = await orchestrator.processMessage(message, history, effectiveRestaurantId, sessionId);
      
      console.log('=== MULTI-AGENT RESPONSE READY ===');
      console.log('Active agent:', result.orchestrator?.agent);
      console.log('Detected intent:', result.orchestrator?.intent);
      console.log('Response type:', result.type);
    } else {
      console.log('🤖 Using Legacy Single-Agent System');
      console.log('Calling askGemini with:', { message, historyLength: history.length, restaurantId: effectiveRestaurantId });
      
      result = await askGemini(message, history, effectiveRestaurantId);
      
      console.log('=== SINGLE-AGENT RESPONSE READY ===');
      console.log('Response type:', result.type);
    }
    
    console.log('Response to send to frontend:', result.response);
    
    // Send the result with timestamp
    res.json({
      ...result,
      timestamp: result.timestamp || new Date().toISOString(),
      multiAgent: useMultiAgent
    });
    
    console.log('=== RESPONSE SENT ===');
    
  } catch (error) {
    console.error('=== CHAT ROUTE ERROR ===');
    console.error('Chat error:', error);
    res.status(500).json({ 
      error: 'Failed to get AI response',
      timestamp: new Date().toISOString(),
      type: 'error'
    });
  }
});

export default router;