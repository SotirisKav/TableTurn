/**
 * Agent Orchestrator - Multi-Agent Conversation Manager
 * Coordinates between specialized agents for restaurant reservations
 */

import RestaurantInfoAgent from './RestaurantInfoAgent.js';
import ReservationAgent from './ReservationAgent.js';
import TableAvailabilityAgent from './TableAvailabilityAgent.js';
import MenuPricingAgent from './MenuPricingAgent.js';

import CelebrationAgent from './CelebrationAgent.js';
import SupportContactAgent from './SupportContactAgent.js';
import db from '../../config/database.js';

class AgentOrchestrator {
    constructor() {
        this.agents = {
            restaurant: new RestaurantInfoAgent(),
            availability: new TableAvailabilityAgent(),
            reservation: new ReservationAgent(),
            menu: new MenuPricingAgent(),

            celebration: new CelebrationAgent(),
            support: new SupportContactAgent()
        };
        
        this.conversationState = {
            currentIntent: null,
            activeAgent: null,
            context: {},
            reservationProgress: {},
            delegationChain: [],
            finalResponse: null
        };
    }

    /**
     * Main entry point for processing user messages
     */
    async processMessage(message, history = [], restaurantId = null) {
        try {
            console.log('🎭 Agent Orchestrator processing:', message);
            
            // ENHANCED: Check if user wants to resume interrupted context
            if (this.conversationState.interruptedContext && this.checkResumeInterrupted(message)) {
                this.resumeInterruptedContext();
                console.log('🔄 Resumed interrupted context, continuing with reservation flow');
                
                // Continue with reservation agent
                const reservationAgent = this.agents.reservation;
                return await reservationAgent.processMessage(message, history, restaurantId, {
                    isMultiAgent: false,
                    orchestrator: this,
                    conversationState: this.conversationState
                });
            }
            
            // Check if this is a complex query requiring multi-agent coordination
            const requiresMultiAgent = this.detectMultiAgentQuery(message);
            
            if (requiresMultiAgent) {
                console.log('🔄 Multi-agent query detected, initiating delegation workflow');
                return await this.handleMultiAgentWorkflow(message, history, restaurantId);
            } else {
                // Single agent workflow
                return await this.handleSingleAgentWorkflow(message, history, restaurantId);
            }
            
        } catch (error) {
            console.error('❌ Agent Orchestrator error:', error);
            return {
                response: "I apologize, but I'm having trouble processing your request right now. Please try again.",
                type: 'message',
                orchestrator: {
                    agent: 'orchestrator',
                    error: error.message
                }
            };
        }
    }

    /**
     * Handle single agent workflow (original behavior)
     */
    async handleSingleAgentWorkflow(message, history, restaurantId) {
        // Analyze intent and determine which agent should handle the request
        const intent = await this.analyzeIntent(message, history);
        console.log('🎯 Detected intent:', intent);
        
        // Get the appropriate agent
        const agent = this.selectAgent(intent);
        console.log('🤖 Selected agent:', agent.name);
        
        // Update conversation state
        this.updateConversationState(intent, agent, message);
        
        // Process the message with the selected agent
        const response = await agent.processMessage(
            message, 
            history, 
            restaurantId, 
            this.conversationState.context
        );
        
        // Post-process response and handle agent coordination
        return await this.coordinateResponse(response, intent, agent, restaurantId, history);
    }

    /**
     * Handle multi-agent workflow with delegation
     */
    async handleMultiAgentWorkflow(message, history, restaurantId) {
        console.log('🔄 Starting multi-agent workflow');
        
        // ENHANCED: Check if this is an interruption/context switch during ongoing conversation
        const isContextSwitch = this.conversationState.activeAgent && 
                               this.conversationState.activeAgent !== 'orchestrator';
        
        if (isContextSwitch) {
            console.log(`🔄 Context switch detected from ${this.conversationState.activeAgent}`);
            // Store interrupted context before resetting
            this.handleConversationInterrupt(message, await this.analyzeIntent(message, history), history);
        }
        
        // Start with the primary agent based on intent
        const primaryIntent = await this.analyzeIntent(message, history);
        const primaryAgent = this.selectAgent(primaryIntent);
        
        console.log(`🎯 Primary agent: ${primaryAgent.name} (intent: ${primaryIntent})`);
        
        // Initialize delegation chain
        this.conversationState.delegationChain = [{
            agent: primaryAgent.name,
            intent: primaryIntent,
            message: message,
            timestamp: new Date().toISOString()
        }];
        
        // Process with primary agent
        let currentResponse = await primaryAgent.processMessage(
            message, 
            history, 
            restaurantId,
            { 
                isMultiAgent: true,
                orchestrator: this,
                conversationState: this.conversationState,
                ...this.conversationState.context // Include current context
            }
        );
        
        // ENHANCED: Immediate response for simple queries (no delegation needed)
        if (!currentResponse.delegateTo && !currentResponse.needsMoreInfo) {
            console.log(`✅ ${primaryAgent.name} handled query completely, no delegation needed`);
            return this.consolidateMultiAgentResponse(currentResponse, message);
        }
        
        // Process delegation chain if needed
        if (currentResponse.delegateTo || currentResponse.needsMoreInfo) {
            currentResponse = await this.processDelegationChain(currentResponse, message, history, restaurantId);
        }
        
        // Consolidate multi-agent response
        return this.consolidateMultiAgentResponse(currentResponse, message);
    }

    /**
     * Process delegation chain
     */
    async processDelegationChain(response, originalMessage, history, restaurantId) {
        let currentResponse = response;
        let iterationCount = 0;
        const maxIterations = 3; // Prevent infinite loops
        
        while (currentResponse.type === 'delegation' && iterationCount < maxIterations) {
            iterationCount++;
            console.log(`🔄 Delegation iteration ${iterationCount}: ${currentResponse.delegateTo}`);
            
            const nextAgent = this.agents[currentResponse.delegateTo.toLowerCase()];
            if (!nextAgent) {
                console.error(`❌ Unknown agent for delegation: ${currentResponse.delegateTo}`);
                break;
            }
            
            // Track delegation
            this.conversationState.delegationChain.push({
                agent: nextAgent.name,
                delegatedFrom: this.conversationState.delegationChain[this.conversationState.delegationChain.length - 1]?.agent,
                timestamp: new Date().toISOString()
            });
            
            // Process with delegated agent
            currentResponse = await nextAgent.processMessage(
                currentResponse.originalQuery || originalMessage,
                history,
                restaurantId,
                currentResponse.context || this.conversationState.context
            );
        }
        
        // If we have a complete reservation, insert it into database
        if (currentResponse.type === 'redirect' && currentResponse.data?.reservationDetails) {
            console.log('💾 Inserting reservation into database');
            try {
                const insertResult = await this.insertReservation(currentResponse.data.reservationDetails, restaurantId);
                currentResponse.data.insertResult = insertResult;
                currentResponse.data.reservationId = insertResult.reservation_id;
            } catch (error) {
                console.error('❌ Error inserting reservation:', error);
                currentResponse.data.insertError = error.message;
            }
        }
        
        // Consolidate multi-agent response
        return this.consolidateMultiAgentResponse(currentResponse, originalMessage);
    }

    /**
     * Analyze user intent using AI logic instead of keywords
     */
    async analyzeIntent(message, history) {
        try {
            // Get recent conversation context
            const recentContext = this.getRecentContext(history);
            
            // Check if we're in an ongoing reservation flow
            const isReservationFlow = this.conversationState.context.bookingInProgress;
            
            // ENHANCED: Immediate intent detection for context switches
            const immediateIntents = {
                support: ['owner info', 'owner information', 'contact info', 'contact information', 
                         'who owns', 'restaurant owner', 'manager info', 'phone number', 'email',
                         'contact details', 'owner details', 'manager contact'],
                menu: ['menu', 'food', 'dishes', 'what do you serve', 'prices', 'cost',
                       'vegetarian', 'vegan', 'gluten free', 'dessert', 'appetizer'],
                location: ['transfer', 'airport', 'pickup', 'transportation', 'hotel',
                          'directions', 'address', 'how to get there', 'taxi'],
                celebration: ['celebration', 'birthday', 'anniversary', 'romantic', 'special occasion',
                             'cake', 'flowers', 'surprise']
            };
            
            const msg = message.toLowerCase();
            
            // Check for immediate intent matches (highest priority)
            for (const [intent, keywords] of Object.entries(immediateIntents)) {
                if (keywords.some(keyword => msg.includes(keyword))) {
                    console.log(`🎯 Immediate intent detected: ${intent} for "${message}"`);
                    return intent;
                }
            }
            
            // CRITICAL FIX: Route availability queries with specific booking details to TableAvailabilityAgent
            const hasSpecificBookingDetails = /(\\d+\\s*(pm|am)|friday|saturday|sunday|monday|tuesday|wednesday|thursday|tomorrow|today|\\d+\\s*(people|person|guests))/i.test(message);
            const isAvailabilityQuery = msg.includes('available') || msg.includes('do you have') || msg.includes('table for');
            
            if (isAvailabilityQuery && hasSpecificBookingDetails) {
                console.log('🔄 Availability query with specific details → routing to availability agent');
                return 'availability';
            }
            
            // Use AI to analyze intent with context for complex cases
            const { askGemini } = await import('../AIService.js');
            
            const intentPrompt = `Analyze the user's intent from this message in the context of a restaurant reservation system.

Recent conversation context:
${recentContext || 'No recent context'}

Current message: "${message}"

Is this part of an ongoing reservation? ${isReservationFlow ? 'Yes' : 'No'}

IMPORTANT ROUTING RULES:
- If asking about availability WITH specific details (date/time/party size) → "availability" 
- If continuing an existing booking process → "reservation"
- If asking general questions about tables/capacity → "availability"
- If providing contact info or confirming booking → "reservation"

Based on the message and context, determine the PRIMARY intent from these options:
- availability: Checking if tables are available, asking about capacity, or initial availability queries
- reservation: Continuing a booking process, providing contact info, or finalizing reservations  
- menu: Asking about food, drinks, prices, dietary options
- celebration: Special occasions, birthdays, anniversaries, romantic dining
- location: Address, directions, transfers, hotels
- support: Contact info, complaints, help requests, owner information
- restaurant: General info, hours, atmosphere, reviews

Respond with just the intent name (one word).`;

            const intentResponse = await askGemini(intentPrompt, [], null);
            const detectedIntent = intentResponse.response?.toLowerCase().trim();
            
            // Validate the response is one of our expected intents
            const validIntents = ['reservation', 'availability', 'menu', 'celebration', 'location', 'support', 'restaurant'];
            
            if (validIntents.includes(detectedIntent)) {
                console.log(`🤖 AI detected intent: ${detectedIntent} for message: "${message}"`);
                return detectedIntent;
            } else {
                // Fallback logic for edge cases
                console.log(`🤖 AI intent analysis returned unexpected result: ${detectedIntent}, using fallback`);
                
                // Smart fallback based on context
                if (isReservationFlow && !msg.includes('owner') && !msg.includes('menu') && !msg.includes('contact')) {
                    return 'reservation';
                } else if (msg.includes('available') || msg.includes('do you have') || msg.includes('table for')) {
                    return 'availability';
                } else if (msg.includes('book') || msg.includes('reserve')) {
                    return 'availability'; // Route booking requests to availability first
                } else if (msg.includes('menu') || msg.includes('food')) {
                    return 'menu';
                } else if (msg.includes('owner') || msg.includes('contact')) {
                    return 'support';
                } else {
                    return 'restaurant';
                }
            }
            
        } catch (error) {
            console.error('❌ Error in AI intent analysis:', error);
            
            // Fallback to simple logic
            const msg = message.toLowerCase();
            
            // Enhanced fallback with proper availability routing
            if (msg.includes('owner') || msg.includes('contact')) {
                return 'support';
            } else if (msg.includes('menu') || msg.includes('food')) {
                return 'menu';
            } else if (msg.includes('available') || msg.includes('do you have') || msg.includes('table for')) {
                return 'availability';
            } else if (this.conversationState.context.bookingInProgress && 
                      !msg.includes('owner') && !msg.includes('menu')) {
                return 'reservation';
            } else if (msg.includes('book') || msg.includes('reserve')) {
                return 'availability'; // Route booking requests to availability first
            } else {
                return 'restaurant';
            }
        }
    }

    /**
     * Select the appropriate agent based on intent
     */
    selectAgent(intent) {
        const agentMap = {
            restaurant: this.agents.restaurant,
            availability: this.agents.availability,
            reservation: this.agents.reservation,
            menu: this.agents.menu,
            location: this.agents.location,
            celebration: this.agents.celebration,
            support: this.agents.support
        };

        return agentMap[intent] || this.agents.restaurant;
    }

    /**
     * Update conversation state
     */
    updateConversationState(intent, agent, message) {
        this.conversationState.currentIntent = intent;
        this.conversationState.activeAgent = agent.name;
        
        // Update context based on intent
        if (intent === 'reservation') {
            this.conversationState.context.bookingInProgress = true;
        } else if (intent === 'availability') {
            // Availability queries don't trigger booking flow
            this.conversationState.context.availabilityInProgress = true;
        }
        
        // Track reservation progress only when booking is in progress
        if (this.conversationState.context.bookingInProgress) {
            this.extractReservationData(message);
        }
    }

    /**
     * Extract and track reservation data from conversation
     */
    extractReservationData(message) {
        const msg = message.toLowerCase();
        
        // Extract date patterns
        const datePatterns = [
            /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,
            /(today|tomorrow|next week)/,
            /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/
        ];
        
        // Extract time patterns
        const timePatterns = [
            /(\d{1,2}):(\d{2})\s*(am|pm)/i,
            /(\d{1,2})\s*(am|pm)/i,
            /(morning|afternoon|evening|night)/
        ];
        
        // Extract party size
        const partySizePattern = /(\d+)\s*(people|guests|persons|party)/;
        
        // Update reservation progress
        if (!this.conversationState.reservationProgress) {
            this.conversationState.reservationProgress = {};
        }
        
        // Check for date
        for (const pattern of datePatterns) {
            const match = msg.match(pattern);
            if (match) {
                this.conversationState.reservationProgress.date = match[0];
                break;
            }
        }
        
        // Check for time
        for (const pattern of timePatterns) {
            const match = msg.match(pattern);
            if (match) {
                this.conversationState.reservationProgress.time = match[0];
                break;
            }
        }
        
        // Check for party size
        const sizeMatch = msg.match(partySizePattern);
        if (sizeMatch) {
            this.conversationState.reservationProgress.partySize = parseInt(sizeMatch[1]);
        }
    }

    /**
     * Detect if query requires multi-agent coordination
     */
    detectMultiAgentQuery(message) {
        const msg = message.toLowerCase();
        
        // Don't trigger multi-agent for simple responses in ongoing conversations
        const isSimpleResponse = msg.trim().length <= 15 && !msg.includes(' ');
        const isNumericResponse = /^\\d+$/.test(msg.trim());
        const isTableType = ['standard', 'grass', 'anniversary'].includes(msg.trim());
        
        if (isSimpleResponse || isNumericResponse || isTableType) {
            return false;
        }
        
        // ENHANCED: Check for immediate context switching keywords
        const immediateSwitch = [
            'owner info', 'owner information', 'contact info', 'contact information',
            'who owns', 'restaurant owner', 'manager info', 'phone number', 'email',
            'menu', 'food', 'dishes', 'what do you serve', 'prices',
            'transfer', 'airport', 'pickup', 'transportation', 'hotel',
            'celebration', 'birthday', 'anniversary', 'romantic', 'special occasion'
        ];
        
        const hasImmediateSwitch = immediateSwitch.some(keyword => msg.includes(keyword));
        if (hasImmediateSwitch) {
            console.log(`🔄 Immediate context switch detected: "${msg}"`);
            return true; // Always trigger multi-agent for context switches
        }
        
        // Check for compound queries (contains 'and', 'also', etc.)
        const compoundIndicators = ['and', 'also', 'plus', 'what about', 'additionally'];
        const hasCompoundIndicator = compoundIndicators.some(indicator => msg.includes(indicator));
        
        // Check for multiple domain keywords
        const domainKeywords = {
            availability: ['available', 'biggest', 'largest', 'capacity', 'check'],
            reservation: ['book', 'reserve', 'booking', 'make reservation'],
            datetime: ['date', 'time', 'friday', 'tomorrow', 'today', 'day', 'what day', 'when'],
            menu: ['menu', 'dish', 'food', 'gluten', 'vegetarian', 'main course'],
            celebration: ['romantic', 'birthday', 'anniversary', 'special'],
            location: ['transfer', 'hotel', 'pickup', 'airport'],
            support: ['owner', 'contact', 'phone', 'email', 'manager', 'help']
        };
        
        let domainMatches = 0;
        const matchedDomains = [];
        for (const [domain, keywords] of Object.entries(domainKeywords)) {
            if (keywords.some(keyword => msg.includes(keyword))) {
                domainMatches++;
                matchedDomains.push(domain);
            }
        }
        
        // Don't trigger multi-agent for availability + datetime combinations (they're related)
        const isAvailabilityWithDateTime = matchedDomains.length === 2 && 
                                          matchedDomains.includes('availability') && 
                                          matchedDomains.includes('datetime');
        
        if (isAvailabilityWithDateTime) {
            return false;
        }
        
        // Query requires multi-agent if it has compound indicators or matches multiple unrelated domains
        return hasCompoundIndicator || domainMatches > 1;
    }

    /**
     * Insert reservation into database
     */
    async insertReservation(reservationDetails, restaurantId) {
        try {
            const {
                customer,
                reservation,
                addOns = {},
                transfer = {}
            } = reservationDetails;
            
            const insertQuery = `
                INSERT INTO reservation (
                    reservation_name,
                    reservation_email,
                    reservation_phone,
                    reservation_date,
                    reservation_time,
                    guests,
                    table_type,
                    celebration_type,
                    cake,
                    cake_price,
                    flowers,
                    flowers_price,
                    hotel_name,
                    restaurant_id,
                    created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
                RETURNING reservation_id, created_at;
            `;
            
            const values = [
                customer.name,
                customer.email,
                customer.phone,
                reservation.date,
                reservation.time,
                reservation.partySize,
                reservation.tableType,
                addOns.celebration || 'none',
                addOns.cake || false,
                addOns.cake ? 25.00 : 0,
                addOns.flowers || false,
                addOns.flowers ? 15.00 : 0,
                transfer.hotel || null,
                restaurantId
            ];
            
            const result = await db.query(insertQuery, values);
            console.log('✅ Reservation inserted successfully:', result.rows[0]);
            
            return result.rows[0];
            
        } catch (error) {
            console.error('❌ Database insertion error:', error);
            throw error;
        }
    }

    /**
     * Consolidate multi-agent response
     */
    consolidateMultiAgentResponse(finalResponse, originalMessage) {
        // Extract agent info from delegation chain
        const lastAgent = this.conversationState.delegationChain[this.conversationState.delegationChain.length - 1];
        
        return {
            ...finalResponse,
            // Preserve orchestrator metadata for consistency
            orchestrator: {
                intent: lastAgent?.intent || 'unknown',
                agent: lastAgent?.agent || 'unknown',
                conversationState: this.conversationState,
                timestamp: new Date().toISOString()
            },
            multiAgent: {
                workflow: 'multi-agent',
                delegationChain: this.conversationState.delegationChain,
                originalQuery: originalMessage,
                timestamp: new Date().toISOString()
            }
        };
    }

    /**
     * Coordinate response and handle agent handoffs
     */
    async coordinateResponse(response, intent, agent, restaurantId, originalHistory = []) {
        // Update conversation state with any context returned by the agent
        if (response.data?.reservationContext) {
            console.log('📋 Updating orchestrator context with reservation data');
            this.conversationState.context = {
                ...this.conversationState.context,
                reservationContext: response.data.reservationContext,
                bookingInProgress: true
            };
        }

        // Check if agent suggests handoff to another agent
        if (response.handoff) {
            console.log(`🔄 Agent handoff: ${agent.name} → ${response.handoff.agent}`);
            const nextAgent = this.agents[response.handoff.agent];
            if (nextAgent) {
                // Use original history if handoff history is not provided
                const historyToUse = response.handoff.history || originalHistory;
                return await nextAgent.processMessage(
                    response.handoff.message,
                    historyToUse,
                    response.handoff.restaurantId || restaurantId,
                    { ...this.conversationState.context, ...response.handoff.context }
                );
            }
        }

        // If we have a complete reservation, insert it into database
        if (response.type === 'redirect' && response.data?.reservationDetails) {
            console.log('💾 Inserting reservation into database (single agent)');
            try {
                const insertResult = await this.insertReservation(response.data.reservationDetails, restaurantId);
                response.data.insertResult = insertResult;
                response.data.reservationId = insertResult.reservation_id;
            } catch (error) {
                console.error('❌ Error inserting reservation:', error);
                response.data.insertError = error.message;
            }
        }

        // Add orchestrator metadata
        return {
            ...response,
            orchestrator: {
                intent,
                agent: agent.name,
                conversationState: this.conversationState,
                timestamp: new Date().toISOString()
            }
        };
    }

    /**
     * Get recent conversation context for intent analysis
     */
    getRecentContext(history) {
        if (!history || history.length === 0) return '';
        
        // Get last 3 messages for context
        const recentMessages = history.slice(-3);
        return recentMessages
            .map(msg => {
                // Handle both old format (message/response) and new format (sender/text)
                if (msg.text) {
                    return msg.text;
                } else {
                    return `${msg.message || ''} ${msg.response || ''}`;
                }
            })
            .join(' ')
            .toLowerCase();
    }

    /**
     * Reset conversation state (useful for new conversations)
     */
    resetConversationState() {
        this.conversationState = {
            currentIntent: null,
            activeAgent: null,
            context: {},
            reservationProgress: {}
        };
    }

    /**
     * Handle conversation interruptions and context switches
     */
    handleConversationInterrupt(message, newIntent, history) {
        const currentAgent = this.conversationState.activeAgent;
        
        console.log(`🔄 Conversation interrupt: switching from ${currentAgent} to ${newIntent}`);
        
        // Store the interrupted context for potential resumption
        if (this.conversationState.context.bookingInProgress) {
            this.conversationState.interruptedContext = {
                agent: currentAgent,
                bookingData: { ...this.conversationState.context },
                timestamp: new Date().toISOString(),
                lastMessage: history[history.length - 1]?.text || ''
            };
            
            console.log('💾 Stored interrupted booking context for potential resumption');
        }
        
        // Reset current state but keep interrupted context
        const interruptedContext = this.conversationState.interruptedContext;
        this.resetConversationState();
        this.conversationState.interruptedContext = interruptedContext;
        
        return true;
    }

    /**
     * Check if user wants to resume interrupted context
     */
    checkResumeInterrupted(message) {
        const msg = message.toLowerCase().trim();
        
        // Explicit resume keywords
        const resumeKeywords = [
            'back to booking', 'continue reservation', 'resume booking',
            'go back', 'continue with', 'back to reservation'
        ];
        
        // Simple affirmative responses that indicate wanting to continue
        const affirmativeResponses = [
            'yes', 'yeah', 'yep', 'sure', 'ok', 'okay', 'yes please',
            'yes the reservation', 'the reservation', 'continue', 'proceed'
        ];
        
        // Check if this is likely a continuation request
        const isAffirmative = affirmativeResponses.some(response => {
            if (response === 'yes' || response === 'yeah' || response === 'yep' || response === 'sure' || response === 'ok' || response === 'okay') {
                return msg === response;
            }
            return msg.includes(response);
        });
        
        const hasResumeKeyword = resumeKeywords.some(keyword => msg.includes(keyword));
        
        return hasResumeKeyword || isAffirmative;
    }

    /**
     * Resume interrupted conversation context
     */
    resumeInterruptedContext() {
        if (!this.conversationState.interruptedContext) {
            return false;
        }
        
        console.log('🔄 Resuming interrupted booking context');
        
        // Restore the interrupted context
        this.conversationState.context = {
            ...this.conversationState.interruptedContext.bookingData
        };
        this.conversationState.activeAgent = this.conversationState.interruptedContext.agent;
        
        // Clear the interrupted context
        this.conversationState.interruptedContext = null;
        
        return true;
    }

    /**
     * Get current conversation state (for debugging/monitoring)
     */
    getConversationState() {
        return { ...this.conversationState };
    }
}

export default AgentOrchestrator;