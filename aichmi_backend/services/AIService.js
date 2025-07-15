import fetch from 'node-fetch';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export async function askGemini(prompt, history = []) {
  const systemPrompt = `
  You are AICHMI, an expert, friendly, and helpful AI assistant for restaurant reservations.
  - Always be polite, concise, and conversational.
  - If the user asks to make a reservation, ask for all necessary details (date, time, number of people, special requests).
  - If the user asks about a restaurant, provide information such as address, menu, reviews, and special features.
  - If the user asks for something you can't do, politely explain your limitations.
  - Always confirm details before finalizing a reservation.
  - If the user provides incomplete information, ask clarifying questions.
  - Use markdown for lists, bold important details, and keep your answers easy to read.
  `;
  let conversation = history.map(msg => `${msg.sender === 'user' ? 'User' : 'AICHMI'}: ${msg.text}`).join('\n');
  const fullPrompt = `${systemPrompt}\n\n${conversation}\nUser: ${prompt}\nAICHMI:`;
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
  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't get a response from Gemini.";
}