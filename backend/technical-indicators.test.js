const technicalIndicators = require('./technical-indicators');

describe('technical-indicators', () => {
  test('supports price-based history entries in interpretAllSignals', () => {
    const history = Array.from({ length: 80 }, (_, index) => ({
      price: 100 + index,
      high: 101 + index,
      low: 99 + index,
      volume: 1000000 + (index * 1000)
    }));

    const result = technicalIndicators.interpretAllSignals(history);

    expect(result).toEqual(
      expect.objectContaining({
        currentPrice: expect.any(Number),
        bullishScore: expect.any(String),
        indicators: expect.any(Object)
      })
    );
    expect(result.error).toBeUndefined();
  });
});
