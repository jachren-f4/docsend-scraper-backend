const express = require('express');
const router = express.Router();
const pdfController = require('../controllers/pdfController');

// POST /api/pdf/convert - Convert DocSend to PDF
router.post('/convert', pdfController.convertToPDF);

module.exports = router;