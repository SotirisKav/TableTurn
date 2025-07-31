/**
 * Menu & Pricing Agent - Hybrid "Agency" Architecture
 * 
 * UPGRADED IMPLEMENTATION: This agent now implements the "Think -> Act -> Speak" pattern
 * using specialized menu and dietary tools. It can handle complex food queries and hand off 
 * unrelated parts to other agents while maintaining perfect accuracy in its culinary domain.
 */

import BaseAgent from './BaseAgent.js';
import { getAiPlan, generateSpokenResponse } from '../AIService.js';
import { validateToolParameters } from '../ToolService.js';
import RAGService from '../RAGService.js';
import RestaurantService from '../RestaurantService.js';

class MenuPricingAgent extends BaseAgent {
    constructor() {
        super(
            'MenuPricingAgent',
            'Menu & Pricing Specialist',
            ['menu', 'food', 'dish', 'price', 'cost', 'diet', 'cuisine', 'wine', 'drink', 'vegetarian', 'vegan', 'gluten']
        );
        
        // Define specialized tools for this agent
        this.allowedTools = ['get_menu_items', 'clarify_and_respond'];
    }

    /**
     * HYBRID ARCHITECTURE: Think -> Act -> Speak Loop
     * 
     * This agent implements the two-call model within its specialized culinary domain:
     * 1. THINK: AI analyzes the message and selects the best tool from allowedTools
     * 2. ACT: Execute the selected tool with validated parameters
     * 3. SPEAK: AI generates a natural response based on tool results
     * 
     * Additionally, it analyzes if parts of the query are outside its scope
     * and provides handoff information to the orchestrator.
     */
    async processMessage(message, history = [], restaurantId = null, context = {}) {
        try {
            console.log(`🍽️ ${this.name} processing with Think->Act->Speak:`, message);
            
            const effectiveRestaurantId = restaurantId || 1;
            
            // ANALYZE QUERY SCOPE: Detect if message contains non-menu queries
            const queryAnalysis = this.analyzeQueryScope(message);
            console.log('📋 Query analysis:', queryAnalysis);
            
            // STEP 1: THINK - AI selects the best tool for the menu part
            console.log('🧠 STEP 1: THINK - Getting AI plan for menu query...');
            const toolPlan = await this.getContextAwarePlan(
                message,
                queryAnalysis.menuQuery, 
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
                    message: 'I specialize in menu items and food. Let me help you with that first.'
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
     * PHASE 2: Context-Aware and Focused Planning for Menu Specialist
     */
    async getContextAwarePlan(originalMessage, specificTask, history, globalContext, restaurantId) {
        try {
            console.log('🧠 Context-aware planning for MenuPricingAgent...');
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
                        message: 'I specialize in menu items and food. Let me help you with that first.'
                    }
                };
            }
            
            return toolPlan;
            
        } catch (error) {
            console.error('❌ Error in context-aware planning:', error);
            return {
                tool_to_call: 'clarify_and_respond',
                parameters: {
                    message: 'I need more information to help you with menu items.'
                }
            };
        }
    }

    /**
     * Build the focused thinking prompt for menu specialist
     */
    buildFocusedThinkingPrompt(originalMessage, specificTask, history, globalContext) {
        const contextSummary = this.summarizeGlobalContext(globalContext);
        const recentHistory = history.slice(-3).map(h => `${h.sender}: ${h.text}`).join('\n');
        
        return `You are a menu specialist agent. Your job is to analyze the user's request and choose the best tool from your limited tool belt.

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
3. Do NOT attempt to handle parts of the query that are outside your scope (like availability or celebrations)
4. If other agents have already handled related parts, focus on what's missing for menu information
5. Use get_menu_items for any request involving food, dishes, dietary requirements, or menu pricing
6. Use clarify_and_respond only if you need more information for menu searching

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
                case 'get_menu_items':
                    return await this.executeGetMenuItems(parameters, restaurantId);
                    
                case 'clarify_and_respond':
                    return await this.executeClarifyAndRespond(parameters);
                    
                default:
                    console.error('❌ Unknown tool for MenuPricingAgent:', toolName);
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
     * Execute get_menu_items tool - Core functionality
     */
    async executeGetMenuItems(params, restaurantId) {
        try {
            console.log('🍽️ Getting menu items:', params);
            
            // Build filters object
            const filters = { restaurant_id: restaurantId };
            if (params.is_gluten_free) filters.is_gluten_free = true;
            if (params.is_vegan) filters.is_vegan = true;  
            if (params.is_vegetarian) filters.is_vegetarian = true;
            if (params.category) filters.category = params.category;
            
            // Use RAG service for semantic search
            const hybridResults = await RAGService.hybridSearch(
                params.query,
                'menu_item',
                filters,
                10
            );
            
            // Also get regular menu items as fallback if no hybrid results
            let menuItems = hybridResults;
            
            if (!hybridResults || hybridResults.length === 0) {
                console.log('🔄 No hybrid results, falling back to regular menu query');
                const regularMenuItems = await RestaurantService.getMenuItems(restaurantId);
                
                // Apply basic filtering to regular results
                if (regularMenuItems && regularMenuItems.length > 0) {
                    menuItems = regularMenuItems.filter(item => {
                        if (params.is_gluten_free && !item.is_gluten_free) return false;
                        if (params.is_vegan && !item.is_vegan) return false;
                        if (params.is_vegetarian && !item.is_vegetarian) return false;
                        if (params.category && item.category !== params.category) return false;
                        
                        // Simple text matching for query
                        const query = params.query.toLowerCase();
                        const itemText = `${item.name} ${item.description || ''}`.toLowerCase();
                        return itemText.includes(query);
                    });
                }
            }
            
            return {
                success: true,
                items: menuItems || [],
                searchQuery: params.query,
                filtersApplied: filters,
                foundItems: (menuItems || []).length
            };
            
        } catch (error) {
            console.error('❌ Error getting menu items:', error);
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
     * ANALYZE QUERY SCOPE: Detect menu vs non-menu queries
     */
    analyzeQueryScope(message) {
        const lowerMessage = message.toLowerCase();
        
        // Keywords that indicate non-menu queries
        const availabilityKeywords = ['table', 'book', 'reserve', 'available', 'date', 'time', 'tonight', 'tomorrow'];
        const celebrationKeywords = ['birthday', 'anniversary', 'celebration', 'special occasion', 'romantic'];
        const infoKeywords = ['hours', 'address', 'location', 'contact', 'phone', 'email'];
        
        // Detect non-menu queries
        const hasAvailabilityQuery = availabilityKeywords.some(keyword => lowerMessage.includes(keyword));
        const hasCelebrationQuery = celebrationKeywords.some(keyword => lowerMessage.includes(keyword));
        const hasInfoQuery = infoKeywords.some(keyword => lowerMessage.includes(keyword));
        
        // Extract the menu-focused part of the query
        let menuQuery = message;
        let nonMenuParts = [];
        
        if (hasAvailabilityQuery) {
            // Find availability-related sentences
            const sentences = message.split(/[.!?]+/);
            const availabilitySentences = sentences.filter(s => 
                availabilityKeywords.some(keyword => s.toLowerCase().includes(keyword))
            );
            const menuSentences = sentences.filter(s => 
                !availabilityKeywords.some(keyword => s.toLowerCase().includes(keyword))
            );
            
            if (availabilitySentences.length > 0) {
                nonMenuParts.push({
                    type: 'availability',
                    query: availabilitySentences.join('. ').trim(),
                    suggestedAgent: 'TableAvailabilityAgent'
                });
            }
            
            if (menuSentences.length > 0) {
                menuQuery = menuSentences.join('. ').trim();
            }
        }
        
        if (hasCelebrationQuery) {
            const sentences = message.split(/[.!?]+/);
            const celebrationSentences = sentences.filter(s => 
                celebrationKeywords.some(keyword => s.toLowerCase().includes(keyword))
            );
            
            if (celebrationSentences.length > 0) {
                nonMenuParts.push({
                    type: 'celebration',
                    query: celebrationSentences.join('. ').trim(),
                    suggestedAgent: 'CelebrationAgent'
                });
            }
        }
        
        if (hasInfoQuery) {
            const sentences = message.split(/[.!?]+/);
            const infoSentences = sentences.filter(s => 
                infoKeywords.some(keyword => s.toLowerCase().includes(keyword))
            );
            
            if (infoSentences.length > 0) {
                nonMenuParts.push({
                    type: 'info',
                    query: infoSentences.join('. ').trim(),
                    suggestedAgent: 'RestaurantInfoAgent'
                });
            }
        }
        
        return {
            hasMultipleParts: nonMenuParts.length > 0,
            menuQuery: menuQuery || message,
            nonMenuParts,
            originalMessage: message
        };
    }

    /**
     * ANALYZE TASK COMPLETION: Determine if handoff is needed
     */
    analyzeTaskCompletion(originalMessage, queryAnalysis, toolResult) {
        // If we successfully handled menu query and there are non-menu parts, hand off availability part only
        if (queryAnalysis.hasMultipleParts && queryAnalysis.nonMenuParts.length > 0 && 
            toolResult && toolResult.success && this.hasCompletedMenuWork(toolResult)) {
            
            const availabilityPart = queryAnalysis.nonMenuParts.find(part => part.type === 'availability');
            if (availabilityPart) {
                return {
                    isComplete: false,
                    suggestedAgent: 'TableAvailabilityAgent',
                    remainingQuery: this.extractAvailabilityQuery(originalMessage) // Extract just the availability part
                };
            }
        }
        
        // If menu search failed or needs more information, task might be incomplete
        if (toolResult && !toolResult.success) {
            return {
                isComplete: true, // Let this agent handle the error
                suggestedAgent: null,
                remainingQuery: null
            };
        }
        
        // If we successfully found menu items, task is complete
        if (toolResult && toolResult.success) {
            return {
                isComplete: true,
                suggestedAgent: null,
                remainingQuery: null
            };
        }
        
        // Default: task is complete
        return {
            isComplete: true,
            suggestedAgent: null,
            remainingQuery: null
        };
    }

    /**
     * Check if we've completed menu-related work
     */
    hasCompletedMenuWork(toolResult) {
        return toolResult.success && toolResult.items && toolResult.foundItems >= 0;
    }

    /**
     * Extract only the availability-related part of the query
     */
    extractAvailabilityQuery(message) {
        const availabilityKeywords = ['table', 'book', 'reserve', 'available', 'date', 'time', 'tonight', 'tomorrow'];
        const lowerMessage = message.toLowerCase();
        
        // Look for availability-related phrases
        if (lowerMessage.includes('check availability') || lowerMessage.includes('available')) {
            // Extract the specific availability request
            const match = message.match(/(check availability|available).+?(\d+\s*people).+?(tomorrow|tonight|\d{4}-\d{2}-\d{2}).+?(\d{1,2}:\d{2}|\d{1,2}\s*pm|\d{1,2}\s*am)/i);
            if (match) {
                return match[0];
            }
        }
        
        // Extract availability-related sentences
        const sentences = message.split(/[.!?]+/);
        const availabilitySentences = sentences.filter(s => 
            availabilityKeywords.some(keyword => s.toLowerCase().includes(keyword))
        );
        
        if (availabilitySentences.length > 0) {
            return availabilitySentences.join('. ').trim();
        }
        
        // Fallback: generic availability query
        return "do you have tables available?";
    }

    /**
     * Generate fallback response when AI fails
     */
    generateFallbackResponse(toolResult, toolName) {
        if (toolName === 'get_menu_items' && toolResult.success && toolResult.items && toolResult.items.length > 0) {
            // Find the most expensive item
            const sortedItems = toolResult.items.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
            const mostExpensive = sortedItems[0];
            
            return {
                type: 'message',
                response: `Great! I found our most expensive dish: **${mostExpensive.name}** at €${mostExpensive.price}. ${mostExpensive.description || 'It\'s one of our premium selections!'}`
            };
        }
        
        if (toolName === 'get_menu_items' && toolResult.success && toolResult.items && toolResult.items.length === 0) {
            return {
                type: 'message',
                response: "I searched our menu but couldn't find items matching your specific request. Would you like me to show you our full menu instead?"
            };
        }
        
        // Default fallback
        return {
            type: 'message',
            response: "I can help you with menu information! What would you like to know about our dishes?"
        };
    }
}

export default MenuPricingAgent;