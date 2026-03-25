const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export const apiClient = {
  // Predictions
  getPredictions: async () => {
    const response = await fetch(`${API_BASE_URL}/predictions`);
    return response.json();
  },

  getPredictionsByTicker: async (ticker) => {
    const response = await fetch(`${API_BASE_URL}/predictions/${ticker}`);
    return response.json();
  },

  generatePredictions: async (tickers) => {
    const response = await fetch(`${API_BASE_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tickers })
    });
    return response.json();
  },

  // News
  getNews: async (ticker, limit = 20) => {
    const response = await fetch(`${API_BASE_URL}/news/${ticker}?limit=${limit}`);
    return response.json();
  },

  scrapeNews: async (tickers) => {
    const response = await fetch(`${API_BASE_URL}/scrape-news`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tickers })
    });
    return response.json();
  },

  updateNewsHelpful: async (newsId, isHelpful) => {
    const response = await fetch(`${API_BASE_URL}/news/${newsId}/helpful`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isHelpful })
    });
    return response.json();
  },

  // Stock Data
  getStockPrice: async (ticker) => {
    const response = await fetch(`${API_BASE_URL}/stock/${ticker}`);
    return response.json();
  },

  // Accuracy
  getAccuracy: async (ticker) => {
    const response = await fetch(`${API_BASE_URL}/accuracy/${ticker}`);
    return response.json();
  },

  // Algorithm
  getAlgorithmDetails: async () => {
    const response = await fetch(`${API_BASE_URL}/algorithm/details`);
    return response.json();
  },

  updateWeights: async (weights) => {
    const response = await fetch(`${API_BASE_URL}/weights/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weights })
    });
    return response.json();
  },

  getWeightsHistory: async (ticker = null) => {
    const url = ticker 
      ? `${API_BASE_URL}/weights/history?ticker=${ticker}`
      : `${API_BASE_URL}/weights/history`;
    const response = await fetch(url);
    return response.json();
  }
};
