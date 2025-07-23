import express from 'express';
import RestaurantRegistrationService from '../services/RestaurantRegistrationService.js';

const router = express.Router();

// Register a new restaurant
router.post('/register-restaurant', async (req, res) => {
    try {
        console.log('📨 Restaurant registration request received');
        console.log('📋 Form data:', {
            restaurantName: req.body.restaurantName,
            cuisine: req.body.cuisine,
            location: req.body.location ? `${req.body.location.island}, ${req.body.location.area}` : 'No location',
            ownerEmail: req.body.ownerEmail,
            ownerName: `${req.body.ownerFirstName} ${req.body.ownerLastName}`
        });
        
        const result = await RestaurantRegistrationService.registerRestaurant(req.body);
        
        if (result.success) {
            console.log('✅ Registration successful:', result.data);
            res.status(201).json(result);
        } else {
            console.log('❌ Registration failed:', result.errors || result.message);
            res.status(400).json(result);
        }
        
    } catch (error) {
        console.error('❌ Registration route error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during registration',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Validate email availability
router.post('/check-email', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }
        
        const emailExists = await RestaurantRegistrationService.checkEmailExists(email);
        
        res.json({
            success: true,
            available: !emailExists,
            message: emailExists ? 'Email is already registered' : 'Email is available'
        });
        
    } catch (error) {
        console.error('❌ Email check error:', error);
        res.status(500).json({
            success: false,
            message: 'Error checking email availability'
        });
    }
});

// Validate location
router.post('/validate-location', async (req, res) => {
    try {
        const { location } = req.body;
        
        if (!location) {
            return res.status(400).json({
                success: false,
                message: 'Location data is required'
            });
        }
        
        const validation = await RestaurantRegistrationService.validateLocation(location);
        
        if (validation.isValid) {
            res.json({
                success: true,
                valid: true,
                location: validation.validatedLocation,
                message: 'Location is valid'
            });
        } else {
            res.status(400).json({
                success: false,
                valid: false,
                message: validation.error
            });
        }
        
    } catch (error) {
        console.error('❌ Location validation error:', error);
        res.status(500).json({
            success: false,
            message: 'Error validating location'
        });
    }
});

export default router;
