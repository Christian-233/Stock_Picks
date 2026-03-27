/**
 * Technical Indicators Calculator
 * Implements key trading indicators for stock analysis
 */

// Simple Moving Average
function calculateSMA(prices, period = 20) {
  const sma = [];
  for (let i = period - 1; i < prices.length; i++) {
    const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    sma.push(sum / period);
  }
  return sma;
}

// Exponential Moving Average
function calculateEMA(prices, period = 12) {
  const ema = [];
  const multiplier = 2 / (period + 1);
  
  // First value is SMA
  const firstSMA = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  ema.push(firstSMA);
  
  for (let i = period; i < prices.length; i++) {
    const previousEMA = ema[ema.length - 1];
    const currentPrice = prices[i];
    const newEMA = currentPrice * multiplier + previousEMA * (1 - multiplier);
    ema.push(newEMA);
  }
  
  return ema;
}

// Relative Strength Index
function calculateRSI(prices, period = 14) {
  if (prices.length < period + 1) return [];
  
  const changes = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }
  
  const gains = changes.map(c => c > 0 ? c : 0);
  const losses = changes.map(c => c < 0 ? -c : 0);
  
  const avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  const rsi = [];
  let currentAvgGain = avgGain;
  let currentAvgLoss = avgLoss;
  
  for (let i = period; i < changes.length; i++) {
    currentAvgGain = (currentAvgGain * (period - 1) + gains[i]) / period;
    currentAvgLoss = (currentAvgLoss * (period - 1) + losses[i]) / period;
    
    const rs = currentAvgLoss === 0 ? 100 : currentAvgGain / currentAvgLoss;
    const rsiValue = 100 - (100 / (1 + rs));
    rsi.push(rsiValue);
  }
  
  return rsi;
}

// MACD (Moving Average Convergence Divergence)
function calculateMACD(prices) {
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  
  // MACD line
  const macd = [];
  const startIdx = Math.max(ema12.length - ema26.length, 0);
  for (let i = 0; i < Math.min(ema12.length, ema26.length); i++) {
    macd.push(ema12[ema12.length - ema26.length + i] - ema26[i]);
  }
  
  // Signal line (9-day EMA of MACD)
  const signal = calculateEMA(macd, 9);
  
  // Histogram
  const histogram = [];
  for (let i = signal.length - macd.length; i < macd.length; i++) {
    if (i >= 0 && i < signal.length) {
      histogram.push(macd[i] - signal[i]);
    }
  }
  
  return {
    macd: macd.slice(-histogram.length),
    signal: signal.slice(-histogram.length),
    histogram
  };
}

// Bollinger Bands
function calculateBollingerBands(prices, period = 20, stdDevs = 2) {
  const sma = calculateSMA(prices, period);
  const bands = [];
  
  for (let i = period - 1; i < prices.length; i++) {
    const slice = prices.slice(i - period + 1, i + 1);
    const mean = sma[i - (period - 1)];
    
    // Calculate standard deviation
    const variance = slice.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    
    bands.push({
      upper: mean + stdDevs * stdDev,
      middle: mean,
      lower: mean - stdDevs * stdDev
    });
  }
  
  return bands;
}

// Average True Range (volatility)
function calculateATR(highs, lows, closes, period = 14) {
  if (highs.length < period) return [];
  
  const trueRanges = [];
  for (let i = 1; i < closes.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trueRanges.push(tr);
  }
  
  const atr = [];
  const firstATR = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
  atr.push(firstATR);
  
  for (let i = period; i < trueRanges.length; i++) {
    const newATR = (atr[atr.length - 1] * (period - 1) + trueRanges[i]) / period;
    atr.push(newATR);
  }
  
  return atr;
}

// On-Balance Volume (volume trend indicator)
function calculateOBV(closes, volumes) {
  const obv = [];
  let currentOBV = 0;
  
  for (let i = 0; i < closes.length; i++) {
    if (i === 0) {
      currentOBV = volumes[i];
    } else if (closes[i] > closes[i - 1]) {
      currentOBV += volumes[i];
    } else if (closes[i] < closes[i - 1]) {
      currentOBV -= volumes[i];
    }
    obv.push(currentOBV);
  }
  
  return obv;
}

// Stochastic Oscillator
function calculateStochastic(highs, lows, closes, period = 14) {
  const stochastic = [];
  
  for (let i = period - 1; i < closes.length; i++) {
    const highSlice = highs.slice(i - period + 1, i + 1);
    const lowSlice = lows.slice(i - period + 1, i + 1);
    
    const highestHigh = Math.max(...highSlice);
    const lowestLow = Math.min(...lowSlice);
    const range = highestHigh - lowestLow;
    
    const k = range === 0 ? 50 : ((closes[i] - lowestLow) / range) * 100;
    stochastic.push(k);
  }
  
  return stochastic;
}

// Interpret all signals at once
function interpretAllSignals(priceHistory) {
  if (!priceHistory || priceHistory.length < 50) {
    return { error: 'Insufficient data for analysis' };
  }
  
  const closes = priceHistory.map(p => p.close ?? p.price);
  const highs = priceHistory.map(p => p.high || p.close || p.price);
  const lows = priceHistory.map(p => p.low || p.close || p.price);
  const volumes = priceHistory.map(p => p.volume || 1000000);
  
  // Calculate all indicators
  const sma20 = calculateSMA(closes, 20);
  const sma50 = calculateSMA(closes, 50);
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const rsi = calculateRSI(closes, 14);
  const macd = calculateMACD(closes);
  const bollinger = calculateBollingerBands(closes, 20);
  const atr = calculateATR(highs, lows, closes, 14);
  const obv = calculateOBV(closes, volumes);
  const stochastic = calculateStochastic(highs, lows, closes, 14);
  
  // Get latest values
  const currentPrice = closes[closes.length - 1];
  const latest = {
    sma20: sma20[sma20.length - 1],
    sma50: sma50[sma50.length - 1],
    ema12: ema12[ema12.length - 1],
    ema26: ema26[ema26.length - 1],
    rsi: rsi[rsi.length - 1],
    macd: macd.histogram[macd.histogram.length - 1],
    bollinger: bollinger[bollinger.length - 1],
    atr: atr[atr.length - 1],
    stochastic: stochastic[stochastic.length - 1]
  };
  
  // Count bullish vs bearish signals
  let bullishSignals = 0;
  let bearishSignals = 0;
  const signals = [];
  
  // RSI signals
  if (latest.rsi < 30) {
    bullishSignals += 2;
    signals.push('RSI Oversold (< 30)');
  } else if (latest.rsi > 70) {
    bearishSignals += 2;
    signals.push('RSI Overbought (> 70)');
  }
  
  // MACD signals
  if (latest.macd > 0) {
    bullishSignals += 1.5;
    signals.push('MACD Positive Histogram');
  } else {
    bearishSignals += 1.5;
    signals.push('MACD Negative Histogram');
  }
  
  // Moving average crossover (death cross / golden cross)
  if (latest.sma20 > latest.sma50) {
    bullishSignals += 2;
    signals.push('SMA 20 > SMA 50 (Golden Cross)');
  } else {
    bearishSignals += 2;
    signals.push('SMA 20 < SMA 50 (Death Cross)');
  }
  
  // EMA trend
  if (latest.ema12 > latest.ema26) {
    bullishSignals += 1;
    signals.push('EMA 12 > EMA 26');
  } else {
    bearishSignals += 1;
    signals.push('EMA 12 < EMA 26');
  }
  
  // Bollinger Bands signals
  if (currentPrice < latest.bollinger.lower) {
    bullishSignals += 1.5;
    signals.push('Price Below Lower Bollinger Band');
  } else if (currentPrice > latest.bollinger.upper) {
    bearishSignals += 1.5;
    signals.push('Price Above Upper Bollinger Band');
  }
  
  // Stochastic signals
  if (latest.stochastic < 20) {
    bullishSignals += 1;
    signals.push('Stochastic Oversold (< 20)');
  } else if (latest.stochastic > 80) {
    bearishSignals += 1;
    signals.push('Stochastic Overbought (> 80)');
  }
  
  const totalSignals = bullishSignals + bearishSignals;
  const bullishScore = totalSignals > 0 ? bullishSignals / totalSignals : 0.5;
  
  return {
    currentPrice,
    bullishSignals,
    bearishSignals,
    bullishScore: (bullishScore * 100).toFixed(1),
    signals,
    indicators: {
      sma20: latest.sma20.toFixed(2),
      sma50: latest.sma50.toFixed(2),
      ema12: latest.ema12.toFixed(2),
      ema26: latest.ema26.toFixed(2),
      rsi: latest.rsi.toFixed(1),
      macd: latest.macd.toFixed(6),
      atr: latest.atr.toFixed(2),
      stochastic: latest.stochastic.toFixed(1),
      bollinger: {
        upper: latest.bollinger.upper.toFixed(2),
        middle: latest.bollinger.middle.toFixed(2),
        lower: latest.bollinger.lower.toFixed(2)
      }
    }
  };
}

module.exports = {
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateATR,
  calculateOBV,
  calculateStochastic,
  interpretAllSignals
};
