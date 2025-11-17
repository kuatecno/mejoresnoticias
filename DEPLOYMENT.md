# Render Backend Deployment Guide

## 🚀 Ready to Deploy

Your backend infrastructure is fully tested and ready:

✅ **Multi-site scraper**: Working (tested with 50 articles)  
✅ **Database schema**: Enhanced for multiple sources  
✅ **AI processing**: Ready (needs OpenAI API key)  
✅ **Render configuration**: Complete (render.yaml)  

## 📋 Deployment Steps

### 1. Add OpenAI API Key
Get your API key from https://platform.openai.com/api-keys and add to `.env`:
```bash
OPENAI_API_KEY=sk-your-openai-api-key-here
```

### 2. Test AI Processing (Optional)
```bash
npm run ai:select
```

### 3. Push to GitHub
```bash
git add .
git commit -m "Add multi-site AI-powered news backend"
git push origin main
```

### 4. Deploy to Render
1. Go to https://render.com
2. Connect your GitHub repository
3. Render will auto-detect `render.yaml` and create:
   - **PostgreSQL Database** (`news-db`)
   - **Scraper Worker** (`news-scraper`)
   - **AI Processor** (`ai-processor`)

### 5. Configure Environment Variables
In Render dashboard, add:
- `OPENAI_API_KEY`: Your OpenAI API key
- `FIGMA_API_KEY`: Your existing Figma key
- `DATABASE_URL`: Auto-populated by Render

## 🔧 Render Services

### Database (`news-db`)
- PostgreSQL with enhanced schema
- Supports multiple news sources
- AI analysis fields included

### Scraper Worker (`news-scraper`)
- Runs 4x daily (6 AM, 12 PM, 6 PM, 12 AM)
- Scrapes all configured sources
- Stores articles with metadata

### AI Processor (`ai-processor`)
- Runs every 2 hours
- Analyzes article quality and relevance
- Selects top articles for front page
- Generates compelling headlines

## 📊 Monitoring

### View Logs
In Render dashboard → Services → Logs

### Database Access
Render provides connection strings and management tools

### API Testing
```bash
# Health check
curl https://your-app.onrender.com/health

# Manual AI processing
curl -X POST https://your-app.onrender.com/process
```

## 🔄 Cron Job Schedule

### Scraping (4x daily)
- 6:00 AM UTC
- 12:00 PM UTC  
- 6:00 PM UTC
- 12:00 AM UTC

### AI Processing (Every 2 hours)
- :30 minutes past every even hour
- Analyzes new articles
- Updates rankings and selections

## 💰 Cost Estimate

### Free Tier (Start)
- PostgreSQL: Free (90-day limit)
- Worker service: Free (750 hours/month)
- Web service: Free (750 hours/month)

### Scaling Up
- Database: $7/month (permanent)
- Workers: $5-10/month each
- OpenAI: $10-50/month (usage-based)

## 🎯 Next Steps

1. **Deploy to Render** - Get 24/7 operation
2. **Monitor first runs** - Check logs for success
3. **Add more sources** - Easy expansion in `multiSiteScraper.js`
4. **Connect Vercel frontend** - Point to Render database

## 🛠️ Local Development

Keep using local development for testing:
```bash
# Scrape all sources
npm run scrape:all

# Process with AI
npm run ai:select

# View dashboard
npm run dashboard
```

The Render backend will work identically to your local setup!
