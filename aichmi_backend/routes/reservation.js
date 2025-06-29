const express = require('express');
const router = express.Router();

router.get("/", (req,res) => {
    res.render('reservation');
})

router.get('/complete', (req, res) => {
    res.render('reservation_complete');
});

router.post('/', (req, res) => {
    const { name, email, date, time, guests, celebration } = req.body;
    res.render('reservation_complete', { name, email, date, time, guests, celebration });
});

module.exports = router;