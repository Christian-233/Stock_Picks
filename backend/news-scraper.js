const axios = require('axios');
const db = require('./database');
const NaturalLanguageProcessing = require('natural');
const redditScraper = require('./reddit-scraper');

const NEWSAPI_BASE = 'https://newsapi.org/v2';

function getNewsApiKey() {
  return process.env.NEWS_API_KEY;
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

async function scrapeNewsForTicker(ticker) {
  try {
    const response = await axios.get(`${NEWSAPI_BASE}/everything`, {
      params: {
        q: ticker,
        sortBy: 'publishedAt',
        language: 'en',
        pageSize: 20,
        apiKey: getNewsApiKey()
      }
    });

    const articles = response.data.articles || [];
    const savedArticles = [];

    for (const article of articles) {
      const sentiment = analyzeSentiment(
        `${article.title} ${article.description} ${article.content}`
      );

      try {
        const result = await db.run(
          `INSERT INTO news (ticker, title, description, content, source, url, published_at, sentiment)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(url) DO UPDATE SET scraped_at = strftime('%s', 'now')`,
          [
            ticker,
            article.title,
            article.description,
            article.content,
            article.source.name,
            article.url,
            Math.floor(new Date(article.publishedAt).getTime() / 1000),
            sentiment
          ]
        );
        
        savedArticles.push({
          id: result.id,
          title: article.title,
          source: article.source.name,
          sentiment,
          url: article.url
        });
      } catch (insertError) {
        // Article already exists, just update the scraped_at
      }
    }

    return {
      ticker,
      articlesFound: articles.length,
      articlesSaved: savedArticles.length,
      articles: savedArticles
    };
  } catch (error) {
    console.error(`Error scraping news for ${ticker}:`, error.message);
    return {
      ticker,
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
