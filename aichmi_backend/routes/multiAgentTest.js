/**
 * Multi-Agent Test Route
 * Test endpoint for the new multi-agent system
 */

import express from 'express';
import AgentOrchestrator from '../services/agents/AgentOrchestrator.js';
import RAGService from '../services/RAGService.js';

const router = express.Router();
const orchestrator = new AgentOrchestrator();

// Test endpoint for multi-agent system
router.post('/test', async (req, res) => {
    try {
        const { message, restaurantId = 1 } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: 'Message is required for testing' });
        }
        
        console.log(`🧪 Testing multi-agent system with: "${message}"`);
        
        // Test message with empty history
        const result = await orchestrator.processMessage(message, [], restaurantId);
        
        res.json({
            success: true,
            test: {
                input: message,
                restaurantId,
                timestamp: new Date().toISOString()
            },
            result: {
                ...result,
                conversationState: orchestrator.getConversationState()
            }
        });
        
    } catch (error) {
        console.error('❌ Multi-agent test error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Get agent status and configuration
router.get('/status', (req, res) => {
    try {
        const agents = Object.keys(orchestrator.agents).map(key => {
            const agent = orchestrator.agents[key];
            return agent.getInfo();
        });
        
        res.json({
            success: true,
            multiAgentSystem: {
                status: 'active',
                totalAgents: agents.length,
                agents,
                conversationState: orchestrator.getConversationState(),
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('❌ Agent status error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Reset conversation state
router.post('/reset', (req, res) => {
    try {
        orchestrator.resetConversationState();
        
        res.json({
            success: true,
            message: 'Conversation state reset successfully',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Reset error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Test intent analysis
router.post('/intent', async (req, res) => {
    try {
        const { message } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: 'Message is required for intent analysis' });
        }
        
        // Access the intent analysis method (we'll need to make it public)
        const intent = await orchestrator.analyzeIntent(message, []);
        const agent = orchestrator.selectAgent(intent);
        
        res.json({
            success: true,
            analysis: {
                message,
                detectedIntent: intent,
                selectedAgent: agent.name,
                agentCapabilities: agent.capabilities,
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('❌ Intent analysis error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Test RAG retrieval
router.post('/rag', async (req, res) => {
    try {
        const { message, restaurantId = 1, agentType = null } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: 'Message is required for RAG testing' });
        }
        
        console.log(`🧪 Testing RAG retrieval for: "${message}"`);
        
        // Test RAG retrieval
        const ragData = await RAGService.retrieveRelevantData(message, restaurantId, agentType);
        
        res.json({
            success: true,
            rag: {
                query: message,
                restaurantId,
                agentType,
                retrievalContext: ragData.retrievalContext,
                contextSummary: RAGService.generateContextSummary(ragData),
                dataRetrieved: {
                    restaurant: !!ragData.restaurant,
                    owner: !!ragData.owner,
                    hours: ragData.hours?.length || 0,
                    menu: ragData.menu?.length || 0,
                    reservations: ragData.reservations?.length || 0,
                    tables: ragData.tables?.length || 0,
                    fullyBookedDates: ragData.fullyBookedDates?.length || 0,
                    celebrations: !!ragData.celebrations,
                    transfers: ragData.transfers?.length || 0,
                    supportInfo: !!ragData.supportInfo
                },
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('❌ RAG test error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

export default router;