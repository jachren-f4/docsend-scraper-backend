const axios = require('axios');

exports.convertToPDF = async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    // Check if Browserless token is configured
    const browserlessToken = process.env.BROWSERLESS_TOKEN;
    if (!browserlessToken) {
      return res.status(503).json({ 
        error: 'PDF conversion service is not configured. Please contact support.' 
      });
    }
    
    console.log('Starting PDF conversion automation for:', url);
    
    // Script to automate the docsend2pdf form
    const automationScript = `
      const puppeteer = require('puppeteer');
      
      module.exports = async ({ page, context }) => {
        try {
          console.log('Navigating to docsend2pdf.com...');
          await page.goto('https://docsend2pdf.com/', { 
            waitUntil: 'networkidle2',
            timeout: 30000 
          });
          
          console.log('Looking for URL input field...');
          await page.waitForSelector('input[type="text"], input[type="url"]', { timeout: 10000 });
          
          console.log('Filling in DocSend URL...');
          await page.type('input[type="text"], input[type="url"]', '${url}');
          
          console.log('Clicking download button...');
          await page.click('button:contains("Download"), input[type="submit"], button[type="submit"]');
          
          console.log('Waiting for PDF generation...');
          
          // Wait for either download link or redirect (up to 3 minutes)
          let downloadUrl = null;
          let attempts = 0;
          const maxAttempts = 36; // 3 minutes (5 second intervals)
          
          while (!downloadUrl && attempts < maxAttempts) {
            await page.waitForTimeout(5000);
            attempts++;
            
            // Check for download link
            const links = await page.$$eval('a[href]', links => 
              links.map(link => link.href).filter(href => 
                href.includes('.pdf') || href.includes('download')
              )
            );
            
            if (links.length > 0) {
              downloadUrl = links[0];
              console.log('Found download link:', downloadUrl);
              break;
            }
            
            // Check if page URL changed (redirect to PDF)
            const currentUrl = page.url();
            if (currentUrl !== 'https://docsend2pdf.com/' && currentUrl.includes('.pdf')) {
              downloadUrl = currentUrl;
              console.log('Page redirected to PDF:', downloadUrl);
              break;
            }
            
            console.log(\`Attempt \${attempts}/\${maxAttempts} - still waiting...\`);
          }
          
          if (!downloadUrl) {
            throw new Error('PDF generation timed out - no download link found after 3 minutes');
          }
          
          return { downloadUrl };
          
        } catch (error) {
          console.error('Automation error:', error);
          throw error;
        }
      };
    `;
    
    console.log('Sending automation request to Browserless...');
    
    // Call Browserless API
    const browserlessResponse = await axios({
      method: 'POST',
      url: `https://chrome.browserless.io/function?token=${browserlessToken}`,
      headers: {
        'Content-Type': 'application/json'
      },
      data: {
        code: automationScript
      },
      timeout: 240000 // 4 minute timeout
    });
    
    console.log('Browserless response:', browserlessResponse.data);
    
    if (!browserlessResponse.data || !browserlessResponse.data.downloadUrl) {
      throw new Error('No download URL returned from automation');
    }
    
    const downloadUrl = browserlessResponse.data.downloadUrl;
    console.log('Downloading PDF from:', downloadUrl);
    
    // Download the PDF file
    const pdfResponse = await axios({
      method: 'GET',
      url: downloadUrl,
      responseType: 'arraybuffer',
      timeout: 60000
    });
    
    // Generate filename
    let filename = 'docsend-document.pdf';
    try {
      const urlObj = new URL(url);
      const docId = urlObj.pathname.split('/').pop() || 'document';
      filename = `docsend-${docId}-${Date.now()}.pdf`;
    } catch (urlError) {
      filename = `docsend-document-${Date.now()}.pdf`;
    }
    
    // Set response headers
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfResponse.data.length
    });
    
    // Send PDF
    res.send(pdfResponse.data);
    
    console.log('PDF conversion completed successfully, size:', pdfResponse.data.length, 'bytes');
    
  } catch (error) {
    console.error('PDF conversion error:', error);
    
    if (error.message.includes('timeout') || error.message.includes('timed out')) {
      return res.status(408).json({ 
        error: 'PDF conversion timed out. The document may be very large or the service is busy. Please try again in a few minutes.' 
      });
    }
    
    if (error.response?.status === 402) {
      return res.status(503).json({ 
        error: 'PDF conversion service quota exceeded. Please try again later.' 
      });
    }
    
    res.status(500).json({ 
      error: `PDF conversion failed: ${error.message}. Please try text scraping instead.` 
    });
  }
};