const db = require('./database');
const newsScraper = require('./news-scraper');
const stockData = require('./stock-data');
const technicalIndicators = require('./technical-indicators');
const llmService = require('./llm-service');
const {
  normalizePriceHistory,
  summarizeHistoricalMetrics,
  summarizeNewsMetrics,
  summarizeCalibrationMetrics,
  createDeterministicForecast,
  roundPrice,
  clamp
} = require('./prediction-math');
const { FEATURE_ORDER, predictReturn, trainReturnModel } = require('./ml-model');

const THREE_YEARS_SECONDS = 3 * 365 * 24 * 60 * 60;

let currentWeights = {
  historicalTrend: 0.32,
  technicalSignals: 0.24,
  newsSentiment: 0.18,
  redditSentiment: 0.1,
  volatilityControl: 0.08,
  calibrationAdjustment: 0.08
};

let cachedModels = {
  wednesday: null,
  friday: null
};

function getWeightsForWeek() {
  return currentWeights;
}

function updateWeights(newWeights) {
  currentWeights = {
    ...currentWeights,
    ...newWeights
  };
}

async function getRecentArticles(ticker) {
  return db.all(
    `SELECT title, description, source, sentiment, published_at
     FROM news
     WHERE ticker = ? AND published_at > ?
     ORDER BY published_at DESC
     LIMIT 25`,
    [ticker, Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60)]
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

function buildPredictionFactors(historicalMetrics, newsMetrics, technicalSummary, calibrationMetrics, sourceReliability) {
  return {
    fiveYearReturnPct: roundPrice(historicalMetrics.returns.fiveYears * 100),
    oneYearReturnPct: roundPrice(historicalMetrics.returns.oneYear * 100),
    threeMonthReturnPct: roundPrice(historicalMetrics.returns.threeMonths * 100),
    oneMonthReturnPct: roundPrice(historicalMetrics.returns.oneMonth * 100),
    oneWeekReturnPct: roundPrice(historicalMetrics.returns.oneWeek * 100),
    volatility30DayPct: roundPrice(historicalMetrics.volatility.thirtyDay * 100),
    volatility1YearPct: roundPrice(historicalMetrics.volatility.oneYear * 100),
    newsSentimentScore: roundPrice(newsMetrics.sentimentScore),
    redditMentions: newsMetrics.redditMentions,
    articleCount: newsMetrics.articleCount,
    technicalBullishScore: Number.parseFloat(technicalSummary?.bullishScore || '50'),
    recentAccuracyRatePct: roundPrice(calibrationMetrics.accuracyRate * 100),
    recentMeanAbsoluteError: roundPrice(calibrationMetrics.meanAbsoluteError),
    recentMeanError: roundPrice(calibrationMetrics.meanError),
    priceSourceReliabilityPct: sourceReliability.currentPriceSourceReliabilityPct,
    historySourceReliabilityPct: sourceReliability.historySourceReliabilityPct
  };
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

async function getActiveTrainedModel(horizonLabel) {
  if (cachedModels[horizonLabel]) {
    return cachedModels[horizonLabel];
  }

  const row = await db.get(
    `SELECT * FROM trained_models WHERE model_name = ? AND horizon_label = ? AND is_active = 1`,
    ['linear-return-v1', horizonLabel]
  );

  if (!row) {
    return null;
  }

  const model = {
    intercept: Number(row.intercept),
    coefficients: JSON.parse(row.coefficients),
    trainingExamples: row.training_examples,
    mae: Number(row.mae || 0),
    rmse: Number(row.rmse || 0)
  };
  cachedModels[horizonLabel] = model;
  return model;
}

async function saveTrainedModel(horizonLabel, trainedModel) {
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
      'linear-return-v1',
      horizonLabel,
      trainedModel.intercept,
      JSON.stringify(trainedModel.coefficients),
      JSON.stringify(FEATURE_ORDER),
      trainedModel.trainingExamples,
      trainedModel.mae,
      trainedModel.rmse
    ]
  );

  cachedModels[horizonLabel] = trainedModel;
}

async function getTrainingExamplesForHorizon(targetIndex) {
  const rows = await db.all(
    `SELECT p.feature_snapshot, a.realized_return_pct
     FROM accuracy_checks a
     JOIN predictions p ON p.id = a.prediction_id
     WHERE a.checked_at >= ?
       AND a.outcome_snapshot IS NOT NULL
       AND json_extract(a.outcome_snapshot, '$.targetIndex') = ?
       AND p.feature_snapshot IS NOT NULL
       AND a.realized_return_pct IS NOT NULL`,
    [Math.floor(Date.now() / 1000) - THREE_YEARS_SECONDS, targetIndex]
  );

  return rows.map((row) => ({
    features: JSON.parse(row.feature_snapshot),
    targetReturn: Number(row.realized_return_pct)
  }));
}

async function retrainLearningModels() {
  const horizons = [
    { label: 'wednesday', targetIndex: 0 },
    { label: 'friday', targetIndex: 1 }
  ];
  const results = {};

  for (const horizon of horizons) {
    const examples = await getTrainingExamplesForHorizon(horizon.targetIndex);
    if (examples.length < 5) {
      results[horizon.label] = { trained: false, examples: examples.length };
      continue;
    }

    const trainedModel = trainReturnModel(examples);
    await saveTrainedModel(horizon.label, trainedModel);
    results[horizon.label] = {
      trained: true,
      examples: examples.length,
      mae: trainedModel.mae,
      rmse: trainedModel.rmse
    };
  }

  return results;
}

async function buildPredictionContext(ticker, targetDates) {
  const { currentPrice, priceHistory, currentPriceSource, historySource } = await getPriceAndHistorySources(ticker);
  const normalizedHistory = normalizePriceHistory(priceHistory);
  const historicalMetrics = summarizeHistoricalMetrics(normalizedHistory);
  const technicalSummary = summarizeTechnicalSignals(normalizedHistory);
  const recentArticles = await getRecentArticles(ticker);
  const newsMetrics = summarizeNewsMetrics(recentArticles);
  const calibrationMetrics = await getCalibrationContext(ticker);
  const sourceReliabilityScores = await getSourceReliabilityScores();
  const sourceReliability = {
    currentPriceSourceReliabilityPct: sourceReliabilityScores[currentPriceSource] || 70,
    historySourceReliabilityPct: sourceReliabilityScores[historySource] || 70
  };
  const factorSnapshot = buildPredictionFactors(
    historicalMetrics,
    newsMetrics,
    technicalSummary,
    calibrationMetrics,
    sourceReliability
  );
  const trainedModels = {
    wednesday: await getActiveTrainedModel('wednesday'),
    friday: await getActiveTrainedModel('friday')
  };

  return {
    ticker,
    currentPrice: currentPrice.price,
    currentPriceSource,
    historySource,
    targetDates,
    historicalMetrics,
    technicalSummary,
    newsMetrics,
    calibrationMetrics,
    sourceReliability,
    recentHeadlines: newsMetrics.topHeadlines,
    factorSnapshot,
    trainedModels,
    currentWeights
  };
}

function buildFeatureSnapshot(context, llmAssessment) {
  return {
    ...context.factorSnapshot,
    currentPrice: roundPrice(context.currentPrice),
    priceSource: context.currentPriceSource,
    historySource: context.historySource,
    llmSignalScore: roundPrice(llmAssessment.signalScore || 0)
  };
}

function buildPriceRange(context, fallbackRange, trainedModel, featureSnapshot, llmAssessment) {
  const deterministicReturn = ((fallbackRange.mid - context.currentPrice) / context.currentPrice) || 0;
  const learnedReturn = trainedModel && trainedModel.trainingExamples >= 5
    ? predictReturn(featureSnapshot, trainedModel)
    : deterministicReturn;
  const llmAdjustment = clamp((llmAssessment.signalScore || 0) * 0.015, -0.03, 0.03);
  const calibrationAdjustment = clamp(
    -(context.calibrationMetrics.meanError / Math.max(context.currentPrice, 1)) * 0.35,
    -0.03,
    0.03
  );
  const finalReturn = clamp(learnedReturn + llmAdjustment + calibrationAdjustment, -0.2, 0.2);
  const spreadPct = clamp(
    (context.historicalMetrics.volatility.thirtyDay * 2.5) + Math.max(trainedModel?.rmse || 0.015, 0.015),
    0.025,
    0.12
  );
  const mid = context.currentPrice * (1 + finalReturn);
  const spread = Math.max(context.currentPrice * spreadPct, context.currentPrice * 0.02);
  const confidence = clamp(
    0.55 +
    (context.calibrationMetrics.accuracyRate * 0.12) +
    (Number(context.sourceReliability.currentPriceSourceReliabilityPct) / 1000) +
    (llmAssessment.confidenceAdjustment || 0) -
    (context.historicalMetrics.volatility.oneYear * 0.2),
    0.35,
    0.92
  );

  return {
    low: roundPrice(mid - spread),
    mid: roundPrice(mid),
    high: roundPrice(mid + spread),
    confidence: roundPrice(confidence),
    modelReturnPct: roundPrice(finalReturn * 100)
  };
}

function buildPredictionRecord(ticker, context, llmAssessment, targetDates) {
  const featureSnapshot = buildFeatureSnapshot(context, llmAssessment);
  const learnedWeights = rebalanceWeights(currentWeights, context.factorSnapshot, llmAssessment);
  const fallback = createDeterministicForecast(context);
  const wednesday = buildPriceRange(
    context,
    fallback.priceTargets.wednesday,
    context.trainedModels.wednesday,
    featureSnapshot,
    llmAssessment
  );
  const friday = buildPriceRange(
    context,
    fallback.priceTargets.friday,
    context.trainedModels.friday,
    featureSnapshot,
    llmAssessment
  );

  return {
    ticker,
    targetDates,
    predictedPrices: [wednesday.mid, friday.mid],
    confidenceScores: [wednesday.confidence, friday.confidence],
    priceRanges: [wednesday, friday],
    factorSnapshot: context.factorSnapshot,
    featureSnapshot,
    newsSummary: context.recentHeadlines.map((headline) => `${headline.source}: ${headline.title}`).join('\n'),
    algorithmWeights: learnedWeights,
    analysisSummary: llmAssessment.rationale,
    modelName: `${llmAssessment.modelName}+linear-return-v1`,
    signalContext: {
      outlook: llmAssessment.outlook,
      llmSignalScore: llmAssessment.signalScore,
      currentPrice: context.currentPrice,
      currentPriceSource: context.currentPriceSource,
      historySource: context.historySource,
      historicalMetrics: context.historicalMetrics,
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
  const llmAssessment = await llmService.generateSignalAssessment(context);
  return buildPredictionRecord(ticker, context, llmAssessment, targetDates);
}

async function generateMondayPredictions(tickers) {
  const normalizedTickers = tickers.map((ticker) => ticker.toUpperCase());
  await newsScraper.scrapeAllNews(normalizedTickers);
  const targetDates = buildTargetDates();
  const predictions = [];

  for (const ticker of normalizedTickers) {
    try {
      const context = await buildPredictionContext(ticker, targetDates);
      const llmAssessment = await llmService.generateSignalAssessment(context);
      const record = buildPredictionRecord(ticker, context, llmAssessment, targetDates);
      currentWeights = record.algorithmWeights;

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
        modelName: record.modelName
      });
    } catch (error) {
      console.error(`Error generating prediction for ${ticker}:`, error);
    }
  }

  if (!predictions.length) {
    throw new Error('No predictions could be generated. Check backend data sources and API configuration.');
  }

  return predictions;
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
    const priceRanges = prediction.price_ranges ? JSON.parse(prediction.price_ranges) : [];
    const targetIndex = targetDates.indexOf(targetDate);

    if (targetIndex === -1) {
      return { error: 'Target date not found in prediction' };
    }

    const predictedPrice = Number(predictedPrices[targetIndex]);
    const range = priceRanges[targetIndex];
    const actualPrice = Number(currentPrice.price);
    const basePrice = Number(signalContext.currentPrice || 0);
    const realizedReturnPct = basePrice > 0 ? ((actualPrice - basePrice) / basePrice) : null;
    const errorPct = predictedPrice > 0 ? ((actualPrice - predictedPrice) / predictedPrice) : null;
    const tolerance = Math.max(predictedPrice * 0.025, 1);
    const withinRange = range
      ? actualPrice >= Number(range.low) && actualPrice <= Number(range.high)
      : Math.abs(actualPrice - predictedPrice) <= tolerance;
    const wasCorrect = withinRange;

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
          predictedPrice,
          realizedReturnPct,
          errorPct,
          withinRange
        })
      ]
    );

    const refreshedCalibration = await getCalibrationContext(ticker);
    const trainingResults = await retrainLearningModels();
    currentWeights = {
      ...currentWeights,
      calibrationAdjustment: roundPrice(Math.abs(refreshedCalibration.meanError / Math.max(actualPrice, 1)))
    };

    return {
      ticker,
      targetDate: new Date(targetDate * 1000).toISOString().split('T')[0],
      predictedPrice,
      actualPrice,
      wasCorrect,
      withinRange,
      difference: roundPrice(actualPrice - predictedPrice),
      calibration: refreshedCalibration,
      learning: trainingResults
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
  retrainLearningModels,
  getWeightsForWeek,
  updateWeights
};
