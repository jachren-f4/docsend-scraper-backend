const axios = require('axios');
const cheerio = require('cheerio');

// Try to import puppeteer, but don't fail if it's not available
let puppeteer;
try {
  puppeteer = require('puppeteer');
} catch (error) {
  console.log('Puppeteer not available, using HTTP only');
}

class DocSendScraper {
  async scrapePresentation(url, password = null) {
    console.log('Starting scrape for URL:', url);
    
    // Determine if this looks like a DocSend URL
    const isDocSend = url.includes('docsend.com');
    
    if (isDocSend && puppeteer) {
      console.log('DocSend URL detected, using Puppeteer');
      return await this.scrapePuppeteer(url, password);
    } else {
      console.log('Using HTTP scraping');
      return await this.scrapeHTTP(url, password);
    }
  }

  async scrapePuppeteer(url, password = null) {
    let browser;
    try {
      console.log('Launching Puppeteer...');
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
      
      // Set user agent
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      console.log('Navigating to:', url);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      
      // Handle password if provided
      if (password) {
        await this.handlePasswordProtection(page, password);
      }
      
      // Wait for DocSend to load
      console.log('Waiting for DocSend content to load...');
      await page.waitForTimeout(5000);
      
      // Try to find DocSend specific elements
      await page.waitForSelector('body', { timeout: 10000 });
      
      // Extract DocSend content
      const data = await page.evaluate(() => {
        const title = document.querySelector('title')?.textContent || 
                     document.querySelector('h1')?.textContent || 
                     'DocSend Presentation';
        
        const slides = [];
        
        // Look for DocSend specific slide elements
        const slideElements = document.querySelectorAll(
          '.slide, .page, [data-slide], .slide-container, .presentation-slide, .document-page'
        );
        
        if (slideElements.length > 0) {
          console.log(`Found ${slideElements.length} slide elements`);
          slideElements.forEach((slide, index) => {
            const text = slide.innerText?.trim() || '';
            const images = Array.from(slide.querySelectorAll('img')).map(img => img.src);
            
            if (text && text.length > 10) {
              slides.push({
                slideNumber: index + 1,
                text: text,
                images: images
              });
            }
          });
        } else {
          // Fallback: extract all visible text content
          console.log('No slide elements found, extracting all content');
          const allText = document.body.innerText || '';
          const allImages = Array.from(document.querySelectorAll('img')).map(img => img.src);
          
          // Split content into reasonable chunks
          const chunks = allText.match(/.{1,1500}/g) || [allText];
          chunks.forEach((chunk, index) => {
            if (chunk.trim().length > 20) {
              slides.push({
                slideNumber: index + 1,
                text: chunk.trim(),
                images: index === 0 ? allImages.slice(0, 5) : []
              });
            }
          });
        }
        
        return {
          title,
          slideCount: slides.length,
          slides,
          extractedAt: new Date().toISOString(),
          scrapingMethod: 'Puppeteer (JavaScript rendering)'
        };
      });
      
      console.log(`Puppeteer extraction completed: ${data.slideCount} slides found`);
      return data;
      
    } catch (error) {
      console.error('Puppeteer scraping error:', error);
      throw new Error(`Puppeteer scraping failed: ${error.message}`);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  async handlePasswordProtection(page, password) {
    try {
      console.log('Looking for password field...');
      const passwordField = await page.$('input[type="password"]');
      
      if (passwordField) {
        console.log('Password field found, entering password');
        await page.type('input[type="password"]', password);
        
        // Look for submit button
        const submitButton = await page.$('button[type="submit"], input[type="submit"], button:contains("Submit"), button:contains("Continue")');
        if (submitButton) {
          await submitButton.click();
          await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });
          console.log('Password submitted successfully');
        }
      } else {
        console.log('No password field found');
      }
    } catch (error) {
      console.log('Password handling failed:', error.message);
      // Don't throw error, continue with scraping
    }
  }

  async scrapeHTTP(url, password = null) {
    // Keep the existing HTTP scraping as fallback
    try {
      console.log('Using HTTP scraping as fallback');
      
      const config = {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 15000
      };

      const response = await axios.get(url, config);
      const $ = cheerio.load(response.data);
      
      const title = $('title').text().trim() || 'HTTP Scraped Content';
      const bodyText = $('body').text().trim();
      
      return {
        title,
        slideCount: 1,
        slides: [{
          slideNumber: 1,
          text: bodyText.substring(0, 2000) + (bodyText.length > 2000 ? '...' : ''),
          images: []
        }],
        extractedAt: new Date().toISOString(),
        scrapingMethod: 'HTTP + Cheerio (fallback)'
      };
      
    } catch (error) {
      throw new Error(`HTTP scraping failed: ${error.message}`);
    }
  }
}

module.exports = DocSendScraper;