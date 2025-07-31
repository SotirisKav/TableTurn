/**
 * Restaurant Info Agent - Hybrid "Agency" Architecture
 * 
 * UPGRADED IMPLEMENTATION: This agent now implements the "Think -> Act -> Speak" pattern
 * using specialized restaurant information tools. It handles restaurant details, hours, 
 * location, contact info while maintaining perfect accuracy in its domain.
 */

import BaseAgent from './BaseAgent.js';
import { getAiPlan, generateSpokenResponse } from '../AIService.js';
import { validateToolParameters } from '../ToolService.js';
import RestaurantService from '../RestaurantService.js';

class RestaurantInfoAgent extends BaseAgent {
    constructor() {
        super(
            'RestaurantInfoAgent',
            'Restaurant Information Specialist',
            ['info', 'hours', 'address', 'location', 'contact', 'phone', 'email', 'about']
        );
        
        // Define specialized tools for this agent
        this.allowedTools = ['get_restaurant_info', 'clarify_and_respond'];
    }

    /**
     * HYBRID ARCHITECTURE: Think -> Act -> Speak Loop
     */
    async processMessage(message, history = [], restaurantId = null, context = {}) {
        try {
            console.log(`🏪 ${this.name} processing with Think->Act->Speak:`, message);
            
            const effectiveRestaurantId = restaurantId || 1;
            
            // ANALYZE QUERY SCOPE: Detect if message contains non-info queries
            const queryAnalysis = this.analyzeQueryScope(message);
            console.log('📋 Query analysis:', queryAnalysis);
            
            // STEP 1: THINK - AI selects the best tool for the info part
            console.log('🧠 STEP 1: THINK - Getting AI plan for info query...');
            const toolPlan = await this.getContextAwarePlan(
                message,
                queryAnalysis.infoQuery, 
                history, 
                context.globalContext || {},
                effectiveRestaurantId
            );
            
            console.log('🎯 AI selected tool:', toolPlan.tool_to_call, 'with parameters:', toolPlan.parameters);
            
            // Validate that the selected tool is allowed for this agent
            if (!this.allowedTools.includes(toolPlan.tool_to_call)) {
                console.warn(`⚠️ AI selected disallowed tool ${toolPlan.tool_to_call}, falling back to clarify_and_respond`);
                toolPlan.tool_to_call = 'clarify_and_respond';
                toolPlan.parameters = {
                    message: 'I specialize in restaurant information. Let me help you with that first.'
                };
            }
            
            // STEP 2: ACT - Execute the selected tool
            console.log('⚡ STEP 2: ACT - Executing tool...');
            const toolResult = await this.executeTool(toolPlan.tool_to_call, toolPlan.parameters, effectiveRestaurantId);
            
            console.log('📊 Tool result:', toolResult);
            
            // REMOVED: STEP 3: SPEAK - Agent now returns data only, no response generation
            console.log('📊 Silent Data Collection: Returning tool result only...');
            
            // DETERMINE TASK COMPLETION AND HANDOFF
            const taskCompletionAnalysis = this.analyzeTaskCompletion(message, queryAnalysis, toolResult);
            
            // Build silent data collector response object (NO response text)
            const agentResponse = {
                toolResult: toolResult, // The raw, factual data from the "Act" step
                isTaskComplete: taskCompletionAnalysis.isComplete,
                agent: this.name,
                timestamp: new Date().toISOString()
            };
            
            // Add handoff information if task is incomplete
            if (!taskCompletionAnalysis.isComplete) {
                agentResponse.handoffSuggestion = taskCompletionAnalysis.suggestedAgent;
                agentResponse.unansweredQuery = taskCompletionAnalysis.remainingQuery;
                
                console.log('🔀 Task incomplete, suggesting handoff to:', taskCompletionAnalysis.suggestedAgent);
                console.log('🔀 Remaining query:', taskCompletionAnalysis.remainingQuery);
            }
            
            return agentResponse;
            
        } catch (error) {
            console.error(`❌ ${this.name} error:`, error);
            return {
                toolResult: {
                    success: false,
                    error: error.message
                },
                isTaskComplete: true,
                error: error.message,
                agent: this.name
            };
        }
    }

    /**
     * PHASE 2: Context-Aware and Focused Planning for Restaurant Info Specialist
     */
    async getContextAwarePlan(originalMessage, specificTask, history, globalContext, restaurantId) {
        try {
            console.log('🧠 Context-aware planning for RestaurantInfoAgent...');
            console.log('🌐 Global context available:', Object.keys(globalContext));
            
            const focusedPrompt = this.buildFocusedThinkingPrompt(
                originalMessage, 
                specificTask, 
                history, 
                globalContext
            );
            
            const { getAiPlan } = await import('../AIService.js');
            const toolPlan = await getAiPlan(
                focusedPrompt,
                [],
                { allowedTools: this.allowedTools },
                restaurantId
            );
            
            if (!this.allowedTools.includes(toolPlan.tool_to_call)) {
                console.warn(`⚠️ AI selected disallowed tool ${toolPlan.tool_to_call}, falling back to clarify_and_respond`);
                return {
                    tool_to_call: 'clarify_and_respond',
                    parameters: {
                        message: 'I specialize in restaurant information. Let me help you with that first.'
                    }
                };
            }
            
            return toolPlan;
            
        } catch (error) {
            console.error('❌ Error in context-aware planning:', error);
            return {
                tool_to_call: 'clarify_and_respond',
                parameters: {
                    message: 'I need more information to help you with restaurant details.'
                }
            };
        }
    }

    /**
     * Build the focused thinking prompt for restaurant info specialist
     */
    buildFocusedThinkingPrompt(originalMessage, specificTask, history, globalContext) {
        const contextSummary = this.summarizeGlobalContext(globalContext);
        const recentHistory = history.slice(-3).map(h => `${h.sender}: ${h.text}`).join('\n');
        
        return `You are a restaurant information specialist agent. Your job is to analyze the user's request and choose the best tool from your limited tool belt.

GLOBAL CONTEXT (What other agents have already done):
${contextSummary}

USER'S FULL ORIGINAL REQUEST: "${originalMessage}"

YOUR SPECIFIC TASK: "${specificTask}"

YOUR ALLOWED TOOLS: ${JSON.stringify(this.allowedTools)}

RECENT CONVERSATION HISTORY:
${recentHistory || 'None'}

CRITICAL PARAMETER SELECTION RULES for get_restaurant_info:
- If asking about OWNER info, contact details, phone, email → use topic: "general" (owner info is only available in general)
- If asking about HOURS, opening times, when open/closed → use topic: "hours" 
- If asking about LOCATION, address, where is it → use topic: "address"
- If asking about DESCRIPTION, what kind of restaurant → use topic: "description"
- If asking multiple things or unclear → use topic: "general"

EXAMPLES OF PRECISE PARAMETER SELECTION:
- "owner info?" → get_restaurant_info with topic: "general" (owner data only in general)
- "what time do you open?" → get_restaurant_info with topic: "hours"
- "where are you located?" → get_restaurant_info with topic: "address"
- "tell me about the restaurant" → get_restaurant_info with topic: "description"

INSTRUCTIONS:
1. Analyze YOUR SPECIFIC TASK and map it to the MOST PRECISE topic parameter
2. Do NOT use topic: "general" unless specifically asking about owner/contact info or multiple things
3. Be surgical - choose the most targeted topic that will get exactly what the user wants
4. If other agents have already handled related parts, focus on what's missing for restaurant information

Respond ONLY with a JSON object: { "tool_to_call": "...", "parameters": {...} }`;
    }

    /**
     * Summarize what other agents have already accomplished
     */
    summarizeGlobalContext(globalContext) {
        if (!globalContext || Object.keys(globalContext).length === 0) {
            return 'No other agents have processed this request yet.';
        }
        
        const summaries = [];
        for (const [agent, result] of Object.entries(globalContext)) {
            if (result && result.success) {
                if (result.available !== undefined) {
                    summaries.push(`${agent}: Checked availability - ${result.available ? 'tables available' : 'no availability'}`);
                } else if (result.items && result.items.length > 0) {
                    summaries.push(`${agent}: Found ${result.items.length} menu items`);
                } else if (result.packages && result.packages.length > 0) {
                    summaries.push(`${agent}: Found ${result.packages.length} celebration packages`);
                } else if (result.restaurant) {
                    summaries.push(`${agent}: Retrieved restaurant information`);
                } else {
                    summaries.push(`${agent}: Completed successfully`);
                }
            } else {
                summaries.push(`${agent}: ${result?.error || 'Task failed'}`);
            }
        }
        
        return summaries.length > 0 ? summaries.join('\n') : 'No other agents have processed this request yet.';
    }

    /**
     * EXECUTE TOOL: Direct tool execution within this agent's domain
     */
    async executeTool(toolName, parameters, restaurantId) {
        try {
            // Validate parameters
            const validation = validateToolParameters(toolName, parameters);
            if (!validation.success) {
                console.error('❌ Tool parameter validation failed:', validation.errors);
                return {
                    success: false,
                    error: `Invalid parameters: ${validation.errors.join(', ')}`
                };
            }
            
            console.log(`🔧 Executing tool: ${toolName} with params:`, parameters);
            
            switch (toolName) {
                case 'get_restaurant_info':
                    return await this.executeGetRestaurantInfo(parameters, restaurantId);
                    
                case 'clarify_and_respond':
                    return await this.executeClarifyAndRespond(parameters);
                    
                default:
                    console.error('❌ Unknown tool for RestaurantInfoAgent:', toolName);
                    return {
                        success: false,
                        error: `Unknown tool: ${toolName}`
                    };
            }
            
        } catch (error) {
            console.error(`❌ Error executing tool ${toolName}:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Execute get_restaurant_info tool - Core functionality
     */
    async executeGetRestaurantInfo(params, restaurantId) {
        try {
            console.log('🏪 Getting restaurant info:', params);
            
            const restaurant = await RestaurantService.getRestaurantById(restaurantId);
            if (!restaurant) {
                return {
                    success: false,
                    error: 'Restaurant not found'
                };
            }
            
            const result = { success: true, restaurant };
            
            // Add specific information based on topic
            switch (params.topic) {
                case 'hours':
                    result.hours = await RestaurantService.getRestaurantHours(restaurantId);
                    break;
                case 'address':
                    result.address = {
                        full: restaurant.address,
                        area: restaurant.area,
                        location: restaurant.location
                    };
                    break;
                case 'description':
                    result.description = restaurant.description;
                    result.cuisine = restaurant.cuisine;
                    break;
                case 'general':
                default:
                    result.hours = await RestaurantService.getRestaurantHours(restaurantId);
                    result.address = {
                        full: restaurant.address,
                        area: restaurant.area,
                        location: restaurant.location
                    };
                    result.description = restaurant.description;
                    result.cuisine = restaurant.cuisine;
                    break;
            }
            
            return result;
            
        } catch (error) {
            console.error('❌ Error getting restaurant info:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Execute clarify_and_respond tool
     */
    async executeClarifyAndRespond(params) {
        try {
            console.log('❓ Clarifying and responding:', params);
            
            return {
                success: true,
                message: params.message,
                responseType: params.response_type || 'clarification'
            };
            
        } catch (error) {
            console.error('❌ Error in clarify and respond:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * ANALYZE QUERY SCOPE: Detect info vs non-info queries
     */
    analyzeQueryScope(message) {
        const lowerMessage = message.toLowerCase();
        
        // Keywords that indicate non-info queries
        const availabilityKeywords = ['table', 'book', 'reserve', 'available', 'date', 'time'];
        const menuKeywords = ['menu', 'food', 'dish', 'wine', 'drink', 'eat'];
        const celebrationKeywords = ['birthday', 'anniversary', 'celebration', 'special occasion'];
        
        // Extract the info-focused part of the query
        let infoQuery = message;
        let nonInfoParts = [];
        
        // Detect non-info parts (simplified for now)
        if (availabilityKeywords.some(keyword => lowerMessage.includes(keyword))) {
            nonInfoParts.push({
                type: 'availability',
                query: message, // simplified
                suggestedAgent: 'TableAvailabilityAgent'
            });
        }
        
        if (menuKeywords.some(keyword => lowerMessage.includes(keyword))) {
            nonInfoParts.push({
                type: 'menu',
                query: message, // simplified
                suggestedAgent: 'MenuPricingAgent'
            });
        }
        
        if (celebrationKeywords.some(keyword => lowerMessage.includes(keyword))) {
            nonInfoParts.push({
                type: 'celebration',
                query: message, // simplified
                suggestedAgent: 'CelebrationAgent'
            });
        }
        
        return {
            hasMultipleParts: nonInfoParts.length > 0,
            infoQuery: infoQuery || message,
            nonInfoParts,
            originalMessage: message
        };
    }

    /**
     * ANALYZE TASK COMPLETION: Determine if handoff is needed
     */
    analyzeTaskCompletion(originalMessage, queryAnalysis, toolResult) {
        // If there are non-info parts, task is incomplete
        if (queryAnalysis.hasMultipleParts && queryAnalysis.nonInfoParts.length > 0) {
            const nextPart = queryAnalysis.nonInfoParts[0];
            
            return {
                isComplete: false,
                suggestedAgent: nextPart.suggestedAgent,
                remainingQuery: queryAnalysis.nonInfoParts.map(part => part.query).join('. ')
            };
        }
        
        // Default: task is complete
        return {
            isComplete: true,
            suggestedAgent: null,
            remainingQuery: null
        };
    }
}

export default RestaurantInfoAgent;