const express = require('express');
const router = express.Router();
const scraperController = require('../controllers/scraperController');

// GET /api/scraper/presentations - Get all presentations
router.get('/presentations', scraperController.getPresentations);

// GET /api/scraper/presentations/:id - Get specific presentation
router.get('/presentations/:id', scraperController.getPresentation);

// POST /api/scraper/scrape - Scrape a new presentation
router.post('/scrape', scraperController.scrapePresentation);

module.exports = router;