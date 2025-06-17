const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

class DocSendScraper {
  async scrapePresentation(url, password = null) {
    const browser = await puppeteer.launch({
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
      ],
      // For Render.com - use system Chrome if available
      executablePath: process.env.NODE_ENV === 'production' 
        ? process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome'
        : undefined
    });

    try {
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
      
      // Wait a bit for content to load
      await page.waitForTimeout(3000);
      
      // Extract presentation data
      const presentationData = await this.extractPresentationData(page);
      
      return presentationData;
    } catch (error) {
      console.error('Scraping error:', error);
      throw new Error(`Scraping failed: ${error.message}`);
    } finally {
      await browser.close();
    }
  }

  async handlePasswordProtection(page, password) {
    try {
      console.log('Handling password protection...');
      await page.waitForSelector('input[type="password"]', { timeout: 5000 });
      await page.type('input[type="password"]', password);
      
      // Look for submit button
      const submitButton = await page.$('button[type="submit"], input[type="submit"], button:contains("Submit")');
      if (submitButton) {
        await submitButton.click();
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
      }
    } catch (error) {
      console.log('No password field found or password not required');
    }
  }

  async extractPresentationData(page) {
    console.log('Extracting presentation data...');
    
    const data = await page.evaluate(() => {
      const title = document.querySelector('title')?.textContent || 'Untitled Presentation';
      
      // Try to find slides or content
      const slides = [];
      const slideElements = document.querySelectorAll('[data-slide], .slide, .page, .presentation-slide');
      
      if (slideElements.length === 0) {
        // Fallback: try to extract any text content
        const textContent = document.body.innerText || '';
        slides.push({
          slideNumber: 1,
          text: textContent.substring(0, 500) + (textContent.length > 500 ? '...' : ''),
          images: []
        });
      } else {
        slideElements.forEach((slide, index) => {
          const text = slide.innerText || '';
          const images = Array.from(slide.querySelectorAll('img')).map(img => img.src);
          
          slides.push({
            slideNumber: index + 1,
            text: text.trim(),
            images
          });
        });
      }
      
      return {
        title,
        slideCount: slides.length,
        slides,
        extractedAt: new Date().toISOString()
      };
    });
    
    console.log('Extracted data:', { title: data.title, slideCount: data.slideCount });
    return data;
  }
}

module.exports = DocSendScraper;