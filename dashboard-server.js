'use strict';

require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = 3000;

// Database connection
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!connectionString) {
  console.error('DATABASE_URL or POSTGRES_URL is not set');
  process.exit(1);
}

const pool = new Pool({ connectionString });

// Middleware
app.use(express.json());
app.use(express.static('.'));

// Test endpoint for debugging
app.get('/api/test', async (req, res) => {
  try {
    console.log('Testing database connection...');
    const { rows } = await pool.query('SELECT COUNT(*) as count FROM newyorker_articles');
    console.log('Database test result:', rows);
    res.json({ success: true, count: rows[0].count });
  } catch (err) {
    console.error('Database test error:', err);
    res.status(500).json({ error: err.message });
  }
});

// API Routes
app.get('/api/articles', async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', withBody = '' } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE 1=1';
    let queryParams = [];
    let paramIndex = 1;
    
    if (search) {
      whereClause += ` AND (title ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }
    
    if (withBody === 'true') {
      whereClause += ` AND body_available = true`;
    } else if (withBody === 'false') {
      whereClause += ` AND body_available = false`;
    }
    
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
      ${whereClause}
      ORDER BY published_at DESC, scraped_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    queryParams.push(parseInt(limit), parseInt(offset));
    
    console.log('=== DEBUG INFO ===');
    console.log('Page:', page, 'Limit:', limit, 'Offset:', offset);
    console.log('Where Clause:', whereClause);
    console.log('Query:', query);
    console.log('Query Parameters:', queryParams);
    console.log('Parameter types:', queryParams.map(p => typeof p));
    console.log('==================');
    
    const { rows } = await pool.query(query, queryParams);
    
    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM newyorker_articles 
      ${whereClause}
    `;
    
    // For count query, only use WHERE clause parameters (exclude limit/offset)
    const countParams = queryParams.slice(0, -2);
    
    console.log('Count Query:', countQuery);
    console.log('Count Params:', countParams);
    const { rows: countRows } = await pool.query(countQuery, countParams);
    const total = parseInt(countRows[0].total);
    
    res.json({
      articles: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (err) {
    console.error('Error fetching articles:', err);
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
});

app.get('/api/articles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT * FROM newyorker_articles 
      WHERE id = $1
    `;
    
    const { rows } = await pool.query(query, [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }
    
    res.json(rows[0]);
    
  } catch (err) {
    console.error('Error fetching article:', err);
    res.status(500).json({ error: 'Failed to fetch article' });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN body_available = true THEN 1 END) as with_body,
        COUNT(CASE WHEN body_available = false THEN 1 END) as without_body
      FROM newyorker_articles
    `;
    
    const { rows } = await pool.query(query);
    res.json(rows[0]);
    
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Serve dashboard
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Article Dashboard running at http://localhost:${PORT}/dashboard`);
  console.log(`📊 API available at http://localhost:${PORT}/api/articles`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🔄 Shutting down gracefully...');
  await pool.end();
  process.exit(0);
});
