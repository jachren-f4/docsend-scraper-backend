require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Import routes
const scraperRoutes = require('./src/routes/scraper');
const pdfRoutes = require('./src/routes/pdf');

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'DocSend Scraper API is running!' });
});

// API routes
app.use('/api/scraper', scraperRoutes);
app.use('/api/pdf', pdfRoutes);

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/docsend-scraper')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});