'use strict';

const { XMLParser } = require('fast-xml-parser');
const cheerio = require('cheerio');

// News source configurations
const NEWS_SOURCES = {
  newyorker: {
    name: 'The New Yorker',
    sitemaps: [
      'https://www.newyorker.com/sitemap.xml?year=2025&month=11&week=3',
      'https://www.newyorker.com/sitemap.xml?year=2025&month=11&week=2',
      'https://www.newyorker.com/sitemap.xml?year=2025&month=11&week=1'
    ],
    urlPatterns: ['/magazine/', '/culture/', '/podcast/', '/humor/', '/books/', '/business/', '/tech/', '/politics/'],
    extractBody: extractNewYorkerBody
  },
  // Future: Add more sources
  // atlantic: {
  //   name: 'The Atlantic',
  //   sitemaps: ['https://www.theatlantic.com/sitemap.xml'],
  //   urlPatterns: ['/articles/', '/magazine/', '/culture/', '/politics/'],
  //   extractBody: extractAtlanticBody
  // }
};

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'mejoresnoticias-scraper/1.0 (+https://example.com)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
  });

  if (!res.ok) {
    throw new Error(`Request failed for ${url} with status ${res.status}`);
  }

  return await res.text();
}

function parseSitemapXml(xml) {
  const parser = new XMLParser({ ignoreAttributes: false });
  const data = parser.parse(xml);

  if (!data) return [];

  const urlset = data.urlset || data.urlSet;
  if (!urlset || !urlset.url) return [];

  const items = Array.isArray(urlset.url) ? urlset.url : [urlset.url];

  return items
    .map((u) => {
      const loc = u.loc;
      const lastmod = u.lastmod || u.lastModified || null;
      return loc ? { loc, lastmod } : null;
    })
    .filter(Boolean);
}

async function collectNewsUrls(sourceKey) {
  const source = NEWS_SOURCES[sourceKey];
  const all = [];

  for (const sitemapUrl of source.sitemaps) {
    try {
      const xml = await fetchText(sitemapUrl);
      const entries = parseSitemapXml(xml);
      
      for (const e of entries) {
        if (e.loc && source.urlPatterns.some(pattern => e.loc.includes(pattern))) {
          all.push({
            ...e,
            source: sourceKey,
            sourceName: source.name
          });
        }
      }
    } catch (err) {
      console.error(`Failed to process sitemap ${sitemapUrl}:`, err.message);
    }
  }

  // Deduplicate URLs
  const dedupedMap = new Map();
  for (const e of all) {
    if (!dedupedMap.has(e.loc)) {
      dedupedMap.set(e.loc, e);
    }
  }

  return Array.from(dedupedMap.values());
}

function extractNewYorkerBody($) {
  let bodyText = '';
  
  const selectors = [
    'article .article-content p',
    'article .content p', 
    '.article-body p',
    '.story-body p',
    '[data-testid="article-body"] p',
    '.paragraph-text',
    'article p'
  ];
  
  for (const selector of selectors) {
    const paragraphs = $(selector);
    if (paragraphs.length > 0) {
      bodyText = paragraphs.map((_, el) => $(el).text().trim()).get().join('\n\n');
      if (bodyText.length > 100) break;
    }
  }
  
  bodyText = bodyText
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n\n')
    .trim();
  
  const isPaywallText = bodyText.toLowerCase().includes('subscribe') && 
                       bodyText.toLowerCase().includes('new yorker') &&
                       bodyText.length < 500;
  
  const bodyAvailable = bodyText.length > 200 && !isPaywallText;
  
  return {
    bodyText: bodyAvailable ? bodyText : null,
    bodyAvailable
  };
}

function pickJsonLdArticle(json) {
  if (!json) return null;

  if (Array.isArray(json)) {
    for (const item of json) {
      const picked = pickJsonLdArticle(item);
      if (picked) return picked;
    }
    return null;
  }

  if (typeof json === 'object') {
    if (json['@type'] === 'NewsArticle' || json['@type'] === 'Article') {
      return json;
    }

    const graph = json['@graph'];
    if (Array.isArray(graph)) {
      for (const item of graph) {
        const picked = pickJsonLdArticle(item);
        if (picked) return picked;
      }
    }
  }

  return null;
}

function extractFromJsonLd(jsonLd) {
  if (!jsonLd || typeof jsonLd !== 'object') return {};

  const title = jsonLd.headline || jsonLd.name || null;
  const description = jsonLd.description || null;
  const image = (Array.isArray(jsonLd.image) ? jsonLd.image[0] : jsonLd.image) || null;
  const datePublished = jsonLd.datePublished || jsonLd.dateCreated || null;

  return { title, description, imageUrl: image, publishedAt: datePublished };
}

function extractFromMeta($) {
  const title = $('meta[property="og:title"]').attr('content') ||
                $('meta[name="twitter:title"]').attr('content') ||
                $('title').text() || null;

  const description = $('meta[property="og:description"]').attr('content') ||
                      $('meta[name="description"]').attr('content') || null;

  const imageUrl = $('meta[property="og:image"]').attr('content') ||
                   $('meta[name="twitter:image"]').attr('content') || null;

  return { title, description, imageUrl, publishedAt: null };
}

async function scrapeArticle(url, sourceKey) {
  const html = await fetchText(url);
  const $ = cheerio.load(html);

  let jsonLdRaw = null;
  let jsonLdArticle = null;

  $('script[type="application/ld+json"]').each((_, el) => {
    const text = $(el).contents().text().trim();
    if (!text) return;

    try {
      const parsed = JSON.parse(text);
      const candidate = pickJsonLdArticle(parsed);
      if (candidate && !jsonLdArticle) {
        jsonLdArticle = candidate;
        jsonLdRaw = text;
      }
    } catch (err) {
      // ignore JSON parse errors
    }
  });

  const fromLd = extractFromJsonLd(jsonLdArticle);
  const fromMeta = extractFromMeta($);
  const fromBody = NEWS_SOURCES[sourceKey].extractBody($);

  const title = fromLd.title || fromMeta.title;
  const description = fromLd.description || fromMeta.description;
  const imageUrl = fromLd.imageUrl || fromMeta.imageUrl;
  const publishedAt = fromLd.publishedAt || fromMeta.publishedAt;

  return {
    url,
    source: sourceKey,
    sourceName: NEWS_SOURCES[sourceKey].name,
    title,
    description,
    imageUrl,
    bodyText: fromBody.bodyText,
    bodyAvailable: fromBody.bodyAvailable,
    publishedAt: publishedAt ? new Date(publishedAt) : null,
    scrapedAt: new Date(),
    rawJsonLd: jsonLdRaw
  };
}

async function scrapeAllSources(options = {}) {
  const limit = options.limit || 50;
  const sources = options.sources || Object.keys(NEWS_SOURCES);
  
  const allResults = [];

  for (const sourceKey of sources) {
    try {
      console.log(`Scraping ${NEWS_SOURCES[sourceKey].name}...`);
      
      const entries = await collectNewsUrls(sourceKey);
      
      entries.sort((a, b) => {
        if (a.lastmod && b.lastmod) {
          return new Date(b.lastmod) - new Date(a.lastmod);
        }
        if (a.lastmod) return -1;
        if (b.lastmod) return 1;
        return 0;
      });

      const selected = entries.slice(0, Math.ceil(limit / sources.length));

      for (const entry of selected) {
        try {
          const article = await scrapeArticle(entry.loc, sourceKey);
          allResults.push(article);
        } catch (err) {
          console.error(`Failed to scrape article ${entry.loc}:`, err.message);
        }
      }
      
      console.log(`Completed ${NEWS_SOURCES[sourceKey].name}: ${allResults.filter(a => a.source === sourceKey).length} articles`);
    } catch (err) {
      console.error(`Failed to process ${NEWS_SOURCES[sourceKey].name}:`, err.message);
    }
  }

  return allResults;
}

module.exports = {
  scrapeAllSources,
  NEWS_SOURCES
};
