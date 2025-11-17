'use strict';

require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!connectionString) {
  console.error('DATABASE_URL or POSTGRES_URL is not set');
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function viewArticles() {
  try {
    const query = `
      SELECT 
        id,
        title,
        description,
        image_url,
        body_available,
        published_at,
        scraped_at,
        url
      FROM newyorker_articles 
      ORDER BY published_at DESC, scraped_at DESC
      LIMIT 10
    `;

    const { rows } = await pool.query(query);
    
    console.log('\n=== RECENT NEW YORKER ARTICLES ===\n');
    
    rows.forEach((article, index) => {
      console.log(`${index + 1}. ${article.title || 'No Title'}`);
      console.log(`   URL: ${article.url}`);
      console.log(`   Published: ${article.published_at ? new Date(article.published_at).toLocaleDateString() : 'Unknown'}`);
      console.log(`   Body Available: ${article.body_available ? '✅ Yes' : '❌ No'}`);
      
      if (article.description) {
        console.log(`   Description: ${article.description.substring(0, 150)}${article.description.length > 150 ? '...' : ''}`);
      }
      
      console.log(`   Scraped: ${new Date(article.scraped_at).toLocaleString()}`);
      console.log('');
    });

    // Show body content for one article with full text
    const fullArticle = rows.find(article => article.body_available);
    if (fullArticle) {
      console.log('\n=== SAMPLE FULL ARTICLE BODY ===\n');
      console.log(`Title: ${fullArticle.title}`);
      console.log('Body:');
      
      const bodyQuery = 'SELECT body_text FROM newyorker_articles WHERE id = $1';
      const { rows: bodyRows } = await pool.query(bodyQuery, [fullArticle.id]);
      
      if (bodyRows[0] && bodyRows[0].body_text) {
        console.log(bodyRows[0].body_text.substring(0, 1000) + (bodyRows[0].body_text.length > 1000 ? '...\n\n[Body truncated for display]' : ''));
      }
    }

    // Show statistics
    const statsQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN body_available = true THEN 1 END) as with_body,
        COUNT(CASE WHEN body_available = false THEN 1 END) as without_body
      FROM newyorker_articles
    `;
    
    const { rows: statsRows } = await pool.query(statsQuery);
    const stats = statsRows[0];
    
    console.log('\n=== DATABASE STATISTICS ===\n');
    console.log(`Total Articles: ${stats.total}`);
    console.log(`With Full Body: ${stats.with_body} (${Math.round(stats.with_body / stats.total * 100)}%)`);
    console.log(`Without Body (Paywall/Other): ${stats.without_body} (${Math.round(stats.without_body / stats.total * 100)}%)`);

  } catch (err) {
    console.error('Error viewing articles:', err);
  } finally {
    await pool.end();
  }
}

viewArticles();
