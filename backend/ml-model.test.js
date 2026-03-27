const { FEATURE_ORDER, trainReturnModel, predictReturn } = require('./ml-model');

describe('ml-model', () => {
  test('trains a simple return model and predicts numeric output', () => {
    const examples = Array.from({ length: 10 }, (_, index) => ({
      features: Object.fromEntries(FEATURE_ORDER.map((featureName, featureIndex) => [featureName, (index + featureIndex) * 0.1])),
      targetReturn: 0.01 * index
    }));

    const model = trainReturnModel(examples, { epochs: 500, learningRate: 0.001 });
    const prediction = predictReturn(examples[0].features, model);

    expect(model.trainingExamples).toBe(10);
    expect(prediction).toEqual(expect.any(Number));
  });
});
