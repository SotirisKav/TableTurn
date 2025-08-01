# 🚀 TableTurn Backend - AI Restaurant Assistant

Complete backend system with RAG (Retrieval-Augmented Generation) capabilities for intelligent restaurant assistance.

## 🎯 Quick Start

### 1. Prerequisites
```bash
# Install pgvector for PostgreSQL
brew install pgvector

# Ensure PostgreSQL is running
brew services start postgresql
```

### 2. Setup Environment
```bash
# Install dependencies
npm install

# Configure environment variables in .env
GEMINI_API_KEY=your_api_key_here
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tableturn
DB_USER=your_username
DB_PASSWORD=your_password
```

### 3. Complete Setup (One Command)
```bash
# This will:
# - Create database schema
# - Populate with sample data  
# - Generate embeddings for RAG
# - Test the system
node setup-simple.js
```

### 4. Start Server
```bash
npm run devStart
```

## 🏗️ What's Included

- **✅ Database Schema**: Complete PostgreSQL setup with pgvector
- **✅ Sample Data**: 4 restaurants with menus, tables, reservations
- **✅ RAG System**: Semantic search with Google Gemini embeddings
- **✅ Multi-Agent System**: Specialized AI agents for different tasks
- **✅ REST API**: Full backend API for frontend integration

## 🤖 AI Agents

- **MenuPricingAgent**: Menu information and pricing
- **ReservationAgent**: Table bookings and availability
- **RestaurantInfoAgent**: Restaurant details and hours
- **CelebrationAgent**: Special occasions and events
- **LocationTransferAgent**: Transportation and transfers
- **SupportContactAgent**: Customer support

## 🔍 RAG System Features

### Hybrid Search
```javascript
// Search menu items with filters
const results = await RAGService.hybridSearch(
    "healthy vegan options",
    'menu_item',
    { restaurant_id: 1, is_vegan: true, available: true },
    5
);
```

### Update Embeddings
```javascript
// When data changes, update embeddings
await RAGService.generateAndStoreEmbedding('menu_item', itemId, itemData);
```

## 📡 API Endpoints

### Chat Endpoint
```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What vegan dishes do you have?",
    "restaurantId": 1,
    "restaurantName": "Lofaki Restaurant"
  }'
```

## 🗂️ Project Structure

```
tableturn_backend/
├── setup-complete.js      # Complete setup script
├── config/
│   └── database.js        # Database configuration
├── services/
│   ├── RAGService.js      # RAG system
│   ├── EmbeddingService.js # AI embeddings
│   └── agents/            # AI agent system
├── routes/
│   └── chat.js           # Main chat API
└── README.md             # This file
```

## 🔧 Troubleshooting

### pgvector not found
```bash
brew install pgvector
psql -d tableturn -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### Database connection issues
1. Check PostgreSQL is running
2. Verify credentials in `.env`
3. Test connection: `psql -h localhost -U user -d tableturn`

### API key issues
1. Get key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Add to `.env` as `GEMINI_API_KEY=your_key`

## 🎉 Ready to Go!

After running `node setup-complete.js` successfully, your system will have:

- 🏪 4 sample restaurants with full data
- 🍽️ Menu items with dietary information
- 🪑 Table types and pricing
- 🤖 AI agents ready to respond
- 🧠 RAG system for intelligent search
- 📊 Complete reservation system

Start building your restaurant AI assistant!