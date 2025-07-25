/**
 * Restaurant Info Agent
 * Specializes in providing restaurant information, hours, atmosphere, and general details
 */

import BaseAgent from './BaseAgent.js';
import RestaurantService from '../RestaurantService.js';

class RestaurantInfoAgent extends BaseAgent {
    constructor() {
        super(
            'RestaurantInfoAgent',
            'Restaurant Information Specialist',
            ['restaurant', 'info', 'hours', 'atmosphere', 'description']
        );
    }

    async processMessage(message, history, restaurantId, context) {
        try {
            console.log(`🏪 ${this.name} processing:`, message);

            // Check if we have a valid restaurant ID
            if (!restaurantId || restaurantId === 'null' || restaurantId === 'undefined') {
                return {
                    response: "I need to know which restaurant you're asking about. Please select a restaurant first or visit a specific restaurant page.",
                    requiresInput: false,
                    isComplete: true
                };
            }

            // Use RAG to retrieve relevant data
            const ragData = await this.retrieveRAGData(message, restaurantId);
            
            // Fetch restaurant data (still needed for system prompt)
            const restaurantData = await this.fetchRestaurantData(restaurantId);
            
            // Build system prompt with restaurant information
            const systemPrompt = this.buildSystemPrompt(restaurantData);
            
            // Build conversation context
            const conversationHistory = this.buildConversationHistory(history);
            
            // Create full prompt
            const fullPrompt = this.buildPrompt(message, conversationHistory, restaurantData);
            
            // Generate response with RAG context
            const aiResponse = await this.generateResponse(fullPrompt, systemPrompt, ragData);
            
            // Check if user is asking about reservations (suggest handoff)
            if (this.shouldHandoffToReservation(message)) {
                return {
                    ...this.formatResponse(aiResponse),
                    ...this.suggestHandoff('reservation', message, {
                        restaurant: restaurantData,
                        userInterest: 'booking'
                    })
                };
            }
            
            // Check if user is asking about menu (suggest handoff)
            if (this.shouldHandoffToMenu(message)) {
                return {
                    ...this.formatResponse(aiResponse),
                    ...this.suggestHandoff('menu', message, {
                        restaurant: restaurantData,
                        userInterest: 'menu'
                    })
                };
            }
            
            return this.formatResponse(aiResponse);
            
        } catch (error) {
            console.error(`❌ ${this.name} error:`, error);
            return this.formatResponse(
                "I apologize, but I'm having trouble accessing restaurant information right now. Please try again in a moment.",
                'message',
                { error: true }
            );
        }
    }

    async fetchRestaurantData(restaurantId) {
        try {
            // Check if restaurantId is valid
            if (!restaurantId || restaurantId === 'null' || restaurantId === 'undefined') {
                throw new Error(`Restaurant not found: ${restaurantId}`);
            }
            
            // Fetch basic restaurant info
            const restaurant = await RestaurantService.getRestaurantById(restaurantId);
            
            if (!restaurant) {
                throw new Error(`Restaurant not found: ${restaurantId}`);
            }

            // Fetch operating hours
            const hours = await RestaurantService.getRestaurantHours(restaurantId);
            
            return {
                restaurant,
                hours: hours || [],
                hasHours: hours && hours.length > 0
            };
            
        } catch (error) {
            console.error('❌ Error fetching restaurant data:', error);
            throw error;
        }
    }

    buildSystemPrompt(restaurantData) {
        const { restaurant, hours } = restaurantData;
        
        return `You are AICHMI, a friendly AI assistant for ${restaurant.name}. Provide helpful, concise information about the restaurant.

PERSONALITY:
- Be warm but concise
- Match the user's energy level - if they say "hey", respond simply
- For basic greetings, keep responses short and welcoming
- Only elaborate when asked specific questions

RESTAURANT: ${restaurant.name}, ${restaurant.address || restaurant.area}
CUISINE: ${restaurant.cuisine || 'Greek'}

${hours?.length > 0 ? `HOURS: ${hours.map(h => `${h.day_of_week}: ${h.open_time}-${h.close_time}`).join(', ')}` : ''}

RESPONSE GUIDELINES:
- For simple greetings ("hey", "hello", "hi"): Respond with a brief, friendly greeting and ask how you can help
- For specific questions: Provide relevant details about the restaurant
- For reservations: Offer to help with booking
- For menu questions: Offer to discuss menu options
- Always end with a simple question to continue the conversation

EXAMPLE RESPONSES:
- User: "hey" → "Hi there! How can I help you today with ${restaurant.name}?"
- User: "hello" → "Hello! Welcome to ${restaurant.name}. What can I help you with?"
- User: "tell me about the restaurant" → [Then provide detailed information]`;
    }

    buildPrompt(message, conversationHistory, restaurantData) {
        let prompt = '';
        
        if (conversationHistory) {
            prompt += `Previous conversation:\n${conversationHistory}\n\n`;
        }
        
        prompt += `Current user message: ${message}

Please provide helpful information about ${restaurantData.restaurant.name}. Focus on what makes this restaurant special, the atmosphere, location details, operating hours, and general information that would interest a potential guest.`;

        return prompt;
    }

    shouldHandoffToReservation(message) {
        const reservationKeywords = [
            'book', 'reserve', 'table', 'available', 'reservation',
            'date', 'time', 'party', 'guests', 'booking'
        ];
        
        const msg = message.toLowerCase();
        return reservationKeywords.some(keyword => msg.includes(keyword));
    }

    shouldHandoffToMenu(message) {
        const menuKeywords = [
            'menu', 'dish', 'food', 'price', 'cost', 'order',
            'eat', 'meal', 'what do you serve', 'speciality'
        ];
        
        const msg = message.toLowerCase();
        return menuKeywords.some(keyword => msg.includes(keyword));
    }
}

export default RestaurantInfoAgent;