const axios = require('axios');

exports.convertToPDF = async (req, res) => {
  try {
    const { url, email, passcode, searchable = true } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    console.log('Testing PDF API availability...');
    
    // First, test if the API exists at all
    try {
      const testResponse = await axios({
        method: 'HEAD',
        url: 'https://docsend2pdf.com',
        timeout: 10000
      });
      console.log('PDF API base URL exists, status:', testResponse.status);
    } catch (testError) {
      console.error('PDF API does not exist or is unreachable:', testError.message);
      
      // Return a helpful error message
      return res.status(503).json({ 
        error: 'PDF conversion service is not available. This feature is currently under development. Please use the text scraping feature instead.' 
      });
    }
    
    // Rest of the original code...
    
  } catch (error) {
    console.error('PDF conversion error:', error);
    res.status(500).json({ 
      error: 'PDF conversion service is currently unavailable. Please try text scraping instead.' 
    });
  }
};