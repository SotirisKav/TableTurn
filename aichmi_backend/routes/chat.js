import express from 'express';
import { askGemini } from '../services/AIService.js';
import RestaurantService from '../services/RestaurantService.js';
import OwnerService from '../services/OwnerService.js';

const router = express.Router();

router.post('/', async (req, res) => {
  const { message, restaurantName, history } = req.body;
  let dbInfo = '';
  let ownerInfo = '';

  // 1. Fetch the restaurant by name
  const restaurant = await RestaurantService.getRestaurantByName(restaurantName);

  // 2. If the user asks about the owner, fetch only the owner for this restaurant
  if (/owner/i.test(message) && restaurant) {
    const owner = await OwnerService.getOwnerByVenueId(restaurant.venue_id);
    if (owner) {
      ownerInfo = `The owner of ${restaurant.name} is ${owner.name}. Contact: ${owner.email}, ${owner.phone}.`;
    } else {
      ownerInfo = `Sorry, I couldn't find the owner information for ${restaurant.name}.`;
    }
  }

  // 3. Build the prompt for Gemini
  const systemPrompt = `
You are AICHMI, an expert, friendly, and helpful AI assistant for restaurant reservations.
Use the following data to answer the user's question.
${ownerInfo}
  `;
  const fullPrompt = `${systemPrompt}\nUser: ${message}\nAICHMI:`;

  try {
    const aiText = await askGemini(fullPrompt, history);
    res.json({ text: aiText });
  } catch (err) {
    console.error('Gemini or DB error:', err);
    res.status(500).json({ text: "Sorry, there was an error contacting the AI." });
  }
});

export default router;