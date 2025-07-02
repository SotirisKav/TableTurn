const express = require('express');
const path = require('path');
require('dotenv').config();
const RestaurantService = require('./services/RestaurantService');
const app = express();
const chatRouter = require('./routes/chat');

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
// API endpoint to get all restaurants
app.get('/api/restaurants', async (req, res) => {
    try {
        const restaurants = await RestaurantService.getAllRestaurants();
        res.json(restaurants);
    } catch (error) {
        console.error('Error fetching restaurants:', error);
        res.status(500).json({ error: 'Failed to fetch restaurants' });
    }
});

// API endpoint to get a specific restaurant
app.get('/api/restaurants/:id', async (req, res) => {
    try {
        const restaurant = await RestaurantService.getRestaurantById(req.params.id);
        if (restaurant) {
            res.json(restaurant);
        } else {
            res.status(404).json({ error: 'Restaurant not found' });
        }
    } catch (error) {
        console.error('Error fetching restaurant:', error);
        res.status(500).json({ error: 'Failed to fetch restaurant' });
    }
});

// API Routes
// API endpoint to get all restaurants
app.get('/api/restaurants', async (req, res) => {
    try {
        const restaurants = await RestaurantService.getAllRestaurants();
        res.json(restaurants);
    } catch (error) {
        console.error('Error fetching restaurants:', error);
        res.status(500).json({ error: 'Failed to fetch restaurants' });
    }
});

// API endpoint to get a specific restaurant
app.get('/api/restaurants/:id', async (req, res) => {
    try {
        const restaurant = await RestaurantService.getRestaurantById(req.params.id);
        if (restaurant) {
            res.json(restaurant);
        } else {
            res.status(404).json({ error: 'Restaurant not found' });
        }
    } catch (error) {
        console.error('Error fetching restaurant:', error);
        res.status(500).json({ error: 'Failed to fetch restaurant' });
    }
});

// Legacy EJS route (for backward compatibility)
app.get('/legacy', (req, res) => {
    res.render('index'); // Render 'views/index.ejs'
});

// Reservation routes (temporarily commented out)
// const reservationRouter = require('./routes/reservation');
// app.use('/api/reservation', reservationRouter);

// Catch-all handler: send back React's index.html for all non-API routes
app.get('*', (req, res) => {
    // If it's an API route that doesn't exist, return 404
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    
    // For all other routes, serve the React app
    res.sendFile(path.join(__dirname, '../aichmi_frontend/dist/index.html'));
});

app.use('/api/chat', chatRouter);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`🚀 AICHMI App running on http://localhost:${PORT}`);
    console.log(`🌐 API endpoints available at http://localhost:${PORT}/api`);
    console.log(`📱 Frontend served from the same domain - it's one unified app!`);
});