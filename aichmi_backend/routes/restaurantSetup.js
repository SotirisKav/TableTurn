import express from 'express';
import RestaurantSetupService from '../services/RestaurantSetupService.js';

const router = express.Router();

router.post('/restaurant-setup', async (req, res) => {
    try {
        const { message, history, collectedData } = req.body;
        
        console.log('📨 Setup request received:', { 
            message, 
            historyLength: history?.length || 0,
            historyPreview: history?.slice(-2), // Show last 2 messages
            collectedDataKeys: Object.keys(collectedData || {}),
            collectedData: collectedData || {}
        });
        
        const response = await RestaurantSetupService.processSetupMessage({
            message,
            history: history || [],
            collectedData: collectedData || {}
        });

        console.log('📤 Setup response sent:', {
            type: response.type,
            replyLength: response.reply?.length,
            setupComplete: response.setupComplete,
            collectedDataKeys: Object.keys(response.collectedData || {})
        });
        
        res.json(response);
        
    } catch (error) {
        console.error('❌ Error in restaurant setup:', error);
        res.status(500).json({ 
            type: 'message',
            reply: 'Sorry, I had trouble processing that. Could you please try again?',
            setupComplete: false,
            collectedData: req.body.collectedData || {}
        });
    }
});

export default router;