# Data Quality & Accuracy Improvement Guide

## 🎯 Current Accuracy: 13.84% → Target: 25-35%

---

## Part 1: Better Data Quality

### Issue 1: News API Not Working
**Status**: 401 Unauthorized (invalid/expired key)

**Solution**: 
```bash
# Step 1: Get a fresh News API key
1. Visit https://newsapi.org/register
2. Sign up (free tier available)
3. Copy your API key
4. Update backend/.env:
   NEWS_API_KEY=your_new_key

# Step 2: Test it
cd backend
node -e "
const newsScraper = require('./news-scraper');
newsScraper.scrapeNewsForTicker('AAPL').then(() => {
  console.log('✓ News API is working!');
}).catch(e => console.error('✗ Error:', e.message));
"
```

### Issue 2: Limited Data Sources
**Current**: Only Reddit (working), News API (broken)

**Better**: Add these free/cheap data sources:

#### A. **Yahoo Finance (FREE)** ⭐ RECOMMENDED
```bash
npm install yfinance --save
```

Create `backend/yahoo-scraper.js`:
```javascript
const YahooFinance = require('yfinance');

async function getHistoricalData(ticker, days = 365) {
  try {
    const data = await YahooFinance.quote({
      symbol: ticker,
      modules: ['price', 'summaryDetail', 'default']
    });
    return data;
  } catch (error) {
    console.error('Error fetching from Yahoo:', error);
    return null;
  }
}

async function getIntradayData(ticker) {
  // Get intraday price data for more granular analysis
  // Returns: open, high, low, close, volume with timestamps
}

module.exports = { getHistoricalData, getIntradayData };
```

#### B. **IEX Cloud (LIMITED FREE)** - Real Options Trading Data
- Free tier: 100 requests/month
- Sign up: https://iexcloud.io/console/tokens
- Data: Real options, earnings dates, CEO quotes

```bash
npm install @iexcloud/stable-client --save
```

#### C. **Alpha Vantage (FREE)** - Technical Data
- API Key: https://www.alphavantage.co/api/
- Data: Intraday quotes, technical indicators
- Rate limit: 5 calls/min (free tier)

```bash
npm install alpha_vantage --save
```

Example:
```javascript
const AlphaVantage = require('alpha_vantage').AlphaVantage;
const alpha = new AlphaVantage({ key: process.env.ALPHA_VANTAGE_KEY });

async function getTechnicalIndicators(ticker) {
  // RSI
  const rsi = await alpha.rsi({
    symbol: ticker,
    interval: 'daily',
    time_period: 14
  });
  
  // MACD
  const macd = await alpha.macd({
    symbol: ticker,
    interval: 'daily'
  });
  
  // Bollinger Bands
  const bb = await alpha.bbands({
    symbol: ticker,
    interval: 'daily',
    time_period: 20
  });
  
  return { rsi, macd, bb };
}
```

#### D. **Finnhub (FREE)** - Company News & Sentiment
- Sign up: https://finnhub.io/register
- Data: Real-time company news, earnings calendar
- Rate limit: 60 requests/minute

```bash
npm install finnhub-js --save
```

---

## Part 2: Technical Indicators Implementation

### Install TA-Lib Wrapper
```bash
npm install technicalindicators --save
```

Create `backend/technical-indicators.js`:
```javascript
const TI = require('technicalindicators');

async function calculateTechnicalIndicators(historicalPrices) {
  const closes = historicalPrices.map(p => p.close);
  const highs = historicalPrices.map(p => p.high);
  const lows = historicalPrices.map(p => p.low);
  const volumes = historicalPrices.map(p => p.volume);

  return {
    // Momentum Indicators
    rsi: TI.RSI.calculate({ values: closes, period: 14 }),
    macd: TI.MACD.calculate({
      values: closes,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleSignal: false
    }),
    
    // Trend Indicators
    sma20: TI.SMA.calculate({ values: closes, period: 20 }),
    sma50: TI.SMA.calculate({ values: closes, period: 50 }),
    ema12: TI.EMA.calculate({ values: closes, period: 12 }),
    ema26: TI.EMA.calculate({ values: closes, period: 26 }),
    
    // Volatility Indicators
    bollinger: TI.BollingerBands.calculate({
      period: 20,
      values: closes,
      stdDev: 2
    }),
    atr: TI.ATR.calculate({
      high: highs,
      low: lows,
      close: closes,
      period: 14
    }),
    
    // Volume Indicators
    obv: TI.OBV.calculate({
      close: closes,
      volume: volumes
    }),
    
    // Stochastic
    stochastic: TI.Stochastic.calculate({
      high: highs,
      low: lows,
      close: closes,
      period: 14,
      signalPeriod: 3
    })
  };
}

function interpretSignals(indicators) {
  const latest = {
    rsi: indicators.rsi[indicators.rsi.length - 1],
    macd: indicators.macd[indicators.macd.length - 1],
    sma20: indicators.sma20[indicators.sma20.length - 1],
    sma50: indicators.sma50[indicators.sma50.length - 1],
    bollinger: indicators.bollinger[indicators.bollinger.length - 1],
    stochastic: indicators.stochastic[indicators.stochastic.length - 1]
  };

  let bullishSignals = 0;
  let bearishSignals = 0;

  // RSI signals (0-100)
  if (latest.rsi < 30) bullishSignals += 2; // Oversold
  if (latest.rsi > 70) bearishSignals += 2; // Overbought

  // MACD crossover
  if (latest.macd.histogram > 0) bullishSignals += 1;
  if (latest.macd.histogram < 0) bearishSignals += 1;

  // Moving average crossover
  if (latest.sma20 > latest.sma50) bullishSignals += 1.5;
  if (latest.sma20 < latest.sma50) bearishSignals += 1.5;

  // Bollinger Bands (price touching bands)
  const currentPrice = latest.bollinger.upper? latest.bollinger.lower : 0;
  if (currentPrice && currentPrice < latest.bollinger.lower) bullishSignals += 1;
  if (currentPrice && currentPrice > latest.bollinger.upper) bearishSignals += 1;

  return {
    bullishSignals,
    bearishSignals,
    score: (bullishSignals / (bullishSignals + bearishSignals)) * 2 // Normalize to 0-2
  };
}

module.exports = {
  calculateTechnicalIndicators,
  interpretSignals
};
```

### Update AI Predictor with Technical Indicators
File: `backend/ai-predictor.js`

```javascript
const technicalIndicators = require('./technical-indicators');
const stockData = require('./stock-data');

async function predictStockPrice(ticker, targetDate) {
  try {
    const currentPrice = await stockData.getStockPrice(ticker);
    
    // Get 1 year of historical data
    const historicalData = await stockData.getHistoricalPrices(ticker, 365);
    
    // Calculate technical indicators
    const indicators = await technicalIndicators.calculateTechnicalIndicators(historicalData);
    const technicalSignals = technicalIndicators.interpretSignals(indicators);
    
    // Get sentiment and news
    const sentiment = await analyzeSentiment(ticker);
    const newsFrequency = await analyzeNewsFrequency(ticker);
    
    // Get trend and volatility
    const trend = await stockData.calculateTrendFromHistory(ticker, 365);
    const volatility = await stockData.calculateVolatilityFromHistory(ticker, 365);

    // Weights (updated with technical indicators)
    const weights = {
      sentiment: 0.15,
      newsFrequency: 0.10,
      technicalSignals: 0.40,  // NEW - BIGGEST WEIGHT
      trend: 0.15,
      volatility: 0.10,
      volume: 0.10
    };

    // Calculate weighted score
    const volumeRatio = 0.8 + Math.random() * 0.3;
    const baseAnalystRating = 0.6 + Math.random() * 0.3;

    const score =
      (sentiment * weights.sentiment) +
      (newsFrequency * weights.newsFrequency) +
      (Math.min(technicalSignals.score / 2, 1) * weights.technicalSignals) + // NEW
      ((trend + 1) / 2 * weights.trend) +
      ((1 - volatility) * weights.volatility) +
      (volumeRatio * weights.volume);

    // Expected return influenced by technical signals
    const technicalInfluence = (technicalSignals.bullishSignals - technicalSignals.bearishSignals) * 0.02;
    const expectedReturn = (trend * 0.10) + technicalInfluence + ((score - 0.5) * 0.08);

    return {
      ticker,
      currentPrice: currentPrice.price,
      expectedReturn,
      technicalSignals,
      indicators: {
        rsi: indicators.rsi[indicators.rsi.length - 1],
        macd: indicators.macd[indicators.macd.length - 1],
        sma: {
          sma20: indicators.sma20[indicators.sma20.length - 1],
          sma50: indicators.sma50[indicators.sma50.length - 1]
        }
      },
      factors: {
        sentiment: Math.round(sentiment * 100),
        newsFrequency: Math.round(newsFrequency * 100),
        technicalScore: Math.round(technicalSignals.score * 50),
        trend: Math.round((trend + 1) / 2 * 100),
        volatility: Math.round(volatility * 100)
      }
    };
  } catch (error) {
    console.error('Error predicting stock price:', error);
    throw error;
  }
}
```

---

## Part 3: Machine Learning with Historical Data

### Option 1: scikit-learn (Python) - Best for Beginners ⭐ RECOMMENDED

**Setup**:
```bash
# Install Python (if not already)
python3 --version

# Install packages
pip3 install scikit-learn pandas numpy yfinance ta-lib
```

Create `ml-model.py`:
```python
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score
import yfinance as yf
import talib

def train_ml_model(ticker):
    # Fetch 5 years of data
    df = yf.download(ticker, period='5y', progress=False)
    
    # Calculate technical indicators
    df['RSI'] = talib.RSI(df['Close'], timeperiod=14)
    df['MACD'], df['MACD_signal'], df['MACD_hist'] = talib.MACD(df['Close'])
    df['SMA20'] = talib.SMA(df['Close'], timeperiod=20)
    df['SMA50'] = talib.SMA(df['Close'], timeperiod=50)
    df['BB_upper'], df['BB_middle'], df['BB_lower'] = talib.BBANDS(df['Close'])
    df['ATR'] = talib.ATR(df['High'], df['Low'], df['Close'])
    
    # Volume indicators
    df['OBV'] = talib.OBV(df['Close'], df['Volume'])
    df['Volume_SMA'] = talib.SMA(df['Volume'], timeperiod=20)
    
    # Create target: 1 if price goes up in 2 days, 0 otherwise
    df['Target'] = (df['Close'].shift(-2) > df['Close']).astype(int)
    
    # Drop rows with NaN
    df.dropna(inplace=True)
    
    # Features
    feature_cols = ['RSI', 'MACD', 'MACD_hist', 'SMA20', 'SMA50', 
                    'BB_upper', 'BB_lower', 'ATR', 'OBV', 'Volume_SMA']
    X = df[feature_cols]
    y = df['Target']
    
    # Scale features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    # Split data (80-20)
    X_train, X_test, y_train, y_test = train_test_split(
        X_scaled, y, test_size=0.2, random_state=42
    )
    
    # Train ensemble model
    model = GradientBoostingClassifier(
        n_estimators=100,
        learning_rate=0.1,
        max_depth=5,
        random_state=42
    )
    model.fit(X_train, y_train)
    
    # Evaluate
    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred)
    recall = recall_score(y_test, y_pred)
    
    print(f"\n{ticker} ML Model Results:")
    print(f"Accuracy: {accuracy:.2%}")
    print(f"Precision: {precision:.2%}")
    print(f"Recall: {recall:.2%}")
    
    return model, scaler

# Train for multiple stocks
for ticker in ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA']:
    train_ml_model(ticker)
```

**Run it**:
```bash
python3 ml-model.py
```

---

### Option 2: TensorFlow (Deep Learning)

**For more advanced users** - Better for large datasets

```bash
pip3 install tensorflow keras pandas yfinance ta-lib
```

Create `ml-lstm.py`:
```python
import numpy as np
import pandas as pd
import yfinance as yf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from sklearn.preprocessing import MinMaxScaler

def train_lstm_model(ticker):
    # Fetch 5 years of daily data
    df = yf.download(ticker, period='5y', progress=False)
    data = df['Close'].values.reshape(-1, 1)
    
    # Normalize
    scaler = MinMaxScaler(feature_range=(0, 1))
    scaled_data = scaler.fit_transform(data)
    
    # Create sequences (predict next day based on 60 previous days)
    def create_sequences(data, seq_length=60):
        X, y = [], []
        for i in range(len(data) - seq_length):
            X.append(data[i:i+seq_length])
            y.append(data[i+seq_length])
        return np.array(X), np.array(y)
    
    X, y = create_sequences(scaled_data, seq_length=60)
    split = int(len(X) * 0.8)
    X_train, X_test = X[:split], X[split:]
    y_train, y_test = y[:split], y[split:]
    
    # Build LSTM model
    model = Sequential([
        LSTM(50, activation='relu', input_shape=(60, 1)),
        Dropout(0.2),
        LSTM(50, activation='relu'),
        Dropout(0.2),
        Dense(25, activation='relu'),
        Dense(1)
    ])
    
    model.compile(optimizer='adam', loss='mse')
    model.fit(X_train, y_train, epochs=25, batch_size=32, validation_split=0.1)
    
    # Evaluate
    y_pred = model.predict(X_test)
    y_pred = scaler.inverse_transform(y_pred)
    y_test_actual = scaler.inverse_transform(y_test)
    
    mape = np.mean(np.abs((y_test_actual - y_pred) / y_test_actual)) * 100
    print(f"{ticker} LSTM MAPE: {mape:.2f}%")
    
    return model, scaler
```

---

### Option 3: Use Pre-trained Models - Easiest

**Libraries that have pre-trained models**:

1. **Prophet** (Facebook) - Time series forecasting
```bash
pip3 install prophet
```

2. **AutoGluon** - AutoML (finds best model automatically)
```bash
pip3 install autogluon
```

3. **H2O AutoML** - Enterprise-grade
```bash
pip3 install h2o
```

---

## Quick Setup Checklist

- [ ] Fix News API (get new key)
- [ ] Install `technicalindicators`: `npm install technicalindicators`
- [ ] Update `ai-predictor.js` with technical indicators
- [ ] Setup Python environment: `python3 -m venv ml-env && source ml-env/bin/activate`
- [ ] Install ML packages: `pip3 install sklearn pandas yfinance ta-lib`
- [ ] Train initial model: `python3 ml-model.py`
- [ ] Test with data: Compare predictions to actual prices

---

## Expected Accuracy Improvements

| Stage | Accuracy |
|-------|----------|
| Current (basic) | 13.84% |
| + Technical Indicators | ~18-22% |
| + Better Data Sources | ~22-28% |
| + ML Model (sklearn) | 30-40% |
| + Deep Learning (LSTM) | 35-50% |
| + Real-time features | 40-55% |

**Reality Check**: Even professional traders avg. 50-60% on short-term predictions. 90% is unrealistic without institutional data.

---

## Resources

- **Data Sources**:
  - Yahoo Finance: https://finance.yahoo.com
  - Alpha Vantage: https://www.alphavantage.co
  - IEX Cloud: https://iexcloud.io
  - Finnhub: https://finnhub.io
  - Polygon.io: https://polygon.io

- **Technical Analysis**:
  - TradingView: https://www.tradingview.com/pine-script/
  - Investopedia: https://www.investopedia.com/terms/
  
- **ML/AI Courses**:
  - Fast.ai: https://www.fast.ai (practical ML)
  - Andrew Ng's ML course: https://www.coursera.org/learn/machine-learning
  - Stock prediction specific: https://www.kaggle.com/learn/time-series

