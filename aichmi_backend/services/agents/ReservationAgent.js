/**
 * Reservation Agent
 * Specializes in handling table bookings, availability, and reservation management
 */

import BaseAgent from './BaseAgent.js';
import RestaurantService from '../RestaurantService.js';
import RAGService from '../RAGService.js';
import TimezoneUtils from '../../utils/timezoneUtils.js';

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
            
            // IMMEDIATE VALIDATION: If we have a validation error from extraction, return it immediately
            if (bookingDetails.validationError) {
                return this.formatResponse(bookingDetails.validationError);
            }

            // YAGNI: Check if user is asking for unavailable table type - suggest alternative times
            if (bookingDetails.tableType && bookingDetails.date && bookingDetails.time && bookingDetails.partySize) {
                const reservationData = await this.fetchReservationData(restaurantId);
                const availableTableTypes = reservationData.tableTypes.map(t => t.table_type.toLowerCase());
                
                if (!availableTableTypes.includes(bookingDetails.tableType.toLowerCase())) {
                    console.log(`🔍 User requested unavailable table type: ${bookingDetails.tableType}`);
                    
                    // Try to find alternative times for the requested table type
                    const alternatives = await this.findAlternativeTimes(
                        bookingDetails.time, 
                        restaurantId, 
                        bookingDetails.date, 
                        bookingDetails.tableType, 
                        bookingDetails.partySize
                    );
                    
                    if (alternatives.length > 0) {
                        return this.formatResponse(
                            `I'm sorry, but we don't have ${bookingDetails.tableType} tables available at ${this.formatTime(bookingDetails.time)} on ${this.formatDate(bookingDetails.date)}. However, I found availability for ${bookingDetails.tableType} tables at these alternative times: ${alternatives.join(', ')}. Would any of these work for you?`
                        );
                    } else {
                        // No alternatives, suggest available table types
                        const suggestions = reservationData.tableTypes
                            .sort((a, b) => parseFloat(a.table_price || 0) - parseFloat(b.table_price || 0))
                            .map(t => `${t.table_type}${t.table_price && parseFloat(t.table_price) > 0 ? ` (€${t.table_price})` : ''}`)
                            .join(', ');
                        return this.formatResponse(
                            `I'm sorry, but we don't have ${bookingDetails.tableType} tables available. However, we have ${suggestions} available on ${this.formatDate(bookingDetails.date)} at ${this.formatTime(bookingDetails.time)}. Would you like to book one of these instead?`
                        );
                    }
                }
            }

            // DISABLED: Don't trigger automatic availability checks on detail changes
            // The system should collect ALL details first (date, time, party size) before checking availability
            // This prevents premature availability checks and maintains proper flow
            
            
            // Check if AI recently asked for table preference (indicates availability was already checked)
            const recentHistory = history.slice(-5); // Check last 5 messages for more context
            const aiAskedForTableType = recentHistory.some(h => 
                h.sender === 'ai' && h.text && h.text.includes('Which type of table would you prefer')
            );
            
            // Check if AI recently asked for contact information (indicates we're in contact collection phase)
            const aiAskedForContact = recentHistory.some(h => 
                h.sender === 'ai' && h.text && (
                    h.text.includes('name, email, and phone') ||
                    h.text.includes('contact information') ||
                    h.text.includes('provide your name') ||
                    h.text.includes('name and number') ||
                    h.text.includes('email address') ||
                    h.text.includes('Could I please get') ||
                    h.text.includes('I\'ll need your name')
                )
            );
            
            // Check if user is providing contact info (email, phone, or name patterns)
            const hasEmailPattern = /@\w+\.\w+/.test(message);
            const hasPhonePattern = /\d{10}/.test(message.replace(/\s/g, ''));
            const hasNamePattern = /^[a-zA-Z\s]+,?\s*[\d\s\-\+\(\)]*$/.test(message.trim()) && message.trim().length > 2;
            
            // User is providing contact if they're giving email, phone, or name in context of contact collection
            const userProvidedContact = aiAskedForContact && (hasEmailPattern || hasPhonePattern || hasNamePattern);
            
            // SPECIAL HANDLING: If user provided contact info and we have booking details from previous conversation
            if (userProvidedContact && bookingDetails.date && bookingDetails.time && bookingDetails.partySize) {
                console.log('🎯 Processing contact information with existing booking details');
                
                // Extract contact information from the message
                const contactInfo = this.extractContactInfo(message);
                
                // Also check conversation history for any previously collected contact info
                const historyContactInfo = this.extractContactFromHistory(history);
                
                // Merge contact info from current message and history
                const completeContactInfo = {
                    name: contactInfo.name || historyContactInfo.name,
                    email: contactInfo.email || historyContactInfo.email,
                    phone: contactInfo.phone || historyContactInfo.phone
                };
                
                console.log('📞 Complete contact info:', completeContactInfo);
                
                // If we have all contact details (name, email, phone), create reservation
                if (completeContactInfo.name && completeContactInfo.email && completeContactInfo.phone) {
                    // Create reservation directly with combined data
                    const reservationDetails = {
                        restaurant: { id: restaurantId },
                        customer: {
                            name: completeContactInfo.name,
                            email: completeContactInfo.email,
                            phone: completeContactInfo.phone
                        },
                        reservation: {
                            date: bookingDetails.date,
                            time: bookingDetails.time,
                            partySize: bookingDetails.partySize,
                            tableType: bookingDetails.tableType || 'standard'
                        },
                        addOns: {
                            celebration: null,
                            cake: false,
                            flowers: false
                        },
                        transfer: {
                            needed: false,
                            hotel: null
                        },
                        specialRequests: null
                    };
                    
                    // Create reservation directly
                    const reservationData = await this.fetchReservationData(restaurantId);
                    return await this.handleReservationCreation(reservationDetails, 
                        `Perfect! Your reservation is confirmed for ${this.formatDate(bookingDetails.date)} at ${this.formatTime(bookingDetails.time)} for ${bookingDetails.partySize} people. We look forward to seeing you!`, 
                        reservationData, restaurantId);
                }
            }
            
            // Check if AI recently asked for missing details (date, time, or party size)
            const aiAskedForBasicDetails = recentHistory.some(h => 
                h.sender === 'ai' && h.text && (
                    h.text.includes('What date would you like') ||
                    h.text.includes('What time would you like') ||
                    h.text.includes('How many people') ||
                    h.text.includes('tell me what time') ||
                    h.text.includes('how many people will be')
                )
            );
            
            // Check if AI recently performed availability check
            const aiRecentlyCheckedAvailability = recentHistory.some(h => 
                h.sender === 'ai' && h.text && (
                    h.text.includes('checking for availability') ||
                    h.text.includes('Great news! We have tables available') ||
                    h.text.includes('Perfect! We have tables available')
                )
            );
            
            // Check if AI asked to continue with reservation after menu inquiry
            const aiAskedToContinueReservation = recentHistory.some(h => 
                h.sender === 'ai' && h.text && (
                    h.text.includes('Would you like to continue with your reservation') ||
                    h.text.includes('continue with the reservation')
                )
            );
            
            // Check if user is confirming to continue with existing reservation details
            const userConfirmingToContinue = aiAskedToContinueReservation && 
                                           (message.toLowerCase().trim() === 'yes' || 
                                            message.toLowerCase().includes('continue') ||
                                            message.toLowerCase().includes('proceed'));
            
            // If user is confirming to continue, skip availability check and proceed to contact collection
            if (userConfirmingToContinue && hasAllBasicDetails) {
                console.log('🔄 User confirming to continue with existing reservation');
                return this.formatResponse(`Perfect! To complete your reservation for ${this.formatDate(bookingDetails.date)} at ${this.formatTime(bookingDetails.time)} for ${bookingDetails.partySize} people.\n\nCould I please get your name, phone number, and email to complete the reservation?`);
            }
            
            // Enhanced logic: Only check availability if we have ALL basic details AND haven't checked recently
            const hasAllBasicDetails = bookingDetails.date && bookingDetails.time && bookingDetails.partySize;
            const conversationReadyForAvailabilityCheck = hasAllBasicDetails && 
                                                        !aiAskedForContact && 
                                                        !userProvidedContact &&
                                                        !aiRecentlyCheckedAvailability &&
                                                        !userConfirmingToContinue;
            
            console.log('🔍 Enhanced availability check logic:');
            console.log('  - Has date:', !!bookingDetails.date);
            console.log('  - Has time:', !!bookingDetails.time);
            console.log('  - Has party size:', !!bookingDetails.partySize);
            console.log('  - AI asked for table type:', aiAskedForTableType);
            console.log('  - AI asked for contact:', aiAskedForContact);
            console.log('  - User provided contact:', userProvidedContact);
            console.log('  - AI asked for basic details:', aiAskedForBasicDetails);
            console.log('  - AI recently checked availability:', aiRecentlyCheckedAvailability);
            console.log('  - AI asked to continue reservation:', aiAskedToContinueReservation);
            console.log('  - User confirming to continue:', userConfirmingToContinue);
            
            console.log('🔍 Booking details extracted:', bookingDetails);
            console.log('🎯 Has all basic details:', hasAllBasicDetails);
            console.log('🎯 Conversation ready for availability check:', conversationReadyForAvailabilityCheck);
            
            
            // If we have ALL the required booking details AND conversation flow is ready, perform two-message availability flow
            if (conversationReadyForAvailabilityCheck) {
                console.log('🚀 Starting two-message availability flow');
                
                // Validate date and time before checking availability
                const validationResult = this.validateBookingDateTime(bookingDetails.date, bookingDetails.time);
                if (!validationResult.valid) {
                    return this.formatResponse(validationResult.message);
                }
                
                // FIRST MESSAGE: Checking message
                const checkingMessage = `Okay, checking for availability for a table on ${this.formatDate(bookingDetails.date)} at ${this.formatTime(bookingDetails.time)} for ${bookingDetails.partySize} people...`;
                
                // Fetch reservation data to check table types first
                const reservationData = await this.fetchReservationData(restaurantId);
                const hasMultipleTableTypes = reservationData.tableTypes.length > 1;
                
                // Perform a simple availability check first (just check if ANY tables are available)
                let availabilityResult;
                if (hasMultipleTableTypes) {
                    // Check availability for each table type but don't ask for preference yet
                    const allTableChecks = await Promise.all(
                        reservationData.tableTypes.map(async (tableType) => {
                            const available = await RestaurantService.isTableAvailable({
                                venueId: restaurantId,
                                tableType: tableType.table_type,
                                reservationDate: bookingDetails.date,
                                reservationTime: bookingDetails.time
                            });
                            
                            return {
                                tableType: tableType.table_type,
                                price: tableType.table_price,
                                available,
                                result: { available }
                            };
                        })
                    );
                    
                    const availableTypes = allTableChecks.filter(check => check.available);
                    
                    if (availableTypes.length > 0) {
                        availabilityResult = {
                            available: true,
                            availableTableTypes: availableTypes,
                            hasMultipleOptions: availableTypes.length > 1,
                            message: `Tables available for ${availableTypes.length} table type(s)`
                        };
                    } else {
                        availabilityResult = {
                            available: false,
                            message: "Sorry, no tables are available for that date and time.",
                            allTableChecks
                        };
                    }
                } else {
                    // Single table type - check that specific type
                    availabilityResult = await this.checkAvailability(
                        restaurantId, 
                        bookingDetails.date, 
                        reservationData.tableTypes[0]?.table_type || 'standard',
                        bookingDetails.time,
                        bookingDetails.partySize
                    );
                }
                
                console.log('📊 Availability check result:', availabilityResult);
                
                // SECOND MESSAGE: Generate the results message based on availability
                let resultsMessage = '';
                if (availabilityResult.available) {
                    const totalTableTypes = reservationData.tableTypes.length;
                    const availableTableTypes = availabilityResult.availableTableTypes || [];
                    
                    if (totalTableTypes === 1) {
                        // Restaurant has only one table type - don't mention table type at all
                        resultsMessage = `Perfect! We have tables available for ${this.formatDate(bookingDetails.date)} at ${this.formatTime(bookingDetails.time)} for ${bookingDetails.partySize} people.

To complete your reservation, I'll need your name, email, and phone number.`;
                    } else if (availableTableTypes.length > 1) {
                        // Multiple table types available - filter out previously mentioned types
                        const newTableTypes = this.filterPreviouslyMentionedTableTypes(availableTableTypes, history);
                        
                        if (newTableTypes.length > 0) {
                            const availableOptions = newTableTypes
                                .sort((a, b) => parseFloat(a.price || 0) - parseFloat(b.price || 0))
                                .map(t => `• ${t.tableType}${t.price && parseFloat(t.price) > 0 ? ` (€${t.price})` : ''}`)
                                .join('\n');
                            resultsMessage = `Great news! We have tables available for ${this.formatDate(bookingDetails.date)} at ${this.formatTime(bookingDetails.time)} for ${bookingDetails.partySize} people.

We have different table types available:
${availableOptions}

Which type would you prefer?`;
                        } else {
                            // All table types were already mentioned - just ask for contact info
                            resultsMessage = `Perfect! We have tables available for ${this.formatDate(bookingDetails.date)} at ${this.formatTime(bookingDetails.time)} for ${bookingDetails.partySize} people.

To complete your reservation, I'll need your name, email, and phone number.`;
                        }
                    } else if (availableTableTypes.length === 1) {
                        // Single table type available - ask for confirmation
                        const tableType = availableTableTypes[0];
                        const priceText = tableType.price && parseFloat(tableType.price) > 0 ? ` (€${tableType.price})` : '';
                        resultsMessage = `Great news! We have ${tableType.tableType} tables${priceText} available for ${this.formatDate(bookingDetails.date)} at ${this.formatTime(bookingDetails.time)} for ${bookingDetails.partySize} people.

Would ${tableType.tableType} tables work for you?`;
                    } else {
                        // Fallback - should not happen but just in case
                        resultsMessage = `Perfect! We have tables available for ${this.formatDate(bookingDetails.date)} at ${this.formatTime(bookingDetails.time)} for ${bookingDetails.partySize} people.

To complete your reservation, I'll need your name, email, and phone number.`;
                    }
                } else {
                    if (availabilityResult.hasAlternatives) {
                        resultsMessage = availabilityResult.message;
                    } else {
                        resultsMessage = `${availabilityResult.message}

Would you like to try a different date or time?`;
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
                        bookingDetails.time,
                        bookingDetails.partySize
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
            const fullPrompt = this.buildPrompt(message, conversationHistory, reservationData, availabilityResult, bookingDetails);
            
            // Generate response with RAG context
            const aiResponse = await this.generateResponse(fullPrompt, systemPrompt, ragData);
            
            // Check if the response contains a tool_code for availability checking
            const toolCodeMatch = aiResponse.match(/\[TOOL_CODE\](.*?)\[\/TOOL_CODE\]/s);
            if (toolCodeMatch) {
                try {
                        const toolData = JSON.parse(toolCodeMatch);
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
     * Enhanced availability check when we have date, time, and party size
     */
    async checkAvailability(restaurantId, date, tableType = 'standard', originalTime = null, partySize = null) {
        try {
            console.log('🔍 Enhanced availability check:', { restaurantId, date, tableType, originalTime, partySize });
            
            // 1. Check restaurant hours FIRST to avoid wasted processing
            if (originalTime) {
                const restaurantHours = await RestaurantService.getRestaurantHours(restaurantId);
                const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
                const dayHours = restaurantHours.find(h => h.day_of_week === dayName);
                
                if (!dayHours) {
                    return {
                        available: false,
                        message: `I'm sorry, but we're closed on ${dayName}s. Please choose a different day.`,
                        reason: 'closed'
                    };
                }
                
                // Simple time validation - handle next-day closing times
                const isWithinHours = this.isTimeWithinHours(originalTime, dayHours.open_time, dayHours.close_time);
                
                if (!isWithinHours) {
                    return {
                        available: false,
                        message: `I'm sorry, but we're only open from ${dayHours.open_time} to ${dayHours.close_time} on ${dayName}s. Please choose a time within our operating hours.`,
                        reason: 'outside_hours',
                        operatingHours: { open: dayHours.open_time, close: dayHours.close_time }
                    };
                }
            }
            
            // 2. Get detailed table inventory for this restaurant
            const tableInventory = await RestaurantService.getTableInventory(restaurantId);
            const tableDetails = tableInventory.filter(t => t.table_type === tableType);
            const maxTables = tableDetails.length;
            
            // 3. Check party size against table capacity
            if (partySize && tableDetails.length > 0) {
                const suitableTables = tableDetails.filter(t => t.capacity >= partySize);
                if (suitableTables.length === 0) {
                    // Check if other table types can accommodate this party size
                    const allTables = await RestaurantService.getTableInventory(restaurantId);
                    const alternativeTypes = allTables
                        .filter(t => t.capacity >= partySize && t.table_type !== tableType)
                        .map(t => ({ type: t.table_type, capacity: t.capacity, price: t.table_price }))
                        .reduce((acc, table) => {
                            if (!acc.find(t => t.type === table.type)) {
                                acc.push(table);
                            }
                            return acc;
                        }, []);
                    
                    if (alternativeTypes.length > 0) {
                        const suggestions = alternativeTypes
                            .sort((a, b) => parseFloat(a.price || 0) - parseFloat(b.price || 0)) // Sort by price ascending
                            .map(t => `${t.type} tables (capacity ${t.capacity}${t.price && parseFloat(t.price) > 0 ? `, €${t.price}` : ''})`)
                            .join(', ');
                        return {
                            available: false,
                            message: `I'm sorry, but our ${tableType} tables (capacity ${Math.max(...tableDetails.map(t => t.capacity))}) cannot accommodate ${partySize} people. However, we have ${suggestions} that can accommodate your party. Would you like me to check availability for those instead?`,
                            reason: 'capacity_mismatch',
                            alternatives: alternativeTypes
                        };
                    } else {
                        return {
                            available: false,
                            message: `I'm sorry, but we cannot accommodate a party of ${partySize} people with our current table configurations. Our largest tables accommodate ${Math.max(...allTables.map(t => t.capacity))} people.`,
                            reason: 'no_suitable_capacity'
                        };
                    }
                }
            }
            
            // 4. Check basic table availability for the specific table type
            const basicAvailability = await RestaurantService.isTableAvailable({
                venueId: restaurantId,
                tableType,
                reservationDate: date,
                reservationTime: originalTime
            });
            
            // 5. Get current reservation count for this table type and date
            const reservationCount = await this.getReservationCount(restaurantId, date, tableType);
            
            if (!basicAvailability) {
                console.log(`❌ No availability: ${reservationCount}/${maxTables} ${tableType} tables booked`);
                
                // 6. Try to find alternative times if original time was provided
                if (originalTime) {
                    const alternatives = await this.findAlternativeTimes(originalTime, restaurantId, date, tableType, partySize);
                    if (alternatives.length > 0) {
                        return {
                            available: false,
                            message: `I'm sorry, but we're fully booked for ${tableType} tables on ${this.formatDate(date)} at ${this.formatTime(originalTime)}. However, I found availability at these alternative times: ${alternatives.join(', ')}. Would any of these work for you?`,
                            alternatives: alternatives,
                            hasAlternatives: true,
                            reservationCount,
                            maxTables,
                            reason: 'fully_booked_time'
                        };
                    }
                }
                
                // 7. Suggest alternative table types if available
                const tableTypes = await RestaurantService.getTableTypes(restaurantId);
                const alternativeTypes = tableTypes.filter(t => t.table_type !== tableType);
                
                if (alternativeTypes.length > 0) {
                    // Check if other table types have availability
                    const availableAlternatives = [];
                    for (const altType of alternativeTypes) {
                        const altAvailable = await RestaurantService.isTableAvailable({
                            venueId: restaurantId,
                            tableType: altType.table_type,
                            reservationDate: date,
                            reservationTime: originalTime
                        });
                        if (altAvailable) {
                            availableAlternatives.push(altType);
                        }
                    }
                    
                    if (availableAlternatives.length > 0) {
                        const suggestions = availableAlternatives
                            .sort((a, b) => parseFloat(a.table_price || 0) - parseFloat(b.table_price || 0)) // Sort by price ascending
                            .map(t => `${t.table_type}${t.table_price && parseFloat(t.table_price) > 0 ? ` (€${t.table_price})` : ''}`)
                            .join(', ');
                        return {
                            available: false,
                            message: `I'm sorry, but we're fully booked for ${tableType} tables on ${this.formatDate(date)}. However, we have availability for ${suggestions}. Would you like me to check those instead?`,
                            reservationCount,
                            maxTables,
                            alternativeTableTypes: availableAlternatives,
                            hasAlternatives: true,
                            reason: 'fully_booked_type'
                        };
                    }
                }
                
                return {
                    available: false,
                    message: `I'm sorry, but we're fully booked on ${this.formatDate(date)}. We currently have ${reservationCount} out of ${maxTables} ${tableType} tables reserved. Would you like to try a different date?`,
                    reservationCount,
                    maxTables,
                    reason: 'fully_booked_date'
                };
            }
            
            // 8. Success - tables are available
            const availableCount = maxTables - reservationCount;
            console.log(`✅ Availability confirmed: ${availableCount}/${maxTables} ${tableType} tables available`);
            
            return {
                available: true,
                message: `Great news! ${tableType} tables are available on ${this.formatDate(date)}${originalTime ? ` at ${this.formatTime(originalTime)}` : ''}${partySize ? ` for ${partySize} people` : ''}.`,
                availableCount,
                maxTables,
                reservationCount
            };
            
        } catch (error) {
            console.error('❌ Error in enhanced availability check:', error);
            return {
                available: false,
                message: "I'm having trouble checking availability right now. Please try again in a moment.",
                error: true
            };
        }
    }
    
    /**
     * Convert time string to minutes for comparison
     */
    isTimeWithinHours(requestedTime, openTime, closeTime) {
        // Simple: if close time is less than open time, restaurant closes next day
        const isNextDayClose = closeTime < openTime;
        
        if (isNextDayClose) {
            // Restaurant closes next day (e.g., 12:00 - 00:30)
            return requestedTime >= openTime || requestedTime <= closeTime;
        } else {
            // Normal hours (e.g., 09:00 - 22:00)
            return requestedTime >= openTime && requestedTime <= closeTime;
        }
    }

    async findAlternativeTimes(originalTime, restaurantId, date, tableType, partySize = null) {
        try {
            const alternatives = [];
            
            // Get restaurant hours for this day
            const restaurantHours = await RestaurantService.getRestaurantHours(restaurantId);
            const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
            const dayHours = restaurantHours.find(h => h.day_of_week === dayName);
            
            if (!dayHours) {
                console.log('❌ Restaurant closed on', dayName);
                return [];
            }
            
            // Simple alternative times: ±30 min, ±1h, ±1.5h from original time
            const [hours, minutes] = originalTime.split(':').map(Number);
            const offsetMinutes = [-90, -60, -30, 30, 60, 90];
            
            for (const offset of offsetMinutes) {
                const newTotalMinutes = hours * 60 + minutes + offset;
                const newHours = Math.floor(newTotalMinutes / 60) % 24;
                const newMins = newTotalMinutes % 60;
                
                // Handle negative times
                if (newTotalMinutes < 0) continue;
                
                const timeString = `${newHours.toString().padStart(2, '0')}:${Math.abs(newMins).toString().padStart(2, '0')}`;
                
                // Check if time is within restaurant hours
                if (this.isTimeWithinHours(timeString, dayHours.open_time, dayHours.close_time)) {
                    // Check availability for this alternative time
                    const available = await RestaurantService.isTableAvailable({
                        venueId: restaurantId,
                        tableType,
                        reservationDate: date,
                        reservationTime: timeString
                    });
                    
                    if (available) {
                        // If we have party size, check table capacity as well
                        if (partySize) {
                            const tableInventory = await RestaurantService.getTableInventory(restaurantId);
                            const suitableTables = tableInventory.filter(t => 
                                t.table_type === tableType && t.capacity >= partySize
                            );
                            if (suitableTables.length > 0) {
                                alternatives.push(this.formatTime(timeString));
                            }
                        } else {
                            alternatives.push(this.formatTime(timeString));
                        }
                    }
                }
            }
            
            // Remove duplicates and limit to 3 alternatives
            const uniqueAlternatives = [...new Set(alternatives)];
            return uniqueAlternatives.slice(0, 3);
            
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
            const db = await import('../../config/database.js');
            const result = await db.default.query(
                'SELECT COUNT(*) as count FROM reservation WHERE restaurant_id = $1 AND table_type = $2 AND reservation_date = $3',
                [restaurantId, tableType, date]
            );
            return parseInt(result?.count || 0);
        } catch (error) {
            console.error('❌ Error getting reservation count:', error);
            return 0;
        }
    }

    buildSystemPrompt(reservationData) {
        const { restaurant, tableTypes, fullyBookedDates } = reservationData;
        
        const availableTableNames = tableTypes.map(t => t.table_type).join(', ');
        const timeContext = TimezoneUtils.getCurrentContext();

        return `You are AICHMI, a friendly restaurant host for ${restaurant.name}. 

CURRENT CONTEXT:
- TODAY: ${timeContext.today.display}
- TOMORROW: ${timeContext.tomorrow.display}

AVAILABLE TABLES: ${availableTableNames}
${fullyBookedDates.length > 0 ? `UNAVAILABLE DATES: ${fullyBookedDates.map(d => d.date).join(', ')}` : ''}

RESERVATION FLOW (KISS - Keep It Simple):
1. COLLECT BASIC DETAILS FIRST (in any order):
   - Date (YYYY-MM-DD)
   - Time (HH:MM) 
   - Party size (number of people)

2. ONLY AFTER you have ALL THREE basic details → Check availability and ask about table types

3. COLLECT CONTACT INFO:
   - Name, phone, email

NEVER ASK ABOUT TABLE TYPES BEFORE YOU HAVE DATE, TIME, AND PARTY SIZE!

BE NATURAL:
- Act like a real restaurant host
- Ask for ONE missing detail at a time
- Keep responses simple and conversational
- Don't make assumptions or suggestions

After confirmation, output:
[RESERVATION_DATA]
{
  "restaurant": {"id": ${restaurant.restaurant_id}, "name": "${restaurant.name}"},
  "customer": {"name": "[name]", "email": "[email]", "phone": "[phone]"},
  "reservation": {"date": "[YYYY-MM-DD]", "time": "[HH:MM]", "partySize": [number], "tableType": "[${availableTableNames}]"},
  "addOns": {"celebration": "[type or null]", "cake": [true/false], "flowers": [true/false]},
  "transfer": {"needed": false, "hotel": null},
  "specialRequests": "[requests or null]"
}
[/RESERVATION_DATA]`;
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
        
        // IMPORTANT: Return null if the exact table type is not available
        // This prevents fallback mapping when user specifically requests an unavailable type
        if (['standard', 'grass', 'anniversary', 'vip', 'private', 'romantic', 'premium', 'terrace', 'garden', 'outdoor'].includes(lowerRequest)) {
            console.log(`❌ Table type "${userRequest}" not available. Available types: ${availableTableNames.join(', ')}`);
            return null;
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
            return outdoorTypes.table_type;
        }
        
        // Check special requests
        if (specialKeywords.some(keyword => lowerRequest.includes(keyword)) && specialTypes.length > 0) {
            return specialTypes.table_type;
        }
        
        // Check indoor requests
        if (indoorKeywords.some(keyword => lowerRequest.includes(keyword)) && standardTypes.length > 0) {
            return standardTypes.table_type;
        }
        
        // Return null instead of fallback - this prevents invalid selections
        console.log(`❌ Could not map table type request "${userRequest}" to any available type. Available types: ${availableTableNames.join(', ')}`);
        return null;
    }

    buildPrompt(message, conversationHistory, reservationData, availabilityResult = null, bookingDetails = {}) {
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
        
        // Analyze what information we have from the conversation AND extracted booking details
        const collectedInfo = this.analyzeCollectedInfo(conversationHistory);
        
        // Also merge in the extracted booking details passed from the main function
        if (bookingDetails.date) collectedInfo.date = bookingDetails.date;
        if (bookingDetails.time) collectedInfo.time = bookingDetails.time;
        if (bookingDetails.partySize) collectedInfo.partySize = bookingDetails.partySize;
        if (bookingDetails.tableType) collectedInfo.tableType = bookingDetails.tableType;
        
        if (Object.keys(collectedInfo).length > 0) {
            prompt += `Information already collected:\n${JSON.stringify(collectedInfo, null, 2)}\n\n`;
        }
        
        // Analyze what's missing from basic details
        const missingBasicDetails = [];
        if (!collectedInfo.date) missingBasicDetails.push('date');
        if (!collectedInfo.time) missingBasicDetails.push('time');  
        if (!collectedInfo.partySize) missingBasicDetails.push('party size');

        prompt += `Current user message: ${message}

FLOW GUIDANCE:
${missingBasicDetails.length > 0 ? 
    `- You are MISSING: ${missingBasicDetails.join(', ')}
- Ask for ONE missing basic detail (don't ask about table types yet!)` :
    `- You have ALL basic details (date, time, party size)
- Now you can check availability and ask about table types`
}

Please help the guest with their reservation for ${reservationData.restaurant.name}. Follow the RESERVATION FLOW steps exactly.`;

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
                info.date = match;
                break;
            }
        }
        
        // Look for party size
        const partySizeMatch = historyText.match(/(\d+)\s+people?/);
        if (partySizeMatch) {
            info.partySize = partySizeMatch;
        }
        
        // Look for table type selection
        if (historyText.includes('grass table') || historyText.includes('15 euro')) {
            info.tableType = 'grass';
            info.tablePrice = '15';
        }
        
        // Look for contact info
        const emailMatch = conversationHistory.match(/\S+@\S+\.\S+/);
        if (emailMatch) {
            info.email = emailMatch;
        }
        
        const phoneMatch = conversationHistory.match(/\d{10}/);
        if (phoneMatch) {
            info.phone = phoneMatch;
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
            
            // Get current timezone context for accurate date processing
            const timeContext = TimezoneUtils.getCurrentContext();
            
            const extractionPrompt = `Extract reservation details from this conversation. Be very careful to distinguish between time and party size.

CURRENT DATE CONTEXT (Athens/Greece Timezone):
- TODAY: ${timeContext.today.date} (${timeContext.today.dayName})
- TOMORROW: ${timeContext.tomorrow.date} (${timeContext.tomorrow.dayName})
- CURRENT YEAR: ${timeContext.currentYear}

Conversation text: "${fullText}"

IMPORTANT RULES:
- "8pm", "8:00pm", "20:00" are TIMES, not party sizes
- "8 people", "party of 8", "8 guests" are PARTY SIZES, not times
- ONLY extract times that have clear time indicators like "pm", "am", or ":" (e.g., "3pm", "15:00", "8:30am")
- DO NOT extract standalone numbers as times (e.g., "8" in "8 people" is NOT a time)
- "today" should be converted to ${timeContext.today.date}
- "tomorrow" should be converted to ${timeContext.tomorrow.date}
- "this friday", "friday", and other weekday names should be converted to the NEXT occurrence of that day (don't ask for clarification)
- If today is Tuesday July 29 and user says "friday" or "this friday", convert to August 1st (the upcoming Friday)
- Only extract information that is explicitly mentioned in the MOST RECENT user message
- Do NOT guess or infer missing information
- If time format is unclear or contains typos, return null for time
- Prioritize information from the most recent messages over older conversation history

Extract and return ONLY the following information if present:
- Date: Convert to YYYY-MM-DD format (use ${timeContext.currentYear} for current year, next year ${parseInt(timeContext.currentYear) + 1} for past dates)
- Time: Convert to 24-hour format (HH:MM) - ONLY if time keywords like "pm", "am", or ":" are present
- Party size: Number of people/guests - ONLY if words like "people", "guests", "party of" are present
- Table type: ONLY if specifically mentioned by user (like "grass table", "outdoor table")

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
                    extractedData = JSON.parse(jsonMatch);
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
            
            // IMMEDIATE VALIDATION: Check date/time validity as soon as we have them
            if (details.date && details.time) {
                const validationResult = this.validateBookingDateTime(details.date, details.time);
                if (!validationResult.valid) {
                    // Return validation error immediately - this will be handled by the caller
                    details.validationError = validationResult.message;
                }
            }
            
            console.log('🤖 AI extracted booking details:', details);
            return details;
            
        } catch (error) {
            console.error('❌ Error in AI booking extraction:', error);
            return this.extractBookingDetailsFallback(message, history);
        }
    }

    /**
     * Detect if user is changing reservation details and trigger availability recheck
     */
    detectDetailChanges(currentDetails, previousDetails, message) {
        if (!previousDetails) return { hasChanges: false };

        // KISS: Don't recheck availability for table type selection ONLY
        // If user is just selecting from already-presented options, no need to recheck
        const isJustTableTypeSelection = message.toLowerCase().trim() === (currentDetails.tableType || '').toLowerCase() &&
                                        !currentDetails.date && !currentDetails.time && !currentDetails.partySize;
        if (isJustTableTypeSelection) {
            return { hasChanges: false }; // Just selecting table type, no recheck needed
        }

        const changes = {};
        let hasChanges = false;

        // SIMPLE: Normalize dates for proper comparison
        const normalizeDate = (date) => {
            if (!date) return null;
            
            // Already in YYYY-MM-DD format
            if (date.match(/^\d{4}-\d{2}-\d{2}$/)) return date;
            
            // Handle MM/DD/YYYY format
            if (date.includes('/')) {
                const parts = date.split('/');
                if (parts.length === 3) {
                    const month = parts.padStart(2, '0');
                    const day = parts.padStart(2, '0');
                    const year = parts;
                    return `${year}-${month}-${day}`;
                }
            }
            
            // Handle "August 1", "Aug 1", etc.
            const monthNames = {
                'january': '01', 'jan': '01', 'february': '02', 'feb': '02',
                'march': '03', 'mar': '03', 'april': '04', 'apr': '04',
                'may': '05', 'june': '06', 'jun': '06', 'july': '07', 'jul': '07',
                'august': '08', 'aug': '08', 'september': '09', 'sep': '09',
                'october': '10', 'oct': '10', 'november': '11', 'nov': '11',
                'december': '12', 'dec': '12'
            };
            
            const lowerDate = date.toLowerCase().trim();
            for (const [monthName, monthNum] of Object.entries(monthNames)) {
                if (lowerDate.includes(monthName)) {
                    const dayMatch = lowerDate.match(/\b(\d{1,2})\b/);
                    if (dayMatch) {
                        const year = new Date().getFullYear();
                        const day = dayMatch.padStart(2, '0');
                        return `${year}-${monthNum}-${day}`;
                    }
                }
            }
            
            return date; // Return as-is if can't normalize
        };

        const normalizeTime = (time) => {
            if (!time) return null;
            
            // Already in HH:MM format
            if (time.match(/^\d{1,2}:\d{2}$/)) return time;
            
            // Handle "8pm", "8 pm", "8:30pm", etc.
            const timeMatch = time.toLowerCase().match(/(\d{1,2})(?::(\d{2}))?\s*(pm|am|p\.m\.|a\.m\.)?/);
            if (timeMatch) {
                let hour = parseInt(timeMatch);
                const minute = timeMatch || '00';
                const period = timeMatch;
                
                if (period && (period.includes('pm') || period.includes('p.m.'))) {
                    if (hour !== 12) hour += 12;
                } else if (period && (period.includes('am') || period.includes('a.m.'))) {
                    if (hour === 12) hour = 0;
                }
                
                return `${hour.toString().padStart(2, '0')}:${minute}`;
            }
            
            return time; // Return as-is if can't normalize
        };

        // Check for actual date changes (normalized)
        const currentDate = normalizeDate(currentDetails.date);
        const previousDate = normalizeDate(previousDetails.date);
        if (currentDate && previousDate && currentDate !== previousDate) {
            changes.date = { from: previousDate, to: currentDate };
            hasChanges = true;
            console.log('📅 Date changed:', changes.date);
        }

        // Check for actual time changes (normalized)
        const currentTime = normalizeTime(currentDetails.time);
        const previousTime = normalizeTime(previousDetails.time);
        if (currentTime && previousTime && currentTime !== previousTime) {
            changes.time = { from: previousTime, to: currentTime };
            hasChanges = true;
            console.log('⏰ Time changed:', changes.time);
        }

        // Check for party size changes
        if (currentDetails.partySize && previousDetails.partySize && 
            parseInt(currentDetails.partySize) !== parseInt(previousDetails.partySize)) {
            changes.partySize = { from: previousDetails.partySize, to: currentDetails.partySize };
            hasChanges = true;
            console.log('👥 Party size changed:', changes.partySize);
        }

        // Check for explicit change keywords in message
        const changeKeywords = ['change', 'actually', 'instead', 'make it', 'switch to', 'update to', 'correct', 'modify'];
        const hasChangeKeywords = changeKeywords.some(keyword => message.toLowerCase().includes(keyword));

        if (hasChangeKeywords && (currentDetails.date || currentDetails.time || currentDetails.partySize)) {
            hasChanges = true;
            console.log('🔄 Change keywords detected in message');
        }

        return { hasChanges, changes, needsAvailabilityRecheck: hasChanges };
    }

    /**
     * Extract previous booking details from conversation history for comparison
     */
    extractPreviousBookingDetails(history) {
        if (!history || history.length < 2) return null;

        // Look for the most recent AI message that mentioned specific details
        const recentMessages = history.slice(-6); // Check last 6 messages
        let previousDetails = {};

        for (const msg of recentMessages.reverse()) {
            if (msg.sender === 'ai' && msg.text) {
                const text = msg.text;

                // Extract date mentions
                const dateMatch = text.match(/(\d{4}-\d{2}-\d{2})|((January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2})|((Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday))/i);
                if (dateMatch && !previousDetails.date) {
                    previousDetails.date = dateMatch;
                }

                // Extract time mentions
                const timeMatch = text.match(/(\d{1,2}:\d{2})|(\d{1,2}\s*(am|pm))/i);
                if (timeMatch && !previousDetails.time) {
                    previousDetails.time = timeMatch;
                }

                // Extract party size mentions
                const partySizeMatch = text.match(/(\d+)\s+(people|guests|person)/i);
                if (partySizeMatch && !previousDetails.partySize) {
                    previousDetails.partySize = parseInt(partySizeMatch);
                }
            }
        }

        // Only return if we found at least one detail
        return Object.keys(previousDetails).length > 0 ? previousDetails : null;
    }

    /**
     * Fallback extraction using regex patterns
     */
    extractBookingDetailsFallback(message, history) {
        const msg = message.toLowerCase();
        const fullText = (history.map(h => h.text || '').join(' ') + ' ' + message).toLowerCase();
        
        const details = {};
        
        // Extract date using timezone utils
        if (msg.includes('tomorrow')) {
            details.date = TimezoneUtils.getTomorrowAthensDate();
        } else if (msg.includes('today') || msg.includes('tonight')) {
            details.date = TimezoneUtils.getCurrentAthensDate();
        } else {
            // Check for weekday names
            const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
            for (const weekday of weekdays) {
                if (msg.includes(weekday)) {
                    details.date = TimezoneUtils.getRelativeDate(weekday);
                    break;
                }
            }
        }
        
        // If no relative date found, try to parse specific dates using timezone utils
        if (!details.date) {
            details.date = TimezoneUtils.parseUserDate(fullText);
        }
        
        // Extract time using timezone utils
        details.time = TimezoneUtils.parseUserTime(fullText);
        
        // Extract party size
        const partySizeMatch = fullText.match(/(\d+)\s*(people|person|guests?|party)/);
        if (partySizeMatch) {
            details.partySize = parseInt(partySizeMatch);
        }
        
        return details;
    }

    /**
     * Format date for display
     */
    formatDate(dateString) {
        return TimezoneUtils.formatDateForDisplay(dateString);
    }

    /**
     * Format time for display  
     */
    formatTime(timeString) {
        return TimezoneUtils.formatTimeForDisplay(timeString);
    }

    /**
     * Validate booking date and time
     */
    validateBookingDateTime(date, time) {
        const currentContext = TimezoneUtils.getCurrentContext();
        const now = TimezoneUtils.getCurrentAthensTime();
        
        // Parse the booking date and time
        const bookingDate = new Date(date + 'T' + time);
        
        // Check if booking is in the past
        if (bookingDate < now) {
            return {
                valid: false,
                message: "I'm sorry, but that date and time has already passed. Please choose a future date and time for your reservation."
            };
        }
        
        // Check if booking is too far in the future (e.g., more than 3 months)
        const maxFutureDate = new Date(now);
        maxFutureDate.setMonth(maxFutureDate.getMonth() + 3);
        
        if (bookingDate > maxFutureDate) {
            return {
                valid: false,
                message: "I'm sorry, but we can only take reservations up to 3 months in advance. Please choose a date within the next 3 months."
            };
        }
        
        return { valid: true };
    }

    /**
     * Filter out table types that were already mentioned in the conversation
     */
    filterPreviouslyMentionedTableTypes(availableTableTypes, history) {
        if (!history || history.length === 0) {
            return availableTableTypes;
        }
        
        // Look for AI messages that mentioned table types
        const conversationText = history
            .filter(h => h.sender === 'ai' && h.text)
            .map(h => h.text.toLowerCase())
            .join(' ');
        
        // Filter out table types that were already mentioned
        const newTableTypes = availableTableTypes.filter(tableType => {
            const tableName = tableType.tableType.toLowerCase();
            
            // Check if this table type was already mentioned in previous AI responses
            const wasAlreadyMentioned = conversationText.includes(`• ${tableName}`) || 
                                      conversationText.includes(`${tableName} table`) ||
                                      conversationText.includes(`${tableName} (€`) ||
                                      conversationText.includes(`available:\n• ${tableName}`) ||
                                      conversationText.includes(`types available:\n• ${tableName}`);
            
            return !wasAlreadyMentioned;
        });
        
        console.log(`🔍 Table type filtering: ${availableTableTypes.length} available -> ${newTableTypes.length} new types`);
        availableTableTypes.forEach(t => {
            const isNew = newTableTypes.some(nt => nt.tableType === t.tableType);
            console.log(`   - ${t.tableType}: ${isNew ? 'NEW' : 'already mentioned'}`);
        });
        
        return newTableTypes;
    }

    /**
     * Extract contact information from user message
     */
    extractContactInfo(message) {
        console.log('🔍 Extracting contact info from message:', message);
        
        // Email pattern (more comprehensive)
        const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
        const emailMatch = message.match(emailPattern);
        
        // Phone pattern (supports various formats)
        const phonePattern = /(?:\+30|0030)?\s*(?:69|21|22|23|24|25|26|27|28)\s*\d{2}\s*\d{3}\s*\d{3,4}|(?:\+30|0030)?\s*\d{10}|(?:69|21|22|23|24|25|26|27|28)\d{8}/;
        const phoneMatch = message.match(phonePattern);
        
        // Name extraction - look for patterns before email or phone
        let nameMatch = null;
        
        // Pattern 1: Name before comma (e.g., "John Doe, john@email.com")
        const nameBeforeCommaPattern = /^([a-zA-Z\s]{2,30}),/;
        nameMatch = message.match(nameBeforeCommaPattern);
        
        // Pattern 2: Name at start of message followed by email/phone
        if (!nameMatch) {
            const nameAtStartPattern = /^([a-zA-Z\s]{2,30})\s+(?:[a-zA-Z0-9._%+-]+@|(?:\+30|0030)?\s*(?:69|21|22|23|24|25|26|27|28))/;
            nameMatch = message.match(nameAtStartPattern);
        }
        
        // Pattern 3: Extract name from parts of the message (fallback)
        if (!nameMatch) {
            // Look for capitalized words that could be names
            const words = message.split(/[\s,]+/);
            const nameWords = [];
            
            for (const word of words) {
                // Skip if it's an email or phone number
                if (word.includes('@') || /^\d+$/.test(word.replace(/[\s-+()]/g, ''))) {
                    break;
                }
                
                // Check if word looks like a name (capitalized, contains letters)
                if (/^[A-Z][a-z]+$/.test(word) && word.length >= 2) {
                    nameWords.push(word);
                }
                
                // Stop if we have found 2-3 name parts
                if (nameWords.length >= 3) break;
            }
            
            if (nameWords.length >= 1) {
                nameMatch = [null, nameWords.join(' ')];
            }
        }
        
        const extractedInfo = {
            name: nameMatch ? nameMatch[1].trim() : null,
            email: emailMatch ? emailMatch[1].trim() : null,
            phone: phoneMatch ? phoneMatch[0].replace(/\s/g, '').trim() : null
        };
        
        console.log('📝 Extracted contact info:', extractedInfo);
        return extractedInfo;
    }

    /**
     * Extract contact information from conversation history
     */
    extractContactFromHistory(history) {
        console.log('🔍 Extracting contact info from conversation history');
        
        const contactInfo = {
            name: null,
            email: null,
            phone: null
        };
        
        if (!history || history.length === 0) {
            return contactInfo;
        }
        
        // Look through the conversation history for contact information
        const allText = history.map(h => h.text || '').join(' ');
        
        // Email pattern
        const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
        const emailMatch = allText.match(emailPattern);
        if (emailMatch) {
            contactInfo.email = emailMatch[1];
        }
        
        // Phone pattern (Greek phone numbers)
        const phonePattern = /(?:\+30|0030)?\s*(?:69|21|22|23|24|25|26|27|28)\s*\d{2}\s*\d{3}\s*\d{3,4}|(?:\+30|0030)?\s*\d{10}|(?:69|21|22|23|24|25|26|27|28)\d{8}/;
        const phoneMatch = allText.match(phonePattern);
        if (phoneMatch) {
            contactInfo.phone = phoneMatch[0].replace(/\s/g, '');
        }
        
        // Name extraction - look for user messages that might contain names
        for (const msg of history) {
            if (msg.sender === 'user' && msg.text) {
                const text = msg.text.trim();
                
                // Pattern: Name followed by comma and contact info
                const nameCommaPattern = /^([a-zA-Z\s]{2,30}),/;
                const nameMatch = text.match(nameCommaPattern);
                if (nameMatch && !contactInfo.name) {
                    contactInfo.name = nameMatch[1].trim();
                    continue;
                }
                
                // Pattern: Just a name (2-3 words, capitalized)
                const justNamePattern = /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*$/;
                const justNameMatch = text.match(justNamePattern);
                if (justNameMatch && justNameMatch[1].split(' ').length <= 3 && !contactInfo.name) {
                    // Make sure it's not a table type or other command
                    const lowerText = text.toLowerCase();
                    if (!lowerText.includes('standard') && !lowerText.includes('grass') && 
                        !lowerText.includes('anniversary') && !lowerText.includes('table')) {
                        contactInfo.name = justNameMatch[1].trim();
                    }
                }
            }
        }
        
        console.log('📝 Extracted from history:', contactInfo);
        return contactInfo;
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
                specialRequests: reservationDetails.specialRequests || null
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
            
            // Check if this is a gap conflict error
            if (error.message && error.message.includes('minimum gap requirement')) {
                const gapHoursMatch = error.message.match(/(\d+) hours/);
                const gapHours = gapHoursMatch ? gapHoursMatch : '3';
                
                return this.formatResponse(
                    `I'm sorry, but there's already a reservation within ${gapHours} hours of your requested time. Our restaurant requires a ${gapHours}-hour gap between reservations.\n\nWould you like me to suggest some alternative times that are available?`,
                    'message',
                    { error: true, errorType: 'gap_conflict', gapHours: parseInt(gapHours) }
                );
            }
            
            // Generic error message for other issues
            return this.formatResponse(
                "I apologize, but there was an issue creating your reservation. Please try again or contact us directly.",
                'message',
                { error: true }
            );
        }
    }
}

export default ReservationAgent;