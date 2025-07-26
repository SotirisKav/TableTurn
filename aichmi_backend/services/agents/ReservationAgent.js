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

            // Check if this is a direct booking request that needs availability checking
            const isDirectBookingRequest = this.isDirectBookingRequest(message, history);
            let availabilityResult = null;
            
            if (isDirectBookingRequest) {
                // Extract booking details and check availability
                const bookingDetails = this.extractBookingDetails(message, history);
                if (bookingDetails.date && bookingDetails.partySize) {
                    console.log('🔍 Checking availability for direct booking request:', bookingDetails);
                    availabilityResult = await this.checkAvailability(
                        restaurantId, 
                        bookingDetails.date, 
                        bookingDetails.tableType || 'standard'
                    );
                }
            }

            // Use RAG to retrieve relevant data
            const ragData = await this.retrieveRAGData(message, restaurantId);
            
            // Disable semantic table search for basic availability queries
            // Only perform semantic search for very specific ambiance/style requests
            const specificAmbianceTerms = ['romantic', 'private', 'intimate', 'cozy', 'peaceful', 'atmosphere', 'ambiance'];
            const hasSpecificAmbianceQuery = specificAmbianceTerms.some(term => 
                message.toLowerCase().includes(term)
            );
            
            // Check if this is a delegation from MenuPricingAgent with specific context
            const isDelegatedQuery = context?.delegatedFromAgent === 'MenuPricingAgent' && 
                                   (message.toLowerCase().includes('romantic') || message.toLowerCase().includes('ambiance'));
            
            // Only perform semantic table search for specific ambiance queries, not general availability
            let semanticTables = [];
            if (hasSpecificAmbianceQuery || isDelegatedQuery) {
                console.log('🔍 Performing semantic table search for specific ambiance query');
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
            
            // Create full prompt with availability information if available
            const fullPrompt = this.buildPrompt(message, conversationHistory, reservationData, availabilityResult);
            
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
                    }, restaurantId)
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
                    // Map table type to available types
                    const availableTypes = reservationData.tableTypes || [];
                    let mappedTableType = reservationDetails.reservation.tableType || 'standard';
                    
                    // Validate table type exists
                    const tableExists = availableTypes.some(t => t.table_type.toLowerCase() === mappedTableType.toLowerCase());
                    if (!tableExists && mappedTableType !== 'standard') {
                        // Try to map user request to available type
                        mappedTableType = this.mapTableTypeRequest(mappedTableType, availableTypes);
                        console.log(`🔄 Mapped table type "${reservationDetails.reservation.tableType}" to "${mappedTableType}"`);
                    }
                    
                    // Extract reservation data from the structured format
                    const createReservationData = {
                        venueId: reservationDetails.restaurant.id || restaurantId,
                        reservationName: reservationDetails.customer.name || reservationDetails.customer.name?.trim(),
                        reservationEmail: reservationDetails.customer.email || reservationDetails.customer.email?.trim(),
                        reservationPhone: reservationDetails.customer.phone || reservationDetails.customer.phone?.trim(),
                        date: reservationDetails.reservation.date,
                        time: reservationDetails.reservation.time || '19:00',
                        guests: reservationDetails.reservation.partySize,
                        tableType: mappedTableType,
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
                    const createdReservation = await RestaurantService.createReservation(createReservationData);
                    
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

    /**
     * Check availability for a specific date, time, and table type
     */
    async checkAvailability(restaurantId, date, tableType = 'standard') {
        try {
            const available = await RestaurantService.isTableAvailable({
                venueId: restaurantId,
                tableType,
                reservationDate: date
            });
            
            if (!available) {
                // Get count of existing reservations for more informative message
                const reservationCount = await this.getReservationCount(restaurantId, date, tableType);
                
                // Use getTableInventory instead of getTableTypes to get total_tables
                const tableInventory = await RestaurantService.getTableInventory(restaurantId);
                const maxTables = tableInventory.find(t => t.table_type === tableType)?.total_tables || 0;
                
                return {
                    available: false,
                    message: `I'm sorry, but we're fully booked for ${tableType} tables on ${date}. We currently have ${reservationCount} out of ${maxTables} ${tableType} tables reserved. Would you like to try a different date or table type?`,
                    reservationCount,
                    maxTables
                };
            }
            
            return {
                available: true,
                message: `Great news! ${tableType} tables are available on ${date}.`
            };
            
        } catch (error) {
            console.error('❌ Error checking availability:', error);
            return {
                available: false,
                message: "I'm having trouble checking availability right now. Please try again in a moment.",
                error: true
            };
        }
    }
    
    /**
     * Get reservation count for a specific date and table type
     */
    async getReservationCount(restaurantId, date, tableType) {
        try {
            const db = await import('../../database/connection.js');
            const result = await db.default.query(
                'SELECT COUNT(*) as count FROM reservation WHERE restaurant_id = $1 AND table_type = $2 AND reservation_date = $3',
                [restaurantId, tableType, date]
            );
            return parseInt(result[0]?.count || 0);
        } catch (error) {
            console.error('❌ Error getting reservation count:', error);
            return 0;
        }
    }

    buildSystemPrompt(reservationData) {
        const { restaurant, tableTypes, fullyBookedDates, semanticTables, hasSemanticMatch } = reservationData;
        
        // Get available table type names for mapping
        const availableTableNames = tableTypes.map(t => t.table_type).join(', ');
        
        const currentDate = new Date();
        const tomorrow = new Date(currentDate);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        // Calculate next week dates
        const nextWeekStart = new Date(currentDate);
        nextWeekStart.setDate(nextWeekStart.getDate() + 7);
        const nextWeekEnd = new Date(nextWeekStart);
        nextWeekEnd.setDate(nextWeekEnd.getDate() + 6);
        
        // Get all days of next week
        const nextWeekDays = [];
        for (let i = 0; i < 7; i++) {
            const day = new Date(nextWeekStart);
            day.setDate(nextWeekStart.getDate() + i);
            nextWeekDays.push(`${day.toDateString()} (${day.toISOString().slice(0, 10)})`);
        }
        
        return `You are AICHMI, a reservation booking specialist for ${restaurant.name}. Your role is to create confirmed reservations for guests who have already checked availability or know what they want to book.

DATE CONTEXT:
- TODAY: ${currentDate.toDateString()} (${currentDate.toISOString().slice(0, 10)})
- TOMORROW: ${tomorrow.toDateString()} (${tomorrow.toISOString().slice(0, 10)})
- NEXT WEEK DATES: ${nextWeekStart.toDateString()} to ${nextWeekEnd.toDateString()}
- Next Week Days Available:
  ${nextWeekDays.map((day, i) => `  ${i === 0 ? 'Monday' : i === 1 ? 'Tuesday' : i === 2 ? 'Wednesday' : i === 3 ? 'Thursday' : i === 4 ? 'Friday' : i === 5 ? 'Saturday' : 'Sunday'}: ${day}`).join('\n  ')}
- Current Year: ${currentDate.getFullYear()}

PERSONALITY:
- Be efficient and focused on completing reservations
- Collect information systematically without repetitive confirmations
- Only ask for final confirmation ONCE when you have ALL required details
- Assume guests have already checked availability unless they specifically ask about it

AVAILABLE TABLE TYPES & PRICING:
${tableTypes.map(table => `- ${table.table_type}: €${table.table_price || 0}`).join('\n')}

IMPORTANT TABLE TYPE MAPPING:
- When users ask for "table with a view", "outdoor", "outside" → use available types: ${availableTableNames}
- When users ask for "standard", "regular", "inside" → use first available standard type
- ONLY use table types that exist in the list above
- If user request doesn't match exactly, choose the closest available type

${fullyBookedDates.length > 0 ? `UNAVAILABLE DATES: ${fullyBookedDates.map(d => d.date).join(', ')}` : ''}

${hasSemanticMatch ? `RECOMMENDED TABLES:
${semanticTables.slice(0,3).map(table => `- ${table.table_type}: €${table.table_price}`).join('\n')}` : ''}

RESERVATION BOOKING PROTOCOL:
1. **AVAILABILITY CHECK FIRST**: When users make direct booking requests with specific date/time/party size, IMMEDIATELY check availability
2. If available, proceed to collect any missing details (table preference, contact info)
3. If NOT available, provide specific unavailability information and suggest alternatives
4. Collect contact details (name, email, phone) only AFTER confirming availability
5. Provide final summary and ask for confirmation
6. Create the reservation upon confirmation

RESERVATION FLOW:
1. **Direct booking requests**: When user says "I want to book/reserve..." with date/time/party size → CHECK AVAILABILITY FIRST
2. If coming from availability agent handoff, first confirm if they want to proceed with booking before collecting details
3. If starting fresh, collect: date, time, party size, then CHECK AVAILABILITY before proceeding
4. Only after confirming availability AND booking intent, collect: table preference and contact details (name, email, phone)
5. After getting ALL details, give ONE final summary and ask for confirmation
6. CRITICAL: When they confirm with "yes", "correct", "ok", or similar, you MUST immediately generate the reservation data below. Do not say "I have finalized the reservation" without actually generating the data block. Never claim to have created a reservation without outputting the JSON block below.

AVAILABILITY CHECKING:
- When checking availability, the system will provide table availability information in your context
- If unavailable, provide specific information (e.g., "We have 5 out of 5 standard tables already reserved for that date")
- Suggest alternative dates or table types when unavailable
- Never proceed with contact collection if the requested slot is unavailable

MANDATORY: After confirmation, output this exact format:

[RESERVATION_DATA]
{
  "restaurant": {"id": ${restaurant.restaurant_id || 'null'}, "name": "${restaurant.name || ''}"},
  "customer": {"name": "[name]", "email": "[email]", "phone": "[phone]"},
  "reservation": {"date": "[YYYY-MM-DD format, use ${new Date().getFullYear()} for current year, next year ${new Date().getFullYear() + 1} for past dates]", "time": "[time in 24h format like 21:00 for 9pm]", "partySize": [number], "tableType": "[MUST be one of: ${availableTableNames}]"},
  "addOns": {"celebration": null, "cake": false, "flowers": false},
  "transfer": {"needed": false, "hotel": null}
}
[/RESERVATION_DATA]

CRITICAL RULE: You MUST generate this data block immediately after confirmation. Never say "I have finalized the reservation" or "reservation created" without outputting the JSON block above. The reservation is NOT created until you output the structured data. Do not end conversations claiming success without generating the [RESERVATION_DATA] block!`;
    }

    // Map user-friendly table requests to actual table types
    mapTableTypeRequest(userRequest, availableTypes) {
        const lowerRequest = userRequest.toLowerCase();
        
        // Create mapping based on keywords and available types
        const mapping = {
            'view': ['terrace', 'outdoor', 'garden', 'grass', 'balcony'],
            'outside': ['terrace', 'outdoor', 'garden', 'grass', 'balcony'],
            'outdoor': ['terrace', 'outdoor', 'garden', 'grass', 'balcony'],
            'garden': ['garden', 'grass', 'terrace', 'outdoor'],
            'terrace': ['terrace', 'garden', 'grass', 'outdoor'],
            'inside': ['standard', 'indoor', 'regular'],
            'indoor': ['standard', 'indoor', 'regular'],
            'regular': ['standard', 'regular', 'normal'],
            'standard': ['standard', 'regular', 'normal'],
            'private': ['private', 'vip', 'reserved'],
            'romantic': ['romantic', 'private', 'intimate', 'grass', 'garden'],
            'quiet': ['private', 'intimate', 'corner', 'grass', 'garden']
        };
        
        // Find best match
        for (const [keyword, candidates] of Object.entries(mapping)) {
            if (lowerRequest.includes(keyword)) {
                // Return first available candidate type
                for (const candidate of candidates) {
                    if (availableTypes.some(t => t.table_type.toLowerCase() === candidate)) {
                        return availableTypes.find(t => t.table_type.toLowerCase() === candidate).table_type;
                    }
                }
            }
        }
        
        // Default fallback - return first available type or 'standard'
        return availableTypes.length > 0 ? availableTypes[0].table_type : 'standard';
    }

    buildPrompt(message, conversationHistory, reservationData, availabilityResult = null) {
        let prompt = '';
        
        if (conversationHistory) {
            prompt += `Previous conversation:\n${conversationHistory}\n\n`;
        }
        
        // Include availability check results if available
        if (availabilityResult) {
            prompt += `AVAILABILITY CHECK RESULT:\n`;
            if (availabilityResult.available) {
                prompt += `✅ AVAILABLE: ${availabilityResult.message}\n\n`;
            } else {
                prompt += `❌ NOT AVAILABLE: ${availabilityResult.message}\n`;
                prompt += `You must inform the guest about unavailability and suggest alternatives. Do not proceed with contact collection.\n\n`;
            }
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

    /**
     * Check if this is a direct booking request that needs availability checking
     */
    isDirectBookingRequest(message, history) {
        const directBookingKeywords = [
            'i want to book', 'i want to reserve', 'i\'d like to book', 'i\'d like to reserve',
            'can you book', 'can you reserve', 'book a table', 'reserve a table',
            'make a reservation', 'book me a', 'reserve me a'
        ];
        
        const msg = message.toLowerCase();
        const hasBookingKeyword = directBookingKeywords.some(keyword => msg.includes(keyword));
        
        // Also check if message contains date/time information
        const hasDateTimeInfo = /tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d+pm|\d+am|\d+:\d+/.test(msg);
        
        // Check if we're not coming from availability agent (no handoff context)
        const isFromAvailabilityAgent = history.some(h => 
            h.text && h.text.includes('Would you like to proceed with making a reservation'));
        
        return hasBookingKeyword && hasDateTimeInfo && !isFromAvailabilityAgent;
    }

    /**
     * Extract booking details from message and history
     */
    extractBookingDetails(message, history) {
        const msg = message.toLowerCase();
        const fullText = (history.map(h => h.text || '').join(' ') + ' ' + message).toLowerCase();
        
        const details = {};
        
        // Extract date
        if (msg.includes('tomorrow')) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            details.date = tomorrow.toISOString().slice(0, 10);
        } else if (msg.includes('today')) {
            details.date = new Date().toISOString().slice(0, 10);
        }
        
        // Extract party size
        const partySizeMatch = fullText.match(/(\d+)\s*(people|person|guests?|party)/);
        if (partySizeMatch) {
            details.partySize = parseInt(partySizeMatch[1]);
        }
        
        // Extract table type
        if (msg.includes('anniversary')) details.tableType = 'anniversary';
        else if (msg.includes('grass')) details.tableType = 'grass';
        else if (msg.includes('standard')) details.tableType = 'standard';
        
        return details;
    }
}

export default ReservationAgent;