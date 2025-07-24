/**
 * Multi-Agent Workflow Test Endpoint
 * Demonstrates the complete workflow for agent collaboration and hybrid RAG search
 */

import express from 'express';
import AgentOrchestrator from '../services/agents/AgentOrchestrator.js';

const router = express.Router();
const orchestrator = new AgentOrchestrator();

/**
 * Test the complete multi-agent workflow
 * POST /api/test-multi-agent
 */
router.post('/test-multi-agent', async (req, res) => {
    try {
        const { message, restaurantId, history = [] } = req.body;
        
        if (!message || !restaurantId) {
            return res.status(400).json({
                error: 'Missing required fields: message and restaurantId'
            });
        }
        
        console.log(`🎭 Testing multi-agent workflow for restaurant ${restaurantId}`);
        console.log(`📝 User query: "${message}"`);
        
        // Process the message through the orchestrator
        const result = await orchestrator.processMessage(message, history, restaurantId);
        
        console.log('✅ Multi-agent workflow completed');
        
        // Return detailed response for testing
        return res.json({
            success: true,
            result,
            timestamp: new Date().toISOString(),
            testInfo: {
                restaurantId,
                originalQuery: message,
                workflowType: result.multiAgent ? 'multi-agent' : 'single-agent'
            }
        });
        
    } catch (error) {
        console.error('❌ Multi-agent workflow test error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Test specific user scenario: Quiet romantic table + gluten-free menu
 * POST /api/test-scenario
 */
router.post('/test-scenario', async (req, res) => {
    try {
        const { restaurantId = 1 } = req.body;
        
        // The exact scenario from the requirements
        const testMessage = "I want to book a quiet, romantic table for two this Friday. Also, what are your best gluten-free main courses?";
        
        console.log(`🎯 Testing specific scenario for restaurant ${restaurantId}`);
        console.log(`📝 Scenario query: "${testMessage}"`);
        
        // Track the workflow step by step
        const startTime = Date.now();
        
        // Process through orchestrator
        const result = await orchestrator.processMessage(testMessage, [], restaurantId);
        
        const endTime = Date.now();
        const processingTime = endTime - startTime;
        
        console.log(`⏱️ Processing completed in ${processingTime}ms`);
        
        // Analyze the result
        const analysis = {
            workflowType: result.multiAgent ? 'multi-agent' : 'single-agent',
            agentsInvolved: result.multiAgent?.delegationChain?.map(d => d.agent) || [result.orchestrator?.agent],
            ragSearchPerformed: {
                tableSearch: result.response?.includes('table') || result.response?.includes('romantic'),
                menuSearch: result.response?.includes('gluten') || result.response?.includes('main course')
            },
            databaseInsertion: result.data?.reservationId ? 'completed' : 'pending',
            processingTimeMs: processingTime
        };
        
        return res.json({
            success: true,
            scenario: "Quiet romantic table + gluten-free menu query",
            result,
            analysis,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Scenario test error:', error);
        return res.status(500).json({
            error: 'Scenario test failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Generate embeddings for existing data
 * POST /api/generate-embeddings
 */
router.post('/generate-embeddings', async (req, res) => {
    try {
        const { restaurantId } = req.body;
        
        console.log(`🚀 Generating embeddings for restaurant ${restaurantId || 'all'}`);
        
        const RAGService = (await import('../services/RAGService.js')).default;
        
        const results = await RAGService.generateAllEmbeddings(restaurantId);
        
        return res.json({
            success: true,
            message: 'Embedding generation completed',
            results,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Embedding generation error:', error);
        return res.status(500).json({
            error: 'Embedding generation failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Test RAG Service directly
 * POST /api/test-rag
 */
router.post('/test-rag', async (req, res) => {
    try {
        const { query, restaurantId, searchType = 'both' } = req.body;
        
        if (!query || !restaurantId) {
            return res.status(400).json({
                error: 'Missing required fields: query and restaurantId'
            });
        }
        
        console.log(`🔍 Testing RAG service: "${query}"`);
        
        const RAGService = (await import('../services/RAGService.js')).default;
        
        const results = {};
        
        // Test semantic table search
        if (searchType === 'tables' || searchType === 'both') {
            console.log('🪑 Testing semantic table search...');
            results.tableSearch = await RAGService.semanticTableSearch(query, restaurantId);
        }
        
        // Test hybrid menu search
        if (searchType === 'menu' || searchType === 'both') {
            console.log('🍽️ Testing hybrid menu search...');
            const filters = {};
            
            // Extract filters from query
            if (query.toLowerCase().includes('gluten')) {
                filters.is_gluten_free = true;
            }
            if (query.toLowerCase().includes('vegetarian')) {
                filters.is_vegetarian = true;
            }
            if (query.toLowerCase().includes('main')) {
                filters.category = 'Main';
            }
            
            results.menuSearch = await RAGService.hybridMenuSearch(query, restaurantId, filters);
        }
        
        return res.json({
            success: true,
            query,
            restaurantId,
            searchType,
            results,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ RAG test error:', error);
        return res.status(500).json({
            error: 'RAG test failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Test vector search across all entities
 * POST /api/test-vector-search
 */
router.post('/test-vector-search', async (req, res) => {
    try {
        const { query, restaurantId, entityTypes = ['tables', 'menu_items', 'restaurant'], topK = 5 } = req.body;
        
        if (!query || !restaurantId) {
            return res.status(400).json({
                error: 'Missing required fields: query and restaurantId'
            });
        }
        
        console.log(`🔍 Testing vector search: "${query}"`);
        
        const RAGService = (await import('../services/RAGService.js')).default;
        
        const results = await RAGService.vectorSearch(query, restaurantId, entityTypes, topK);
        
        return res.json({
            success: true,
            query,
            restaurantId,
            entityTypes,
            topK,
            results: results.map(result => ({
                ...result,
                // Format for better readability
                relevanceScore: Math.round(result.relevanceScore * 10000) / 10000
            })),
            count: results.length,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Vector search test error:', error);
        return res.status(500).json({
            error: 'Vector search test failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Get orchestrator state for debugging
 * GET /api/orchestrator-state
 */
router.get('/orchestrator-state', (req, res) => {
    try {
        const state = orchestrator.getConversationState();
        
        return res.json({
            success: true,
            state,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ State retrieval error:', error);
        return res.status(500).json({
            error: 'Failed to retrieve orchestrator state',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Reset orchestrator state
 * POST /api/reset-orchestrator
 */
router.post('/reset-orchestrator', (req, res) => {
    try {
        orchestrator.resetConversationState();
        
        return res.json({
            success: true,
            message: 'Orchestrator state reset successfully',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Reset error:', error);
        return res.status(500).json({
            error: 'Failed to reset orchestrator state',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

export default router;