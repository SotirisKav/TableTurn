import express from 'express';
import LocationValidationService from '../services/LocationValidationService.js';
import IslandDetectionService from '../services/IslandDetectionService.js';

const router = express.Router();

// Test endpoint to check if API key is loaded
router.get('/test-config', (req, res) => {
    res.json({
        hasApiKey: !!process.env.GOOGLE_MAPS_API_KEY,
        apiKeyLength: process.env.GOOGLE_MAPS_API_KEY ? process.env.GOOGLE_MAPS_API_KEY.length : 0,
        nodeEnv: process.env.NODE_ENV
    });
});

// Validate location by coordinates
router.post('/validate-coordinates', async (req, res) => {
    try {
        const { lat, lng, placeId } = req.body;

        if (!lat || !lng) {
            return res.status(400).json({
                success: false,
                error: 'Latitude and longitude are required'
            });
        }

        const validation = await LocationValidationService.validateAndExtractLocation(lat, lng, placeId);

        res.json({
            success: validation.isValid,
            data: validation.isValid ? {
                island: validation.island,
                area: validation.area,
                address: validation.address,
                formattedAddress: validation.formattedAddress,
                placeId: validation.placeId
            } : null,
            error: validation.error || null,
            suggestions: validation.suggestions || null
        });

    } catch (error) {
        console.error('Location validation error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Validate place ID
router.post('/validate-place', async (req, res) => {
    try {
        const { placeId } = req.body;

        if (!placeId) {
            return res.status(400).json({
                success: false,
                error: 'Place ID is required'
            });
        }

        const validation = await LocationValidationService.validatePlaceId(placeId);

        res.json({
            success: validation.isValid,
            data: validation.isValid ? {
                island: validation.island,
                area: validation.area,
                address: validation.address,
                formattedAddress: validation.formattedAddress,
                placeId: validation.placeId
            } : null,
            error: validation.error || null
        });

    } catch (error) {
        console.error('Place validation error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get supported Greek islands
router.get('/supported-islands', (req, res) => {
    try {
        const islands = Object.keys(IslandDetectionService.greekIslands).map(islandName => ({
            name: islandName,
            keywords: IslandDetectionService.greekIslands[islandName].keywords,
            bounds: IslandDetectionService.greekIslands[islandName].bounds
        }));

        res.json({
            success: true,
            data: {
                islands,
                total: islands.length
            }
        });

    } catch (error) {
        console.error('Error getting islands:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

export default router;