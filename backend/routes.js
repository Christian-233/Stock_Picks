const express = require('express');
const router = express.Router();
const db = require('./database');
const aiPredictor = require('./ai-predictor');
const newsScraper = require('./news-scraper');
const stockData = require('./stock-data');

// Get all current predictions
router.get('/predictions', async (req, res) => {
  try {
    const predictions = await db.all(
      `SELECT * FROM predictions ORDER BY created_at DESC`
    );
    
    const formattedPredictions = predictions.map(p => ({
      ...p,
      target_dates: JSON.parse(p.target_dates),
      predicted_prices: JSON.parse(p.predicted_prices),
      confidence_scores: JSON.parse(p.confidence_scores),
      price_ranges: p.price_ranges ? JSON.parse(p.price_ranges) : null,
      algorithm_weights: JSON.parse(p.algorithm_weights)
    }));

    res.json(formattedPredictions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get prediction for specific ticker
router.get('/predictions/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    const predictions = await db.all(
      `SELECT * FROM predictions WHERE ticker = ? ORDER BY created_at DESC`,
      [ticker.toUpperCase()]
    );

    const formattedPredictions = predictions.map(p => ({
      ...p,
      target_dates: JSON.parse(p.target_dates),
      predicted_prices: JSON.parse(p.predicted_prices),
      confidence_scores: JSON.parse(p.confidence_scores),
      price_ranges: p.price_ranges ? JSON.parse(p.price_ranges) : null,
      algorithm_weights: JSON.parse(p.algorithm_weights)
    }));

    res.json(formattedPredictions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate predictions for provided tickers
router.post('/predict', async (req, res) => {
  try {
    const { tickers } = req.body;
    
    if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
      return res.status(400).json({ error: 'Provide array of ticker symbols' });
    }

    console.log(`Generating predictions for tickers: ${tickers.join(', ')}`);
    const predictions = await aiPredictor.generateMondayPredictions(tickers);
    
    if (!predictions || predictions.length === 0) {
      return res.status(500).json({ 
        error: 'Failed to generate predictions. Check backend logs for details.',
        success: false 
      });
    }
    
    res.json({ success: true, predictions });
  } catch (error) {
    console.error('Error in /predict endpoint:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to generate predictions',
      success: false,
      details: error.toString()
    });
  }
});

// Get news for ticker
router.get('/news/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    
    const news = await db.all(
      `SELECT * FROM news 
       WHERE ticker = ? 
       ORDER BY published_at DESC, relevance_score DESC
       LIMIT ?`,
      [ticker.toUpperCase(), limit]
    );

    res.json(news);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update news helpfulness
router.patch('/news/:id/helpful', async (req, res) => {
  try {
    const { id } = req.params;
    const { isHelpful } = req.body;

    await newsScraper.updateNewsRelevance(id, isHelpful);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Scrape news for tickers
router.post('/scrape-news', async (req, res) => {
  try {
    const { tickers } = req.body;
    
    if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
      return res.status(400).json({ error: 'Provide array of ticker symbols' });
    }

    const results = await newsScraper.scrapeAllNews(
      tickers.map(t => t.toUpperCase())
    );
    
    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get stock price
router.get('/stock/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    const price = await stockData.getStockPrice(ticker.toUpperCase());
    
    if (!price) {
      return res.status(404).json({ error: 'Could not fetch price' });
    }

    res.json(price);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get accuracy history
router.get('/accuracy/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    
    const accuracy = await db.all(
      `SELECT * FROM accuracy_checks 
       WHERE ticker = ?
       ORDER BY checked_at DESC`,
      [ticker.toUpperCase()]
    );

    // Calculate accuracy rate
    const totalChecks = accuracy.length;
    const correctChecks = accuracy.filter(a => a.was_correct).length;
    const accuracyRate = totalChecks > 0 ? (correctChecks / totalChecks) * 100 : 0;

    res.json({
      ticker,
      totalChecks,
      correctChecks,
      accuracyRate: Math.round(accuracyRate * 100) / 100,
      checks: accuracy
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get weights history
router.get('/weights/history', async (req, res) => {
  try {
    const { ticker } = req.query;
    
    let query = `SELECT * FROM weights_history ORDER BY week_number DESC, year DESC`;
    let params = [];

    if (ticker) {
      query = `SELECT * FROM weights_history WHERE ticker = ? ORDER BY week_number DESC, year DESC`;
      params = [ticker.toUpperCase()];
    }

    const weights = await db.all(query, params);
    res.json(weights);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update algorithm weights
router.post('/weights/update', async (req, res) => {
  try {
    const { weights } = req.body;
    
    if (!weights) {
      return res.status(400).json({ error: 'Provide weights object' });
    }

    aiPredictor.updateWeights(weights, Math.ceil(new Date().getDate() / 7), new Date().getFullYear());
    res.json({ success: true, weights });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get algorithm details
router.get('/algorithm/details', async (req, res) => {
  try {
    const currentWeek = Math.ceil(new Date().getDate() / 7);
    const currentYear = new Date().getFullYear();
    const weights = aiPredictor.getWeightsForWeek(currentWeek, currentYear);

    res.json({
      week: currentWeek,
      year: currentYear,
      weights,
      description: {
        sentiment: 'Sentiment analysis of news articles (positive/negative/neutral)',
        volume: 'Trading volume compared to average',
        volatility: 'Historical volatility of the stock',
        newsFrequency: 'Number of news articles in the past week',
        analystRating: 'Average analyst rating'
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/suggested-stocks', async (req, res) => {
  try {
    // For now, return popular tech stocks that are frequently discussed
    // In production, this could analyze Reddit trends, news volume, etc.
    const suggestedStocks = ['NVDA', 'META', 'NFLX', 'AMD', 'TSLA', 'GOOGL'];
    
    // Shuffle and return 3 random ones
    const shuffled = suggestedStocks.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 3);
    
    res.json({ suggestedStocks: selected });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get data source status
router.get('/data-sources', (req, res) => {
  try {
    const status = stockData.getDataSourceStatus();
    res.json({
      dataSourceStatus: status,
      message: 'Data sources available and their status. See DATA_SOURCES_SETUP.md for setup instructions.',
      setup: {
        yahooFinance: 'Enabled by default - no setup needed',
        finnhub: 'Optional - requires API key from https://finnhub.io/register',
        alphaVantage: 'Optional - requires API key from https://www.alphavantage.co',
        fallback: 'Mock data used if all sources unavailable'
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint - test all data sources and APIs
router.get('/health-check', async (req, res) => {
  const results = {
    timestamp: new Date().toISOString(),
    status: 'checking',
    sources: {}
  };

  // Test Yahoo Finance
  try {
    const yahooPrice = await stockData.getYahooFinancePrice('AAPL');
    if (yahooPrice) {
      results.sources.yahooFinance = {
        status: 'working',
        price: yahooPrice.price,
        timestamp: new Date().toLocaleString(),
        message: '✓ Yahoo Finance is working'
      };
    } else {
      results.sources.yahooFinance = {
        status: 'failed',
        message: 'Yahoo Finance returned null'
      };
    }
  } catch (error) {
    results.sources.yahooFinance = {
      status: 'error',
      error: error.message,
      message: '✗ Yahoo Finance error'
    };
  }

  // Test Finnhub
  try {
    const finnhubPrice = await stockData.getFinnhubPrice('AAPL');
    if (finnhubPrice) {
      results.sources.finnhub = {
        status: 'working',
        price: finnhubPrice.price,
        timestamp: new Date().toLocaleString(),
        message: '✓ Finnhub is working'
      };
    } else {
      results.sources.finnhub = {
        status: 'nokey',
        message: '⚠ Finnhub: API key not configured'
      };
    }
  } catch (error) {
    results.sources.finnhub = {
      status: 'error',
      error: error.message,
      message: '✗ Finnhub error'
    };
  }

  // Test Alpha Vantage
  try {
    const avPrice = await stockData.getAlphaVantagePrice('AAPL');
    if (avPrice) {
      results.sources.alphaVantage = {
        status: 'working',
        price: avPrice.price,
        timestamp: new Date().toLocaleString(),
        message: '✓ Alpha Vantage is working'
      };
    } else {
      results.sources.alphaVantage = {
        status: 'nokey',
        message: '⚠ Alpha Vantage: API key not configured or rate limit reached'
      };
    }
  } catch (error) {
    results.sources.alphaVantage = {
      status: 'error',
      error: error.message,
      message: '✗ Alpha Vantage error'
    };
  }

  // Test News API
  try {
    const axios = require('axios');
    const newsApiKey = process.env.NEWS_API_KEY;
    
    if (!newsApiKey) {
      results.sources.newsAPI = {
        status: 'nokey',
        message: '⚠ News API: API key not configured'
      };
    } else {
      const response = await axios.get('https://newsapi.org/v2/everything', {
        q: 'stock',
        sortBy: 'publishedAt',
        language: 'en',
        pageSize: 1,
        apiKey: newsApiKey
      });

      if (response.status === 200) {
        results.sources.newsAPI = {
          status: 'working',
          articlesFound: response.data.totalResults || 0,
          timestamp: new Date().toLocaleString(),
          message: `✓ News API is working (${response.data.totalResults || 0} articles available)`
        };
      } else {
        results.sources.newsAPI = {
          status: 'failed',
          message: 'News API returned non-200 status'
        };
      }
    }
  } catch (error) {
    if (error.response && error.response.status === 401) {
      results.sources.newsAPI = {
        status: 'unauthorized',
        error: 'Invalid API key',
        message: '✗ News API: Unauthorized (invalid key)'
      };
    } else {
      results.sources.newsAPI = {
        status: 'error',
        error: error.message,
        message: '✗ News API error'
      };
    }
  }

  // Summary
  const workingCount = Object.values(results.sources).filter(s => s.status === 'working').length;
  const totalCount = Object.keys(results.sources).length;
  
  results.summary = {
    working: workingCount,
    total: totalCount,
    overallStatus: workingCount > 0 ? 'partial' : 'all_failed',
    message: workingCount === totalCount 
      ? '✓ All APIs working!' 
      : workingCount > 0 
        ? `⚠ ${workingCount}/${totalCount} APIs working`
        : '✗ No APIs working'
  };

  res.json(results);
});

module.exports = router;
