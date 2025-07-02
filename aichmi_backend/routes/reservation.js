const express = require('express');
const router = express.Router();

router.post('/', async (req, res) => {
    try {
        const { restaurantId, customerName, date, time } = req.body;
        // Save reservation to the database
        const reservation = await ReservationService.createReservation({
            restaurantId,
            customerName,
            date,
            time,
        });
        res.status(201).json(reservation);
    } catch (error) {
        console.error('Error creating reservation:', error);
        res.status(500).json({ error: 'Failed to create reservation' });
    }
});

module.exports = router;