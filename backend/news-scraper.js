const axios = require('axios');
const db = require('./database');
const NaturalLanguageProcessing = require('natural');
const redditScraper = require('./reddit-scraper');

const NEWSAPI_BASE = 'https://newsapi.org/v2';
const MARKETAUX_BASE = 'https://api.marketaux.com/v1/news/all';

function getNewsApiKey() {
  return process.env.NEWS_API_KEY;
}

function getMarketauxApiKey() {
  return process.env.MARKETAUX_API_KEY;
}

// Simple sentiment analysis
function analyzeSentiment(text) {
  if (!text) return 'neutral';
  
  const positiveWords = ['bullish', 'surge', 'gain', 'rally', 'soar', 'profit', 'beat', 'strong', 'growth'];
  const negativeWords = ['bearish', 'drop', 'loss', 'decline', 'crash', 'fall', 'miss', 'weak', 'risk'];
  
  const lowerText = text.toLowerCase();
  let positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;
  let negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;
  
  if (positiveCount > negativeCount) return 'positive';
  if (negativeCount > positiveCount) return 'negative';
  return 'neutral';
}

function normalizePublishedAt(value) {
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) {
    return Math.floor(Date.now() / 1000);
  }
  return Math.floor(parsed / 1000);
}

async function scrapeNewsForTicker(ticker) {
  const normalizedTicker = String(ticker || '').toUpperCase();

  const fetchNewsApiArticles = async () => {
    const newsApiKey = getNewsApiKey();
    if (!newsApiKey) {
      return [];
    }

    try {
      const response = await axios.get(`${NEWSAPI_BASE}/everything`, {
        params: {
          q: normalizedTicker,
          sortBy: 'publishedAt',
          language: 'en',
          pageSize: 20,
          apiKey: newsApiKey
        },
        timeout: 12000
      });

      return (response.data.articles || []).map((article) => ({
        title: article.title,
        description: article.description,
        content: article.content,
        source: article.source?.name || 'newsapi',
        url: article.url,
        publishedAt: article.publishedAt
      }));
    } catch (error) {
      console.error(`Error fetching NewsAPI articles for ${normalizedTicker}:`, error.message);
      return [];
    }
  };

  const fetchMarketauxArticles = async () => {
    const marketauxKey = getMarketauxApiKey();
    if (!marketauxKey) {
      return [];
    }

    try {
      const response = await axios.get(MARKETAUX_BASE, {
        params: {
          symbols: normalizedTicker,
          language: 'en',
          limit: 20,
          filter_entities: true,
          api_token: marketauxKey
        },
        timeout: 12000
      });

      return (response.data?.data || []).map((article) => {
        const sourceName = article.source || article.domain || 'marketaux';
        const snippets = [
          article.title,
          article.description,
          article.snippet
        ].filter(Boolean).join(' ');

        return {
          title: article.title,
          description: article.description || article.snippet || null,
          content: snippets || null,
          source: sourceName,
          url: article.url,
          publishedAt: article.published_at || article.publishedAt
        };
      });
    } catch (error) {
      console.error(`Error fetching Marketaux articles for ${normalizedTicker}:`, error.message);
      return [];
    }
  };

  try {
    const [newsApiArticles, marketauxArticles] = await Promise.all([
      fetchNewsApiArticles(),
      fetchMarketauxArticles()
    ]);
    const mergedArticles = [...newsApiArticles, ...marketauxArticles]
      .filter((article) => article && article.url && article.title);
    const uniqueArticles = [];
    const seenUrls = new Set();
    for (const article of mergedArticles) {
      const url = String(article.url);
      if (seenUrls.has(url)) {
        continue;
      }
      seenUrls.add(url);
      uniqueArticles.push(article);
    }

    const savedArticles = [];

    for (const article of uniqueArticles) {
      const sentiment = analyzeSentiment(
        `${article.title} ${article.description} ${article.content}`
      );

      try {
        const result = await db.run(
          `INSERT INTO news (ticker, title, description, content, source, url, published_at, sentiment)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(url) DO UPDATE SET scraped_at = strftime('%s', 'now')`,
          [
            normalizedTicker,
            article.title,
            article.description,
            article.content,
            article.source,
            article.url,
            normalizePublishedAt(article.publishedAt),
            sentiment
          ]
        );
        
        savedArticles.push({
          id: result.id,
          title: article.title,
          source: article.source,
          sentiment,
          url: article.url
        });
      } catch (insertError) {
        // Article already exists, just update the scraped_at
      }
    }

    return {
      ticker: normalizedTicker,
      articlesFound: uniqueArticles.length,
      articlesSaved: savedArticles.length,
      articles: savedArticles
    };
  } catch (error) {
    console.error(`Error scraping news for ${normalizedTicker}:`, error.message);
    return {
      ticker: normalizedTicker,
      error: error.message,
      articlesFound: 0,
      articlesSaved: 0,
      articles: []
    };
  }
}

async function scrapeAllNews(tickers) {
  console.log(`Starting news and Reddit scrape for tickers: ${tickers.join(', ')}`);
  const results = [];

  for (const ticker of tickers) {
    const result = await scrapeNewsForTicker(ticker);
    results.push(result);
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Also scrape Reddit
  console.log('Starting Reddit scrape...');
  try {
    await redditScraper.scrapeAllTickers(tickers);
    console.log('✓ Reddit scrape completed');
  } catch (error) {
    console.error('Error during Reddit scrape:', error.message);
  }

  return results;
}

async function getRelevantNews(ticker, limit = 10) {
  try {
    const news = await db.all(
      `SELECT * FROM news 
       WHERE ticker = ? 
       ORDER BY published_at DESC, relevance_score DESC
       LIMIT ?`,
      [ticker, limit]
    );
    return news;
  } catch (error) {
    console.error('Error fetching news:', error);
    return [];
  }
}

async function updateNewsRelevance(newsId, isHelpful) {
  try {
    await db.run(
      `UPDATE news SET is_helpful = ? WHERE id = ?`,
      [isHelpful ? 1 : 0, newsId]
    );
  } catch (error) {
    console.error('Error updating news helpfulness:', error);
  }
}

module.exports = {
  scrapeNewsForTicker,
  scrapeAllNews,
  getRelevantNews,
  updateNewsRelevance,
  analyzeSentiment
};
