# Configuration Guide

## Getting Started with API Keys

### 1. NewsAPI (Required for News Scraping)

**Sign up:**
1. Visit https://newsapi.org/register
2. Fill in your details
3. Choose "Developer" plan (free)
4. Click "Register"

**Get your key:**
1. Check your email for confirmation
2. Log in to https://newsapi.org
3. Go to "API Keys" in the dashboard
4. Copy your API key

**Add to project:**
1. Open `backend/.env`
2. Paste: `NEWS_API_KEY=your_copied_key`
3. Save the file

### 2. OpenAI API (Optional - for enhanced predictions)

**Sign up:**
1. Visit https://platform.openai.com/signup
2. Create account with email or Google
3. Verify email

**Get your key:**
1. Go to https://platform.openai.com/api/keys
2. Click "Create new secret key"
3. Copy the key (save it - you won't see it again!)

**Add to project:**
1. Open `backend/.env`
2. Paste: `OPENAI_API_KEY=your_key`
3. Save the file

## Port Configuration

### Default Ports
- **Backend API**: 5000 (http://localhost:5000)
- **Frontend App**: 3000 (http://localhost:3000)

### Change Backend Port
Edit `backend/.env`:
```
PORT=5001
```

### Change Frontend Port
In `frontend`, create `.env`:
```
PORT=3001
REACT_APP_API_URL=http://localhost:5001/api
```

## Database Configuration

### Location
Default: `backend/data/predictions.db`

### Change Location
Edit `backend/.env`:
```
DATABASE_PATH=/custom/path/to/database.db
```

## Environment

### Development
```
NODE_ENV=development
```
- Enables logging
- Hot reload enabled
- Debug mode active

### Production
```
NODE_ENV=production
```
- Minimal logging
- Optimized performance
- Error tracking

## Scheduler Configuration

All times are in UTC. Edit `backend/scheduler.js`:

### Daily News Scraping
```javascript
schedule.scheduleJob('0 18 * * *', async () => {
  // Runs at 6 PM UTC every day
});
```

**Cron Format Explanation:**
- `0` = minute (0)
- `18` = hour (6 PM in 24-hr format)
- `*` = every day
- `*` = every month
- `*` = every day of week

### Monday Predictions
```javascript
schedule.scheduleJob('30 9 * * 1', async () => {
  // Runs at 9:30 AM UTC on Mondays (day 1)
});
```

### Wednesday Accuracy Check
```javascript
schedule.scheduleJob('5 16 * * 3', async () => {
  // Runs at 4:05 PM UTC on Wednesdays (day 3)
});
```

### Friday Accuracy Check
```javascript
schedule.scheduleJob('5 16 * * 5', async () => {
  // Runs at 4:05 PM UTC on Fridays (day 5)
});
```

**Common Times (UTC to your timezone):**
- 6 PM UTC = 1 PM EST, 10 AM PST
- 9:30 AM UTC = 4:30 AM EST, 1:30 AM PST
- 4:05 PM UTC = 11:05 AM EST, 8:05 AM PST

## Default Tickers

Currently configured: `['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA']`

### Change Tickers
Edit `backend/scheduler.js`:
```javascript
const defaultTickers = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA'];
// Change to your preferred tickers
```

Examples: `NVDA`, `AMD`, `TSLA`, `BRK.B`, `GOOG`, `META`, etc.

## Algorithm Weights

### Default Weights
```javascript
{
  sentiment: 0.25,      // 25%
  volume: 0.15,         // 15%
  volatility: 0.20,     // 20%
  newsFrequency: 0.20,  // 20%
  analystRating: 0.20   // 20%
}
```

### Adjust Weights Programmatically
Edit `backend/ai-predictor.js`:
```javascript
let currentWeights = {
  sentiment: 0.30,      // Increase sentiment to 30%
  volume: 0.10,         // Decrease volume to 10%
  volatility: 0.20,
  newsFrequency: 0.20,
  analystRating: 0.20
  // Total must equal 1.00 (100%)
};
```

### Or Use the UI
- Go to "Algorithm" tab
- Adjust sliders
- Click "Save Weights"
- Weights auto-normalize to 100%

## Email Notifications (Future Enhancement)

To add email alerts, you would add:

**In `.env`:**
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
ALERT_EMAIL=recipient@example.com
```

**Note:** Gmail requires an "App Password" (2FA enabled)

## Logging Configuration

### Enable Debug Logging
```
DEBUG=*
```

### Disable Most Logging
```
LOG_LEVEL=error
```

## CORS Configuration

If frontend and backend are on different domains:

Edit `backend/server.js`:
```javascript
app.use(cors({
  origin: 'https://yourdomain.com',
  credentials: true
}));
```

## Database Backup

### Backup daily
```bash
cp backend/data/predictions.db backend/data/predictions.backup.db
```

### Automated backup script
Create `backend/backup.sh`:
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
cp backend/data/predictions.db backend/backups/predictions_$DATE.db
```

## Production Deployment Checklist

- [ ] Review all `.env` values
- [ ] Use strong, unique API keys
- [ ] Enable HTTPS
- [ ] Set `NODE_ENV=production`
- [ ] Configure appropriate CORS origins
- [ ] Set up database backups
- [ ] Configure cloud logging
- [ ] Set up error monitoring (Sentry, etc.)
- [ ] Use environment variables, not hardcoded values
- [ ] Enable rate limiting on API endpoints
- [ ] Set up SSL certificates
- [ ] Configure firewall rules
- [ ] Test all scheduled jobs
- [ ] Document custom configurations

## Performance Optimization

### Increase Predictions Cache
- Reduce calls to external APIs
- Cache news for reuse

### Database Indexing
```sql
CREATE INDEX idx_ticker_date ON predictions(ticker, created_at);
CREATE INDEX idx_news_ticker ON news(ticker, published_at);
```

### Load Balancing
- Run multiple backend instances
- Use reverse proxy (nginx, etc.)
- Load balance between instances

## Monitoring

### Check Backend Health
```bash
curl http://localhost:5000/health
```

### Monitor Logs
```bash
# Backend logs
tail -f backend/server.log

# Frontend console
# Open browser DevTools (F12) → Console
```

### Database Health
```bash
sqlite3 backend/data/predictions.db
sqlite> SELECT COUNT(*) FROM news;
sqlite> SELECT COUNT(*) FROM predictions;
```

## Troubleshooting

**Issue: "Cannot find module"**
```bash
npm install
# or
npm ci  # For exact versions
```

**Issue: Port already in use**
```bash
# macOS/Linux: Find process
lsof -i :5000

# Kill process
kill -9 <PID>

# Or change port in .env
```

**Issue: CORS errors**
- Ensure REACT_APP_API_URL matches backend URL
- Check backend CORS settings

**Issue: No news appearing**
- Verify NEWS_API_KEY is valid
- Check API plan has requests remaining
- Verify ticker symbols are recognized by NewsAPI

**Issue: Database locked**
```bash
rm backend/data/predictions.db
npm run dev
```

## Advanced Configuration

### Custom Stock Data Source

Replace `backend/stock-data.js` `getStockPrice()`:
```javascript
async function getStockPrice(ticker) {
  const response = await yourAPI.getPrice(ticker);
  return {
    ticker,
    price: response.price,
    timestamp: Date.now()
  };
}
```

### Custom Sentiment Analysis

Replace `backend/news-scraper.js` `analyzeSentiment()`:
```javascript
function analyzeSentiment(text) {
  // Use Hugging Face, IBM Watson, or custom ML model
  const result = ml.analyze(text);
  return result.sentiment;
}
```

### Custom Prediction Algorithm

Modify `backend/ai-predictor.js` `predictStockPrice()`:
```javascript
// Add custom formula or ML model
const prediction = yourModel.predict({
  currentPrice,
  sentiment,
  volume,
  volatility,
  // ... more factors
});
```

---

**Need help?** Check QUICKSTART.md or docs/README.md
