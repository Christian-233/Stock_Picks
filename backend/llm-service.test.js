describe('llm-service', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('returns the local model name', () => {
    const signalService = require('./llm-service');

    expect(signalService.getModelName()).toBe('local-signal-engine-v1');
  });

  test('builds a bullish local signal assessment from supportive context', async () => {
    const signalService = require('./llm-service');

    const assessment = await signalService.generateSignalAssessment({
      currentPrice: 150,
      factorSnapshot: {
        oneWeekReturnPct: 4,
        oneMonthReturnPct: 8,
        threeMonthReturnPct: 12,
        oneYearReturnPct: 20,
        relativeReturnVsSpy1MPct: 5
      },
      technicalSummary: {
        bullishScore: 68
      },
      newsMetrics: {
        sentimentScore: 0.7,
        articleCount: 8,
        positiveCount: 6,
        negativeCount: 1,
        redditMentions: 4
      },
      historicalMetrics: {
        volatility: {
          thirtyDay: 0.02,
          oneYear: 0.03
        }
      },
      calibrationMetrics: {
        meanAbsoluteError: 1.2,
        accuracyRate: 0.68
      },
      dataQuality: {
        score: 82
      }
    });

    expect(assessment.modelName).toBe('local-signal-engine-v1');
    expect(assessment.outlook).toBe('bullish');
    expect(assessment.signalScore).toBeGreaterThan(0);
    expect(assessment.weightAdjustments.newsSentiment).toEqual(expect.any(Number));
  });

  test('adds caution when volatility and calibration are weak', async () => {
    const signalService = require('./llm-service');

    const assessment = await signalService.generateSignalAssessment({
      currentPrice: 150,
      factorSnapshot: {
        oneWeekReturnPct: -3,
        oneMonthReturnPct: -5,
        threeMonthReturnPct: -9,
        oneYearReturnPct: -12,
        relativeReturnVsSpy1MPct: -4
      },
      technicalSummary: {
        bullishScore: 38
      },
      newsMetrics: {
        sentimentScore: -0.5,
        articleCount: 3,
        positiveCount: 0,
        negativeCount: 2,
        redditMentions: 1
      },
      historicalMetrics: {
        volatility: {
          thirtyDay: 0.06,
          oneYear: 0.09
        }
      },
      calibrationMetrics: {
        meanAbsoluteError: 7,
        accuracyRate: 0.35
      },
      dataQuality: {
        score: 58
      }
    });

    expect(assessment.outlook).toBe('bearish');
    expect(assessment.confidenceAdjustment).toBeLessThan(0.1);
    expect(assessment.rationale).toContain('volatility');
  });
});
