/**
 * Support & Contact Agent - Hybrid "Agency" Architecture
 * 
 * UPGRADED IMPLEMENTATION: This agent handles customer support, complaints,
 * and out-of-scope requests using the Think->Act->Speak pattern.
 */

import BaseAgent from './BaseAgent.js';
import { getAiPlan, generateSpokenResponse } from '../AIService.js';
import { validateToolParameters } from '../ToolService.js';

class SupportContactAgent extends BaseAgent {
    constructor() {
        super(
            'SupportContactAgent',
            'Customer Support Specialist',
            ['support', 'help', 'problem', 'issue', 'complaint', 'contact']
        );
        
        // Define specialized tools for this agent
        this.allowedTools = ['clarify_and_respond'];
    }

    /**
     * HYBRID ARCHITECTURE: Think -> Act -> Speak Loop
     */
    async processMessage(message, history = [], restaurantId = null, context = {}) {
        try {
            console.log(`🆘 ${this.name} processing with Think->Act->Speak:`, message);
            
            const effectiveRestaurantId = restaurantId || 1;
            
            // STEP 1: THINK - AI selects the best approach (usually clarify_and_respond)
            console.log('🧠 STEP 1: THINK - Getting AI plan for support query...');
            const toolPlan = await this.getContextAwarePlan(
                message,
                message, // Support agent handles the full message
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
                    message: 'I handle customer support issues. How can I help you today?'
                };
            }
            
            // STEP 2: ACT - Execute the selected tool
            console.log('⚡ STEP 2: ACT - Executing tool...');
            const toolResult = await this.executeTool(toolPlan.tool_to_call, toolPlan.parameters, effectiveRestaurantId);
            
            console.log('📊 Tool result:', toolResult);
            
            // REMOVED: STEP 3: SPEAK - Agent now returns data only, no response generation
            console.log('📊 Silent Data Collection: Returning tool result only...');
            
            // Build silent data collector response object (NO response text)
            const agentResponse = {
                toolResult: toolResult, // The raw, factual data from the "Act" step
                isTaskComplete: true, // Support agent handles edge cases and usually completes them
                agent: this.name,
                timestamp: new Date().toISOString()
            };
            
            return agentResponse;
            
        } catch (error) {
            console.error(`❌ ${this.name} error:`, error);
            return {
                response: "I apologize for the technical difficulties. Please contact the restaurant directly for immediate assistance.",
                type: 'message',
                isTaskComplete: true,
                error: error.message,
                agent: this.name
            };
        }
    }

    /**
     * PHASE 2: Context-Aware and Focused Planning for Support Specialist
     */
    async getContextAwarePlan(originalMessage, specificTask, history, globalContext, restaurantId) {
        try {
            console.log('🧠 Context-aware planning for SupportContactAgent...');
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
                        message: 'I handle customer support issues. How can I help you today?'
                    }
                };
            }
            
            return toolPlan;
            
        } catch (error) {
            console.error('❌ Error in context-aware planning:', error);
            return {
                tool_to_call: 'clarify_and_respond',
                parameters: {
                    message: 'I apologize for any inconvenience. How can I assist you today?'
                }
            };
        }
    }

    /**
     * Build the focused thinking prompt for support specialist
     */
    buildFocusedThinkingPrompt(originalMessage, specificTask, history, globalContext) {
        const contextSummary = this.summarizeGlobalContext(globalContext);
        const recentHistory = history.slice(-3).map(h => `${h.sender}: ${h.text}`).join('\n');
        
        return `You are a customer support specialist agent. Your job is to analyze the user's request and choose the best tool from your limited tool belt.

GLOBAL CONTEXT (What other agents have already done):
${contextSummary}

USER'S FULL ORIGINAL REQUEST: "${originalMessage}"

YOUR SPECIFIC TASK: "${specificTask}"

YOUR ALLOWED TOOLS: ${JSON.stringify(this.allowedTools)}

RECENT CONVERSATION HISTORY:
${recentHistory || 'None'}

INSTRUCTIONS:
1. You only have access to clarify_and_respond - use it for all support situations
2. Analyze the user's request and provide appropriate support response
3. If this is a complaint, acknowledge it professionally 
4. If this is a request outside restaurant scope, politely explain limitations
5. If this is asking for help, provide helpful guidance
6. Choose appropriate response_type: "clarification", "out_of_scope", "general_info", or "greeting"

RESPONSE TYPE GUIDELINES:
- "clarification" - when you need more info from the user
- "out_of_scope" - when request is outside restaurant capabilities  
- "general_info" - when providing helpful general information
- "greeting" - when responding to greetings or general hellos

Respond ONLY with a JSON object: { "tool_to_call": "clarify_and_respond", "parameters": {"response_type": "...", "message": "..."} }`;
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
                case 'clarify_and_respond':
                    return await this.executeClarifyAndRespond(parameters);
                    
                default:
                    console.error('❌ Unknown tool for SupportContactAgent:', toolName);
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
}

export default SupportContactAgent;