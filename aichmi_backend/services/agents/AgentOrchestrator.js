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
        try {
            // Ensure restaurantId has a default value
            const effectiveRestaurantId = restaurantId || 1;
            console.log(`🏪 Using restaurant ID: ${effectiveRestaurantId} (original: ${restaurantId})`);
            
            // Analyze intent and determine which agent should handle the request
            const intent = await this.determineNextAgent(message, history, effectiveRestaurantId);
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
                effectiveRestaurantId, 
                this.conversationState.context
            );
            
            // Post-process response and handle agent coordination
            return await this.coordinateResponse(response, intent, agent, effectiveRestaurantId, history);
            
        } catch (error) {
            console.error('❌ Single agent workflow error:', error);
            
            // Intelligent fallback: try with reservation agent if other agents fail
            try {
                console.log('🔄 Falling back to reservation agent');
                const reservationAgent = this.agents.reservation;
                
                const fallbackResponse = await reservationAgent.processMessage(
                    message, 
                    history, 
                    effectiveRestaurantId, 
                    { 
                        isMultiAgent: false,
                        orchestrator: this,
                        conversationState: this.conversationState,
                        fallbackMode: true 
                    }
                );
                
                return {
                    ...fallbackResponse,
                    orchestrator: {
                        agent: 'reservation',
                        intent: 'reservation',
                        fallback: true,
                        originalError: error.message
                    }
                };
                
            } catch (fallbackError) {
                console.error('❌ Fallback also failed:', fallbackError);
                
                // Final fallback: simple response
                return {
                    response: "I apologize, but I'm having trouble processing your request. Could you please rephrase your question about the restaurant or reservation?",
                    type: 'message',
                    orchestrator: {
                        agent: 'orchestrator',
                        error: error.message,
                        fallbackError: fallbackError.message
                    }
                };
            }
        }
    }

    /**
     * Handle multi-agent workflow with delegation
     */
    async handleMultiAgentWorkflow(message, history, restaurantId) {
        try {
            console.log('🔄 Starting multi-agent workflow');
            
            // Ensure restaurantId has a default value
            const effectiveRestaurantId = restaurantId || 1;
            console.log(`🏪 Using restaurant ID: ${effectiveRestaurantId} (original: ${restaurantId})`);
            
            // ENHANCED: Check if this is an interruption/context switch during ongoing conversation
            const isContextSwitch = this.conversationState.activeAgent && 
                               this.conversationState.activeAgent !== 'orchestrator';
        
        if (isContextSwitch) {
            console.log(`🔄 Context switch detected from ${this.conversationState.activeAgent}`);
            // Store interrupted context before resetting
            this.handleConversationInterrupt(message, await this.determineNextAgent(message, history, restaurantId), history);
        }
        
        // Start with the primary agent based on intent using new routing system
        const primaryIntent = await this.determineNextAgent(message, history, restaurantId);
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
            currentResponse = await this.processDelegationChain(currentResponse, message, history, effectiveRestaurantId);
        }
        
        // Consolidate multi-agent response
        return this.consolidateMultiAgentResponse(currentResponse, message);
        
        } catch (error) {
            console.error('❌ Multi-agent workflow error:', error);
            
            // Intelligent fallback: try single-agent workflow
            try {
                console.log('🔄 Falling back to single-agent workflow');
                return await this.handleSingleAgentWorkflow(message, history, effectiveRestaurantId);
                
            } catch (fallbackError) {
                console.error('❌ Multi-agent fallback also failed:', fallbackError);
                
                // Final fallback: direct reservation agent
                try {
                    const reservationAgent = this.agents.reservation;
                    const finalFallback = await reservationAgent.processMessage(message, history, effectiveRestaurantId, {
                        isMultiAgent: false,
                        fallbackMode: true,
                        error: error.message
                    });
                    
                    return {
                        ...finalFallback,
                        orchestrator: {
                            agent: 'reservation',
                            multiAgentFallback: true,
                            originalError: error.message
                        }
                    };
                    
                } catch (finalError) {
                    console.error('❌ All fallbacks failed:', finalError);
                    
                    return {
                        response: "I apologize, but I'm experiencing technical difficulties. Could you please try asking about your reservation again?",
                        type: 'message',
                        orchestrator: {
                            agent: 'orchestrator',
                            allFallbacksFailed: true,
                            error: error.message
                        }
                    };
                }
            }
        }
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
     * FLAWLESS AI-FIRST ROUTING SYSTEM
     * Main entry point for determining the next agent using hierarchical logic:
     * 1. High-priority hardcoded rules for direct conversational continuations
     * 2. AI analysis with detailed context understanding 
     * 3. Simple keyword fallback if AI fails
     */
    async determineNextAgent(message, history, restaurantId) {
        try {
            console.log('🧠 AI-first routing: analyzing message and context');
            
            // STEP 1: High-priority hardcoded rules for direct conversational continuations
            const conversationContinuation = this.detectConversationContinuation(message, history);
            if (conversationContinuation) {
                console.log(`🎯 Conversation continuation detected: ${conversationContinuation.agent}`);
                return conversationContinuation.agent;
            }
            
            // STEP 2: Context modification detection (time/date changes in booking flow)
            const contextModification = this.detectContextModification(message, history);
            if (contextModification) {
                console.log(`🧠 Context modification detected: maintaining ${contextModification.maintainAgent}`);
                this.updateContextModification(contextModification);
                return 'availability';
            }
            
            // STEP 3: AI analysis with full context
            const aiIntent = await this.analyzeIntentWithAI(message, history, restaurantId);
            if (aiIntent) {
                console.log(`🤖 AI determined intent: ${aiIntent}`);
                return aiIntent;
            }
            
            // STEP 4: Robust keyword fallback
            const keywordIntent = this.keywordFallbackAnalysis(message);
            console.log(`🔤 Keyword fallback intent: ${keywordIntent}`);
            return keywordIntent;
            
        } catch (error) {
            console.error('❌ Error in determineNextAgent:', error);
            return this.keywordFallbackAnalysis(message);
        }
    }
    
    /**
     * Detect direct conversational continuations (high-priority rules)
     */
    detectConversationContinuation(message, history) {
        const msg = message.toLowerCase().trim();
        
        // Get recent assistant message for context
        const lastAssistantMessage = history
            .filter(m => m.sender === 'ai')
            .slice(-1)[0]?.text?.toLowerCase() || '';
        
        // Rule 1: Table type selection ("Which type would you prefer?")
        if (lastAssistantMessage.includes('which type would you prefer') ||
            lastAssistantMessage.includes('table types available')) {
            const tableTypes = ['standard', 'grass', 'anniversary'];
            if (tableTypes.some(type => msg.includes(type))) {
                return { agent: 'availability', reason: 'table_type_selection' };
            }
        }
        
        // Rule 2: Booking confirmation flow
        if (lastAssistantMessage.includes('please provide') && 
            (lastAssistantMessage.includes('name') || lastAssistantMessage.includes('contact'))) {
            return { agent: 'reservation', reason: 'contact_info_collection' };
        }
        
        // Rule 3: Date/time clarifications in booking context
        const isBookingContext = this.conversationState.context.bookingInProgress ||
                                lastAssistantMessage.includes('available') ||
                                lastAssistantMessage.includes('reservation') ||
                                lastAssistantMessage.includes('what date');
        
        // Check for date responses like "tonight", "tomorrow", "today"
        const dateResponses = ['tonight', 'today', 'tomorrow', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        if (isBookingContext && dateResponses.some(date => msg.includes(date))) {
            return { agent: 'availability', reason: 'date_clarification' };
        }
        
        // Rule 4: Yes/No responses in booking context
        if (isBookingContext && (msg === 'yes' || msg === 'yeah' || msg === 'sure' || msg === 'ok')) {
            // Continue with the same agent type based on context
            return { agent: this.conversationState.activeAgent || 'availability', reason: 'affirmative_response' };
        }
        
        return null;
    }
    
    /**
     * AI-powered intent analysis with full context
     */
    async analyzeIntentWithAI(message, history, restaurantId) {
        try {
            const { askGemini } = await import('../AIService.js');
            
            // Build rich context for AI analysis
            const recentContext = this.getRecentContext(history);
            const conversationState = {
                bookingInProgress: this.conversationState.context.bookingInProgress,
                activeAgent: this.conversationState.activeAgent,
                lastIntent: this.conversationState.currentIntent
            };
            
            const aiPrompt = `You are an expert conversation analyst for a restaurant reservation system. Analyze this message in context and determine the user's primary intent.

CONVERSATION CONTEXT:
${recentContext || 'New conversation'}

CONVERSATION STATE:
- Booking in progress: ${conversationState.bookingInProgress ? 'Yes' : 'No'}
- Last active agent: ${conversationState.activeAgent || 'None'}
- Previous intent: ${conversationState.lastIntent || 'None'}

CURRENT MESSAGE: "${message}"

BUSINESS LOGIC RULES:
1. Any NEW booking request (with date/time/party size) → "availability" (must check availability first)
2. Continuing existing booking process → "reservation"
3. General availability questions → "availability" 
4. Menu/food questions → "menu"
5. Special occasions/celebrations → "celebration"
6. Location/directions/transport → "location"
7. Owner contact/support → "support"
8. General restaurant info → "restaurant"

RETURN ONLY ONE WORD from these valid intents: availability, reservation, menu, celebration, location, support, restaurant`;

            const result = await askGemini(aiPrompt, [], restaurantId);
            const intent = result.response?.toLowerCase().trim();
            
            const validIntents = ['availability', 'reservation', 'menu', 'celebration', 'location', 'support', 'restaurant'];
            
            if (validIntents.includes(intent)) {
                return intent;
            }
            
            console.warn(`🤖 AI returned invalid intent: ${intent}`);
            return null;
            
        } catch (error) {
            console.error('❌ AI intent analysis failed:', error);
            return null;
        }
    }
    
    /**
     * Simple keyword-based fallback analysis
     */
    keywordFallbackAnalysis(message) {
        const msg = message.toLowerCase();
        
        // Availability keywords
        if (msg.includes('available') || msg.includes('do you have') || 
            msg.includes('table for') || msg.includes('book') || msg.includes('reserve')) {
            return 'availability';
        }
        
        // Menu keywords
        if (msg.includes('menu') || msg.includes('food') || msg.includes('dish') || 
            msg.includes('price') || msg.includes('eat')) {
            return 'menu';
        }
        
        // Support keywords
        if (msg.includes('owner') || msg.includes('contact') || msg.includes('phone') || 
            msg.includes('email') || msg.includes('manager')) {
            return 'support';
        }
        
        // Celebration keywords
        if (msg.includes('birthday') || msg.includes('anniversary') || 
            msg.includes('celebration') || msg.includes('romantic')) {
            return 'celebration';
        }
        
        // Location keywords
        if (msg.includes('address') || msg.includes('location') || msg.includes('transfer') || 
            msg.includes('hotel') || msg.includes('pickup')) {
            return 'location';
        }
        
        // Default to restaurant info
        return 'restaurant';
    }
    
    /**
     * Update context with modification data
     */
    updateContextModification(contextModification) {
        this.conversationState.context.modifiedContext = {
            type: contextModification.modificationType,
            newValue: contextModification.newValue,
            originalMessage: contextModification.originalMessage,
            timestamp: new Date().toISOString()
        };
    }
    
    /**
     * Check if user message is a simple modification of existing booking context
     * Returns the agent to maintain and modified context, or null if not a context modification
     */
    /**
     * Check if user message is a simple modification of existing booking context
     * Returns the agent to maintain and modified context, or null if not a context modification
     */
    detectContextModification(message, history) {
        const msg = message.toLowerCase().trim();
        
        // Check if we're in an availability/booking context
        const isInBookingFlow = this.conversationState.context.bookingInProgress || 
                               this.conversationState.context.availabilityInProgress ||
                               this.conversationState.activeAgent === 'TableAvailabilityAgent';
        
        // Only apply this logic if we're in a booking/availability flow
        if (!isInBookingFlow) {
            return null;
        }
        
        // Also check conversation history for availability context
        const recentContext = this.getRecentContext(history);
        const hasAvailabilityContext = recentContext.includes('available') || 
                                     recentContext.includes('table') || 
                                     recentContext.includes('people') ||
                                     recentContext.includes('pm') ||
                                     recentContext.includes('am');
        
        if (!isInBookingFlow && !hasAvailabilityContext) {
            return null;
        }
        
        // Pattern matching for common context modifications
        const contextModifications = {
            time: {
                patterns: [
                    /what about (?:at )?(\d{1,2}(?::\d{2})?\s*(?:pm|am))/i,
                    /how about (?:at )?(\d{1,2}(?::\d{2})?\s*(?:pm|am))/i,
                    /actually (?:at )?(\d{1,2}(?::\d{2})?\s*(?:pm|am))/i,
                    /instead (?:at )?(\d{1,2}(?::\d{2})?\s*(?:pm|am))/i,
                    /^(?:at )?(\d{1,2}(?::\d{2})?\s*(?:pm|am))$/i,
                    /(?:^|\s)(\d{1,2}(?::\d{2})?\s*(?:pm|am))(?:\s|$)/i
                ]
            },
            date: {
                patterns: [
                    /what about (?:on )?(tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
                    /how about (?:on )?(tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
                    /actually (?:on )?(tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
                    /instead (?:on )?(tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i
                ]
            },
            partySize: {
                patterns: [
                    /what about (?:for )?(\d+) (?:people|person|guests?)/i,
                    /how about (?:for )?(\d+) (?:people|person|guests?)/i,
                    /actually (?:for )?(\d+) (?:people|person|guests?)/i,
                    /instead (?:for )?(\d+) (?:people|person|guests?)/i
                ]
            }
        };
        
        // Check each modification type
        for (const [modificationType, { patterns }] of Object.entries(contextModifications)) {
            for (const pattern of patterns) {
                const match = msg.match(pattern);
                if (match) {
                    console.log(`🧠 Context modification detected: ${modificationType} = "${match[1]}"`);
                    
                    return {
                        maintainAgent: 'TableAvailabilityAgent',
                        modificationType,
                        newValue: match[1],
                        originalMessage: message
                    };
                }
            }
        }
        
        return null;
    }

    /**
     * Legacy analyzeIntent function - now delegates to determineNextAgent
     * @deprecated Use determineNextAgent for new implementations
     */
    async analyzeIntent(message, history, restaurantId = null) {
        console.log('⚠️ Using legacy analyzeIntent - consider using determineNextAgent');
        return await this.determineNextAgent(message, history, restaurantId);
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