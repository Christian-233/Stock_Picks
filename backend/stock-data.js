const axios = require('axios');

const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_KEY || 'demo';
const ALPHA_VANTAGE_BASE = 'https://www.alphavantage.co/query';

// Mock stock data for development (replace with real API)
async function getStockPrice(ticker) {
  try {
    // Mock data with more comprehensive ticker coverage
    const basePrices = {
      // Tech Giants
      'AAPL': 175.43,
      'MSFT': 380.12,
      'GOOGL': 140.25,
      'AMZN': 155.33,
      'TSLA': 242.84,
      'META': 310.45,
      'NVDA': 485.20,
      'AMD': 148.92,
      'INTC': 45.67,
      'ORCL': 122.45,
      'CRM': 268.50,
      'ADBE': 512.30,
      'NFLX': 445.67,
      'SPOT': 165.88,
      'SNAP': 18.45,
      'PINS': 38.92,
      'RBLX': 28.50,
      'ZM': 78.65,
      
      // Finance/Banking
      'JPM': 168.45,
      'BAC': 32.78,
      'WFC': 48.92,
      'GS': 378.50,
      'MS': 92.34,
      'BLK': 785.20,
      'AXP': 208.45,
      'PNC': 158.90,
      'USB': 42.30,
      
      // Payment/Fintech
      'V': 268.90,
      'MA': 425.67,
      'SQ': 148.92,
      'PYPL': 58.45,
      'COF': 62.30,
      'DFS': 88.75,
      
      // Retail/E-commerce
      'WMT': 85.34,
      'HD': 352.90,
      'TGT': 58.45,
      'MCD': 298.92,
      'SBUX': 88.45,
      'NKE': 103.67,
      'LULU': 352.50,
      'RH': 308.90,
      'CZR': 58.34,
      'MGM': 28.45,
      'LVS': 65.90,
      
      // Consumer/Goods
      'PG': 162.34,
      'KO': 59.45,
      'PEP': 178.90,
      'MO': 46.78,
      'PM': 95.23,
      'EL': 298.45,
      'ULTA': 432.50,
      'CLX': 168.90,
      'KMB': 128.45,
      
      // Healthcare/Pharma
      'JNJ': 152.34,
      'UNH': 478.90,
      'PFE': 25.67,
      'MRK': 118.45,
      'ABBV': 148.92,
      'LLY': 592.45,
      'AMGN': 245.67,
      'GILD': 82.34,
      'REGN': 648.90,
      'BNTX': 108.45,
      'CVS': 68.92,
      'WBA': 22.45,
      'CI': 298.45,
      'HUM': 452.30,
      
      // Transportation
      'BA': 178.40,
      'LUV': 28.45,
      'DAL': 35.67,
      'UAL': 42.90,
      'ALK': 35.23,
      'F': 10.45,
      'GM': 38.92,
      'TM': 142.30,
      'HMC': 32.15,
      'RIG': 8.34,
      
      // Energy
      'CVX': 165.34,
      'XOM': 110.45,
      'MPC': 112.30,
      'PSX': 98.90,
      'VLO': 125.67,
      'EOG': 128.45,
      'MRO': 22.50,
      'OXY': 68.34,
      'SLB': 55.92,
      
      // Utilities
      'NEE': 78.90,
      'DUK': 95.45,
      'SO': 68.34,
      'D': 52.30,
      'EXC': 42.78,
      'AEP': 88.45,
      'XEL': 72.15,
      
      // Telecommunications
      'T': 18.45,
      'VZ': 42.30,
      'TMUS': 178.90,
      'CMCSA': 42.45,
      'CHTR': 428.90,
      
      // Industrial/Machinery
      'CAT': 348.45,
      'DE': 425.30,
      'GE': 92.15,
      'HON': 198.90,
      'ITW': 252.34,
      'LMT': 478.45,
      'RTX': 98.92,
      
      // Materials
      'NEM': 52.34,
      'SCCO': 38.45,
      'FCX': 42.90,
      'CLF': 28.34,
      'X': 18.45,
      
      // Real Estate/Infrastructure
      'AMT': 245.67,
      'CCI': 152.90,
      'EQIX': 752.34,
      'DLR': 158.45,
      'WELL': 72.30,
      'PLD': 168.90,
      
      // Food Services
      'YUM': 132.45,
      'GIS': 58.90,
      'K': 28.34,
      'CPB': 42.15
    };

    const price = basePrices[ticker];
    
    // If ticker not found, generate a reasonable mock price
    if (!price) {
      const mockPrice = 50 + Math.random() * 250;
      console.log(`Using generated mock price for ${ticker}: $${mockPrice.toFixed(2)}`);
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
  } catch (error) {
    console.error(`Error fetching stock price for ${ticker}:`, error.message);
    return null;
  }
}

async function getHistoricalData(ticker, days = 365) {
  try {
    // Get base price for this ticker
    const basePrices = {
      'AAPL': 175.43, 'MSFT': 380.12, 'GOOGL': 140.25, 'AMZN': 155.33, 'TSLA': 242.84,
      'META': 310.45, 'NVDA': 485.20, 'AMD': 148.92, 'INTC': 45.67, 'ORCL': 122.45,
      'SPOT': 165.88, 'CRM': 268.50, 'ADBE': 512.30, 'NFLX': 445.67, 'PYPL': 58.45
    };
    
    const currentPrice = basePrices[ticker] || 150;
    const data = [];
    
    // Generate 1 year of realistic historical data
    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      // Realistic price movement: random walk with trend
      const trend = (Math.random() - 0.48) * 0.02; // slight upward bias
      const volatility = (Math.random() - 0.5) * 0.04; // 4% daily volatility
      const priceChange = trend + volatility;
      
      // Calculate price with compounding
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
  } catch (error) {
    console.error(`Error generating historical data for ${ticker}:`, error.message);
    return [];
  }
}

async function calculateVolatilityFromHistory(ticker, days = 365) {
  try {
    const historicalData = await getHistoricalData(ticker, days);
    
    if (historicalData.length < 2) return 0.15; // default to 15% if not enough data
    
    const prices = historicalData.map(d => d.price);
    const returns = [];
    
    for (let i = 1; i < prices.length; i++) {
      const returnValue = (prices[i] - prices[i - 1]) / prices[i - 1];
      returns.push(returnValue);
    }
    
    // Calculate standard deviation (volatility)
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance);
    
    // Annualize volatility (252 trading days per year)
    const annualizedVolatility = volatility * Math.sqrt(252);
    
    return Math.max(Math.min(annualizedVolatility, 0.8), 0.05); // Clamp to 5-80%
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
    
    // Return trend as percentage (-1 to +1)
    return Math.max(Math.min((recentAvg - olderAvg) / olderAvg, 1), -1);
  } catch (error) {
    console.error(`Error calculating trend for ${ticker}:`, error.message);
    return 0;
  }
}

module.exports = {
  getStockPrice,
  getHistoricalData,
  calculateVolatilityFromHistory,
  calculateTrendFromHistory
};
