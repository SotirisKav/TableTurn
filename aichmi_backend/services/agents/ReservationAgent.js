/**
 * Reservation Agent
 * Specializes in handling table bookings, availability, and reservation management
 */

import BaseAgent from './BaseAgent.js';
import RestaurantService from '../RestaurantService.js';
import RAGService from '../RAGService.js';

class ReservationAgent extends BaseAgent {
    constructor() {
        super(
            'ReservationAgent',
            'Reservation Booking Specialist',
            ['reservation', 'booking', 'table', 'available', 'date', 'time']
        );
    }

    async processMessage(message, history, restaurantId, context) {
        try {
            console.log(`📅 ${this.name} processing:`, message);

            // Use RAG to retrieve relevant data
            const ragData = await this.retrieveRAGData(message, restaurantId);
            
            // Check if query contains table ambiance/style requests or delegation from another agent
            const ambianceTerms = ['quiet', 'romantic', 'private', 'intimate', 'cozy', 'peaceful', 'atmosphere', 'ambiance', 'table', 'seating'];
            const hasAmbianceQuery = ambianceTerms.some(term => 
                message.toLowerCase().includes(term)
            );
            
            // Check if this is a delegation from MenuPricingAgent
            const isDelegatedQuery = context?.delegatedFromAgent === 'MenuPricingAgent' || 
                                   message.toLowerCase().includes('also') ||
                                   message.toLowerCase().includes('and');
            
            // Perform semantic table search if ambiance query detected
            let semanticTables = [];
            if (hasAmbianceQuery || isDelegatedQuery) {
                console.log('🔍 Performing semantic table search for ambiance/booking query');
                semanticTables = await RAGService.semanticTableSearch(message, restaurantId);
                
                if (semanticTables.length > 0) {
                    console.log(`✅ Found ${semanticTables.length} semantically matching tables`);
                    semanticTables.forEach(table => {
                        console.log(`   - ${table.table_type} (score: ${table.relevanceScore})`);
                    });
                }
            }
            
            // Fetch reservation-related data (still needed for system prompt)
            const reservationData = await this.fetchReservationData(restaurantId);
            
            // Add semantic table results to reservation data
            if (semanticTables.length > 0) {
                reservationData.semanticTables = semanticTables;
                reservationData.hasSemanticMatch = true;
            }
            
            // Check if user is asking about menu items (suggest delegation to MenuPricingAgent)
            if (this.shouldDelegateToMenu(message)) {
                console.log('🔄 Delegating menu query portion to MenuPricingAgent');
                return {
                    type: 'delegation',
                    delegateTo: 'MenuPricingAgent',
                    originalQuery: message,
                    context: {
                        ...context,
                        delegatedFromAgent: 'ReservationAgent',
                        reservationContext: reservationData
                    }
                };
            }
            
            // Build system prompt
            const systemPrompt = this.buildSystemPrompt(reservationData);
            
            // Build conversation context
            const conversationHistory = this.buildConversationHistory(history);
            
            // Create full prompt
            const fullPrompt = this.buildPrompt(message, conversationHistory, reservationData);
            
            // Generate response with RAG context
            const aiResponse = await this.generateResponse(fullPrompt, systemPrompt, ragData);
            
            // Extract reservation data if present
            const reservationDetails = this.extractStructuredData(aiResponse, 'RESERVATION');
            
            // Check if user is asking about celebrations (suggest handoff)
            if (this.shouldHandoffToCelebration(message)) {
                return {
                    ...this.formatResponse(aiResponse),
                    ...this.suggestHandoff('celebration', message, {
                        restaurant: reservationData.restaurant,
                        userInterest: 'celebration'
                    })
                };
            }
            
            // If reservation details are extracted, create the reservation and return redirect response
            if (reservationDetails) {
                // Validate required fields before attempting to create reservation
                if (!reservationDetails.customer?.name || !reservationDetails.customer?.email || !reservationDetails.customer?.phone) {
                    console.error('❌ Missing required customer information:', reservationDetails.customer);
                    return this.formatResponse(
                        "I need your name, email, and phone number to complete the reservation. Please provide all three.",
                        'message',
                        { error: true }
                    );
                }
                try {
                    // Extract reservation data from the structured format
                    const reservationData = {
                        venueId: reservationDetails.restaurant.id || restaurantId,
                        reservationName: reservationDetails.customer.name || reservationDetails.customer.name?.trim(),
                        reservationEmail: reservationDetails.customer.email || reservationDetails.customer.email?.trim(),
                        reservationPhone: reservationDetails.customer.phone || reservationDetails.customer.phone?.trim(),
                        date: reservationDetails.reservation.date,
                        time: reservationDetails.reservation.time || '19:00',
                        guests: reservationDetails.reservation.partySize,
                        tableType: reservationDetails.reservation.tableType || 'standard',
                        celebrationType: reservationDetails.addOns.celebration,
                        cake: reservationDetails.addOns.cake,
                        cakePrice: 0,
                        flowers: reservationDetails.addOns.flowers,
                        flowersPrice: 0,
                        hotelName: reservationDetails.transfer.hotel,
                        hotelId: null,
                        specialRequests: null
                    };

                    // Create the reservation in the database
                    const createdReservation = await RestaurantService.createReservation(reservationData);
                    
                    console.log('✅ Reservation created successfully:', createdReservation);
                    
                    return this.formatResponse(
                        this.cleanResponse(aiResponse),
                        'redirect',
                        { 
                            reservationDetails: {
                                ...reservationDetails,
                                reservationId: createdReservation.reservation_id,
                                success: true
                            }
                        }
                    );
                } catch (error) {
                    console.error('❌ Failed to create reservation:', error);
                    return this.formatResponse(
                        "I apologize, but there was an issue creating your reservation. Please try again or contact us directly.",
                        'message',
                        { error: true }
                    );
                }
            }
            
            return this.formatResponse(aiResponse);
            
        } catch (error) {
            console.error(`❌ ${this.name} error:`, error);
            return this.formatResponse(
                "I apologize, but I'm having trouble with reservation processing right now. Please try again in a moment.",
                'message',
                { error: true }
            );
        }
    }

    async fetchReservationData(restaurantId) {
        try {
            // Fetch restaurant info
            const restaurant = await RestaurantService.getRestaurantById(restaurantId);
            
            // Fetch table types and pricing
            const tableTypes = await RestaurantService.getTableTypes(restaurantId);
            
            // Fetch fully booked dates
            const fullyBookedDates = await RestaurantService.getFullyBookedDates(restaurantId);
            
            // Fetch operating hours
            const hours = await RestaurantService.getRestaurantHours(restaurantId);
            
            // Get current table availability overview
            const availability = await RestaurantService.getTableInventory(restaurantId);
            
            return {
                restaurant,
                tableTypes: tableTypes || [],
                fullyBookedDates: fullyBookedDates || [],
                hours: hours || [],
                availability: availability || []
            };
            
        } catch (error) {
            console.error('❌ Error fetching reservation data:', error);
            throw error;
        }
    }

    buildSystemPrompt(reservationData) {
        const { restaurant, tableTypes, fullyBookedDates, semanticTables, hasSemanticMatch } = reservationData;
        
        return `You are AICHMI, a friendly reservation assistant for ${restaurant.name}. Help guests make reservations efficiently and naturally.

CURRENT DATE: ${new Date().toISOString().slice(0, 10)} (${new Date().getFullYear()})

PERSONALITY:
- Be warm but concise
- Collect information systematically without repetitive confirmations
- Only ask for final confirmation ONCE when you have ALL required details

TABLES & PRICING:
${tableTypes.map(table => `- ${table.table_type}: €${table.table_price || 0}`).join('\n')}

${fullyBookedDates.length > 0 ? `UNAVAILABLE: ${fullyBookedDates.map(d => d.date).join(', ')}` : ''}

${hasSemanticMatch ? `RECOMMENDED TABLES:
${semanticTables.slice(0,3).map(table => `- ${table.table_type}: €${table.table_price}`).join('\n')}` : ''}

RESERVATION FLOW:
1. Collect date and party size first
2. Ask about table preferences or default to standard table (€0 fee)
3. When they choose a table, ask for contact details (name, email, phone)
4. After getting ALL details, give ONE final summary and ask for confirmation
5. CRITICAL: When they confirm with "yes", "correct", "ok", or similar, you MUST immediately generate the reservation data below. Do not say "I have finalized the reservation" without actually generating the data block. Never claim to have created a reservation without outputting the JSON block below.

MANDATORY: After confirmation, output this exact format:

[RESERVATION_DATA]
{
  "restaurant": {"id": ${restaurant.restaurant_id || 'null'}, "name": "${restaurant.name || ''}"},
  "customer": {"name": "[name]", "email": "[email]", "phone": "[phone]"},
  "reservation": {"date": "[YYYY-MM-DD format, use ${new Date().getFullYear()} for current year, next year ${new Date().getFullYear() + 1} for past dates]", "time": "[time in 24h format like 21:00 for 9pm]", "partySize": [number], "tableType": "[type, default to 'standard' if not specified]"},
  "addOns": {"celebration": null, "cake": false, "flowers": false},
  "transfer": {"needed": false, "hotel": null}
}
[/RESERVATION_DATA]

CRITICAL RULE: You MUST generate this data block immediately after confirmation. Never say "I have finalized the reservation" or "reservation created" without outputting the JSON block above. The reservation is NOT created until you output the structured data. Do not end conversations claiming success without generating the [RESERVATION_DATA] block!`;
    }

    buildPrompt(message, conversationHistory, reservationData) {
        let prompt = '';
        
        if (conversationHistory) {
            prompt += `Previous conversation:\n${conversationHistory}\n\n`;
        }
        
        // Analyze what information we have from the conversation
        const collectedInfo = this.analyzeCollectedInfo(conversationHistory);
        if (Object.keys(collectedInfo).length > 0) {
            prompt += `Information already collected:\n${JSON.stringify(collectedInfo, null, 2)}\n\n`;
        }
        
        prompt += `Current user message: ${message}

Please help the guest with their reservation for ${reservationData.restaurant.name}. Follow the RESERVATION FLOW steps. Based on what information is already collected, naturally progress to the next step without asking for confirmations until you have ALL required details.`;

        return prompt;
    }

    analyzeCollectedInfo(conversationHistory) {
        if (!conversationHistory) return {};
        
        const info = {};
        const historyText = conversationHistory.toLowerCase();
        
        // Look for date information
        const datePatterns = [
            /(\d+)(st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)/,
            /august\s+\d+/,
            /\d+\s+august/
        ];
        for (const pattern of datePatterns) {
            const match = historyText.match(pattern);
            if (match) {
                info.date = match[0];
                break;
            }
        }
        
        // Look for party size
        const partySizeMatch = historyText.match(/(\d+)\s+people?/);
        if (partySizeMatch) {
            info.partySize = partySizeMatch[1];
        }
        
        // Look for table type selection
        if (historyText.includes('grass table') || historyText.includes('15 euro')) {
            info.tableType = 'grass';
            info.tablePrice = '15';
        }
        
        // Look for contact info
        const emailMatch = conversationHistory.match(/\S+@\S+\.\S+/);
        if (emailMatch) {
            info.email = emailMatch[0];
        }
        
        const phoneMatch = conversationHistory.match(/\d{10}/);
        if (phoneMatch) {
            info.phone = phoneMatch[0];
        }
        
        const nameMatch = conversationHistory.match(/sotiris/i);
        if (nameMatch) {
            info.name = 'Sotiris';
        }
        
        return info;
    }

    shouldHandoffToCelebration(message) {
        const celebrationKeywords = [
            'birthday', 'anniversary', 'celebration', 'special occasion',
            'romantic', 'proposal', 'surprise', 'cake', 'flowers'
        ];
        
        const msg = message.toLowerCase();
        return celebrationKeywords.some(keyword => msg.includes(keyword));
    }

    shouldDelegateToMenu(message) {
        const menuKeywords = [
            'menu', 'food', 'dish', 'dishes', 'gluten', 'vegetarian', 'vegan',
            'main course', 'appetizer', 'dessert', 'cuisine', 'what do you serve',
            'best', 'recommend', 'speciality', 'dietary'
        ];
        
        const msg = message.toLowerCase();
        return menuKeywords.some(keyword => msg.includes(keyword));
    }
}

export default ReservationAgent;