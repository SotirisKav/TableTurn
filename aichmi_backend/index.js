const express = require('express');
const path = require('path');
const app = express();

// Middleware to parse JSON
app.use(express.json());

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../public')));

// Set the view engine to EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Example route
app.get('/', (req, res) => {
    res.render('index'); // Render 'views/index.ejs'
});

app.use(express.urlencoded({ extended: true }));

const reservationRouter = require('./routes/reservation');
app.use('/reservation', reservationRouter);

const PORT = 5500;
app.listen(PORT);