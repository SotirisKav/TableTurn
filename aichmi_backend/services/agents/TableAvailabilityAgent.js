/**
 * Table Availability Agent
 * Specializes in handling table availability queries, capacity questions, and providing information about available tables
 */

import BaseAgent from './BaseAgent.js';
import RestaurantService from '../RestaurantService.js';
import RAGService from '../RAGService.js';
import TimezoneUtils from '../../utils/timezoneUtils.js';
import db from '../../config/database.js';

class TableAvailabilityAgent extends BaseAgent {
    constructor() {
        super(
            'TableAvailabilityAgent',
            'Table Availability Specialist',
            ['availability', 'capacity', 'table', 'biggest', 'largest', 'check']
        );
    }

    async processMessage(message, history, restaurantId, context) {
        try {
            console.log(`🔍 ${this.name} processing:`, message);

            // ADVANCED CONTEXT-AWARE LOGIC: Check if this is a direct clarification to a previous table type question
            const isDirectClarification = this.isDirectClarificationToTableTypeQuestion(message, history);
            
            if (isDirectClarification) {
                console.log('🎯 Detected direct clarification - reusing previous context');
                return await this.handleDirectTableTypeClarification(message, history, restaurantId);
            }

            // Use RAG to retrieve relevant data
            const ragData = await this.retrieveRAGData(message, restaurantId);
            
            // Check if this is a capacity/biggest table query
            const isCapacityQuery = this.isCapacityQuery(message);
            
            // Extract time/date information from the message to provide accurate availability
            const timeInfo = await this.extractTimeInfo(message, history);
            
            // Get restaurant data first
            const restaurant = await RestaurantService.getRestaurantById(restaurantId);
            
            // Get table availability data with time-specific checks if available
            const availabilityData = await this.fetchAvailabilityData(restaurant, isCapacityQuery, timeInfo);
            
            // Check if we have all details needed for a complete availability check
            const hasCompleteBookingInfo = timeInfo.date && timeInfo.time && timeInfo.partySize;
            
            if (hasCompleteBookingInfo) {
                console.log('🎯 Complete booking info detected - performing full availability check');
                
                // Get available table types for the specific time
                const availableTableTypes = await RestaurantService.getAvailableTableTypesForTime({
                    restaurantId: restaurantId,
                    reservationDate: timeInfo.date,
                    reservationTime: timeInfo.time,
                    guests: timeInfo.partySize
                });
                
                // Check if user is asking about a specific table type
                const requestedTableType = this.extractRequestedTableType(message);
                
                if (availableTableTypes && availableTableTypes.length > 0) {
                    // Check if user requested a specific table type that's NOT available
                    if (requestedTableType) {
                        const isRequestedTypeAvailable = availableTableTypes.some(t => 
                            t.table_type.toLowerCase() === requestedTableType.toLowerCase()
                        );
                        
                        if (!isRequestedTypeAvailable) {
                            // The requested table type is not available at this time
                            // Suggest alternative times for that table type
                            const alternativeTimes = await this.findAlternativeTimesForTableType(
                                restaurantId, 
                                requestedTableType, 
                                timeInfo.date, 
                                timeInfo.time, 
                                timeInfo.partySize
                            );
                            
                            if (alternativeTimes.length > 0) {
                                const checkingMessage = `Let me check availability for ${requestedTableType} tables specifically...`;
                                const resultsMessage = `I'm sorry, but ${requestedTableType} tables are not available at ${this.formatTime(timeInfo.time)} on ${this.formatDate(timeInfo.date)}. However, I found ${requestedTableType} tables available at these alternative times: ${alternativeTimes.join(', ')}.\n\nWould any of these times work for you?`;
                                
                                return this.formatResponse(`${checkingMessage}|||SPLIT|||${resultsMessage}`, 'two_messages');
                            } else {
                                const checkingMessage = `Let me check availability for ${requestedTableType} tables specifically...`;
                                const resultsMessage = `I'm sorry, but ${requestedTableType} tables are fully booked for ${this.formatDate(timeInfo.date)}. However, we have these table types available at ${this.formatTime(timeInfo.time)}:\n\n${availableTableTypes.map(t => `• ${t.table_type}${parseFloat(t.table_price || 0) > 0 ? ` (€${t.table_price})` : ''}`).join('\n')}\n\nWould any of these work for you instead?`;
                                
                                return this.formatResponse(`${checkingMessage}|||SPLIT|||${resultsMessage}`, 'two_messages');
                            }
                        }
                    }
                }
                
                if (availableTableTypes && availableTableTypes.length > 0) {
                    // Tables are available - format response and prepare context for handoff
                    const tableOptions = availableTableTypes
                        .filter(t => t.capacity >= timeInfo.partySize)
                        .map(t => ({
                            tableType: t.table_type,
                            price: t.table_price || '0.00',
                            capacity: t.capacity
                        }));
                    
                    if (tableOptions.length > 1) {
                        // INTELLIGENT FILTERING: Show only new, previously unmentioned table types
                        const newTableTypes = this.filterOutPreviouslyMentionedTableTypes(tableOptions, history);
                        
                        const checkingMessage = `Okay, checking for availability for a table on ${this.formatDate(timeInfo.date)} at ${this.formatTime(timeInfo.time)} for ${timeInfo.partySize} people...`;
                        
                        let resultsMessage;
                        if (newTableTypes.length > 0) {
                            // Show only new options with contextual phrasing
                            const availableOptions = newTableTypes
                                .sort((a, b) => parseFloat(a.price) - parseFloat(b.price))
                                .map(t => `• ${t.tableType}${parseFloat(t.price) > 0 ? ` (€${t.price})` : ''}`)
                                .join('\n');
                            
                            // Get previously mentioned table types for context
                            const allTableTypes = tableOptions.map(t => t.tableType.toLowerCase());
                            const mentionedTypes = this.getMentionedTableTypes(history);
                            const hasPreviouslyMentioned = mentionedTypes.size > 0;
                            
                            let tableIntroText;
                            if (hasPreviouslyMentioned) {
                                // Contextual phrasing acknowledging previous options
                                if (newTableTypes.length === 1) {
                                    tableIntroText = `We also have ${newTableTypes[0].tableType} tables available from the other options:`;
                                } else {
                                    tableIntroText = `We also have these additional table types available:`;
                                }
                            } else {
                                // First time showing options
                                tableIntroText = `We have different table types available:`;
                            }
                            
                            resultsMessage = `Great news! We have tables available for ${this.formatDate(timeInfo.date)} at ${this.formatTime(timeInfo.time)} for ${timeInfo.partySize} people.\n\n${tableIntroText}\n${availableOptions}\n\nWhich type would you prefer?`;
                        } else {
                            // All table types were already mentioned - proceed directly
                            resultsMessage = `Perfect! We have tables available for ${this.formatDate(timeInfo.date)} at ${this.formatTime(timeInfo.time)} for ${timeInfo.partySize} people. Shall I proceed with the reservation?`;
                        }
                        
                        
                        // Return with handoff context to ReservationAgent
                        return {
                            ...this.formatResponse(`${checkingMessage}|||SPLIT|||${resultsMessage}`, 'two_messages'),
                            ...this.suggestHandoff('reservation', message, {
                                reservationContext: {
                                    date: timeInfo.date,
                                    time: timeInfo.time,
                                    partySize: timeInfo.partySize,
                                    availabilityConfirmed: true,
                                    availableTableTypes: tableOptions
                                }
                            }, restaurantId)
                        };
                        
                    } else if (tableOptions.length === 1) {
                        // Single table type available
                        const tableType = tableOptions[0];
                        const priceText = parseFloat(tableType.price) > 0 ? ` (€${tableType.price})` : '';
                        
                        const checkingMessage = `Okay, checking for availability for a table on ${this.formatDate(timeInfo.date)} at ${this.formatTime(timeInfo.time)} for ${timeInfo.partySize} people...`;
                        const resultsMessage = `Perfect! We have ${tableType.tableType} tables${priceText} available for ${this.formatDate(timeInfo.date)} at ${this.formatTime(timeInfo.time)} for ${timeInfo.partySize} people.\n\nTo complete your reservation, I'll need your name, email, and phone number.`;
                        
                        // Return with handoff context to ReservationAgent
                        return {
                            ...this.formatResponse(`${checkingMessage}|||SPLIT|||${resultsMessage}`, 'two_messages'),
                            ...this.suggestHandoff('reservation', message, {
                                reservationContext: {
                                    date: timeInfo.date,
                                    time: timeInfo.time,
                                    partySize: timeInfo.partySize,
                                    tableType: tableType.tableType,
                                    availabilityConfirmed: true,
                                    availableTableTypes: tableOptions
                                }
                            }, restaurantId)
                        };
                    }
                } else {
                    // No tables available - offer alternatives
                    const checkingMessage = `Okay, checking for availability for a table on ${this.formatDate(timeInfo.date)} at ${this.formatTime(timeInfo.time)} for ${timeInfo.partySize} people...`;
                    const resultsMessage = `I'm sorry, but we don't have any tables available for ${timeInfo.partySize} people at ${this.formatTime(timeInfo.time)} on ${this.formatDate(timeInfo.date)}.\n\nWould you like to try a different date or time?`;
                    
                    return this.formatResponse(`${checkingMessage}|||SPLIT|||${resultsMessage}`, 'two_messages');
                }
            }
            
            // Build system prompt for general availability inquiries
            const systemPrompt = this.buildSystemPrompt(availabilityData, isCapacityQuery, timeInfo);
            
            // Build conversation context
            const conversationHistory = this.buildConversationHistory(history);
            
            // Create full prompt
            const fullPrompt = this.buildPrompt(message, conversationHistory, availabilityData, timeInfo);
            
            // Generate response with RAG context
            const aiResponse = await this.generateResponse(fullPrompt, systemPrompt, ragData);
            
            // For capacity queries, always provide the information first without handoff
            // Only hand off if there's explicit booking intent AND it's not a pure capacity query
            if (!isCapacityQuery && this.shouldHandoffToReservation(message, aiResponse)) {
                return {
                    ...this.formatResponse(aiResponse),
                    ...this.suggestHandoff('reservation', message, {
                        availabilityContext: availabilityData,
                        userIntent: 'booking'
                    }, restaurantId)
                };
            }
            
            return this.formatResponse(aiResponse);
            
        } catch (error) {
            console.error(`❌ ${this.name} error:`, error);
            return this.formatResponse(
                "I apologize, but I'm having trouble checking table availability right now. Please try again in a moment.",
                'message',
                { error: true }
            );
        }
    }

    /**
     * Check if this is a capacity/biggest table query
     */
    isCapacityQuery(message) {
        const capacityKeywords = ['biggest', 'largest', 'maximum', 'capacity', 'big table', 'large table', 'accommodate'];
        const msg = message.toLowerCase();
        return capacityKeywords.some(keyword => msg.includes(keyword));
    }

    /**
     * Extract time/date information from message and history for accurate availability checks
     */
    async extractTimeInfo(message, history) {
    const messageText = message.toLowerCase();
    const fullText = (history.map(h => h.text || '').join(' ') + ' ' + message).toLowerCase();
    const timeInfo = {};
    
    // Extract party size from current message or history
    const partySizeMatch = messageText.match(/(\d+)\s*(?:people|person|guests?|pax)/i) || 
                          fullText.match(/(\d+)\s*(?:people|person|guests?|pax)/i);
    if (partySizeMatch) {
        timeInfo.partySize = parseInt(partySizeMatch[1]);
    }
    
    // Extract date using timezone utils - check current message first, then history
    if (messageText.includes('today') || messageText.includes('tonight')) {
        timeInfo.date = TimezoneUtils.getCurrentAthensDate();
    } else if (messageText.includes('tomorrow')) {
        timeInfo.date = TimezoneUtils.getTomorrowAthensDate();
    } else if (fullText.includes('today') || fullText.includes('tonight')) {
        timeInfo.date = TimezoneUtils.getCurrentAthensDate();
    } else if (fullText.includes('tomorrow')) {
        timeInfo.date = TimezoneUtils.getTomorrowAthensDate();
    } else {
        // Check for weekday names or specific dates
        const parsedDate = TimezoneUtils.parseUserDate(messageText) || TimezoneUtils.parseUserDate(fullText);
        if (parsedDate) {
            timeInfo.date = parsedDate;
        }
    }
    
    // Extract time using timezone utils - PRIORITIZE current message over history
    const parsedTime = TimezoneUtils.parseUserTime(messageText) || TimezoneUtils.parseUserTime(fullText);
    if (parsedTime) {
        timeInfo.time = parsedTime;
    }
    
    // Always check for previously confirmed info and prioritize it over parsed relative dates
    const previouslyConfirmedInfo = this.extractFromPreviousResponses(history);
    
    // Prioritize confirmed dates over relative date parsing (like "tomorrow")
    if (previouslyConfirmedInfo.date) {
        timeInfo.date = previouslyConfirmedInfo.date;
    }
    if (previouslyConfirmedInfo.time && !timeInfo.time) {
        timeInfo.time = previouslyConfirmedInfo.time; 
    }
    if (previouslyConfirmedInfo.partySize && !timeInfo.partySize) {
        timeInfo.partySize = previouslyConfirmedInfo.partySize;
    }
    
    console.log('🕐 Extracted time info with timezone utils:', timeInfo);
    return timeInfo;
}

    /**
     * Fetch table availability data
     */
    async fetchAvailabilityData(restaurant, includeCapacityInfo = false, timeInfo = {}) {
    try {
        const restaurantId = restaurant.restaurant_id;

        // Fetch static data
        const hours = await RestaurantService.getRestaurantHours(restaurantId);
        const fullyBookedDates = await RestaurantService.getFullyBookedDates(restaurantId);

        let capacityInfo = null;
        if (includeCapacityInfo) {
            capacityInfo = await this.getTableCapacityInfo(restaurantId);
        }

        // Only fetch real-time availability if we have all required info: date, time, and party size
        let realTimeAvailability = null;
        if (timeInfo.date && timeInfo.time && timeInfo.partySize) {
            console.log(`🕐 Checking real-time availability for ${timeInfo.partySize} people on ${timeInfo.date} at ${timeInfo.time}`);

            realTimeAvailability = await RestaurantService.getAvailableTableTypesForTime({
                restaurantId: restaurantId,
                reservationDate: timeInfo.date,
                reservationTime: timeInfo.time,
                guests: timeInfo.partySize
            });

            console.log('📊 Real-time availability from DB:', realTimeAvailability);
        }

        return {
            restaurant,
            hours: hours || [],
            fullyBookedDates: fullyBookedDates || [],
            capacityInfo,
            realTimeAvailability,
            timeInfo
        };

    } catch (error) {
        console.error('❌ Error fetching availability data:', error);
        throw error;
    }
}

    /**
     * Get detailed table capacity information
     */
    async getTableCapacityInfo(restaurantId) {
        try {
            const query = `
                SELECT 
                    table_type,
                    capacity,
                    table_price,
                    COUNT(*) as total_tables,
                    MAX(capacity) as max_capacity
                FROM tables 
                WHERE restaurant_id = $1 
                GROUP BY table_type, capacity, table_price
                ORDER BY capacity DESC, table_price ASC
            `;
            
            const result = await db.query(query, [restaurantId]);
            
            // Find the biggest table
            const biggestTable = result.reduce((max, table) => 
                table.capacity > (max?.capacity || 0) ? table : max, null);
            
            return {
                tables: result,
                biggestTable,
                maxCapacity: biggestTable?.capacity || 0
            };
            
        } catch (error) {
            console.error('❌ Error fetching capacity info:', error);
            return null;
        }
    }

    /**
     * Build system prompt for availability queries
     */
    buildSystemPrompt(availabilityData, isCapacityQuery, timeInfo = {}) {
        const { restaurant, hours, capacityInfo, realTimeAvailability } = availabilityData;
        const timeContext = TimezoneUtils.getCurrentContext(restaurant.timezone);

        let prompt = `You are AICHMI, a friendly restaurant host for ${restaurant.name}. You handle table availability inquiries just like a real person would at the front desk.

CURRENT DATE & TIME CONTEXT (${restaurant.timezone}):
- CURRENT DATE & TIME: ${timeContext.currentDateTime}
- TODAY: ${timeContext.today.display} (${timeContext.today.date})
- TOMORROW: ${timeContext.tomorrow.display} (${timeContext.tomorrow.date})

CONVERSATION FLOW (like a real host):
1. When someone asks about availability, ALWAYS ask "How many people will be joining you?" first
2. Once you have party size, ask for preferred time if not given
3. Only THEN check and show availability for their specific party size
4. Be warm, conversational, and helpful - not technical

PERSONALITY:
- Speak naturally like a friendly restaurant host
- Use conversational language, not technical lists
- Guide toward booking when they show interest
- Don't overwhelm with unnecessary options

`;

        // Only show availability if we have all details: date, time, and party size
        if (realTimeAvailability && timeInfo.date && timeInfo.time && timeInfo.partySize) {
            const relevantTables = realTimeAvailability.filter(t => t.capacity >= timeInfo.partySize);
            
            if (relevantTables.length > 0) {
                prompt += `AVAILABILITY FOR ${timeInfo.partySize} PEOPLE ON ${timeInfo.date} AT ${timeInfo.time}:\n`;
                prompt += `✅ Good news! We have these options for your party:\n`;
                relevantTables.forEach(t => {
                    const price = parseFloat(t.table_price || 0);
                    const priceText = price > 0 ? ` (€${price} table fee)` : '';
                    prompt += `- ${t.table_type} table${priceText}\n`;
                });
                prompt += `\nWould you like to make a reservation for one of these?`;
            } else {
                prompt += `❌ I'm sorry, we don't have any tables available for ${timeInfo.partySize} people at ${timeInfo.time} on ${timeInfo.date}. `;
                prompt += `Would you like to try a different time?`;
            }
        }

        if (isCapacityQuery && capacityInfo) {
            prompt += `CAPACITY INFORMATION:
- Our largest table seats ${capacityInfo.maxCapacity || 'N/A'} people
- We have different table sizes available

After answering, ask: "How many people will be joining you so I can check what's available?"`;
        }

        return prompt;
    }

        buildPrompt(message, conversationHistory, availabilityData, timeInfo = {}) {
            let prompt = `Previous conversation:\n${conversationHistory || 'None'}\n\nCurrent user query: ${message}\n\nPlease help the guest understand table availability for ${availabilityData.restaurant.name}.`;

            if (timeInfo.date && timeInfo.time) {
                prompt += ` The user is asking about ${timeInfo.date} at ${timeInfo.time}. Use the REAL-TIME AVAILABILITY data to give an accurate answer.`;
            }

            prompt += ` If they show interest in booking, guide them towards making a reservation.`;
            return prompt;
        }

        shouldHandoffToReservation(message, response) {
            const bookingKeywords = ['book', 'reserve', 'make a reservation', 'proceed', 'go ahead', 'that works', 'perfect', 'yes please', 'let\'s book'];
            const msg = message.toLowerCase();
            const resp = response.toLowerCase();
            const userWantsToBook = bookingKeywords.some(keyword => msg.includes(keyword));
            const responseOffersBooking = resp.includes('would you like to book') || resp.includes('shall we proceed');
            return userWantsToBook || responseOffersBooking;
        }

    
    formatDate(dateString) {
        return TimezoneUtils.formatDateForDisplay(dateString);
    }

    formatTime(timeString) {
        return TimezoneUtils.formatTimeForDisplay(timeString);
    }

    /**
     * Get table types that were mentioned in previous AI responses
     */
    getMentionedTableTypes(history) {
        const mentionedTypes = new Set();
        
        if (!history || history.length === 0) {
            return mentionedTypes;
        }
        
        for (const msg of history) {
            if (msg.sender === 'ai' && msg.text) {
                const text = msg.text.toLowerCase();
                
                // Look for table type mentions in bullet points or list format
                const bulletMatches = text.match(/• ([a-z]+)(?:\s*\(.*?\))?/g);
                if (bulletMatches) {
                    bulletMatches.forEach(match => {
                        const typeMatch = match.match(/• ([a-z]+)/);
                        if (typeMatch) {
                            mentionedTypes.add(typeMatch[1]);
                        }
                    });
                }
                
                // Also look for direct mentions like "standard tables", "grass tables", etc.
                const tableTypes = ['standard', 'grass', 'anniversary', 'vip', 'private', 'romantic', 'premium', 'terrace', 'garden', 'outdoor'];
                tableTypes.forEach(type => {
                    if (text.includes(`${type} table`) || text.includes(`• ${type}`)) {
                        mentionedTypes.add(type);
                    }
                });
            }
        }
        
        return mentionedTypes;
    }

    /**
     * Filter out table types that were already mentioned in previous AI responses
     */
    /**
     * Filter out table types that were already mentioned in previous AI responses
     * Modified to be more transparent about availability
     */
    filterOutPreviouslyMentionedTableTypes(tableOptions, history) {
        // For transparency, always show all available options on the first availability check
        // This prevents confusion when users ask about unavailable table types later
        if (!history || history.length === 0) {
            return tableOptions;
        }
        
        // Check if this is the first time showing availability results
        const hasShownAvailabilityBefore = history.some(msg => 
            msg.sender === 'ai' && 
            msg.text && 
            (msg.text.includes('table types available') || msg.text.includes('• '))
        );
        
        if (!hasShownAvailabilityBefore) {
            console.log('🔍 First availability check - showing all available table types for transparency');
            return tableOptions;
        }
        
        // Get all table types mentioned in previous AI responses
        const mentionedTypes = this.getMentionedTableTypes(history);
        
        // Filter out already mentioned types
        const newTableTypes = tableOptions.filter(option => 
            !mentionedTypes.has(option.tableType.toLowerCase())
        );
        
        console.log(`🔍 Table filtering: ${mentionedTypes.size} types mentioned before, ${newTableTypes.length}/${tableOptions.length} new types to show`);
        
        return newTableTypes;
    }

    /**
     * Check if user message is a direct clarification to a previous table type question
     */
    isDirectClarificationToTableTypeQuestion(message, history) {
        if (!history || history.length < 2) return false;
        
        const lastAiMessage = history[history.length - 1];
        const isLastMessageTableTypeQuestion = lastAiMessage && 
            lastAiMessage.sender === 'ai' && 
            lastAiMessage.text && 
            (lastAiMessage.text.includes('Which type would you prefer?') || 
             lastAiMessage.text.includes('different table types available'));
        
        const requestedTableType = this.extractRequestedTableType(message);
        
        return isLastMessageTableTypeQuestion && requestedTableType !== null;
    }

    /**
     * Handle direct table type clarification with context reuse
     */
    async handleDirectTableTypeClarification(message, history, restaurantId) {
        // Reuse timeInfo context from previous turn
        const timeInfo = await this.extractTimeInfo(message, history);
        const requestedTableType = this.extractRequestedTableType(message);
        
        console.log(`🔄 Direct clarification for ${requestedTableType} tables on ${timeInfo.date} at ${timeInfo.time} for ${timeInfo.partySize} people`);
        
        // Query database for the newly requested table type
        const availableTableTypes = await RestaurantService.getAvailableTableTypesForTime({
            restaurantId: restaurantId,
            reservationDate: timeInfo.date,
            reservationTime: timeInfo.time,
            guests: timeInfo.partySize
        });
        
        // Check if requested type is available
        const isRequestedTypeAvailable = availableTableTypes.some(t => 
            t.table_type.toLowerCase() === requestedTableType.toLowerCase()
        );
        
        if (isRequestedTypeAvailable) {
            // Requested type is available - provide direct positive answer
            const requestedTable = availableTableTypes.find(t => 
                t.table_type.toLowerCase() === requestedTableType.toLowerCase()
            );
            const priceText = parseFloat(requestedTable.table_price || 0) > 0 ? ` (€${requestedTable.table_price})` : '';
            
            const response = `Yes! We do have ${requestedTableType} tables${priceText} available for ${timeInfo.partySize} people on ${this.formatDate(timeInfo.date)} at ${this.formatTime(timeInfo.time)}. Would you like me to reserve a ${requestedTableType} table for you?`;
            
            // Hand off to ReservationAgent with confirmed availability
            return {
                ...this.formatResponse(response),
                ...this.suggestHandoff('reservation', message, {
                    reservationContext: {
                        date: timeInfo.date,
                        time: timeInfo.time,
                        partySize: timeInfo.partySize,
                        tableType: requestedTableType,
                        availabilityConfirmed: true
                    }
                }, restaurantId)
            };
        } else {
            // Requested type is NOT available - find alternative times for that specific table type
            const alternativeTimes = await this.findAlternativeTimesForTableType(
                restaurantId, 
                requestedTableType, 
                timeInfo.date, 
                timeInfo.time, 
                timeInfo.partySize
            );
            
            if (alternativeTimes.length > 0) {
                const response = `I'm sorry, but ${requestedTableType} tables are not available at ${this.formatTime(timeInfo.time)} on ${this.formatDate(timeInfo.date)}. However, I found ${requestedTableType} tables available at these alternative times: ${alternativeTimes.join(', ')}.\n\nWould any of these times work for you?`;
                return this.formatResponse(response);
            } else {
                // No alternative times - suggest other available table types
                const availableOptions = availableTableTypes
                    .filter(t => t.capacity >= timeInfo.partySize)
                    .sort((a, b) => parseFloat(a.table_price || 0) - parseFloat(b.table_price || 0))
                    .map(t => `• ${t.table_type}${parseFloat(t.table_price || 0) > 0 ? ` (€${t.table_price})` : ''}`)
                    .join('\n');
                
                const response = `I'm sorry, but ${requestedTableType} tables are fully booked for ${this.formatDate(timeInfo.date)}. However, we have these table types available at ${this.formatTime(timeInfo.time)}:\n\n${availableOptions}\n\nWould any of these work for you instead?`;
                return this.formatResponse(response);
            }
        }
    }

    /**
     * Extract date/time/party size from previous AI responses that confirmed specific details
     */
    extractFromPreviousResponses(history) {
        const confirmedInfo = {};
        
        if (!history || history.length === 0) {
            return confirmedInfo;
        }
        
        // Look through AI responses for confirmed date/time patterns
        for (const msg of history) {
            if (msg.sender === 'ai' && msg.text) {
                const text = msg.text;
                
                // Look for confirmed date patterns like "July 30, 2025" or "2025-07-30"
                const datePattern = /(July|August|September|October|November|December|January|February|March|April|May|June)\s+(\d{1,2}),?\s+(\d{4})/i;
                const dateMatch = text.match(datePattern);
                if (dateMatch) {
                    const monthName = dateMatch[1];
                    const day = dateMatch[2].padStart(2, '0');
                    const year = dateMatch[3];
                    
                    const monthMap = {
                        'january': '01', 'february': '02', 'march': '03', 'april': '04',
                        'may': '05', 'june': '06', 'july': '07', 'august': '08',
                        'september': '09', 'october': '10', 'november': '11', 'december': '12'
                    };
                    
                    const month = monthMap[monthName.toLowerCase()];
                    if (month) {
                        confirmedInfo.date = `${year}-${month}-${day}`;
                    }
                }
                
                // Look for confirmed time patterns like "8pm" or "20:00"
                const timePattern = /(\d{1,2})(?::(\d{2}))?\s*(pm|am|p\.m\.|a\.m\.)?/i;
                const timeMatch = text.match(timePattern);
                if (timeMatch) {
                    let hour = parseInt(timeMatch[1]);
                    const minute = timeMatch[2] || '00';
                    const period = timeMatch[3];
                    
                    if (period && (period.toLowerCase().includes('pm') || period.toLowerCase().includes('p.m.'))) {
                        if (hour !== 12) hour += 12;
                    } else if (period && (period.toLowerCase().includes('am') || period.toLowerCase().includes('a.m.'))) {
                        if (hour === 12) hour = 0;
                    }
                    
                    confirmedInfo.time = `${hour.toString().padStart(2, '0')}:${minute}`;
                }
                
                // Look for confirmed party size like "for 2 people"
                const partySizePattern = /for\s+(\d+)\s+people/i;
                const partySizeMatch = text.match(partySizePattern);
                if (partySizeMatch) {
                    confirmedInfo.partySize = parseInt(partySizeMatch[1]);
                }
            }
        }
        
        return confirmedInfo;
    }

    /**
     * Extract the requested table type from user message
     */
    extractRequestedTableType(message) {
        const lowerMessage = message.toLowerCase();
        
        // Look for specific table type mentions
        const tableTypes = ['standard', 'grass', 'anniversary', 'vip', 'private', 'romantic', 'premium', 'terrace', 'garden', 'outdoor'];
        
        for (const tableType of tableTypes) {
            if (lowerMessage.includes(tableType)) {
                return tableType;
            }
        }
        
        return null;
    }

    /**
     * Find alternative times for a specific table type
     */
    async findAlternativeTimesForTableType(restaurantId, tableType, date, requestedTime, partySize) {
        try {
            const alternatives = [];
            
            // Get restaurant hours for this day
            const restaurantHours = await RestaurantService.getRestaurantHours(restaurantId);
            const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
            const dayHours = restaurantHours.find(h => h.day_of_week === dayName);
            
            if (!dayHours) {
                return [];
            }
            
            // Generate time slots (every 30 minutes)
            const [hours, minutes] = requestedTime.split(':').map(Number);
            const timeOffsets = [-90, -60, -30, 30, 60, 90, 120]; // ±30min, ±1h, ±1.5h, +2h
            
            for (const offset of timeOffsets) {
                const newTotalMinutes = hours * 60 + minutes + offset;
                const newHours = Math.floor(newTotalMinutes / 60) % 24;
                const newMins = newTotalMinutes % 60;
                
                // Handle negative times
                if (newTotalMinutes < 0) continue;
                
                const timeString = `${newHours.toString().padStart(2, '0')}:${Math.abs(newMins).toString().padStart(2, '0')}`;
                
                // Check if time is within restaurant hours
                if (this.isTimeWithinHours(timeString, dayHours.open_time, dayHours.close_time)) {
                    // Check availability for this specific table type and time
                    const availableTypes = await RestaurantService.getAvailableTableTypesForTime({
                        restaurantId,
                        reservationDate: date,
                        reservationTime: timeString,
                        guests: partySize
                    });
                    
                    // Check if the requested table type is available at this time
                    const isTableTypeAvailable = availableTypes.some(t => 
                        t.table_type.toLowerCase() === tableType.toLowerCase() && t.capacity >= partySize
                    );
                    
                    if (isTableTypeAvailable) {
                        alternatives.push(TimezoneUtils.formatTimeForDisplay(timeString));
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
     * Check if time is within restaurant hours
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
}

export default TableAvailabilityAgent;