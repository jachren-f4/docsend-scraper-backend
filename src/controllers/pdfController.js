const axios = require('axios');

exports.convertToPDF = async (req, res) => {
  try {
    const { url, email, passcode, searchable = true } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    console.log('Converting DocSend to PDF:', url);
    
    // Prepare request payload
    const payload = {
      url: url,
      searchable: searchable
    };
    
    if (email) payload.email = email;
    if (passcode) payload.passcode = passcode;
    
    console.log('Sending request to PDF API with payload:', JSON.stringify(payload, null, 2));
    
    // Test if the API endpoint exists first
    try {
      console.log('Testing PDF API endpoint...');
      const testResponse = await axios({
        method: 'GET',
        url: 'https://docsend2pdf.com',
        timeout: 10000
      });
      console.log('PDF API base URL is reachable');
    } catch (testError) {
      console.error('PDF API base URL test failed:', testError.message);
      return res.status(503).json({ 
        error: 'PDF conversion service is currently unavailable. Please try again later.' 
      });
    }
    
    // Call the DocSend2PDF API
    const response = await axios({
      method: 'POST',
      url: 'https://docsend2pdf.com/api/convert',
      headers: {
        'Content-Type': 'application/json'
      },
      data: payload,
      responseType: 'arraybuffer',
      timeout: 120000, // Increase timeout to 2 minutes
      maxRedirects: 5
    });
    
    console.log('PDF API responded with status:', response.status);
    console.log('Response headers:', response.headers);
    
    // Extract filename from response headers or generate one
    const contentDisposition = response.headers['content-disposition'];
    let filename = 'document.pdf';
    
    if (contentDisposition) {
      const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (match && match[1]) {
        filename = match[1].replace(/['"]/g, '');
      }
    }
    
    // Set response headers to serve the PDF
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': response.data.length
    });
    
    // Send the PDF data
    res.send(response.data);
    
    console.log('PDF conversion completed successfully, file size:', response.data.length);
    
  } catch (error) {
    console.error('PDF conversion error:', error.message);
    console.error('Error details:', {
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      headers: error.response?.headers
    });
    
    if (error.response) {
      // API returned an error
      if (error.response.status === 429) {
        const retryAfter = error.response.headers['retry-after'];
        return res.status(429).json({ 
          error: `Rate limit exceeded. Please wait ${retryAfter || '60'} seconds and try again.` 
        });
      }
      
      if (error.response.status === 404) {
        return res.status(404).json({ 
          error: 'PDF conversion service not found. The service may be temporarily unavailable.' 
        });
      }
      
      try {
        const errorData = JSON.parse(error.response.data.toString());
        return res.status(error.response.status).json({ 
          error: errorData.error || 'PDF conversion failed' 
        });
      } catch (parseError) {
        return res.status(error.response.status).json({ 
          error: `PDF conversion failed (Status: ${error.response.status})` 
        });
      }
    }
    
    if (error.code === 'ECONNABORTED') {
      return res.status(408).json({ 
        error: 'PDF conversion timed out. The document may be too large or the service is busy. Please try again in a few minutes.' 
      });
    }
    
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return res.status(503).json({ 
        error: 'PDF conversion service is currently unavailable. Please try again later.' 
      });
    }
    
    res.status(500).json({ 
      error: 'PDF conversion failed. Please check your URL and try again.' 
    });
  }
};