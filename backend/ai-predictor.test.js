jest.mock('./database', () => ({
  all: jest.fn(),
  get: jest.fn(),
  run: jest.fn()
}));

jest.mock('./news-scraper', () => ({
  scrapeAllNews: jest.fn().mockResolvedValue([])
}));

jest.mock('./stock-data', () => ({
  getStockPrice: jest.fn(),
  getHistoricalData: jest.fn()
}));

jest.mock('./technical-indicators', () => ({
  interpretAllSignals: jest.fn()
}));

jest.mock('./llm-service', () => ({
  generateSignalAssessment: jest.fn()
}));

const db = require('./database');
const stockData = require('./stock-data');
const technicalIndicators = require('./technical-indicators');
const llmService = require('./llm-service');
const aiPredictor = require('./ai-predictor');

describe('ai-predictor', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    stockData.getStockPrice.mockResolvedValue({ price: 150, source: 'yahoo-finance' });
    stockData.getHistoricalData.mockResolvedValue(
      Array.from({ length: 400 }, (_, index) => ({
        date: `2024-01-${String((index % 28) + 1).padStart(2, '0')}`,
        price: 100 + index,
        high: 101 + index,
        low: 99 + index,
        volume: 1000000 + (index * 1000)
      }))
    );
    technicalIndicators.interpretAllSignals.mockReturnValue({
      bullishScore: '62.0',
      indicators: {}
    });
    llmService.generateSignalAssessment.mockResolvedValue({
      modelName: 'local-signal-engine-v1',
      outlook: 'bullish',
      rationale: 'News and technicals currently favor upside.',
      signalScore: 0.45,
      confidenceAdjustment: 0.04,
      weightAdjustments: {
        newsSentiment: 0.03,
        technicalSignals: 0.02
      }
    });

    db.all.mockImplementation(async (sql) => {
      if (sql.includes('FROM news')) {
        return [
          { title: 'AAPL demand strong', source: 'newsapi', sentiment: 'positive', published_at: 1 },
          { title: 'AAPL discussed on Reddit', source: 'reddit', sentiment: 'positive', published_at: 1 }
        ];
      }

      if (sql.includes('FROM accuracy_checks') && sql.includes('LIMIT 10')) {
        return [
          { predicted_price: 148, actual_price: 151, was_correct: 1, checked_at: 1 }
        ];
      }

      if (sql.includes('JOIN predictions p ON p.id = a.prediction_id')) {
        return [];
      }

      return [];
    });

    db.get.mockImplementation(async (sql, params) => {
      if (sql.includes('FROM trained_models')) {
        return null;
      }

      if (sql.includes('SELECT * FROM predictions')) {
        return {
          id: 5,
          target_dates: JSON.stringify([111, 222]),
          predicted_prices: JSON.stringify([153, 156]),
          price_ranges: JSON.stringify([
            { low: 149, mid: 153, high: 157, confidence: 0.7 },
            { low: 151, mid: 156, high: 161, confidence: 0.68 }
          ]),
          signal_context: JSON.stringify({
            currentPrice: 150,
            currentPriceSource: 'yahoo-finance',
            historySource: 'yahoo-finance'
          })
        };
      }

      return null;
    });

    db.run.mockResolvedValue({ id: 1, changes: 1 });
  });

  test('persists predictions with feature snapshots and adaptive weights', async () => {
    const result = await aiPredictor.generateMondayPredictions(['aapl']);
    const predictions = result.predictions;

    expect(predictions).toHaveLength(1);
    expect(llmService.generateSignalAssessment).toHaveBeenCalled();
    expect(predictions[0].learningInputs.priceSource).toBe('yahoo-finance');
    expect(predictions[0].learningInputs.relativeReturnVsSpy1MPct).toEqual(expect.any(Number));
    expect(db.run).toHaveBeenCalledWith(
      expect.stringContaining('feature_snapshot'),
      expect.arrayContaining([
        'AAPL',
        expect.any(Number),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        'News and technicals currently favor upside.',
        'local-signal-engine-v1+threshold-gbdt-v2',
        expect.any(String),
        expect.any(String)
      ])
    );
  });

  test('stores realized outcome data when accuracy is checked', async () => {
    stockData.getStockPrice.mockResolvedValueOnce({ price: 155, source: 'yahoo-finance' });

    const result = await aiPredictor.checkAccuracy('AAPL', 111);

    expect(result.wasCorrect).toBe(true);
    expect(result.difference).toBe(2);
    expect(db.run).toHaveBeenCalledWith(
      expect.stringContaining('realized_return_pct'),
      [
        'AAPL',
        5,
        111,
        153,
        155,
        1,
        expect.any(Number),
        expect.any(Number),
        expect.any(String)
      ]
    );
  });

  test('marks prediction incorrect when actual close finishes below the predicted threshold', async () => {
    stockData.getStockPrice.mockResolvedValueOnce({ price: 150, source: 'yahoo-finance' });

    const result = await aiPredictor.checkAccuracy('AAPL', 222);

    expect(result.wasCorrect).toBe(false);
    expect(result.difference).toBe(-6);
  });

  test('returns not-trained status when insufficient 3-year examples exist', async () => {
    const learning = await aiPredictor.retrainLearningModels();

    expect(learning.wednesday).toEqual({
      trained: false,
      examples: 0,
      uniqueTickers: 0,
      classes: {}
    });
    expect(learning.friday).toEqual({
      trained: false,
      examples: 0,
      uniqueTickers: 0,
      classes: {}
    });
  });

  test('filters mock-source rows out of training examples and skips evaluation when insufficient clean samples remain', async () => {
    db.all.mockImplementation(async (sql) => {
      if (sql.includes('JOIN predictions p ON p.id = a.prediction_id')) {
        return [
          {
            feature_snapshot: JSON.stringify({
              priceSource: 'mock',
              historySource: 'mock',
              priceSourceReliabilityPct: 20,
              historySourceReliabilityPct: 20
            }),
            signal_context: JSON.stringify({
              currentPriceSource: 'mock',
              historySource: 'mock'
            }),
            model_name: 'deterministic-fallback+linear-return-v1',
            realized_return_pct: 0.01,
            outcome_snapshot: JSON.stringify({
              targetIndex: 0,
              actualPriceSource: 'mock'
            })
          }
        ];
      }
      return [];
    });

    const evaluation = await aiPredictor.evaluateModelWalkForward();

    expect(evaluation.wednesday).toEqual({ evaluated: false, examples: 0 });
    expect(evaluation.friday).toEqual({ evaluated: false, examples: 0 });
  });

  test('returns model insights with reliability and walk-forward sections', async () => {
    const insights = await aiPredictor.getModelInsights();

    expect(insights).toEqual(expect.objectContaining({
      currentWeights: expect.any(Object),
      sourceReliability: expect.any(Object),
      trainedModels: expect.any(Object),
      walkForward: expect.any(Object)
    }));
  });

  test('runs a self-training cycle with backfill and retrain pipeline', async () => {
    const result = await aiPredictor.runSelfTrainingCycle({
      evaluate: false,
      refreshBackfilled: false,
      trainingBackfillLimit: 100,
      accuracyBackfillLimit: 100
    });

    expect(result.success).toBe(true);
    expect(result.pipeline).toEqual(expect.objectContaining({
      legacyTraining: expect.any(Object),
      legacyAccuracy: expect.any(Object),
      training: expect.any(Object),
      walkForward: null
    }));

    const status = aiPredictor.getSelfTrainingStatus();
    expect(status.running).toBe(false);
    expect(status.lastResult).toEqual(expect.objectContaining({
      success: true
    }));
  });

  test('skips overlapping self-training cycles', async () => {
    let releaseBlockedQuery;
    const blockedQuery = new Promise((resolve) => {
      releaseBlockedQuery = resolve;
    });

    db.all.mockImplementation(async (sql) => {
      if (sql.includes('FROM predictions') && sql.includes('feature_snapshot IS NULL')) {
        await blockedQuery;
        return [];
      }

      if (sql.includes('JOIN predictions p ON p.id = a.prediction_id')) {
        return [];
      }

      return [];
    });

    const firstRun = aiPredictor.runSelfTrainingCycle({
      evaluate: false,
      refreshBackfilled: false,
      trainingBackfillLimit: 100,
      accuracyBackfillLimit: 100
    });

    await Promise.resolve();
    const secondRun = await aiPredictor.runSelfTrainingCycle({
      evaluate: false
    });
    expect(secondRun.skipped).toBe(true);
    expect(secondRun.reason).toBe('already_running');

    releaseBlockedQuery();
    const completed = await firstRun;
    expect(completed.success).toBe(true);
  });

  test('adjusts news and reddit weights from resolved signal feedback', async () => {
    const beforeWeights = aiPredictor.getWeightsForWeek();
    const feedbackRows = Array.from({ length: 220 }, () => ({
      feature_snapshot: JSON.stringify({
        priceSource: 'yahoo-finance',
        historySource: 'yahoo-finance',
        priceSourceReliabilityPct: 82,
        historySourceReliabilityPct: 82,
        newsSentimentScore: 0.9,
        redditMentions: 5,
        llmSignalScore: 0.7
      }),
      signal_context: JSON.stringify({
        currentPriceSource: 'yahoo-finance',
        historySource: 'yahoo-finance'
      }),
      realized_return_pct: 0.03,
      checked_at: Math.floor(Date.now() / 1000)
    }));

    db.all.mockImplementation(async (sql) => {
      if (sql.includes('a.realized_return_pct IS NOT NULL') && sql.includes('ORDER BY a.checked_at DESC')) {
        return feedbackRows;
      }

      if (sql.includes('FROM predictions') && sql.includes('feature_snapshot IS NULL')) {
        return [];
      }

      if (sql.includes('JOIN predictions p ON p.id = a.prediction_id')) {
        return [];
      }

      return [];
    });

    const result = await aiPredictor.runSelfTrainingCycle({
      evaluate: false,
      refreshBackfilled: false,
      trainingBackfillLimit: 100,
      accuracyBackfillLimit: 100
    });

    const afterWeights = aiPredictor.getWeightsForWeek();
    expect(result.pipeline.signalFeedback).toEqual(expect.objectContaining({
      applied: true,
      newsExamples: expect.any(Number),
      redditExamples: expect.any(Number)
    }));
    expect(result.pipeline.signalFeedback.newsAdjustment).toBeGreaterThan(0);
    expect(result.pipeline.signalFeedback.redditAdjustment).toBeGreaterThan(0);
    expect(afterWeights.newsSentiment).toBeGreaterThan(0);
    expect(afterWeights.redditSentiment).toBeGreaterThan(0);
    expect(beforeWeights.newsSentiment).toBeGreaterThan(0);
    expect(beforeWeights.redditSentiment).toBeGreaterThan(0);
  });

  test('uses blended class/global threshold model when both are available', async () => {
    db.get.mockImplementation(async (sql, params) => {
      if (sql.includes('FROM trained_models')) {
        const key = params?.[1];
        if (key === 'wednesday::global' || key === 'friday::global') {
          return {
            coefficients: JSON.stringify({
              type: 'quantile_gbdt_stumps',
              baseValue: -0.01,
              trees: [],
              trainingExamples: 100,
              mae: 0.02,
              rmse: 0.04
            }),
            training_examples: 100,
            mae: 0.02,
            rmse: 0.04
          };
        }

        return {
          coefficients: JSON.stringify({
            type: 'quantile_gbdt_stumps',
            baseValue: 0.02,
            trees: [],
            trainingExamples: 36,
            mae: 0.015,
            rmse: 0.03
          }),
          training_examples: 36,
          mae: 0.015,
          rmse: 0.03
        };
      }

      if (sql.includes('SELECT * FROM predictions')) {
        return {
          id: 5,
          target_dates: JSON.stringify([111, 222]),
          predicted_prices: JSON.stringify([153, 156]),
          signal_context: JSON.stringify({
            currentPrice: 150,
            currentPriceSource: 'yahoo-finance',
            historySource: 'yahoo-finance'
          })
        };
      }

      return null;
    });

    const result = await aiPredictor.generateMondayPredictions(['aapl']);

    expect(result.predictions).toHaveLength(1);
    const predictionInsert = db.run.mock.calls.find(([sql]) => sql.includes('INSERT INTO predictions'));
    expect(predictionInsert).toBeDefined();
    const insertedParams = predictionInsert[1];
    const persistedRanges = JSON.parse(insertedParams[5]);
    expect(persistedRanges[0].modelType).toContain('ensemble-');
    expect(persistedRanges[1].modelType).toContain('ensemble-');
  });

  test('requests training examples in chronological order for walk-forward evaluation', async () => {
    db.all.mockImplementation(async (sql) => {
      if (sql.includes('JOIN predictions p ON p.id = a.prediction_id')) {
        return [];
      }
      return [];
    });

    await aiPredictor.evaluateModelWalkForward();

    const trainingQueryCall = db.all.mock.calls.find(([sql]) => sql.includes('JOIN predictions p ON p.id = a.prediction_id'));
    expect(trainingQueryCall).toBeDefined();
    expect(trainingQueryCall[0]).toContain('ORDER BY a.checked_at ASC, a.id ASC');
  });

  test('backfills legacy prediction feature snapshots for training', async () => {
    stockData.getHistoricalData.mockImplementation(async (ticker) => (
      Array.from({ length: 400 }, (_, index) => ({
        date: `2024-01-${String((index % 28) + 1).padStart(2, '0')}`,
        price: 100 + index,
        high: 101 + index,
        low: 99 + index,
        volume: 1000000 + (index * 1000),
        source: ticker === 'AAPL' ? 'legacy-source' : 'benchmark-source'
      }))
    ));

    db.all.mockImplementation(async (sql) => {
      if (sql.includes("WHERE (feature_snapshot IS NULL OR feature_snapshot = '')")) {
        return [
          {
            id: 42,
            ticker: 'AAPL',
            prediction_date: Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60),
            target_dates: JSON.stringify([111, 222])
          }
        ];
      }

      if (sql.includes('FROM news')) {
        return [
          { title: 'AAPL demand strong', source: 'newsapi', sentiment: 'positive', published_at: 1 }
        ];
      }

      if (sql.includes('FROM accuracy_checks') && sql.includes('checked_at <')) {
        return [];
      }

      if (sql.includes('FROM accuracy_checks') && sql.includes('LIMIT 10')) {
        return [];
      }

      if (sql.includes('JOIN predictions p ON p.id = a.prediction_id')) {
        return [];
      }

      return [];
    });

    const result = await aiPredictor.backfillLegacyTrainingData();

    expect(result.updated).toBe(1);
    expect(db.run).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE predictions'),
      [
        expect.any(String),
        expect.any(String),
        'local-signal-engine-v1+backfilled-v1',
        42
      ]
    );
  });

  test('skips legacy feature backfill when historical source is mock', async () => {
    stockData.getHistoricalData.mockResolvedValueOnce(
      Array.from({ length: 400 }, (_, index) => ({
        date: `2024-01-${String((index % 28) + 1).padStart(2, '0')}`,
        price: 100 + index,
        high: 101 + index,
        low: 99 + index,
        volume: 1000000 + (index * 1000),
        source: 'mock'
      }))
    );
    stockData.getHistoricalData.mockResolvedValueOnce(
      Array.from({ length: 400 }, (_, index) => ({
        date: `2024-01-${String((index % 28) + 1).padStart(2, '0')}`,
        price: 300 + index,
        high: 301 + index,
        low: 299 + index,
        volume: 1000000 + (index * 1000),
        source: 'mock'
      }))
    );
    stockData.getHistoricalData.mockResolvedValueOnce(
      Array.from({ length: 400 }, (_, index) => ({
        date: `2024-01-${String((index % 28) + 1).padStart(2, '0')}`,
        price: 200 + index,
        high: 201 + index,
        low: 199 + index,
        volume: 1000000 + (index * 1000),
        source: 'mock'
      }))
    );

    db.all.mockImplementation(async (sql) => {
      if (sql.includes("WHERE (feature_snapshot IS NULL OR feature_snapshot = '')")) {
        return [
          {
            id: 91,
            ticker: 'AAPL',
            prediction_date: Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60),
            target_dates: JSON.stringify([111, 222])
          }
        ];
      }
      return [];
    });

    const result = await aiPredictor.backfillLegacyTrainingData();

    expect(result.updated).toBe(0);
    expect(result.skipped).toBe(1);
  });

  test('backfills legacy accuracy rows into labeled training examples', async () => {
    db.all.mockImplementation(async (sql) => {
      if (sql.includes('FROM accuracy_checks a') && sql.includes('p.signal_context IS NOT NULL')) {
        return [
          {
            id: 77,
            ticker: 'AAPL',
            target_date: 222,
            predicted_price: 153,
            actual_price: 155,
            was_correct: null,
            target_dates: JSON.stringify([111, 222]),
            signal_context: JSON.stringify({
              currentPrice: 150,
              currentPriceSource: 'legacy-source'
            })
          }
        ];
      }

      return [];
    });

    const result = await aiPredictor.backfillLegacyAccuracyChecks();

    expect(result.updated).toBe(1);
    expect(db.run).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE accuracy_checks'),
      [
        expect.any(Number),
        expect.any(Number),
        expect.any(String),
        1,
        77
      ]
    );
  });

  test('excludes predictions when source quality is too weak', async () => {
    stockData.getHistoricalData.mockResolvedValueOnce(
      Array.from({ length: 120 }, (_, index) => ({
        date: `2024-01-${String((index % 28) + 1).padStart(2, '0')}`,
        price: 100 + index,
        high: 101 + index,
        low: 99 + index,
        volume: 1000000 + (index * 1000),
        source: 'yahoo-finance'
      }))
    );
    db.all.mockImplementation(async (sql) => {
      if (sql.includes('FROM news')) {
        return [];
      }

      if (sql.includes('FROM accuracy_checks') && sql.includes('LIMIT 10')) {
        return [];
      }

      if (sql.includes('JOIN predictions p ON p.id = a.prediction_id') && sql.includes('a.error_pct IS NOT NULL')) {
        return [
          {
            error_pct: 0.75,
            checked_at: 1,
            signal_context: JSON.stringify({
              currentPriceSource: 'yahoo-finance',
              historySource: 'yahoo-finance'
            })
          }
        ];
      }

      if (sql.includes('JOIN predictions p ON p.id = a.prediction_id')) {
        return [];
      }

      return [];
    });

    await expect(aiPredictor.generateMondayPredictions(['aapl'])).rejects.toThrow(
      'No predictions could be generated'
    );
  });

  test('marks mock data sources with weak reliability in feature snapshot', async () => {
    stockData.getStockPrice.mockResolvedValueOnce({ price: 150, source: 'mock' });
    stockData.getHistoricalData.mockResolvedValueOnce(
      Array.from({ length: 400 }, (_, index) => ({
        date: `2024-01-${String((index % 28) + 1).padStart(2, '0')}`,
        price: 100 + index,
        high: 101 + index,
        low: 99 + index,
        volume: 1000000 + (index * 1000),
        source: 'mock'
      }))
    );

    await expect(aiPredictor.generateMondayPredictions(['aapl'])).rejects.toThrow(
      'No predictions could be generated'
    );
  });
});
