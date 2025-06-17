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
    
    // Call the DocSend2PDF API
    const response = await axios({
      method: 'POST',
      url: 'https://docsend2pdf.com/api/convert',
      headers: {
        'Content-Type': 'application/json'
      },
      data: payload,
      responseType: 'arraybuffer', // Important for binary PDF data
      timeout: 60000 // 60 second timeout
    });
    
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
    
    console.log('PDF conversion completed successfully');
    
  } catch (error) {
    console.error('PDF conversion error:', error);
    
    if (error.response) {
      // API returned an error
      if (error.response.status === 429) {
        const retryAfter = error.response.headers['retry-after'];
        return res.status(429).json({ 
          error: `Rate limit exceeded. Retry after ${retryAfter} seconds.` 
        });
      }
      
      try {
        const errorData = JSON.parse(error.response.data.toString());
        return res.status(error.response.status).json({ 
          error: errorData.error || 'PDF conversion failed' 
        });
      } catch (parseError) {
        return res.status(error.response.status).json({ 
          error: 'PDF conversion failed' 
        });
      }
    }
    
    res.status(500).json({ 
      error: error.code === 'ECONNABORTED' ? 
        'PDF conversion timed out. Please try again.' : 
        'PDF conversion failed. Please try again.' 
    });
  }
};