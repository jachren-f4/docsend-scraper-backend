const axios = require('axios');
const cheerio = require('cheerio');

// Try to import playwright correctly
let chromium;
try {
  const playwright = require('playwright-chromium');
  chromium = playwright.chromium;
} catch (error) {
  console.log('Playwright not available, using HTTP only');
}

class DocSendScraper {
  async scrapePresentation(url, password = null) {
    console.log('Starting scrape for URL:', url);
    
    const isDocSend = url.includes('docsend.com');
    
    if (isDocSend && chromium) {
      console.log('DocSend URL detected, trying Playwright');
      try {
        return await this.scrapePlaywright(url, password);
      } catch (error) {
        console.log('Playwright failed, falling back to HTTP:', error.message);
        return await this.scrapeHTTP(url, password);
      }
    } else {
      console.log('Using HTTP scraping');
      return await this.scrapeHTTP(url, password);
    }
  }

  async scrapePlaywright(url, password = null) {
    let browser;
    try {
      console.log('Launching Playwright browser...');
      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });

      const page = await browser.newPage();
      
      console.log('Navigating to:', url);
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      
      if (password) {
        await this.handlePasswordProtection(page, password);
      }
      
      console.log('Waiting for DocSend content...');
      await page.waitForTimeout(5000);
      
      const data = await page.evaluate(() => {
        const title = document.querySelector('title')?.textContent || 'DocSend Presentation';
        const slides = [];
        
        // Look for DocSend specific elements
        const slideElements = document.querySelectorAll(
          '.slide, .page, [data-slide], .slide-container, .presentation-slide, .document-page, .slide-content'
        );
        
        console.log(`Found ${slideElements.length} potential slide elements`);
        
        if (slideElements.length > 0) {
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
        }
        
        // If no slides found, extract all content
        if (slides.length === 0) {
          console.log('No slide elements found, extracting all content');
          const allText = document.body.innerText || '';
          const allImages = Array.from(document.querySelectorAll('img')).map(img => img.src);
          
          if (allText.length > 50) {
            // Split into chunks
            const chunks = allText.match(/.{1,1500}/g) || [allText];
            chunks.slice(0, 10).forEach((chunk, index) => {
              if (chunk.trim().length > 20) {
                slides.push({
                  slideNumber: index + 1,
                  text: chunk.trim(),
                  images: index === 0 ? allImages.slice(0, 5) : []
                });
              }
            });
          }
        }
        
        return {
          title,
          slideCount: slides.length,
          slides,
          extractedAt: new Date().toISOString(),
          scrapingMethod: 'Playwright (JavaScript rendering)'
        };
      });
      
      console.log(`Playwright extraction completed: ${data.slideCount} slides found`);
      return data;
      
    } catch (error) {
      console.error('Playwright scraping error:', error);
      throw new Error(`Playwright scraping failed: ${error.message}`);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  async handlePasswordProtection(page, password) {
    try {
      console.log('Looking for password field...');
      const passwordField = await page.locator('input[type="password"]').first();
      
      if (await passwordField.isVisible({ timeout: 5000 })) {
        console.log('Password field found, entering password');
        await passwordField.fill(password);
        
        // Look for submit button
        const submitButton = page.locator('button[type="submit"], input[type="submit"]').first();
        if (await submitButton.isVisible({ timeout: 2000 })) {
          await submitButton.click();
          await page.waitForNavigation({ timeout: 10000 });
          console.log('Password submitted successfully');
        }
      }
    } catch (error) {
      console.log('Password handling failed:', error.message);
    }
  }

  async scrapeHTTP(url, password = null) {
    try {
      console.log('Using HTTP scraping method');
      
      const config = {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        timeout: 15000,
        maxRedirects: 5
      };

      const response = await axios.get(url, config);
      const $ = cheerio.load(response.data);
      
      const title = $('title').text().trim() || 
                   $('h1').first().text().trim() || 
                   'HTTP Scraped Content';
      
      const bodyText = $('body').text().trim();
      
      // Try to extract more meaningful content
      const slides = [];
      if (bodyText.length > 100) {
        const chunks = bodyText.match(/.{1,1200}/g) || [bodyText];
        chunks.slice(0, 5).forEach((chunk, index) => {
          if (chunk.trim().length > 50) {
            slides.push({
              slideNumber: index + 1,
              text: chunk.trim(),
              images: []
            });
          }
        });
      }
      
      if (slides.length === 0) {
        slides.push({
          slideNumber: 1,
          text: 'Content was found but may require JavaScript to display properly. Try using a DocSend URL for better results.',
          images: []
        });
      }
      
      return {
        title,
        slideCount: slides.length,
        slides,
        extractedAt: new Date().toISOString(),
        scrapingMethod: 'HTTP + Cheerio (Limited - JavaScript content not accessible)'
      };
      
    } catch (error) {
      console.error('HTTP scraping error:', error);
      throw new Error(`HTTP scraping failed: ${error.message}`);
    }
  }
}

module.exports = DocSendScraper;