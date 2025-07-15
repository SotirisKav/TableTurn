import fetch from 'node-fetch';
import RestaurantService from './RestaurantService.js';
import pool from '../config/database.js'; 

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
    // Only try to infer restaurantId if it is not provided
    if (!restaurantId) {
      const allRestaurants = await RestaurantService.getAllRestaurants();
      const found = allRestaurants.find(r =>
        keywords.includes(r.name.toLowerCase())
      );
      if (found) {
        restaurantId = found.venue_id || found.id; // use your actual id field
        relevantData.restaurants.push(found);

        // Fetch owner for this restaurant
        const ownerQuery = `
          SELECT o.*, v.name as restaurant_name FROM owner o
          JOIN venue v ON o.venue_id = v.venue_id
          WHERE v.venue_id = $1
        `;
        const ownerResult = await pool.query(ownerQuery, [restaurantId]);
        relevantData.owners = ownerResult.rows;
      }
    }
    // --- RESTAURANT DATA ---
    if (restaurantId) {
      // Fetch specific restaurant
      const restaurant = await RestaurantService.getRestaurantById(restaurantId);
      // Only push if not already present, and always ensure it's the first in the array
      if (restaurant) {
        relevantData.restaurants = [restaurant];
      }
      // Fetch owner for this restaurant
      const ownerQuery = `
        SELECT o.*, v.name as restaurant_name FROM owner o
        JOIN venue v ON o.venue_id = v.venue_id
        WHERE v.venue_id = $1
      `;
      const ownerResult = await pool.query(ownerQuery, [restaurantId]);
      relevantData.owners = ownerResult.rows;

      // Fetch menu items for this restaurant if user asks about menu
      if (
        (keywords.includes('menu') || keywords.includes('dish') || keywords.includes('food'))
      ) {
        relevantData.menuItems = await RestaurantService.getMenuItemsByVenueId(restaurantId);
      }
    } else if (
      keywords.includes('restaurant') ||
      keywords.includes('menu') ||
      keywords.includes('location') ||
      keywords.includes('address')
    ) {
      // Fetch all restaurants
      relevantData.restaurants = await RestaurantService.getAllRestaurants();

      // Fetch all owners for restaurants
      const ownerQuery = `
        SELECT o.*, v.name as restaurant_name FROM owner o
        JOIN venue v ON o.venue_id = v.venue_id
        WHERE v.type = 'restaurant'
      `;
      const ownerResult = await pool.query(ownerQuery);
      relevantData.owners = ownerResult.rows;
    }

    // --- OWNER DATA (if user asks about owner/contact/phone/email, but no restaurantId) ---
    if (
      !restaurantId &&
      (keywords.includes('owner') ||
        keywords.includes('contact') ||
        keywords.includes('phone') ||
        keywords.includes('email'))
    ) {
      // Fetch all owners for restaurants
      const ownerQuery = `
        SELECT o.*, v.name as restaurant_name FROM owner o
        JOIN venue v ON o.venue_id = v.venue_id
        WHERE v.type = 'restaurant'
      `;
      const ownerResult = await pool.query(ownerQuery);
      relevantData.owners = ownerResult.rows;
    }

    // --- TABLES ---
    if (
      keywords.includes('price') ||
      keywords.includes('cost') ||
      keywords.includes('table') ||
      keywords.includes('fee')
    ) {
      const tableQuery = `SELECT * FROM tables`;
      const tableResult = await pool.query(tableQuery);
      relevantData.generalInfo.tables = tableResult.rows;
    }

    // --- TRANSFERS ---
    if (
      keywords.includes('transfer') ||
      keywords.includes('transport') ||
      keywords.includes('airport') ||
      keywords.includes('pickup')
    ) {
      const transferQuery = `SELECT * FROM transfer_areas`;
      const transferResult = await pool.query(transferQuery);
      relevantData.generalInfo.transfers = transferResult.rows;
    }

    // --- AVAILABILITY/BOOKING DATES ---
    if (
      keywords.includes('available') ||
      keywords.includes('book') ||
      keywords.includes('reserve') ||
      keywords.includes('date')
    ) {
      const bookedDatesQuery = `SELECT * FROM fully_booked_dates WHERE venue_id = $1 OR venue_id IS NULL`;
      const bookedResult = restaurantId
        ? await pool.query(bookedDatesQuery, [restaurantId])
        : await pool.query(`SELECT * FROM fully_booked_dates`);
      relevantData.generalInfo.bookedDates = bookedResult.rows;
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
      contextInfo += `- **${owner.restaurant_name}**: Owner is ${owner.name}\n`;
      contextInfo += `  - Email: ${owner.email}\n`;
      contextInfo += `  - Phone: ${owner.phone}\n\n`;
    });
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
  You are AICHMI, an expert, friendly, and helpful AI assistant for restaurant reservations in Kos, Greece.
  `;

  if (restaurantName) {
    systemPrompt += `
    You are currently serving as the assistant for **${restaurantName}**.
    If the user wants to make a reservation, it is always for **${restaurantName}**.
    Never ask the user which restaurant they want; you already know it.
    Answer as if you are an expert employee of this restaurant.
    `;
  }

  systemPrompt += `
  **IMPORTANT INSTRUCTIONS:**
  - Use the provided relevant information to answer questions accurately
  - Always be polite, concise, and conversational
  - If the user asks to make a reservation, ask for all necessary details (date, time, number of people, special requests)
  - If the user asks about a restaurant, provide information using the data provided below
  - If the user asks for something you can't do, politely explain your limitations
  - Always confirm details before finalizing a reservation
  - If the user provides incomplete information, ask clarifying questions
  - Use markdown for lists, bold important details, and keep your answers easy to read
  - When mentioning prices, always include the € symbol
  - For dates, use a clear format (e.g., "July 15, 2025")
  - When you have collected all the reservation details (restaurant, date, time, number of people, and customer name), reply with:
    Reservation has been confirmed! Here are the reservation details:
    RestaurantId: {restaurantId}
    CustomerName: {customerName}
    Date: {date}
    Time: {time}
    People: {people}
    SpecialRequests: {specialRequests}
    For further confirmation, please check your email!
  
  **CONTEXT FOR THIS CONVERSATION:**
  ${formatDataForPrompt(relevantData)}
  `;

  let conversation = history.map(msg => `${msg.sender === 'user' ? 'User' : 'AICHMI'}: ${msg.text}`).join('\n');
  const fullPrompt = `${systemPrompt}\n\n${conversation}\nUser: ${prompt}\nAICHMI:`;

  try {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }]
        })
      }
    );
    console.log("Prompt sent to Gemini:", fullPrompt);
    const data = await response.json();
    console.log("Gemini API response:", data);
    console.log("Gemini candidate content:", JSON.stringify(data.candidates[0].content, null, 2));
    // Robustly extract the reply text
    const candidate = data?.candidates?.[0];
    if (!candidate) return "Sorry, I couldn't get a response from Gemini.";

    const content = candidate.content;
    if (!content) return "Sorry, I couldn't get a response from Gemini.";

    // Try both possible structures:
    if (Array.isArray(content.parts) && content.parts[0]?.text) {
      return content.parts[0].text;
    }
    if (typeof content.text === "string") {
      return content.text;
    }
    return "Sorry, I couldn't get a response from Gemini.";
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    return "Sorry, I'm having trouble connecting to the AI service right now. Please try again later.";
  }
}