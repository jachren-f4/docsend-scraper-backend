const axios = require('axios');

// Try to import puppeteer
let puppeteer;
try {
  puppeteer = require('puppeteer');
} catch (error) {
  console.log('Puppeteer not available for form automation');
}

exports.convertToPDF = async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    if (!puppeteer) {
      return res.status(503).json({ 
        error: 'PDF conversion service is not available. Browser automation is not configured.' 
      });
    }
    
    console.log('Starting form automation for PDF conversion:', url);
    
    let browser;
    try {
      // Launch browser
      browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ]
      });
      
      const page = await browser.newPage();
      await page.setViewport({ width: 1366, height: 768 });
      
      // Navigate to the PDF conversion website
      console.log('Navigating to PDF conversion form...');
      await page.goto('https://docsend2pdf.com', { waitUntil: 'networkidle2', timeout: 30000 });
      
      // Fill in the URL field
      console.log('Filling in DocSend URL...');
      await page.waitForSelector('input[type="text"], input[type="url"]', { timeout: 10000 });
      await page.type('input[type="text"], input[type="url"]', url);
      
      // Click the Download button
      console.log('Clicking download button...');
      await page.click('button:contains("Download"), input[type="submit"], button[type="submit"]');
      
      // Wait for PDF generation - this can take 1-2 minutes
      console.log('Waiting for PDF generation... This may take up to 2 minutes.');
      
      let pdfBuffer;
      let filename = `docsend-${Date.now()}.pdf`;
      
      try {
        // Try to extract filename from URL
        const urlObj = new URL(url);
        const docId = urlObj.pathname.split('/').pop() || 'document';
        filename = `docsend-${docId}-${Date.now()}.pdf`;
      } catch (urlError) {
        console.log('Could not parse URL for filename, using default');
      }
      
      // Wait for download link or redirect
      console.log('Waiting for download link to appear...');
      
      // Wait up to 3 minutes for something to happen
      await page.waitForTimeout(5000); // Initial wait
      
      // Option 1: Look for download link
      try {
        console.log('Looking for download link...');
        
        // Wait for download link to appear (up to 2 minutes)
        await page.waitForSelector('a[href$=".pdf"], a[href*="download"], a[contains(text(), "download")]', { 
          timeout: 120000 
        });
        
        const downloadLink = await page.$('a[href$=".pdf"], a[href*="download"]');
        
        if (downloadLink) {
          const href = await page.evaluate(el => el.getAttribute('href'), downloadLink);
          console.log('Found download link:', href);
          
          // Make sure the link is absolute
          let downloadUrl = href;
          if (href.startsWith('/')) {
            downloadUrl = `https://docsend2pdf.com${href}`;
          } else if (!href.startsWith('http')) {
            downloadUrl = `https://docsend2pdf.com/${href}`;
          }
          
          console.log('Downloading PDF from:', downloadUrl);
          
          // Download the PDF
          const pdfResponse = await axios({
            method: 'GET',
            url: downloadUrl,
            responseType: 'arraybuffer',
            timeout: 60000
          });
          
          pdfBuffer = Buffer.from(pdfResponse.data);
          console.log('PDF downloaded successfully, size:', pdfBuffer.length);
        } else {
          throw new Error('Download link not found');
        }
        
      } catch (linkError) {
        console.log('Download link method failed:', linkError.message);
        
        // Option 2: Check if page URL changed to a PDF
        const currentUrl = page.url();
        console.log('Current page URL:', currentUrl);
        
        if (currentUrl.includes('.pdf') || currentUrl !== 'https://docsend2pdf.com') {
          console.log('Page redirected, downloading from current URL...');
          
          const pdfResponse = await axios({
            method: 'GET',
            url: currentUrl,
            responseType: 'arraybuffer',
            timeout: 60000
          });
          
          pdfBuffer = Buffer.from(pdfResponse.data);
          console.log('PDF downloaded from redirected URL, size:', pdfBuffer.length);
        } else {
          throw new Error('No download method worked - PDF may not be ready yet');
        }
      }
      
      // Send the PDF to the client
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length
      });
      
      res.send(pdfBuffer);
      console.log('PDF conversion completed successfully');
      
    } catch (automationError) {
      console.error('Form automation error:', automationError);
      throw new Error(`PDF generation failed: ${automationError.message}`);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
    
  } catch (error) {
    console.error('PDF conversion error:', error);
    
    if (error.message.includes('timeout') || error.message.includes('Timeout')) {
      return res.status(408).json({ 
        error: 'PDF conversion timed out. The service may be busy or the document is very large. Please try again in a few minutes.' 
      });
    }
    
    res.status(500).json({ 
      error: `PDF conversion failed: ${error.message}. Please try again or use text scraping instead.` 
    });
  }
};