/**
 * Table Availability Agent
 * Specializes in handling table availability queries, capacity questions, and providing information about available tables
 */

import BaseAgent from './BaseAgent.js';
import RestaurantService from '../RestaurantService.js';
import RAGService from '../RAGService.js';
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
            
            // Get table availability data
            const availabilityData = await this.fetchAvailabilityData(restaurantId, isCapacityQuery);
            
            // Build system prompt
            const systemPrompt = this.buildSystemPrompt(availabilityData, isCapacityQuery);
            
            // Build conversation context
            const conversationHistory = this.buildConversationHistory(history);
            
            // Create full prompt
            const fullPrompt = this.buildPrompt(message, conversationHistory, availabilityData);
            
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
     * Fetch table availability data
     */
    async fetchAvailabilityData(restaurantId, includeCapacityInfo = false) {
        try {
            // Fetch restaurant info
            const restaurant = await RestaurantService.getRestaurantById(restaurantId);
            
            // Fetch table types and inventory
            const tableTypes = await RestaurantService.getTableTypes(restaurantId);
            const tableInventory = await RestaurantService.getTableInventory(restaurantId);
            
            // Fetch operating hours
            const hours = await RestaurantService.getRestaurantHours(restaurantId);
            
            // Fetch fully booked dates
            const fullyBookedDates = await RestaurantService.getFullyBookedDates(restaurantId);
            
            let capacityInfo = null;
            if (includeCapacityInfo) {
                // Get detailed table information for capacity queries
                capacityInfo = await this.getTableCapacityInfo(restaurantId);
            }
            
            return {
                restaurant,
                tableTypes: tableTypes || [],
                tableInventory: tableInventory || [],
                hours: hours || [],
                fullyBookedDates: fullyBookedDates || [],
                capacityInfo
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
    buildSystemPrompt(availabilityData, isCapacityQuery) {
        const { restaurant, tableTypes, tableInventory, capacityInfo } = availabilityData;
        
        const currentDate = new Date();
        const tomorrow = new Date(currentDate);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        let prompt = `You are AICHMI, a table availability specialist for ${restaurant.name}. Your role is to help guests understand table availability, capacity, and options without making actual reservations.

CURRENT DATE CONTEXT:
- TODAY: ${currentDate.toDateString()} (${currentDate.toISOString().slice(0, 10)})
- TOMORROW: ${tomorrow.toDateString()} (${tomorrow.toISOString().slice(0, 10)})

PERSONALITY:
- Be informative and helpful about availability
- Provide specific details about table options
- When users show interest in booking, guide them towards making a reservation
- Don't collect reservation details - that's the reservation specialist's job

AVAILABLE TABLE TYPES & INVENTORY:
${tableTypes.map(table => `- ${table.table_type}: €${table.table_price || 0} (${tableInventory.find(inv => inv.table_type === table.table_type)?.total_tables || 0} tables available)`).join('\n')}`;

        if (isCapacityQuery && capacityInfo) {
            prompt += `

CAPACITY INFORMATION:
- Biggest table available: ${capacityInfo.biggestTable?.table_type || 'Standard'} table (capacity: ${capacityInfo.maxCapacity || 'N/A'} people)
- Maximum capacity we can accommodate: ${capacityInfo.maxCapacity || 'N/A'} people per table

TABLE CAPACITY BREAKDOWN:
${capacityInfo.tables.map(table => `- ${table.table_type}: up to ${table.capacity} people (${table.total_tables} available)`).join('\n')}`;
        }

        prompt += `

AVAILABILITY CHECKING:
- For specific date/time availability checks, provide clear information
- If asked about specific dates that are fully booked, explain alternatives
- For capacity questions, emphasize our biggest table options
- Always mention that they can proceed to make a reservation if interested

IMPORTANT RESPONSES:
- When asked about "biggest/largest table" → provide specific capacity info and table type, then ask if they'd like to book
- When asked about availability for specific dates → check against fully booked dates
- For capacity queries, focus on providing the information requested first
- Don't ask for contact details or create reservations - refer them to reservation process

BOOKING TRANSITION:
Only suggest booking AFTER answering the availability/capacity question. For capacity queries, say something like: "Our biggest table is a [table type] that seats [X] people at €[price]. Would you like to make a reservation for this table?"`;

        return prompt;
    }

    /**
     * Build prompt for availability queries
     */
    buildPrompt(message, conversationHistory, availabilityData) {
        let prompt = '';
        
        if (conversationHistory) {
            prompt += `Previous conversation:\n${conversationHistory}\n\n`;
        }
        
        prompt += `Current user query: ${message}

Please help the guest understand table availability for ${availabilityData.restaurant.name}. Focus on providing clear information about table options, capacity, and availability. If they show interest in booking, guide them towards making a reservation.`;

        return prompt;
    }

    /**
     * Check if user wants to proceed with booking
     */
    shouldHandoffToReservation(message, response) {
        const bookingKeywords = [
            'book', 'reserve', 'make a reservation', 'proceed', 'go ahead', 
            'that works', 'perfect', 'yes please', 'let\'s book', 'i want to book',
            'can you book', 'book it', 'reserve it', 'make reservation'
        ];
        
        const msg = message.toLowerCase();
        const resp = response.toLowerCase();
        
        // Check if user message indicates booking intent
        const userWantsToBook = bookingKeywords.some(keyword => msg.includes(keyword));
        
        // Check if response suggests booking transition
        const responseOffersBooking = resp.includes('proceed with making a reservation') || 
                                    resp.includes('would you like to book') ||
                                    resp.includes('shall we proceed');
        
        return userWantsToBook || responseOffersBooking;
    }
}

export default TableAvailabilityAgent;