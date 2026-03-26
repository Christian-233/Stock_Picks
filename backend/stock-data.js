const axios = require('axios');

// API Keys and Configuration
const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_KEY || 'demo';
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || '';
const YAHOO_FINANCE_ENABLED = process.env.YAHOO_FINANCE_ENABLED !== 'false';

const ALPHA_VANTAGE_BASE = 'https://www.alphavantage.co/query';
const FINNHUB_BASE = 'https://finnhub.io/api/v1';

// ============================================================================
// YAHOO FINANCE DATA SOURCE (Recommended - Free, No Key Required)
// ============================================================================

let yahooFinance;
try {
  // Import the yahoo-finance2 module
  const YahooFinance = require('yahoo-finance2');
  yahooFinance = new YahooFinance();
  console.log('✓ Yahoo Finance module initialized');
} catch (e) {
  console.warn('⚠ Yahoo Finance module not ready yet - will use fallback sources');
  yahooFinance = null;
}

async function getYahooFinancePrice(ticker) {
  if (!yahooFinance || !YAHOO_FINANCE_ENABLED) return null;
  try {
    const quote = await yahooFinance.quote(ticker);
    return {
      ticker,
      price: quote.regularMarketPrice,
      timestamp: new Date().getTime(),
      source: 'yahoo-finance',
      marketCap: quote.marketCap,
      pe: quote.trailingPE,
      dividend: quote.trailingAnnualDividendRate
    };
  } catch (error) {
    console.log(`[${ticker}] Yahoo Finance unavailable`);
    return null;
  }
}

async function getYahooFinanceHistory(ticker, days = 365) {
  if (!yahooFinance || !YAHOO_FINANCE_ENABLED) return null;
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const result = await yahooFinance.historical(ticker, {
      period1: startDate,
      period2: endDate,
      interval: '1d'
    });

    return result.map(bar => ({
      date: bar.date.toISOString().split('T')[0],
      price: bar.close,
      volume: bar.volume,
      high: bar.high,
      low: bar.low,
      open: bar.open
    }));
  } catch (error) {
    console.log(`Yahoo Finance history unavailable for ${ticker}: ${error.message}`);
    return null;
  }
}

// ============================================================================
// ALPHA VANTAGE DATA SOURCE (Technical Data - Free with Rate Limits)
// ============================================================================

async function getAlphaVantagePrice(ticker) {
  if (ALPHA_VANTAGE_KEY === 'demo') return null;
  try {
    const response = await axios.get(ALPHA_VANTAGE_BASE, {
      params: {
        function: 'GLOBAL_QUOTE',
        symbol: ticker,
        apikey: ALPHA_VANTAGE_KEY
      },
      timeout: 5000
    });

    const quote = response.data['Global Quote'];
    if (!quote || !quote['05. price']) return null;

    return {
      ticker,
      price: parseFloat(quote['05. price']),
      timestamp: new Date().getTime(),
      source: 'alpha-vantage',
      change: parseFloat(quote['09. change']),
      changePercent: parseFloat(quote['10. change percent'])
    };
  } catch (error) {
    console.log(`Alpha Vantage unavailable for ${ticker}: ${error.message}`);
    return null;
  }
}

async function getAlphaVantageHistory(ticker, days = 365) {
  if (ALPHA_VANTAGE_KEY === 'demo') return null;
  try {
    const response = await axios.get(ALPHA_VANTAGE_BASE, {
      params: {
        function: 'TIME_SERIES_DAILY',
        symbol: ticker,
        outputsize: days > 100 ? 'full' : 'compact',
        apikey: ALPHA_VANTAGE_KEY
      },
      timeout: 5000
    });

    const timeSeries = response.data['Time Series (Daily)'];
    if (!timeSeries) return null;

    return Object.entries(timeSeries)
      .map(([date, data]) => ({
        date,
        price: parseFloat(data['4. close']),
        volume: parseInt(data['5. volume']),
        high: parseFloat(data['2. high']),
        low: parseFloat(data['3. low']),
        open: parseFloat(data['1. open'])
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(-days);
  } catch (error) {
    console.log(`Alpha Vantage history unavailable for ${ticker}: ${error.message}`);
    return null;
  }
}

// ============================================================================
// FINNHUB DATA SOURCE (Real-time Data - Free Tier Available)
// ============================================================================

async function getFinnhubPrice(ticker) {
  if (!FINNHUB_API_KEY || FINNHUB_API_KEY === 'your_finnhub_key_here') return null;
  try {
    const response = await axios.get(`${FINNHUB_BASE}/quote`, {
      params: {
        symbol: ticker,
        token: FINNHUB_API_KEY
      },
      timeout: 5000
    });

    const data = response.data;
    if (!data.c) return null;

    return {
      ticker,
      price: data.c, // Current price
      timestamp: new Date().getTime(),
      source: 'finnhub',
      high: data.h, // High price of the day
      low: data.l, // Low price of the day
      open: data.o, // Open price of the day
      previousClose: data.pc, // Previous close price
      change: data.c - (data.pc || data.c)
    };
  } catch (error) {
    console.log(`Finnhub unavailable for ${ticker}: ${error.message}`);
    return null;
  }
}

async function getFinnhubHistory(ticker, days = 365) {
  if (!FINNHUB_API_KEY || FINNHUB_API_KEY === 'your_finnhub_key_here') return null;
  try {
    const endDate = Math.floor(new Date().getTime() / 1000);
    const startDate = Math.floor((new Date().getTime() - days * 24 * 60 * 60 * 1000) / 1000);

    const response = await axios.get(`${FINNHUB_BASE}/stock/candle`, {
      params: {
        symbol: ticker,
        resolution: 'D',
        from: startDate,
        to: endDate,
        token: FINNHUB_API_KEY
      },
      timeout: 5000
    });

    if (response.data.s === 'no_data') return null;

    return response.data.t.map((timestamp, index) => ({
      date: new Date(timestamp * 1000).toISOString().split('T')[0],
      price: response.data.c[index],
      volume: response.data.v[index],
      high: response.data.h[index],
      low: response.data.l[index],
      open: response.data.o[index]
    }));
  } catch (error) {
    console.log(`Finnhub history unavailable for ${ticker}: ${error.message}`);
    return null;
  }
}

// ============================================================================
// MOCK DATA FALLBACK (Development/Testing)
// ============================================================================

const mockBasePrices = {
  // Tech Giants
  'AAPL': 175.43, 'MSFT': 380.12, 'GOOGL': 140.25, 'AMZN': 155.33, 'TSLA': 242.84,
  'META': 310.45, 'NVDA': 485.20, 'AMD': 148.92, 'INTC': 45.67, 'ORCL': 122.45,
  'CRM': 268.50, 'ADBE': 512.30, 'NFLX': 445.67, 'SPOT': 165.88, 'SNAP': 18.45,
  'PINS': 38.92, 'RBLX': 28.50, 'ZM': 78.65,
  // Finance
  'JPM': 168.45, 'BAC': 32.78, 'WFC': 48.92, 'GS': 378.50, 'MS': 92.34,
  'BLK': 785.20, 'AXP': 208.45, 'PNC': 158.90, 'USB': 42.30,
  // Payments
  'V': 268.90, 'MA': 425.67, 'SQ': 148.92, 'PYPL': 58.45, 'COF': 62.30,
  'DFS': 88.75,
  // Retail
  'WMT': 85.34, 'HD': 352.90, 'TGT': 58.45, 'MCD': 298.92, 'SBUX': 88.45,
  'NKE': 103.67, 'LULU': 352.50, 'RH': 308.90, 'CZR': 58.34, 'MGM': 28.45,
  'LVS': 65.90,
  // Consumer
  'PG': 162.34, 'KO': 59.45, 'PEP': 178.90, 'MO': 46.78, 'PM': 95.23,
  'EL': 298.45, 'ULTA': 432.50, 'CLX': 168.90, 'KMB': 128.45,
  // Healthcare
  'JNJ': 152.34, 'UNH': 478.90, 'PFE': 25.67, 'MRK': 118.45, 'ABBV': 148.92,
  'LLY': 592.45, 'AMGN': 245.67, 'GILD': 82.34, 'REGN': 648.90, 'BNTX': 108.45,
  'CVS': 68.92, 'WBA': 22.45, 'CI': 298.45, 'HUM': 452.30,
  // Transportation
  'BA': 178.40, 'LUV': 28.45, 'DAL': 35.67, 'UAL': 42.90, 'ALK': 35.23,
  'F': 10.45, 'GM': 38.92, 'TM': 142.30, 'HMC': 32.15, 'RIG': 8.34,
  // Energy
  'CVX': 165.34, 'XOM': 110.45, 'MPC': 112.30, 'PSX': 98.90, 'VLO': 125.67,
  'EOG': 128.45, 'MRO': 22.50, 'OXY': 68.34, 'SLB': 55.92,
  // Utilities
  'NEE': 78.90, 'DUK': 95.45, 'SO': 68.34, 'D': 52.30, 'EXC': 42.78,
  'AEP': 88.45, 'XEL': 72.15,
  // Telecom
  'T': 18.45, 'VZ': 42.30, 'TMUS': 178.90, 'CMCSA': 42.45, 'CHTR': 428.90,
  // Industrial
  'CAT': 348.45, 'DE': 425.30, 'GE': 92.15, 'HON': 198.90, 'ITW': 252.34,
  'LMT': 478.45, 'RTX': 98.92,
  // Materials
  'NEM': 52.34, 'SCCO': 38.45, 'FCX': 42.90, 'CLF': 28.34, 'X': 18.45,
  // Real Estate
  'AMT': 245.67, 'CCI': 152.90, 'EQIX': 752.34, 'DLR': 158.45, 'WELL': 72.30,
  'PLD': 168.90,
  // Food
  'YUM': 132.45, 'GIS': 58.90, 'K': 28.34, 'CPB': 42.15
};

function getMockPrice(ticker) {
  const price = mockBasePrices[ticker];
  if (!price) {
    const mockPrice = 50 + Math.random() * 250;
    return {
      ticker,
      price: Math.round(mockPrice * 100) / 100,
      timestamp: new Date().getTime(),
      source: 'mock-generated'
    };
  }
  return {
    ticker,
    price,
    timestamp: new Date().getTime(),
    source: 'mock'
  };
}

function getMockHistory(ticker, days = 365) {
  const currentPrice = mockBasePrices[ticker] || 150;
  const data = [];

  for (let i = days; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);

    const trend = (Math.random() - 0.48) * 0.02;
    const volatility = (Math.random() - 0.5) * 0.04;
    const priceChange = trend + volatility;

    const dayPrice = currentPrice * Math.pow(1 + priceChange, (days - i) / days);

    data.push({
      date: date.toISOString().split('T')[0],
      price: Math.round(dayPrice * 100) / 100,
      volume: Math.floor(Math.random() * 50000000 + 10000000),
      high: Math.round(dayPrice * 1.02 * 100) / 100,
      low: Math.round(dayPrice * 0.98 * 100) / 100
    });
  }

  return data;
}

// ============================================================================
// PRIMARY FUNCTIONS WITH FALLBACK MECHANISM
// ============================================================================

/**
 * Get current stock price with automatic fallback between data sources
 * Priority: Yahoo Finance → Finnhub → Alpha Vantage → Mock Data
 */
async function getStockPrice(ticker) {
  console.log(`[${ticker}] Fetching price...`);

  // Try Yahoo Finance first (recommended - free, no key)
  if (YAHOO_FINANCE_ENABLED) {
    const yahooPrice = await getYahooFinancePrice(ticker);
    if (yahooPrice) {
      console.log(`[${ticker}] ✓ Price from Yahoo Finance: $${yahooPrice.price}`);
      return yahooPrice;
    }
  }

  // Try Finnhub (if key available)
  if (FINNHUB_API_KEY && FINNHUB_API_KEY !== 'your_finnhub_key_here') {
    const finnhubPrice = await getFinnhubPrice(ticker);
    if (finnhubPrice) {
      console.log(`[${ticker}] ✓ Price from Finnhub: $${finnhubPrice.price}`);
      return finnhubPrice;
    }
  }

  // Try Alpha Vantage (if key available and not demo)
  if (ALPHA_VANTAGE_KEY !== 'demo') {
    const avPrice = await getAlphaVantagePrice(ticker);
    if (avPrice) {
      console.log(`[${ticker}] ✓ Price from Alpha Vantage: $${avPrice.price}`);
      return avPrice;
    }
  }

  // Fall back to mock data
  const mockPrice = getMockPrice(ticker);
  console.log(`[${ticker}] ⚠ Using mock price: $${mockPrice.price}`);
  return mockPrice;
}

/**
 * Get historical price data with automatic fallback between data sources
 * Priority: Yahoo Finance → Finnhub → Alpha Vantage → Mock Data
 */
async function getHistoricalData(ticker, days = 365) {
  console.log(`[${ticker}] Fetching ${days}-day history...`);

  // Try Yahoo Finance first
  if (YAHOO_FINANCE_ENABLED) {
    const yahooHistory = await getYahooFinanceHistory(ticker, days);
    if (yahooHistory && yahooHistory.length > 0) {
      console.log(`[${ticker}] ✓ Historical data from Yahoo Finance: ${yahooHistory.length} days`);
      return yahooHistory;
    }
  }

  // Try Finnhub
  if (FINNHUB_API_KEY && FINNHUB_API_KEY !== 'your_finnhub_key_here') {
    const finnhubHistory = await getFinnhubHistory(ticker, days);
    if (finnhubHistory && finnhubHistory.length > 0) {
      console.log(`[${ticker}] ✓ Historical data from Finnhub: ${finnhubHistory.length} days`);
      return finnhubHistory;
    }
  }

  // Try Alpha Vantage
  if (ALPHA_VANTAGE_KEY !== 'demo') {
    const avHistory = await getAlphaVantageHistory(ticker, days);
    if (avHistory && avHistory.length > 0) {
      console.log(`[${ticker}] ✓ Historical data from Alpha Vantage: ${avHistory.length} days`);
      return avHistory;
    }
  }

  // Fall back to mock data
  const mockHistory = getMockHistory(ticker, days);
  console.log(`[${ticker}] ⚠ Using mock history: ${mockHistory.length} days`);
  return mockHistory;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

async function calculateVolatilityFromHistory(ticker, days = 365) {
  try {
    const historicalData = await getHistoricalData(ticker, days);

    if (historicalData.length < 2) return 0.15;

    const prices = historicalData.map(d => d.price);
    const returns = [];

    for (let i = 1; i < prices.length; i++) {
      const returnValue = (prices[i] - prices[i - 1]) / prices[i - 1];
      returns.push(returnValue);
    }

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance);
    const annualizedVolatility = volatility * Math.sqrt(252);

    return Math.max(Math.min(annualizedVolatility, 0.8), 0.05);
  } catch (error) {
    console.error(`Error calculating volatility for ${ticker}:`, error.message);
    return 0.15;
  }
}

async function calculateTrendFromHistory(ticker, days = 365) {
  try {
    const historicalData = await getHistoricalData(ticker, days);

    if (historicalData.length < 30) return 0;

    const recent30 = historicalData.slice(-30).map(d => d.price);
    const older30 = historicalData.slice(-90, -60).map(d => d.price);

    const recentAvg = recent30.reduce((a, b) => a + b, 0) / recent30.length;
    const olderAvg = older30.reduce((a, b) => a + b, 0) / older30.length;

    return Math.max(Math.min((recentAvg - olderAvg) / olderAvg, 1), -1);
  } catch (error) {
    console.error(`Error calculating trend for ${ticker}:`, error.message);
    return 0;
  }
}

/**
 * Get data source status for monitoring
 */
function getDataSourceStatus() {
  return {
    yahooFinance: {
      enabled: YAHOO_FINANCE_ENABLED && !!yahooFinance,
      available: 'Free - Recommended',
      rateLimit: 'No limit (web scraping)',
      latency: '1-2 seconds'
    },
    finnhub: {
      enabled: !!FINNHUB_API_KEY && FINNHUB_API_KEY !== 'your_finnhub_key_here',
      available: 'Free tier (60 API calls/minute)',
      rateLimit: '60 calls/minute (free), higher for paid',
      latency: '< 500ms'
    },
    alphaVantage: {
      enabled: ALPHA_VANTAGE_KEY !== 'demo',
      available: 'Free tier (5 calls/minute)',
      rateLimit: '5 calls/minute (free), higher for paid',
      latency: '1-3 seconds'
    },
    mockData: {
      enabled: true,
      available: 'Always (fallback)',
      rateLimit: 'Unlimited',
      latency: '< 10ms'
    }
  };
}

module.exports = {
  // Primary functions
  getStockPrice,
  getHistoricalData,
  calculateVolatilityFromHistory,
  calculateTrendFromHistory,
  getPriceHistory: getHistoricalData, // Alias for backward compatibility

  // Individual data source functions (for direct access if needed)
  getYahooFinancePrice,
  getYahooFinanceHistory,
  getFinnhubPrice,
  getFinnhubHistory,
  getAlphaVantagePrice,
  getAlphaVantageHistory,
  getMockPrice,
  getMockHistory,

  // Monitoring
  getDataSourceStatus
};
