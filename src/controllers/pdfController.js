const axios = require('axios');

// Try to import playwright
let chromium;
try {
  const playwright = require('playwright-chromium');
  chromium = playwright.chromium;
} catch (error) {
  console.log('Playwright not available for form automation');
}

exports.convertToPDF = async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    if (!chromium) {
      return res.status(503).json({ 
        error: 'PDF conversion service is not available. Browser automation is not configured.' 
      });
    }
    
    console.log('Starting form automation for PDF conversion:', url);
    
    let browser;
    try {
      // Launch browser
      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });
      
      const page = await browser.newPage();
      
      // Navigate to the PDF conversion website
      console.log('Navigating to PDF conversion form...');
      await page.goto('https://docsend2pdf.com', { waitUntil: 'networkidle', timeout: 30000 });
      
      // Fill in the URL field
      console.log('Filling in DocSend URL...');
      const urlInput = await page.locator('input[type="text"], input[type="url"]').first();
      await urlInput.fill(url);
      
      // Click the Download button
      console.log('Clicking download button...');
      await page.click('button:has-text("Download"), input[type="submit"], button[type="submit"]');
      
      // Wait for PDF generation - this can take 1-2 minutes
      console.log('Waiting for PDF generation... This may take up to 2 minutes.');
      
      // Wait for either a download or a download link to appear
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
      
      // Option 1: Wait for direct download
      try {
        console.log('Waiting for direct download...');
        const downloadPromise = page.waitForEvent('download', { timeout: 180000 }); // 3 minutes
        const download = await downloadPromise;
        
        console.log('Download started, saving file...');
        const path = await download.path();
        const fs = require('fs');
        pdfBuffer = fs.readFileSync(path);
        
        // Clean up temp file
        fs.unlinkSync(path);
        
        console.log('PDF downloaded via direct download, size:', pdfBuffer.length);
        
      } catch (downloadError) {
        console.log('Direct download not available, looking for download link...');
        
        // Option 2: Wait for download link to appear on the page
        await page.waitForTimeout(5000); // Give page time to update
        
        // Look for download links
        const downloadLink = await page.locator('a[href$=".pdf"], a[href*="download"], a:has-text("download"), a:has-text("Download")').first();
        
        // Wait up to 2 minutes for the download link to appear
        await downloadLink.waitFor({ timeout: 120000 });
        
        const href = await downloadLink.getAttribute('href');
        console.log('Found download link:', href);
        
        // Make sure the link is absolute
        let downloadUrl = href;
        if (href.startsWith('/')) {
          downloadUrl = `https://docsend2pdf.com${href}`;
        } else if (!href.startsWith('http')) {
          downloadUrl = `https://docsend2pdf.com/${href}`;
        }
        
        console.log('Downloading PDF from:', downloadUrl);
        
        // Download the PDF from the link
        const pdfResponse = await axios({
          method: 'GET',
          url: downloadUrl,
          responseType: 'arraybuffer',
          timeout: 60000
        });
        
        pdfBuffer = Buffer.from(pdfResponse.data);
        console.log('PDF downloaded via link, size:', pdfBuffer.length);
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
        error: 'PDF conversion timed out. The service may be busy processing your document. Please try again in a few minutes.' 
      });
    }
    
    res.status(500).json({ 
      error: `PDF conversion failed: ${error.message}. Please try again or use text scraping instead.` 
    });
  }
};