jest.mock('./database', () => ({
  run: jest.fn().mockResolvedValue({ id: 1, changes: 1 })
}));

const db = require('./database');
const { normalizeImportedRow, importNewsRows } = require('./news-importer');

describe('news-importer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('normalizes imported rows with inferred defaults', () => {
    const row = normalizeImportedRow(
      {
        title: 'AAPL beats earnings and rallies',
        source: 'Reuters',
        published_at: '2026-03-28T13:00:00Z'
      },
      { defaultTicker: 'aapl' }
    );

    expect(row.ticker).toBe('AAPL');
    expect(row.title).toBe('AAPL beats earnings and rallies');
    expect(row.source).toBe('Reuters');
    expect(row.sentiment).toBe('positive');
    expect(row.url).toContain('imported://');
  });

  test('imports valid rows and skips invalid rows', async () => {
    const result = await importNewsRows(
      [
        {
          ticker: 'MSFT',
          title: 'MSFT rises on strong cloud demand',
          source: 'reddit',
          description: 'r/stocks | 100 comments | 300 upvotes',
          published_at: 1710000000
        },
        {
          ticker: 'AAPL',
          title: '',
          source: 'Reuters'
        }
      ],
      {}
    );

    expect(result).toEqual({
      received: 2,
      imported: 1,
      skipped: 1
    });
    expect(db.run).toHaveBeenCalledTimes(1);
  });
});
