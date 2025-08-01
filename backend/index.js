import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import { fileURLToPath } from 'url';
import RestaurantService from './services/RestaurantService.js';
import basicAuth from './middleware/basicAuth.js';
import chatRouter from './routes/chat.js';
import reservationRouter from './routes/reservation.js';
import authRouter from './routes/auth.js';
import restaurantRegistrationRouter from './routes/restaurantRegistration.js';
import locationRoutes from './routes/location.js';
import multiAgentWorkflowRouter from './routes/multiAgentWorkflow.js';
import dashboardRouter from './routes/dashboard.js';
import restaurantRouter from './routes/restaurants.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Security middleware - disabled in development for debugging
if (process.env.NODE_ENV !== 'development') {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://maps.googleapis.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:", "http:"],
        connectSrc: ["'self'", "https://api.gemini.com", "https://maps.googleapis.com"]
      }
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }));
}

// Basic Auth middleware (can be toggled via environment)
app.use(basicAuth);

// CORS middleware - Allow frontend to connect
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:8080'],
  credentials: true
}));

// Middleware to parse JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve React app static files FIRST (highest priority)
// In production, the frontend build will be copied to the public directory
const frontendPath = process.env.NODE_ENV === 'production' 
  ? path.join(__dirname, 'public')
  : path.join(__dirname, '../frontend/dist');

app.use(express.static(frontendPath));

// Serve other static files from the public directory
app.use('/public', express.static(path.join(__dirname, 'public')));

// Views not needed for API-only backend serving React SPA

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV 
  });
});

app.get('/api/restaurants', async (req, res) => {
  try {
    const restaurantsData = await RestaurantService.getAllRestaurants();
    const restaurants = Array.isArray(restaurantsData) ? restaurantsData : (restaurantsData.rows || []);
    
    if (!Array.isArray(restaurants)) {
      console.error("Failed to get restaurants array from service");
      return res.json([]);
    }
    
    res.json(restaurants);
  } catch (error) {
    console.error('Error fetching restaurants:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch restaurants',
      details: error.message 
    });
  }
});

// Authenticated Restaurant Routes
app.use('/api/restaurants', restaurantRouter);

// Authentication Routes
app.use('/api/auth', authRouter);

// Chat/AI Route
app.use('/api/chat', chatRouter);

// Restaurant Registration Route (NEW SIMPLE FORM)
app.use('/api', restaurantRegistrationRouter);

// Reservation Route
app.use('/api/reservation', reservationRouter);

// Location Route
app.use('/api/location', locationRoutes);


// Multi-Agent Workflow Route
app.use('/api/workflow', multiAgentWorkflowRouter);

// Dashboard Route
app.use('/api/dashboard', dashboardRouter);

// Legacy route removed - React SPA handles all UI

// Catch-all handler: send back React's index.html for all non-API routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  const indexPath = process.env.NODE_ENV === 'production'
    ? path.join(__dirname, 'public/index.html')
    : path.join(__dirname, '../frontend/dist/index.html');
  res.sendFile(indexPath);
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 TableTurn App running on http://localhost:${PORT}`);
  console.log(`🌐 API endpoints available at http://localhost:${PORT}/api`);
  console.log(`🔐 Authentication endpoints at http://localhost:${PORT}/api/auth`);
  console.log(`📱 Frontend served from the same domain - it's one unified app!`);
});