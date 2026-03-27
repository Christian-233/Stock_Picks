const { clamp } = require('./prediction-math');

const FEATURE_ORDER = [
  'oneWeekReturnPct',
  'oneMonthReturnPct',
  'threeMonthReturnPct',
  'oneYearReturnPct',
  'fiveYearReturnPct',
  'volatility30DayPct',
  'volatility1YearPct',
  'newsSentimentScore',
  'redditMentions',
  'articleCount',
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

function predictReturn(featureSnapshot, model) {
  if (!model?.coefficients) {
    return 0;
  }

  const features = getFeatureVector(featureSnapshot);
  const raw = features.reduce(
    (sum, value, index) => sum + (value * Number(model.coefficients[index] || 0)),
    Number(model.intercept || 0)
  );

  return clamp(raw, -0.25, 0.25);
}

function trainReturnModel(examples, options = {}) {
  const learningRate = options.learningRate || 0.00002;
  const epochs = options.epochs || 3000;
  const regularization = options.regularization || 0.0001;
  const coefficients = FEATURE_ORDER.map(() => 0);
  let intercept = 0;

  if (!examples.length) {
    return {
      intercept,
      coefficients,
      trainingExamples: 0,
      mae: 0,
      rmse: 0
    };
  }

  for (let epoch = 0; epoch < epochs; epoch += 1) {
    let interceptGradient = 0;
    const coefficientGradients = FEATURE_ORDER.map(() => 0);

    examples.forEach((example) => {
      const features = getFeatureVector(example.features);
      const prediction = intercept + features.reduce(
        (sum, value, index) => sum + (coefficients[index] * value),
        0
      );
      const error = prediction - example.targetReturn;

      interceptGradient += error;
      features.forEach((value, index) => {
        coefficientGradients[index] += error * value;
      });
    });

    intercept -= learningRate * (interceptGradient / examples.length);
    coefficients.forEach((coefficient, index) => {
      const gradient = (coefficientGradients[index] / examples.length) + (regularization * coefficient);
      coefficients[index] -= learningRate * gradient;
    });
  }

  const predictions = examples.map((example) => {
    const predicted = predictReturn(example.features, { intercept, coefficients });
    return {
      error: predicted - example.targetReturn
    };
  });

  const mae = predictions.reduce((sum, item) => sum + Math.abs(item.error), 0) / predictions.length;
  const rmse = Math.sqrt(predictions.reduce((sum, item) => sum + (item.error ** 2), 0) / predictions.length);

  return {
    intercept,
    coefficients,
    trainingExamples: examples.length,
    mae,
    rmse
  };
}

module.exports = {
  FEATURE_ORDER,
  getFeatureVector,
  predictReturn,
  trainReturnModel
};
