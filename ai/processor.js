'use strict';

require('dotenv').config();
const { ContentProcessor } = require('./contentProcessor');
const { initSchema } = require('../lib/db-multi');

// Express server for AI processor (required by Render web service)
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Manual trigger endpoint for testing
app.post('/process', async (req, res) => {
  try {
    const processor = new ContentProcessor();
    const result = await processor.processDailyContent();
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Processing failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Main processing function
async function runProcessing() {
  try {
    console.log('🤖 Starting AI content processing...');
    
    // Initialize database schema
    await initSchema();
    console.log('✅ Database schema initialized');
    
    // Run content processing
    const processor = new ContentProcessor();
    const result = await processor.processDailyContent();
    
    console.log('✅ AI processing completed');
    return result;
    
  } catch (err) {
    console.error('❌ AI processing failed:', err);
    throw err;
  }
}

// CLI handler for cron jobs
if (require.main === module) {
  runProcessing()
    .then(result => {
      console.log('✅ Processing completed:', JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Processing failed:', err.message);
      process.exit(1);
    });
}

// Start server for web service
app.listen(PORT, () => {
  console.log(`🤖 AI Processor running on port ${PORT}`);
});

module.exports = { runProcessing };
