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
  You are AICHMI, a friendly and helpful AI assistant for restaurant reservations in Kos, Greece.
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
  
  return `You are an expert orchestrator for a restaurant AI. Your job is to analyze the user's message and the conversation state to choose the single best tool to call next.

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

Rule 2 (Booking Flow): Any NEW request containing a date, time, or party size must call the check_availability tool FIRST. This is non-negotiable - availability must always be checked before proceeding.

Rule 3 (Context Modification): If the conversation state shows an active 'booking' flow and the user provides a new time (e.g., 'what about at 5pm?'), you must call the check_availability tool again with the updated time, carrying over the other details from the flowState.

Rule 4 (Menu Queries): Use get_menu_items for any food, dish, menu, dietary, or price-related questions.

Rule 5 (Restaurant Info): Use get_restaurant_info for questions about hours, address, location, or general restaurant information.

Rule 6 (Fallback): Use clarify_and_respond ONLY when the user's request is ambiguous, out of scope, or you don't have enough information to call another tool.

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
  const toolContext = formatToolResultForPrompt(toolResult, toolName);
  
  return `You are a friendly and helpful AI host${restaurantName ? ` for ${restaurantName}` : ''}. The user asked: "${userMessage}"

My system ran the ${toolName} tool and found the following data:
${toolContext}

Based on these facts, formulate a natural, helpful, and conversational response. 

IMPORTANT INSTRUCTIONS:
- Be warm and conversational, like a friendly restaurant host
- Use the factual data provided - don't make up information
- Keep responses concise but helpful
- If the tool was check_availability and multiple table types were found, you MUST ask the user which they would prefer
- If the tool was create_reservation and it succeeded, congratulate them and confirm the details
- If there were errors or no results, be helpful and suggest alternatives
- Always maintain a positive, helpful tone

Respond naturally as if you're speaking directly to the customer:`;
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
        return `Found ${toolResult.items.length} menu items: ${toolResult.items.map(item => `${item.name} (€${item.price})`).slice(0, 5).join(', ')}`;
      }
      return 'No menu items found matching the request';
      
    case 'get_restaurant_info':
      return `Restaurant information: ${JSON.stringify(toolResult, null, 2)}`;
      
    case 'create_reservation':
      if (toolResult.success) {
        return `Reservation created successfully. Confirmation ID: ${toolResult.reservationDetails?.reservationId || 'N/A'}`;
      }
      return `Reservation failed: ${toolResult.error || 'Unknown error'}`;
      
    default:
      return JSON.stringify(toolResult, null, 2);
  }
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