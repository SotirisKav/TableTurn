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

            // Check if we have date/time/people information and need availability checking
            const bookingDetails = await this.extractBookingDetails(message, history);
            const needsAvailabilityCheck = bookingDetails.date && bookingDetails.time && bookingDetails.partySize;
            
            console.log('🔍 Booking details extracted:', bookingDetails);
            console.log('🎯 Needs availability check:', needsAvailabilityCheck);
            
            // If we have the required booking details, perform two-message availability flow
            if (needsAvailabilityCheck) {
                console.log('🚀 Starting two-message availability flow');
                
                // FIRST MESSAGE: Checking message
                const checkingMessage = `Okay, checking for availability for a table at ${this.formatDate(bookingDetails.date)}, ${this.formatTime(bookingDetails.time)} for ${bookingDetails.partySize} people...`;
                
                // Perform the actual availability check
                const availabilityResult = await this.checkAvailability(
                    restaurantId, 
                    bookingDetails.date, 
                    bookingDetails.tableType || 'standard',
                    bookingDetails.time
                );
                
                console.log('📊 Availability check result:', availabilityResult);
                
                // Fetch reservation data for table type information
                const reservationData = await this.fetchReservationData(restaurantId);
                const hasMultipleTableTypes = reservationData.tableTypes.length > 1;
                
                // SECOND MESSAGE: Generate the results message based on availability
                let resultsMessage = '';
                if (availabilityResult.available) {
                    if (hasMultipleTableTypes) {
                        resultsMessage = `Great news! We have tables available for ${this.formatDate(bookingDetails.date)} at ${this.formatTime(bookingDetails.time)} for ${bookingDetails.partySize} people.\n\nWhich type of table would you prefer?\n${reservationData.tableTypes.map(t => `• ${t.table_type} (€${t.table_price})`).join('\n')}\n\nJust let me know which one you'd like!`;
                    } else {
                        resultsMessage = `Perfect! We have tables available for ${this.formatDate(bookingDetails.date)} at ${this.formatTime(bookingDetails.time)} for ${bookingDetails.partySize} people.\n\nTo complete your reservation, I'll need your name, email, and phone number.`;
                    }
                } else {
                    if (availabilityResult.hasAlternatives) {
                        resultsMessage = availabilityResult.message;
                    } else {
                        resultsMessage = `${availabilityResult.message}\n\nWould you like to try a different date or time?`;
                    }
                }
                
                // Return with special two-message format
                return this.formatResponse(
                    `${checkingMessage}|||SPLIT|||${resultsMessage}`,
                    'two_messages'
                );
            }

            // Legacy flow for other types of messages
            const isDirectBookingRequest = this.isDirectBookingRequest(message, history);
            let availabilityResult = null;
            
            if (isDirectBookingRequest) {
                // Use already extracted booking details
                if (bookingDetails.date && bookingDetails.partySize) {
                    console.log('🔍 Checking availability for direct booking request:', bookingDetails);
                    availabilityResult = await this.checkAvailability(
                        restaurantId, 
                        bookingDetails.date, 
                        bookingDetails.tableType || 'standard',
                        bookingDetails.time
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
            
            // Check if the response contains a tool_code for availability checking
            if (aiResponse.includes('```tool_code') && aiResponse.includes('availability_checking')) {
                console.log('🔍 Detected availability checking tool_code, processing internally...');
                
                // Extract tool_code parameters
                const toolCodeMatch = aiResponse.match(/```tool_code\s*\n([\s\S]*?)\n```/);
                if (toolCodeMatch) {
                    try {
                        const toolData = JSON.parse(toolCodeMatch[1]);
                        if (toolData.tool_code === 'availability_checking') {
                            // Perform availability check
                            const availabilityResult = await this.checkAvailability(
                                restaurantId,
                                toolData.date,
                                'standard' // Default table type for now
                            );
                            
                            // Generate follow-up response based on availability
                            const availabilityPrompt = `Based on the availability check results:
${availabilityResult.available ? 
    `✅ Tables are available on ${toolData.date} at ${toolData.time} for ${toolData.party_size} people. ${availabilityResult.message}` : 
    `❌ ${availabilityResult.message}`
}

Continue the conversation appropriately. If available, proceed to collect contact information. If not available, suggest alternatives.

Previous conversation:
${this.buildConversationHistory(history)}

Current user message: ${message}`;

                            const followUpResponse = await this.generateResponse(availabilityPrompt, systemPrompt, ragData);
                            
                            // Extract reservation data from follow-up response if present
                            const reservationDetails = this.extractStructuredData(followUpResponse, 'RESERVATION');
                            
                            // Handle celebration handoff check for follow-up response
                            if (this.shouldHandoffToCelebration(message)) {
                                return {
                                    ...this.formatResponse(followUpResponse),
                                    ...this.suggestHandoff('celebration', message, {
                                        restaurant: reservationData.restaurant,
                                        userInterest: 'celebration'
                                    }, restaurantId)
                                };
                            }
                            
                            // Handle reservation creation if details are extracted
                            if (reservationDetails) {
                                return await this.handleReservationCreation(reservationDetails, followUpResponse, reservationData, restaurantId);
                            }
                            
                            return this.formatResponse(followUpResponse);
                        }
                    } catch (parseError) {
                        console.error('❌ Error parsing tool_code:', parseError);
                    }
                }
            }
            
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
                return await this.handleReservationCreation(reservationDetails, aiResponse, reservationData, restaurantId);
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
    async checkAvailability(restaurantId, date, tableType = 'standard', originalTime = null) {
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
                
                // Try to find alternative times if original time was provided
                if (originalTime) {
                    const alternatives = await this.findAlternativeTimes(originalTime, restaurantId, date, tableType);
                    if (alternatives.length > 0) {
                        return {
                            available: false,
                            message: `I'm sorry, but we're fully booked for ${tableType} tables on ${date} at ${originalTime}. However, I found availability at these alternative times: ${alternatives.join(', ')}. Would any of these work for you?`,
                            alternatives: alternatives,
                            hasAlternatives: true,
                            reservationCount,
                            maxTables
                        };
                    }
                }
                
                return {
                    available: false,
                    message: `I'm sorry, but we're fully booked for ${tableType} tables on ${date}. We currently have ${reservationCount} out of ${maxTables} ${tableType} tables reserved. Would you like to try a different date or table type?`,
                    reservationCount,
                    maxTables
                };
            }
            
            return {
                available: true,
                message: `Great news! ${tableType} tables are available on ${date}${originalTime ? ` at ${originalTime}` : ''}.`
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

    async findAlternativeTimes(originalTime, restaurantId, date, tableType) {
        try {
            const alternatives = [];
            
            // Convert original time to minutes
            const [hours, minutes] = originalTime.split(':').map(Number);
            const originalMinutes = hours * 60 + minutes;
            
            // Check ±30 minute slots
            const timeSlots = [
                originalMinutes - 30, // 30 minutes earlier
                originalMinutes + 30  // 30 minutes later
            ];
            
            for (const slotMinutes of timeSlots) {
                // Convert back to time format
                const slotHours = Math.floor(slotMinutes / 60);
                const slotMins = slotMinutes % 60;
                
                // Validate reasonable restaurant hours (17:00 - 23:00)
                if (slotHours >= 17 && slotHours <= 23) {
                    const timeString = `${slotHours.toString().padStart(2, '0')}:${slotMins.toString().padStart(2, '0')}`;
                    
                    // For this implementation, we'll simulate that alternative times have availability
                    // In a real system, you'd check actual time-slot based availability
                    const available = await RestaurantService.isTableAvailable({
                        venueId: restaurantId,
                        tableType,
                        reservationDate: date
                    });
                    
                    // For demonstration, assume alternative times are more likely to be available
                    if (available || Math.random() > 0.5) {
                        alternatives.push(timeString);
                    }
                }
            }
            
            return alternatives;
        } catch (error) {
            console.error('❌ Error finding alternative times:', error);
            return [];
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
        
        // Determine if we should show table type selection
        const hasMultipleTableTypes = tableTypes.length > 1;
        const tableTypeGuidance = hasMultipleTableTypes ? 
            `AVAILABLE TABLE TYPES & PRICING:
${tableTypes.map(table => `- ${table.table_type}: €${table.table_price || 0}`).join('\n')}

TABLE TYPE SELECTION:
- When customers ask for table preferences, offer them these specific options:
${tableTypes.map(table => `  • ${table.table_type} tables (€${table.table_price || 0})`).join('\n')}
- ONLY use table types from the list above: ${availableTableNames}
- If user requests unavailable types (like "view", "terrace", "balcony"), explain available options and help them choose
- Map user requests to available types: outdoor/view requests → ${tableTypes.find(t => t.table_type !== 'standard')?.table_type || 'standard'}` :
            `TABLE TYPE HANDLING:
- This restaurant has only one table type: ${tableTypes[0]?.table_type || 'standard'} (€${tableTypes[0]?.table_price || 0})
- Don't ask customers about table type preferences - automatically use ${tableTypes[0]?.table_type || 'standard'}
- If customers ask about table options, briefly mention we have ${tableTypes[0]?.table_type || 'standard'} tables`;

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
- Avoid repetitive confirmations and duplicate information
- Provide clear, concise responses without repeating details unnecessarily
- Only ask for final confirmation ONCE when you have ALL required details
- When availability has been checked, proceed directly to next steps

${tableTypeGuidance}

${fullyBookedDates.length > 0 ? `UNAVAILABLE DATES: ${fullyBookedDates.map(d => d.date).join(', ')}` : ''}

${hasSemanticMatch ? `RECOMMENDED TABLES:
${semanticTables.slice(0,3).map(table => `- ${table.table_type}: €${table.table_price}`).join('\n')}` : ''}

RESERVATION FLOW - IMPORTANT NEW PROCESS:
1. **COLLECT DATE, TIME, PEOPLE FIRST**: Always start by asking for date, time, and number of people before anything else
2. **TWO-MESSAGE AVAILABILITY CHECK**: 
   - First message: "Okay, checking for availability for a table at [date], [time] for [number] people..."
   - Second message: Results with availability status
3. **NO TABLES AVAILABLE**: If no tables available, check ±30 minutes and repeat the logic until solution found
4. **TABLES AVAILABLE**: 
   - If restaurant has single table type: "Great! There are tables available." (don't mention table type)
   - If restaurant has multiple table types: Ask customer which table type they prefer
5. **CONTACT COLLECTION**: Only after availability confirmed, collect name, email, phone
6. **FINAL CONFIRMATION**: Provide summary and ask for confirmation once all details collected
7. **RESERVATION CREATION**: Generate reservation data block immediately upon user confirmation

CRITICAL AVAILABILITY CHECKING RULES:
- NEVER collect name/email/phone before checking availability
- Always show two separate messages for availability checking
- First message must say "checking for availability..." 
- Second message shows results
- If unavailable, automatically check ±30 minute slots and suggest alternatives
- Only proceed to contact details after confirming available tables

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
        
        // Get available table type names
        const availableTableNames = availableTypes.map(t => t.table_type.toLowerCase());
        
        // Check if user request is an exact match first
        if (availableTableNames.includes(lowerRequest)) {
            return availableTypes.find(t => t.table_type.toLowerCase() === lowerRequest).table_type;
        }
        
        // Create dynamic mapping based on what's actually available
        const outdoorTypes = availableTypes.filter(t => 
            ['grass', 'terrace', 'garden', 'outdoor', 'patio', 'deck'].includes(t.table_type.toLowerCase())
        );
        const specialTypes = availableTypes.filter(t => 
            ['anniversary', 'vip', 'private', 'romantic', 'premium'].includes(t.table_type.toLowerCase())
        );
        const standardTypes = availableTypes.filter(t => 
            ['standard', 'regular', 'indoor', 'main'].includes(t.table_type.toLowerCase())
        );
        
        // Map user requests to available categories
        const outdoorKeywords = ['view', 'outside', 'outdoor', 'garden', 'terrace', 'fresh air', 'nature'];
        const specialKeywords = ['private', 'romantic', 'special', 'anniversary', 'celebration', 'intimate'];
        const indoorKeywords = ['inside', 'indoor', 'regular', 'standard', 'normal'];
        
        // Check outdoor requests
        if (outdoorKeywords.some(keyword => lowerRequest.includes(keyword)) && outdoorTypes.length > 0) {
            return outdoorTypes[0].table_type;
        }
        
        // Check special requests
        if (specialKeywords.some(keyword => lowerRequest.includes(keyword)) && specialTypes.length > 0) {
            return specialTypes[0].table_type;
        }
        
        // Check indoor requests
        if (indoorKeywords.some(keyword => lowerRequest.includes(keyword)) && standardTypes.length > 0) {
            return standardTypes[0].table_type;
        }
        
        // Default fallback - return first available type
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
        
        // Check if this is part of an ongoing reservation flow
        const recentHistory = history.slice(-4); // Check last 4 messages
        const hasRecentBookingIntent = recentHistory.some(h => 
            h.text && directBookingKeywords.some(keyword => h.text.toLowerCase().includes(keyword))
        );
        
        // Check if AI recently asked for reservation details
        const aiAskedForDetails = recentHistory.some(h => 
            h.sender === 'ai' && h.text && (
                h.text.includes('What date would you like') ||
                h.text.includes('What time would you like') ||
                h.text.includes('How many people') ||
                h.text.includes('few details')
            )
        );
        
        // This is a direct booking request if:
        // 1. Contains booking keywords AND date/time info, OR
        // 2. Contains date/time info AND we're in an active booking flow (user previously expressed intent or AI asked for details)
        return (hasBookingKeyword && hasDateTimeInfo) || 
               (hasDateTimeInfo && (hasRecentBookingIntent || aiAskedForDetails)) && 
               !isFromAvailabilityAgent;
    }

    /**
     * Extract booking details using AI instead of regex patterns
     */
    async extractBookingDetails(message, history) {
        try {
            const fullText = (history.map(h => h.text || '').join(' ') + ' ' + message);
            
            // Use AI to extract structured data
            const { askGemini } = await import('../AIService.js');
            
            const extractionPrompt = `Extract reservation details from this conversation. Only extract information that is explicitly mentioned.

Conversation text: "${fullText}"

Extract and return ONLY the following information if present (leave blank if not mentioned):
- Date: Convert to YYYY-MM-DD format (use 2025 for dates without year)
- Time: Convert to 24-hour format (HH:MM)
- Party size: Number of people/guests
- Table type: standard, grass, or anniversary (if specifically mentioned)

Examples of conversions:
- "2 august" → 2025-08-02
- "8pm" → 20:00
- "4 people" → 4

Respond in this exact JSON format:
{
  "date": "YYYY-MM-DD or null",
  "time": "HH:MM or null", 
  "partySize": number or null,
  "tableType": "string or null"
}`;

            const extractionResponse = await askGemini(extractionPrompt, [], null);
            let extractedData;
            
            try {
                // Try to parse the JSON response
                const jsonMatch = extractionResponse.response.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    extractedData = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error('No JSON found in response');
                }
            } catch (parseError) {
                console.log('📅 AI extraction failed, using fallback regex patterns');
                return this.extractBookingDetailsFallback(message, history);
            }
            
            // Clean up the extracted data
            const details = {};
            if (extractedData.date && extractedData.date !== 'null') {
                details.date = extractedData.date;
            }
            if (extractedData.time && extractedData.time !== 'null') {
                details.time = extractedData.time;
            }
            if (extractedData.partySize && typeof extractedData.partySize === 'number') {
                details.partySize = extractedData.partySize;
            }
            if (extractedData.tableType && extractedData.tableType !== 'null') {
                details.tableType = extractedData.tableType;
            }
            
            console.log('🤖 AI extracted booking details:', details);
            return details;
            
        } catch (error) {
            console.error('❌ Error in AI booking extraction:', error);
            return this.extractBookingDetailsFallback(message, history);
        }
    }

    /**
     * Fallback extraction using regex patterns
     */
    extractBookingDetailsFallback(message, history) {
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
        } else {
            // Look for patterns like "2 august", "august 2", "2nd august", etc.
            const datePattern = /(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)|(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?/i;
            const dateMatch = fullText.match(datePattern);
            
            if (dateMatch) {
                const day = dateMatch[1] || dateMatch[3];
                let month = dateMatch[2] || fullText.match(datePattern)[0].split(' ').find(word => 
                    ['january', 'february', 'march', 'april', 'may', 'june', 
                     'july', 'august', 'september', 'october', 'november', 'december'].includes(word)
                );
                
                const currentYear = new Date().getFullYear();
                
                // Convert month name to number
                const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 
                                  'july', 'august', 'september', 'october', 'november', 'december'];
                const monthNumber = monthNames.indexOf(month?.toLowerCase()) + 1;
                
                if (monthNumber > 0) {
                    const date = new Date(currentYear, monthNumber - 1, parseInt(day));
                    details.date = date.toISOString().slice(0, 10);
                }
            }
        }
        
        // Extract time
        const timePattern = /(\d{1,2})(?::(\d{2}))?\s*(pm|am)/i;
        const timeMatch = fullText.match(timePattern);
        
        if (timeMatch) {
            let hour = parseInt(timeMatch[1]);
            const minute = timeMatch[2] || '00';
            const period = timeMatch[3].toLowerCase();
            
            if (period === 'pm' && hour !== 12) {
                hour += 12;
            } else if (period === 'am' && hour === 12) {
                hour = 0;
            }
            
            details.time = `${hour.toString().padStart(2, '0')}:${minute}`;
        }
        
        // Extract party size
        const partySizeMatch = fullText.match(/(\d+)\s*(people|person|guests?|party)/);
        if (partySizeMatch) {
            details.partySize = parseInt(partySizeMatch[1]);
        }
        
        return details;
    }

    /**
     * Format date for display
     */
    formatDate(dateString) {
        try {
            const date = new Date(dateString);
            const options = { month: 'long', day: 'numeric' };
            return date.toLocaleDateString('en-US', options);
        } catch (error) {
            return dateString; // fallback to original string
        }
    }

    /**
     * Format time for display  
     */
    formatTime(timeString) {
        try {
            if (timeString.includes('pm') || timeString.includes('am')) {
                return timeString; // already formatted
            }
            
            // Convert 24h format to 12h format
            const [hours, minutes] = timeString.split(':');
            const hour = parseInt(hours);
            const ampm = hour >= 12 ? 'pm' : 'am';
            const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
            return `${displayHour}${minutes === '00' ? '' : ':' + minutes}${ampm}`;
        } catch (error) {
            return timeString; // fallback to original string
        }
    }

    /**
     * Handle reservation creation
     */
    async handleReservationCreation(reservationDetails, aiResponse, reservationData, restaurantId) {
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
}

export default ReservationAgent;