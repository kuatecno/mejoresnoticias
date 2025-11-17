'use strict';

require('dotenv').config();
const { scrapeAllSources } = require('../lib/multiSiteScraper');
const { initSchema, saveArticles } = require('../lib/db-multi');

async function runScrape(options = {}) {
  try {
    // Initialize database schema
    await initSchema();
    console.log('✅ Database schema initialized');
    
    // Scrape all configured sources
    const articles = await scrapeAllSources(options);
    console.log(`📰 Scraped ${articles.length} articles from all sources`);
    
    // Save to database
    const savedRows = await saveArticles(articles);
    console.log(`💾 Saved ${savedRows.length} articles to database`);
    
    return {
      scraped: articles.length,
      saved: savedRows.length,
      sources: options.sources || ['newyorker']
    };
    
  } catch (err) {
    console.error('❌ Scrape failed:', err);
    throw err;
  }
}

// CLI handler
if (require.main === module) {
  const limit = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) || 50 : 50;
  const sources = process.env.SOURCES ? process.env.SOURCES.split(',') : ['newyorker'];
  
  runScrape({ limit, sources })
    .then(result => {
      console.log('✅ Scrape completed:', JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Scrape failed:', err.message);
      process.exit(1);
    });
}

module.exports = { runScrape };
