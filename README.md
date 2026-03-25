# AI Stock Predictor

> **An intelligent stock prediction system powered by AI-driven news analysis and custom algorithm optimization.**

## 🎯 Key Features

### 📈 Intelligent Predictions
- **Weekly Predictions**: Generated every Monday for Wednesday & Friday closes
- **Locked Predictions**: Cannot be modified once created (integrity guaranteed)
- **Confidence Scores**: Each prediction includes a confidence level
- **Accuracy Tracking**: Real-time validation against actual market prices

### 📰 News Analysis Engine
- **Daily Scraping**: Automatically pulls financial news from NewsAPI every day
- **Reddit Integration**: Scrapes discussions from r/stocks, r/investing, r/wallstreetbets
- **Sentiment Analysis**: Classifies articles and posts as positive/negative/neutral
- **Community Insights**: Leverage crowd sentiment from Reddit discussions
- **Relevance Sorting**: Ranks news by recency and relevance
- **User Feedback**: Mark articles helpful/unhelpful to train algorithm

### ⚙️ Customizable Algorithm
- **5-Factor Model**: Sentiment, Volume, Volatility, News Frequency, Analyst Ratings
- **Weight Adjustment**: Modify algorithm weights in real-time
- **Performance History**: Track weight changes and their impact
- **Automated Normalization**: Weights always sum to 100%

### 📊 Comprehensive Analytics
- **Historical Accuracy**: View past prediction performance
- **Weekly Adjustments**: Algorithm learns and improves over time
- **Trend Analysis**: See which factors drive predictions
- **Data Export**: All data stored in SQLite for further analysis

### 🎨 Google Stitch Landing Page
- **Professional Design**: Beautiful marketing landing page built in Google Stitch
- **Responsive Layout**: Works perfectly on desktop, tablet, and mobile
- **Seamless Navigation**: Landing page → React app dashboard
- **Brand Consistency**: Matching colors, fonts, and design system

## 🚀 Quick Start

### Prerequisites
- Node.js 14+ and npm
- NewsAPI key (free at https://newsapi.org)

### Installation & Launch

**Mac/Linux:**
```bash
chmod +x start.sh
./start.sh
```

**Windows:**
```bash
start.bat
```

**Or Manual:**
```bash
# Backend
cd backend && npm install && npm run dev

# Frontend (new terminal)
cd frontend && npm install && npm start
```

Visit `http://localhost:3000`

## 📋 How It Works

### Prediction Cycle
```
Monday 9:30 AM
└─► Generate predictions for Wed & Fri
    ├─► Analyze latest news
    ├─► Calculate sentiment
    ├─► Apply algorithm weights
    └─► Store immutable predictions

Wednesday 4:05 PM
└─► Check actual vs predicted price
    ├─► Update accuracy records
    └─► Display results

Friday 4:05 PM  
└─► Check actual vs predicted price
    ├─► Calculate accuracy rate
    ├─► Suggest weight adjustments
    └─► Prepare for next week
```

### Algorithm Formula

```
Prediction = Current Price × (1 + Expected Return)

Expected Return = 
  (Sentiment × 0.25) +
  (Volume × 0.15) +
  ((1 - Volatility) × 0.20) +
  (News Frequency × 0.20) +
  (Analyst Rating × 0.20)
```

### Sentiment Analysis
- **Positive**: bullish, surge, gain, rally, soar, profit, beat, strong, growth
- **Negative**: bearish, drop, loss, decline, crash, fall, miss, weak, risk
- **Neutral**: Everything else

## 🎨 UI Tabs

### Predictions Tab
- Add/remove stock tickers
- Generate new predictions
- View confidence scores and targets
- Track accuracy per ticker
- See historical predictions

### News Tab
- Select ticker to view relevant news
- Articles sorted by relevance
- Sentiment badges per article
- Mark helpful/unhelpful
- Source and publication info

### Algorithm Tab
- View current week's weights
- Understand each factor
- Adjust weights manually
- Auto-normalize functionality
- See recent performance

### Weights History Tab
- Track weight evolution
- Compare week-to-week changes
- View trend indicators (↑ ↓ →)
- Filter by ticker

## 📁 Project Structure

```
AI Stock Pick/
├── backend/
│   ├── server.js              # Express server
│   ├── database.js            # SQLite setup
│   ├── routes.js              # API endpoints
│   ├── ai-predictor.js        # Prediction logic
│   ├── news-scraper.js        # News fetching
│   ├── stock-data.js          # Stock prices
│   ├── scheduler.js           # Cron jobs
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── App.js
│   │   ├── api.js
│   │   └── components/
│   │       ├── PredictionsTab.js
│   │       ├── NewsTab.js
│   │       ├── AlgorithmTab.js
│   │       └── WeightsTab.js
│   └── public/
│
├── docs/
│   └── README.md              # Full documentation
│
├── QUICKSTART.md              # Quick setup guide
├── start.sh / start.bat       # Launch scripts
└── package.json               # Root package config
```

## 🔌 API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/predictions` | All predictions |
| GET | `/api/predictions/:ticker` | Ticker predictions |
| POST | `/api/predict` | Generate new predictions |
| GET | `/api/news/:ticker` | Ticker news articles |
| POST | `/api/scrape-news` | Manually scrape news |
| GET | `/api/stock/:ticker` | Current stock price |
| GET | `/api/accuracy/:ticker` | Accuracy history |
| GET | `/api/algorithm/details` | Algorithm info |
| POST | `/api/weights/update` | Update weights |
| GET | `/api/weights/history` | Weights history |

## 🗄️ Database Schema

**predictions**: Prediction records with confidence and news summary  
**accuracy_checks**: Validation of predictions vs actual prices  
**news**: Scraped articles with sentiment analysis  
**weights_history**: Algorithm weight snapshots over time  

## ⚙️ Configuration

### Environment Variables

**Backend (.env):**
```
PORT=5000
NEWS_API_KEY=your_key_here
DATABASE_PATH=./data/predictions.db
NODE_ENV=development
```

**Frontend (.env):**
```
REACT_APP_API_URL=http://localhost:5000/api
```

### Schedule Times

All times in UTC. Edit `backend/scheduler.js`:
- Daily news scrape: `0 18 * * *` (6 PM)
- Monday predictions: `30 9 * * 1` (9:30 AM)
- Accuracy check: `5 16 * * 3/5` (4:05 PM)

## 🔄 Customization

### Change Prediction Days
Edit `generateMondayPredictions()` in `backend/ai-predictor.js`

### Change Algorithm Factors
Modify `currentWeights` object in `backend/ai-predictor.js`

### Change Tickers
Update `defaultTickers` in `backend/scheduler.js`

### Add More Factors
Extend `predictStockPrice()` function with new analysis

## 📊 Performance Metrics

After running for several weeks, check:
- Accuracy rate per ticker
- Factor contribution to predictions
- Weight drift over time
- Most predictive news sources
- Optimal weight combinations

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Port in use | Change PORT in `.env` |
| Module not found | Run `npm install` |
| No news appearing | Verify NEWS_API_KEY |
| Database error | Delete `backend/data/` and restart |
| CORS errors | Check API_URL in frontend .env |

## 📈 Future Improvements

- Real-time price updates via WebSocket
- Machine learning model training
- Multi-day predictions
- Risk analysis and portfolios
- Email/SMS notifications
- Advanced charting
- Backtesting framework

## 📝 License

Private Project. All rights reserved.

## 🙋 Support

For setup help, see `QUICKSTART.md`  
For detailed docs, see `docs/README.md`  
For Google Stitch integration, see `STITCH_SETUP_GUIDE.md`  

---

**Happy predicting! 📈**
# Stock_Picks
