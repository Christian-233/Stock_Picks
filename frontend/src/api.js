const API_BASE_URL = 'http://localhost:5002/api'; // Force port 5002 for now

// Debug: Log the API URL being used
console.log('🔗 API_BASE_URL:', API_BASE_URL);
console.log('🔗 REACT_APP_API_URL env var:', process.env.REACT_APP_API_URL);
// Hot reload trigger: Modified at ${new Date().toISOString()}

// Helper: Detect if error is a connection/network error
const isConnectionError = (error) => {
  const msg = (error?.message || '').toLowerCase();
  return (
    msg.includes('failed to fetch') || 
    msg.includes('err_connection_refused') ||
    msg.includes('connection refused') ||
    msg.includes('econnrefused') ||
    msg.includes('network error')
  );
};

// Helper: Get user-friendly error message
const getUserFriendlyError = (error) => {
  if (isConnectionError(error)) {
    return '⚠️ Backend server is not responding. Please ensure the backend is running on port 5002. Run: cd backend && node server.js';
  }
  if (error?.message?.includes('timeout')) {
    return '⚠️ Request timed out. The server is taking too long to respond.';
  }
  if (error?.message?.includes('cors')) {
    return '⚠️ CORS error. The frontend and backend may not be properly configured.';
  }
  return error?.message || 'Unknown error occurred';
};

export const apiClient = {
  // Predictions
  getPredictions: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/predictions`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    } catch (error) {
      console.error('getPredictions error:', error);
      const friendlyMsg = getUserFriendlyError(error);
      throw new Error(friendlyMsg);
    }
  },

  getPredictionsByTicker: async (ticker) => {
    try {
      const response = await fetch(`${API_BASE_URL}/predictions/${ticker}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    } catch (error) {
      console.error('getPredictionsByTicker error:', error);
      const friendlyMsg = getUserFriendlyError(error);
      throw new Error(friendlyMsg);
    }
  },

  generatePredictions: async (tickers) => {
    try {
      console.log(`Calling API: ${API_BASE_URL}/predict`);
      console.log('API_BASE_URL environment:', API_BASE_URL);
      console.log('Request payload:', { tickers });
      
      const response = await fetch(`${API_BASE_URL}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers })
      });
      
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      if (!response.ok) {
        let errorData = {};
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = { text: await response.text() };
        }
        const errorMsg = errorData.error || errorData.text || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMsg);
      }
      
      const data = await response.json();
      console.log('Predictions received:', data);
      return data;
    } catch (error) {
      console.error('generatePredictions fetch error:', error);
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      
      // Re-throw with user-friendly message if it's a connection error
      if (isConnectionError(error)) {
        throw new Error(getUserFriendlyError(error));
      }
      throw error;
    }
  },

  // News
  getNews: async (ticker, limit = 20) => {
    try {
      const response = await fetch(`${API_BASE_URL}/news/${ticker}?limit=${limit}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    } catch (error) {
      console.error('getNews error:', error);
      const friendlyMsg = getUserFriendlyError(error);
      throw new Error(friendlyMsg);
    }
  },

  scrapeNews: async (tickers) => {
    try {
      const response = await fetch(`${API_BASE_URL}/scrape-news`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers })
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    } catch (error) {
      console.error('scrapeNews error:', error);
      const friendlyMsg = getUserFriendlyError(error);
      throw new Error(friendlyMsg);
    }
  },

  updateNewsHelpful: async (newsId, isHelpful) => {
    try {
      const response = await fetch(`${API_BASE_URL}/news/${newsId}/helpful`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isHelpful })
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    } catch (error) {
      console.error('updateNewsHelpful error:', error);
      const friendlyMsg = getUserFriendlyError(error);
      throw new Error(friendlyMsg);
    }
  },

  // Stock Data
  getStockPrice: async (ticker) => {
    try {
      const response = await fetch(`${API_BASE_URL}/stock/${ticker}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    } catch (error) {
      console.error('getStockPrice error:', error);
      const friendlyMsg = getUserFriendlyError(error);
      throw new Error(friendlyMsg);
    }
  },

  // Accuracy
  getAccuracy: async (ticker) => {
    try {
      const response = await fetch(`${API_BASE_URL}/accuracy/${ticker}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    } catch (error) {
      console.error('getAccuracy error:', error);
      // Return default 0 accuracy instead of failing for missing tickers
      return { accuracyRate: 0, checks: [] };
    }
  },

  // Algorithm
  getAlgorithmDetails: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/algorithm/details`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    } catch (error) {
      console.error('getAlgorithmDetails error:', error);
      const friendlyMsg = getUserFriendlyError(error);
      throw new Error(friendlyMsg);
    }
  },

  updateWeights: async (weights) => {
    try {
      const response = await fetch(`${API_BASE_URL}/weights/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weights })
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    } catch (error) {
      console.error('updateWeights error:', error);
      const friendlyMsg = getUserFriendlyError(error);
      throw new Error(friendlyMsg);
    }
  },

  getWeightsHistory: async (ticker = null) => {
    const url = ticker 
      ? `${API_BASE_URL}/weights/history?ticker=${ticker}`
      : `${API_BASE_URL}/weights/history`;
    const response = await fetch(url);
    return response.json();
  },

  getSuggestedStocks: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/suggested-stocks`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    } catch (error) {
      console.error('getSuggestedStocks error:', error);
      const friendlyMsg = getUserFriendlyError(error);
      throw new Error(friendlyMsg);
    }
  }
};
