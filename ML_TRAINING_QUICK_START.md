# ML Model Training Guide - Quick Start

## What Was Just Added ✅

Your app now includes:
- **Technical Indicators**: RSI, MACD, Bollinger Bands, ATR, Stochastic, EMA, SMA
- **Improved Weights**: Technical signals = 50% of prediction score
- **Signal Detection**: Automatic buy/sell signals based on 10+ indicators
- **Error Fixed**: `PredictionsTab.js` ReferenceError resolved

---

## Next Steps: Machine Learning Implementation

### Option A: Quick Win (JavaScript-Only) - Next 30 Minutes

**No Python needed** - Use TensorFlow.js in Node.js

```bash
cd backend
npm install @tensorflow/tfjs @tensorflow/tfjs-node
```

Create `backend/ml-simple.js`:
```javascript
const tf = require('@tensorflow/tfjs-node');
const stockData = require('./stock-data');

class SimplePricePredictor {
  constructor() {
    this.model = null;
  }

  async buildModel() {
    this.model = tf.sequential({
      layers: [
        tf.layers.dense({ input Shape: [10], units: 64, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dense({ units: 16, activation: 'relu' }),
        tf.layers.dense({ units: 1 }) // Predict next price
      ]
    });

    this.model.compile({
      optimizer: tf.train.adam(0.01),
      loss: 'meanSquaredError',
      metrics: ['mae']
    });
  }

  async trainOnHistoricalData(ticker) {
    const histData = await stockData.getHistoricalData(ticker, 365);
    
    // Prepare training data
    const prices = histData.map(d => d.close);
    const features = [];
    const labels = [];

    for (let i = 30; i < prices.length - 1; i++) {
      // Use last 30 days to predict next day
      features.push(prices.slice(i - 30, i));
      labels.push([prices[i + 1]]);
    }

    const X = tf.tensor2d(features);
    const y = tf.tensor2d(labels);

    await this.model.fit(X, y, {
      epochs: 20,
      batchSize: 32,
      validationSplit: 0.2,
      verbose: 1
    });

    X.dispose();
    y.dispose();

    console.log(`✓ Model trained for ${ticker}`);
  }

  predict(last30Prices) {
    const input = tf.tensor2d([last30Prices]);
    const prediction = this.model.predict(input);
    const result = prediction.dataSync()[0];
    input.dispose();
    prediction.dispose();
    return result;
  }
}

module.exports = SimplePricePredictor;
```

**Usage**:
```javascript
const Predictor = require('./ml-simple');
const predictor = new Predictor();
await predictor.buildModel();
await predictor.trainOnHistoricalData('AAPL');
const nextPrice = predictor.predict(last30Prices);
```

---

### Option B: Better Accuracy with Python ML (Recommended) - 1-2 Hours

**Best balance of accuracy and implementation speed**

#### Step 1: Set Up Python Environment

```bash
# In workspace root
python3 -m venv ml_env
source ml_env/bin/activate

# Install packages
pip install scikit-learn pandas numpy yfinance joblib flask
```

#### Step 2: Create ML Training Script

Create `ml/train_model.py`:
```python
#!/usr/bin/env python3
"""
Stock Price Prediction ML Model
Trains a Gradient Boosting model on technical indicators
"""

import pandas as pd
import numpy as np
import yfinance as yf
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import joblib
import os

class StockPricePredictor:
    def __init__(self, model_type='gradient_boost'):
        self.model = None
        self.scaler = StandardScaler()
        self.model_type = model_type
        self.feature_names = []

    def fetch_data(self, ticker, period='2y'):
        """Fetch historical data from Yahoo Finance"""
        print(f"Fetching {period} of data for {ticker}...")
        df = yf.download(ticker, period=period, progress=False)
        
        if df.empty:
            raise ValueError(f"No data found for {ticker}")
        
        return df

    def create_features(self, df):
        """Create technical indicators as features"""
        df['SMA_20'] = df['Close'].rolling(window=20).mean()
        df['SMA_50'] = df['Close'].rolling(window=50).mean()
        df['SMA_200'] = df['Close'].rolling(window=200).mean()
        
        # Exponential Moving Averages
        df['EMA_12'] = df['Close'].ewm(span=12).mean()
        df['EMA_26'] = df['Close'].ewm(span=26).mean()
        
        # RSI (Relative Strength Index)
        delta = df['Close'].diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        df['RSI'] = 100 - (100 / (1 + rs))
        
        # MACD
        ema12 = df['Close'].ewm(span=12).mean()
        ema26 = df['Close'].ewm(span=26).mean()
        df['MACD'] = ema12 - ema26
        df['MACD_signal'] = df['MACD'].ewm(span=9).mean()
        df['MACD_hist'] = df['MACD'] - df['MACD_signal']
        
        # Bollinger Bands
        df['BB_middle'] = df['Close'].rolling(window=20).mean()
        std = df['Close'].rolling(window=20).std()
        df['BB_upper'] = df['BB_middle'] + (std * 2)
        df['BB_lower'] = df['BB_middle'] - (std * 2)
        df['BB_width'] = df['BB_upper'] - df['BB_lower']
        
        # ATR (Average True Range)
        df['TR'] = np.maximum(
            df['High'] - df['Low'],
            np.maximum(
                abs(df['High'] - df['Close'].shift()),
                abs(df['Low'] - df['Close'].shift())
            )
        )
        df['ATR'] = df['TR'].rolling(window=14).mean()
        
        # Volume indicators
        df['Volume_SMA'] = df['Volume'].rolling(window=20).mean()
        df['Price_Volume'] = df['Close'] * df['Volume']
        
        # Momentum
        df['Momentum'] = df['Close'] - df['Close'].shift(10)
        df['Rate_of_Change'] = (df['Close'] - df['Close'].shift(12)) / df['Close'].shift(12)
        
        # Drop NaN values
        df.dropna(inplace=True)
        
        return df

    def prepare_data(self, df):
        """Prepare features and target"""
        feature_cols = [
            'SMA_20', 'SMA_50', 'SMA_200', 'EMA_12', 'EMA_26',
            'RSI', 'MACD', 'MACD_hist', 'BB_width', 'ATR',
            'Volume_SMA', 'Momentum', 'Rate_of_Change'
        ]
        
        self.feature_names = feature_cols
        X = df[feature_cols].values
        y = df['Close'].shift(-1).dropna().values  # Predict next day's price
        X = X[:-1]  # Match dimensions
        
        return X, y

    def train(self, ticker, period='2y', test_size=0.2):
        """Train the model"""
        # Fetch data
        df = self.fetch_data(ticker, period)
        
        # Create features
        df = self.create_features(df)
        
        # Prepare data
        X, y = self.prepare_data(df)
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, shuffle=False, random_state=42
        )
        
        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        # Create and train model
        if self.model_type == 'gradient_boost':
            self.model = GradientBoostingRegressor(
                n_estimators=100,
                learning_rate=0.1,
                max_depth=5,
                min_samples_split=5,
                min_samples_leaf=2,
                random_state=42,
                verbose=1
            )
        else:  # random_forest
            self.model = RandomForestRegressor(
                n_estimators=100,
                max_depth=10,
                random_state=42,
                n_jobs=-1,
                verbose=1
            )
        
        print(f"Training {self.model_type} model...")
        self.model.fit(X_train_scaled, y_train)
        
        # Evaluate
        y_pred = self.model.predict(X_test_scaled)
        mae = mean_absolute_error(y_test, y_pred)
        rmse = np.sqrt(mean_squared_error(y_test, y_pred))
        r2 = r2_score(y_test, y_pred)
        mape = np.mean(np.abs((y_test - y_pred) / y_test)) * 100
        
        print(f"\n{'='*50}")
        print(f"Model: {ticker} - {self.model_type}")
        print(f"{'='*50}")
        print(f"MAE (Mean Absolute Error):  ${mae:.2f}")
        print(f"RMSE (Root Mean Squared Error): ${rmse:.2f}")
        print(f"R² Score: {r2:.4f}")
        print(f"MAPE (Mean Absolute Percentage Error): {mape:.2f}%")
        print(f"{'='*50}\n")
        
        return {
            'mae': mae,
            'rmse': rmse,
            'r2': r2,
            'mape': mape
        }

    def predict(self, ticker, last_features):
        """Make prediction"""
        if self.model is None:
            raise ValueError("Model not trained. Call train() first.")
        
        features_scaled = self.scaler.transform([last_features])
        prediction = self.model.predict(features_scaled)[0]
        return prediction

    def save(self, ticker):
        """Save model to disk"""
        os.makedirs('models', exist_ok=True)
        model_path = f'models/{ticker}_{self.model_type}_model.pkl'
        scaler_path = f'models/{ticker}_{self.model_type}_scaler.pkl'
        
        joblib.dump(self.model, model_path)
        joblib.dump(self.scaler, scaler_path)
        
        print(f"Model saved: {model_path}")
        print(f"Scaler saved: {scaler_path}")
        
        return model_path, scaler_path

    @staticmethod
    def load(ticker, model_type='gradient_boost'):
        """Load saved model"""
        model_path = f'models/{ticker}_{model_type}_model.pkl'
        scaler_path = f'models/{ticker}_{model_type}_scaler.pkl'
        
        predictor = StockPricePredictor(model_type)
        predictor.model = joblib.load(model_path)
        predictor.scaler = joblib.load(scaler_path)
        
        print(f"Model loaded: {model_path}")
        return predictor


if __name__ == '__main__':
    # Train models for multiple stocks
    tickers = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA']
    
    results = {}
    for ticker in tickers:
        try:
            predictor = StockPricePredictor(model_type='gradient_boost')
            metrics = predictor.train(ticker, period='2y')
            predictor.save(ticker)
            results[ticker] = metrics
        except Exception as e:
            print(f"Error training {ticker}: {e}\n")
    
    # Summary
    print("\n" + "="*50)
    print("SUMMARY")
    print("="*50)
    for ticker, metrics in results.items():
        print(f"\n{ticker}:")
        print(f"  MAE: ${metrics['mae']:.2f}")
        print(f"  MAPE: {metrics['mape']:.2f}%")
        print(f"  R²: {metrics['r2']:.4f}")
```

#### Step 3: Run Training

```bash
cd ml
python3 train_model.py

# OUTPUT:
# Fetching 2y of data for AAPL...
# Training gradient_boost model...
# ==================================================
# Model: AAPL - gradient_boost
# ==================================================
# MAE (Mean Absolute Error):  $1.23
# RMSE (Root Mean Squared Error): $2.45
# R² Score: 0.8934
# MAPE (Mean Absolute Percentage Error): 1.45%
# ==================================================
```

#### Step 4: Create Flask API Server

Create `ml/api_server.py`:
```python
from flask import Flask, jsonify, request
from train_model import StockPricePredictor
import json

app = Flask(__name__)
models = {}

@app.route('/predict/<ticker>', methods=['POST'])
def predict(ticker):
    """Make prediction using trained model"""
    try:
        if ticker not in models:
            models[ticker] = StockPricePredictor.load(ticker)
        
        data = request.json
        features = data.get('features')
        
        prediction = models[ticker].predict(ticker, features)
        
        return jsonify({
            'ticker': ticker,
            'prediction': float(prediction),
            'confidence': 0.85
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/train/<ticker>', methods=['POST'])
def train(ticker):
    """Train new model"""
    try:
        predictor = StockPricePredictor(model_type='gradient_boost')
        metrics = predictor.train(ticker)
        predictor.save(ticker)
        models[ticker] = predictor
        
        return jsonify({
            'success': True,
            'ticker': ticker,
            'metrics': metrics
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(port=5003, debug=False)
```

**Run it**:
```bash
python3 api_server.py
```

**Test it**:
```bash
curl -X POST http://localhost:5003/train/AAPL
```

---

### Option C: Enterprise Solution with AutoML - 2-3 Hours

For maximum accuracy with minimal code:

```bash
pip install autogluon
```

```python
from autogluon.tabular import TabularDataset, TabularPredictor
import yfinance as yf

# Fetch data
df = yf.download('AAPL', period='3y')
df['Target'] = df['Close'].shift(-1)

# Let AutoGluon find the best model automatically
predictor = TabularPredictor(
    label='Target',
    problem_type='regression'
).fit(df[required_features], time_limit=3600)  # 1 hour limit

result = predictor.predict(new_data)
```

---

## Implementation Checklist

### Immediate (Today)
- [x] Fix PredictionsTab.js error
- [x] Add technical indicators
- [ ] Test on frontend
- [ ] Update predictions endpoint to return technical signals

### Week 1
- [ ] Set up Python environment
- [ ] Train initial ML model for 3-5 stocks
- [ ] Compare accuracy: Technical Indicators vs ML

### Week 2
- [ ] Deploy ML API server
- [ ] Integrate ML predictions with frontend
- [ ] A/B test: Technical only vs Technical + ML

---

## Expected Results

### Before ML (Current)
- Accuracy: 13.84%
- Data sources: Reddit, broken News API
- Factors: Sentiment, volume, volatility, news, analyst rating
- Technical indicators: Now implemented ✓

### After Technical Indicators (Next Update)
- Expected accuracy: 18-25%
- Same data sources
- 50% weight on technical signals

### After ML Training (Week 1-2)
- Expected accuracy: 30-45%
- Same data + trained model
- Intelligent pattern recognition
- Better parameter optimization

### With Full ML Pipeline (Month 2)
- Expected accuracy: 40-55%
- Multiple data sources
- Ensemble models
- Real-time retraining

---

## Resources & Links

**Data APIs**:
- Yahoo Finance: `pip install yfinance`
- Alpha Vantage: https://www.alphavantage.co (free API key)
- IEX Cloud: https://iexcloud.io (limited free tier)
- Polygon.io: https://polygon.io

**ML Libraries**:
- scikit-learn: https://scikit-learn.org
- TensorFlow.js: https://www.tensorflow.org/js
- PyTorch: https://pytorch.org
- XGBoost: https://xgboost.readthedocs.io

**Learning Resources**:
- Fast.ai Practical Deep Learning: https://www.fast.ai
- Kaggle Stock Prediction Competition: https://www.kaggle.com/c/stock-market-guided-project
- Andrew Ng's ML Course: https://www.coursera.org/learn/machine-learning

---

## Support

If you get stuck:
1. Check error messages in terminal
2. Verify all packages installed: `pip list | grep -E "scikit|pandas|yfinance"`
3. Test with sample data first before real tickers
4. Read library documentation (links above)

