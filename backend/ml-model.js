const { clamp } = require('./prediction-math');

const FEATURE_ORDER = [
  'oneWeekReturnPct',
  'oneMonthReturnPct',
  'threeMonthReturnPct',
  'oneYearReturnPct',
  'fiveYearReturnPct',
  'relativeReturnVsSpy1MPct',
  'relativeReturnVsSpy3MPct',
  'relativeReturnVsQqq1MPct',
  'relativeReturnVsQqq3MPct',
  'benchmarkMomentumPct',
  'benchmarkCorrelationPct',
  'volatility30DayPct',
  'volatility1YearPct',
  'newsSentimentScore',
  'redditMentions',
  'articleCount',
  'sourceDiversityCount',
  'sourceDiversityScore',
  'newsRecencyScore',
  'newsQualityScore',
  'redditEngagementScore',
  'redditPostRatioPct',
  'technicalBullishScore',
  'recentAccuracyRatePct',
  'recentMeanAbsoluteError',
  'recentMeanError',
  'priceSourceReliabilityPct',
  'historySourceReliabilityPct'
];

function getFeatureVector(featureSnapshot = {}) {
  return FEATURE_ORDER.map((featureName) => Number(featureSnapshot[featureName] || 0));
}

function getExampleWeight(example = {}) {
  const weight = Number(example.sampleWeight || 1);
  if (!Number.isFinite(weight) || weight <= 0) {
    return 1;
  }
  return weight;
}

function calculateQuantile(values, quantile, weights = null) {
  if (!values.length) {
    return 0;
  }

  if (!weights || weights.length !== values.length) {
    const sorted = [...values].sort((a, b) => a - b);
    const index = clamp(quantile, 0, 1) * (sorted.length - 1);
    const lowerIndex = Math.floor(index);
    const upperIndex = Math.ceil(index);
    if (lowerIndex === upperIndex) {
      return sorted[lowerIndex];
    }

    const interpolationWeight = index - lowerIndex;
    return sorted[lowerIndex] + ((sorted[upperIndex] - sorted[lowerIndex]) * interpolationWeight);
  }

  const pairs = values.map((value, index) => ({
    value,
    weight: Math.max(0, Number(weights[index] || 0))
  })).sort((a, b) => a.value - b.value);
  const totalWeight = pairs.reduce((sum, pair) => sum + pair.weight, 0);
  if (!totalWeight) {
    return pairs[Math.floor((pairs.length - 1) * clamp(quantile, 0, 1))].value;
  }

  const targetWeight = clamp(quantile, 0, 1) * totalWeight;
  let runningWeight = 0;
  for (const pair of pairs) {
    runningWeight += pair.weight;
    if (runningWeight >= targetWeight) {
      return pair.value;
    }
  }

  return pairs[pairs.length - 1].value;
}

function weightedMean(values, weights) {
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  if (!totalWeight) {
    return 0;
  }

  return values.reduce((sum, value, index) => sum + (value * weights[index]), 0) / totalWeight;
}

function getCandidateThresholds(values) {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length < 4) {
    return [];
  }

  const quantiles = [0.15, 0.3, 0.45, 0.55, 0.7, 0.85];
  return [...new Set(quantiles.map((quantile) => calculateQuantile(sorted, quantile)))];
}

function fitDecisionStump(examples, residuals, sampleWeights) {
  let bestStump = null;
  let bestLoss = Number.POSITIVE_INFINITY;

  for (let featureIndex = 0; featureIndex < FEATURE_ORDER.length; featureIndex += 1) {
    const featureValues = examples.map((example) => example.vector[featureIndex]);
    const thresholds = getCandidateThresholds(featureValues);

    thresholds.forEach((threshold) => {
      const leftResiduals = [];
      const leftWeights = [];
      const rightResiduals = [];
      const rightWeights = [];

      examples.forEach((example, index) => {
        if (example.vector[featureIndex] <= threshold) {
          leftResiduals.push(residuals[index]);
          leftWeights.push(sampleWeights[index]);
        } else {
          rightResiduals.push(residuals[index]);
          rightWeights.push(sampleWeights[index]);
        }
      });

      if (!leftResiduals.length || !rightResiduals.length) {
        return;
      }

      const leftValue = weightedMean(leftResiduals, leftWeights);
      const rightValue = weightedMean(rightResiduals, rightWeights);
      const loss = examples.reduce((sum, example, index) => {
        const prediction = example.vector[featureIndex] <= threshold ? leftValue : rightValue;
        const error = residuals[index] - prediction;
        return sum + (sampleWeights[index] * (error ** 2));
      }, 0);

      if (loss < bestLoss) {
        bestLoss = loss;
        bestStump = {
          featureIndex,
          threshold,
          leftValue,
          rightValue
        };
      }
    });
  }

  return bestStump;
}

function predictThresholdReturn(featureSnapshot, model) {
  if (!model) {
    return 0;
  }

  if (model.type === 'quantile_gbdt_stumps') {
    const vector = getFeatureVector(featureSnapshot);
    const raw = (model.baseValue || 0) + (model.trees || []).reduce((sum, tree) => {
      const branchValue = vector[tree.featureIndex] <= tree.threshold ? tree.leftValue : tree.rightValue;
      return sum + branchValue;
    }, 0);
    return clamp(raw, -0.25, 0.25);
  }

  if (model.coefficients) {
    const vector = getFeatureVector(featureSnapshot);
    const raw = vector.reduce(
      (sum, value, index) => sum + (value * Number(model.coefficients[index] || 0)),
      Number(model.intercept || 0)
    );
    return clamp(raw, -0.25, 0.25);
  }

  return 0;
}

function trainThresholdModel(examples, options = {}) {
  const quantile = options.quantile || 0.35;
  const estimators = options.estimators || 40;
  const learningRate = options.learningRate || 0.08;

  if (!examples.length) {
    return {
      type: 'quantile_gbdt_stumps',
      quantile,
      learningRate,
      estimators: 0,
      baseValue: 0,
      trees: [],
      trainingExamples: 0,
      mae: 0,
      rmse: 0
    };
  }

  const prepared = examples.map((example) => ({
    vector: getFeatureVector(example.features),
    targetThresholdReturn: Number(example.targetThresholdReturn),
    sampleWeight: getExampleWeight(example)
  }));
  const sampleWeights = prepared.map((example) => example.sampleWeight);
  const baseValue = calculateQuantile(
    prepared.map((example) => example.targetThresholdReturn),
    quantile,
    sampleWeights
  );
  const predictions = prepared.map(() => baseValue);
  const trees = [];

  for (let estimatorIndex = 0; estimatorIndex < estimators; estimatorIndex += 1) {
    const residuals = prepared.map((example, index) =>
      example.targetThresholdReturn > predictions[index] ? quantile : quantile - 1
    );
    const stump = fitDecisionStump(prepared, residuals, sampleWeights);
    if (!stump) {
      break;
    }

    const scaledStump = {
      ...stump,
      leftValue: stump.leftValue * learningRate,
      rightValue: stump.rightValue * learningRate
    };
    trees.push(scaledStump);

    prepared.forEach((example, index) => {
      predictions[index] += example.vector[scaledStump.featureIndex] <= scaledStump.threshold
        ? scaledStump.leftValue
        : scaledStump.rightValue;
    });
  }

  const errors = prepared.map((example, index) => clamp(predictions[index], -0.25, 0.25) - example.targetThresholdReturn);
  const totalWeight = sampleWeights.reduce((sum, weight) => sum + weight, 0) || 1;
  const mae = errors.reduce((sum, value, index) => sum + (Math.abs(value) * sampleWeights[index]), 0) / totalWeight;
  const rmse = Math.sqrt(errors.reduce((sum, value, index) => sum + ((value ** 2) * sampleWeights[index]), 0) / totalWeight);

  return {
    type: 'quantile_gbdt_stumps',
    quantile,
    learningRate,
    estimators: trees.length,
    baseValue,
    trees,
    trainingExamples: examples.length,
    mae,
    rmse
  };
}

module.exports = {
  FEATURE_ORDER,
  getFeatureVector,
  predictThresholdReturn,
  trainThresholdModel
};
