# Buenos Días Chile (News Aggregator & AI System)

This project is a comprehensive news aggregation system that scrapes news sources, processes them using AI, and serves them via a modern web interface ("News Outlet").

## 🏗️ Architecture

The system is designed to be deployed on **Render** and consists of two main components:

### 1. The News Outlet (Frontend)
- **Role:** The public-facing website and admin dashboard.
- **Entrypoint:** `dashboard-server.js`
- **Features:**
  - Serves the main news site (`index.html`) at `/`.
  - Serves the admin dashboard (`dashboard.html`) at `/dashboard`.
  - Provides API endpoints for the frontend to fetch articles.

### 2. Scraper & AI Analysis System (Backend)
- **Role:** Background workers that fetch content and generate AI summaries.
- **Components:**
  - **Scraper:** Runs on a schedule (Cron) to fetch articles from configured sources (e.g., The New Yorker).
    - Entrypoint: `api/scrape-all.js`
  - **AI Processor:** Analyzes articles to generate summaries and insights.
    - Entrypoint: `ai/processor.js`

## 🚀 Deployment (Render)

The project is configured for deployment on Render via `render.yaml`. It defines:

1.  **PostgreSQL Database (`news-db`):** Stores articles and AI content.
2.  **Scraper Service (`news-scraper`):** A background worker that runs the scraping scripts.
3.  **AI Processor (`ai-processor`):** A service to handle AI content generation.
4.  **News Outlet (`news-outlet`):** The web service that serves the frontend and dashboard.

## 🛠️ Local Development

1.  **Install dependencies:**
    ```bash
    npm install
    ```

2.  **Setup Environment:**
    Create a `.env` file with:
    ```
    DATABASE_URL=postgres://user:pass@localhost:5432/mejoresnoticias
    OPENAI_API_KEY=your_openai_key
    ```

3.  **Run the News Outlet:**
    ```bash
    npm run dashboard
    ```
    Visit `http://localhost:3000` for the site.

4.  **Run Scrapers Manually:**
    ```bash
    npm run scrape:newyorker
    ```

## 📁 Key Files

- `dashboard-server.js` - Main web server (News Outlet).
- `lib/multiSiteScraper.js` - Core scraping logic.
- `ai/processor.js` - AI content generation logic.
- `render.yaml` - Render deployment configuration.
