describe('api client configuration', () => {
  const originalApiUrl = process.env.REACT_APP_API_URL;
  const originalFetch = global.fetch;
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;

  beforeEach(() => {
    jest.resetModules();
    delete process.env.REACT_APP_API_URL;
    global.fetch = jest.fn();
    console.log = jest.fn();
    console.error = jest.fn();
  });

  afterEach(() => {
    jest.resetModules();

    if (originalApiUrl === undefined) {
      delete process.env.REACT_APP_API_URL;
    } else {
      process.env.REACT_APP_API_URL = originalApiUrl;
    }

    global.fetch = originalFetch;
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  test('falls back to port 5002 when no env var is set', () => {
    const { API_BASE_URL } = require('./api');

    expect(API_BASE_URL).toBe('http://localhost:5002/api');
  });

  test('uses REACT_APP_API_URL when provided', () => {
    process.env.REACT_APP_API_URL = 'http://localhost:7777/api';
    const { API_BASE_URL } = require('./api');

    expect(API_BASE_URL).toBe('http://localhost:7777/api');
  });

  test('getSuggestedStocks includes configured base URL in connection errors', async () => {
    process.env.REACT_APP_API_URL = 'http://localhost:5002/api';
    global.fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const { apiClient } = require('./api');

    await expect(apiClient.getSuggestedStocks()).rejects.toThrow(
      'Backend server is not responding at http://localhost:5002/api. Ensure the backend is running and the frontend API URL matches it.'
    );
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:5002/api/suggested-stocks');
  });

  test('getPredictions includes configured base URL in connection errors', async () => {
    process.env.REACT_APP_API_URL = 'http://localhost:5002/api';
    global.fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const { apiClient } = require('./api');

    await expect(apiClient.getPredictions()).rejects.toThrow(
      'Backend server is not responding at http://localhost:5002/api. Ensure the backend is running and the frontend API URL matches it.'
    );
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:5002/api/predictions');
  });
});
