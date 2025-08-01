import fetch from 'node-fetch';
import RestaurantService from './RestaurantService.js';
import { TOOL_DEFINITIONS } from './ToolService.js';
import db from '../config/database.js'; 

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// RAG function to fetch relevant data based on user query
/**
 * @deprecated Use RAGService.retrieveContextForQuery() instead
 * This function is kept for backward compatibility only
 */
async function fetchRelevantData(prompt, restaurantId = null) {
  console.warn('⚠️ fetchRelevantData is deprecated. Use RAGService.retrieveContextForQuery() instead');
  
  // Import and delegate to the new unified system
  const RAGService = await import('./RAGService.js');
  return await RAGService.default.retrieveContextForQuery(prompt, restaurantId);
}

// Function to format retrieved data for the AI prompt
function formatDataForPrompt(data) {
  let contextInfo = "\n\n--- RELEVANT INFORMATION ---\n";

  // Handle both old and new RAG data structures
  if (!data) {
    return contextInfo + "--- END OF RELEVANT INFORMATION ---\n\n";
  }

  // Format restaurant information
  if (data.restaurants && data.restaurants.length > 0) {
    contextInfo += "\n**RESTAURANTS:**\n";
    data.restaurants.forEach(restaurant => {
      contextInfo += `- **${restaurant.name}**: ${restaurant.description}\n`;
      contextInfo += `  - Location: ${restaurant.address}, ${restaurant.location}\n`;
      contextInfo += `  - Cuisine: ${restaurant.cuisine}\n`;
      contextInfo += `  - Rating: ${restaurant.rating}/5\n`;
      contextInfo += `  - Price Range: ${restaurant.priceRange || restaurant.price_range}\n\n`;
    });
  }

  // Format owner information
  if (data.owners && data.owners.length > 0) {
    contextInfo += "\n**RESTAURANT OWNERS/CONTACTS:**\n";
    data.owners.forEach(owner => {
      const ownerName = owner.first_name && owner.last_name 
        ? `${owner.first_name} ${owner.last_name}` 
        : (owner.name || 'Owner');
      contextInfo += `- **${owner.restaurant_name}**: Owner is ${ownerName}\n`;
      contextInfo += `  - Email: ${owner.email}\n`;
      contextInfo += `  - Phone: ${owner.phone}\n\n`;
    });
  }

  if (data.availableTableTypes && data.availableTableTypes.length > 0) {
    contextInfo += "\n**AVAILABLE TABLE TYPES FOR THIS RESTAURANT:**\n";
    contextInfo += data.availableTableTypes.map(t => `- ${t}`).join('\n') + '\n';
  }

  // Format menu items if present
  if (data.menuItems && data.menuItems.length > 0) {
    contextInfo += "\n**MENU FOR LOFAKI TAVERNA:**\n";
    let lastCategory = null;
    data.menuItems.forEach(item => {
      if (item.category !== lastCategory) {
        contextInfo += `\n*${item.category}*\n`;
        lastCategory = item.category;
      }
      contextInfo += `- **${item.name}**: ${item.description || ''} (€${item.price})`;
      const tags = [];
      if (item.is_vegetarian) tags.push('Vegetarian');
      if (item.is_vegan) tags.push('Vegan');
      if (item.is_gluten_free) tags.push('Gluten-Free');
      if (tags.length > 0) contextInfo += ` [${tags.join(', ')}]`;
      contextInfo += '\n';
    });
    contextInfo += '\n';
  }

  // Format table pricing
  if (data.generalInfo && data.generalInfo.tables && data.generalInfo.tables.length > 0) {
    contextInfo += "\n**TABLE TYPES & PRICING:**\n";
    data.generalInfo.tables.forEach(table => {
      contextInfo += `- **${table.table_type}**: €${table.table_price}\n`;
    });
    contextInfo += "\n";
  }

  // Format transfer information
  if (data.generalInfo && data.generalInfo.transfers && data.generalInfo.transfers.length > 0) {
    contextInfo += "\n**TRANSFER SERVICES:**\n";
    data.generalInfo.transfers.forEach(transfer => {
      contextInfo += `- **${transfer.name}**: €${transfer.price_4_or_less} (1-4 people), €${transfer.price_5_to_8} (5-8 people)\n`;
    });
    contextInfo += "\n";
  }

  // Format booked dates
  if (data.generalInfo && data.generalInfo.bookedDates && data.generalInfo.bookedDates.length > 0) {
    contextInfo += "\n**UNAVAILABLE DATES:**\n";
    data.generalInfo.bookedDates.forEach(date => {
      contextInfo += `- ${date.date} ${date.reason ? '(' + date.reason + ')' : ''}\n`;
    });
    contextInfo += "\n";
  }

  contextInfo += "--- END OF RELEVANT INFORMATION ---\n\n";
  return contextInfo;
}

function extractReservationFromResponse(responseText) {
  const match = responseText.match(/\[RESERVATION_DATA\]([\s\S]*?)\[\/RESERVATION_DATA\]/);
  if (!match) return null;

  const dataBlock = match[1];
  const lines = dataBlock.split('\n').filter(line => line.trim());
  
  const reservation = {};
  lines.forEach(line => {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length > 0) {
      const value = valueParts.join(':').trim();
      reservation[key.trim()] = value;
    }
  });

  return reservation;
}

export async function askGemini(prompt, history = [], restaurantId = null) {
  // Skip RAG for internal AI analysis prompts to avoid circular dependencies
  const isInternalAnalysisPrompt = prompt.includes('You are an expert conversation analyst') || 
                                  prompt.includes('Extract reservation details') ||
                                  prompt.includes('Extract key entities');
  
  const relevantData = isInternalAnalysisPrompt ? null : await fetchRelevantData(prompt, restaurantId);
  let restaurantName = null;

  if (relevantData && relevantData.restaurants && relevantData.restaurants.length > 0) {
    restaurantName = relevantData.restaurants[0].name;
  } else if (restaurantId) {
    // Defensive: fetch restaurant name directly if not in array
    const restaurant = await RestaurantService.getRestaurantById(restaurantId);
    if (restaurant) restaurantName = restaurant.name;
  }

  let systemPrompt = `
  You are Tablio, a friendly and helpful AI assistant for restaurant reservations in Kos, Greece.
  `;

  if (restaurantName) {
    systemPrompt += `
    You are currently assisting with **${restaurantName}**.
    If the user wants to make a reservation, it is for **${restaurantName}**.
    Never ask the user which restaurant they want; you already know it.
    Be conversational, natural, and helpful - like chatting with a friend who knows about the restaurant.
    `;
  }

  systemPrompt += `
  **IMPORTANT INSTRUCTIONS:**
  - Keep responses brief and to the point
  - Use the provided relevant information to answer questions accurately
  - Be friendly but concise - avoid long explanations unless specifically asked
  - If the user asks to make a reservation, ask for all necessary details (date, time, number of people, special requests and table type)
  - If the user asks about a restaurant, provide information using the data provided below
  - If the user asks for something you can't do, politely explain your limitations
  - Always confirm details before finalizing a reservation
  - If the user provides incomplete information, ask clarifying questions
  - Use markdown for lists, bold important details, and keep your answers easy to read
  - When mentioning prices, always include the € symbol
  - When asking the user for table type preference, only mention the available table types listed in the context (e.g., grass, standard, anniversary).
  - Always inform the user of the extra pricing of a table if there is, if he is interested in it.
  - Do not offer or accept table types that are not listed as available for this restaurant.
  - For dates, use a clear format (e.g., "July 15, 2025")
  IMPORTANT: When the user confirms a reservation, you MUST reply with:
  1. A confirmation message (e.g., "Perfect! Your reservation is confirmed! 🎉")
  2. IMMEDIATELY AFTER, a hidden block between [RESERVATION_DATA] and [/RESERVATION_DATA], with each field on its own line, for the system to process.

  DO NOT CONFIRM A RESERVATION WITHOUT INCLUDING THE [RESERVATION_DATA] BLOCK.
     RestaurantId: {restaurantId}
     RestaurantName: {restaurantName}
     CustomerName: {customerName}
     CustomerEmail: {customerEmail}
     CustomerPhone: {customerPhone}
     Date: {date}
     Time: {time}
     People: {people}
     TableType: {tableType}
     SpecialRequests: {specialRequests}
     CelebrationType: {celebrationType}
     Cake: {cake}
     CakePrice: {cakePrice}
     Flowers: {flowers}
     FlowersPrice: {flowersPrice}
     HotelName: {hotelName}
     HotelId: {hotelId}
  - For Lofaki Taverna, RestaurantId is 1.
  - Never mention the numeric RestaurantId to the user, only in the hidden block.
  - Example output:

  Perfect! Your reservation is confirmed! 🎉

  [RESERVATION_DATA]
  RestaurantId: 1
  RestaurantName: Lofaki Taverna
  CustomerName: John Doe
  CustomerEmail: johndoe@example.com
  CustomerPhone: +302241234567
  Date: 2025-08-08
  Time: 20:00
  People: 2
  TableType: grass
  SpecialRequests: null
  CelebrationType: null
  Cake: false
  CakePrice: 0
  Flowers: false
  FlowersPrice: 0
  HotelName: null
  HotelId: null
  [/RESERVATION_DATA]

  **CONTEXT FOR THIS CONVERSATION:**
  ${formatDataForPrompt(relevantData)}
  `;

  // Build structured messages for Gemini
  const contents = [
    { role: "user", parts: [{ text: systemPrompt }] }, // system prompt as user message
    ...history.map(msg => ({
      role: msg.sender === "user" ? "user" : "model",
      parts: [{ text: msg.text }]
    })),
    { role: "user", parts: [{ text: prompt }] }
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
    if (!candidate) return { type: 'message', response: "Sorry, I couldn't get a response from Gemini." };

    const content = candidate.content;
    if (!content) return { type: 'message', response: "Sorry, I couldn't get a response from Gemini." };

    let aiResponse;
    if (Array.isArray(content.parts) && content.parts[0]?.text) {
      aiResponse = content.parts[0].text;
    } else if (typeof content.text === "string") {
      aiResponse = content.text;
    } else {
      return { type: 'message', response: "Sorry, I couldn't get a response from Gemini." };
    }

    // Check if the response contains reservation data
    const reservationData = extractReservationFromResponse(aiResponse);
    
    if (reservationData) {
      // Remove the hidden block from the user-facing response
      const cleanResponse = aiResponse.replace(/\[RESERVATION_DATA\][\s\S]*?\[\/RESERVATION_DATA\]/g, '').trim();
      
      // Format the reservation details for the confirmation page
      const formattedReservation = {
        restaurant: reservationData.RestaurantName || restaurantName,
        name: reservationData.CustomerName || '',
        email: reservationData.CustomerEmail || '',
        phone: reservationData.CustomerPhone || '',
        date: reservationData.Date || '',
        time: reservationData.Time || '',
        partySize: reservationData.People || '',
        tableType: reservationData.TableType || '',
        specialRequests: reservationData.SpecialRequests === 'None' ? '' : reservationData.SpecialRequests || '',
        celebrationType: reservationData.CelebrationType === 'None' ? '' : reservationData.CelebrationType || '',
        cake: reservationData.Cake === 'true',
        cakePrice: parseFloat(reservationData.CakePrice || 0),
        flowers: reservationData.Flowers === 'true',
        flowersPrice: parseFloat(reservationData.FlowersPrice || 0),
        hotelName: reservationData.HotelName === 'None' ? '' : reservationData.HotelName || '',
        restaurantId: reservationData.RestaurantId || restaurantId
      };

      return {
        type: 'redirect',
        response: cleanResponse,
        reservationDetails: formattedReservation
      };
    }

    return {
      type: 'message',
      response: aiResponse
    };

  } catch (error) {
    console.error('Error calling Gemini API:', error);
    return {
      type: 'message',
      response: "Sorry, I'm having trouble connecting to the AI service right now. Please try again later."
    };
  }
}

/**
 * NEW ARCHITECTURE: The "Thinking" Call
 * 
 * This function analyzes the user's message and conversation state to choose
 * the single best tool to call next. It serves as the "brain" of the system.
 * 
 * @param {string} message - The user's latest message
 * @param {Array} history - Recent conversation history for context
 * @param {Object} conversationState - Current state including activeFlow and flowState
 * @param {number} restaurantId - Current restaurant ID
 * @returns {Promise<Object>} - Tool selection decision with parameters
 */
export async function getAiPlan(message, history = [], conversationState = {}, restaurantId = null) {
  try {
    console.log('🧠 AI Plan: Analyzing message for tool selection:', message);
    
    // Build the comprehensive prompt that serves as the system's "brain"
    const planningPrompt = buildPlanningPrompt(message, history, conversationState, restaurantId);
    
    // Call Gemini with the planning prompt
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: planningPrompt }] }
          ]
        })
      }
    );
    
    const data = await response.json();
    const candidate = data?.candidates?.[0];
    
    if (!candidate?.content?.parts?.[0]?.text) {
      console.error('❌ Invalid response from Gemini for planning:', data);
      return getFallbackPlan();
    }
    
    const aiResponse = candidate.content.parts[0].text.trim();
    console.log('🤖 AI Planning Response:', aiResponse);
    
    // Parse the JSON response
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('❌ No JSON found in planning response:', aiResponse);
        return getFallbackPlan();
      }
      
      const toolDecision = JSON.parse(jsonMatch[0]);
      
      // Validate the response format
      if (!toolDecision.tool_to_call || !toolDecision.parameters) {
        console.error('❌ Invalid tool decision format:', toolDecision);
        return getFallbackPlan();
      }
      
      // Validate that the tool exists
      if (!TOOL_DEFINITIONS[toolDecision.tool_to_call]) {
        console.error('❌ Unknown tool specified:', toolDecision.tool_to_call);
        return getFallbackPlan();
      }
      
      console.log('✅ AI selected tool:', toolDecision.tool_to_call, 'with parameters:', toolDecision.parameters);
      return toolDecision;
      
    } catch (parseError) {
      console.error('❌ Error parsing AI planning response:', parseError);
      return getFallbackPlan();
    }
    
  } catch (error) {
    console.error('❌ Error in AI planning:', error);
    return getFallbackPlan();
  }
}

/**
 * NEW ARCHITECTURE: The "Speaking" Call
 * 
 * This function takes the user's original message and the factual tool result
 * to formulate a natural, helpful, and conversational response.
 * 
 * @param {string} userMessage - The user's original message
 * @param {Object} toolResult - The data returned from executing the tool
 * @param {string} toolName - Name of the tool that was executed
 * @param {number} restaurantId - Current restaurant ID
 * @returns {Promise<Object>} - Natural language response for the user
 */
export async function generateSpokenResponse(userMessage, toolResult, toolName, restaurantId = null) {
  try {
    console.log('🗣️ Generating spoken response for tool:', toolName);
    
    // Get restaurant info for context
    let restaurantName = null;
    if (restaurantId) {
      const restaurant = await RestaurantService.getRestaurantById(restaurantId);
      if (restaurant) restaurantName = restaurant.name;
    }
    
    // Build the response generation prompt
    const responsePrompt = buildResponsePrompt(userMessage, toolResult, toolName, restaurantName);
    
    // Call Gemini with the response prompt
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: responsePrompt }] }
          ]
        })
      }
    );
    
    const data = await response.json();
    const candidate = data?.candidates?.[0];
    
    if (!candidate?.content?.parts?.[0]?.text) {
      console.error('❌ Invalid response from Gemini for response generation:', data);
      return {
        type: 'message',
        response: "I apologize, but I'm having trouble formulating a response right now."
      };
    }
    
    const aiResponse = candidate.content.parts[0].text.trim();
    console.log('🗣️ Generated response:', aiResponse);
    
    // Determine response type based on tool and result
    let responseType = 'message';
    let additionalData = {};
    
    // Special handling for create_reservation tool
    if (toolName === 'create_reservation' && toolResult.success) {
      responseType = 'redirect';
      additionalData.reservationDetails = toolResult.reservationDetails;
    }
    
    // Special handling for check_availability with multiple table types
    if (toolName === 'check_availability' && toolResult.hasMultipleTableTypes) {
      additionalData.availableTableTypes = toolResult.availableTableTypes;
    }
    
    return {
      type: responseType,
      response: aiResponse,
      ...additionalData
    };
    
  } catch (error) {
    console.error('❌ Error generating spoken response:', error);
    return {
      type: 'message',
      response: "I apologize, but I'm having trouble responding right now. Please try again."
    };
  }
}

/**
 * Build the comprehensive planning prompt for tool selection
 */
function buildPlanningPrompt(message, history, conversationState, restaurantId) {
  const recentHistory = history.slice(-5).map(h => `${h.sender}: ${h.text}`).join('\n');
  const activeFlow = conversationState.activeFlow || 'none';
  const flowState = conversationState.flowState || {};
  
  // Create detailed tool schemas for the prompt
  const toolSchemas = Object.entries(TOOL_DEFINITIONS)
    .map(([name, def]) => {
      const requiredParams = def.parameters.required || [];
      const paramDetails = Object.entries(def.parameters.properties || {})
        .map(([param, details]) => {
          const required = requiredParams.includes(param) ? ' (REQUIRED)' : ' (optional)';
          const enumValues = details.enum ? ` [options: ${details.enum.join(', ')}]` : '';
          return `    - ${param}: ${details.description}${required}${enumValues}`;
        }).join('\n');
      
      return `${name}:
  Description: ${def.description}
  Parameters:
${paramDetails}`;
    }).join('\n\n');
  
  // Get current date information
  const now = new Date();
  const today = now.toISOString().split('T')[0]; // YYYY-MM-DD format
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const currentTime = now.toTimeString().split(' ')[0].substring(0, 5); // HH:MM format
  
  return `You are an expert orchestrator for a restaurant AI. Your job is to analyze the user's message and the conversation state to choose the single best tool to call next.

DATE/TIME CONTEXT (Use ONLY when user mentions temporal references):
- Today's date: ${today}
- Tomorrow's date: ${tomorrow}
- Current time: ${currentTime}
- When user says "tomorrow", use: ${tomorrow}
- When user says "today", use: ${today}
- When user says "now" or "right now", use current time
- When user provides NO date/time, ask for clarification instead of assuming

TOOL SCHEMAS (Use these exact parameter names and formats):
${toolSchemas}

CONVERSATION CONTEXT:
Recent History:
${recentHistory || 'No previous messages'}

Current State:
- Active Flow: ${activeFlow}
- Flow State: ${JSON.stringify(flowState, null, 2)}
- Restaurant ID: ${restaurantId}

USER MESSAGE: "${message}"

ROUTING RULES (CRITICAL - Follow these exactly):

Rule 1 (State Continuation): If the conversation state shows I just asked a question (e.g., 'Which type would you prefer?'), and the user's message is a direct answer, your primary goal is to continue that flow. If you now have ALL necessary details (name, email, phone, date, time, partySize, tableType), call the create_reservation tool.

Rule 2 (Booking Flow): Any NEW request containing EXPLICIT date, time, AND party size must call the check_availability tool FIRST. If the user only provides party size without date/time, use clarify_and_respond to ask for the missing information.

Rule 3 (Context Modification): If the conversation state shows an active 'booking' flow and the user provides a new time (e.g., 'what about at 5pm?'), you must call the check_availability tool again with the updated time, carrying over the other details from the flowState.

Rule 4 (Menu Queries): Use get_menu_items for any food, dish, menu, dietary, or price-related questions.

Rule 5 (Restaurant Info): Use get_restaurant_info for questions about hours, address, location, owner information, contact details, or general restaurant information.

Rule 6 (Celebration Packages): Use get_celebration_packages for questions about celebrations, special occasions, birthday packages, anniversary setups, romantic celebrations, or any special event planning.

Rule 7 (Missing Information): Use clarify_and_respond when the user wants to make a reservation but hasn't provided complete booking details (date, time, AND party size). Ask specifically for the missing information.

Rule 8 (Fallback): Use clarify_and_respond when the user's request is ambiguous, out of scope, or you don't have enough information to call another tool.

PARAMETER FORMAT REQUIREMENTS:
- For check_availability: Use YYYY-MM-DD for date, HH:MM for time (24-hour format), integer for partySize
- For get_menu_items: ALWAYS include the "query" parameter (required), use boolean flags for dietary restrictions
- For get_restaurant_info: Use "topic" parameter with values: hours, address, description, or general
- For clarify_and_respond: ALWAYS include the "message" parameter with your clarifying question

RESPONSE FORMAT:
You MUST respond with a single JSON object in this exact format:
{
  "tool_to_call": "tool_name",
  "parameters": {
    "param1": "value1",
    "param2": "value2"
  }
}

Do NOT include any explanatory text before or after the JSON. Only return the JSON object.`;
}

/**
 * Build the response generation prompt
 */
function buildResponsePrompt(userMessage, toolResult, toolName, restaurantName) {
  // Special handling for master narrator consolidation - use the stricter approach
  if (toolName === 'master_narrator_consolidation') {
    return `You are a helpful AI assistant. Your ONLY job is to translate the provided "Tool Result" into a natural, human-readable response.

**CRITICAL RULE: You MUST base your response exclusively on the information within the "Tool Result" section. Do not use any prior knowledge. Do not answer the user's original question if the tool result indicates it cannot be answered.**

**CRITICAL RULE: Your primary goal is to directly answer the user's original question using the factual data provided in the 'Tool Result'. If the user asks a specific yes/no question (e.g., 'Are the lamb chops gluten-free?'), and the tool result provides the necessary information to answer it, you must answer with a direct 'Yes' or 'No' before providing any additional, related information. For example, if the tool result shows the lamb chops are not gluten-free, the correct response is: 'No, our lamb chops are not gluten-free. However, if you are looking for a gluten-free option, I can recommend...'.**

User's Original Question: "${userMessage}"

--- TOOL RESULT (The Ground Truth) ---
${JSON.stringify(toolResult, null, 2)}
--- END OF TOOL RESULT ---

Now, based ONLY on the Tool Result, formulate the final response to the user.

Examples:
- If the Tool Result contains { success: true, message: 'I am sorry, I cannot provide owner information.' }, your response MUST be: "I am sorry, I cannot provide owner information."
- If the Tool Result is { success: true, available: true, availableTableTypes: [...] }, your response should be: "Great news! We have tables available..."
- If the Tool Result is { success: false, error: '...' }, your response MUST be: "I'm sorry, an error occurred while processing your request."

CRITICAL: If the tool result says it cannot provide information or gives an error message, you MUST convey that exact limitation. Do not invent or supplement information.`;
  }

  // For regular tools, also use the stricter approach
  return `You are a helpful AI assistant. Your ONLY job is to translate the provided "Tool Result" into a natural, human-readable response.

**CRITICAL RULE: You MUST base your response exclusively on the information within the "Tool Result" section. Do not use any prior knowledge. Do not answer the user's original question if the tool result indicates it cannot be answered.**

**CRITICAL RULE: Your primary goal is to directly answer the user's original question using the factual data provided in the 'Tool Result'. If the user asks a specific yes/no question (e.g., 'Are the lamb chops gluten-free?'), and the tool result provides the necessary information to answer it, you must answer with a direct 'Yes' or 'No' before providing any additional, related information. For example, if the tool result shows the lamb chops are not gluten-free, the correct response is: 'No, our lamb chops are not gluten-free. However, if you are looking for a gluten-free option, I can recommend...'.**

User's Original Question: "${userMessage}"

--- TOOL RESULT (The Ground Truth) ---
${JSON.stringify(toolResult, null, 2)}
--- END OF TOOL RESULT ---

Now, based ONLY on the Tool Result, formulate the final response to the user.

Examples:
- If the Tool Result contains { success: true, message: 'I am sorry, I cannot provide owner information.' }, your response MUST be: "I am sorry, I cannot provide owner information."
- If the Tool Result is { success: true, available: true, availableTableTypes: [...] }, your response should be: "Great news! We have tables available..."
- If the Tool Result is { success: false, error: '...' }, your response MUST be: "I'm sorry, an error occurred while processing your request."

CRITICAL: If the tool result says it cannot provide information or gives an error message, you MUST convey that exact limitation. Do not invent or supplement information.`;
}

/**
 * Format tool results for the response prompt
 */
function formatToolResultForPrompt(toolResult, toolName) {
  switch (toolName) {
    case 'check_availability':
      if (toolResult.available && toolResult.availableTableTypes) {
        return `Available table types: ${toolResult.availableTableTypes.map(t => `${t.tableType} (€${t.price || 0})`).join(', ')}`;
      } else if (!toolResult.available) {
        return `No availability found. Reason: ${toolResult.message || 'Tables fully booked'}`;
      }
      return JSON.stringify(toolResult, null, 2);
      
    case 'get_menu_items':
      if (toolResult.items && toolResult.items.length > 0) {
        const formattedItems = toolResult.items.slice(0, 8).map(item => 
          `${item.name} (€${item.price}) - ${item.description}`
        ).join('\n');
        return `Found ${toolResult.items.length} menu items:
${formattedItems}`;
      }
      return 'No menu items found matching the request';
      
    case 'get_restaurant_info':
      if (toolResult.success && toolResult.restaurant) {
        const restaurant = toolResult.restaurant;
        let info = `Restaurant: ${restaurant.name}
`;
        
        if (restaurant.owner_name) {
          info += `Owner: ${restaurant.owner_name}
`;
          if (restaurant.owner_phone) info += `Owner Phone: ${restaurant.owner_phone}
`;
          if (restaurant.owner_email) info += `Owner Email: ${restaurant.owner_email}
`;
        }
        
        if (restaurant.address) info += `Address: ${restaurant.address}
`;
        if (restaurant.phone) info += `Phone: ${restaurant.phone}
`;
        if (restaurant.email) info += `Email: ${restaurant.email}
`;
        if (restaurant.description) info += `Description: ${restaurant.description}
`;
        
        if (toolResult.hours && toolResult.hours.length > 0) {
          info += `Hours:
`;
          toolResult.hours.forEach(h => {
            info += `  ${h.day_of_week}: ${h.open_time} - ${h.close_time}
`;
          });
        }
        
        return info.trim();
      }
      return 'Restaurant information not available';
    case 'create_reservation':
      if (toolResult.success) {
        return `Reservation created successfully. Confirmation ID: ${toolResult.reservationDetails?.reservationId || 'N/A'}`;
      }
      return `Reservation failed: ${toolResult.error || 'Unknown error'}`;
      
    case 'get_celebration_packages':
      if (toolResult.success && toolResult.packages) {
        const packageList = toolResult.packages.map(pkg => `${pkg.name} (€${pkg.price}) - ${pkg.description}`).join(', ');
        return `Found ${toolResult.packages.length} celebration packages: ${packageList}`;
      }
      return 'No celebration packages found';
      
    case 'master_narrator_consolidation':
      // NEW: Master narrator consolidation with multiple tool results + conversation context
      if (toolResult.allToolResults && toolResult.allToolResults.length > 0) {
        const formattedResults = toolResult.allToolResults.map((result, index) => {
          let summary = '';
          const data = result.data;
          
          if (data && data.success) {
            if (data.available !== undefined) {
              // Availability check result
              if (data.available && data.availableTableTypes) {
                const tableOptions = data.availableTableTypes.map(t => 
                  `${t.tableType} table (€${t.price || 0})`
                ).join(', ');
                summary = `Availability: ${tableOptions} available for ${data.partySize} people on ${data.date} at ${data.time}`;
              } else {
                summary = `Availability: No tables available for the requested time`;
              }
            } else if (data.selectedTableType && data.bookingContext) {
              // Table selection result
              const context = data.bookingContext;
              summary = `Table Selection: User chose ${data.selectedTableType} table for ${context.partySize} people on ${context.date} at ${context.time}. ${data.needsContactInfo ? 'Contact info needed to complete reservation.' : ''}`;
            } else if (data.items && data.items.length > 0) {
              // Menu search result
              const mostExpensive = data.items.reduce((max, item) => 
                parseFloat(item.price) > parseFloat(max.price) ? item : max
              );
              summary = `Menu: Found ${data.items.length} items. Most expensive: ${mostExpensive.name} (€${mostExpensive.price})`;
            } else if (data.message && data.responseType === 'clarification') {
              // Clarification request
              summary = `Clarification: ${data.message}`;
            } else if (data.packages && data.packages.length > 0) {
              // Celebration packages
              summary = `Celebrations: Found ${data.packages.length} celebration packages`;
            } else if (data.restaurant) {
              // Restaurant info
              const restaurant = data.restaurant;
              let infoDetails = [];
              
              if (restaurant.owner_name) {
                infoDetails.push(`Owner: ${restaurant.owner_name}`);
                if (restaurant.owner_phone) infoDetails.push(`Owner Phone: ${restaurant.owner_phone}`);
                if (restaurant.owner_email) infoDetails.push(`Owner Email: ${restaurant.owner_email}`);
              }
              
              if (restaurant.address) infoDetails.push(`Address: ${restaurant.address}`);
              if (restaurant.phone) infoDetails.push(`Phone: ${restaurant.phone}`);
              if (restaurant.email) infoDetails.push(`Email: ${restaurant.email}`);
              
              // Add hours information if available in the result
              if (result.data.hours && result.data.hours.length > 0) {
                const hoursSummary = result.data.hours.map(h => `${h.day_of_week}: ${h.open_time}-${h.close_time}`).join(', ');
                infoDetails.push(`Hours: ${hoursSummary}`);
              }
              
              summary = `Restaurant Info: ${restaurant.name} - ${infoDetails.join(', ')}`;
            } else {
              summary = `${result.agent}: Task completed successfully`;
            }
          } else {
            summary = `${result.agent}: ${data?.error || 'Task failed'}`;
          }
          
          return `${index + 1}. ${summary}`;
        }).join('\n');
        
        // Add conversation history context
        let historyContext = '';
        if (toolResult.conversationHistory && toolResult.conversationHistory.length > 0) {
          const recentHistory = toolResult.conversationHistory.slice(-4).map(msg => 
            `${msg.sender === 'user' ? 'User' : 'Assistant'}: ${msg.text}`
          ).join('\n');
          historyContext = `\n\nCONVERSATION CONTEXT:\n${recentHistory}`;
        }
        
        return `Agent Results:\n${formattedResults}\n\nQuery type: ${toolResult.queryType}\nAgents involved: ${toolResult.agentCount}${historyContext}`;
      }
      return 'No agent results to consolidate';
      
    default:
      return JSON.stringify(toolResult, null, 2);
  }
}

/**
 * NEW ARCHITECTURE: The "Consolidation" Call
 * 
 * This function takes multiple tool results and synthesizes them into a single,
 * natural-sounding response. This eliminates the repetitive, appended responses
 * problem and creates human-like conversation flow.
 * 
 * @param {string} originalQuery - The user's complete original message
 * @param {Array} toolResults - Array of tool results from different agents
 * @param {number} restaurantId - Current restaurant ID
 * @returns {Promise<Object>} - Consolidated natural response
 */
export async function consolidateFinalResponse(originalQuery, toolResults, restaurantId = null) {
  try {
    console.log('🎭 CONSOLIDATION: Synthesizing results into natural response');
    console.log('🎭 Original query:', originalQuery);
    console.log('🎭 Tool results count:', toolResults.length);
    
    // If only one result, return it as-is (no consolidation needed)
    if (toolResults.length === 1) {
      return {
        response: toolResults[0].response,
        type: 'message',
        consolidated: false
      };
    }
    
    // Get restaurant info for context
    let restaurantName = null;
    if (restaurantId) {
      const restaurant = await RestaurantService.getRestaurantById(restaurantId);
      if (restaurant) restaurantName = restaurant.name;
    }
    
    // Build the consolidation prompt
    const consolidationPrompt = buildConsolidationPrompt(
      originalQuery, 
      toolResults, 
      restaurantName
    );
    
    // Call Gemini with the consolidation prompt
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: consolidationPrompt }] }
          ]
        })
      }
    );
    
    const data = await response.json();
    const candidate = data?.candidates?.[0];
    
    if (!candidate?.content?.parts?.[0]?.text) {
      console.error('❌ Invalid response from Gemini for consolidation:', data);
      // Fallback to concatenated responses
      return {
        response: toolResults.map(r => r.response).join('\n\n'),
        type: 'message',
        consolidated: false
      };
    }
    
    const consolidatedResponse = candidate.content.parts[0].text.trim();
    console.log('✅ Consolidated response generated');
    
    return {
      response: consolidatedResponse,
      type: 'message',
      consolidated: true
    };
    
  } catch (error) {
    console.error('❌ Error in response consolidation:', error);
    // Fallback to concatenated responses
    return {
      response: toolResults.map(r => r.response).join('\n\n'),
      type: 'message',
      consolidated: false
    };
  }
}

/**
 * Build the consolidation prompt
 */
function buildConsolidationPrompt(originalQuery, toolResults, restaurantName) {
  // Get current date information for response context
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  // Format tool results for the prompt
  const formattedResults = toolResults.map((result, index) => {
    let formattedData = '';
    
    if (result.tool === 'check_availability' && result.data.available) {
      const tableOptions = result.data.availableTableTypes || [];
      formattedData = `Availability Check Result: ${tableOptions.map(t => 
        `${t.tableType} tables (€${t.price || 0})`
      ).join(', ')} are available for the requested time.`;
    } else if (result.tool === 'get_menu_items' && result.data.items) {
      // Find the most expensive item
      const mostExpensive = result.data.items.reduce((max, item) => 
        parseFloat(item.price) > parseFloat(max.price) ? item : max
      );
      formattedData = `Menu Search Result: The most expensive dish is the '${mostExpensive.name}' at €${mostExpensive.price}.`;
    } else {
      formattedData = `${result.agent} Result: ${result.response}`;
    }
    
    return `${index + 1}. ${formattedData}`;
  }).join('\n');
  
  return `You are a master AI assistant${restaurantName ? ` for ${restaurantName}` : ''}. Your job is to synthesize the results from multiple internal tools into a single, cohesive, and natural-sounding response.

DATE CONTEXT:
- Today's date: ${today}
- Tomorrow's date: ${tomorrow}
- When referring to "tomorrow", use: ${tomorrow}
- When referring to "today", use: ${today}

USER'S ORIGINAL COMPLETE QUERY: "${originalQuery}"

FACTUAL RESULTS FROM MY INTERNAL SYSTEMS:
${formattedResults}

CONSOLIDATION RULES:
1. Create ONE natural, flowing response that addresses the user's complete query
2. First address the primary task (usually availability/booking) and ask for the user's choice if needed
3. Then seamlessly provide answers to any secondary questions without repetitive phrases
4. If asking the user to choose from options, make it clear and conversational
5. Use ONLY the factual data provided - never make up information
6. Keep the tone warm, friendly, and professional like a restaurant host
7. Avoid repetitive phrases like "let me check" or "okay, let me..."
8. Make it sound like something a human would naturally say in one response

Generate the perfect, consolidated response:`;
}

/**
 * Fallback plan when AI planning fails
 */
function getFallbackPlan() {
  return {
    tool_to_call: 'clarify_and_respond',
    parameters: {
      response_type: 'clarification',
      message: 'I need a bit more information to help you. Could you please clarify what you\'re looking for?'
    }
  };
}

/**
 * AI-powered interruption detection for conversation flow management
 * Determines if user message is a topic change rather than continuation
 */
export async function isInterruption(message) {
  try {
    console.log('🔍 AI Interruption Check:', message);
    
    const interruptionPrompt = `You are a conversation analyst. The AI is currently waiting for the user to provide a specific piece of information to continue a booking (e.g., choosing a table type or providing contact details).

The user's latest message is: "${message}"

Does this message appear to be a complete change of topic or an unrelated greeting, rather than an answer to the AI's previous question?

Examples of INTERRUPTIONS (YES):
- "hello" 
- "what's your menu"
- "what are your hours"
- "can you tell me about your restaurant"
- "actually never mind"

Examples of CONTINUATIONS (NO):
- "standard table please"
- "anniversary table"
- "grass table"
- "my name is John"
- "john@email.com"
- "yes that works"
- "no i meant tomorrow"

Respond with ONLY a single word: YES or NO.`;

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: interruptionPrompt }] }
          ]
        })
      }
    );
    
    const data = await response.json();
    const candidate = data?.candidates?.[0];
    
    if (!candidate?.content?.parts?.[0]?.text) {
      console.error('❌ Invalid response from Gemini for interruption check:', data);
      return false; // Safe default: assume continuation
    }
    
    const aiResponse = candidate.content.parts[0].text.trim().toUpperCase();
    const isInterruption = aiResponse === 'YES';
    
    console.log('🤖 AI Interruption Decision:', aiResponse, '→', isInterruption ? 'INTERRUPTION' : 'CONTINUATION');
    return isInterruption;
    
  } catch (error) {
    console.error('❌ Error in AI interruption check:', error);
    return false; // Safe default: assume continuation
  }
}
