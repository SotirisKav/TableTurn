import LocationValidationService from './LocationValidationService.js';

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

        // Replace the restaurant name extraction section with this improved version:
        if (!data.RestaurantName && 
            (lastAIMessage.includes('name') || lastAIMessage.includes('restaurant') || history.length <= 4) && 
            responseType === 'direct_answer') {

            console.log('🔍 Checking restaurant name extraction:', {
                hasRestaurantName: !!data.RestaurantName,
                lastAIMessage: lastAIMessage.substring(0, 50),
                includesName: lastAIMessage.includes('name'),
                includesRestaurant: lastAIMessage.includes('restaurant'),
                historyLength: history.length,
                responseType,
                message
            });

            let cleanName = message.trim();
            cleanName = cleanName.replace(/^(my restaurant is|the name is|it's|its|restaurant name is|name is|called|named)\s*/i, '');

            // IMPROVED VALIDATION - Much stricter
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

            console.log('🔍 Name validation:', {
                originalMessage: message,
                cleanName,
                isValidName,
                hasValidLength,
                notInInvalidList,
                hasAtLeastOneLetter,
                hasOnlyGreekLettersAndSymbols,
                hasOnlyEnglishLettersAndSymbols
            });

            if (isValidName) {
                data.RestaurantName = this.capitalizeWords(cleanName);
                console.log('✅ Extracted restaurant name:', data.RestaurantName);
            } else {
                console.log('❌ Invalid restaurant name rejected:', cleanName);
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

        // Location extraction (NEW - Handle Google Maps data)
        if (!data.Location && responseType === 'location_data') {
            try {
                let locationValidation = null;

                // Format 1: "location_selected: {...}"
                if (message.includes('location_selected:')) {
                    const jsonMatch = message.match(/location_selected:\s*({.*})/);
                    if (jsonMatch) {
                        const locationData = JSON.parse(jsonMatch[1]);
                        locationValidation = await LocationValidationService.validateAndExtractLocation(
                            locationData.lat, 
                            locationData.lng, 
                            locationData.placeId
                        );
                    }
                }
                // Format 2: "place_id: ChIJ..."
                else if (message.includes('place_id:')) {
                    const placeId = message.replace('place_id:', '').trim();
                    locationValidation = await LocationValidationService.validatePlaceId(placeId);
                }
                // Format 3: "lat: 37.123, lng: 25.456"
                else if (message.match(/lat:\s*-?\d+\.?\d*,\s*lng:\s*-?\d+\.?\d*/)) {
                    const coordMatch = message.match(/lat:\s*(-?\d+\.?\d*),\s*lng:\s*(-?\d+\.?\d*)/);
                    if (coordMatch) {
                        const lat = parseFloat(coordMatch[1]);
                        const lng = parseFloat(coordMatch[2]);
                        locationValidation = await LocationValidationService.validateAndExtractLocation(lat, lng);
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
                } else {
                    console.log('❌ Location validation failed:', locationValidation?.error);
                    data._locationError = locationValidation?.error || 'Location validation failed';
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
            if (description.length > 10 && description.length <= 500) {
                data.Description = description;
                console.log('✅ Extracted description:', data.Description);
            }
        }

        // Owner email extraction
        if (!data.OwnerEmail && lastAIMessage.includes('email') && responseType === 'direct_answer') {
            const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
            const emailMatch = message.match(emailRegex);
            if (emailMatch) {
                data.OwnerEmail = emailMatch[0].toLowerCase();
                console.log('✅ Extracted email:', data.OwnerEmail);
            }
        }

        // Owner first name extraction
        if (!data.OwnerFirstName && lastAIMessage.includes('first name') && responseType === 'direct_answer') {
            let firstName = message.trim();
            firstName = firstName.replace(/^(my name is|i am|i'm|first name is|name is)\s*/i, '');
            if (firstName.length > 0 && firstName.length <= 50) {
                data.OwnerFirstName = this.capitalizeWords(firstName);
                console.log('✅ Extracted first name:', data.OwnerFirstName);
            }
        }

        // Owner last name extraction
        if (!data.OwnerLastName && lastAIMessage.includes('last name') && responseType === 'direct_answer') {
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

    static async processSetupMessage({ message, history = [], collectedData = {} }) {
        console.log('🚀 Processing setup message:', { message, historyLength: history.length, collectedData });

        const updatedData = await this.extractDataFromConversation(message, history, collectedData);
        const nextField = this.getNextMissingField(updatedData);
        const dataCount = Object.keys(updatedData).filter(key => !key.startsWith('_')).length;
        const totalFields = 10;

        const isFirstMessage = history.length <= 1;
        const isGreeting = ['hi', 'hey', 'hello'].includes(message.toLowerCase().trim());

        let systemPrompt = `You are AICHMI Setup Assistant helping set up a restaurant profile.

**CURRENT STATUS:**
- Data collected: ${dataCount}/${totalFields} fields
- Restaurant Name: ${updatedData.RestaurantName || 'NOT PROVIDED'}
- Cuisine: ${updatedData.Cuisine || 'NOT PROVIDED'}
- Location: ${updatedData.Location ? `✅ ${updatedData.Location.island}, ${updatedData.Location.area}, ${updatedData.Location.address}` : 'NOT PROVIDED'}
- Phone: ${updatedData.Phone || 'NOT PROVIDED'}
- Pricing: ${updatedData.Pricing || 'NOT PROVIDED'}
- Description: ${updatedData.Description || 'NOT PROVIDED'}
- Owner Email: ${updatedData.OwnerEmail || 'NOT PROVIDED'}
- Owner First Name: ${updatedData.OwnerFirstName || 'NOT PROVIDED'}
- Owner Last Name: ${updatedData.OwnerLastName || 'NOT PROVIDED'}
- Owner Password: ${updatedData.OwnerPassword ? 'PROVIDED ✓' : 'NOT PROVIDED'}

${updatedData._locationError ? `
**LOCATION ERROR:**
${updatedData._locationError}
Please ask the user to select their location again using the map.` : ''}

**INSTRUCTIONS:**
${isGreeting || isFirstMessage ? 
  'Start with a brief welcome and ask for the first missing piece of information.' : 
  'Continue the conversation naturally. DO NOT greet again.'}

${nextField === 'Location' ? `
**SPECIAL INSTRUCTION FOR LOCATION:**
The user needs to select their restaurant location. Respond with exactly this format:

"Great! Now I need to know your restaurant's location. Please use the map below to select your exact location.

[SHOW_MAP]

You can search for your restaurant or click directly on the map where it's located. I need to detect the island, area, and street address."

Do not ask for anything else when location is needed.` : ''}

${nextField && nextField !== 'Location' ? 
  `NEXT ACTION: Acknowledge what they just provided and ask for: ${this.getFieldPrompt(nextField)}` :
  
  nextField ? '' :
  
  `ALL DATA COLLECTED! Use this EXACT format:
  
  🎉 Perfect! Creating your restaurant profile...

  [RESTAURANT_DATA]
  RestaurantName: ${updatedData.RestaurantName}
  Cuisine: ${updatedData.Cuisine}
  Island: ${updatedData.Location.island}
  Area: ${updatedData.Location.area}
  Address: ${updatedData.Location.address}
  Phone: ${updatedData.Phone}
  Pricing: ${updatedData.Pricing}
  Description: ${updatedData.Description}
  OwnerEmail: ${updatedData.OwnerEmail}
  OwnerFirstName: ${updatedData.OwnerFirstName}
  OwnerLastName: ${updatedData.OwnerLastName}
  OwnerPassword: ${updatedData.OwnerPassword}
  PlaceId: ${updatedData.Location.placeId}
  [/RESTAURANT_DATA]`}

**RULES:**
- Be friendly and encouraging
- Acknowledge what they just provided before asking for next item
- Keep responses concise`;

        try {
            // Use the same pattern as AIService.js - direct fetch instead of GoogleGenerativeAI library
            const contents = [
                { role: "user", parts: [{ text: systemPrompt }] },
                ...history.map(msg => ({
                    role: msg.sender === "user" ? "user" : "model", 
                    parts: [{ text: msg.text }]
                })),
                { role: "user", parts: [{ text: `User message: "${message}"` }] }
            ];

            const response = await fetch(
                'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-goog-api-key': process.env.GEMINI_API_KEY
                    },
                    body: JSON.stringify({ contents })
                }
            );

            const data = await response.json();
            console.log('🤖 Gemini API response:', data);

            const candidate = data?.candidates?.[0];
            if (!candidate) {
                console.log('❌ No candidate in response, using fallback');
                return this.processSetupMessageFallback({ message, history, collectedData: updatedData });
            }

            const content = candidate.content;
            if (!content) {
                console.log('❌ No content in candidate, using fallback');
                return this.processSetupMessageFallback({ message, history, collectedData: updatedData });
            }

            let aiReply;
            if (Array.isArray(content.parts) && content.parts[0]?.text) {
                aiReply = content.parts[0].text;
            } else if (typeof content.text === "string") {
                aiReply = content.text;
            } else {
                console.log('❌ No valid text in content, using fallback');
                return this.processSetupMessageFallback({ message, history, collectedData: updatedData });
            }

            console.log('✅ Gemini API success:', aiReply.substring(0, 100) + '...');

            return {
                type: 'message',
                reply: aiReply,
                collectedData: updatedData,
                setupComplete: !nextField
            };

        } catch (error) {
            console.error('Gemini API Error:', error);
            // Fallback to simple logic if AI fails
            console.log('🔄 Using fallback logic...');
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

        // Other corrections can be added here...

        return data;
    }

    static async processSetupMessageFallback({ message, history = [], collectedData = {} }) {
        const updatedData = await this.extractDataFromConversation(message, history, collectedData);
        const nextField = this.getNextMissingField(updatedData);

        let responseMessage = '';

        if (nextField === 'RestaurantName') {
            responseMessage = "🎉 Welcome to AICHMI!\n\nI'm excited to help you set up your restaurant's AI assistant. Let's start by getting to know your restaurant better.\n\nWhat's the name of your restaurant?";
        } else if (nextField === 'Cuisine') {
            responseMessage = `Perfect! "${updatedData.RestaurantName}" sounds wonderful. What type of cuisine do you serve?`;
        } else if (nextField === 'Location') {
            responseMessage = `Excellent! Now I need to know your restaurant's location. Please use the map below to select your exact location.\n\n[SHOW_MAP]\n\nYou can search for your restaurant or click directly on the map where it's located.`;
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
        } else {
            responseMessage = `🎉 Perfect! Creating your restaurant profile...\n\n[RESTAURANT_DATA]\nRestaurantName: ${updatedData.RestaurantName}\nCuisine: ${updatedData.Cuisine}\nIsland: ${updatedData.Location?.island}\nArea: ${updatedData.Location?.area}\nAddress: ${updatedData.Location?.address}\nPhone: ${updatedData.Phone}\nPricing: ${updatedData.Pricing}\nDescription: ${updatedData.Description}\nOwnerEmail: ${updatedData.OwnerEmail}\nOwnerFirstName: ${updatedData.OwnerFirstName}\nOwnerLastName: ${updatedData.OwnerLastName}\nOwnerPassword: ${updatedData.OwnerPassword}\nPlaceId: ${updatedData.Location?.placeId}\n[/RESTAURANT_DATA]`;
        }

        return {
            type: 'message',
            reply: responseMessage,
            collectedData: updatedData,
            setupComplete: !nextField
        };
    }
}

export default RestaurantSetupService;