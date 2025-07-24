import fetch from 'node-fetch';
import RestaurantService from './RestaurantService.js';
import db from '../config/database.js'; 

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// RAG function to fetch relevant data based on user query
async function fetchRelevantData(prompt, restaurantId = null) {
  const relevantData = {
    restaurants: [],
    owners: [],
    reservations: [],
    generalInfo: {}
  };

  try {
    const keywords = prompt.toLowerCase();
    
    if (!restaurantId) {
      const allRestaurants = await RestaurantService.getAllRestaurants();
      const found = allRestaurants.find(r =>
        keywords.includes(r.name.toLowerCase())
      );
      if (found) {
        restaurantId = found.venue_id || found.id;
        relevantData.restaurants.push(found);

        const ownerQuery = `
          SELECT o.*, v.name as restaurant_name FROM owners o
          JOIN venue v ON o.venue_id = v.venue_id
          WHERE v.venue_id = $1
        `;
        const ownerResult = await db.query(ownerQuery, [restaurantId]);
        relevantData.owners = ownerResult; 
      }
    }

    if (restaurantId) {
      const restaurant = await RestaurantService.getRestaurantById(restaurantId);
      if (restaurant) {
        relevantData.restaurants = [restaurant];
      }

      const ownerQuery = `
        SELECT o.*, v.name as restaurant_name FROM owners o
        JOIN venue v ON o.venue_id = v.venue_id
        WHERE v.venue_id = $1
      `;
      const ownerResult = await db.query(ownerQuery, [restaurantId]);
      relevantData.owners = ownerResult; 

      // Fetch menu items if user asks about menu
      if (keywords.includes('menu') || keywords.includes('dish') || keywords.includes('food')) {
        relevantData.menuItems = await RestaurantService.getMenuItemsByVenueId(restaurantId);
      }

      const tableTypesRes = await db.query(
        'SELECT table_type FROM table_type_counts WHERE restaurant_id = $1 AND total_tables > 0',
        [restaurantId]
      );
      relevantData.availableTableTypes = tableTypesRes.map(row => row.table_type); 
    } else if (
      keywords.includes('price') ||
      keywords.includes('cost') ||
      keywords.includes('table') ||
      keywords.includes('fee')
    ) {
      // If we have a restaurant ID, only fetch tables for that restaurant
      const tableQuery = restaurantId 
        ? `SELECT * FROM tables WHERE restaurant_id = $1 ORDER BY table_price ASC`
        : `SELECT * FROM tables ORDER BY table_price ASC`;
      const tableResult = restaurantId 
        ? await db.query(tableQuery, [restaurantId])
        : await db.query(tableQuery);
      console.log('🔍 TABLE DATA FETCHED:', tableResult);
      relevantData.generalInfo.tables = tableResult; 
    }

    // Add debugging for owner data too:
    const ownerQuery = `
      SELECT o.*, v.name as restaurant_name FROM owners o
      JOIN venue v ON o.venue_id = v.venue_id
      WHERE v.venue_id = $1
    `;
    const ownerResult = await db.query(ownerQuery, [restaurantId]);
    console.log('🔍 OWNER DATA FETCHED:', ownerResult); // Add this debug line
    relevantData.owners = ownerResult; 

    // Add owner-related keywords check AND always fetch for restaurant questions
    if (
      keywords.includes('owner') ||
      keywords.includes('contact') ||
      keywords.includes('phone') ||
      keywords.includes('email') ||
      keywords.includes('who') ||
      keywords.includes('manager') ||
      restaurantId // Always fetch owner data when we have a restaurant ID
    ) {
      const ownerQuery = `
        SELECT o.*, v.name as restaurant_name FROM owners o
        JOIN venue v ON o.venue_id = v.venue_id
        WHERE ${restaurantId ? 'v.venue_id = $1' : 'v.type = \'restaurant\''}
      `;
      const ownerResult = restaurantId 
        ? await db.query(ownerQuery, [restaurantId])
        : await db.query(ownerQuery);
      console.log('🔍 OWNER DATA FETCHED:', ownerResult); // Debug line
      relevantData.owners = ownerResult; 
    }

    if (
      keywords.includes('price') ||
      keywords.includes('cost') ||
      keywords.includes('table') ||
      keywords.includes('fee')
    ) {
      const tableQuery = restaurantId 
        ? `SELECT * FROM tables WHERE restaurant_id = $1 ORDER BY table_price ASC`
        : `SELECT * FROM tables ORDER BY table_price ASC`;
      const tableResult = restaurantId 
        ? await db.query(tableQuery, [restaurantId])
        : await db.query(tableQuery);
      relevantData.generalInfo.tables = tableResult; 
    }

    if (
      keywords.includes('transfer') ||
      keywords.includes('transport') ||
      keywords.includes('airport') ||
      keywords.includes('pickup')
    ) {
      const transferQuery = `SELECT * FROM transfer_areas`;
      const transferResult = await db.query(transferQuery);
      relevantData.generalInfo.transfers = transferResult;
    }

    if (
      keywords.includes('available') ||
      keywords.includes('book') ||
      keywords.includes('reserve') ||
      keywords.includes('date')
    ) {
      const bookedDatesQuery = `SELECT * FROM fully_booked_dates WHERE venue_id = $1 OR venue_id IS NULL`;
      const bookedResult = restaurantId
        ? await db.query(bookedDatesQuery, [restaurantId])
        : await db.query(`SELECT * FROM fully_booked_dates`);
      relevantData.generalInfo.bookedDates = bookedResult; 
    }
  } catch (error) {
    console.error('Error fetching relevant data:', error);
  }

  return relevantData;
}

// Function to format retrieved data for the AI prompt
function formatDataForPrompt(data) {
  let contextInfo = "\n\n--- RELEVANT INFORMATION ---\n";

  // Format restaurant information
  if (data.restaurants.length > 0) {
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
  if (data.owners.length > 0) {
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
  if (data.generalInfo.tables && data.generalInfo.tables.length > 0) {
    contextInfo += "\n**TABLE TYPES & PRICING:**\n";
    data.generalInfo.tables.forEach(table => {
      contextInfo += `- **${table.table_type}**: €${table.table_price}\n`;
    });
    contextInfo += "\n";
  }

  // Format transfer information
  if (data.generalInfo.transfers && data.generalInfo.transfers.length > 0) {
    contextInfo += "\n**TRANSFER SERVICES:**\n";
    data.generalInfo.transfers.forEach(transfer => {
      contextInfo += `- **${transfer.name}**: €${transfer.price_4_or_less} (1-4 people), €${transfer.price_5_to_8} (5-8 people)\n`;
    });
    contextInfo += "\n";
  }

  // Format booked dates
  if (data.generalInfo.bookedDates && data.generalInfo.bookedDates.length > 0) {
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
  const relevantData = await fetchRelevantData(prompt, restaurantId);
  let restaurantName = null;

  if (relevantData.restaurants && relevantData.restaurants.length > 0) {
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