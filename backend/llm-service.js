const { clamp, roundPrice } = require('./prediction-math');

const LOCAL_MODEL_NAME = 'local-signal-engine-v1';

function getModelName() {
  return LOCAL_MODEL_NAME;
}

function normalizeScore(value, divisor = 1) {
  return clamp(Number(value || 0) / divisor, -1, 1);
}

function buildFactorScores(context = {}) {
  const trendScore = clamp(
    normalizeScore(context.factorSnapshot?.oneWeekReturnPct, 8) * 0.15 +
    normalizeScore(context.factorSnapshot?.oneMonthReturnPct, 15) * 0.2 +
    normalizeScore(context.factorSnapshot?.threeMonthReturnPct, 25) * 0.25 +
    normalizeScore(context.factorSnapshot?.oneYearReturnPct, 40) * 0.2 +
    normalizeScore(context.factorSnapshot?.relativeReturnVsSpy1MPct, 12) * 0.2,
    -1,
    1
  );

  const technicalScore = clamp(
    ((Number(context.technicalSummary?.bullishScore || 50) - 50) / 50),
    -1,
    1
  );

  const newsScore = clamp(
    normalizeScore(context.newsMetrics?.sentimentScore, 1) * 0.75 +
    normalizeScore(context.newsMetrics?.articleCount, 12) * 0.15 +
    normalizeScore(context.newsMetrics?.positiveCount - context.newsMetrics?.negativeCount, 6) * 0.1,
    -1,
    1
  );

  const redditScore = clamp(
    normalizeScore(context.newsMetrics?.redditMentions, 6) * 0.7 +
    normalizeScore(context.newsMetrics?.sentimentScore, 1) * 0.3,
    -1,
    1
  );

  const volatilityPenalty = clamp(
    normalizeScore(context.historicalMetrics?.volatility?.thirtyDay, 0.04) * 0.65 +
    normalizeScore(context.historicalMetrics?.volatility?.oneYear, 0.08) * 0.35,
    0,
    1
  );

  const calibrationPenalty = clamp(
    normalizeScore(context.calibrationMetrics?.meanAbsoluteError, Math.max(Number(context.currentPrice || 1) * 0.03, 1)) * 0.6 +
    normalizeScore(-(context.calibrationMetrics?.accuracyRate || 0) + 0.5, 0.5) * 0.4,
    -1,
    1
  );

  return {
    trendScore,
    technicalScore,
    newsScore,
    redditScore,
    volatilityPenalty,
    calibrationPenalty
  };
}

function deriveWeightAdjustments(scores = {}) {
  return {
    historicalTrend: roundPrice(scores.trendScore * 0.05),
    technicalSignals: roundPrice(scores.technicalScore * 0.05),
    newsSentiment: roundPrice(scores.newsScore * 0.05),
    redditSentiment: roundPrice(scores.redditScore * 0.04),
    volatilityControl: roundPrice(scores.volatilityPenalty * 0.06),
    calibrationAdjustment: roundPrice(scores.calibrationPenalty * 0.05)
  };
}

function buildRationale(scores = {}) {
  const observations = [];

  if (scores.trendScore > 0.2) {
    observations.push('trend is supportive across recent horizons');
  } else if (scores.trendScore < -0.2) {
    observations.push('trend is deteriorating across recent horizons');
  }

  if (scores.technicalScore > 0.15) {
    observations.push('technical signals are leaning bullish');
  } else if (scores.technicalScore < -0.15) {
    observations.push('technical signals are leaning bearish');
  }

  if (scores.newsScore > 0.15) {
    observations.push('recent news flow is supportive');
  } else if (scores.newsScore < -0.15) {
    observations.push('recent news flow is a headwind');
  }

  if (scores.redditScore > 0.2) {
    observations.push('social activity is reinforcing upside interest');
  }

  if (scores.volatilityPenalty > 0.35) {
    observations.push('volatility is elevated, so thresholds should stay conservative');
  }

  if (scores.calibrationPenalty > 0.25) {
    observations.push('recent forecast error suggests keeping confidence restrained');
  }

  return observations.length
    ? observations.join('; ')
    : 'local signal engine found a mixed setup with no dominant directional factor';
}

function deriveOutlook(signalScore) {
  if (signalScore > 0.12) {
    return 'bullish';
  }

  if (signalScore < -0.12) {
    return 'bearish';
  }

  return 'neutral';
}

async function generateSignalAssessment(context = {}) {
  const scores = buildFactorScores(context);
  const signalScore = clamp(
    (scores.trendScore * 0.3) +
    (scores.technicalScore * 0.24) +
    (scores.newsScore * 0.2) +
    (scores.redditScore * 0.08) -
    (scores.volatilityPenalty * 0.1) -
    (scores.calibrationPenalty * 0.08),
    -1,
    1
  );
  const confidenceAdjustment = clamp(
    0.04 +
    ((1 - scores.volatilityPenalty) * 0.08) -
    (scores.calibrationPenalty * 0.05) +
    ((context.dataQuality?.score || 70) - 70) / 500,
    -0.2,
    0.2
  );

  return {
    outlook: deriveOutlook(signalScore),
    rationale: buildRationale(scores),
    signalScore: roundPrice(signalScore),
    confidenceAdjustment: roundPrice(confidenceAdjustment),
    weightAdjustments: deriveWeightAdjustments(scores),
    modelName: LOCAL_MODEL_NAME
  };
}

module.exports = {
  generateSignalAssessment,
  getModelName,
  buildFactorScores,
  deriveWeightAdjustments,
  buildRationale
};
