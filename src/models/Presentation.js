const mongoose = require('mongoose');

const presentationSchema = new mongoose.Schema({
  url: { type: String, required: true },
  title: String,
  slideCount: Number,
  slides: [{
    slideNumber: Number,
    text: String,
    images: [String]
  }],
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  extractedAt: Date,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Presentation', presentationSchema);