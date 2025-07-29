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
                        // Multiple table types available - show options and hand off to ReservationAgent
                        const availableOptions = tableOptions
                            .sort((a, b) => parseFloat(a.price) - parseFloat(b.price))
                            .map(t => `• ${t.tableType}${parseFloat(t.price) > 0 ? ` (€${t.price})` : ''}`)
                            .join('\n');
                        
                        const checkingMessage = `Okay, checking for availability for a table on ${this.formatDate(timeInfo.date)} at ${this.formatTime(timeInfo.time)} for ${timeInfo.partySize} people...`;
                        const resultsMessage = `Great news! We have tables available for ${this.formatDate(timeInfo.date)} at ${this.formatTime(timeInfo.time)} for ${timeInfo.partySize} people.\n\nWe have different table types available:\n${availableOptions}\n\nWhich type would you prefer?`;
                        
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
    }

export default TableAvailabilityAgent;