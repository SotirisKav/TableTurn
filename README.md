```
# AICHMI - AI Reservation Bot

AI-powered restaurant reservation system for Greek restaurants with multi-agent conversation capabilities.

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL with pgvector extension
- Gemini AI API key

### PostgreSQL Setup (macOS)

1. **Install PostgreSQL**

   ```bash
   brew install postgresql@14
   ```

2. **Start PostgreSQL service**

   ```bash
   brew services start postgresql@14
   ```

3. **Install pgvector extension**
   ```bash
   brew install pgvector
   ```

### Setup

1. **Clone and install dependencies**

   ```bash
   # Frontend
   cd aichmi_frontend
   npm install

   # Backend
   cd ../aichmi_backend
   npm install
   ```

2. **Database setup**

   ```bash
   # Create database
   createdb aichmi

   # Run schema and sample data
   cd aichmi_db
   psql -U [username] -d aichmi -f aichmi_ddl.sql
   psql -U [username] -d aichmi -f sample_data.sql
   ```

3. **Environment variables**

   Create `.env` in `aichmi_backend/`:

   ```env
   # Database Configuration
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=aichmi
   DB_USER=your_username
   DB_PASSWORD=your_password
   
   # Server Configuration
   PORT=8080
   NODE_ENV=development
   
   # Gemini AI Configuration
   GEMINI_API_KEY=your_gemini_key
   
   # JWT Configuration
   JWT_SECRET=your_jwt_secret
   JWT_EXPIRE=7d
   
   # Stripe Configuration
   STRIPE_SECRET_KEY=your_stripe_secret_key
   STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
   
   # Google OAuth Configuration
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   
   # Client URL for redirects
   CLIENT_URL=http://localhost:8080
   
   # Google Maps API Key
   GOOGLE_MAPS_API_KEY=your_google_maps_api_key
   ```

### Running the Application

**Development (recommended):**

```bash
# Build frontend
cd aichmi_frontend
npm run build

# Start backend with built frontend
cd ../aichmi_backend
npm run devStart      # Serves everything from port 8080
```

**Alternative development (separate servers):**

```bash
# Terminal 1 - Backend
cd aichmi_backend
npm run devStart      # Runs on port 8080

# Terminal 2 - Frontend
cd aichmi_frontend
npm run dev           # Runs on port 3000 (requires proxy setup)
```

**Production:**

```bash
cd aichmi_backend
npm run build-and-start  # Builds frontend and serves everything from port 8080
```

## Architecture

- **Frontend**: React SPA with Vite
- **Backend**: Node.js/Express API
- **Database**: PostgreSQL with vector embeddings
- **AI**: Multi-agent system using Google Gemini
- **Deployment**: Single server on port 8080

## API Endpoints

- `GET /api/restaurants` - List all restaurants
- `POST /api/chat` - AI conversation endpoint
- `POST /api/reservation` - Create reservations
- `GET /api/dashboard/:id` - Restaurant dashboard

The AI system uses specialized agents for different conversation types (reservations, menu info, celebrations, etc.) with intelligent delegation between agents.