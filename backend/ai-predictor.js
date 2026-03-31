const db = require('./database');
const newsScraper = require('./news-scraper');
const stockData = require('./stock-data');
const technicalIndicators = require('./technical-indicators');
const llmService = require('./llm-service');
const {
  normalizePriceHistory,
  summarizeHistoricalMetrics,
  summarizeBenchmarkMetrics,
  summarizeNewsMetrics,
  summarizeCalibrationMetrics,
  createDeterministicForecast,
  roundPrice,
  clamp
} = require('./prediction-math');
const { FEATURE_ORDER, predictThresholdReturn, trainThresholdModel } = require('./ml-model');

const THREE_YEARS_SECONDS = 3 * 365 * 24 * 60 * 60;
const TRAINING_RECENCY_HALF_LIFE_DAYS = 180;
const MIN_GLOBAL_TRAINING_EXAMPLES = 24;
const MIN_CLASS_TRAINING_EXAMPLES = 12;
const MIN_GLOBAL_UNIQUE_TICKERS = 4;
const MIN_CLASS_UNIQUE_TICKERS = 3;

let currentWeights = {
  historicalTrend: 0.32,
  technicalSignals: 0.24,
  newsSentiment: 0.18,
  redditSentiment: 0.1,
  volatilityControl: 0.08,
  calibrationAdjustment: 0.08
};
const baseAdaptiveWeights = {
  ...currentWeights
};

let cachedModels = {
  wednesday: null,
  friday: null
};
let selfTrainingState = {
  running: false,
  startedAt: null,
  finishedAt: null,
  lastRun: null,
  lastResult: null,
  lastError: null
};

function getCurrentWeekContext() {
  return {
    weekNumber: Math.ceil(new Date().getDate() / 7),
    year: new Date().getFullYear()
  };
}

async function persistWeightsSnapshot(ticker = null) {
  const { weekNumber, year } = getCurrentWeekContext();
  await db.run(
    `INSERT INTO weights_history (
      week_number, year, ticker,
      weight_sentiment, weight_volume, weight_volatility, weight_news_frequency, weight_analyst_rating
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(week_number, year, ticker) DO UPDATE SET
      weight_sentiment = excluded.weight_sentiment,
      weight_volume = excluded.weight_volume,
      weight_volatility = excluded.weight_volatility,
      weight_news_frequency = excluded.weight_news_frequency,
      weight_analyst_rating = excluded.weight_analyst_rating,
      updated_at = strftime('%s', 'now')`,
    [
      weekNumber,
      year,
      ticker,
      currentWeights.historicalTrend,
      currentWeights.technicalSignals,
      currentWeights.volatilityControl,
      currentWeights.newsSentiment,
      currentWeights.redditSentiment + currentWeights.calibrationAdjustment
    ]
  );
}

function getWeightsForWeek() {
  return currentWeights;
}

function updateWeights(newWeights) {
  currentWeights = {
    ...currentWeights,
    ...newWeights
  };
}

function normalizeWeights(weights = {}) {
  const safe = {
    historicalTrend: Math.max(0.01, Number(weights.historicalTrend || 0)),
    technicalSignals: Math.max(0.01, Number(weights.technicalSignals || 0)),
    newsSentiment: Math.max(0.01, Number(weights.newsSentiment || 0)),
    redditSentiment: Math.max(0.01, Number(weights.redditSentiment || 0)),
    volatilityControl: Math.max(0.01, Number(weights.volatilityControl || 0)),
    calibrationAdjustment: Math.max(0.01, Number(weights.calibrationAdjustment || 0))
  };
  const total = Object.values(safe).reduce((sum, value) => sum + value, 0) || 1;

  return Object.fromEntries(
    Object.entries(safe).map(([key, value]) => [key, roundPrice(value / total)])
  );
}

function getDirectionalSign(value) {
  const numeric = Number(value || 0);
  if (numeric > 0) {
    return 1;
  }
  if (numeric < 0) {
    return -1;
  }
  return 0;
}

async function getRecentArticles(ticker) {
  return db.all(
    `SELECT title, description, content, source, sentiment, published_at, relevance_score, is_helpful
     FROM news
     WHERE ticker = ? AND published_at > ?
       AND source IS NOT NULL
       AND source != ''
       AND source NOT IN ('mock', 'mock-generated', 'unknown', 'legacy-source')
     ORDER BY published_at DESC
     LIMIT 25`,
    [ticker, Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60)]
  );
}

async function getRecentArticlesAtDate(ticker, cutoffTimestamp) {
  return db.all(
    `SELECT title, description, content, source, sentiment, published_at, relevance_score, is_helpful
     FROM news
     WHERE ticker = ? AND published_at <= ? AND published_at > ?
       AND source IS NOT NULL
       AND source != ''
       AND source NOT IN ('mock', 'mock-generated', 'unknown', 'legacy-source')
     ORDER BY published_at DESC
     LIMIT 25`,
    [ticker, cutoffTimestamp, cutoffTimestamp - (7 * 24 * 60 * 60)]
  );
}

async function getCalibrationContext(ticker) {
  const checks = await db.all(
    `SELECT predicted_price, actual_price, was_correct, checked_at
     FROM accuracy_checks
     WHERE ticker = ?
     ORDER BY checked_at DESC
     LIMIT 10`,
    [ticker]
  );

  return summarizeCalibrationMetrics(checks);
}

async function getCalibrationContextAtDate(ticker, cutoffTimestamp) {
  const checks = await db.all(
    `SELECT predicted_price, actual_price, was_correct, checked_at
     FROM accuracy_checks
     WHERE ticker = ? AND checked_at < ?
     ORDER BY checked_at DESC
     LIMIT 10`,
    [ticker, cutoffTimestamp]
  );

  return summarizeCalibrationMetrics(checks);
}

async function learnSignalReliabilityFeedback() {
  const rows = await db.all(
    `SELECT p.feature_snapshot, p.signal_context, a.realized_return_pct, a.checked_at
     FROM accuracy_checks a
     JOIN predictions p ON p.id = a.prediction_id
     WHERE a.checked_at >= ?
       AND a.realized_return_pct IS NOT NULL
       AND p.feature_snapshot IS NOT NULL
     ORDER BY a.checked_at DESC
     LIMIT 5000`,
    [Math.floor(Date.now() / 1000) - THREE_YEARS_SECONDS]
  );

  if (!rows.length) {
    currentWeights = normalizeWeights(currentWeights);
    return {
      applied: false,
      reason: 'no_examples'
    };
  }

  const cleanRows = rows.map((row) => {
    try {
      const features = row.feature_snapshot ? JSON.parse(row.feature_snapshot) : null;
      const signalContext = row.signal_context ? JSON.parse(row.signal_context) : {};
      if (!features) {
        return null;
      }
      const sourceNames = [
        features.priceSource,
        features.historySource,
        signalContext.currentPriceSource,
        signalContext.historySource
      ].map((sourceName) => String(sourceName || '').toLowerCase());
      if (sourceNames.some((sourceName) => sourceName.startsWith('mock') || sourceName === 'unknown')) {
        return null;
      }
      if (Number(features.priceSourceReliabilityPct || 0) < 40 || Number(features.historySourceReliabilityPct || 0) < 40) {
        return null;
      }

      return {
        realizedReturnPct: Number(row.realized_return_pct || 0),
        newsSentimentScore: Number(features.newsSentimentScore || 0),
        redditMentions: Number(features.redditMentions || 0),
        llmSignalScore: Number(features.llmSignalScore || 0)
      };
    } catch (error) {
      return null;
    }
  }).filter(Boolean);

  if (!cleanRows.length) {
    currentWeights = normalizeWeights(currentWeights);
    return {
      applied: false,
      reason: 'no_clean_examples'
    };
  }

  const newsRows = cleanRows.filter((row) => Math.abs(row.newsSentimentScore) >= 0.12);
  const redditRows = cleanRows.filter((row) => row.redditMentions >= 2 && Math.abs(row.llmSignalScore) >= 0.05);

  const newsCorrect = newsRows.filter((row) => {
    const sentimentSign = getDirectionalSign(row.newsSentimentScore);
    const realizedSign = getDirectionalSign(row.realizedReturnPct);
    return sentimentSign !== 0 && realizedSign !== 0 && sentimentSign === realizedSign;
  }).length;
  const redditCorrect = redditRows.filter((row) => {
    const modelSign = getDirectionalSign(row.llmSignalScore);
    const realizedSign = getDirectionalSign(row.realizedReturnPct);
    return modelSign !== 0 && realizedSign !== 0 && modelSign === realizedSign;
  }).length;

  const newsHitRate = newsRows.length ? (newsCorrect / newsRows.length) : 0.5;
  const redditHitRate = redditRows.length ? (redditCorrect / redditRows.length) : 0.5;
  const newsConfidence = clamp(newsRows.length / 600, 0.05, 1);
  const redditConfidence = clamp(redditRows.length / 600, 0.05, 1);
  const newsAdjustment = clamp((newsHitRate - 0.5) * 0.12 * newsConfidence, -0.05, 0.05);
  const redditAdjustment = clamp((redditHitRate - 0.5) * 0.1 * redditConfidence, -0.04, 0.04);

  const adjustedWeights = normalizeWeights({
    ...currentWeights,
    historicalTrend: baseAdaptiveWeights.historicalTrend,
    technicalSignals: baseAdaptiveWeights.technicalSignals,
    volatilityControl: baseAdaptiveWeights.volatilityControl,
    newsSentiment: clamp(baseAdaptiveWeights.newsSentiment + newsAdjustment, 0.08, 0.32),
    redditSentiment: clamp(baseAdaptiveWeights.redditSentiment + redditAdjustment, 0.04, 0.2),
    calibrationAdjustment: currentWeights.calibrationAdjustment
  });
  currentWeights = adjustedWeights;

  return {
    applied: true,
    examples: cleanRows.length,
    newsExamples: newsRows.length,
    redditExamples: redditRows.length,
    newsHitRate: roundPrice(newsHitRate),
    redditHitRate: roundPrice(redditHitRate),
    newsAdjustment: roundPrice(newsAdjustment),
    redditAdjustment: roundPrice(redditAdjustment),
    updatedWeights: adjustedWeights
  };
}

function parseHistoryTimestamp(value) {
  if (!value) {
    return null;
  }

  if (typeof value === 'number') {
    return value > 1e12 ? Math.floor(value / 1000) : value;
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return Math.floor(parsed / 1000);
}

function sliceHistoryToTimestamp(history = [], cutoffTimestamp) {
  return normalizePriceHistory(history).filter((entry) => {
    const entryTimestamp = parseHistoryTimestamp(entry.date);
    return entryTimestamp !== null && entryTimestamp <= cutoffTimestamp;
  });
}

function getDominantHistorySource(history = []) {
  const counts = history.reduce((acc, entry) => {
    const source = String(entry.source || 'unknown');
    acc[source] = (acc[source] || 0) + 1;
    return acc;
  }, {});
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return ranked.length ? ranked[0][0] : 'unknown';
}

function isMockSourceName(sourceName) {
  return String(sourceName || '').startsWith('mock');
}

function summarizeTechnicalSignals(priceHistory) {
  const normalizedHistory = normalizePriceHistory(priceHistory);
  const indicatorInput = normalizedHistory.map((entry) => ({
    ...entry,
    close: entry.close
  }));
  return technicalIndicators.interpretAllSignals(indicatorInput);
}

function buildTargetDates() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysUntilWednesday = (3 - dayOfWeek + 7) % 7 || 7;
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;

  const wednesdayDate = new Date(today);
  wednesdayDate.setDate(wednesdayDate.getDate() + daysUntilWednesday);
  wednesdayDate.setHours(16, 0, 0, 0);

  const fridayDate = new Date(today);
  fridayDate.setDate(fridayDate.getDate() + daysUntilFriday);
  fridayDate.setHours(16, 0, 0, 0);

  return [
    Math.floor(wednesdayDate.getTime() / 1000),
    Math.floor(fridayDate.getTime() / 1000)
  ];
}

async function getPriceAndHistorySources(ticker) {
  const currentPrice = await stockData.getStockPrice(ticker);
  if (!currentPrice?.price) {
    throw new Error(`Could not get price for ${ticker}`);
  }

  const priceHistory = await stockData.getHistoricalData(ticker, 365 * 5);
  const historySource = Array.isArray(priceHistory) && priceHistory.length && priceHistory[0].source
    ? priceHistory[0].source
    : currentPrice.source;

  return {
    currentPrice,
    priceHistory,
    currentPriceSource: currentPrice.source,
    historySource
  };
}

async function getBenchmarkContext() {
  const [spyHistory, qqqHistory] = await Promise.all([
    stockData.getHistoricalData('SPY', 365 * 3),
    stockData.getHistoricalData('QQQ', 365 * 3)
  ]);

  return {
    spyHistory,
    qqqHistory
  };
}

async function getSourceReliabilityRows() {
  return db.all(
    `SELECT a.error_pct, a.checked_at, p.signal_context
     FROM accuracy_checks a
     JOIN predictions p ON p.id = a.prediction_id
     WHERE a.checked_at >= ?
       AND a.error_pct IS NOT NULL`,
    [Math.floor(Date.now() / 1000) - THREE_YEARS_SECONDS]
  );
}

async function getSourceReliabilityScores() {
  const rows = await getSourceReliabilityRows();
  const stats = {};

  rows.forEach((row) => {
    const signalContext = row.signal_context ? JSON.parse(row.signal_context) : {};
    const currentPriceSource = signalContext.currentPriceSource || signalContext.priceSource || 'unknown';
    const historySource = signalContext.historySource || currentPriceSource;
    const errorPct = Math.abs(Number(row.error_pct || 0));

    [currentPriceSource, historySource].forEach((sourceName) => {
      if (!stats[sourceName]) {
        stats[sourceName] = { totalError: 0, count: 0 };
      }
      stats[sourceName].totalError += errorPct;
      stats[sourceName].count += 1;
    });
  });

  const scores = {};
  Object.entries(stats).forEach(([sourceName, sourceStats]) => {
    const avgError = sourceStats.count ? sourceStats.totalError / sourceStats.count : 0.15;
    scores[sourceName] = roundPrice(clamp(1 - avgError, 0.2, 1) * 100);
  });

  return scores;
}

function buildPredictionFactors(historicalMetrics, benchmarkMetrics, newsMetrics, technicalSummary, calibrationMetrics, sourceReliability) {
  return {
    fiveYearReturnPct: roundPrice(historicalMetrics.returns.fiveYears * 100),
    oneYearReturnPct: roundPrice(historicalMetrics.returns.oneYear * 100),
    threeMonthReturnPct: roundPrice(historicalMetrics.returns.threeMonths * 100),
    oneMonthReturnPct: roundPrice(historicalMetrics.returns.oneMonth * 100),
    oneWeekReturnPct: roundPrice(historicalMetrics.returns.oneWeek * 100),
    relativeReturnVsSpy1MPct: roundPrice(benchmarkMetrics.relativeReturnVsSpy1M * 100),
    relativeReturnVsSpy3MPct: roundPrice(benchmarkMetrics.relativeReturnVsSpy3M * 100),
    relativeReturnVsQqq1MPct: roundPrice(benchmarkMetrics.relativeReturnVsQqq1M * 100),
    relativeReturnVsQqq3MPct: roundPrice(benchmarkMetrics.relativeReturnVsQqq3M * 100),
    benchmarkMomentumPct: roundPrice(benchmarkMetrics.benchmarkMomentum * 100),
    benchmarkCorrelationPct: roundPrice(benchmarkMetrics.benchmarkCorrelation * 100),
    volatility30DayPct: roundPrice(historicalMetrics.volatility.thirtyDay * 100),
    volatility1YearPct: roundPrice(historicalMetrics.volatility.oneYear * 100),
    newsSentimentScore: roundPrice(newsMetrics.sentimentScore),
    redditMentions: newsMetrics.redditMentions,
    articleCount: newsMetrics.articleCount,
    sourceDiversityCount: roundPrice(newsMetrics.sourceDiversity),
    sourceDiversityScore: roundPrice(newsMetrics.sourceDiversityScore * 100),
    newsRecencyScore: roundPrice(newsMetrics.recencyScore * 100),
    newsQualityScore: roundPrice(newsMetrics.articleQualityScore * 100),
    redditEngagementScore: roundPrice(newsMetrics.redditEngagementScore * 100),
    redditPostRatioPct: roundPrice(newsMetrics.redditPostRatio * 100),
    technicalBullishScore: Number.parseFloat(technicalSummary?.bullishScore || '50'),
    recentAccuracyRatePct: roundPrice(calibrationMetrics.accuracyRate * 100),
    recentMeanAbsoluteError: roundPrice(calibrationMetrics.meanAbsoluteError),
    recentMeanError: roundPrice(calibrationMetrics.meanError),
    priceSourceReliabilityPct: sourceReliability.currentPriceSourceReliabilityPct,
    historySourceReliabilityPct: sourceReliability.historySourceReliabilityPct
  };
}

function deriveTickerClass(factorSnapshot = {}) {
  if (Number(factorSnapshot.volatility30DayPct || 0) >= 4 || Number(factorSnapshot.benchmarkCorrelationPct || 0) < 30) {
    return 'high_beta';
  }

  if (Number(factorSnapshot.articleCount || 0) >= 8 || Number(factorSnapshot.redditMentions || 0) >= 4) {
    return 'event_driven';
  }

  if (Number(factorSnapshot.benchmarkCorrelationPct || 0) >= 70 && Number(factorSnapshot.volatility30DayPct || 0) <= 2.5) {
    return 'index_like';
  }

  return 'core';
}

function assessPredictionQuality(context) {
  const reasons = [];
  let score = 100;

  if (context.historicalMetrics.sampleSize < 252) {
    score -= 45;
    reasons.push('less than one year of price history');
  } else if (context.historicalMetrics.sampleSize < 504) {
    score -= 18;
    reasons.push('less than two years of price history');
  }

  if (Number(context.sourceReliability.currentPriceSourceReliabilityPct || 0) < 45) {
    score -= 35;
    reasons.push('current price source reliability is weak');
  }

  if (Number(context.sourceReliability.historySourceReliabilityPct || 0) < 45) {
    score -= 35;
    reasons.push('historical price source reliability is weak');
  }

  if (!context.recentHeadlines.length) {
    score -= 10;
    reasons.push('no recent news or reddit context');
  } else if (context.newsMetrics.articleCount < 3 && context.newsMetrics.redditMentions < 2) {
    score -= 8;
    reasons.push('news and reddit context is sparse');
  }

  if (context.historicalMetrics.volatility.oneYear > 0.06) {
    score -= 8;
    reasons.push('price behavior is unusually volatile');
  }

  const finalScore = roundPrice(clamp(score, 0, 100));
  if (finalScore < 45) {
    return { score: finalScore, status: 'exclude', reasons };
  }

  if (finalScore < 70) {
    return { score: finalScore, status: 'downgrade', reasons };
  }

  return { score: finalScore, status: 'normal', reasons };
}

function rebalanceWeights(baseWeights, factorSnapshot, llmAssessment) {
  const adjusted = {
    ...baseWeights
  };

  const newsStrength = Math.min(Math.abs(factorSnapshot.newsSentimentScore), 1);
  const redditStrength = Math.min(factorSnapshot.redditMentions / 20, 1);
  const volatilityStrength = Math.min(factorSnapshot.volatility30DayPct / 10, 1.5);
  const technicalStrength = Math.abs((factorSnapshot.technicalBullishScore - 50) / 50);

  adjusted.newsSentiment += newsStrength * 0.06;
  adjusted.redditSentiment += redditStrength * 0.04;
  adjusted.volatilityControl += volatilityStrength * 0.03;
  adjusted.technicalSignals += technicalStrength * 0.04;

  Object.entries(llmAssessment.weightAdjustments || {}).forEach(([key, value]) => {
    if (typeof adjusted[key] === 'number') {
      adjusted[key] += clamp(Number(value || 0), -0.08, 0.08);
    }
  });

  const total = Object.values(adjusted).reduce((sum, value) => sum + value, 0);
  return Object.fromEntries(
    Object.entries(adjusted).map(([key, value]) => [key, roundPrice(value / total)])
  );
}

function getModelCacheKey(horizonLabel, tickerClass = 'global') {
  return `${horizonLabel}::${tickerClass}`;
}

async function getActiveTrainedModel(horizonLabel, tickerClass = 'global') {
  const cacheKey = getModelCacheKey(horizonLabel, tickerClass);
  if (cachedModels[cacheKey]) {
    return cachedModels[cacheKey];
  }

  const row = await db.get(
    `SELECT * FROM trained_models WHERE model_name = ? AND horizon_label = ? AND is_active = 1`,
    ['threshold-gbdt-v2', cacheKey]
  );

  if (!row) {
    return null;
  }

  const modelPayload = JSON.parse(row.coefficients);
  const model = {
    ...modelPayload,
    trainingExamples: row.training_examples,
    mae: Number(row.mae || 0),
    rmse: Number(row.rmse || 0),
    tickerClass,
    horizonLabel
  };
  cachedModels[cacheKey] = model;
  return model;
}

async function saveTrainedModel(horizonLabel, tickerClass, trainedModel) {
  const cacheKey = getModelCacheKey(horizonLabel, tickerClass);
  await db.run(
    `INSERT INTO trained_models (
      model_name, horizon_label, intercept, coefficients, feature_order, training_examples, mae, rmse, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    ON CONFLICT(model_name, horizon_label) DO UPDATE SET
      intercept = excluded.intercept,
      coefficients = excluded.coefficients,
      feature_order = excluded.feature_order,
      training_examples = excluded.training_examples,
      mae = excluded.mae,
      rmse = excluded.rmse,
      trained_at = strftime('%s', 'now'),
      is_active = 1`,
    [
      'threshold-gbdt-v2',
      cacheKey,
      trainedModel.baseValue || 0,
      JSON.stringify(trainedModel),
      JSON.stringify(FEATURE_ORDER),
      trainedModel.trainingExamples,
      trainedModel.mae,
      trainedModel.rmse
    ]
  );

  cachedModels[cacheKey] = {
    ...trainedModel,
    tickerClass,
    horizonLabel
  };
}

async function getTrainingExamplesForHorizon(targetIndex) {
  const rows = await db.all(
    `SELECT p.feature_snapshot, p.signal_context, p.model_name, a.realized_return_pct, a.outcome_snapshot, a.checked_at
     FROM accuracy_checks a
     JOIN predictions p ON p.id = a.prediction_id
     WHERE a.checked_at >= ?
       AND a.outcome_snapshot IS NOT NULL
       AND json_extract(a.outcome_snapshot, '$.targetIndex') = ?
       AND p.feature_snapshot IS NOT NULL
       AND a.realized_return_pct IS NOT NULL
     ORDER BY a.checked_at ASC, a.id ASC`,
    [Math.floor(Date.now() / 1000) - THREE_YEARS_SECONDS, targetIndex]
  );

  return rows
    .map((row) => {
      if (!row.feature_snapshot || row.realized_return_pct === undefined || row.realized_return_pct === null) {
        return null;
      }

      const features = JSON.parse(row.feature_snapshot);
      const signalContext = row.signal_context ? JSON.parse(row.signal_context) : {};
      const outcomeSnapshot = row.outcome_snapshot ? JSON.parse(row.outcome_snapshot) : {};
      const priceSource = features.priceSource || signalContext.currentPriceSource || '';
      const historySource = features.historySource || signalContext.historySource || '';
      const actualPriceSource = outcomeSnapshot.actualPriceSource || '';
      const isMock = [priceSource, historySource, actualPriceSource].some((sourceName) => isMockSourceName(sourceName));
      const hasUnknownSources = [priceSource, historySource].some((sourceName) => String(sourceName || '').length === 0 || sourceName === 'unknown');
      const hasWeakReliability = Number(features.priceSourceReliabilityPct || 0) < 40 || Number(features.historySourceReliabilityPct || 0) < 40;
      const isFallbackOnly = String(row.model_name || '').includes('deterministic-fallback');

      if (isMock || hasUnknownSources || hasWeakReliability || isFallbackOnly) {
        return null;
      }

      const realizedReturnPct = Number(row.realized_return_pct);
      const safetyBuffer = clamp(
        ((Number(features.volatility30DayPct || 0) / 100) * 0.35) +
        ((100 - Number(features.priceSourceReliabilityPct || 70)) / 10000) +
        ((100 - Number(features.historySourceReliabilityPct || 70)) / 10000),
        0.003,
        0.03
      );
      const checkedAt = Number(row.checked_at || 0);
      const ageDays = checkedAt ? Math.max(0, (Math.floor(Date.now() / 1000) - checkedAt) / (24 * 60 * 60)) : TRAINING_RECENCY_HALF_LIFE_DAYS;
      const sourceWeightMap = {
        'yahoo-finance': 1,
        finnhub: 0.9,
        'alpha-vantage': 0.85,
        'backfilled-history': 0.55,
        'legacy-source': 0.65
      };
      const sourceWeight = sourceWeightMap[String(priceSource)] || 0.7;
      const sampleWeight = clamp(Math.pow(0.5, ageDays / TRAINING_RECENCY_HALF_LIFE_DAYS) * sourceWeight, 0.15, 1.5);

      return {
        ticker: signalContext.ticker || features.ticker || outcomeSnapshot.ticker || 'UNKNOWN',
        tickerClass: features.tickerClass || 'core',
        features,
        targetThresholdReturn: clamp(realizedReturnPct - safetyBuffer, -0.25, 0.25),
        sampleWeight,
        checkedAt
      };
    })
    .filter(Boolean);
}

async function retrainLearningModels() {
  const horizons = [
    { label: 'wednesday', targetIndex: 0 },
    { label: 'friday', targetIndex: 1 }
  ];
  const results = {};

  for (const horizon of horizons) {
    const examples = await getTrainingExamplesForHorizon(horizon.targetIndex);
    const uniqueTickers = new Set(examples.map((example) => example.ticker)).size;
    if (examples.length < MIN_GLOBAL_TRAINING_EXAMPLES || uniqueTickers < MIN_GLOBAL_UNIQUE_TICKERS) {
      results[horizon.label] = {
        trained: false,
        examples: examples.length,
        uniqueTickers,
        classes: {}
      };
      continue;
    }

    const trainedModel = trainThresholdModel(examples);
    await saveTrainedModel(horizon.label, 'global', trainedModel);
    const classResults = {};

    const classNames = [...new Set(examples.map((example) => example.tickerClass))];
    for (const tickerClass of classNames) {
      const classExamples = examples.filter((example) => example.tickerClass === tickerClass);
      const classUniqueTickers = new Set(classExamples.map((example) => example.ticker)).size;

      if (classExamples.length < MIN_CLASS_TRAINING_EXAMPLES || classUniqueTickers < MIN_CLASS_UNIQUE_TICKERS) {
        classResults[tickerClass] = {
          trained: false,
          examples: classExamples.length,
          uniqueTickers: classUniqueTickers
        };
        continue;
      }

      const classModel = trainThresholdModel(classExamples);
      await saveTrainedModel(horizon.label, tickerClass, classModel);
      classResults[tickerClass] = {
        trained: true,
        examples: classExamples.length,
        uniqueTickers: classUniqueTickers,
        mae: classModel.mae,
        rmse: classModel.rmse
      };
    }

    results[horizon.label] = {
      trained: true,
      examples: examples.length,
      uniqueTickers,
      mae: trainedModel.mae,
      rmse: trainedModel.rmse,
      classes: classResults
    };
  }

  return results;
}

async function getModelInsights() {
  const sourceReliability = await getSourceReliabilityScores();
  const trainedModels = {
    wednesday: await getActiveTrainedModel('wednesday', 'global'),
    friday: await getActiveTrainedModel('friday', 'global')
  };
  const walkForward = await evaluateModelWalkForward();

  return {
    currentWeights,
    sourceReliability,
    trainedModels: {
      wednesday: trainedModels.wednesday ? {
        trainingExamples: trainedModels.wednesday.trainingExamples,
        mae: trainedModels.wednesday.mae,
        rmse: trainedModels.wednesday.rmse,
        modelType: trainedModels.wednesday.type
      } : null,
      friday: trainedModels.friday ? {
        trainingExamples: trainedModels.friday.trainingExamples,
        mae: trainedModels.friday.mae,
        rmse: trainedModels.friday.rmse,
        modelType: trainedModels.friday.type
      } : null
    },
    walkForward
  };
}

async function backfillLegacyTrainingData(options = {}) {
  const limit = options.limit || 5000;
  const refreshBackfilled = Boolean(options.refreshBackfilled);
  const whereClause = refreshBackfilled
    ? `((feature_snapshot IS NULL OR feature_snapshot = '')
       OR json_extract(signal_context, '$.currentPriceSource') = 'backfilled-history')`
    : `(feature_snapshot IS NULL OR feature_snapshot = '')`;
  const legacyPredictions = await db.all(
    `SELECT id, ticker, prediction_date, target_dates
     FROM predictions
     WHERE ${whereClause}
       AND prediction_date >= ?
     ORDER BY prediction_date ASC
     LIMIT ?`,
    [Math.floor(Date.now() / 1000) - THREE_YEARS_SECONDS, limit]
  );

  if (!legacyPredictions.length) {
    return { scanned: 0, updated: 0, skipped: 0 };
  }

  const historyCache = new Map();
  const benchmarkContext = await getBenchmarkContext();
  let updated = 0;
  let skipped = 0;

  for (const prediction of legacyPredictions) {
    try {
      const ticker = prediction.ticker.toUpperCase();
      if (!historyCache.has(ticker)) {
        historyCache.set(ticker, await stockData.getHistoricalData(ticker, 365 * 5));
      }

      const tickerHistory = historyCache.get(ticker);
      const slicedHistory = sliceHistoryToTimestamp(tickerHistory, prediction.prediction_date);
      if (slicedHistory.length < 252) {
        skipped += 1;
        continue;
      }
      const tickerHistorySource = getDominantHistorySource(slicedHistory);
      if (isMockSourceName(tickerHistorySource) || tickerHistorySource === 'unknown') {
        skipped += 1;
        continue;
      }

      const slicedSpyHistory = sliceHistoryToTimestamp(benchmarkContext.spyHistory, prediction.prediction_date);
      const slicedQqqHistory = sliceHistoryToTimestamp(benchmarkContext.qqqHistory, prediction.prediction_date);
      const spySource = getDominantHistorySource(slicedSpyHistory);
      const qqqSource = getDominantHistorySource(slicedQqqHistory);
      if ([spySource, qqqSource].some((sourceName) => isMockSourceName(sourceName) || sourceName === 'unknown')) {
        skipped += 1;
        continue;
      }

      const currentPrice = slicedHistory[slicedHistory.length - 1].close;
      const historicalMetrics = summarizeHistoricalMetrics(slicedHistory);
      const benchmarkMetrics = summarizeBenchmarkMetrics(
        slicedHistory,
        slicedSpyHistory,
        slicedQqqHistory
      );
      const technicalSummary = summarizeTechnicalSignals(slicedHistory);
      const recentArticles = await getRecentArticlesAtDate(ticker, prediction.prediction_date);
      const newsMetrics = summarizeNewsMetrics(recentArticles);
      const calibrationMetrics = await getCalibrationContextAtDate(ticker, prediction.prediction_date);
      const sourceReliability = {
        currentPriceSourceReliabilityPct: tickerHistorySource === 'yahoo-finance' ? 82 : 70,
        historySourceReliabilityPct: tickerHistorySource === 'yahoo-finance' ? 82 : 70
      };
      const factorSnapshot = buildPredictionFactors(
        historicalMetrics,
        benchmarkMetrics,
        newsMetrics,
        technicalSummary,
        calibrationMetrics,
        sourceReliability
      );
      const tickerClass = deriveTickerClass(factorSnapshot);
      const dataQuality = assessPredictionQuality({
        historicalMetrics,
        recentHeadlines: newsMetrics.topHeadlines,
        newsMetrics,
        sourceReliability
      });

      const syntheticContext = {
        ticker,
        currentPrice,
        currentPriceSource: tickerHistorySource,
        historySource: tickerHistorySource,
        historicalMetrics,
        benchmarkMetrics,
        technicalSummary,
        newsMetrics,
        calibrationMetrics,
        sourceReliability,
        tickerClass,
        dataQuality,
        factorSnapshot
      };
      const localAssessment = await llmService.generateSignalAssessment(syntheticContext);
      const featureSnapshot = buildFeatureSnapshot({
        ...syntheticContext,
        recentHeadlines: newsMetrics.topHeadlines
      }, localAssessment);
      const signalContext = {
        ticker,
        tickerClass,
        dataQuality,
        outlook: localAssessment.outlook,
        llmSignalScore: localAssessment.signalScore,
        currentPrice,
        currentPriceSource: tickerHistorySource,
        historySource: tickerHistorySource,
        historicalMetrics,
        benchmarkMetrics,
        newsMetrics,
        technicalSummary,
        calibrationMetrics,
        sourceReliability
      };

      await db.run(
        `UPDATE predictions
         SET feature_snapshot = ?, signal_context = ?, model_name = COALESCE(model_name, ?)
         WHERE id = ?`,
        [
          JSON.stringify(featureSnapshot),
          JSON.stringify(signalContext),
          `${localAssessment.modelName}+backfilled-v1`,
          prediction.id
        ]
      );
      updated += 1;
    } catch (error) {
      console.error(`Failed to backfill legacy prediction ${prediction.id}:`, error.message || error);
      skipped += 1;
    }
  }

  return {
    scanned: legacyPredictions.length,
    updated,
    skipped
  };
}

async function backfillLegacyAccuracyChecks(options = {}) {
  const limit = options.limit || 20000;
  const rows = await db.all(
    `SELECT a.id, a.ticker, a.target_date, a.predicted_price, a.actual_price, a.was_correct,
            p.target_dates, p.signal_context
     FROM accuracy_checks a
     JOIN predictions p ON p.id = a.prediction_id
     WHERE (a.realized_return_pct IS NULL OR a.outcome_snapshot IS NULL OR a.error_pct IS NULL)
       AND a.actual_price IS NOT NULL
       AND p.signal_context IS NOT NULL
     ORDER BY a.id ASC
     LIMIT ?`,
    [limit]
  );

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    try {
      const signalContext = JSON.parse(row.signal_context);
      const targetDates = JSON.parse(row.target_dates);
      const targetIndex = targetDates.indexOf(row.target_date);
      const basePrice = Number(signalContext.currentPrice || 0);
      const predictedPrice = Number(row.predicted_price);
      const actualPrice = Number(row.actual_price);

      if (targetIndex === -1 || !basePrice || !predictedPrice || !actualPrice) {
        skipped += 1;
        continue;
      }

      const realizedReturnPct = (actualPrice - basePrice) / basePrice;
      const errorPct = (actualPrice - predictedPrice) / predictedPrice;
      const wasCorrect = actualPrice >= predictedPrice;

      await db.run(
        `UPDATE accuracy_checks
         SET realized_return_pct = ?, error_pct = ?, outcome_snapshot = ?, was_correct = ?
         WHERE id = ?`,
        [
          realizedReturnPct,
          errorPct,
          JSON.stringify({
            targetIndex,
            basePrice,
            actualPrice,
            actualPriceSource: signalContext.currentPriceSource || 'legacy-actual',
            predictedPrice,
            realizedReturnPct,
            errorPct,
            thresholdHit: wasCorrect
          }),
          wasCorrect ? 1 : 0,
          row.id
        ]
      );
      updated += 1;
    } catch (error) {
      console.error(`Failed to backfill legacy accuracy check ${row.id}:`, error.message || error);
      skipped += 1;
    }
  }

  return {
    scanned: rows.length,
    updated,
    skipped
  };
}

async function buildPredictionContext(ticker, targetDates) {
  const [{ currentPrice, priceHistory, currentPriceSource, historySource }, { spyHistory, qqqHistory }] = await Promise.all([
    getPriceAndHistorySources(ticker),
    getBenchmarkContext()
  ]);
  const normalizedHistory = normalizePriceHistory(priceHistory);
  const historicalMetrics = summarizeHistoricalMetrics(normalizedHistory);
  const benchmarkMetrics = summarizeBenchmarkMetrics(normalizedHistory, spyHistory, qqqHistory);
  const technicalSummary = summarizeTechnicalSignals(normalizedHistory);
  const recentArticles = await getRecentArticles(ticker);
  const newsMetrics = summarizeNewsMetrics(recentArticles);
  const calibrationMetrics = await getCalibrationContext(ticker);
  const sourceReliabilityScores = await getSourceReliabilityScores();
  const isMockSource = (sourceName) => String(sourceName || '').startsWith('mock');
  const sourceReliability = {
    currentPriceSourceReliabilityPct: isMockSource(currentPriceSource)
      ? 20
      : (sourceReliabilityScores[currentPriceSource] || 70),
    historySourceReliabilityPct: isMockSource(historySource)
      ? 20
      : (sourceReliabilityScores[historySource] || 70)
  };
  const factorSnapshot = buildPredictionFactors(
    historicalMetrics,
    benchmarkMetrics,
    newsMetrics,
    technicalSummary,
    calibrationMetrics,
    sourceReliability
  );
  const trainedModels = {
    wednesday: null,
    friday: null
  };
  const tickerClass = deriveTickerClass(factorSnapshot);
  const dataQuality = assessPredictionQuality({
    historicalMetrics,
    recentHeadlines: newsMetrics.topHeadlines,
    newsMetrics,
    sourceReliability
  });

  const globalWednesdayModel = await getActiveTrainedModel('wednesday', 'global');
  const globalFridayModel = await getActiveTrainedModel('friday', 'global');
  const classWednesdayModel = tickerClass === 'global' ? null : await getActiveTrainedModel('wednesday', tickerClass);
  const classFridayModel = tickerClass === 'global' ? null : await getActiveTrainedModel('friday', tickerClass);
  trainedModels.wednesday = {
    classModel: classWednesdayModel,
    globalModel: globalWednesdayModel
  };
  trainedModels.friday = {
    classModel: classFridayModel,
    globalModel: globalFridayModel
  };

  return {
    ticker,
    currentPrice: currentPrice.price,
    currentPriceSource,
    historySource,
    targetDates,
    historicalMetrics,
    benchmarkMetrics,
    technicalSummary,
    newsMetrics,
    calibrationMetrics,
    sourceReliability,
    tickerClass,
    dataQuality,
    recentHeadlines: newsMetrics.topHeadlines,
    factorSnapshot,
    trainedModels,
    currentWeights
  };
}

function buildFeatureSnapshot(context, llmAssessment) {
  return {
    ...context.factorSnapshot,
    ticker: context.ticker,
    tickerClass: context.tickerClass,
    currentPrice: roundPrice(context.currentPrice),
    priceSource: context.currentPriceSource,
    historySource: context.historySource,
    llmSignalScore: roundPrice(llmAssessment.signalScore || 0),
    dataQualityScore: context.dataQuality.score
  };
}

function isUsableTrainedModel(model) {
  return Boolean(model && Number(model.trainingExamples || 0) >= MIN_CLASS_TRAINING_EXAMPLES);
}

function getModelReturn(featureSnapshot, model, fallbackReturn) {
  return isUsableTrainedModel(model)
    ? predictThresholdReturn(featureSnapshot, model)
    : fallbackReturn;
}

function getLearnedThresholdReturn(featureSnapshot, trainedModelBundle, deterministicThresholdReturn) {
  if (trainedModelBundle && (trainedModelBundle.classModel || trainedModelBundle.globalModel)) {
    const classModel = trainedModelBundle.classModel;
    const globalModel = trainedModelBundle.globalModel;
    const classUsable = isUsableTrainedModel(classModel);
    const globalUsable = isUsableTrainedModel(globalModel);

    if (classUsable && globalUsable) {
      const classReturn = predictThresholdReturn(featureSnapshot, classModel);
      const globalReturn = predictThresholdReturn(featureSnapshot, globalModel);
      const classExamples = Number(classModel.trainingExamples || 0);
      const classDataWeight = clamp(
        (classExamples - MIN_CLASS_TRAINING_EXAMPLES) / (MIN_CLASS_TRAINING_EXAMPLES * 3),
        0,
        1
      );
      const classRmse = Number(classModel.rmse || 0.1);
      const globalRmse = Number(globalModel.rmse || 0.1);
      const rmseEdge = clamp((globalRmse - classRmse) / Math.max(classRmse + globalRmse, 0.0001), -0.35, 0.35);
      const classWeight = clamp(0.35 + (0.35 * classDataWeight) + (0.25 * rmseEdge), 0.15, 0.85);

      return {
        learnedThresholdReturn: (classReturn * classWeight) + (globalReturn * (1 - classWeight)),
        modelType: `ensemble-${classModel.type || 'class'}+${globalModel.type || 'global'}`,
        rmse: (classRmse * classWeight) + (globalRmse * (1 - classWeight))
      };
    }

    if (classUsable) {
      return {
        learnedThresholdReturn: predictThresholdReturn(featureSnapshot, classModel),
        modelType: classModel.type || 'class-threshold-model',
        rmse: Number(classModel.rmse || 0.03)
      };
    }

    if (globalUsable) {
      return {
        learnedThresholdReturn: predictThresholdReturn(featureSnapshot, globalModel),
        modelType: globalModel.type || 'global-threshold-model',
        rmse: Number(globalModel.rmse || 0.03)
      };
    }
  }

  const fallbackModel = trainedModelBundle && !trainedModelBundle.classModel && !trainedModelBundle.globalModel
    ? trainedModelBundle
    : null;
  return {
    learnedThresholdReturn: getModelReturn(featureSnapshot, fallbackModel, deterministicThresholdReturn),
    modelType: fallbackModel?.type || 'deterministic-threshold-fallback',
    rmse: Number(fallbackModel?.rmse || 0.03)
  };
}

function buildDirectThresholdForecast(context, fallbackRange, trainedModelBundle, featureSnapshot, llmAssessment) {
  const deterministicThresholdReturn = ((fallbackRange.low - context.currentPrice) / context.currentPrice) || 0;
  const learnedModelOutput = getLearnedThresholdReturn(featureSnapshot, trainedModelBundle, deterministicThresholdReturn);
  const learnedThresholdReturn = learnedModelOutput.learnedThresholdReturn;
  const llmAdjustment = clamp((llmAssessment.signalScore || 0) * 0.01, -0.02, 0.02);
  const calibrationAdjustment = clamp(
    -(context.calibrationMetrics.meanError / Math.max(context.currentPrice, 1)) * 0.2,
    -0.025,
    0.025
  );
  const qualityAdjustment = context.dataQuality.status === 'downgrade' ? -0.015 : 0;
  const finalThresholdReturn = clamp(
    learnedThresholdReturn + llmAdjustment + calibrationAdjustment + qualityAdjustment,
    -0.2,
    0.2
  );
  const upsideSpreadPct = clamp(
    (context.historicalMetrics.volatility.thirtyDay * 2.2) + Math.max(learnedModelOutput.rmse || 0.02, 0.02),
    0.03,
    0.12
  );
  const threshold = context.currentPrice * (1 + finalThresholdReturn);
  const expected = threshold + Math.max(context.currentPrice * (upsideSpreadPct * 0.45), context.currentPrice * 0.01);
  const ceiling = threshold + Math.max(context.currentPrice * upsideSpreadPct, context.currentPrice * 0.025);
  const confidencePenalty = context.dataQuality.status === 'downgrade' ? 0.15 : 0;
  const confidence = clamp(
    0.6 +
    (context.calibrationMetrics.accuracyRate * 0.1) +
    (Number(context.sourceReliability.currentPriceSourceReliabilityPct) / 1100) +
    (llmAssessment.confidenceAdjustment || 0) -
    (context.historicalMetrics.volatility.oneYear * 0.22) -
    confidencePenalty,
    0.25,
    0.9
  );

  return {
    low: roundPrice(threshold),
    mid: roundPrice(expected),
    high: roundPrice(ceiling),
    confidence: roundPrice(confidence),
    thresholdReturnPct: roundPrice(finalThresholdReturn * 100),
    modelType: learnedModelOutput.modelType,
    dataQualityStatus: context.dataQuality.status
  };
}

function buildPredictionRecord(ticker, context, llmAssessment, targetDates) {
  const featureSnapshot = buildFeatureSnapshot(context, llmAssessment);
  const learnedWeights = rebalanceWeights(currentWeights, context.factorSnapshot, llmAssessment);
  const fallback = createDeterministicForecast(context);
  const wednesday = buildDirectThresholdForecast(
    context,
    fallback.priceTargets.wednesday,
    context.trainedModels.wednesday,
    featureSnapshot,
    llmAssessment
  );
  const friday = buildDirectThresholdForecast(
    context,
    fallback.priceTargets.friday,
    context.trainedModels.friday,
    featureSnapshot,
    llmAssessment
  );

  return {
    ticker,
    targetDates,
    predictedPrices: [wednesday.low, friday.low],
    confidenceScores: [wednesday.confidence, friday.confidence],
    priceRanges: [wednesday, friday],
    factorSnapshot: context.factorSnapshot,
    featureSnapshot,
    newsSummary: context.recentHeadlines.map((headline) => `${headline.source}: ${headline.title}`).join('\n'),
    algorithmWeights: learnedWeights,
    analysisSummary: llmAssessment.rationale,
    modelName: `${llmAssessment.modelName}+threshold-gbdt-v2`,
    signalContext: {
      ticker,
      tickerClass: context.tickerClass,
      dataQuality: context.dataQuality,
      outlook: llmAssessment.outlook,
      llmSignalScore: llmAssessment.signalScore,
      currentPrice: context.currentPrice,
      currentPriceSource: context.currentPriceSource,
      historySource: context.historySource,
      historicalMetrics: context.historicalMetrics,
      benchmarkMetrics: context.benchmarkMetrics,
      newsMetrics: context.newsMetrics,
      technicalSummary: context.technicalSummary,
      calibrationMetrics: context.calibrationMetrics,
      sourceReliability: context.sourceReliability
    }
  };
}

async function predictStockPrice(ticker, targetDate) {
  const targetDates = [targetDate, targetDate];
  const context = await buildPredictionContext(ticker, targetDates);
  if (context.dataQuality.status === 'exclude') {
    return {
      ticker,
      error: `Prediction excluded because source quality is too weak: ${context.dataQuality.reasons.join(', ')}`
    };
  }
  const llmAssessment = await llmService.generateSignalAssessment(context);
  return buildPredictionRecord(ticker, context, llmAssessment, targetDates);
}

async function generateMondayPredictions(tickers) {
  const normalizedTickers = tickers.map((ticker) => ticker.toUpperCase());
  await newsScraper.scrapeAllNews(normalizedTickers);
  const targetDates = buildTargetDates();
  const predictions = [];
  const skipped = [];

  for (const ticker of normalizedTickers) {
    try {
      const context = await buildPredictionContext(ticker, targetDates);
      if (context.dataQuality.status === 'exclude') {
        const reason = context.dataQuality.reasons.join(', ');
        console.warn(`Skipping ${ticker} prediction because data quality is too weak: ${reason}`);
        skipped.push({
          ticker,
          reason,
          dataQuality: context.dataQuality
        });
        continue;
      }
      const llmAssessment = await llmService.generateSignalAssessment(context);
      const record = buildPredictionRecord(ticker, context, llmAssessment, targetDates);
      currentWeights = record.algorithmWeights;
      await persistWeightsSnapshot(ticker);

      await db.run(
        `INSERT INTO predictions (
          ticker, prediction_date, target_dates, predicted_prices, confidence_scores,
          price_ranges, news_summary, algorithm_weights, analysis_summary, model_name, signal_context, feature_snapshot
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ticker,
          Math.floor(Date.now() / 1000),
          JSON.stringify(targetDates),
          JSON.stringify(record.predictedPrices),
          JSON.stringify(record.confidenceScores),
          JSON.stringify(record.priceRanges),
          record.newsSummary,
          JSON.stringify(record.algorithmWeights),
          record.analysisSummary,
          record.modelName,
          JSON.stringify(record.signalContext),
          JSON.stringify(record.featureSnapshot)
        ]
      );

      predictions.push({
        ticker,
        wednesdayPrice: record.predictedPrices[0],
        fridayPrice: record.predictedPrices[1],
        wednesdayConfidence: record.confidenceScores[0],
        fridayConfidence: record.confidenceScores[1],
        factors: record.factorSnapshot,
        learningInputs: record.featureSnapshot,
        newsSummary: record.newsSummary,
        weights: JSON.stringify(record.algorithmWeights),
        analysisSummary: record.analysisSummary,
        modelName: record.modelName,
        dataQuality: record.signalContext.dataQuality
      });
    } catch (error) {
      console.error(`Error generating prediction for ${ticker}:`, error);
    }
  }

  if (!predictions.length) {
    throw new Error('No predictions could be generated. Check backend data sources and API configuration.');
  }

  return {
    predictions,
    skipped
  };
}

async function checkAccuracy(ticker, targetDate) {
  try {
    const prediction = await db.get(
      `SELECT * FROM predictions
       WHERE ticker = ?
       AND (json_extract(target_dates, '$[0]') = ? OR json_extract(target_dates, '$[1]') = ?)
       ORDER BY created_at DESC
       LIMIT 1`,
      [ticker, targetDate, targetDate]
    );

    if (!prediction) {
      return { error: 'No prediction found for this date' };
    }

    const currentPrice = await stockData.getStockPrice(ticker);
    if (!currentPrice?.price) {
      throw new Error(`Could not get price for ${ticker}`);
    }

    const signalContext = prediction.signal_context ? JSON.parse(prediction.signal_context) : {};
    const targetDates = JSON.parse(prediction.target_dates);
    const predictedPrices = JSON.parse(prediction.predicted_prices);
    const targetIndex = targetDates.indexOf(targetDate);

    if (targetIndex === -1) {
      return { error: 'Target date not found in prediction' };
    }

    const predictedPrice = Number(predictedPrices[targetIndex]);
    const actualPrice = Number(currentPrice.price);
    const basePrice = Number(signalContext.currentPrice || 0);
    const realizedReturnPct = basePrice > 0 ? ((actualPrice - basePrice) / basePrice) : null;
    const errorPct = predictedPrice > 0 ? ((actualPrice - predictedPrice) / predictedPrice) : null;
    const wasCorrect = actualPrice >= predictedPrice;

    await db.run(
      `INSERT INTO accuracy_checks (
        ticker, prediction_id, target_date, predicted_price, actual_price, was_correct,
        realized_return_pct, error_pct, outcome_snapshot
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ticker,
        prediction.id,
        targetDate,
        predictedPrice,
        actualPrice,
        wasCorrect ? 1 : 0,
        realizedReturnPct,
        errorPct,
        JSON.stringify({
          targetIndex,
          basePrice,
          actualPrice,
          actualPriceSource: currentPrice.source,
          predictedPrice,
          realizedReturnPct,
          errorPct,
          thresholdHit: wasCorrect
        })
      ]
    );

    const refreshedCalibration = await getCalibrationContext(ticker);
    const trainingResults = await retrainLearningModels();
    const signalFeedback = await learnSignalReliabilityFeedback();
    currentWeights = {
      ...currentWeights,
      calibrationAdjustment: roundPrice(Math.abs(refreshedCalibration.meanError / Math.max(actualPrice, 1)))
    };
    currentWeights = normalizeWeights(currentWeights);
    await persistWeightsSnapshot(ticker);

    return {
      ticker,
      targetDate: new Date(targetDate * 1000).toISOString().split('T')[0],
      predictedPrice,
      actualPrice,
      wasCorrect,
      difference: roundPrice(actualPrice - predictedPrice),
      calibration: refreshedCalibration,
      learning: trainingResults,
      signalFeedback
    };
  } catch (error) {
    console.error('Error checking accuracy:', error);
    return { error: error.message };
  }
}

async function evaluateModelWalkForward(options = {}) {
  const configuredMaxWindows = Number(options.maxWindows || process.env.WALK_FORWARD_MAX_WINDOWS || 250);
  const maxWindows = Math.max(25, configuredMaxWindows);
  const horizons = [
    { label: 'wednesday', targetIndex: 0 },
    { label: 'friday', targetIndex: 1 }
  ];
  const results = {};

  for (const horizon of horizons) {
    const examples = await getTrainingExamplesForHorizon(horizon.targetIndex);
    const uniqueTickers = new Set(examples.map((example) => example.ticker)).size;
    if (examples.length < MIN_GLOBAL_TRAINING_EXAMPLES || uniqueTickers < MIN_GLOBAL_UNIQUE_TICKERS) {
      results[horizon.label] = { evaluated: false, examples: examples.length };
      continue;
    }

    const ordered = [...examples].sort((a, b) => Number(a.checkedAt || 0) - Number(b.checkedAt || 0));
    const warmup = Math.max(MIN_CLASS_TRAINING_EXAMPLES, Math.floor(ordered.length * 0.45));
    const step = Math.max(1, Math.floor((ordered.length - warmup) / maxWindows));
    const errors = [];
    let directionMatches = 0;

    for (let index = warmup; index < ordered.length; index += step) {
      const trainingSlice = ordered.slice(0, index);
      const validationRow = ordered[index];
      const model = trainThresholdModel(trainingSlice);
      const predicted = predictThresholdReturn(validationRow.features, model);
      const actual = validationRow.targetThresholdReturn;
      errors.push(predicted - actual);
      if ((predicted >= 0 && actual >= 0) || (predicted < 0 && actual < 0)) {
        directionMatches += 1;
      }
    }

    const mae = errors.reduce((sum, error) => sum + Math.abs(error), 0) / errors.length;
    const rmse = Math.sqrt(errors.reduce((sum, error) => sum + (error ** 2), 0) / errors.length);
    results[horizon.label] = {
      evaluated: true,
      examples: ordered.length,
      walkForwardWindows: errors.length,
      samplingStep: step,
      mae,
      rmse,
      directionalAccuracy: directionMatches / errors.length
    };
  }

  return results;
}

function getSelfTrainingStatus() {
  return {
    ...selfTrainingState
  };
}

async function runSelfTrainingCycle(options = {}) {
  if (selfTrainingState.running) {
    return {
      success: false,
      skipped: true,
      reason: 'already_running',
      status: getSelfTrainingStatus()
    };
  }

  const startedAtIso = new Date().toISOString();
  const startedAtMs = Date.now();
  selfTrainingState = {
    ...selfTrainingState,
    running: true,
    startedAt: startedAtIso,
    finishedAt: null,
    lastError: null
  };

  try {
    const trainingBackfillLimit = Number(options.trainingBackfillLimit || process.env.SELF_TRAIN_BACKFILL_LIMIT || 5000);
    const accuracyBackfillLimit = Number(options.accuracyBackfillLimit || process.env.SELF_TRAIN_ACCURACY_LIMIT || 20000);
    const refreshBackfilled = options.refreshBackfilled !== undefined
      ? Boolean(options.refreshBackfilled)
      : true;
    const evaluate = options.evaluate !== undefined
      ? Boolean(options.evaluate)
      : (process.env.SELF_TRAIN_EVALUATE !== 'false');
    const maxWindows = Number(options.maxWindows || process.env.WALK_FORWARD_MAX_WINDOWS || 250);

    const legacyTraining = await backfillLegacyTrainingData({
      limit: Math.max(1, trainingBackfillLimit),
      refreshBackfilled
    });
    const legacyAccuracy = await backfillLegacyAccuracyChecks({
      limit: Math.max(1, accuracyBackfillLimit)
    });
    const training = await retrainLearningModels();
    const signalFeedback = await learnSignalReliabilityFeedback();
    const walkForward = evaluate
      ? await evaluateModelWalkForward({ maxWindows })
      : null;

    const finishedAtIso = new Date().toISOString();
    const result = {
      success: true,
      startedAt: startedAtIso,
      finishedAt: finishedAtIso,
      durationMs: Date.now() - startedAtMs,
      pipeline: {
        legacyTraining,
        legacyAccuracy,
        training,
        signalFeedback,
        walkForward
      }
    };

    selfTrainingState = {
      ...selfTrainingState,
      running: false,
      finishedAt: finishedAtIso,
      lastRun: finishedAtIso,
      lastResult: result,
      lastError: null
    };

    return result;
  } catch (error) {
    const finishedAtIso = new Date().toISOString();
    selfTrainingState = {
      ...selfTrainingState,
      running: false,
      finishedAt: finishedAtIso,
      lastRun: finishedAtIso,
      lastError: error.message || String(error)
    };
    throw error;
  }
}

module.exports = {
  predictStockPrice,
  generateMondayPredictions,
  checkAccuracy,
  backfillLegacyTrainingData,
  backfillLegacyAccuracyChecks,
  retrainLearningModels,
  evaluateModelWalkForward,
  runSelfTrainingCycle,
  getSelfTrainingStatus,
  getModelInsights,
  getWeightsForWeek,
  updateWeights
};
