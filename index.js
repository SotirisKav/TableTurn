const express = require('express'); // import express framework
const app = express(); //initialize express app

// Middleware to parse JSON
app.use(express.json()); 

// Example route
app.get('/', (req, res) => {
  res.send('Server is running!'); // simple response for root route
});

// Example API route
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from Node backend!' });
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});