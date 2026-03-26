const db = require('./database');
const newsScraper = require('./news-scraper');
const stockData = require('./stock-data');

// Weights for the algorithm
let currentWeights = {
  sentiment: 0.25,
  volume: 0.15,
  volatility: 0.20,
  newsFrequency: 0.20,
  analystRating: 0.20
};

function getWeightsForWeek(weekNumber, year) {
  // In production, these would be retrieved from the database
  // For now, returning current weights
  return currentWeights;
}

function updateWeights(newWeights, weekNumber, year) {
  // Store weights in database
  currentWeights = newWeights;
  // Save to database (optional)
  console.log(`Weights updated for week ${weekNumber}, year ${year}:`, newWeights);
}

async function analyzeSentiment(ticker) {
  try {
    const news = await db.all(
      `SELECT sentiment FROM news 
       WHERE ticker = ? AND published_at > ?
       ORDER BY published_at DESC
       LIMIT 20`,
      [ticker, Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60] // Last 7 days
    );

    if (news.length === 0) return 0;

    const sentimentMap = { positive: 1, neutral: 0, negative: -1 };
    const average = news.reduce((sum, item) => sum + (sentimentMap[item.sentiment] || 0), 0) / news.length;
    
    return (average + 1) / 2; // Normalize to 0-1 range
  } catch (error) {
    console.error('Error analyzing sentiment:', error);
    return 0.5;
  }
}

async function analyzeNewsFrequency(ticker) {
  try {
    const count = await db.get(
      `SELECT COUNT(*) as count FROM news 
       WHERE ticker = ? AND published_at > ?`,
      [ticker, Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60]
    );

    // Normalize news count (max 50 articles per week considered as 1.0)
    return Math.min((count?.count || 0) / 50, 1.0);
  } catch (error) {
    console.error('Error analyzing news frequency:', error);
    return 0.5;
  }
}

async function predictStockPrice(ticker, targetDate) {
  try {
    // Get current stock price
    const currentPrice = await stockData.getStockPrice(ticker);
    if (!currentPrice) throw new Error(`Could not get price for ${ticker}`);

    // Get market factors - now using 1-year historical data
    const sentiment = await analyzeSentiment(ticker);
    const newsFrequency = await analyzeNewsFrequency(ticker);
    
    // Calculate volatility from 1 year of historical data
    const volatility = await stockData.calculateVolatilityFromHistory(ticker, 365);
    
    // Calculate trend from 1 year of historical data
    const trend = await stockData.calculateTrendFromHistory(ticker, 365);
    
    // Adjusted analyst rating based on recent trend
    const baseAnalystRating = 0.6 + Math.random() * 0.3;
    const trendAdjustedRating = Math.max(Math.min(baseAnalystRating + (trend * 0.2), 1), 0);
    
    // Mock trading volume ratio
    const volumeRatio = 0.8 + Math.random() * 0.3;

    // Get current weights
    const weights = getWeightsForWeek(
      Math.ceil(new Date().getDate() / 7),
      new Date().getFullYear()
    );

    // Calculate weighted score
    const score =
      (sentiment * weights.sentiment) +
      (volumeRatio * weights.volume) +
      ((1 - volatility) * weights.volatility) +
      (newsFrequency * weights.newsFrequency) +
      (trendAdjustedRating * weights.analystRating);

    // Calculate predicted price based on score, trend, and days until target
    const daysUntilTarget = Math.ceil((targetDate * 1000 - Date.now()) / (24 * 60 * 60 * 1000));
    
    // Expected return: base on trend, adjusted by sentiment and analyst rating
    const trendComponent = trend * 0.10; // Historical trend up to ±10%
    const sentimentComponent = (sentiment - 0.5) * 0.08; // Sentiment ±8%
    const scoreComponent = (score - 0.5) * 0.10; // Score ±10%
    const expectedReturn = trendComponent + sentimentComponent + scoreComponent;
    
    const midPrice = currentPrice.price * (1 + expectedReturn);

    // Generate price range (low, mid, high)
    const volatilityAdjustment = Math.max(volatility, 0.05); // Minimum 5% adjustment
    
    // LOW: Slightly below current price, based on volatility (minimum 95% of current price)
    const lowPrice = currentPrice.price * Math.max(1 - volatilityAdjustment, 0.95);
    
    // MID: Base predicted price
    const highPrice = midPrice * 1.05; // High is 5% above mid for upside potential

    // Base confidence from score
    const baseConfidence = Math.min(Math.max(score * 0.8 + 0.2, 0.3), 0.95);
    
    // Confidence for each price level (higher confidence for high price due to upside)
    const priceRange = {
      low: Math.round(lowPrice * 100) / 100,
      mid: Math.round(midPrice * 100) / 100,
      high: Math.round(highPrice * 100) / 100,
      confidences: {
        low: Math.round(baseConfidence * 0.7 * 100) / 100,      // 70% of base for conservative
        mid: Math.round(baseConfidence * 100) / 100,             // Full confidence for middle
        high: Math.round(baseConfidence * 0.85 * 100) / 100      // 85% of base for optimistic
      }
    };

    return {
      ticker,
      currentPrice: currentPrice.price,
      priceRange: priceRange,
      predictedPrice: Math.round(midPrice * 100) / 100, // Keep for backward compatibility
      confidence: Math.round(baseConfidence * 100) / 100,
      factors: {
        sentiment: Math.round(sentiment * 100),
        newsFrequency: Math.round(newsFrequency * 100),
        volatility: Math.round(volatility * 100),
        analystRating: Math.round(analystRating * 100),
        volumeRatio: Math.round(volumeRatio * 100)
      },
      weights,
      daysUntilTarget
    };
  } catch (error) {
    console.error(`Error predicting price for ${ticker}:`, error);
    return null;
  }
}

async function generateMondayPredictions(tickers) {
  try {
    console.log('Generating Monday predictions for tickers:', tickers);
    
    // Get Wednesday and Friday of this week
    const today = new Date();
    const dayOfWeek = today.getDay();
    
    // Calculate Wednesday (day 3) and Friday (day 5)
    const daysUntilWednesday = (3 - dayOfWeek + 7) % 7 || 7;
    const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;
    
    const wednesdayDate = new Date(today);
    wednesdayDate.setDate(wednesdayDate.getDate() + daysUntilWednesday);
    wednesdayDate.setHours(16, 0, 0, 0); // Market close
    
    const fridayDate = new Date(today);
    fridayDate.setDate(fridayDate.getDate() + daysUntilFriday);
    fridayDate.setHours(16, 0, 0, 0); // Market close

    const wednesdayTimestamp = Math.floor(wednesdayDate.getTime() / 1000);
    const fridayTimestamp = Math.floor(fridayDate.getTime() / 1000);

    console.log(`Wednesday: ${new Date(wednesdayTimestamp * 1000)}, Friday: ${new Date(fridayTimestamp * 1000)}`);

    const predictions = [];

    for (const ticker of tickers) {
      try {
        const wednesdayPrediction = await predictStockPrice(ticker, wednesdayTimestamp);
        const fridayPrediction = await predictStockPrice(ticker, fridayTimestamp);

        if (!wednesdayPrediction || !fridayPrediction) {
          console.warn(`Could not generate predictions for ${ticker}`);
          continue;
        }

        // Get news summary
        const news = await db.all(
          `SELECT title FROM news 
           WHERE ticker = ? AND published_at > ?
           ORDER BY published_at DESC
           LIMIT 5`,
          [ticker, Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60]
        );

        const newsSummary = news.map(n => n.title).join('\n');

        // Store prediction in database
        const predictionData = {
          ticker,
          wednesdayPrice: wednesdayPrediction.predictedPrice,
          fridayPrice: fridayPrediction.predictedPrice,
          wednesdayConfidence: wednesdayPrediction.confidence,
          fridayConfidence: fridayPrediction.confidence,
          factors: wednesdayPrediction.factors,
          newsSummary,
          weights: JSON.stringify(wednesdayPrediction.weights)
        };

        // Save to database
        await db.run(
          `INSERT INTO predictions (ticker, prediction_date, target_dates, predicted_prices, confidence_scores, price_ranges, news_summary, algorithm_weights)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            ticker,
            Math.floor(Date.now() / 1000),
            JSON.stringify([wednesdayTimestamp, fridayTimestamp]),
            JSON.stringify([wednesdayPrediction.predictedPrice, fridayPrediction.predictedPrice]),
            JSON.stringify([wednesdayPrediction.confidence, fridayPrediction.confidence]),
            JSON.stringify([wednesdayPrediction.priceRange, fridayPrediction.priceRange]),
            newsSummary,
            JSON.stringify(wednesdayPrediction.weights)
          ]
        );

        console.log(`✓ Prediction generated for ${ticker}`);
        predictions.push(predictionData);
      } catch (tickerError) {
        console.error(`Error generating prediction for ${ticker}:`, tickerError);
      }
    }

    if (predictions.length === 0) {
      throw new Error('No predictions could be generated. Check that tickers are valid and news data exists.');
    }

    return predictions;
  } catch (error) {
    console.error('Error generating predictions:', error);
    throw error;
  }
}

async function checkAccuracy(ticker, targetDate) {
  try {
    // Get the prediction for this ticker and target date
    const prediction = await db.get(
      `SELECT * FROM predictions WHERE ticker = ? AND json_extract(target_dates, '$[0]') = ? OR json_extract(target_dates, '$[1]') = ?`,
      [ticker, targetDate, targetDate]
    );

    if (!prediction) {
      return { error: 'No prediction found for this date' };
    }

    // Get current stock price
    const currentPrice = await stockData.getStockPrice(ticker);
    if (!currentPrice) throw new Error(`Could not get price for ${ticker}`);

    const targetDates = JSON.parse(prediction.target_dates);
    const predictedPrices = JSON.parse(prediction.predicted_prices);
    const targetIndex = targetDates.indexOf(targetDate);

    if (targetIndex === -1) {
      return { error: 'Target date not found in prediction' };
    }

    const predictedPrice = predictedPrices[targetIndex];
    const wasCorrect = currentPrice.price >= predictedPrice;

    // Store accuracy result
    await db.run(
      `INSERT INTO accuracy_checks (ticker, prediction_id, target_date, predicted_price, actual_price, was_correct)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [ticker, prediction.id, targetDate, predictedPrice, currentPrice.price, wasCorrect ? 1 : 0]
    );

    return {
      ticker,
      targetDate: new Date(targetDate * 1000).toISOString().split('T')[0],
      predictedPrice,
      actualPrice: currentPrice.price,
      wasCorrect,
      difference: Math.round((currentPrice.price - predictedPrice) * 100) / 100
    };
  } catch (error) {
    console.error('Error checking accuracy:', error);
    return { error: error.message };
  }
}

module.exports = {
  predictStockPrice,
  generateMondayPredictions,
  checkAccuracy,
  getWeightsForWeek,
  updateWeights,
  analyzeSentiment,
  analyzeNewsFrequency
};
