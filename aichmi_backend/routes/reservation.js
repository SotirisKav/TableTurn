const express = require('express');
const router = express.Router();

router.post('/', async (req, res) => {
    try {
        const { restaurantId, customerName, date, time, people, specialRequests } = req.body;
        // Save reservation to the database
        const reservation = await ReservationService.createReservation({
            restaurantId,
            customerName,
            date,
            time,
            people,
            specialRequests
        });
        res.status(201).json(reservation);
    } catch (error) {
        console.error('Error creating reservation:', error);
        res.status(500).json({ error: 'Failed to create reservation' });
    }
});

module.exports = router;

function parseReservationDetails(text) {
  const details = {};
  const lines = text.split('\n');
  lines.forEach(line => {
    if (line.startsWith('RestaurantId:')) details.restaurantId = Number(line.split(':')[1].trim());
    if (line.startsWith('CustomerName:')) details.customerName = line.split(':')[1].trim();
    if (line.startsWith('Date:')) details.date = line.split(':')[1].trim();
    if (line.startsWith('Time:')) details.time = line.split(':')[1].trim();
    if (line.startsWith('People:')) details.people = Number(line.split(':')[1].trim());
    if (line.startsWith('SpecialRequests:')) details.specialRequests = line.split(':')[1].trim();
  });
  return details;
}