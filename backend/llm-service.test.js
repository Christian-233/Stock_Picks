describe('llm-service', () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalModel = process.env.OPENAI_MODEL;

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    if (originalApiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalApiKey;
    }

    if (originalModel === undefined) {
      delete process.env.OPENAI_MODEL;
    } else {
      process.env.OPENAI_MODEL = originalModel;
    }
  });

  test('extracts JSON payloads from wrapped model output', () => {
    const llmService = require('./llm-service');

    expect(llmService.extractJson('Answer:\n{"outlook":"bullish"}')).toEqual({ outlook: 'bullish' });
  });

  test('falls back to neutral signal assessment when OpenAI key is missing', async () => {
    delete process.env.OPENAI_API_KEY;
    const llmService = require('./llm-service');

    const assessment = await llmService.generateSignalAssessment({
      ticker: 'AAPL',
      currentPrice: 100
    });

    expect(assessment.modelName).toBe('deterministic-fallback');
    expect(assessment.signalScore).toBe(0);
    expect(assessment.outlook).toBe('neutral');
  });
});
