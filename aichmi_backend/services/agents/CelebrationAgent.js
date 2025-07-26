/**
 * Celebration & Add-ons Agent
 * Specializes in special occasions, celebrations, and additional services
 */

import BaseAgent from './BaseAgent.js';
import RestaurantService from '../RestaurantService.js';

class CelebrationAgent extends BaseAgent {
    constructor() {
        super(
            'CelebrationAgent',
            'Celebration & Special Occasions Specialist',
            ['celebration', 'birthday', 'anniversary', 'special', 'romantic', 'cake', 'flowers']
        );
    }

    async processMessage(message, history, restaurantId, context) {
        try {
            console.log(`🎉 ${this.name} processing:`, message);

            // Fetch celebration and add-on data
            const celebrationData = await this.fetchCelebrationData(restaurantId);
            
            // Build system prompt
            const systemPrompt = this.buildSystemPrompt(celebrationData);
            
            // Build conversation context
            const conversationHistory = this.buildConversationHistory(history);
            
            // Create full prompt
            const fullPrompt = this.buildPrompt(message, conversationHistory, celebrationData);
            
            // Generate response
            const aiResponse = await this.generateResponse(fullPrompt, systemPrompt);
            
            // Check if user wants to proceed with reservation (suggest handoff)
            if (this.shouldHandoffToReservation(message)) {
                return {
                    ...this.formatResponse(aiResponse),
                    ...this.suggestHandoff('reservation', message, {
                        restaurant: celebrationData.restaurant,
                        userInterest: 'celebration_booking',
                        celebrationDetails: this.extractCelebrationDetails(message)
                    }, restaurantId)
                };
            }
            
            return this.formatResponse(aiResponse);
            
        } catch (error) {
            console.error(`❌ ${this.name} error:`, error);
            return this.formatResponse(
                "I apologize, but I'm having trouble accessing celebration services right now. Please try again in a moment.",
                'message',
                { error: true }
            );
        }
    }

    async fetchCelebrationData(restaurantId) {
        try {
            // Fetch restaurant info
            const restaurant = await RestaurantService.getRestaurantById(restaurantId);
            
            // Note: Add-on pricing would typically come from a separate table
            // For now, we'll use standard pricing structure
            const addOnPricing = {
                cake: { price: 25, description: 'Beautiful celebration cake with personalized message' },
                flowers: { price: 15, description: 'Fresh flower arrangement for your table' },
                champagne: { price: 35, description: 'Bottle of champagne for toasting' },
                decorations: { price: 20, description: 'Table decorations for special occasions' }
            };
            
            return {
                restaurant,
                addOnPricing,
                celebrationTypes: [
                    'Birthday', 'Anniversary', 'Engagement', 'Proposal', 
                    'Wedding Celebration', 'Graduation', 'Business Celebration',
                    'Family Reunion', 'Romantic Dinner', 'Special Achievement'
                ]
            };
            
        } catch (error) {
            console.error('❌ Error fetching celebration data:', error);
            throw error;
        }
    }

    buildSystemPrompt(celebrationData) {
        const { restaurant, addOnPricing, celebrationTypes } = celebrationData;
        
        return `You are AICHMI, a celebration and special occasions specialist for ${restaurant.name} in Kos, Greece.

RESTAURANT: ${restaurant.name}
LOCATION: ${restaurant.address || restaurant.island + ', ' + restaurant.area}
SETTING: Perfect for romantic dinners and special celebrations

CELEBRATION SERVICES:

SPECIAL OCCASION TYPES:
${celebrationTypes.map(type => `- ${type}`).join('\n')}

ADD-ON SERVICES & PRICING:
${Object.entries(addOnPricing).map(([service, details]) => 
    `- ${service.charAt(0).toUpperCase() + service.slice(1)}: ${details.price}€
  ${details.description}`
).join('\n')}

CELEBRATION SPECIALTIES:
- Romantic table settings with candles and ambiance
- Personalized decorations for the occasion
- Special seating arrangements for intimate celebrations
- Coordinated timing for surprise elements
- Professional photography assistance available
- Custom celebration packages
- Surprise coordination with restaurant staff

YOUR ROLE:
- Help plan perfect celebrations and special occasions
- Recommend appropriate add-ons and services
- Coordinate timing and special arrangements
- Suggest romantic and celebration-friendly table options
- Ensure memorable experiences for special moments
- Handle surprise coordination with discretion
- Connect celebration services with reservation process

EXPERTISE AREAS:
- All types of celebrations and special occasions
- Romantic dinner planning
- Surprise coordination and timing
- Add-on services and pricing
- Table decoration and ambiance
- Photography and memory-making
- Custom celebration packages
- Special dietary accommodations for celebrations

GUIDELINES:
- Be enthusiastic and helpful about celebrations
- Understand the importance of making occasions special
- Provide detailed information about add-on services
- Help coordinate surprises with care and discretion
- Suggest combinations of services for maximum impact
- Be sensitive to budget considerations
- If guests want to book their celebration, mention our reservation specialist can finalize the booking
- Always prioritize creating unforgettable memories
- Show excitement about being part of their special moment

CELEBRATION PLANNING:
- Always ask about the type of celebration
- Understand the guest's vision and preferences
- Suggest appropriate add-ons and services
- Help coordinate timing and special requests
- Ensure all details are captured for perfect execution

Remember: You're helping create magical moments at ${restaurant.name}!`;
    }

    buildPrompt(message, conversationHistory, celebrationData) {
        let prompt = '';
        
        if (conversationHistory) {
            prompt += `Previous conversation:\n${conversationHistory}\n\n`;
        }
        
        prompt += `Current user message: ${message}

Please help the guest plan their special celebration at ${celebrationData.restaurant.name}. Provide information about celebration services, add-ons, and help create a memorable experience.`;

        return prompt;
    }

    extractCelebrationDetails(message) {
        const msg = message.toLowerCase();
        const details = {};
        
        // Extract celebration type
        const celebrationKeywords = {
            birthday: ['birthday', 'bday'],
            anniversary: ['anniversary'],
            engagement: ['engagement', 'engaged'],
            proposal: ['proposal', 'propose', 'marry'],
            romantic: ['romantic', 'date night', 'romance']
        };
        
        for (const [type, keywords] of Object.entries(celebrationKeywords)) {
            if (keywords.some(keyword => msg.includes(keyword))) {
                details.type = type;
                break;
            }
        }
        
        // Extract add-on preferences
        if (msg.includes('cake')) details.cake = true;
        if (msg.includes('flower')) details.flowers = true;
        if (msg.includes('champagne')) details.champagne = true;
        if (msg.includes('decoration')) details.decorations = true;
        
        return details;
    }

    shouldHandoffToReservation(message) {
        const bookingKeywords = [
            'book', 'reserve', 'reservation', 'table', 'sounds perfect',
            'let\'s do it', 'I want to book', 'make a reservation'
        ];
        
        const msg = message.toLowerCase();
        return bookingKeywords.some(keyword => msg.includes(keyword));
    }
}

export default CelebrationAgent;