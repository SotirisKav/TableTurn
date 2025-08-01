/**
 * Celebration Agent - Hybrid "Agency" Architecture
 * 
 * UPGRADED IMPLEMENTATION: This agent now implements the "Think -> Act -> Speak" pattern
 * using specialized celebration tools. It handles special occasions, birthdays, anniversaries,
 * and romantic setups while maintaining perfect accuracy in its domain.
 */

import BaseAgent from './BaseAgent.js';
import { getAiPlan, generateSpokenResponse } from '../AIService.js';
import { validateToolParameters } from '../ToolService.js';

class CelebrationAgent extends BaseAgent {
    constructor() {
        super(
            'CelebrationAgent',
            'Celebration & Special Occasions Specialist',
            ['celebration', 'birthday', 'anniversary', 'romantic', 'special', 'occasion', 'party']
        );
        
        // Define specialized tools for this agent
        this.allowedTools = ['get_celebration_packages', 'clarify_and_respond'];
    }

    /**
     * HYBRID ARCHITECTURE: Think -> Act -> Speak Loop
     */
    async processMessage(message, history = [], restaurantId = null, context = {}) {
        try {
            console.log(`🎉 ${this.name} processing with Think->Act->Speak:`, message);
            
            const effectiveRestaurantId = restaurantId || 1;
            
            // ANALYZE QUERY SCOPE: Detect if message contains non-celebration queries
            const queryAnalysis = this.analyzeQueryScope(message);
            console.log('📋 Query analysis:', queryAnalysis);
            
            // STEP 1: THINK - AI selects the best tool for the celebration part
            console.log('🧠 STEP 1: THINK - Getting AI plan for celebration query...');
            const toolPlan = await this.getContextAwarePlan(
                message,
                queryAnalysis.celebrationQuery, 
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
                    message: 'I specialize in celebrations and special occasions. Let me help you with that first.'
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
                agent: this.name
            };
        }
    }

    /**
     * PHASE 2: Context-Aware and Focused Planning for Celebration Specialist
     */
    async getContextAwarePlan(originalMessage, specificTask, history, globalContext, restaurantId) {
        try {
            console.log('🧠 Context-aware planning for CelebrationAgent...');
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
                        message: 'I specialize in celebrations and special occasions. Let me help you with that first.'
                    }
                };
            }
            
            return toolPlan;
            
        } catch (error) {
            console.error('❌ Error in context-aware planning:', error);
            return {
                tool_to_call: 'clarify_and_respond',
                parameters: {
                    message: 'I need more information to help you with celebration packages.'
                }
            };
        }
    }

    /**
     * Build the focused thinking prompt for celebration specialist
     */
    buildFocusedThinkingPrompt(originalMessage, specificTask, history, globalContext) {
        const contextSummary = this.summarizeGlobalContext(globalContext);
        const recentHistory = history.slice(-3).map(h => `${h.sender}: ${h.text}`).join('\n');
        
        return `You are a celebration specialist agent. Your job is to analyze the user's request and choose the best tool from your limited tool belt.

GLOBAL CONTEXT (What other agents have already done):
${contextSummary}

USER'S FULL ORIGINAL REQUEST: "${originalMessage}"

YOUR SPECIFIC TASK: "${specificTask}"

YOUR ALLOWED TOOLS: ${JSON.stringify(this.allowedTools)}

RECENT CONVERSATION HISTORY:
${recentHistory || 'None'}

INSTRUCTIONS:
1. Analyze YOUR SPECIFIC TASK in the context of the user's full request and the global context
2. Choose the single best tool from YOUR ALLOWED TOOLS to accomplish your specific task
3. Do NOT attempt to handle parts of the query that are outside your scope (like availability or menu items)
4. If other agents have already handled related parts, focus on what's missing for celebration information
5. Use get_celebration_packages for any request involving celebrations, special occasions, birthdays, anniversaries, or romantic setups
6. Use clarify_and_respond only if you need more information for celebration planning
7. CRITICAL: When using get_celebration_packages, the occasion_tags parameter MUST always be an array of strings, even if only one tag is found. For a user query of 'for an anniversary', the correct output is "parameters": { "occasion_tags": ["anniversary"] }, not "parameters": { "occasion_tags": "anniversary" }.

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
                case 'get_celebration_packages':
                    return await this.executeGetCelebrationPackages(parameters, restaurantId);
                    
                case 'clarify_and_respond':
                    return await this.executeClarifyAndRespond(parameters);
                    
                default:
                    console.error('❌ Unknown tool for CelebrationAgent:', toolName);
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
     * Execute get_celebration_packages tool - Core functionality
     */
    async executeGetCelebrationPackages(params, restaurantId) {
        try {
            console.log('🎉 Getting celebration packages:', params);
            
            // For now, return mock celebration data
            // This can be enhanced with a real database table later
            const celebrationData = {
                packages: [
                    {
                        name: "Romantic Anniversary",
                        description: "Special table decoration with candles, rose petals, and champagne",
                        price: 50,
                        includes: ["Table decoration", "Complimentary champagne", "Special dessert"]
                    },
                    {
                        name: "Birthday Celebration",
                        description: "Birthday setup with cake and decorations",
                        price: 35,
                        includes: ["Birthday cake", "Table decorations", "Special song"]
                    },
                    {
                        name: "Proposal Setup",
                        description: "Perfect romantic setting for marriage proposals",
                        price: 75,
                        includes: ["Premium table setup", "Rose petals", "Photographer coordination", "Champagne"]
                    }
                ],
                addOns: [
                    { name: "Flower bouquet", price: 25 },
                    { name: "Special cake", price: 30 },
                    { name: "Musician serenade", price: 100 }
                ]
            };
            
            // Filter by occasion tags if provided
            let filteredPackages = celebrationData.packages;
            if (params.occasion_tags && params.occasion_tags.length > 0) {
                filteredPackages = celebrationData.packages.filter(pkg => 
                    params.occasion_tags.some(tag => 
                        pkg.name.toLowerCase().includes(tag.toLowerCase()) ||
                        pkg.description.toLowerCase().includes(tag.toLowerCase())
                    )
                );
            }
            
            return {
                success: true,
                packages: filteredPackages,
                addOns: celebrationData.addOns,
                occasionTags: params.occasion_tags || [],
                budgetRange: params.budget_range || 'standard'
            };
            
        } catch (error) {
            console.error('❌ Error getting celebration packages:', error);
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
     * ANALYZE QUERY SCOPE: Detect celebration vs non-celebration queries
     */
    analyzeQueryScope(message) {
        const lowerMessage = message.toLowerCase();
        
        // Keywords that indicate non-celebration queries
        const availabilityKeywords = ['table', 'book', 'reserve', 'available', 'date', 'time'];
        const menuKeywords = ['menu', 'food', 'dish', 'wine', 'drink', 'eat'];
        const infoKeywords = ['hours', 'address', 'location', 'contact', 'phone', 'email'];
        
        // Extract the celebration-focused part of the query
        let celebrationQuery = message;
        let nonCelebrationParts = [];
        
        // Detect non-celebration parts (simplified for now)
        if (availabilityKeywords.some(keyword => lowerMessage.includes(keyword))) {
            nonCelebrationParts.push({
                type: 'availability',
                query: message, // simplified
                suggestedAgent: 'TableAvailabilityAgent'
            });
        }
        
        if (menuKeywords.some(keyword => lowerMessage.includes(keyword))) {
            nonCelebrationParts.push({
                type: 'menu',
                query: message, // simplified
                suggestedAgent: 'MenuPricingAgent'
            });
        }
        
        return {
            hasMultipleParts: nonCelebrationParts.length > 0,
            celebrationQuery: celebrationQuery || message,
            nonCelebrationParts,
            originalMessage: message
        };
    }

    /**
     * ANALYZE TASK COMPLETION: Determine if handoff is needed
     */
    analyzeTaskCompletion(originalMessage, queryAnalysis, toolResult) {
        // If there are non-celebration parts, task is incomplete
        if (queryAnalysis.hasMultipleParts && queryAnalysis.nonCelebrationParts.length > 0) {
            const nextPart = queryAnalysis.nonCelebrationParts[0];
            
            return {
                isComplete: false,
                suggestedAgent: nextPart.suggestedAgent,
                remainingQuery: queryAnalysis.nonCelebrationParts.map(part => part.query).join('. ')
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

export default CelebrationAgent;