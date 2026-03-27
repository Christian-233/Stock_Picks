jest.mock('axios', () => ({
  get: jest.fn()
}));

describe('stock-data retry behavior', () => {
  let stockData;
  let mockDelay;
  let originalConsoleWarn;
  let originalConsoleLog;

  beforeEach(() => {
    jest.resetModules();
    stockData = require('./stock-data');
    mockDelay = jest.fn().mockResolvedValue(undefined);
    stockData.__resetYahooFinanceClient();
    stockData.__setDelayImplementation(mockDelay);
    originalConsoleWarn = console.warn;
    originalConsoleLog = console.log;
    console.warn = jest.fn();
    console.log = jest.fn();
  });

  afterEach(() => {
    stockData.__resetYahooFinanceClient();
    stockData.__setDelayImplementation((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    console.warn = originalConsoleWarn;
    console.log = originalConsoleLog;
  });

  test('retries yahoo finance quote on retriable errors and then succeeds', async () => {
    const quote = jest.fn()
      .mockRejectedValueOnce(new Error('429 Too Many Requests'))
      .mockRejectedValueOnce(new Error('Failed to get crumb'))
      .mockResolvedValueOnce({ regularMarketPrice: 123.45 });

    stockData.__setYahooFinanceClient({ quote });

    const result = await stockData.getYahooFinancePrice('AAPL');

    expect(quote).toHaveBeenCalledTimes(3);
    expect(mockDelay).toHaveBeenCalledTimes(2);
    expect(mockDelay).toHaveBeenNthCalledWith(1, 600);
    expect(mockDelay).toHaveBeenNthCalledWith(2, 1200);
    expect(result).toEqual(expect.objectContaining({
      ticker: 'AAPL',
      price: 123.45,
      source: 'yahoo-finance'
    }));
  });

  test('does not retry yahoo finance quote on non-retriable errors', async () => {
    const quote = jest.fn().mockRejectedValue(new Error('Symbol not found'));

    stockData.__setYahooFinanceClient({ quote });

    const result = await stockData.getYahooFinancePrice('AAPL');

    expect(quote).toHaveBeenCalledTimes(1);
    expect(mockDelay).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  test('retries yahoo finance history on retriable errors and then succeeds', async () => {
    const historical = jest.fn()
      .mockRejectedValueOnce(new Error('Rate limit exceeded'))
      .mockResolvedValueOnce([
        {
          date: new Date('2026-03-20T00:00:00Z'),
          close: 456.78,
          high: 460,
          low: 450,
          open: 452,
          volume: 1234567
        }
      ]);

    stockData.__setYahooFinanceClient({ historical });

    const result = await stockData.getYahooFinanceHistory('MSFT', 30);

    expect(historical).toHaveBeenCalledTimes(2);
    expect(mockDelay).toHaveBeenCalledTimes(1);
    expect(mockDelay).toHaveBeenCalledWith(600);
    expect(result).toEqual([
      expect.objectContaining({
        date: '2026-03-20',
        price: 456.78,
        volume: 1234567
      })
    ]);
  });
});
