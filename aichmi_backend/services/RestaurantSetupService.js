import db from '../config/database.js';
import bcrypt from 'bcrypt';

class RestaurantSetupService {
    static async processSetupMessage({ message, setupStep, restaurantData }) {
        const userInput = message.trim().toLowerCase();
        let response = {
            reply: '',
            nextStep: setupStep,
            restaurantData: restaurantData,
            setupComplete: false
        };

        switch (setupStep) {
            case 'welcome':
            case 'restaurant_name':
                response.restaurantData.name = message.trim();
                response.reply = `Great! "${message.trim()}" sounds like a wonderful restaurant. \n\nWhat type of restaurant is it? (e.g., Greek cuisine, Italian, seafood, cafe, etc.)`;
                response.nextStep = 'restaurant_type';
                break;

            case 'restaurant_type':
                response.restaurantData.cuisine = message.trim();
                response.reply = `Perfect! A ${message.trim()} restaurant. \n\nNow, where is your restaurant located? Please provide the full address including the area/city.`;
                response.nextStep = 'location';
                break;

            case 'location':
                const locationParts = message.split(',').map(part => part.trim());
                if (locationParts.length >= 2) {
                    response.restaurantData.address = message.trim();
                    response.restaurantData.area = locationParts[locationParts.length - 1];
                } else {
                    response.restaurantData.address = message.trim();
                    response.restaurantData.area = message.trim();
                }
                response.reply = `Excellent location! \n\nNow I need your contact information. What's your phone number?`;
                response.nextStep = 'contact_info';
                break;

            case 'contact_info':
                response.restaurantData.phone = message.trim();
                response.reply = `Thank you! \n\nHow would you describe your restaurant's pricing? Please choose one:\n• Affordable (€)\n• Moderate (€€)\n• Expensive (€€€)`;
                response.nextStep = 'pricing';
                break;

            case 'pricing':
                let pricing = 'moderate';
                if (userInput.includes('affordable') || userInput.includes('cheap') || userInput.includes('€') && !userInput.includes('€€')) {
                    pricing = 'affordable';
                } else if (userInput.includes('expensive') || userInput.includes('€€€')) {
                    pricing = 'expensive';
                }
                response.restaurantData.pricing = pricing;
                response.reply = `Got it! ${pricing} pricing. \n\nPlease provide a brief description of your restaurant (what makes it special, atmosphere, signature dishes, etc.):`;
                response.nextStep = 'description';
                break;

            case 'description':
                response.restaurantData.description = message.trim();
                response.reply = `Wonderful description! \n\nNow I need to create your owner account. What's your email address?`;
                response.nextStep = 'owner_email';
                break;

            case 'owner_email':
                // Validate email format
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(message.trim())) {
                    response.reply = `Please provide a valid email address (e.g., yourname@example.com):`;
                    return response;
                }
                response.restaurantData.email = message.trim();
                response.reply = `Thank you! What's your first name?`;
                response.nextStep = 'owner_first_name';
                break;

            case 'owner_first_name':
                response.restaurantData.firstName = message.trim();
                response.reply = `Nice to meet you, ${message.trim()}! What's your last name?`;
                response.nextStep = 'owner_last_name';
                break;

            case 'owner_last_name':
                response.restaurantData.lastName = message.trim();
                response.reply = `Perfect! Now please create a secure password for your account (at least 8 characters):`;
                response.nextStep = 'owner_password';
                break;

            case 'owner_password':
                if (message.length < 8) {
                    response.reply = `Password must be at least 8 characters long. Please try again:`;
                    return response;
                }
                response.restaurantData.password = message.trim();
                
                // Create the restaurant and owner account
                try {
                    const result = await this.createRestaurantAndOwner(response.restaurantData);
                    response.reply = `🎉 Congratulations! Your restaurant "${response.restaurantData.name}" has been successfully set up!\n\nYour account has been created and you're now ready to use AICHMI's AI assistant.\n\nRedirecting you to your dashboard...`;
                    response.setupComplete = true;
                    response.nextStep = 'complete';
                } catch (error) {
                    console.error('Error creating restaurant:', error);
                    response.reply = `I encountered an error setting up your account. Please try again or contact support.`;
                }
                break;

            default:
                response.reply = `I'm not sure what you're asking. Could you please try again?`;
                break;
        }

        return response;
    }

    static async createRestaurantAndOwner(data) {
        try {
            // 1. Create venue
            const venueQuery = `
                INSERT INTO venue (name, address, area, type, rating, pricing, description, cuisine)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING venue_id;
            `;
            const venueResult = await db.query(venueQuery, [
                data.name,
                data.address,
                data.area,
                'restaurant',
                0, // Default rating
                data.pricing,
                data.description,
                data.cuisine
            ]);

            const venueId = venueResult[0].venue_id;

            // 2. Hash password and create owner
            const hashedPassword = await bcrypt.hash(data.password, 10);
            const ownerQuery = `
                INSERT INTO owners (email, password, first_name, last_name, phone, venue_id, email_verified)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id;
            `;
            const ownerResult = await db.query(ownerQuery, [
                data.email,
                hashedPassword,
                data.firstName,
                data.lastName,
                data.phone,
                venueId,
                true // Auto-verify for setup process
            ]);

            // 3. Add default table inventory
            const tableInventoryQuery = `
                INSERT INTO table_inventory (venue_id, table_type, max_tables)
                VALUES 
                ($1, 'standard', 10),
                ($1, 'grass', 5),
                ($1, 'special', 2);
            `;
            await db.query(tableInventoryQuery, [venueId]);

            // 4. Add default bot configuration
            const botConfigQuery = `
                INSERT INTO bot_config (key, value, venue_id)
                VALUES 
                ('response_style_${venueId}', 'friendly_professional', $1),
                ('language_${venueId}', 'english', $1),
                ('greeting_enabled_${venueId}', 'true', $1);
            `;
            await db.query(botConfigQuery, [venueId]);

            return {
                venueId: venueId,
                ownerId: ownerResult[0].id
            };

        } catch (error) {
            console.error('Error in createRestaurantAndOwner:', error);
            throw error;
        }
    }
}

export default RestaurantSetupService;