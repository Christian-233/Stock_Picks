# AI Stock Prediction System - Quick Start Guide

## Overview

This is a complete AI-powered stock prediction system with:
- ✅ Weekly predictions (Monday generation, Wed/Fri targets)
- ✅ Daily news scraping with sentiment analysis
- ✅ Reddit discussion scraping (r/stocks, r/investing, r/wallstreetbets)
- ✅ Real-time accuracy tracking
- ✅ Algorithm weight adjustment and history
- ✅ Beautiful, responsive React UI
- ✅ SQLite database for persistence

## Quick Start (5 minutes)

### 1. Get API Keys

You'll need:
- **News API Key**: Free at https://newsapi.org/register
  - Sign up and copy your API key

### 2. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env` and add:
```
PORT=5000
NEWS_API_KEY=your_key_here
DATABASE_PATH=./data/predictions.db
NODE_ENV=development
```

Start backend:
```bash
npm run dev
```

### 3. Frontend Setup

In a new terminal:
```bash
cd frontend
npm install
npm start
```

### 4. Use the App

Visit `http://localhost:3000` and:

1. **Predictions Tab** - Add 5 stock tickers, click "Generate Predictions"
2. **News Tab** - View scraped news, mark articles as helpful/unhelpful
3. **Algorithm Tab** - Adjust weights, understand the prediction factors
4. **Weights Tab** - Track how weights change over weeks

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   React Frontend                        │
│              (Predictions, News, Algorithm)             │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP/REST
┌──────────────────────▼──────────────────────────────────┐
│              Node.js/Express Backend                    │
│  - News Scraping        - AI Predictions               │
│  - Stock Data           - Accuracy Checks              │
│  - Scheduling           - Weight Management            │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│                  SQLite Database                        │
│  - predictions        - news          - weights_history │
│  - accuracy_checks    - user_feedback                   │
└──────────────────────────────────────────────────────────┘
```

## Key Features Explained

### Weekly Prediction Cycle

- **Monday 9:30 AM**: Generate predictions for Wed & Fri closing prices
- **Wed 4:05 PM**: Check if actual price exceeded Wed prediction
- **Fri 4:05 PM**: Check if actual price exceeded Fri prediction  
- **Predictions are IMMUTABLE** - Can't change them until window closes

### News Analysis

- Scrapes news daily at 6:00 PM from NewsAPI
- Scrapes Reddit discussions from r/stocks, r/investing, r/wallstreetbets
- Analyzes sentiment (positive/negative/neutral)
- Sorts by relevance and recency
- Users can mark articles as helpful/unhelpful
- Feedback trains the algorithm
- Reddit posts show upvote counts and community engagement

### Algorithm Weights

5 factors influence predictions:
1. **Sentiment** (25%) - News sentiment analysis
2. **Volume** (15%) - Trading volume patterns
3. **Volatility** (20%) - Price volatility
4. **News Frequency** (20%) - Number of articles
5. **Analyst Rating** (20%) - Professional ratings

Weights are normalized to always sum to 100%.

### Accuracy Tracking

- Predictions checked at market close
- Compares predicted vs actual price
- Shows accuracy rate per ticker
- History available for performance analysis

## Data Stored

### predictions table
```
ticker, prediction_date, target_dates, predicted_prices, 
confidence_scores, news_summary, algorithm_weights
```

### news table
```
ticker, title, description, source, url, 
published_at, sentiment, is_helpful
```

### accuracy_checks table
```
ticker, prediction_id, target_date, predicted_price, 
actual_price, was_correct, checked_at
```

### weights_history table
```
week_number, year, ticker, 
weight_sentiment, weight_volume, weight_volatility,
weight_news_frequency, weight_analyst_rating
```

## Customization

### Change Prediction Days

Edit `backend/ai-predictor.js` `generateMondayPredictions()`:
```javascript
// Change target days from Wed/Fri to any days
const daysUntilWednesday = (3 - dayOfWeek + 7) % 7 || 7;
const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;
```

### Change Schedule Times

Edit `backend/scheduler.js`:
- Daily news scrape: `0 18 * * *` (6 PM UTC)
- Monday predictions: `30 9 * * 1` (9:30 AM UTC)
- Accuracy checks: `5 16 * * 3/5` (4:05 PM Wed/Fri UTC)

### Adjust Algorithm Factors

Edit weights in the Algorithm tab or in `backend/ai-predictor.js` `currentWeights`.

## Troubleshooting

### "Cannot find module"
```bash
npm install
```

### Port already in use
Change PORT in `.env` or close the app using port 5000.

### No news appearing
- Check NEWS_API_KEY is correct
- Verify API key has appropriate plan
- Check if ticker symbols are valid

### Database errors
```bash
rm -rf backend/data/
npm run dev
```

## Production Deployment

1. Build frontend:
```bash
cd frontend
npm run build
```

2. Mount built files to backend static serving

3. Use environment variables for:
   - Database path
   - API keys
   - Port numbers

4. Set up cron jobs or use cloud scheduler (Lambda, Cloud Functions) for:
   - Daily news scraping
   - Monday predictions
   - Wed/Fri accuracy checks

## Next Steps

1. ✅ Get News API key
2. ✅ Run `npm run dev` in backend
3. ✅ Run `npm start` in frontend
4. ✅ Add your first tickers and generate predictions
5. ✅ Customize algorithm weights for your strategy
6. ✅ Monitor accuracy and adjust over time

## Support

For issues:
1. Check `.env` file is properly configured
2. Verify API keys are valid and have usage left
3. Check browser console for errors
4. Check terminal for backend errors
5. Check SQLite database exists in `backend/data/`

Happy predicting! 📈
