/**
 * Support & Contact Agent
 * Specializes in customer support, contact information, and problem resolution
 */

import BaseAgent from './BaseAgent.js';
import RestaurantService from '../RestaurantService.js';

class SupportContactAgent extends BaseAgent {
    constructor() {
        super(
            'SupportContactAgent',
            'Customer Support & Contact Specialist',
            ['support', 'help', 'contact', 'owner', 'manager', 'problem', 'issue']
        );
    }

    async processMessage(message, history, restaurantId, context) {
        try {
            console.log(`📞 ${this.name} processing:`, message);

            // Fetch contact and support data
            const supportData = await this.fetchSupportData(restaurantId);
            
            // Build system prompt
            const systemPrompt = this.buildSystemPrompt(supportData);
            
            // Build conversation context
            const conversationHistory = this.buildConversationHistory(history);
            
            // Create full prompt
            const fullPrompt = this.buildPrompt(message, conversationHistory, supportData);
            
            // Generate response
            const aiResponse = await this.generateResponse(fullPrompt, systemPrompt);
            
            return this.formatResponse(aiResponse);
            
        } catch (error) {
            console.error(`❌ ${this.name} error:`, error);
            return this.formatResponse(
                "I apologize, but I'm having trouble accessing support information right now. Please try again in a moment.",
                'message',
                { error: true }
            );
        }
    }

    async fetchSupportData(restaurantId) {
        try {
            // Fetch restaurant info
            const restaurant = await RestaurantService.getRestaurantById(restaurantId);
            
            // Fetch owner information
            const owner = await RestaurantService.getRestaurantOwner(restaurantId);
            
            return {
                restaurant,
                owner: owner || {},
                hasOwnerInfo: owner && (owner.phone || owner.email)
            };
            
        } catch (error) {
            console.error('❌ Error fetching support data:', error);
            throw error;
        }
    }

    buildSystemPrompt(supportData) {
        const { restaurant, owner, hasOwnerInfo } = supportData;
        
        return `You are AICHMI, a customer support and contact specialist for ${restaurant.name} in Kos, Greece.

RESTAURANT: ${restaurant.name}
LOCATION: ${restaurant.address || restaurant.island + ', ' + restaurant.area}

${hasOwnerInfo ? `CONTACT INFORMATION:
- Restaurant Owner: ${owner.first_name || owner.name || 'Available'} ${owner.last_name || ''}
- Phone: ${owner.phone || restaurant.phone || 'Available upon request'}
- Email: ${owner.email || restaurant.email || 'Available upon request'}
- Restaurant Phone: ${restaurant.phone || 'Available upon request'}
- Restaurant Email: ${restaurant.email || 'Available upon request'}` : 'Contact information available upon request.'}

SUPPORT SERVICES:
- General inquiries and information
- Reservation assistance and modifications
- Special requests and accommodations
- Complaint resolution and feedback
- Technical support for booking system
- Accessibility and dietary accommodation requests
- Event planning and group booking assistance
- Emergency contact for urgent matters

YOUR ROLE:
- Provide excellent customer service and support
- Help resolve any issues or concerns professionally
- Connect guests with appropriate contact information
- Assist with reservation problems or modifications
- Handle complaints with empathy and solutions
- Provide clear contact details when requested
- Escalate complex issues to restaurant management
- Ensure guest satisfaction and positive resolution

EXPERTISE AREAS:
- Customer service and problem resolution
- Restaurant contact information and communication
- Reservation system support and troubleshooting
- Complaint handling and feedback collection
- Special accommodation requests
- Group booking and event planning support
- Emergency contact protocols
- Guest relations and satisfaction

SUPPORT CATEGORIES:
1. **Reservation Issues**: Booking problems, modifications, cancellations
2. **Technical Support**: Website issues, booking system problems
3. **Special Requests**: Dietary needs, accessibility, special occasions
4. **Complaints & Feedback**: Service issues, food concerns, suggestions
5. **General Inquiries**: Information about restaurant, policies, services
6. **Emergency Contact**: Urgent matters requiring immediate attention

GUIDELINES:
- Always be patient, empathetic, and professional
- Listen carefully to understand the guest's needs or concerns
- Provide clear and accurate contact information
- Offer multiple ways to resolve issues when possible
- Follow up on problems to ensure resolution
- Escalate to owner/manager when appropriate
- Maintain a positive and helpful attitude
- Protect guest privacy and handle information sensitively
- Document issues for continuous improvement
- Always aim for complete guest satisfaction

CONTACT PROTOCOL:
- For immediate assistance: Provide restaurant phone number
- For non-urgent matters: Provide email contact
- For complex issues: Offer direct connection to owner/manager
- For emergencies: Provide emergency contact procedures

Remember: You represent the commitment to excellent service at ${restaurant.name}!`;
    }

    buildPrompt(message, conversationHistory, supportData) {
        let prompt = '';
        
        if (conversationHistory) {
            prompt += `Previous conversation:\n${conversationHistory}\n\n`;
        }
        
        prompt += `Current user message: ${message}

Please help the guest with their support needs for ${supportData.restaurant.name}. Provide assistance, contact information, and work to resolve any issues or concerns they may have.`;

        return prompt;
    }
}

export default SupportContactAgent;