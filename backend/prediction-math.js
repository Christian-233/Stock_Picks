function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function roundPrice(value) {
  return Math.round(value * 100) / 100;
}

function normalizePriceHistory(history = []) {
  return history
    .filter(Boolean)
    .map((entry) => ({
      date: entry.date,
      close: Number(entry.close ?? entry.price ?? 0),
      price: Number(entry.price ?? entry.close ?? 0),
      high: Number(entry.high ?? entry.close ?? entry.price ?? 0),
      low: Number(entry.low ?? entry.close ?? entry.price ?? 0),
      open: Number(entry.open ?? entry.close ?? entry.price ?? 0),
      volume: Number(entry.volume ?? 0)
    }))
    .filter((entry) => Number.isFinite(entry.close) && entry.close > 0);
}

function calculateReturn(closes, periodsBack) {
  if (!closes.length || closes.length <= periodsBack) {
    return 0;
  }

  const current = closes[closes.length - 1];
  const previous = closes[closes.length - 1 - periodsBack];
  if (!previous) {
    return 0;
  }

  return (current - previous) / previous;
}

function calculateVolatility(closes, periods = 30) {
  if (closes.length < periods + 1) {
    return 0;
  }

  const slice = closes.slice(-(periods + 1));
  const returns = [];
  for (let i = 1; i < slice.length; i += 1) {
    returns.push((slice[i] - slice[i - 1]) / slice[i - 1]);
  }

  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / returns.length;
  return Math.sqrt(variance);
}

function summarizeHistoricalMetrics(history = []) {
  const normalized = normalizePriceHistory(history);
  if (!normalized.length) {
    return {
      currentPrice: 0,
      sampleSize: 0,
      returns: {
        oneWeek: 0,
        oneMonth: 0,
        threeMonths: 0,
        oneYear: 0,
        fiveYears: 0
      },
      volatility: {
        thirtyDay: 0,
        oneYear: 0
      },
      range52Week: {
        high: 0,
        low: 0
      },
      avgVolume30Day: 0
    };
  }

  const closes = normalized.map((entry) => entry.close);
  const last252 = normalized.slice(-252);
  const last30 = normalized.slice(-30);

  return {
    currentPrice: closes[closes.length - 1],
    sampleSize: normalized.length,
    returns: {
      oneWeek: calculateReturn(closes, 5),
      oneMonth: calculateReturn(closes, 21),
      threeMonths: calculateReturn(closes, 63),
      oneYear: calculateReturn(closes, 252),
      fiveYears: calculateReturn(closes, Math.min(closes.length - 1, 252 * 5 - 1))
    },
    volatility: {
      thirtyDay: calculateVolatility(closes, 30),
      oneYear: calculateVolatility(closes, Math.min(252, closes.length - 1))
    },
    range52Week: {
      high: last252.length ? Math.max(...last252.map((entry) => entry.high)) : closes[closes.length - 1],
      low: last252.length ? Math.min(...last252.map((entry) => entry.low)) : closes[closes.length - 1]
    },
    avgVolume30Day: last30.length
      ? Math.round(last30.reduce((sum, entry) => sum + entry.volume, 0) / last30.length)
      : 0
  };
}

function summarizeNewsMetrics(articles = []) {
  const sentimentMap = { positive: 1, neutral: 0, negative: -1 };
  const validArticles = articles.filter(Boolean);
  const redditArticles = validArticles.filter((article) => article.source === 'reddit');
  const sentimentTotal = validArticles.reduce((sum, article) => sum + (sentimentMap[article.sentiment] || 0), 0);
  const normalizedSentiment = validArticles.length
    ? clamp(sentimentTotal / validArticles.length, -1, 1)
    : 0;

  return {
    articleCount: validArticles.length,
    redditMentions: redditArticles.length,
    sentimentScore: normalizedSentiment,
    positiveCount: validArticles.filter((article) => article.sentiment === 'positive').length,
    negativeCount: validArticles.filter((article) => article.sentiment === 'negative').length,
    neutralCount: validArticles.filter((article) => article.sentiment === 'neutral').length,
    topHeadlines: validArticles.slice(0, 5).map((article) => ({
      title: article.title,
      source: article.source,
      sentiment: article.sentiment,
      published_at: article.published_at
    }))
  };
}

function summarizeCalibrationMetrics(checks = []) {
  const validChecks = checks.filter((check) =>
    Number.isFinite(Number(check.predicted_price)) && Number.isFinite(Number(check.actual_price))
  );

  if (!validChecks.length) {
    return {
      totalChecks: 0,
      accuracyRate: 0,
      meanAbsoluteError: 0,
      meanError: 0
    };
  }

  const errors = validChecks.map((check) => Number(check.actual_price) - Number(check.predicted_price));
  const absoluteErrors = errors.map((value) => Math.abs(value));
  const correctChecks = validChecks.filter((check) => Boolean(check.was_correct)).length;

  return {
    totalChecks: validChecks.length,
    accuracyRate: correctChecks / validChecks.length,
    meanAbsoluteError: absoluteErrors.reduce((sum, value) => sum + value, 0) / absoluteErrors.length,
    meanError: errors.reduce((sum, value) => sum + value, 0) / errors.length
  };
}

function createDeterministicForecast({
  ticker,
  currentPrice,
  targetDates,
  historicalMetrics,
  newsMetrics,
  technicalSummary,
  calibrationMetrics
}) {
  const technicalBias = clamp(((parseFloat(technicalSummary?.bullishScore) || 50) - 50) / 50, -1, 1);
  const volatilityPenalty = clamp(historicalMetrics.volatility.oneYear * 1.5, 0, 0.12);
  const calibrationBias = currentPrice > 0 ? calibrationMetrics.meanError / currentPrice : 0;
  const signalScore = clamp(
    (historicalMetrics.returns.oneMonth * 0.28) +
    (historicalMetrics.returns.threeMonths * 0.2) +
    (historicalMetrics.returns.oneYear * 0.16) +
    (historicalMetrics.returns.fiveYears * 0.08) +
    (newsMetrics.sentimentScore * 0.12) +
    (clamp(newsMetrics.redditMentions / 20, 0, 1) * 0.05) +
    (technicalBias * 0.22) -
    volatilityPenalty -
    (calibrationBias * 0.35),
    -0.25,
    0.25
  );

  const baseMoveWednesday = clamp(signalScore * 0.45, -0.12, 0.12);
  const baseMoveFriday = clamp(signalScore * 0.75, -0.18, 0.18);
  const uncertainty = clamp(
    historicalMetrics.volatility.thirtyDay * 2.5 + (calibrationMetrics.meanAbsoluteError / Math.max(currentPrice, 1)),
    0.03,
    0.12
  );
  const confidence = clamp(
    0.52 +
    (Math.abs(technicalBias) * 0.12) +
    (Math.abs(newsMetrics.sentimentScore) * 0.08) +
    (calibrationMetrics.accuracyRate * 0.12) -
    (historicalMetrics.volatility.oneYear * 0.25),
    0.35,
    0.9
  );

  const buildRange = (movePct, uplift = 1) => {
    const mid = currentPrice * (1 + movePct - calibrationBias * uplift);
    const spread = Math.max(currentPrice * uncertainty, currentPrice * 0.025);
    return {
      low: roundPrice(mid - spread),
      mid: roundPrice(mid),
      high: roundPrice(mid + spread),
      confidence: roundPrice(confidence)
    };
  };

  const wednesday = buildRange(baseMoveWednesday, 0.5);
  const friday = buildRange(baseMoveFriday, 1);

  return {
    ticker,
    targetDates,
    outlook: signalScore > 0.03 ? 'bullish' : signalScore < -0.03 ? 'bearish' : 'neutral',
    rationale: `Deterministic fallback used. Signal score ${signalScore.toFixed(3)} combines multi-period trend, technical bias, recent sentiment, reddit activity, and recent forecast calibration.`,
    factorWeights: {
      historicalTrend: 0.72,
      newsSentiment: 0.12,
      redditActivity: 0.05,
      technicalSignals: 0.22,
      calibrationBias: 0.35,
      volatilityPenalty: 1.5
    },
    priceTargets: {
      wednesday,
      friday
    }
  };
}

module.exports = {
  clamp,
  roundPrice,
  normalizePriceHistory,
  summarizeHistoricalMetrics,
  summarizeNewsMetrics,
  summarizeCalibrationMetrics,
  createDeterministicForecast
};
