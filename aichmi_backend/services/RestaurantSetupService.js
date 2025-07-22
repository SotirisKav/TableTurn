import LocationValidationService from './LocationValidationService.js';
import db from '../config/database.js';

class RestaurantSetupService {
    
    static getNextMissingField(data) {
        const fields = [
            'RestaurantName',
            'Cuisine',
            'Location',        // Google Maps location
            'Phone',
            'Pricing', 
            'Description',
            'OwnerEmail',
            'OwnerFirstName',
            'OwnerLastName',
            'OwnerPassword'
        ];

        for (const field of fields) {
            if (!data[field]) {
                return field;
            }
        }
        return null;
    }

    // Add structured output schema
    static getSetupResponseSchema() {
        return {
            type: "object",
            properties: {
                message: {
                    type: "string",
                    description: "The AI response message to show to the user"
                },
                needsMap: {
                    type: "boolean",
                    description: "Whether to show the location map picker (true only when asking for Location)"
                },
                setupComplete: {
                    type: "boolean",
                    description: "Whether all restaurant data has been collected (true only when all 10 fields are present)"
                },
                nextField: {
                    type: "string",
                    description: "The next field that needs to be collected, or null if complete"
                }
            },
            required: ["message", "needsMap", "setupComplete"]
        };
    }

    static classifyUserResponse(message, lastAIMessage) {
        const msg = message.toLowerCase().trim();
        
        // Check if it's location data from map
        if (msg.includes('location_selected:') || msg.includes('place_id:') || 
            /lat:\s*-?\d+\.?\d*,\s*lng:\s*-?\d+\.?\d*/.test(msg)) {
            return 'location_data';
        }
        
        // Check if it's a correction request
        if (msg.includes('change') || msg.includes('switch') || msg.includes('update')) {
            return 'correction';
        }
        
        // Check if it's a greeting
        const greetings = ['hi', 'hey', 'hello', 'yes', 'no', 'ok', 'sure', 'thanks'];
        if (greetings.includes(msg)) {
            return 'greeting';
        }
        
        return 'direct_answer';
    }

    static async extractDataFromConversation(message, history, existingData) {
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

        const responseType = this.classifyUserResponse(message, lastAIMessage);

        if (responseType === 'correction') {
            return this.handleCorrectionRequest(message, data);
        }

        // Restaurant name extraction
        if (!data.RestaurantName && 
            (lastAIMessage.includes('name') || lastAIMessage.includes('restaurant') || history.length <= 4) && 
            responseType === 'direct_answer') {

            let cleanName = message.trim();
            cleanName = cleanName.replace(/^(my restaurant is|the name is|it's|its|restaurant name is|name is|called|named)\s*/i, '');

            const invalidNames = ['hey', 'hi', 'hello', 'yes', 'no', 'ok', 'sure', 'map', 'seafood', 'kos', 'hey!', 'ηευ!', 'ηευ'];
            const hasOnlyGreekLettersAndSymbols = /^[α-ωάέήίόύώΑ-Ω\s\-!'\.]+$/.test(cleanName);
            const hasOnlyEnglishLettersAndSymbols = /^[a-zA-Z\s\-!'\.]+$/.test(cleanName);
            const hasValidLength = cleanName.length >= 3 && cleanName.length <= 100;
            const notInInvalidList = !invalidNames.includes(cleanName.toLowerCase());
            const hasAtLeastOneLetter = /[a-zA-Zα-ωάέήίόύώΑ-Ω]/.test(cleanName);

            const isValidName = hasValidLength && 
                               notInInvalidList && 
                               hasAtLeastOneLetter &&
                               (hasOnlyGreekLettersAndSymbols || hasOnlyEnglishLettersAndSymbols);

            if (isValidName) {
                data.RestaurantName = this.capitalizeWords(cleanName);
                console.log('✅ Extracted restaurant name:', data.RestaurantName);
            }
        }

        // Cuisine extraction
        if (!data.Cuisine && lastAIMessage.includes('cuisine') && responseType === 'direct_answer') {
            let cuisine = message.trim();
            cuisine = cuisine.replace(/^(we serve|i serve|we offer|cuisine is|food is|type is)\s*/i, '');

            if (cuisine.length > 0 && cuisine.length <= 50) {
                data.Cuisine = this.capitalizeWords(cuisine);
                console.log('✅ Extracted cuisine:', data.Cuisine);
            }
        }

        // Location extraction
        if (!data.Location && responseType === 'location_data') {
            try {
                let locationValidation = null;

                if (message.includes('location_selected:')) {
                    const jsonMatch = message.match(/location_selected:\s*({.*})/);
                    if (jsonMatch) {
                        const locationData = JSON.parse(jsonMatch[1]);
                        console.log('📍 LocationPicker data received:', locationData);

                        locationValidation = await LocationValidationService.validateAndExtractLocation(
                            locationData.lat, 
                            locationData.lng, 
                            locationData.placeId,
                            {
                                island: locationData.island,
                                area: locationData.area,
                                address: locationData.address,
                                placeId: locationData.placeId
                            }
                        );
                    }
                }

                if (locationValidation && locationValidation.isValid) {
                    data.Location = {
                        island: locationValidation.island,
                        area: locationValidation.area,
                        address: locationValidation.address,
                        placeId: locationValidation.placeId,
                        formattedAddress: locationValidation.formattedAddress
                    };
                    console.log('✅ Extracted location:', data.Location);
                }
            } catch (error) {
                console.error('Location extraction error:', error);
                data._locationError = 'Failed to process location data';
            }
        }

        // Phone extraction
        if (!data.Phone && lastAIMessage.includes('phone') && responseType === 'direct_answer') {
            const phoneRegex = /[\d\s\-\+\(\)]{8,20}/;
            const phoneMatch = message.match(phoneRegex);
            if (phoneMatch) {
                data.Phone = phoneMatch[0].trim();
                console.log('✅ Extracted phone:', data.Phone);
            }
        }

        // Pricing extraction
        if (!data.Pricing && lastAIMessage.includes('pricing') && responseType === 'direct_answer') {
            const pricingWords = message.toLowerCase();
            if (pricingWords.includes('affordable') || pricingWords.includes('cheap') || pricingWords.includes('budget')) {
                data.Pricing = 'affordable';
            } else if (pricingWords.includes('expensive') || pricingWords.includes('luxury') || pricingWords.includes('high-end')) {
                data.Pricing = 'expensive';
            } else if (pricingWords.includes('moderate') || pricingWords.includes('medium') || pricingWords.includes('mid-range')) {
                data.Pricing = 'moderate';
            }
            if (data.Pricing) {
                console.log('✅ Extracted pricing:', data.Pricing);
            }
        }

        // Description extraction
        if (!data.Description && lastAIMessage.includes('description') && responseType === 'direct_answer') {
            let description = message.trim();
            if (description.length >= 3 && description.length <= 500 && !description.includes('@')) {
                data.Description = description;
                console.log('✅ Extracted description:', data.Description);
            }
        }

        // FIXED: Better email extraction - more flexible regex
        if (!data.OwnerEmail && lastAIMessage.includes('email') && responseType === 'direct_answer') {
            // More flexible email regex that accepts incomplete domains for testing
            const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+/;
            const emailMatch = message.match(emailRegex);
            if (emailMatch) {
                let email = emailMatch[0].toLowerCase();
                // If email doesn't have a proper TLD, suggest adding one
                if (!email.includes('.')) {
                    email = email + '.com'; // Auto-complete for testing
                    console.log('📧 Auto-completed email:', email);
                }
                data.OwnerEmail = email;
                console.log('✅ Extracted email:', data.OwnerEmail);
            }
        }

        // Owner first name extraction - FIXED: Better detection
        if (!data.OwnerFirstName && 
            (lastAIMessage.includes('first name') || lastAIMessage.includes('owner\'s first name')) && 
            responseType === 'direct_answer') {
            let firstName = message.trim();
            firstName = firstName.replace(/^(my name is|i am|i'm|first name is|name is|name)\s*/i, '');
            if (firstName.length > 0 && firstName.length <= 50) {
                data.OwnerFirstName = this.capitalizeWords(firstName);
                console.log('✅ Extracted first name:', data.OwnerFirstName);
            }
        }

        // Owner last name extraction - FIXED: Better detection
        if (!data.OwnerLastName && 
            (lastAIMessage.includes('last name') || lastAIMessage.includes('owner\'s last name')) && 
            responseType === 'direct_answer') {
            let lastName = message.trim();
            lastName = lastName.replace(/^(last name is|surname is|family name is)\s*/i, '');
            if (lastName.length > 0 && lastName.length <= 50) {
                data.OwnerLastName = this.capitalizeWords(lastName);
                console.log('✅ Extracted last name:', data.OwnerLastName);
            }
        }

        // Owner password extraction
        if (!data.OwnerPassword && lastAIMessage.includes('password') && responseType === 'direct_answer') {
            const password = message.trim();
            if (password.length >= 8) {
                data.OwnerPassword = password;
                console.log('✅ Extracted password: [HIDDEN]');
            }
        }

        return data;
    }

    static async saveRestaurantToDatabase(restaurantData) {
        try {
            // VALIDATION: Ensure all required fields are present
            const requiredFields = ['RestaurantName', 'Cuisine', 'Location', 'Phone', 'Pricing', 'Description', 'OwnerEmail', 'OwnerFirstName', 'OwnerLastName', 'OwnerPassword'];
            const missingFields = requiredFields.filter(field => !restaurantData[field]);
            
            if (missingFields.length > 0) {
                throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
            }

            console.log('💾 Starting database transaction with data:', {
                RestaurantName: restaurantData.RestaurantName,
                OwnerEmail: restaurantData.OwnerEmail,
                OwnerFirstName: restaurantData.OwnerFirstName,
                OwnerLastName: restaurantData.OwnerLastName,
                Location: restaurantData.Location
            });

            await db.query('BEGIN');

            // 1. Insert into venue table
            const venueInsertQuery = `
                INSERT INTO venue (
                    name, 
                    address, 
                    area, 
                    island, 
                    type, 
                    rating, 
                    pricing, 
                    google_place_id, 
                    description, 
                    cuisine
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
                RETURNING venue_id
            `;

            const venueValues = [
                restaurantData.RestaurantName,
                restaurantData.Location.address,
                restaurantData.Location.area,
                restaurantData.Location.island,
                'restaurant',
                5.0,
                restaurantData.Pricing,
                restaurantData.Location.placeId,
                restaurantData.Description,
                restaurantData.Cuisine
            ];

            console.log('🏢 Inserting venue with values:', venueValues);
            const venueResult = await db.query(venueInsertQuery, venueValues);
            const venueId = venueResult.rows[0].venue_id;

            console.log('✅ Venue inserted with ID:', venueId);

            // 2. Insert into owners table
            const bcrypt = await import('bcrypt');
            const hashedPassword = await bcrypt.hash(restaurantData.OwnerPassword, 10);

            const ownerInsertQuery = `
                INSERT INTO owners (
                    email, password, first_name, last_name, phone, venue_id, 
                    created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
                RETURNING id
            `;

            const ownerValues = [
                restaurantData.OwnerEmail,
                hashedPassword,
                restaurantData.OwnerFirstName,
                restaurantData.OwnerLastName,
                restaurantData.Phone,
                venueId
            ];

            console.log('👤 Inserting owner with values:', [
                restaurantData.OwnerEmail,
                '[HIDDEN PASSWORD]',
                restaurantData.OwnerFirstName,
                restaurantData.OwnerLastName,
                restaurantData.Phone,
                venueId
            ]);

            const ownerResult = await db.query(ownerInsertQuery, ownerValues);
            const ownerId = ownerResult.rows[0].id;
            console.log('✅ Owner inserted with ID:', ownerId);

            // 3. Insert default table inventory
            const tableInventoryQuery = `
                INSERT INTO table_inventory (venue_id, table_type, max_tables)
                VALUES 
                    ($1, 'standard', 10),
                    ($1, 'grass', 5),
                    ($1, 'special', 2)
            `;

            await db.query(tableInventoryQuery, [venueId]);
            console.log('✅ Default table inventory created');

            await db.query('COMMIT');

            return {
                success: true,
                venueId,
                ownerId,
                message: 'Restaurant successfully created!'
            };

        } catch (error) {
            await db.query('ROLLBACK');
            console.error('❌ Database insertion error:', error);
            console.error('❌ Error details:', error.message);
            throw error;
        }
    }

    static async processSetupMessage({ message, history = [], collectedData = {} }) {
        console.log('🚀 Processing setup message:', { message, historyLength: history.length, collectedData });

        const updatedData = await this.extractDataFromConversation(message, history, collectedData);
        const nextField = this.getNextMissingField(updatedData);
        const dataCount = Object.keys(updatedData).filter(key => !key.startsWith('_')).length;
        const totalFields = 10;

        const isFirstMessage = history.length <= 1;

        // Debug logging
        console.log('🔍 Setup process debug:', {
            nextField,
            dataCount,
            updatedData: Object.keys(updatedData),
            needsMapCheck: nextField === 'Location',
            allRequiredFieldsPresent: !nextField
        });

        // FIXED: Only mark complete when ALL fields are present AND nextField is null
        const setupComplete = !nextField && dataCount === totalFields;

        let systemPrompt = `You are AICHMI Setup Assistant helping set up a restaurant profile. Payment has already been processed.

**CURRENT STATUS:**
- Data collected: ${dataCount}/${totalFields} fields
- Restaurant Name: ${updatedData.RestaurantName || 'NOT PROVIDED'}
- Cuisine: ${updatedData.Cuisine || 'NOT PROVIDED'}
- Location: ${updatedData.Location ? `✅ ${updatedData.Location.island}, ${updatedData.Location.area}` : 'NOT PROVIDED'}
- Phone: ${updatedData.Phone || 'NOT PROVIDED'}
- Pricing: ${updatedData.Pricing || 'NOT PROVIDED'}
- Description: ${updatedData.Description || 'NOT PROVIDED'}
- Owner Email: ${updatedData.OwnerEmail || 'NOT PROVIDED'}
- Owner First Name: ${updatedData.OwnerFirstName || 'NOT PROVIDED'}
- Owner Last Name: ${updatedData.OwnerLastName || 'NOT PROVIDED'}
- Owner Password: ${updatedData.OwnerPassword ? 'PROVIDED ✓' : 'NOT PROVIDED'}

**INSTRUCTIONS:**
${isFirstMessage ? 
  'Start with a brief welcome and ask for the restaurant name.' : 
  'Continue the conversation naturally. Acknowledge what they provided and ask for the next missing field ONLY.'}

**RESPONSE RULES:**
- Set needsMap to true ONLY when asking for Location (nextField is "Location")
- Set setupComplete to true ONLY when all 10 fields are collected AND nextField is null
- Ask for ONE field at a time based on nextField
- Be friendly and acknowledge what the user just provided before asking for next item
- Keep responses concise and encouraging

**NEXT FIELD TO ASK FOR:** ${nextField || 'ALL COMPLETE - confirm restaurant creation'}

${nextField === 'Location' ? `
IMPORTANT: Set needsMap to true and mention they need to use the map picker to select their exact location.` : ''}

${setupComplete ? `
All data has been collected! Confirm that you're creating their restaurant profile.` : ''}`;

        try {
            const response = await fetch(
                'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-goog-api-key': process.env.GEMINI_API_KEY
                    },
                    body: JSON.stringify({
                        contents: [
                            { role: "user", parts: [{ text: systemPrompt }] },
                            ...history.map(msg => ({
                                role: msg.sender === "user" ? "user" : "model",
                                parts: [{ text: msg.text }]
                            })),
                            { role: "user", parts: [{ text: message }] }
                        ],
                        generationConfig: {
                            responseMimeType: "application/json",
                            responseSchema: this.getSetupResponseSchema()
                        }
                    })
                }
            );

            const data = await response.json();
            
            if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
                console.log('❌ No valid response from AI, using fallback');
                return this.processSetupMessageFallback({ message, history, collectedData: updatedData });
            }

            const aiResponse = JSON.parse(data.candidates[0].content.parts[0].text);

            // Force needsMap to true if asking for Location
            if (nextField === 'Location') {
                aiResponse.needsMap = true;
                console.log('🗺️ Forcing needsMap = true for Location field');
            }

            // FIXED: Override setupComplete based on actual data completeness
            aiResponse.setupComplete = setupComplete;

            console.log('✅ AI Response processed:', {
                message: aiResponse.message?.substring(0, 50) + '...',
                needsMap: aiResponse.needsMap,
                setupComplete: aiResponse.setupComplete,
                nextField: nextField
            });

            // FIXED: Only save to database if setup is actually complete
            if (aiResponse.setupComplete && setupComplete) {
                try {
                    console.log('💾 Saving restaurant to database...');
                    const dbResult = await this.saveRestaurantToDatabase(updatedData);
                    console.log('✅ Restaurant saved to database:', dbResult);

                    aiResponse.message = `🎉 Success! Your restaurant "${updatedData.RestaurantName}" has been created and is now live!`;
                    aiResponse.venueId = dbResult.venueId;

                } catch (error) {
                    console.error('❌ Failed to save restaurant:', error);
                    aiResponse.message = `❌ There was an error creating your restaurant profile. Please try again later.\n\nError: ${error.message}`;
                    aiResponse.setupComplete = false;
                    
                    return {
                        type: 'message',
                        reply: aiResponse.message,
                        collectedData: updatedData,
                        setupComplete: false,
                        error: 'Database save failed'
                    };
                }
            }

            return {
                type: 'message',
                reply: aiResponse.message,
                needsMap: aiResponse.needsMap || false,
                collectedData: updatedData,
                setupComplete: aiResponse.setupComplete || false,
                venueId: aiResponse.venueId
            };

        } catch (error) {
            console.error('Structured output error:', error);
            return this.processSetupMessageFallback({ message, history, collectedData: updatedData });
        }
    }

    static getFieldPrompt(field) {
        switch(field) {
            case 'RestaurantName': return 'what\'s the name of your restaurant?';
            case 'Cuisine': return 'what type of cuisine do you serve?';
            case 'Location': return 'please select your restaurant location on the map';
            case 'Phone': return 'what\'s your restaurant\'s phone number?';
            case 'Pricing': return 'what\'s your pricing level? (affordable, moderate, or expensive)';
            case 'Description': return 'can you provide a brief description of your restaurant?';
            case 'OwnerEmail': return 'what\'s your email address?';
            case 'OwnerFirstName': return 'what\'s your first name?';
            case 'OwnerLastName': return 'what\'s your last name?';
            case 'OwnerPassword': return 'please create a password (minimum 8 characters)';
            default: return field;
        }
    }

    static capitalizeWords(str) {
        return str.replace(/\w\S*/g, (txt) => 
            txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
        );
    }

    static handleCorrectionRequest(message, currentData) {
        console.log('🔄 Processing correction:', message);

        const data = { ...currentData };

        // Restaurant name correction
        if (message.toLowerCase().includes('restaurant name') || message.toLowerCase().includes('name')) {
            const nameMatch = message.match(/name\s+to\s+(.+)|name\s+is\s+(.+)|called\s+(.+)/i);
            if (nameMatch) {
                const newName = (nameMatch[1] || nameMatch[2] || nameMatch[3]).trim();
                data.RestaurantName = this.capitalizeWords(newName);
                console.log('✅ Updated restaurant name to:', data.RestaurantName);
            }
        }

        // Cuisine correction
        if (message.toLowerCase().includes('cuisine')) {
            const cuisineMatch = message.match(/cuisine\s+to\s+(.+)|cuisine\s+is\s+(.+)/i);
            if (cuisineMatch) {
                const newCuisine = (cuisineMatch[1] || cuisineMatch[2]).trim();
                data.Cuisine = this.capitalizeWords(newCuisine);
                console.log('✅ Updated cuisine to:', data.Cuisine);
            }
        }

        return data;
    }

    static async processSetupMessageFallback({ message, history = [], collectedData = {} }) {
        const updatedData = await this.extractDataFromConversation(message, history, collectedData);
        const nextField = this.getNextMissingField(updatedData);
        const dataCount = Object.keys(updatedData).filter(key => !key.startsWith('_')).length;
        const setupComplete = !nextField && dataCount === 10;

        let responseMessage = '';
        let needsMap = false;

        if (nextField === 'RestaurantName') {
            responseMessage = "🎉 Welcome to AICHMI!\n\nI'm excited to help you set up your restaurant's AI assistant. Payment has been processed successfully.\n\nWhat's the name of your restaurant?";
        } else if (nextField === 'Cuisine') {
            responseMessage = `Perfect! "${updatedData.RestaurantName}" sounds wonderful. What type of cuisine do you serve?`;
        } else if (nextField === 'Location') {
            responseMessage = `Excellent! Now I need to know your restaurant's location. Please use the map below to select your exact location.\n\nYou can search for your restaurant or click directly on the map where it's located.`;
            needsMap = true;
        } else if (nextField === 'Phone') {
            responseMessage = `Great location! What's your restaurant's phone number?`;
        } else if (nextField === 'Pricing') {
            responseMessage = `Perfect! What's your pricing level? Please choose: affordable, moderate, or expensive.`;
        } else if (nextField === 'Description') {
            responseMessage = `Wonderful! Can you provide a brief description of your restaurant?`;
        } else if (nextField === 'OwnerEmail') {
            responseMessage = `Excellent! Now I need some owner information. What's your email address?`;
        } else if (nextField === 'OwnerFirstName') {
            responseMessage = `Great! What's your first name?`;
        } else if (nextField === 'OwnerLastName') {
            responseMessage = `And what's your last name?`;
        } else if (nextField === 'OwnerPassword') {
            responseMessage = `Finally, please create a secure password (minimum 8 characters).`;
        } else if (setupComplete) {
            // All data collected, save to database
            try {
                console.log('💾 [FALLBACK] Saving restaurant to database...');
                const dbResult = await this.saveRestaurantToDatabase(updatedData);
                console.log('✅ [FALLBACK] Restaurant saved to database:', dbResult);

                responseMessage = `🎉 Success! Your restaurant "${updatedData.RestaurantName}" has been created and is now live!`;

                return {
                    type: 'message',
                    reply: responseMessage,
                    needsMap: false,
                    collectedData: updatedData,
                    setupComplete: true,
                    venueId: dbResult.venueId
                };

            } catch (error) {
                console.error('❌ [FALLBACK] Failed to save restaurant:', error);
                responseMessage = `❌ There was an error creating your restaurant profile. Please try again later.\n\nError: ${error.message}`;

                return {
                    type: 'message',
                    reply: responseMessage,
                    needsMap: false,
                    collectedData: updatedData,
                    setupComplete: false,
                    error: 'Database save failed'
                };
            }
        }
        
        return {
            type: 'message',
            reply: responseMessage,
            needsMap: needsMap,
            collectedData: updatedData,
            setupComplete: setupComplete
        };
    }
}

export default RestaurantSetupService;