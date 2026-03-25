# Stock Prediction Website

A full-stack AI-powered stock prediction system that analyzes news data and market factors to predict stock prices.

## Features

- **AI Stock Predictions**: Predicts highest stock prices by Wednesday and Friday each week
- **News Scraping**: Automatically scrapes financial news daily and sorts by relevance
- **Sentiment Analysis**: Analyzes news sentiment (positive/negative/neutral)
- **Algorithm Weights**: Shows and allows adjustment of prediction algorithm weights
- **Accuracy Tracking**: Tracks and displays prediction accuracy week over week
- **Weights History**: Monitor how algorithm weights evolve and impact predictions

## Project Structure

```
AI Stock Pick/
├── backend/                 # Node.js/Express API
│   ├── server.js           # Main server entry point
│   ├── database.js         # SQLite database setup
│   ├── routes.js           # API routes
│   ├── ai-predictor.js     # Prediction algorithm
│   ├── news-scraper.js     # News scraping logic
│   ├── stock-data.js       # Stock data fetching
│   ├── scheduler.js        # Scheduled jobs (Monday/Wed/Fri)
│   ├── package.json
│   └── .env.example
│
└── frontend/               # React application
    ├── src/
    │   ├── App.js
    │   ├── App.css
    │   ├── api.js          # API client
    │   ├── components/
    │   │   ├── PredictionsTab.js
    │   │   ├── NewsTab.js
    │   │   ├── AlgorithmTab.js
    │   │   └── WeightsTab.js
    │   ├── index.js
    │   └── public/
    │       └── index.html
    ├── package.json
    └── .env.example
```

## Setup Instructions

### Backend Setup

1. Install dependencies:
```bash
cd backend
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env
# Edit .env and add your API keys:
# - NEWS_API_KEY: Get from https://newsapi.org
# - OPENAI_API_KEY: Get from https://platform.openai.com (optional)
```

3. Start the server:
```bash
npm start
# Or for development with auto-reload:
npm run dev
```

The API will be available at `http://localhost:5000`

### Frontend Setup

1. Install dependencies:
```bash
cd frontend
npm install
```

2. Configure API endpoint (optional):
```bash
# Create .env file
echo "REACT_APP_API_URL=http://localhost:5000/api" > .env
```

3. Start the application:
```bash
npm start
```

The app will open at `http://localhost:3000`

## API Endpoints

### Predictions
- `GET /api/predictions` - Get all predictions
- `GET /api/predictions/:ticker` - Get predictions for a ticker
- `POST /api/predict` - Generate new predictions

### News
- `GET /api/news/:ticker` - Get news for a ticker
- `POST /api/scrape-news` - Scrape news for tickers
- `PATCH /api/news/:id/helpful` - Mark news as helpful/unhelpful

### Stock Data
- `GET /api/stock/:ticker` - Get current stock price

### Accuracy
- `GET /api/accuracy/:ticker` - Get accuracy history

### Algorithm
- `GET /api/algorithm/details` - Get algorithm info
- `POST /api/weights/update` - Update algorithm weights
- `GET /api/weights/history` - Get weights history

## How It Works

### Prediction Process

1. **Monday**: Algorithm generates predictions for Wednesday and Friday
2. **Daily**: News is scraped and analyzed for sentiment
3. **Wednesday & Friday**: Accuracy is checked against actual prices
4. **Weekly**: Algorithm weights are adjusted based on accuracy

### Algorithm Factors

The prediction algorithm considers:
- **Sentiment** (25%): Analysis of news articles (positive/negative/neutral)
- **Volume** (15%): Trading volume compared to average
- **Volatility** (20%): Historical price volatility
- **News Frequency** (20%): Number of relevant news articles
- **Analyst Rating** (20%): Average analyst ratings

Weights can be adjusted in the Algorithm tab to emphasize different factors.

### News Sorting

News articles are sorted by:
1. Published date (most recent first)
2. Sentiment relevance to predictions
3. User feedback (helpful/not helpful votes)

Mark articles as helpful or unhelpful to improve the algorithm's news weighting.

## Database Schema

### predictions
- id: Primary key
- ticker: Stock symbol
- prediction_date: When prediction was made
- target_dates: Wednesday and Friday timestamps
- predicted_prices: Price predictions for each date
- confidence_scores: Confidence levels
- news_summary: Relevant news at time of prediction
- algorithm_weights: Weights used for prediction

### accuracy_checks
- id: Primary key
- ticker: Stock symbol
- prediction_id: Reference to prediction
- target_date: Date of prediction
- predicted_price: Predicted price
- actual_price: Actual closing price
- was_correct: Whether prediction was accurate
- checked_at: When accuracy was verified

### news
- id: Primary key
- ticker: Stock symbol
- title, description, content: Article text
- source: News source
- url: Article URL
- published_at: Publication date
- sentiment: Sentiment analysis result
- is_helpful: User feedback

### weights_history
- id: Primary key
- week_number, year: Time period
- ticker: Stock symbol (or global if null)
- weight_sentiment through weight_analyst_rating: Weight values
- updated_at: Last update time

## Notes

- Predictions are **locked** from Monday through Friday - they cannot be changed before the target date
- The algorithm generates **one set of predictions per week** (every Monday)
- News is scraped **daily** to capture the latest information
- Accuracy checks occur **after market close** on Wednesday and Friday
- All predictions are stored in SQLite for historical analysis

## Future Enhancements

- Real-time stock price data integration
- Machine learning model for improved predictions
- Email notifications for predictions
- Portfolio tracking
- Advanced charting and visualization
- Multi-timeframe predictions
- Risk analysis and stop-loss recommendations

## License

This project is private. All rights reserved.
