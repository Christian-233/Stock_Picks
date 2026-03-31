const { FEATURE_ORDER, trainThresholdModel, predictThresholdReturn } = require('./ml-model');

describe('ml-model', () => {
  test('trains a direct threshold model and predicts numeric output', () => {
    const examples = Array.from({ length: 10 }, (_, index) => ({
      features: Object.fromEntries(FEATURE_ORDER.map((featureName, featureIndex) => [featureName, (index + featureIndex) * 0.1])),
      targetThresholdReturn: 0.01 * index
    }));

    const model = trainThresholdModel(examples, { estimators: 12, learningRate: 0.1 });
    const prediction = predictThresholdReturn(examples[0].features, model);

    expect(model.trainingExamples).toBe(10);
    expect(model.type).toBe('quantile_gbdt_stumps');
    expect(prediction).toEqual(expect.any(Number));
  });

  test('feature order includes benchmark-relative features', () => {
    expect(FEATURE_ORDER).toEqual(expect.arrayContaining([
      'relativeReturnVsSpy1MPct',
      'relativeReturnVsQqq3MPct',
      'benchmarkMomentumPct',
      'benchmarkCorrelationPct',
      'sourceDiversityScore',
      'newsRecencyScore',
      'redditEngagementScore'
    ]));
  });

  test('supports weighted examples for recency/source-aware training', () => {
    const examples = [
      {
        features: Object.fromEntries(FEATURE_ORDER.map((featureName) => [featureName, 1])),
        targetThresholdReturn: 0.12,
        sampleWeight: 1.2
      },
      {
        features: Object.fromEntries(FEATURE_ORDER.map((featureName) => [featureName, -1])),
        targetThresholdReturn: -0.1,
        sampleWeight: 0.2
      }
    ];

    const model = trainThresholdModel(examples, { estimators: 8, learningRate: 0.1 });
    const prediction = predictThresholdReturn(examples[0].features, model);

    expect(model.trainingExamples).toBe(2);
    expect(prediction).toEqual(expect.any(Number));
  });
});
