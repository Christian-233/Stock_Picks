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
      modelName: 'gpt-4.1',
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

    expect(result).toHaveLength(1);
    expect(llmService.generateSignalAssessment).toHaveBeenCalled();
    expect(result[0].learningInputs.priceSource).toBe('yahoo-finance');
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
        'gpt-4.1+linear-return-v1',
        expect.any(String),
        expect.any(String)
      ])
    );
  });

  test('stores realized outcome data when accuracy is checked', async () => {
    stockData.getStockPrice.mockResolvedValueOnce({ price: 155, source: 'yahoo-finance' });

    const result = await aiPredictor.checkAccuracy('AAPL', 111);

    expect(result.wasCorrect).toBe(true);
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

  test('returns not-trained status when insufficient 3-year examples exist', async () => {
    const learning = await aiPredictor.retrainLearningModels();

    expect(learning.wednesday).toEqual({ trained: false, examples: 0 });
    expect(learning.friday).toEqual({ trained: false, examples: 0 });
  });
});
