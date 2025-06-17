const DocSendScraper = require('../services/docSendScraper');
const Presentation = require('../models/Presentation');

const scraper = new DocSendScraper();

exports.scrapePresentation = async (req, res) => {
  try {
    const { url, password } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    console.log('Starting scrape for URL:', url);
    
    // Create presentation record
    const presentation = new Presentation({ 
      url, 
      status: 'processing' 
    });
    await presentation.save();
    
    try {
      // Start scraping
      const data = await scraper.scrapePresentation(url, password);
      
      // Update presentation with scraped data
      presentation.title = data.title;
      presentation.slideCount = data.slideCount;
      presentation.slides = data.slides;
      presentation.status = 'completed';
      presentation.extractedAt = new Date();
      
      await presentation.save();
      
      console.log('Scraping completed successfully');
      res.json(presentation);
    } catch (scrapingError) {
      // Update status to failed
      presentation.status = 'failed';
      await presentation.save();
      
      console.error('Scraping failed:', scrapingError);
      res.status(500).json({ error: scrapingError.message });
    }
  } catch (error) {
    console.error('Controller error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getPresentations = async (req, res) => {
  try {
    const presentations = await Presentation.find().sort({ createdAt: -1 });
    res.json(presentations);
  } catch (error) {
    console.error('Error fetching presentations:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getPresentation = async (req, res) => {
  try {
    const presentation = await Presentation.findById(req.params.id);
    if (!presentation) {
      return res.status(404).json({ error: 'Presentation not found' });
    }
    res.json(presentation);
  } catch (error) {
    console.error('Error fetching presentation:', error);
    res.status(500).json({ error: error.message });
  }
};