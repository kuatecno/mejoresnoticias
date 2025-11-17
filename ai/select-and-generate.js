'use strict';

require('dotenv').config();
const { ContentProcessor } = require('./contentProcessor');

async function runSelectionAndGeneration() {
  try {
    console.log('🎯 Starting AI content selection and generation...');
    
    const processor = new ContentProcessor();
    const result = await processor.processDailyContent();
    
    console.log('✅ Selection and generation completed');
    console.log(`📰 Headline: ${result.headline}`);
    console.log(`📊 Processed ${result.articles.length} articles`);
    
    return result;
    
  } catch (err) {
    console.error('❌ Selection and generation failed:', err);
    throw err;
  }
}

// CLI handler
if (require.main === module) {
  runSelectionAndGeneration()
    .then(result => {
      console.log('✅ Completed:', JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Failed:', err.message);
      process.exit(1);
    });
}

module.exports = { runSelectionAndGeneration };
