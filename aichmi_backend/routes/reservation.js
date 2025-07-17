import express from 'express';
import RestaurantService from '../services/RestaurantService.js';

const router = express.Router();

router.post('/', async (req, res) => {
    console.log('Received reservation POST:', req.body);
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
        console.error('Error creating reservation:', error);
        res.status(500).json({ error: 'Failed to create reservation' });
    }
});

export default router;