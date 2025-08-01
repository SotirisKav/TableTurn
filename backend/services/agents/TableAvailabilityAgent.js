/**
 * Table Availability Agent - Hybrid "Agency" Architecture
 * 
 * UPGRADED IMPLEMENTATION: This agent now implements the "Think -> Act -> Speak" pattern
 * using a specialized subset of tools. It can analyze complex queries and hand off 
 * unrelated parts to other agents while maintaining perfect accuracy in its domain.
 */

import BaseAgent from './BaseAgent.js';
import { getAiPlan, generateSpokenResponse } from '../AIService.js';
import { validateToolParameters } from '../ToolService.js';
import RestaurantService from '../RestaurantService.js';

class TableAvailabilityAgent extends BaseAgent {
    constructor() {
        super(
            'TableAvailabilityAgent',
            'Table Availability Specialist',
            ['availability', 'capacity', 'table', 'booking', 'reservation', 'date', 'time']
        );
        
        // Define specialized tools for this agent
        this.allowedTools = ['check_availability', 'clarify_and_respond'];
    }

    /**
     * HYBRID ARCHITECTURE: Think -> Act -> Speak Loop
     * 
     * This agent implements the two-call model within its specialized domain:
     * 1. THINK: AI analyzes the message and selects the best tool from allowedTools
     * 2. ACT: Execute the selected tool with validated parameters
     * 3. SPEAK: AI generates a natural response based on tool results
     * 
     * Additionally, it analyzes if parts of the query are outside its scope
     * and provides handoff information to the orchestrator.
     */
    async processMessage(message, history = [], restaurantId = null, context = {}) {
        try {
            console.log(`🔍 ${this.name} processing with Think->Act->Speak:`, message);
            
            const effectiveRestaurantId = restaurantId || 1;
            
            // CHECK FOR TABLE SELECTION: Use RAG to detect if user is selecting a table type
            const tableSelectionAnalysis = await this.analyzeTableSelection(message, history);
            if (tableSelectionAnalysis.isTableSelection) {
                console.log('🎯 Detected table selection:', tableSelectionAnalysis);
                return await this.handleTableSelection(tableSelectionAnalysis, history, effectiveRestaurantId);
            }
            
            // ANALYZE QUERY SCOPE: Detect if message contains non-availability queries
            const queryAnalysis = this.analyzeQueryScope(message);
            console.log('📋 Query analysis:', queryAnalysis);
            
            // STEP 1: THINK - AI selects the best tool for the availability part
            console.log('🧠 STEP 1: THINK - Getting AI plan for availability query...');
            const toolPlan = await this.getContextAwarePlan(
                message,
                queryAnalysis.availabilityQuery, 
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
                    message: 'I specialize in table availability. Let me help you with that first.'
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
            
            // Check if we're presenting table options and waiting for user selection
            const isAwaitingTableSelection = toolResult && 
                toolResult.success && 
                toolResult.available && 
                toolResult.hasMultipleTableTypes &&
                taskCompletionAnalysis.isComplete;

            // Build silent data collector response object (NO response text)
            const agentResponse = {
                toolResult: toolResult, // The raw, factual data from the "Act" step
                isTaskComplete: taskCompletionAnalysis.isComplete,
                agent: this.name,
                timestamp: new Date().toISOString()
            };
            
            // CRITICAL: Signal when awaiting user table selection
            if (isAwaitingTableSelection) {
                console.log('🔔 AWAITING TABLE SELECTION: Signaling orchestrator');
                agentResponse.contextData = {
                    isAwaitingUserResponse: true,
                    nextAgent: 'ReservationAgent',
                    activeFlow: 'booking',
                    flowState: {
                        date: toolResult.date,
                        time: toolResult.time,
                        partySize: toolResult.partySize,
                        availableTableTypes: toolResult.availableTableTypes,
                        restaurantId: effectiveRestaurantId
                    }
                };
                console.log('🔔 Context data:', agentResponse.contextData);
            }
            
            // Add handoff information if task is incomplete
            if (!taskCompletionAnalysis.isComplete) {
                agentResponse.handoffSuggestion = taskCompletionAnalysis.suggestedAgent;
                agentResponse.unansweredQuery = taskCompletionAnalysis.remainingQuery;
                
                console.log('🔀 Task incomplete, suggesting handoff to:', taskCompletionAnalysis.suggestedAgent);
                console.log('🔀 Remaining query:', taskCompletionAnalysis.remainingQuery);
            }
            
            // Removed: No longer handling spokenResponse data since agents are silent
            
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
     * PHASE 2: Context-Aware and Focused Planning
     * 
     * This method implements the new smarter "Think" prompt that:
     * 1. Is aware of what other agents have already done (globalContext)
     * 2. Focuses only on its specific task within the larger query
     * 3. Is constrained to its allowed tools only
     */
    async getContextAwarePlan(originalMessage, specificTask, history, globalContext, restaurantId) {
        try {
            console.log('🧠 Context-aware planning for TableAvailabilityAgent...');
            console.log('🌐 Global context available:', Object.keys(globalContext));
            
            // Build the new smarter, focused prompt
            const focusedPrompt = this.buildFocusedThinkingPrompt(
                originalMessage, 
                specificTask, 
                history, 
                globalContext
            );
            
            // Call AI with the focused prompt
            const { getAiPlan } = await import('../AIService.js');
            const toolPlan = await getAiPlan(
                focusedPrompt,
                [], // Empty history since we're providing context in prompt
                { allowedTools: this.allowedTools },
                restaurantId
            );
            
            // Validate that the selected tool is allowed for this agent
            if (!this.allowedTools.includes(toolPlan.tool_to_call)) {
                console.warn(`⚠️ AI selected disallowed tool ${toolPlan.tool_to_call}, falling back to clarify_and_respond`);
                return {
                    tool_to_call: 'clarify_and_respond',
                    parameters: {
                        message: 'I specialize in table availability. Let me help you with that first.'
                    }
                };
            }
            
            return toolPlan;
            
        } catch (error) {
            console.error('❌ Error in context-aware planning:', error);
            return {
                tool_to_call: 'clarify_and_respond',
                parameters: {
                    message: 'I need a bit more information to check availability for you.'
                }
            };
        }
    }

    /**
     * Build the focused thinking prompt for context-aware planning
     */
    buildFocusedThinkingPrompt(originalMessage, specificTask, history, globalContext) {
        const contextSummary = this.summarizeGlobalContext(globalContext);
        const recentHistory = history.slice(-3).map(h => `${h.sender}: ${h.text}`).join('\n');
        
        return `You are a table availability specialist agent. Your job is to analyze the user's request and choose the best tool from your limited tool belt.

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
3. Do NOT attempt to handle parts of the query that are outside your scope (like menu items or celebrations)
4. If other agents have already handled related parts, focus on what's missing for table availability
5. Use check_availability for any request involving dates, times, party sizes, or table booking
6. Use clarify_and_respond only if you need more information for availability checking

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
                case 'check_availability':
                    return await this.executeCheckAvailability(parameters, restaurantId);
                    
                case 'clarify_and_respond':
                    return await this.executeClarifyAndRespond(parameters);
                    
                default:
                    console.error('❌ Unknown tool for TableAvailabilityAgent:', toolName);
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
     * Execute check_availability tool - Core functionality
     */
    async executeCheckAvailability(params, restaurantId) {
        try {
            console.log('🔍 Checking availability:', params);
            
            // Pre-check: Verify party size doesn't exceed restaurant's maximum table capacity
            const maxCapacity = await RestaurantService.getMaxTableCapacity(restaurantId);
            if (params.partySize > maxCapacity) {
                return {
                    success: true,
                    available: false,
                    message: `Sorry, we can only accommodate up to ${maxCapacity} people. Your party size of ${params.partySize} exceeds our maximum table capacity.`,
                    date: params.date,
                    time: params.time,
                    partySize: params.partySize,
                    reason: 'exceeds_capacity'
                };
            }
            
            // Get available table types for the specific time
            const availableTableTypes = await RestaurantService.getAvailableTableTypesForTime({
                restaurantId: restaurantId,
                reservationDate: params.date,
                reservationTime: params.time,
                guests: params.partySize
            });
            
            if (availableTableTypes && availableTableTypes.length > 0) {
                // Format table options for the AI response
                const tableOptions = availableTableTypes.map(t => ({
                    tableType: t.table_type,
                    price: t.table_price || '0.00',
                    capacity: t.capacity
                }));
                
                return {
                    success: true,
                    available: true,
                    availableTableTypes: tableOptions,
                    hasMultipleTableTypes: tableOptions.length > 1,
                    date: params.date,
                    time: params.time,
                    partySize: params.partySize
                };
            } else {
                return {
                    success: true,
                    available: false,
                    message: `No tables available for ${params.partySize} people on ${params.date} at ${params.time}`,
                    date: params.date,
                    time: params.time,
                    partySize: params.partySize
                };
            }
            
        } catch (error) {
            console.error('❌ Error checking availability:', error);
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
     * ANALYZE QUERY SCOPE: Detect availability vs non-availability queries
     */
    analyzeQueryScope(message) {
        const lowerMessage = message.toLowerCase();
        
        // Keywords that indicate non-availability queries
        const menuKeywords = ['menu', 'food', 'dish', 'wine', 'drink', 'eat', 'gluten', 'vegetarian', 'vegan', 'price'];
        const celebrationKeywords = ['birthday', 'anniversary', 'celebration', 'special occasion', 'romantic'];
        const infoKeywords = ['hours', 'address', 'location', 'contact', 'phone', 'email'];
        
        // Detect menu-related queries
        const hasMenuQuery = menuKeywords.some(keyword => lowerMessage.includes(keyword));
        const hasCelebrationQuery = celebrationKeywords.some(keyword => lowerMessage.includes(keyword));
        const hasInfoQuery = infoKeywords.some(keyword => lowerMessage.includes(keyword));
        
        // Extract the availability-focused part of the query
        let availabilityQuery = message;
        let nonAvailabilityParts = [];
        
        if (hasMenuQuery) {
            // Find menu-related sentences
            const sentences = message.split(/[.!?]+/);
            const menuSentences = sentences.filter(s => 
                menuKeywords.some(keyword => s.toLowerCase().includes(keyword))
            );
            const availabilitySentences = sentences.filter(s => 
                !menuKeywords.some(keyword => s.toLowerCase().includes(keyword))
            );
            
            if (menuSentences.length > 0) {
                nonAvailabilityParts.push({
                    type: 'menu',
                    query: menuSentences.join('. ').trim(),
                    suggestedAgent: 'MenuPricingAgent'
                });
            }
            
            if (availabilitySentences.length > 0) {
                availabilityQuery = availabilitySentences.join('. ').trim();
            }
        }
        
        if (hasCelebrationQuery) {
            const sentences = message.split(/[.!?]+/);
            const celebrationSentences = sentences.filter(s => 
                celebrationKeywords.some(keyword => s.toLowerCase().includes(keyword))
            );
            
            if (celebrationSentences.length > 0) {
                nonAvailabilityParts.push({
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
                nonAvailabilityParts.push({
                    type: 'info',
                    query: infoSentences.join('. ').trim(),
                    suggestedAgent: 'RestaurantInfoAgent'
                });
            }
        }
        
        return {
            hasMultipleParts: nonAvailabilityParts.length > 0,
            availabilityQuery: availabilityQuery || message,
            nonAvailabilityParts,
            originalMessage: message
        };
    }

    /**
     * ANALYZE TASK COMPLETION: Determine if handoff is needed
     */
    analyzeTaskCompletion(originalMessage, queryAnalysis, toolResult) {
        // If we successfully handled availability and there are non-availability parts, hand off the menu part only
        if (queryAnalysis.hasMultipleParts && queryAnalysis.nonAvailabilityParts.length > 0 && 
            toolResult && toolResult.success && this.hasCompletedAvailabilityWork(toolResult)) {
            
            const menuPart = queryAnalysis.nonAvailabilityParts.find(part => part.type === 'menu');
            if (menuPart) {
                return {
                    isComplete: false,
                    suggestedAgent: 'MenuPricingAgent',
                    remainingQuery: this.extractMenuQuery(originalMessage) // Extract just the menu part
                };
            }
        }
        
        // If availability check failed or needs more information, task might be incomplete
        if (toolResult && !toolResult.success) {
            return {
                isComplete: true, // Let this agent handle the error
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
     * Check if we've completed availability-related work
     */
    hasCompletedAvailabilityWork(toolResult) {
        return toolResult.success && (toolResult.available !== undefined);
    }

    /**
     * Extract only the menu-related part of the query
     */
    extractMenuQuery(message) {
        const menuKeywords = ['menu', 'food', 'dish', 'wine', 'drink', 'eat', 'expensive', 'cheap', 'price', 'cost'];
        const lowerMessage = message.toLowerCase();
        
        // Look for menu-related phrases
        if (lowerMessage.includes('most expensive dish') || lowerMessage.includes('expensive dish')) {
            return "what's the most expensive dish you have?";
        }
        
        if (lowerMessage.includes('menu')) {
            return "can you tell me about your menu?";
        }
        
        // Extract menu-related sentences
        const sentences = message.split(/[.!?]+/);
        const menuSentences = sentences.filter(s => 
            menuKeywords.some(keyword => s.toLowerCase().includes(keyword))
        );
        
        if (menuSentences.length > 0) {
            return menuSentences.join('. ').trim();
        }
        
        // Fallback: generic menu query
        return "can you tell me about your food options?";
    }

    /**
     * RAG-BASED TABLE SELECTION ANALYSIS: Use AI to analyze conversation context
     */
    async analyzeTableSelection(message, history) {
        try {
            // FIRST: Try pattern-based detection (fast, no API needed)
            const patternResult = this.detectTableSelectionPattern(message, history);
            if (patternResult.isTableSelection) {
                console.log('🎯 Pattern-based table selection detected:', patternResult.selectedTableType);
                return patternResult;
            }

            // FALLBACK: Use AI analysis if pattern detection fails
            const recentConversation = history.slice(-3).map(h => `${h.sender}: ${h.text}`).join('\n');
            
            const analysisPrompt = `Analyze this conversation to determine if the user is selecting a table type from previously mentioned options.

RECENT CONVERSATION:
${recentConversation}

CURRENT USER MESSAGE: "${message}"

Analyze if this message is:
1. A selection of a table type that was recently mentioned in the conversation
2. A continuation of a booking process
3. Contains booking context (date, time, party size)

Respond with JSON:
{
  "isTableSelection": boolean,
  "selectedTableType": "string or null",
  "bookingContext": {
    "date": "string or null", 
    "time": "string or null",
    "partySize": "number or null"
  },
  "confidence": "high/medium/low"
}`;

            const aiAnalysis = await getAiPlan(analysisPrompt, [], {}, null);
            
            // Parse AI response safely
            if (aiAnalysis && typeof aiAnalysis === 'object') {
                return {
                    isTableSelection: aiAnalysis.isTableSelection || false,
                    selectedTableType: aiAnalysis.selectedTableType || null,
                    bookingContext: aiAnalysis.bookingContext || {},
                    confidence: aiAnalysis.confidence || 'low'
                };
            }
            
            return { isTableSelection: false, selectedTableType: null, bookingContext: {}, confidence: 'low' };
            
        } catch (error) {
            console.error('❌ Error in RAG table selection analysis, trying pattern fallback:', error);
            // Final fallback to pattern detection if AI fails
            return this.detectTableSelectionPattern(message, history);
        }
    }

    /**
     * Pattern-based table selection detection (no AI needed)
     */
    detectTableSelectionPattern(message, history) {
        const lowerMessage = message.toLowerCase().trim();
        
        // Check if recent AI message asked about table preference
        const recentAiMessage = history.slice(-2).find(h => h.sender === 'ai');
        const askedTableQuestion = recentAiMessage && 
            (recentAiMessage.text.toLowerCase().includes('which table type would you prefer') ||
             recentAiMessage.text.toLowerCase().includes('which type would you prefer') ||
             recentAiMessage.text.toLowerCase().includes('table options'));

        if (!askedTableQuestion) {
            return { isTableSelection: false, selectedTableType: null, bookingContext: {}, confidence: 'low' };
        }

        // Extract booking context from recent conversation
        const bookingContext = this.extractBookingContextFromHistory(history);

        // Known table types to detect
        const tableTypes = ['standard', 'grass', 'anniversary'];
        
        for (const tableType of tableTypes) {
            if (lowerMessage.includes(tableType)) {
                return {
                    isTableSelection: true,
                    selectedTableType: tableType,
                    bookingContext,
                    confidence: 'high'
                };
            }
        }

        // Check for simple responses like "the first one", "standard table", etc.
        if (lowerMessage.includes('standard table') || lowerMessage === 'standard') {
            return {
                isTableSelection: true,
                selectedTableType: 'standard',
                bookingContext,
                confidence: 'high'
            };
        }

        return { isTableSelection: false, selectedTableType: null, bookingContext: {}, confidence: 'low' };
    }

    /**
     * Extract booking context from conversation history
     */
    extractBookingContextFromHistory(history) {
        const context = { date: null, time: null, partySize: null };
        
        // Look through recent messages for booking details
        const recentMessages = history.slice(-5);
        for (const msg of recentMessages) {
            const text = msg.text.toLowerCase();
            
            // Extract date patterns
            if (text.includes('tomorrow')) {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                context.date = tomorrow.toISOString().split('T')[0];
            }
            
            // Extract time patterns (like "3pm", "15:00")
            const timeMatch = text.match(/(\d{1,2})(pm|am|\s*:\s*\d{2})/i);
            if (timeMatch) {
                let hour = parseInt(timeMatch[1]);
                if (timeMatch[2].toLowerCase() === 'pm' && hour !== 12) hour += 12;
                if (timeMatch[2].toLowerCase() === 'am' && hour === 12) hour = 0;
                context.time = `${hour.toString().padStart(2, '0')}:00`;
            }
            
            // Extract party size
            const partySizeMatch = text.match(/(\d+)\s+people?/);
            if (partySizeMatch) {
                context.partySize = parseInt(partySizeMatch[1]);
            }
        }
        
        return context;
    }

    /**
     * RAG-BASED TABLE SELECTION HANDLING: Use AI to generate dynamic response
     */
    async handleTableSelection(selectionAnalysis, history, restaurantId) {
        const { selectedTableType, bookingContext } = selectionAnalysis;
        
        console.log('📝 Processing table selection:', selectedTableType);
        console.log('📝 Booking context:', bookingContext);
        
        try {
            // Use AI to generate appropriate response for table selection
            const recentConversation = history.slice(-3).map(h => `${h.sender}: ${h.text}`).join('\n');
            
            const responsePrompt = `Generate a friendly restaurant response for a customer who just selected a table type.

CONTEXT:
- Customer selected: ${selectedTableType} table
- Booking details: ${JSON.stringify(bookingContext)}

RECENT CONVERSATION:
${recentConversation}

Generate a response that:
1. Confirms their table selection
2. Summarizes their booking details if available  
3. Asks for contact information to complete the reservation
4. Is warm and professional

Respond with just the text response, no JSON.`;

            // Create booking query for ReservationAgent
            const contextString = Object.entries(bookingContext)
                .filter(([key, value]) => value !== null && value !== undefined)
                .map(([key, value]) => `${key}: ${value}`)
                .join(', ');
            
            const bookingQuery = `Complete reservation for ${selectedTableType} table${contextString ? ` (${contextString})` : ''} - need contact information`;

            return {
                toolResult: {
                    success: true,
                    selectedTableType,
                    bookingContext,
                    tableSelected: true,
                    needsContactInfo: true
                },
                isTaskComplete: false,
                handoffSuggestion: 'ReservationAgent',
                unansweredQuery: bookingQuery,
                agent: this.name,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Error in RAG table selection handling:', error);
            
            // Simple fallback without response generation
            return {
                toolResult: {
                    success: true,
                    selectedTableType,
                    bookingContext,
                    tableSelected: true,
                    needsContactInfo: true,
                    error: error.message
                },
                isTaskComplete: false,
                handoffSuggestion: 'ReservationAgent',
                unansweredQuery: `Complete reservation - need contact information`,
                agent: this.name,
                timestamp: new Date().toISOString()
            };
        }
    }
}

export default TableAvailabilityAgent;