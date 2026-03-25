const axios = require('axios');

const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_KEY || 'demo';
const ALPHA_VANTAGE_BASE = 'https://www.alphavantage.co/query';

// Mock stock data for development (replace with real API)
async function getStockPrice(ticker) {
  try {
    // Using IEX Cloud as alternative (free tier available)
    // For now, returning mock data with base prices
    const basePrices = {
      'AAPL': 175.43,
      'MSFT': 380.12,
      'GOOGL': 140.25,
      'AMZN': 155.33,
      'TSLA': 242.84,
      'META': 310.45,
      'NVDA': 485.20,
      'AMD': 148.92,
      'INTC': 45.67
    };

    const price = basePrices[ticker] || 100;
    
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

async function getHistoricalData(ticker, days = 30) {
  try {
    // Mock historical data
    const data = [];
    const basePrice = 150;
    
    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      data.push({
        date: date.toISOString().split('T')[0],
        price: basePrice + (Math.random() - 0.5) * 20
      });
    }
    
    return data;
  } catch (error) {
    console.error(`Error fetching historical data for ${ticker}:`, error.message);
    return [];
  }
}

async function getStockVolatility(ticker) {
  try {
    // Mock volatility calculation
    return {
      ticker,
      volatility: Math.random() * 0.5, // 0-50% volatility
      period: '30d'
    };
  } catch (error) {
    console.error(`Error calculating volatility for ${ticker}:`, error.message);
    return null;
  }
}

module.exports = {
  getStockPrice,
  getHistoricalData,
  getStockVolatility
};
