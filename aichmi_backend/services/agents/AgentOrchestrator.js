/**
 * Agent Orchestrator - True Hybrid "Agency" Architecture
 * 
 * CORRECTED IMPLEMENTATION: This orchestrator now serves as a "Dispatcher" that routes
 * tasks to specialized agents. Each specialized agent implements its own "Think -> Act -> Speak"
 * loop using the tool-based architecture, while maintaining modularity and agent specialization.
 */

import { getAiPlan, consolidateFinalResponse } from '../AIService.js';
import fetch from 'node-fetch';
import TableAvailabilityAgent from './TableAvailabilityAgent.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
import MenuPricingAgent from './MenuPricingAgent.js';
import CelebrationAgent from './CelebrationAgent.js';
import RestaurantInfoAgent from './RestaurantInfoAgent.js';
import ReservationAgent from './ReservationAgent.js';
import SupportContactAgent from './SupportContactAgent.js';

class AgentOrchestrator {
    constructor() {
        // Initialize all specialized agents
        this.agents = {
            TableAvailabilityAgent: new TableAvailabilityAgent(),
            MenuPricingAgent: new MenuPricingAgent(),
            CelebrationAgent: new CelebrationAgent(),
            RestaurantInfoAgent: new RestaurantInfoAgent(),
            ReservationAgent: new ReservationAgent(),
            SupportContactAgent: new SupportContactAgent()
        };
        
        // Conversation state for tracking agent handoffs and booking flow
        this.conversationState = {
            activeAgent: null,
            delegationChain: [],
            globalContext: {},
            remainingQuery: null,
            activeFlow: null, // e.g., 'booking', 'menu_inquiry'
            flowState: {},    // Stores collected data like { date, time, partySize }
            isAwaitingResponse: false, // Legacy flag (kept for compatibility)
            // NEW CRITICAL STATE PROPERTIES:
            isAwaitingUserResponse: false, // Is the AI waiting for a direct answer?
            nextAgent: null // Which agent should handle the next turn?
        };
    }

    /**
     * HYBRID ARCHITECTURE: Agent Dispatch and Handoff Management
     * 
     * This is the main entry point that implements the true hybrid approach:
     * 1. Dispatch: AI determines which specialized agent should handle the request
     * 2. Execute: The specialized agent uses its own "Think -> Act -> Speak" loop
     * 3. Handoff: If the agent indicates task incompleteness, route to the next agent
     */
    async processMessage(message, history = [], restaurantId = null) {
        try {
            console.log('🎭 HYBRID ARCHITECTURE: Dispatching message to specialized agents:', message);
            
            const effectiveRestaurantId = restaurantId || 1;
            let currentMessage = message;
            let finalResponse = '';
            let responseType = 'message';
            let additionalData = {};
            
            // NEW: Collect structured data instead of just appending responses
            let allToolResults = [];
            let originalCompleteMessage = message; // Store the original query for consolidation
            
            // Reset delegation chain for new conversation
            this.conversationState.delegationChain = [];
            
            // Initialize next agent tracking variable
            let nextAgentName = null;
            
            // MAIN DISPATCH LOOP: Continue until all parts of the query are handled
            while (currentMessage) {
                console.log('🔄 Processing message segment:', currentMessage);
                console.log('🔍 State check - isAwaitingUserResponse:', this.conversationState.isAwaitingUserResponse);
                console.log('🔍 State check - nextAgent:', this.conversationState.nextAgent);
                
                let targetAgent;
                
                // CRITICAL STATE-AWARE ROUTING: Check if we're awaiting a user response
                if (this.conversationState.isAwaitingUserResponse && this.conversationState.nextAgent) {
                    console.log(`🔍 State check PASSED. Directly routing to waiting agent: ${this.conversationState.nextAgent}`);
                    targetAgent = this.conversationState.nextAgent;
                    this.conversationState.isAwaitingUserResponse = false; // Reset the flag
                    this.conversationState.nextAgent = null; // Clear the next agent
                    
                    // Execute single waiting agent
                    const agentResult = await this.executeAgent(
                        targetAgent, 
                        currentMessage, 
                        history, 
                        effectiveRestaurantId,
                        this.conversationState.globalContext
                    );
                    
                    // Handle single agent result (existing logic)
                    console.log('📊 Agent result:', agentResult);
                    
                    // Update global context
                    if (agentResult.toolResult) {
                        this.conversationState.globalContext[targetAgent] = agentResult.toolResult;
                        console.log(`🌐 Updated globalContext with ${targetAgent} result:`, agentResult.toolResult);
                    }
                    
                    // Update delegation chain
                    this.conversationState.delegationChain.push({
                        agent: targetAgent,
                        message: currentMessage,
                        result: agentResult,
                        timestamp: new Date().toISOString()
                    });
                    
                    // Collect tool result
                    allToolResults.push({
                        tool: agentResult.toolResult?.tool || 'unknown',
                        agent: targetAgent,
                        data: agentResult.toolResult,
                        timestamp: agentResult.timestamp
                    });
                    
                    // Handle response types
                    if (agentResult.type === 'redirect') {
                        responseType = 'redirect';
                        additionalData = { ...additionalData, ...agentResult };
                    }
                    
                    // Check for handoffs (existing logic)
                    if (agentResult.isTaskComplete === false && agentResult.handoffSuggestion) {
                        currentMessage = agentResult.unansweredQuery;
                        nextAgentName = agentResult.handoffSuggestion;
                        this.conversationState.activeAgent = agentResult.handoffSuggestion;
                        this.conversationState.isAwaitingResponse = false;
                    } else {
                        currentMessage = null;
                        nextAgentName = null;
                        this.conversationState.activeAgent = null;
                        this.conversationState.isAwaitingResponse = false;
                    }
                    
                } else {
                    console.log("🔍 State check FAILED. Using DECOMPOSITION MODEL...");
                    
                    // STEP 1: DECOMPOSITION - AI creates multi-step execution plan
                    const executionPlan = await this.determineExecutionPlan(currentMessage, history, effectiveRestaurantId);
                    console.log('📋 PROJECT MANAGER: Execution plan created with', executionPlan.length, 'steps');
                    
                    // Execute each step in the plan
                    for (const step of executionPlan) {
                        console.log(`🔄 Executing Step ${step.step}: ${step.agent_to_use} - "${step.sub_task_query}"`);
                        
                        const stepResult = await this.executeAgent(
                            step.agent_to_use,
                            step.sub_task_query,
                            history,
                            effectiveRestaurantId,
                            this.conversationState.globalContext
                        );
                        
                        console.log(`📊 Step ${step.step} result:`, stepResult);
                        
                        // Update delegation chain
                        this.conversationState.delegationChain.push({
                            agent: step.agent_to_use,
                            message: step.sub_task_query,
                            result: stepResult,
                            timestamp: new Date().toISOString(),
                            step: step.step
                        });
                        
                        // Update global context
                        if (stepResult.toolResult) {
                            this.conversationState.globalContext[step.agent_to_use] = stepResult.toolResult;
                            console.log(`🌐 Updated globalContext with ${step.agent_to_use} result`);
                        }
                        
                        // Collect structured tool results
                        allToolResults.push({
                            tool: stepResult.toolResult?.tool || 'unknown',
                            agent: step.agent_to_use,
                            data: stepResult.toolResult,
                            timestamp: stepResult.timestamp,
                            step: step.step,
                            query: step.sub_task_query
                        });
                        
                        // Handle special response types (reservations, etc.)
                        if (stepResult.type === 'redirect') {
                            responseType = 'redirect';
                            additionalData = { ...additionalData, ...stepResult };
                        }
                    }
                    
                    // All steps completed, exit the main loop
                    currentMessage = null;
                    nextAgentName = null;
                    this.conversationState.activeAgent = null;
                    console.log('✅ All decomposition steps completed');
                }
            }
            
            // SPECIAL CASE: Check for successful reservation creation before Master Narrator
            for (const toolResult of allToolResults) {
                if (toolResult.data && toolResult.data.success && toolResult.data.reservationDetails) {
                    console.log('🎉 RESERVATION DETECTED: Bypassing Master Narrator for redirect');
                    const reservationData = toolResult.data.reservationDetails;
                    
                    // Format reservation details to match frontend expectations
                    const formattedReservationDetails = {
                        success: true,
                        reservationId: reservationData.reservationId,
                        restaurant: {
                            name: 'Lofaki Restaurant' // Can be made dynamic later
                        },
                        customer: {
                            name: reservationData.name,
                            email: reservationData.email,
                            phone: reservationData.phone
                        },
                        reservation: {
                            date: reservationData.date,
                            time: reservationData.time,
                            partySize: reservationData.partySize,
                            tableType: reservationData.tableType
                        }
                    };
                    
                    return {
                        response: 'Your reservation has been successfully created!',
                        type: 'redirect',
                        reservationDetails: formattedReservationDetails,
                        orchestrator: {
                            architecture: 'hybrid-agency-v2',
                            delegationChain: this.conversationState.delegationChain,
                            totalAgentsInvolved: this.conversationState.delegationChain.length,
                            finalAgent: this.conversationState.delegationChain[this.conversationState.delegationChain.length - 1]?.agent,
                            globalContext: this.conversationState.globalContext,
                            isConsolidated: false,
                            toolResultsCount: allToolResults.length,
                            timestamp: new Date().toISOString()
                        }
                    };
                }
            }
            
            // PHASE 2: MASTER NARRATOR - Single AI call to synthesize all tool results
            let masterResponse;
            let isConsolidated = false;
            
            if (allToolResults.length > 0) {
                console.log('🎭 MASTER NARRATOR: Synthesizing all tool results into single response...');
                try {
                    // Import generateSpokenResponse here to avoid circular dependency
                    const { generateSpokenResponse } = await import('../AIService.js');
                    
                    // Single AI call with all collected tool results + conversation history
                    const masterResult = await generateSpokenResponse(
                        originalCompleteMessage,
                        { 
                            allToolResults,
                            agentCount: allToolResults.length,
                            queryType: allToolResults.length > 1 ? 'multi-intent' : 'single-intent',
                            conversationHistory: history,
                            currentContext: this.conversationState
                        },
                        'master_narrator_consolidation',
                        effectiveRestaurantId
                    );
                    
                    masterResponse = masterResult.response;
                    isConsolidated = true;
                    console.log('✅ MASTER NARRATOR: Successfully synthesized response');
                    
                } catch (narratorError) {
                    console.error('❌ MASTER NARRATOR: Error during synthesis:', narratorError);
                    // Fallback: use the old consolidation approach
                    const { consolidateFinalResponse } = await import('../AIService.js');
                    const fallbackResult = await consolidateFinalResponse(
                        originalCompleteMessage,
                        allToolResults,
                        effectiveRestaurantId
                    );
                    masterResponse = fallbackResult.response;
                    isConsolidated = fallbackResult.consolidated;
                }
            } else {
                console.log('🎭 MASTER NARRATOR: No tool results to synthesize');
                masterResponse = "I apologize, but I wasn't able to gather the information you requested. Please try again.";
                isConsolidated = false;
            }

            // Return comprehensive response with orchestration metadata
            return {
                response: masterResponse,
                type: responseType,
                ...additionalData,
                orchestrator: {
                    architecture: 'hybrid-agency-v2',
                    delegationChain: this.conversationState.delegationChain,
                    totalAgentsInvolved: this.conversationState.delegationChain.length,
                    finalAgent: this.conversationState.delegationChain[this.conversationState.delegationChain.length - 1]?.agent,
                    globalContext: this.conversationState.globalContext,
                    isConsolidated: isConsolidated,
                    toolResultsCount: allToolResults.length,
                    timestamp: new Date().toISOString()
                }
            };
            
        } catch (error) {
            console.error('❌ Agent Orchestrator dispatch error:', error);
            return {
                response: "I apologize, but I'm having trouble processing your request right now. Please try again.",
                type: 'message',
                orchestrator: {
                    error: error.message,
                    architecture: 'hybrid-agency'
                }
            };
        }
    }

    /**
     * AI-FIRST AGENT DETERMINATION
     * 
     * Uses AI to intelligently determine which specialized agent should handle
     * the user's request based on the message content and conversation context.
     */
    /**
     * DECOMPOSITION MODEL: Create Multi-Step Execution Plan
     * 
     * This function acts as a "Project Manager AI" that decomposes complex
     * multi-intent queries into a sequence of steps, each handled by a
     * specialized agent with a focused sub-task.
     */
    async determineExecutionPlan(message, history = [], restaurantId = null) {
        try {
            console.log('🎯 PROJECT MANAGER: Decomposing multi-intent query:', message);
            
            // Build the decomposition prompt
            const decompositionPrompt = this.buildDecompositionPrompt(message, history, restaurantId);
            
            // Call Gemini for multi-step planning
            const response = await fetch(
                'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-goog-api-key': GEMINI_API_KEY
                    },
                    body: JSON.stringify({
                        contents: [
                            { role: "user", parts: [{ text: decompositionPrompt }] }
                        ]
                    })
                }
            );
            
            const data = await response.json();
            const candidate = data?.candidates?.[0];
            
            if (!candidate?.content?.parts?.[0]?.text) {
                console.error('❌ Invalid response from Gemini for execution planning:', data);
                return this.getFallbackPlan(message);
            }
            
            const aiResponse = candidate.content.parts[0].text.trim();
            console.log('🤖 Decomposition Response:', aiResponse);
            
            // Parse the JSON array response
            try {
                const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
                if (!jsonMatch) {
                    console.error('❌ No JSON array found in decomposition response:', aiResponse);
                    return this.getFallbackPlan(message);
                }
                
                const executionPlan = JSON.parse(jsonMatch[0]);
                
                // Validate the execution plan format
                if (!Array.isArray(executionPlan) || executionPlan.length === 0) {
                    console.error('❌ Invalid execution plan format:', executionPlan);
                    return this.getFallbackPlan(message);
                }
                
                // Validate each step
                for (const step of executionPlan) {
                    if (!step.step || !step.agent_to_use || !step.sub_task_query) {
                        console.error('❌ Invalid step format:', step);
                        return this.getFallbackPlan(message);
                    }
                    
                    // Validate that the agent exists
                    if (!this.agents[step.agent_to_use]) {
                        console.error('❌ Unknown agent in plan:', step.agent_to_use);
                        return this.getFallbackPlan(message);
                    }
                }
                
                console.log('✅ PROJECT MANAGER: Created execution plan with', executionPlan.length, 'steps');
                console.log('📋 Execution Plan:', executionPlan.map(s => `${s.step}. ${s.agent_to_use}: ${s.sub_task_query}`).join('\n'));
                
                return executionPlan;
                
            } catch (parseError) {
                console.error('❌ Error parsing execution plan:', parseError);
                return this.getFallbackPlan(message);
            }
            
        } catch (error) {
            console.error('❌ Error in execution planning:', error);
            return this.getFallbackPlan(message);
        }
    }

    /**
     * EXECUTE SPECIALIZED AGENT
     * 
     * Calls the appropriate specialized agent and lets it handle the task
     * using its own "Think -> Act -> Speak" implementation.
     */
    async executeAgent(agentName, message, history, restaurantId, globalContext = {}) {
        try {
            console.log(`🤖 Executing specialized agent: ${agentName}`);
            
            const agent = this.agents[agentName];
            if (!agent) {
                console.error(`❌ Unknown agent: ${agentName}`);
                return {
                    response: "I apologize, but I encountered an internal error while processing your request.",
                    type: 'message',
                    isTaskComplete: true
                };
            }
            
            // Execute the agent with global context
            const result = await agent.processMessage(
                message, 
                history, 
                restaurantId, 
                { 
                    globalContext,
                    orchestratorState: this.conversationState 
                }
            );
            
            return result;
            
        } catch (error) {
            console.error(`❌ Error executing agent ${agentName}:`, error);
            return {
                response: "I apologize, but I encountered an error while processing your request. Please try again.",
                type: 'message',
                isTaskComplete: true,
                error: error.message
            };
        }
    }

    /**
     * Build the AI prompt for agent selection
     */
    /**
     * Build the PROJECT MANAGER decomposition prompt
     */
    buildDecompositionPrompt(message, history, restaurantId) {
        const recentHistory = history.slice(-3).map(h => `${h.sender}: ${h.text}`).join('\n');
        
        return `You are a project manager AI. Your job is to decompose a user's request into a sequence of steps, where each step is handled by a specialized agent (department).

AVAILABLE AGENTS (DEPARTMENTS):
- TableAvailabilityAgent: Handles table availability, booking dates/times, capacity questions, table types
- MenuPricingAgent: Handles menu items, food questions, dietary requirements, pricing queries  
- CelebrationAgent: Handles special occasions, celebrations, birthday packages, anniversary setups
- RestaurantInfoAgent: Handles restaurant information, hours, location, contact details, owner info, general atmosphere
- ReservationAgent: Handles final reservation creation when all details are collected
- SupportContactAgent: Handles complaints, support issues, or requests outside restaurant scope

RECENT CONVERSATION HISTORY:
${recentHistory || 'None'}

USER'S REQUEST: "${message}"

DECOMPOSITION RULES:
1. Analyze the user's request and identify ALL distinct intents/tasks
2. For each intent, determine which specialized agent should handle it
3. Create a focused sub_task_query for each agent that contains ONLY their part
4. Order the steps logically (e.g., availability before reservation, info before menu)
5. Do NOT create redundant steps - each agent should only appear once per query
6. If the query has only one intent, create a single-step plan

EXAMPLES:

Input: "What time do you close on Saturdays, and are your lamb chops gluten-free?"
Output: [
  { "step": 1, "agent_to_use": "RestaurantInfoAgent", "sub_task_query": "What time do you close on Saturdays?" },
  { "step": 2, "agent_to_use": "MenuPricingAgent", "sub_task_query": "Are your lamb chops gluten-free?" }
]

Input: "What's the general atmosphere like, and do you have vegetarian appetizers?"
Output: [
  { "step": 1, "agent_to_use": "RestaurantInfoAgent", "sub_task_query": "What's the general atmosphere like at your restaurant?" },
  { "step": 2, "agent_to_use": "MenuPricingAgent", "sub_task_query": "Do you have good vegetarian appetizers?" }
]

Input: "Check availability for tomorrow at 8pm for 4 people"
Output: [
  { "step": 1, "agent_to_use": "TableAvailabilityAgent", "sub_task_query": "Check availability for tomorrow at 8pm for 4 people" }
]

Based on the user's request, create a step-by-step execution plan. For each step, specify the agent_to_use and the exact sub_task_query for that agent.

Respond with ONLY a JSON array in this exact format:
[
  { "step": 1, "agent_to_use": "AgentName", "sub_task_query": "Query for this agent" },
  { "step": 2, "agent_to_use": "AgentName", "sub_task_query": "Query for this agent" }
]`;
    }

    /**
     * Fallback execution plan when decomposition fails
     */
    getFallbackPlan(message) {
        console.log('⚠️ Using fallback plan for:', message);
        
        // Simple heuristic-based fallback
        if (message.toLowerCase().includes('menu') || message.toLowerCase().includes('food') || 
            message.toLowerCase().includes('dish') || message.toLowerCase().includes('eat')) {
            return [
                { step: 1, agent_to_use: 'MenuPricingAgent', sub_task_query: message }
            ];
        }
        
        if (message.toLowerCase().includes('hour') || message.toLowerCase().includes('time') || 
            message.toLowerCase().includes('open') || message.toLowerCase().includes('close')) {
            return [
                { step: 1, agent_to_use: 'RestaurantInfoAgent', sub_task_query: message }
            ];
        }
        
        if (message.toLowerCase().includes('available') || message.toLowerCase().includes('book') || 
            message.toLowerCase().includes('reserve') || message.toLowerCase().includes('table')) {
            return [
                { step: 1, agent_to_use: 'TableAvailabilityAgent', sub_task_query: message }
            ];
        }
        
        if (message.toLowerCase().includes('celebration') || message.toLowerCase().includes('birthday') || 
            message.toLowerCase().includes('anniversary') || message.toLowerCase().includes('special')) {
            return [
                { step: 1, agent_to_use: 'CelebrationAgent', sub_task_query: message }
            ];
        }
        
        // Default fallback to support agent
        return [
            { step: 1, agent_to_use: 'SupportContactAgent', sub_task_query: message }
        ];
    }

    /**
     * Detect if the response contains a direct question requiring user input
     */
    detectsDirectQuestion(responseText) {
        if (!responseText || typeof responseText !== 'string') return false;
        
        const lowerResponse = responseText.toLowerCase();
        
        // Question patterns that indicate waiting for user selection/input
        const questionPatterns = [
            // Table selection questions
            /which\s+(table\s+)?type\s+would\s+you\s+(prefer|like)/i,
            /which\s+(option|choice)\s+would\s+you\s+(prefer|like|choose)/i,
            /please\s+(choose|select)\s+(from|one)/i,
            
            // General choice questions  
            /would\s+you\s+(prefer|like)\s*\?/i,
            /which\s+would\s+you\s+(prefer|like|choose)\s*\?/i,
            /what\s+would\s+you\s+(prefer|like|choose)\s*\?/i,
            
            // Information gathering questions
            /could\s+you\s+(please\s+)?provide/i,
            /i\s+(will\s+)?need\s+your/i,
            /please\s+(provide|give\s+me)/i
        ];
        
        // Check for question patterns
        for (const pattern of questionPatterns) {
            if (pattern.test(responseText)) {
                return true;
            }
        }
        
        // Check for question marks with specific keywords
        if (responseText.includes('?')) {
            const questionKeywords = [
                'which', 'what', 'would you', 'could you', 'prefer', 'like', 'choose', 'select'
            ];
            
            for (const keyword of questionKeywords) {
                if (lowerResponse.includes(keyword)) {
                    return true;
                }
            }
        }
        
        return false;
    }

    /**
     * Get current orchestrator state for debugging
     */
    getConversationState() {
        return {
            ...this.conversationState,
            availableAgents: Object.keys(this.agents)
        };
    }

    /**
     * Reset orchestrator state
     */
    resetConversationState() {
        this.conversationState = {
            activeAgent: null,
            delegationChain: [],
            globalContext: {},
            remainingQuery: null,
            activeFlow: null,
            flowState: {},
            isAwaitingResponse: false, // Legacy flag (kept for compatibility)
            // NEW STATE PROPERTIES:
            isAwaitingUserResponse: false,
            nextAgent: null
        };
    }
}

export default AgentOrchestrator;