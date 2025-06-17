const axios = require('axios');
const cheerio = require('cheerio');

// Try to import playwright
let playwright;
try {
  playwright = require('playwright-chromium');
} catch (error) {
  console.log('Playwright not available, using HTTP only');
}

class DocSendScraper {
  async scrapePresentation(url, password = null) {
    console.log('Starting scrape for URL:', url);
    
    const isDocSend = url.includes('docsend.com');
    
    if (isDocSend && playwright) {
      console.log('DocSend URL detected, using Playwright');
      return await this.scrapePlaywright(url, password);
    } else {
      console.log('Using HTTP scraping');
      return await this.scrapeHTTP(url, password);
    }
  }

  async scrapePlaywright(url, password = null) {
    let browser;
    try {
      console.log('Launching Playwright...');
      browser = await playwright.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const page = await browser.newPage();
      
      console.log('Navigating to:', url);
      await page.goto(url, { waitUntil: 'networkidle' });
      
      if (password) {
        await this.handlePasswordProtection(page, password);
      }
      
      console.log('Waiting for content to load...');
      await page.waitForTimeout(3000);
      
      const data = await page.evaluate(() => {
        const title = document.querySelector('title')?.textContent || 'DocSend Presentation';
        const slides = [];
        
        // Look for content
        const slideElements = document.querySelectorAll('.slide, .page, [data-slide]');
        
        if (slideElements.length > 0) {
          slideElements.forEach((slide, index) => {
            const text = slide.innerText?.trim() || '';
            if (text && text.length > 10) {
              slides.push({
                slideNumber: index + 1,
                text: text,
                images: []
              });
            }
          });
        } else {
          const allText = document.body.innerText || '';
          const chunks = allText.match(/.{1,1000}/g) || [allText];
          chunks.slice(0, 5).forEach((chunk, index) => {
            slides.push({
              slideNumber: index + 1,
              text: chunk.trim(),
              images: []
            });
          });
        }
        
        return {
          title,
          slideCount: slides.length,
          slides,
          extractedAt: new Date().toISOString(),
          scrapingMethod: 'Playwright'
        };
      });
      
      return data;
      
    } catch (error) {
      console.error('Playwright error:', error);
      throw new Error(`Playwright scraping failed: ${error.message}`);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  async handlePasswordProtection(page, password) {
    try {
      const passwordField = await page.$('input[type="password"]');
      if (passwordField) {
        await page.fill('input[type="password"]', password);
        const submitButton = await page.$('button[type="submit"], input[type="submit"]');
        if (submitButton) {
          await submitButton.click();
          await page.waitForNavigation();
        }
      }
    } catch (error) {
      console.log('Password handling failed:', error.message);
    }
  }

  async scrapeHTTP(url, password = null) {
    try {
      const config = {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
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
          text: bodyText.substring(0, 2000),
          images: []
        }],
        extractedAt: new Date().toISOString(),
        scrapingMethod: 'HTTP + Cheerio'
      };
      
    } catch (error) {
      throw new Error(`HTTP scraping failed: ${error.message}`);
    }
  }
}

module.exports = DocSendScraper;