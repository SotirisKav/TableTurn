import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import cors from 'cors';
import { fileURLToPath } from 'url';
import RestaurantService from './services/RestaurantService.js';
import chatRouter from './routes/chat.js';
import reservationRouter from './routes/reservation.js';
import authRouter from './routes/auth.js';
import restaurantRegistrationRouter from './routes/restaurantRegistration.js';
import locationRoutes from './routes/location.js';
import multiAgentTestRouter from './routes/multiAgentTest.js';
import multiAgentWorkflowRouter from './routes/multiAgentWorkflow.js';
import dashboardRouter from './routes/dashboard.js';
import restaurantRouter from './routes/restaurants.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// CORS middleware - Allow frontend to connect
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:8080'],
  credentials: true
}));

// Middleware to parse JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve React app static files FIRST (highest priority)
app.use(express.static(path.join(__dirname, '../aichmi_frontend/dist')));

// Serve other static files from the public directory
app.use('/public', express.static(path.join(__dirname, '../public')));

// Set the view engine to EJS (for legacy routes if needed)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

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
    console.log('Fetching restaurants...');
    const restaurants = await RestaurantService.getAllRestaurants();
    console.log('Restaurants fetched:', restaurants.length);
    res.json(restaurants);
  } catch (error) {
    console.error('Error fetching restaurants:', error);
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

// Multi-Agent Test Route
app.use('/api/multiagent', multiAgentTestRouter);

// Multi-Agent Workflow Route
app.use('/api/workflow', multiAgentWorkflowRouter);

// Dashboard Route
app.use('/api/dashboard', dashboardRouter);

// Legacy EJS route (for backward compatibility)
app.get('/legacy', (req, res) => {
  res.render('index'); // Render 'views/index.ejs'
});

// Catch-all handler: send back React's index.html for all non-API routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, '../aichmi_frontend/dist/index.html'));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 AICHMI App running on http://localhost:${PORT}`);
  console.log(`🌐 API endpoints available at http://localhost:${PORT}/api`);
  console.log(`🔐 Authentication endpoints at http://localhost:${PORT}/api/auth`);
  console.log(`📱 Frontend served from the same domain - it's one unified app!`);
});