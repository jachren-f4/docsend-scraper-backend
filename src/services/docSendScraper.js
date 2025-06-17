const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

class DocSendScraper {
  async scrapePresentation(url, password = null) {
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    try {
      const page = await browser.newPage();
      
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
      
      const submitButton = await page.$('button[type="submit"], input[type="submit"]');
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
      
      const slides = [];
      const textContent = document.body.innerText || 'No content found';
      
      slides.push({
        slideNumber: 1,
        text: textContent.substring(0, 1000) + (textContent.length > 1000 ? '...' : ''),
        images: Array.from(document.querySelectorAll('img')).map(img => img.src).slice(0, 5)
      });
      
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