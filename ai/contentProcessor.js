'use strict';

require('dotenv').config();
const { Pool } = require('pg');
const OpenAI = require('openai');

// Database connection
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const pool = new Pool({ connectionString });

// OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// AI Content Processing Pipeline
class ContentProcessor {
  constructor() {
    this.contentCategories = {
      politics: { weight: 0.25, keywords: ['politics', 'government', 'election', 'policy', 'congress'] },
      culture: { weight: 0.20, keywords: ['culture', 'art', 'music', 'film', 'theater'] },
      business: { weight: 0.20, keywords: ['business', 'economy', 'market', 'finance', 'tech'] },
      international: { weight: 0.15, keywords: ['world', 'international', 'global', 'foreign'] },
      lifestyle: { weight: 0.10, keywords: ['lifestyle', 'health', 'food', 'travel', 'style'] },
      opinion: { weight: 0.10, keywords: ['opinion', 'editorial', 'analysis', 'perspective'] }
    };
  }

  async getRecentArticles(limit = 50) {
    const query = `
      SELECT * FROM articles 
      WHERE scraped_at > NOW() - INTERVAL '24 hours'
      ORDER BY published_at DESC, scraped_at DESC
      LIMIT $1
    `;
    
    const { rows } = await pool.query(query, [limit]);
    return rows;
  }

  async analyzeArticleContent(article) {
    if (!article.body_available || !article.body_text) {
      return null;
    }

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a news content analyst. Analyze the article and provide:
1. Category (politics, culture, business, international, lifestyle, opinion)
2. Quality score (1-10)
3. Relevance score (1-10)
4. Key topics (3-5 keywords)
5. Summary (2-3 sentences)
6. Engagement potential (low/medium/high)

Respond with JSON only.`
          },
          {
            role: "user",
            content: `Title: ${article.title}\n\nDescription: ${article.description}\n\nContent: ${article.body_text.substring(0, 2000)}...`
          }
        ],
        max_tokens: 300,
        temperature: 0.3
      });

      const analysis = JSON.parse(completion.choices[0].message.content);
      
      return {
        articleId: article.id,
        category: analysis.category,
        qualityScore: analysis.qualityScore,
        relevanceScore: analysis.relevanceScore,
        keyTopics: analysis.keyTopics,
        summary: analysis.summary,
        engagementPotential: analysis.engagementPotential,
        processedAt: new Date()
      };

    } catch (error) {
      console.error('Error analyzing article:', error.message);
      return null;
    }
  }

  async selectTopArticles(articles, targetCount = 10) {
    // Analyze all articles
    const analyzedArticles = [];
    
    for (const article of articles) {
      const analysis = await this.analyzeArticleContent(article);
      if (analysis) {
        analyzedArticles.push({
          ...article,
          analysis
        });
      }
    }

    // Score and rank articles
    const scoredArticles = analyzedArticles.map(article => {
      const categoryWeight = this.contentCategories[article.analysis.category]?.weight || 0.1;
      const qualityWeight = article.analysis.qualityScore / 10;
      const relevanceWeight = article.analysis.relevanceScore / 10;
      
      // Boost for high engagement potential
      const engagementBoost = article.analysis.engagementPotential === 'high' ? 1.2 : 
                             article.analysis.engagementPotential === 'medium' ? 1.1 : 1.0;
      
      const finalScore = (categoryWeight * 0.3 + qualityWeight * 0.4 + relevanceWeight * 0.3) * engagementBoost;
      
      return {
        ...article,
        finalScore
      };
    });

    // Sort by score and select top articles
    scoredArticles.sort((a, b) => b.finalScore - a.finalScore);
    
    return scoredArticles.slice(0, targetCount);
  }

  async generateBuenosDiasHeadline(selectedArticles) {
    try {
      const topArticle = selectedArticles[0];
      
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an editor for "Buenos Días", a Chilean news aggregator. Create a compelling, professional headline in Spanish or English that captures the essence of today's top stories. The headline should be engaging but factual, suitable for a serious news publication.`
          },
          {
            role: "user",
            content: `Today's top articles:\n${selectedArticles.map((a, i) => 
              `${i+1}. ${a.title} (${a.analysis.category}, quality: ${a.analysis.qualityScore}/10)`
            ).join('\n')}\n\nCreate a main headline for the Buenos Días front page.`
          }
        ],
        max_tokens: 100,
        temperature: 0.7
      });

      return completion.choices[0].message.content.trim();

    } catch (error) {
      console.error('Error generating headline:', error.message);
      return selectedArticles[0]?.title || 'Daily News Summary';
    }
  }

  async generateArticleSummary(article) {
    if (!article.body_available) {
      return article.description || 'Full article not available';
    }

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Create a compelling 2-3 sentence summary of this article for a news aggregator. The summary should be engaging, informative, and capture the main point.`
          },
          {
            role: "user",
            content: `Title: ${article.title}\n\nContent: ${article.body_text.substring(0, 1500)}...`
          }
        ],
        max_tokens: 150,
        temperature: 0.5
      });

      return completion.choices[0].message.content.trim();

    } catch (error) {
      console.error('Error generating summary:', error.message);
      return article.description || 'Summary not available';
    }
  }

  async processDailyContent() {
    console.log('🤖 Starting AI content processing...');
    
    try {
      // Get recent articles
      const articles = await this.getRecentArticles(50);
      console.log(`📊 Found ${articles.length} recent articles`);

      // Select top articles
      const topArticles = await this.selectTopArticles(articles, 10);
      console.log(`🎯 Selected ${topArticles.length} top articles`);

      // Generate main headline
      const mainHeadline = await this.generateBuenosDiasHeadline(topArticles);
      console.log(`📰 Generated headline: ${mainHeadline}`);

      // Generate enhanced summaries for top articles
      const enhancedArticles = [];
      for (const article of topArticles) {
        const summary = await this.generateArticleSummary(article);
        enhancedArticles.push({
          ...article,
          enhancedSummary: summary
        });
      }

      // Store processed content
      await this.storeProcessedContent(mainHeadline, enhancedArticles);
      
      console.log('✅ AI content processing completed');
      return {
        headline: mainHeadline,
        articles: enhancedArticles,
        processedAt: new Date()
      };

    } catch (error) {
      console.error('❌ Error in AI content processing:', error);
      throw error;
    }
  }

  async storeProcessedContent(headline, articles) {
    // Create processed_content table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS processed_content (
        id BIGSERIAL PRIMARY KEY,
        headline TEXT,
        articles JSONB,
        processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        published BOOLEAN DEFAULT FALSE
      )
    `);

    const query = `
      INSERT INTO processed_content (headline, articles, processed_at)
      VALUES ($1, $2, NOW())
      RETURNING id
    `;

    const { rows } = await pool.query(query, [headline, JSON.stringify(articles)]);
    console.log(`📝 Stored processed content with ID: ${rows[0].id}`);
  }

  async getLatestProcessedContent() {
    const query = `
      SELECT * FROM processed_content 
      ORDER BY processed_at DESC 
      LIMIT 1
    `;
    
    const { rows } = await pool.query(query);
    return rows[0] || null;
  }
}

// Export for use in Render cron jobs
module.exports = {
  ContentProcessor,
  processDailyContent: async () => {
    const processor = new ContentProcessor();
    return await processor.processDailyContent();
  }
};

// Allow running directly for testing
if (require.main === module) {
  const processor = new ContentProcessor();
  processor.processDailyContent()
    .then(result => {
      console.log('Processing result:', JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error('Processing failed:', err);
      process.exit(1);
    });
}
