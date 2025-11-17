'use strict';

const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!connectionString) {
  console.warn('DATABASE_URL or POSTGRES_URL is not set. Database operations will fail until it is configured.');
}

const pool = connectionString ? new Pool({ connectionString }) : null;

async function initSchema() {
  if (!pool) {
    throw new Error('DATABASE_URL or POSTGRES_URL must be set for Postgres.');
  }

  // Main articles table (supports multiple sources)
  const createArticlesTable = `
    CREATE TABLE IF NOT EXISTS articles (
      id BIGSERIAL PRIMARY KEY,
      url TEXT UNIQUE NOT NULL,
      source TEXT NOT NULL,
      source_name TEXT NOT NULL,
      title TEXT,
      description TEXT,
      image_url TEXT,
      body_text TEXT,
      body_available BOOLEAN DEFAULT FALSE,
      published_at TIMESTAMPTZ,
      scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      raw_jsonld TEXT,
      
      -- AI analysis fields
      category TEXT,
      quality_score INTEGER,
      relevance_score INTEGER,
      key_topics TEXT[],
      summary TEXT,
      engagement_potential TEXT,
      processed_at TIMESTAMPTZ
    );
  `;

  // Processed daily content
  const createProcessedContentTable = `
    CREATE TABLE IF NOT EXISTS processed_content (
      id BIGSERIAL PRIMARY KEY,
      headline TEXT NOT NULL,
      articles JSONB NOT NULL,
      processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      published BOOLEAN DEFAULT FALSE,
      date DATE NOT NULL DEFAULT CURRENT_DATE
    );
  `;

  // Analytics table
  const createAnalyticsTable = `
    CREATE TABLE IF NOT EXISTS analytics (
      id BIGSERIAL PRIMARY KEY,
      article_id BIGINT REFERENCES articles(id),
      event_type TEXT NOT NULL,
      event_data JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      date DATE NOT NULL DEFAULT CURRENT_DATE
    );
  `;

  // Create indexes for performance
  const createIndexes = `
    CREATE INDEX IF NOT EXISTS idx_articles_source ON articles(source);
    CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at DESC);
    CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
    CREATE INDEX IF NOT EXISTS idx_articles_quality ON articles(quality_score DESC);
    CREATE INDEX IF NOT EXISTS idx_processed_content_date ON processed_content(date DESC);
    CREATE INDEX IF NOT EXISTS idx_analytics_date ON analytics(date);
  `;

  await pool.query(createArticlesTable);
  await pool.query(createProcessedContentTable);
  await pool.query(createAnalyticsTable);
  await pool.query(createIndexes);
}

async function upsertArticle(article) {
  if (!pool) {
    throw new Error('DATABASE_URL or POSTGRES_URL must be set for Postgres.');
  }

  const { 
    url, source, sourceName, title, description, imageUrl, 
    bodyText, bodyAvailable, publishedAt, rawJsonLd,
    category, qualityScore, relevanceScore, keyTopics, summary, engagementPotential
  } = article;

  const query = `
    INSERT INTO articles (
      url, source, source_name, title, description, image_url, 
      body_text, body_available, published_at, scraped_at, raw_jsonld,
      category, quality_score, relevance_score, key_topics, summary, engagement_potential, processed_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10, $11, $12, $13, $14, $15, $16, $17)
    ON CONFLICT (url) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      image_url = EXCLUDED.image_url,
      body_text = EXCLUDED.body_text,
      body_available = EXCLUDED.body_available,
      published_at = EXCLUDED.published_at,
      scraped_at = NOW(),
      raw_jsonld = EXCLUDED.raw_jsonld,
      category = EXCLUDED.category,
      quality_score = EXCLUDED.quality_score,
      relevance_score = EXCLUDED.relevance_score,
      key_topics = EXCLUDED.key_topics,
      summary = EXCLUDED.summary,
      engagement_potential = EXCLUDED.engagement_potential,
      processed_at = EXCLUDED.processed_at
    RETURNING *;
  `;

  const values = [
    url,
    source,
    sourceName,
    title || null,
    description || null,
    imageUrl || null,
    bodyText || null,
    bodyAvailable || false,
    publishedAt || null,
    rawJsonLd || null,
    category || null,
    qualityScore || null,
    relevanceScore || null,
    keyTopics || null,
    summary || null,
    engagementPotential || null,
    article.processedAt || null
  ];

  const { rows } = await pool.query(query, values);
  return rows[0];
}

async function saveProcessedContent(headline, articles) {
  if (!pool) {
    throw new Error('DATABASE_URL or POSTGRES_URL must be set for Postgres.');
  }

  const query = `
    INSERT INTO processed_content (headline, articles, processed_at)
    VALUES ($1, $2, NOW())
    RETURNING *;
  `;

  const { rows } = await pool.query(query, [headline, JSON.stringify(articles)]);
  return rows[0];
}

async function getLatestProcessedContent() {
  if (!pool) {
    throw new Error('DATABASE_URL or POSTGRES_URL must be set for Postgres.');
  }

  const query = `
    SELECT * FROM processed_content 
    ORDER BY processed_at DESC 
    LIMIT 1
  `;
  
  const { rows } = await pool.query(query);
  return rows[0];
}

async function getTopArticles(limit = 20, category = null) {
  if (!pool) {
    throw new Error('DATABASE_URL or POSTGRES_URL must be set for Postgres.');
  }

  let whereClause = 'WHERE body_available = true AND quality_score >= 7';
  let queryParams = [];
  let paramIndex = 1;

  if (category) {
    whereClause += ` AND category = $${paramIndex}`;
    queryParams.push(category);
    paramIndex++;
  }

  const query = `
    SELECT * FROM articles 
    ${whereClause}
    ORDER BY quality_score DESC, published_at DESC 
    LIMIT $${paramIndex}
  `;

  queryParams.push(limit);
  
  const { rows } = await pool.query(query, [limit]);
  return rows;
}

async function saveArticles(articles) {
  if (!pool) {
    throw new Error('DATABASE_URL or POSTGRES_URL must be set for Postgres.');
  }

  const saved = [];
  for (const article of articles) {
    try {
      const savedRow = await upsertArticle(article);
      saved.push(savedRow);
    } catch (err) {
      console.error('Failed to save article:', err.message);
    }
  }
  
  return saved;
}

async function trackAnalytics(articleId, eventType, eventData = {}) {
  if (!pool) {
    throw new Error('DATABASE_URL or POSTGRES_URL must be set for Postgres.');
  }

  const query = `
    INSERT INTO analytics (article_id, event_type, event_data)
    VALUES ($1, $2, $3)
    RETURNING *;
  `;

  const { rows } = await pool.query(query, [articleId, eventType, eventData]);
  return rows[0];
}

module.exports = {
  initSchema,
  upsertArticle,
  saveArticles,
  saveProcessedContent,
  getLatestProcessedContent,
  getTopArticles,
  trackAnalytics,
  pool
};
