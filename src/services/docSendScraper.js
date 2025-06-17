class DocSendScraper {
  async scrapePresentation(url, password = null) {
    // Mock scraping for now - just return fake data
    console.log('Mock scraping URL:', url);
    
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate work
    
    return {
      title: `Mock Presentation from ${new URL(url).hostname}`,
      slideCount: 3,
      slides: [
        {
          slideNumber: 1,
          text: 'This is mock slide 1 content. Scraping will be implemented once deployment is stable.',
          images: []
        },
        {
          slideNumber: 2,
          text: 'This is mock slide 2 content.',
          images: []
        },
        {
          slideNumber: 3,
          text: 'This is mock slide 3 content.',
          images: []
        }
      ],
      extractedAt: new Date().toISOString()
    };
  }
}

module.exports = DocSendScraper;