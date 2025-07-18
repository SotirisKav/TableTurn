import fetch from 'node-fetch';
import db from '../config/database.js';
import bcrypt from 'bcrypt';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

class RestaurantSetupService {
    
    static extractRestaurantDataFromResponse(responseText) {
        const match = responseText.match(/\[RESTAURANT_DATA\]([\s\S]*?)\[\/RESTAURANT_DATA\]/);
        if (!match) return null;

        const dataBlock = match[1];
        const lines = dataBlock.split('\n').filter(line => line.trim());
        
        const restaurantData = {};
        lines.forEach(line => {
            const [key, ...valueParts] = line.split(':');
            if (key && valueParts.length > 0) {
                const value = valueParts.join(':').trim();
                restaurantData[key.trim()] = value === 'null' || value === '' ? null : value;
            }
        });

        return restaurantData;
    }

    static async processSetupMessage({ message, history = [], collectedData = {} }) {
        console.log('🚀 Processing setup message:', { 
            message, 
            historyLength: history.length, 
            collectedData 
        });
        
        // FIRST: Extract data from current message BEFORE sending to AI
        const updatedData = this.extractDataFromConversation(message, history, collectedData);
        console.log('📊 Data after extraction:', updatedData);
        
        // Determine conversation state
        const isGreeting = message.toLowerCase().match(/^(hi|hello|hey|greetings|good morning|good afternoon)/);
        const isFirstMessage = history.length === 0;
        const nextField = this.getNextMissingField(updatedData);
        const dataCount = Object.keys(updatedData).length;
        const totalFields = 11;

        // Create a VERY explicit system prompt
        let systemPrompt = `You are AICHMI Setup Assistant. Your job is to collect restaurant information.

**CURRENT STATUS:**
- Data collected: ${dataCount}/${totalFields} fields
- Restaurant Name: ${updatedData.RestaurantName || 'NOT PROVIDED'}
- Cuisine: ${updatedData.Cuisine || 'NOT PROVIDED'}  
- Address: ${updatedData.Address || 'NOT PROVIDED'}
- Area: ${updatedData.Area || 'NOT PROVIDED'}
- Phone: ${updatedData.Phone || 'NOT PROVIDED'}
- Pricing: ${updatedData.Pricing || 'NOT PROVIDED'}
- Description: ${updatedData.Description || 'NOT PROVIDED'}
- Owner Email: ${updatedData.OwnerEmail || 'NOT PROVIDED'}
- Owner First Name: ${updatedData.OwnerFirstName || 'NOT PROVIDED'}
- Owner Last Name: ${updatedData.OwnerLastName || 'NOT PROVIDED'}
- Owner Password: ${updatedData.OwnerPassword ? 'PROVIDED' : 'NOT PROVIDED'}

**CONVERSATION CONTEXT:**
${history.length > 0 ? 
  `Previous conversation exists (${history.length} messages). Continue naturally.` : 
  'This is the start of the conversation.'}

**INSTRUCTIONS:**
${isGreeting || isFirstMessage ? 
  'Start with a brief welcome.' : 
  'DO NOT greet again. Continue the conversation.'}

${nextField ? 
  `NEXT ACTION: The user just provided information. Acknowledge it briefly and ask for: ${nextField}
  
  Example: "Great! I have the ${this.getLastProvidedField(updatedData)}. Now, what is your ${nextField}?"` :
  
  `ALL DATA COLLECTED! Ask for confirmation then use this EXACT format:
  
  🎉 Perfect! Creating your account...

  [RESTAURANT_DATA]
  RestaurantName: ${updatedData.RestaurantName}
  Cuisine: ${updatedData.Cuisine}
  Address: ${updatedData.Address}
  Area: ${updatedData.Area}
  Phone: ${updatedData.Phone}
  Pricing: ${updatedData.Pricing}
  Description: ${updatedData.Description}
  OwnerEmail: ${updatedData.OwnerEmail}
  OwnerFirstName: ${updatedData.OwnerFirstName}
  OwnerLastName: ${updatedData.OwnerLastName}
  OwnerPassword: ${updatedData.OwnerPassword}
  [/RESTAURANT_DATA]`}

**CRITICAL RULES:**
- NEVER ask for information that shows as "PROVIDED" above
- Be direct and concise
- Acknowledge what they just told you before asking for next item`;

        // Build conversation history for Gemini
        const contents = [
            { role: "user", parts: [{ text: systemPrompt }] },
            ...history.map(msg => ({
                role: msg.sender === "user" ? "user" : "model",
                parts: [{ text: msg.text }]
            })),
            { role: "user", parts: [{ text: message }] }
        ];

        try {
            const response = await fetch(
                'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-goog-api-key': GEMINI_API_KEY
                    },
                    body: JSON.stringify({ contents })
                }
            );
            
            const data = await response.json();
            const candidate = data?.candidates?.[0];
            if (!candidate) {
                return { 
                    type: 'message', 
                    reply: "I'm having trouble connecting right now. Please try again.",
                    setupComplete: false,
                    collectedData: updatedData
                };
            }

            const content = candidate.content;
            if (!content) {
                return { 
                    type: 'message', 
                    reply: "I'm having trouble connecting right now. Please try again.",
                    setupComplete: false,
                    collectedData: updatedData
                };
            }

            let aiResponse;
            if (Array.isArray(content.parts) && content.parts[0]?.text) {
                aiResponse = content.parts[0].text;
            } else if (typeof content.text === "string") {
                aiResponse = content.text;
            } else {
                return { 
                    type: 'message', 
                    reply: "I'm having trouble connecting right now. Please try again.",
                    setupComplete: false,
                    collectedData: updatedData
                };
            }

            // Check if AI has collected all data and wants to create the restaurant
            const restaurantData = this.extractRestaurantDataFromResponse(aiResponse);
            
            if (restaurantData) {
                // Remove the hidden block from the user-facing response
                const cleanResponse = aiResponse.replace(/\[RESTAURANT_DATA\][\s\S]*?\[\/RESTAURANT_DATA\]/g, '').trim();
                
                try {
                    // Validate data before creating
                    const validationError = this.validateRestaurantData(restaurantData);
                    if (validationError) {
                        return {
                            type: 'message',
                            reply: `I found an issue with the data: ${validationError}. Please provide the correct information.`,
                            setupComplete: false,
                            collectedData: updatedData
                        };
                    }

                    // Create the restaurant and owner account
                    const result = await this.createRestaurantAndOwner(restaurantData);
                    
                    return {
                        type: 'complete',
                        reply: cleanResponse + "\n\n✅ Your restaurant has been successfully registered! Redirecting to your dashboard...",
                        setupComplete: true,
                        restaurantData: {
                            venueId: result.venueId,
                            ownerId: result.ownerId,
                            email: restaurantData.OwnerEmail,
                            restaurantName: restaurantData.RestaurantName
                        }
                    };
                } catch (error) {
                    console.error('Error creating restaurant:', error);
                    
                    // Check for specific database errors
                    if (error.code === '23505' && error.constraint === 'owners_email_key') {
                        return {
                            type: 'message',
                            reply: "That email address is already registered. Please use a different email address.",
                            setupComplete: false,
                            collectedData: updatedData
                        };
                    }
                    
                    return {
                        type: 'message',
                        reply: "I encountered an error setting up your account. Please try again or contact support.",
                        setupComplete: false,
                        collectedData: updatedData
                    };
                }
            }

            // Continue conversation with updated data
            console.log('✅ Returning response with updated data:', updatedData);
            return {
                type: 'message',
                reply: aiResponse,
                setupComplete: false,
                collectedData: updatedData
            };

        } catch (error) {
            console.error('Error calling Gemini API for setup:', error);
            return {
                type: 'message',
                reply: "I'm having trouble connecting to our setup service. Please try again in a moment.",
                setupComplete: false,
                collectedData: updatedData
            };
        }
    }

    // Add this new method to better classify user responses
    static classifyUserResponse(message, lastAIMessage) {
        const msg = message.toLowerCase().trim();

        // Check if it's a correction request
        if (msg.includes('change') || msg.includes('switch') || msg.includes('update') || 
            msg.includes('correct') || msg.includes('fix') || msg.includes('modify')) {
            return 'correction';
        }

        // Check if it's a question
        if (msg.includes('?') || msg.startsWith('is ') || msg.startsWith('are ') || 
            msg.startsWith('do ') || msg.startsWith('does ') || msg.startsWith('can ') ||
            msg.startsWith('what ') || msg.startsWith('how ') || msg.startsWith('why ')) {
            return 'question';
        }

        // Check if it's a greeting/acknowledgment
        const greetings = ['hi', 'hey', 'hello', 'yes', 'no', 'ok', 'sure', 'thanks'];
        if (greetings.includes(msg)) {
            return 'greeting';
        }

        // Check if it's a direct answer (contains relevant keywords for what was asked)
        if (lastAIMessage.includes('restaurant name') && 
            !msg.includes('change') && !msg.includes('switch')) {
            return 'direct_answer';
        }

        if (lastAIMessage.includes('cuisine') && 
            !msg.includes('change') && !msg.includes('switch') &&
            (msg.includes('food') || msg.includes('italian') || msg.includes('greek') || 
             msg.includes('seafood') || msg.includes('chinese') || msg.includes('mexican') ||
             msg.length <= 20)) { // Cuisine is usually short
            return 'direct_answer';
        }

        if (lastAIMessage.includes('address') && 
            !msg.includes('change') && !msg.includes('switch') &&
            (msg.includes('street') || msg.includes('road') || msg.includes('avenue') ||
             /\d+/.test(msg))) { // Contains numbers (typical in addresses)
            return 'direct_answer';
        }

        if (lastAIMessage.includes('phone') && /\d/.test(msg)) {
            return 'direct_answer';
        }

        if (lastAIMessage.includes('email') && msg.includes('@')) {
            return 'direct_answer';
        }

        return 'unclear';
    }

    // Update the extractDataFromConversation method
    static extractDataFromConversation(message, history, existingData) {
        const data = { ...existingData };
        const currentMessage = message.toLowerCase().trim();

        // Get the last AI message
        let lastAIMessage = '';
        for (let i = history.length - 1; i >= 0; i--) {
            if (history[i]?.sender === 'ai') {
                lastAIMessage = history[i].text.toLowerCase();
                break;
            }
        }

        console.log('🔍 Extracting data:', { 
            message: currentMessage,
            lastAI: lastAIMessage.substring(0, 150),
            existing: Object.keys(existingData),
            historyLength: history.length
        });

        // First message handling
        if (history.length === 0) {
            if (message.includes(':')) {
                const parts = message.split(':');
                if (parts.length === 2) {
                    const key = parts[0].trim().toLowerCase();
                    const value = parts[1].trim();
                    if (key.includes('restaurant name') || key.includes('name')) {
                        data.RestaurantName = this.capitalizeWords(value);
                        console.log('✅ Extracted restaurant name from structured input:', data.RestaurantName);
                    }
                }
            }
            return data;
        }

        // Classify the user's response
        const responseType = this.classifyUserResponse(message, lastAIMessage);
        console.log('🎯 Response type:', responseType);

        // Handle corrections differently
        if (responseType === 'correction') {
            return this.handleCorrectionRequest(message, data);
        }

        // Only extract if it's a direct answer
        if (responseType !== 'direct_answer') {
            console.log('❌ Not extracting - response type is:', responseType);
            return data;
        }

        // Restaurant name - only if AI specifically asked for it AND it's a direct answer
        if (!data.RestaurantName && 
            (lastAIMessage.includes('restaurant name') || 
             lastAIMessage.includes('name of your restaurant') ||
             lastAIMessage.includes("what's the name"))) {

            let cleanName = message.trim();
            cleanName = cleanName.replace(/^(my restaurant is|the name is|it's|its|restaurant name is|name is|called|named|the name of my restaurant is)\s*/i, '');

            const invalidNames = ['hey', 'hi', 'hello', 'yes', 'no', 'ok', 'sure'];
            const isValidName = cleanName.length >= 2 && 
                               cleanName.length <= 100 && 
                               !invalidNames.includes(cleanName.toLowerCase());

            if (isValidName) {
                data.RestaurantName = this.capitalizeWords(cleanName);
                console.log('✅ Extracted restaurant name:', data.RestaurantName);
            }
        }

        // Cuisine - only if AI asked for cuisine AND it's a direct answer
        if (!data.Cuisine && 
            (lastAIMessage.includes('cuisine') || 
             lastAIMessage.includes('type of food') || 
             lastAIMessage.includes('what type') ||
             lastAIMessage.includes('kind of food'))) {

            let cuisine = message.trim();
            cuisine = cuisine.replace(/^(we serve|i serve|we offer|cuisine is|food is|type is)\s*/i, '');

            // Validate it looks like a cuisine type
            const commonCuisines = ['italian', 'greek', 'seafood', 'chinese', 'mexican', 'thai', 'indian', 'american', 'french', 'japanese'];
            const looksLikeCuisine = commonCuisines.some(c => cuisine.toLowerCase().includes(c)) || 
                                    cuisine.length <= 20; // Most cuisines are short

            if (looksLikeCuisine && cuisine.length > 0 && cuisine.length <= 50) {
                data.Cuisine = this.capitalizeWords(cuisine);
                console.log('✅ Extracted cuisine:', data.Cuisine);
            }
        }

        // Address - only if AI asked for address AND it looks like an address
        if (!data.Address && lastAIMessage.includes('address')) {
            const looksLikeAddress = /\d+/.test(message) || // Contains numbers
                                    message.includes('street') || message.includes('road') ||
                                    message.includes('avenue') || message.includes(',');

            if (looksLikeAddress && currentMessage.length > 5) {
                data.Address = this.capitalizeWords(message.trim());
                console.log('✅ Extracted address:', data.Address);
            }
        }

        // Continue with the rest of your extraction logic but with better validation...
        // Area, Phone, Email, etc. (keeping your existing logic but adding similar validation)

        return data;
    }

    // Add this new method to handle corrections
    static handleCorrectionRequest(message, currentData) {
        const msg = message.toLowerCase();

        // Extract what they want to change
        if (msg.includes('restaurant name') || msg.includes('name')) {
            const match = msg.match(/(?:change|switch|update|correct|fix|modify).*(?:restaurant name|name).*to\s+(.+)/);
            if (match) {
                const newName = this.capitalizeWords(match[1].trim());
                console.log('🔄 Correcting restaurant name to:', newName);
                return { ...currentData, RestaurantName: newName };
            }
        }

        if (msg.includes('cuisine')) {
            const match = msg.match(/(?:change|switch|update|correct|fix|modify).*cuisine.*to\s+(.+)/);
            if (match) {
                const newCuisine = this.capitalizeWords(match[1].trim());
                console.log('🔄 Correcting cuisine to:', newCuisine);
                return { ...currentData, Cuisine: newCuisine };
            }
        }

        // Add more correction patterns as needed...

        console.log('❌ Could not parse correction request');
        return currentData;
    }

    static isSimpleResponse(message) {
        const simpleResponses = [
            'yes', 'no', 'ok', 'sure', 'yeah', 'yep', 'nope', 'hi', 'hey', 'hello',
            'thanks', 'thank you', 'good', 'fine', 'great', 'awesome', 'cool'
        ];
        return simpleResponses.includes(message.toLowerCase().trim());
    }

    static capitalizeWords(str) {
        return str.replace(/\w\S*/g, (txt) => 
            txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
        );
    }

    static getNextMissingField(collectedData) {
        if (!collectedData.RestaurantName) return "restaurant name";
        if (!collectedData.Cuisine) return "cuisine type";
        if (!collectedData.Address) return "full address";
        if (!collectedData.Area) return "area/location";
        if (!collectedData.Phone) return "phone number";
        if (!collectedData.Pricing) return "pricing level (affordable/moderate/expensive)";
        if (!collectedData.Description) return "restaurant description";
        if (!collectedData.OwnerEmail) return "owner email";
        if (!collectedData.OwnerFirstName) return "owner first name";
        if (!collectedData.OwnerLastName) return "owner last name";
        if (!collectedData.OwnerPassword) return "owner password (minimum 8 characters)";
        return null; // All fields collected
    }

    static getLastProvidedField(collectedData) {
        const fields = Object.keys(collectedData);
        if (fields.length === 0) return "";
        
        const fieldMap = {
            'RestaurantName': 'restaurant name',
            'Cuisine': 'cuisine type',
            'Address': 'address',
            'Area': 'area',
            'Phone': 'phone number',
            'Pricing': 'pricing level',
            'Description': 'description',
            'OwnerEmail': 'email',
            'OwnerFirstName': 'first name',
            'OwnerLastName': 'last name',
            'OwnerPassword': 'password'
        };
        
        return fieldMap[fields[fields.length - 1]] || 'information';
    }

    // Keep all your existing validation and database methods...
    static validateRestaurantData(data) {
        const requiredFields = [
            'RestaurantName', 'Cuisine', 'Address', 'Area', 'Phone', 
            'Pricing', 'Description', 'OwnerEmail', 'OwnerFirstName', 
            'OwnerLastName', 'OwnerPassword'
        ];

        for (const field of requiredFields) {
            if (!data[field] || data[field].trim() === '') {
                return `${field} is required`;
            }
        }

        if (data.RestaurantName.length > 100) return "Restaurant name must be 100 characters or less";
        if (data.Address.length > 255) return "Address must be 255 characters or less";
        if (data.Area.length > 50) return "Area must be 50 characters or less";
        if (data.Phone.length > 20) return "Phone number must be 20 characters or less";
        if (data.OwnerFirstName.length > 100) return "First name must be 100 characters or less";
        if (data.OwnerLastName.length > 100) return "Last name must be 100 characters or less";
        if (data.OwnerEmail.length > 255) return "Email must be 255 characters or less";

        const validPricing = ['affordable', 'moderate', 'expensive'];
        if (!validPricing.includes(data.Pricing.toLowerCase())) {
            return "Pricing must be exactly 'affordable', 'moderate', or 'expensive'";
        }

        const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
        if (!emailRegex.test(data.OwnerEmail)) {
            return "Please provide a valid email address";
        }

        if (data.OwnerPassword.length < 8) {
            return "Password must be at least 8 characters long";
        }

        return null;
    }

    static async createRestaurantAndOwner(data) {
        try {
            console.log('Creating restaurant with validated data:', data);

            const pricing = data.Pricing.toLowerCase();

            const venueQuery = `
                INSERT INTO venue (name, address, area, type, rating, pricing, description, cuisine)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING venue_id;
            `;
            const venueResult = await db.query(venueQuery, [
                data.RestaurantName.trim(),
                data.Address.trim(),
                data.Area.trim(),
                'restaurant',
                null,
                pricing,
                data.Description.trim(),
                data.Cuisine.trim()
            ]);

            const venueId = venueResult[0].venue_id;
            console.log('Venue created with ID:', venueId);

            const hashedPassword = await bcrypt.hash(data.OwnerPassword, 10);
            const ownerQuery = `
                INSERT INTO owners (email, password, first_name, last_name, phone, venue_id, oauth_provider, email_verified)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING id;
            `;
            const ownerResult = await db.query(ownerQuery, [
                data.OwnerEmail.trim().toLowerCase(),
                hashedPassword,
                data.OwnerFirstName.trim(),
                data.OwnerLastName.trim(),
                data.Phone.trim(),
                venueId,
                'local',
                true
            ]);

            const ownerId = ownerResult[0].id;
            console.log('Owner created with ID:', ownerId);

            const tableInventoryQuery = `
                INSERT INTO table_inventory (venue_id, table_type, max_tables)
                VALUES 
                ($1, 'standard', 10),
                ($1, 'grass', 5),
                ($1, 'special', 2);
            `;
            await db.query(tableInventoryQuery, [venueId]);
            console.log('Default table inventory created');

            const botConfigQueries = [
                { key: `response_style_${venueId}`, value: 'friendly_professional', venue_id: venueId },
                { key: `language_${venueId}`, value: 'english', venue_id: venueId },
                { key: `greeting_enabled_${venueId}`, value: 'true', venue_id: venueId }
            ];

            for (const config of botConfigQueries) {
                await db.query(
                    'INSERT INTO bot_config (key, value, venue_id) VALUES ($1, $2, $3)',
                    [config.key, config.value, config.venue_id]
                );
            }
            console.log('Default bot configuration created');

            const botModulesQuery = `
                INSERT INTO bot_modules (module_name, enabled, venue_id)
                VALUES 
                ('greeting_${venueId}', true, $1),
                ('reservation_${venueId}', true, $1),
                ('menu_info_${venueId}', true, $1);
            `;
            await db.query(botModulesQuery, [venueId]);
            console.log('Default bot modules created');

            console.log('Restaurant setup completed successfully:', { venueId, ownerId });

            return { venueId: venueId, ownerId: ownerId };

        } catch (error) {
            console.error('Error in createRestaurantAndOwner:', error);
            throw error;
        }
    }
}

export default RestaurantSetupService;