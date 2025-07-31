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
        
        // SESSION-LEVEL STATE MANAGEMENT: Store multiple conversation states by sessionId
        this.sessionStates = new Map();
        
        console.log('🎭 AgentOrchestrator initialized with session-level state management');
        console.log('🎭 Available agents:', Object.keys(this.agents).length);
    }
    /**
     * SESSION-LEVEL STATE MANAGEMENT METHODS
     */
    
    /**
     * Get or create conversation state for a session
     */
    getSessionState(sessionId) {
        if (!sessionId) {
            sessionId = 'default';
        }
        
        if (!this.sessionStates.has(sessionId)) {
            console.log(`🆕 Creating new session state for: ${sessionId}`);
            this.sessionStates.set(sessionId, this.createNewSessionState());
        }
        
        return this.sessionStates.get(sessionId);
    }
    
    /**
     * Create a new session state structure
     */
    createNewSessionState() {
        return {
            activeAgent: null,
            delegationChain: [],
            globalContext: {},
            remainingQuery: null,
            activeFlow: null,
            flowState: {},
            isAwaitingResponse: false,
            isAwaitingUserResponse: false,
            nextAgent: null,
            // NEW: Interrupted flow storage for resumption
            interruptedFlow: null,
            interruptedAt: null
        };
    }
    
    /**
     * Save session state (for future persistence to database/redis)
     */
    saveSessionState(sessionId, state) {
        if (!sessionId) sessionId = 'default';
        this.sessionStates.set(sessionId, { ...state });
        console.log(`💾 Session state saved for: ${sessionId}`);
    }
    
    /**
     * Detect if user wants to resume a previous conversation
     */
    async detectResumeIntent(message) {
        try {
            const { getAiPlan } = await import('../AIService.js');
            
            const resumePrompt = `Analyze this user message to determine if they want to resume a previous conversation or booking process.

USER MESSAGE: "${message}"

Does this message indicate the user wants to continue, resume, or get back to a previous conversation/booking?

Examples of RESUME intent:
- "let's continue the reservation"
- "back to my booking"
- "continue where we left off"
- "yes let's proceed"
- "resume my reservation"

Examples of NOT resume intent:
- "hello"
- "what's your menu"
- "new reservation"
- "standard table"

Respond with JSON: { "isResume": boolean, "confidence": "high|medium|low" }`;

            const result = await getAiPlan(resumePrompt, [], {}, null);
            return result?.isResume || false;
            
        } catch (error) {
            console.error('❌ Error in resume intent detection:', error);
            return false;
        }
    }

    /**
     * HYBRID ARCHITECTURE: Agent Dispatch and Handoff Management
     * 
     * This is the main entry point that implements the true hybrid approach:
     * 1. Dispatch: AI determines which specialized agent should handle the request
     * 2. Execute: The specialized agent uses its own "Think -> Act -> Speak" loop
     * 3. Handoff: If the agent indicates task incompleteness, route to the next agent
     */
    async processMessage(message, history = [], restaurantId = null, sessionId = null) {
        try {
            console.log('🎭 SESSION-AWARE PROCESSING:', { message, sessionId, restaurantId });
            
            // STEP 1: LOAD SESSION STATE
            const sessionState = this.getSessionState(sessionId);
            const effectiveRestaurantId = restaurantId || 1;
            let originalCompleteMessage = message;
            let allToolResults = [];
            let executionPlan;
            let responseType = 'message';
            let additionalData = {};
            
            // STEP 2: RESUME INTENT DETECTION
            const isResumeIntent = await this.detectResumeIntent(message);
            if (isResumeIntent && sessionState.interruptedFlow) {
                console.log('🔄 RESUME DETECTED: Restoring interrupted booking flow');
                console.log('📋 Interrupted flow data:', sessionState.interruptedFlow);
                
                // Restore the interrupted flow as active flow
                sessionState.flowState = { ...sessionState.interruptedFlow };
                sessionState.activeFlow = 'booking';
                sessionState.isAwaitingUserResponse = true;
                sessionState.nextAgent = 'ReservationAgent';
                sessionState.interruptedFlow = null; // Clear interrupted flow
                
                // Create execution plan to continue with ReservationAgent
                executionPlan = [{
                    step: 1,
                    agent_to_use: 'ReservationAgent',
                    sub_task_query: 'Continue with the booking process'
                }];
                
                // Pass the restored context
                sessionState.globalContext.bookingContext = sessionState.flowState;
                console.log('✅ RESUMED: Full booking context restored');
                
            } else {
                // STEP 3: NORMAL FLOW PROCESSING
                
                // Only reset delegation chain if not awaiting a user response
                if (!sessionState.isAwaitingUserResponse) {
                    console.log('🔄 New conversation turn - resetting delegation chain');
                    sessionState.delegationChain = [];
                }
            
                            // CRITICAL STATE-AWARE ROUTING: Check if we're awaiting a user response
                if (sessionState.isAwaitingUserResponse && sessionState.nextAgent) {
                    
                    // --- THE CRITICAL INTERRUPTION CHECK ---
                    const { isInterruption } = await import('../AIService.js');
                    const isUserInterruption = await isInterruption(message);
                    
                    if (isUserInterruption) {
                        console.log("⚠️ INTERRUPTION DETECTED: User changed topic. Preserving flow state.");
                        
                        // CRITICAL: Store interrupted flow for later resumption
                        if (sessionState.flowState && Object.keys(sessionState.flowState).length > 0) {
                            sessionState.interruptedFlow = { ...sessionState.flowState };
                            sessionState.interruptedAt = new Date().toISOString();
                            console.log('💾 STORED interrupted flow for resumption:', sessionState.interruptedFlow);
                        }
                        
                        // Reset awaiting state but preserve interrupted flow
                        sessionState.isAwaitingUserResponse = false;
                        sessionState.nextAgent = null;
                        sessionState.activeFlow = null;
                        sessionState.flowState = {};
                        
                        executionPlan = await this.determineExecutionPlan(message, history);
                    } else {
                        console.log(`🔍 CONTINUATION DETECTED: Routing to waiting agent: ${sessionState.nextAgent}`);
                        
                        // Create direct plan for continuation
                        executionPlan = [{ 
                            step: 1, 
                            agent_to_use: sessionState.nextAgent, 
                            sub_task_query: message 
                        }];
                        
                        // Pass flowState as bookingContext
                        sessionState.globalContext.bookingContext = sessionState.flowState;
                        console.log('🔄 HANDOFF: Passing flowState as bookingContext:', sessionState.flowState);
                        
                        // Reset awaiting state
                        sessionState.isAwaitingUserResponse = false;
                        sessionState.nextAgent = null;
                    }
                    
                } else {
                    console.log("🔍 State check FAILED. Using DECOMPOSITION MODEL...");
                    executionPlan = await this.determineExecutionPlan(message, history);
                }
            } // End of normal flow processing
            
                        // MAIN EXECUTION LOOP: Execute the determined plan
            if (executionPlan && executionPlan.length > 0) {
                console.log('📋 PROJECT MANAGER: Execution plan created with', executionPlan.length, 'steps');
                
                for (const step of executionPlan) {
                    console.log(`🔄 Executing Step ${step.step}: ${step.agent_to_use} - "${step.sub_task_query}"`);
                    
                    const stepResult = await this.executeAgent(
                        step.agent_to_use, 
                        step.sub_task_query, 
                        history, 
                        effectiveRestaurantId,
                        sessionState.globalContext
                    );
                    
                    console.log(`📊 Step ${step.step} result:`, stepResult);
                    
                    // Store tool result for Master Narrator consolidation
                    if (stepResult.toolResult) {
                        allToolResults.push({
                            agent: step.agent_to_use,
                            tool: stepResult.toolName || 'unknown_tool',
                            data: stepResult.toolResult,
                            timestamp: stepResult.timestamp,
                            step: step.step,
                            query: step.sub_task_query
                        });
                        
                        // Update global context in session state
                        sessionState.globalContext[step.agent_to_use] = stepResult.toolResult;
                        console.log('🌐 Updated session globalContext with', step.agent_to_use, 'result');
                    }
                    
                    // CRITICAL: Check if agent is signaling that it's awaiting user response
                    if (stepResult.contextData) {
                        if (stepResult.contextData.isAwaitingUserResponse) {
                            console.log('🔔 Agent signaled awaiting user response:', stepResult.contextData);
                            sessionState.isAwaitingUserResponse = true;
                            sessionState.nextAgent = stepResult.contextData.nextAgent;
                            sessionState.flowState = { ...sessionState.flowState, ...stepResult.contextData.flowState };
                            if (stepResult.contextData.activeFlow) {
                                sessionState.activeFlow = stepResult.contextData.activeFlow;
                            }
                        }
                    }
                    
                    // Handle special response types (reservations, etc.)
                    if (stepResult.type === 'redirect') {
                        responseType = 'redirect';
                        additionalData = { ...additionalData, ...stepResult };
                    }
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
                            architecture: 'session-aware-hybrid-v3',
                            sessionId: sessionId,
                            delegationChain: sessionState.delegationChain,
                            totalAgentsInvolved: sessionState.delegationChain.length,
                            finalAgent: sessionState.delegationChain[sessionState.delegationChain.length - 1]?.agent,
                            globalContext: sessionState.globalContext,
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
                        // FINAL STEP: SAVE SESSION STATE
            this.saveSessionState(sessionId, sessionState);
            
            // Return comprehensive response with orchestration metadata
            return {
                response: masterResponse,
                type: responseType,
                ...additionalData,
                orchestrator: {
                    architecture: 'session-aware-hybrid-v3',
                    sessionId: sessionId,
                    delegationChain: sessionState.delegationChain,
                    totalAgentsInvolved: sessionState.delegationChain.length,
                    finalAgent: sessionState.delegationChain[sessionState.delegationChain.length - 1]?.agent,
                    globalContext: sessionState.globalContext,
                    isConsolidated: false,
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

    /**
     * Reset only the awaiting state while preserving global context
     */
    resetAwaitingState() {
        this.conversationState.isAwaitingUserResponse = false;
        this.conversationState.nextAgent = null;
        this.conversationState.activeFlow = null;
        this.conversationState.flowState = {};
        console.log('🔄 Awaiting state reset - preserving global context');
    }

    /**
     * Determine if a message should bypass the awaiting state and go to specialized agents
     * even when we're awaiting a user response in a booking flow
     */
    async shouldBypassAwaitingState(message) {
        try {
            // Use AI to intelligently determine if message should bypass awaiting state
            const { getAiPlan } = await import('../AIService.js');
            
            const analysisPrompt = `Analyze this user message to determine if it should bypass the current booking flow and go to a specialized agent instead.

USER MESSAGE: "${message}"

CONTEXT: The system is currently waiting for the user to respond in a booking flow (like selecting a table type or providing contact details).

Determine if this message is:
1. A completely different request (menu questions, restaurant info, celebration planning)
2. A modification to booking details (date/time changes, party size changes) 
3. A continuation of the current booking flow (table selection, contact info)

Respond with JSON:
{
  "shouldBypass": boolean,
  "reason": "explanation",
  "suggestedIntent": "menu|info|celebration|booking_modification|booking_continuation"
}`;

            const result = await getAiPlan(analysisPrompt, [], {}, null);
            
            return result?.shouldBypass || false;
            
        } catch (error) {
            console.error('❌ Error in AI-based bypass analysis, using safe fallback:', error);
            // Safe fallback: only bypass for very obvious non-booking messages
            const lowerMessage = message.toLowerCase();
            return lowerMessage.includes('menu') || lowerMessage.includes('hours') || lowerMessage.includes('address');
        }
    }
}

export default AgentOrchestrator;