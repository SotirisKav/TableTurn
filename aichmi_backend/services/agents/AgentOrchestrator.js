/**
 * Agent Orchestrator - Multi-Agent Conversation Manager
 * Coordinates between specialized agents for restaurant reservations
 */

import RestaurantInfoAgent from './RestaurantInfoAgent.js';
import ReservationAgent from './ReservationAgent.js';
import TableAvailabilityAgent from './TableAvailabilityAgent.js';
import MenuPricingAgent from './MenuPricingAgent.js';
import LocationTransferAgent from './LocationTransferAgent.js';
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
            location: new LocationTransferAgent(),
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
    async processMessage(message, history, restaurantId) {
        try {
            console.log('🎭 Agent Orchestrator processing:', message);
            
            // Reset delegation chain for new messages
            this.conversationState.delegationChain = [];
            this.conversationState.finalResponse = null;
            
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
                type: 'message',
                response: 'I apologize, but I encountered an issue. Please try again or contact our support team.',
                timestamp: new Date().toISOString(),
                agent: 'orchestrator',
                error: true
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
        return await this.coordinateResponse(response, intent, agent, restaurantId);
    }

    /**
     * Handle multi-agent workflow with delegation
     */
    async handleMultiAgentWorkflow(message, history, restaurantId) {
        console.log('🔄 Starting multi-agent workflow');
        
        // Start with the primary agent based on intent
        const primaryIntent = await this.analyzeIntent(message, history);
        const primaryAgent = this.selectAgent(primaryIntent);
        
        console.log(`🎯 Primary agent: ${primaryAgent.name} (intent: ${primaryIntent})`);
        
        // Track delegation chain
        this.conversationState.delegationChain.push({
            agent: primaryAgent.name,
            intent: primaryIntent,
            timestamp: new Date().toISOString()
        });
        
        // Process with primary agent
        let currentResponse = await primaryAgent.processMessage(
            message,
            history,
            restaurantId,
            this.conversationState.context
        );
        
        // Handle delegation workflow
        return await this.processDelegationChain(currentResponse, message, history, restaurantId);
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
     * Analyze user intent using keyword matching and context
     */
    async analyzeIntent(message, history) {
        const msg = message.toLowerCase();
        
        // High priority availability keywords that should immediately route to availability agent
        const highPriorityAvailabilityKeywords = ['biggest', 'largest', 'capacity', 'maximum', 'what tables'];
        const hasHighPriorityAvailability = highPriorityAvailabilityKeywords.some(keyword => msg.includes(keyword));
        
        if (hasHighPriorityAvailability) {
            console.log('🎯 High priority availability keyword detected, routing to availability agent');
            return 'availability';
        }
        
        // Check recent conversation context for ongoing reservation
        const conversationContext = this.getRecentContext(history);
        const isReservationFlow = conversationContext.includes('booking') || 
                                 conversationContext.includes('book it') || 
                                 conversationContext.includes('make reservation') ||
                                 conversationContext.includes('proceed with') ||
                                 conversationContext.includes('finalize') ||
                                 conversationContext.includes('party size') ||
                                 this.conversationState.context.bookingInProgress;
        
        // If we're in a reservation flow, prioritize reservation intent
        if (isReservationFlow) {
            // Check for confirmation responses and reservation-related keywords
            const confirmationKeywords = ['yes', 'correct', 'ok', 'okay', 'sure', 'confirm', 'book it', 'go ahead', 'that works'];
            const reservationKeywords = ['book', 'reserve', 'booking', 'make reservation', 'standard', 'grass', 'anniversary', 'fee', 'price', 'euros', 'confirm', '@', 'email', 'phone', 'name'];
            
            const hasConfirmation = confirmationKeywords.some(keyword => msg.includes(keyword));
            const hasReservationKeyword = reservationKeywords.some(keyword => msg.includes(keyword));
            
            // In reservation flow, also treat simple numeric responses, table types, and common responses as reservation intent
            const isNumericResponse = /^\d+$/.test(msg.trim());
            const isTableType = ['standard', 'grass', 'anniversary'].includes(msg.trim());
            const isSimpleResponse = msg.trim().length <= 15 && !msg.includes(' ');
            
            if (hasConfirmation || hasReservationKeyword || isNumericResponse || isTableType || isSimpleResponse || /(\\d+|august|july|september|january|february|march|april|may|june|october|november|december|\\d+\\s*(pm|am)|party|people|guests|email|phone|@)/i.test(message)) {
                return 'reservation';
            }
        }
        
        // High priority keywords that should override general patterns
        if (msg.includes('owner') || msg.includes('manager') || msg.includes('contact')) {
            return 'support';
        }
        
        // Intent patterns with priority order
        const intentPatterns = {
            availability: [
                'available', 'availability', 'check', 'biggest', 'largest', 'capacity', 'maximum',
                'what tables', 'table options', 'accommodate', 'fit', 'seat', 'seating', 'how many',
                'big table', 'large table', 'size', 'what size', 'table types', 'options'
            ],
            reservation: [
                'book', 'reserve', 'reservation', 'reserv', 'booking', 'resrrvation', 'make reservation',
                'want to book', 'proceed', 'go ahead', 'confirm', 'finalize', 'yes please', 'book it',
                'reserve it', 'let me book', 'i want to reserve'
            ],
            datetime: [
                'date', 'time', 'tomorrow', 'today', 'day', 'what day', 'when', 'monday', 'tuesday', 
                'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'next week', 'next month'
            ],
            menu: [
                'menu', 'dish', 'food', 'eat', 'price', 'cost', 'order', 'meal',
                'vegetarian', 'vegan', 'gluten', 'diet', 'cuisine', 'speciality'
            ],
            celebration: [
                'birthday', 'anniversary', 'celebration', 'special', 'occasion',
                'cake', 'flower', 'surprise', 'romantic', 'proposal'
            ],
            location: [
                'location', 'address', 'transfer', 'transport', 'pickup',
                'airport', 'hotel', 'directions', 'how to get', 'where'
            ],
            support: [
                'help', 'phone', 'email', 'problem', 'issue', 'complaint', 'question'
            ],
            restaurant: [
                'about', 'info', 'hours', 'open', 'close', 'atmosphere',
                'style', 'rating', 'review', 'description'
            ]
        };

        // Check recent conversation context
        const recentContext = this.getRecentContext(history);
        
        // Score each intent based on keyword matches
        const intentScores = {};
        for (const [intent, keywords] of Object.entries(intentPatterns)) {
            intentScores[intent] = keywords.reduce((score, keyword) => {
                if (msg.includes(keyword)) {
                    score += 1;
                    // Boost score if keyword appears in recent context
                    if (recentContext.includes(keyword)) score += 0.5;
                }
                return score;
            }, 0);
        }

        // Return the intent with highest score, default to restaurant info
        const topIntent = Object.entries(intentScores)
            .sort(([,a], [,b]) => b - a)[0];
        
        return topIntent[1] > 0 ? topIntent[0] : 'restaurant';
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
        const isNumericResponse = /^\d+$/.test(msg.trim());
        const isTableType = ['standard', 'grass', 'anniversary'].includes(msg.trim());
        
        if (isSimpleResponse || isNumericResponse || isTableType) {
            return false;
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
            location: ['transfer', 'hotel', 'pickup', 'airport']
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
    async coordinateResponse(response, intent, agent, restaurantId) {
        // Check if agent suggests handoff to another agent
        if (response.handoff) {
            console.log(`🔄 Agent handoff: ${agent.name} → ${response.handoff.agent}`);
            const nextAgent = this.agents[response.handoff.agent];
            if (nextAgent) {
                return await nextAgent.processMessage(
                    response.handoff.message,
                    response.handoff.history || [],
                    response.handoff.restaurantId,
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
     * Get current conversation state (for debugging/monitoring)
     */
    getConversationState() {
        return { ...this.conversationState };
    }
}

export default AgentOrchestrator;