/**
 * Location & Transfer Agent
 * Specializes in location information, directions, and transfer services
 */

import BaseAgent from './BaseAgent.js';
import RestaurantService from '../RestaurantService.js';

class LocationTransferAgent extends BaseAgent {
    constructor() {
        super(
            'LocationTransferAgent',
            'Location & Transfer Specialist',
            ['location', 'address', 'transfer', 'transport', 'directions', 'pickup']
        );
    }

    async processMessage(message, history, restaurantId, context) {
        try {
            console.log(`📍 ${this.name} processing:`, message);

            // Fetch location and transfer data
            const locationData = await this.fetchLocationData(restaurantId);
            
            // Build system prompt
            const systemPrompt = this.buildSystemPrompt(locationData);
            
            // Build conversation context
            const conversationHistory = this.buildConversationHistory(history);
            
            // Create full prompt
            const fullPrompt = this.buildPrompt(message, conversationHistory, locationData);
            
            // Generate response
            const aiResponse = await this.generateResponse(fullPrompt, systemPrompt);
            
            return this.formatResponse(aiResponse);
            
        } catch (error) {
            console.error(`❌ ${this.name} error:`, error);
            return this.formatResponse(
                "I apologize, but I'm having trouble accessing location information right now. Please try again in a moment.",
                'message',
                { error: true }
            );
        }
    }

    async fetchLocationData(restaurantId) {
        try {
            // Fetch restaurant info
            const restaurant = await RestaurantService.getRestaurantById(restaurantId);
            
            // Fetch transfer pricing and areas
            const transferPrices = await RestaurantService.getTransferPrices(restaurantId);
            const transferAreas = await RestaurantService.getTransferAreas();
            
            return {
                restaurant,
                transferPrices: transferPrices || [],
                transferAreas: transferAreas || [],
                hasTransferService: transferPrices && transferPrices.length > 0
            };
            
        } catch (error) {
            console.error('❌ Error fetching location data:', error);
            throw error;
        }
    }

    buildSystemPrompt(locationData) {
        const { restaurant, transferPrices, transferAreas, hasTransferService } = locationData;
        
        return `You are AICHMI, a location and transfer specialist for ${restaurant.name} in Kos, Greece.

RESTAURANT LOCATION:
- Name: ${restaurant.name}
- Address: ${restaurant.address || restaurant.island + ', ' + restaurant.area}
- Area: ${restaurant.area || 'Kos'}
- Island: ${restaurant.island || 'Kos'}
- Coordinates: Available for GPS navigation

LOCATION DETAILS:
- Situated in the beautiful Greek island of Kos
- Easy access from main roads and tourist areas
- Parking information available
- Walking distance to local attractions
- Beautiful Mediterranean setting

${hasTransferService ? `TRANSFER SERVICE:

PICKUP AREAS & PRICING:
${transferPrices.map(price => 
    `- ${price.area}: ${price.price}€ per person`
).join('\n')}

AVAILABLE PICKUP LOCATIONS:
${transferAreas.map(area => `- ${area.area_name}: ${area.description || 'Hotel pickup available'}`).join('\n')}

TRANSFER DETAILS:
- Professional drivers with local knowledge
- Comfortable, air-conditioned vehicles
- Pickup from major hotels and areas
- Return transfer available
- Advanced booking recommended
- Group discounts may apply
` : 'Transfer service information available upon request.'}

YOUR ROLE:
- Provide clear directions to the restaurant
- Help guests understand the location and surroundings
- Explain transfer service options and pricing
- Assist with pickup arrangements from hotels
- Share information about the area and nearby attractions
- Help guests plan their journey to the restaurant

EXPERTISE AREAS:
- Detailed location and directions
- Transfer service coordination
- Hotel pickup arrangements
- Local area information
- Transportation options
- Parking and accessibility
- Nearby attractions and landmarks

GUIDELINES:
- Be helpful and precise with location information
- Explain transfer options clearly with pricing
- Help guests choose the best transportation method
- Provide local area context and attractions
- Be knowledgeable about Kos island geography
- Assist with pickup coordination when needed
- Always confirm details for transfer bookings
- Share the beauty and accessibility of the location

Remember: You're helping guests easily reach the wonderful ${restaurant.name} experience!`;
    }

    buildPrompt(message, conversationHistory, locationData) {
        let prompt = '';
        
        if (conversationHistory) {
            prompt += `Previous conversation:\n${conversationHistory}\n\n`;
        }
        
        prompt += `Current user message: ${message}

Please help the guest with location information and transfer options for ${locationData.restaurant.name}. Provide clear directions, explain transfer services, and assist with transportation planning.`;

        return prompt;
    }
}

export default LocationTransferAgent;