import express from 'express';
import RestaurantSetupService from '../services/RestaurantSetupService.js';

const router = express.Router();

router.post('/restaurant-setup', async (req, res) => {
    try {
        const { message, setupStep, restaurantData } = req.body;
        
        const response = await RestaurantSetupService.processSetupMessage({
            message,
            setupStep,
            restaurantData
        });

        res.json(response);
    } catch (error) {
        console.error('Error in restaurant setup:', error);
        res.status(500).json({ 
            error: 'Failed to process setup message',
            reply: 'Sorry, I had trouble processing that. Could you please try again?'
        });
    }
});

export default router;