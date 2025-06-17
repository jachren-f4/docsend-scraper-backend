const axios = require('axios');
const cheerio = require('cheerio');

class DocSendScraper {
  async scrapePresentation(url, password = null) {
    try {
      console.log('Starting HTTP scraping for URL:', url);
      
      // Configure axios with browser-like headers
      const config = {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: 15000,
        maxRedirects: 5
      };

      // If password is provided, we'll try a simple approach
      if (password) {
        console.log('Password provided, but HTTP method has limitations with password-protected content');
      }

      console.log('Making HTTP request...');
      const response = await axios.get(url, config);
      
      console.log('Response received, status:', response.status);
      const $ = cheerio.load(response.data);
      
      // Extract title
      const title = $('title').text().trim() || 
                   $('h1').first().text().trim() || 
                   'Scraped Presentation';
      
      // Try to extract meaningful content
      const slides = this.extractSlides($);
      
      const result = {
        title: title,
        slideCount: slides.length,
        slides: slides,
        extractedAt: new Date().toISOString(),
        scrapingMethod: 'HTTP + Cheerio'
      };
      
      console.log('Extraction completed:', {
        title: result.title,
        slideCount: result.slideCount,
        method: result.scrapingMethod
      });
      
      return result;
      
    } catch (error) {
      console.error('HTTP scraping error:', error.message);
      
      // Provide more specific error messages
      if (error.code === 'ENOTFOUND') {
        throw new Error('Could not reach the URL. Please check if the URL is correct.');
      } else if (error.response && error.response.status === 403) {
        throw new Error('Access forbidden. The content may be password-protected or restricted.');
      } else if (error.response && error.response.status === 404) {
        throw new Error('Content not found. The URL may be invalid or expired.');
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('Request timed out. The server may be slow or unresponsive.');
      } else {
        throw new Error(`HTTP scraping failed: ${error.message}`);
      }
    }
  }

  extractSlides($) {
    const slides = [];
    
    // Strategy 1: Look for common slide containers
    const slideContainers = $('[data-slide], .slide, .page, .presentation-slide, .slide-content').toArray();
    
    if (slideContainers.length > 0) {
      console.log(`Found ${slideContainers.length} potential slide containers`);
      slideContainers.forEach((container, index) => {
        const $container = $(container);
        const text = $container.text().trim();
        const images = $container.find('img').map((i, img) => $(img).attr('src')).get();
        
        if (text && text.length > 10) { // Only include slides with meaningful content
          slides.push({
            slideNumber: index + 1,
            text: text.substring(0, 1500) + (text.length > 1500 ? '...' : ''),
            images: images.slice(0, 3) // Limit to 3 images per slide
          });
        }
      });
    }
    
    // Strategy 2: If no slide containers, extract by sections
    if (slides.length === 0) {
      console.log('No slide containers found, trying section-based extraction');
      const sections = $('section, article, .content, main').toArray();
      
      if (sections.length > 0) {
        sections.forEach((section, index) => {
          const $section = $(section);
          const text = $section.text().trim();
          const images = $section.find('img').map((i, img) => $(img).attr('src')).get();
          
          if (text && text.length > 20) {
            slides.push({
              slideNumber: index + 1,
              text: text.substring(0, 1500) + (text.length > 1500 ? '...' : ''),
              images: images.slice(0, 3)
            });
          }
        });
      }
    }
    
    // Strategy 3: Fallback - extract all text content
    if (slides.length === 0) {
      console.log('No structured content found, extracting all text');
      const bodyText = $('body').text().trim();
      const allImages = $('img').map((i, img) => $(img).attr('src')).get();
      
      if (bodyText && bodyText.length > 50) {
        // Split long text into chunks (simulate slides)
        const chunks = this.splitTextIntoChunks(bodyText, 1000);
        chunks.forEach((chunk, index) => {
          slides.push({
            slideNumber: index + 1,
            text: chunk,
            images: index === 0 ? allImages.slice(0, 5) : [] // Put images on first slide
          });
        });
      }
    }
    
    // Ensure we have at least one slide
    if (slides.length === 0) {
      slides.push({
        slideNumber: 1,
        text: 'Content was found but could not be extracted in a structured format. The page may require JavaScript rendering.',
        images: []
      });
    }
    
    return slides;
  }

  splitTextIntoChunks(text, maxLength) {
    const words = text.split(' ');
    const chunks = [];
    let currentChunk = '';
    
    for (const word of words) {
      if ((currentChunk + ' ' + word).length > maxLength && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = word;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + word;
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks.slice(0, 10); // Limit to 10 chunks/slides
  }
}

module.exports = DocSendScraper;