jest.mock('axios', () => ({
  get: jest.fn()
}));

jest.mock('./database', () => ({
  run: jest.fn().mockResolvedValue({ id: 1 })
}));

const axios = require('axios');
const newsScraper = require('./news-scraper');

describe('news-scraper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEWS_API_KEY = 'test-news-key';
    process.env.MARKETAUX_API_KEY = 'test-marketaux-key';
  });

  test('sends NewsAPI and Marketaux query parameters via axios params', async () => {
    axios.get.mockResolvedValueOnce({
      data: {
        articles: []
      }
    });
    axios.get.mockResolvedValueOnce({
      data: {
        data: []
      }
    });

    await newsScraper.scrapeNewsForTicker('AAPL');

    expect(axios.get).toHaveBeenCalledWith(
      'https://newsapi.org/v2/everything',
      expect.objectContaining({
        params: expect.objectContaining({
          q: 'AAPL',
          sortBy: 'publishedAt',
          language: 'en',
          pageSize: 20,
          apiKey: 'test-news-key'
        })
      })
    );

    expect(axios.get).toHaveBeenCalledWith(
      'https://api.marketaux.com/v1/news/all',
      expect.objectContaining({
        params: expect.objectContaining({
          symbols: 'AAPL',
          language: 'en',
          limit: 20,
          api_token: 'test-marketaux-key'
        })
      })
    );
  });
});
