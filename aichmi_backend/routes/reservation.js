import express from 'express';
import RestaurantService from '../services/RestaurantService.js';

const router = express.Router();

router.post('/', async (req, res) => {
    console.log('Received reservation POST:', req.body);
    console.log('Request headers:', req.headers);
    console.log('Request URL:', req.url);
    try {
        // Destructure all required fields from the request body
        const {
            venueId,
            reservationName,
            reservationEmail,
            reservationPhone,
            date,
            time,
            guests,
            tableType,
            celebrationType,
            cake,
            cakePrice,
            flowers,
            flowersPrice,
            hotelName,
            hotelId,
            specialRequests
        } = req.body;

        // Check if this is an incomplete/empty submission (likely from frontend error)
        const hasAnyData = reservationName || reservationEmail || reservationPhone || date || guests || tableType;
        if (!hasAnyData && venueId) {
            console.log('⚠️ Detected incomplete reservation submission - likely frontend issue');
            return res.status(400).json({ 
                error: 'Incomplete reservation data received',
                details: 'This appears to be an incomplete submission. Please use the chat interface to make a reservation.',
                code: 'INCOMPLETE_SUBMISSION'
            });
        }

        // Validate required fields
        if (!venueId) {
            return res.status(400).json({ error: 'venueId is required' });
        }
        if (!reservationName) {
            return res.status(400).json({ error: 'reservationName is required' });
        }
        if (!reservationEmail) {
            return res.status(400).json({ error: 'reservationEmail is required' });
        }
        if (!date) {
            return res.status(400).json({ error: 'date is required' });
        }
        if (!guests || guests <= 0) {
            return res.status(400).json({ error: 'guests must be a positive number' });
        }
        if (!tableType) {
            return res.status(400).json({ error: 'tableType is required' });
        }

        // Save reservation to the database (with table availability check)
        const reservation = await RestaurantService.createReservation({
            venueId,
            reservationName,
            reservationEmail,
            reservationPhone,
            date,
            time,
            guests,
            tableType,
            celebrationType,
            cake,
            cakePrice,
            flowers,
            flowersPrice,
            hotelName,
            hotelId,
            specialRequests
        });

        res.status(201).json(reservation);
    } catch (error) {
        // If the error is about table availability, send a 409 Conflict
        if (error.message && error.message.includes('No tables of this type available')) {
            return res.status(409).json({ error: error.message });
        }
        if (error.message && error.message.includes('No tables of type "undefined"')) {
            return res.status(400).json({ error: 'tableType is required and cannot be undefined' });
        }
        console.error('Error creating reservation:', error);
        res.status(500).json({ error: 'Failed to create reservation' });
    }
});

export default router;