# Data Sources Setup Guide

Your app now supports **3 professional data sources** with automatic fallback to mock data for development.

---

## 📊 Data Source Priority (Automatic Fallback)

```
1. Yahoo Finance (Recommended ⭐)
   ↓ (if unavailable)
2. Finnhub (Real-time data)
   ↓ (if unavailable)
3. Alpha Vantage (Technical data)
   ↓ (if unavailable)
4. Mock Data (Development fallback)
```

Each source is tried in order. If one fails, the system automatically falls back to the next. **You don't need all of them** — Yahoo Finance alone is enough.

---

## ✅ Yahoo Finance (DEFAULT - FREE, NO KEY REQUIRED)

### Status
- **Enabled by default** ✓
- **Cost**: Free
- **API Key**: None required
- **Rate Limit**: No limit (web scraping)
- **Data Quality**: Excellent (real market data)
- **Speed**: 1-2 seconds per request

### Setup
Already installed and working! No configuration needed.

### Features
- Current stock prices
- Historical price data (365+ days)
- Market cap, P/E ratio, dividend data
- Works with international stocks

### Test It
```javascript
// backend/test-yahoo.js
const stockData = require('./stock-data');

async function test() {
  const price = await stockData.getStockPrice('AAPL');
  console.log('AAPL Price:', price);
  
  const history = await stockData.getHistoricalData('AAPL', 30);
  console.log('30-day history:', history.length, 'days');
}

test();
```

Run with:
```bash
cd backend
node test-yahoo.js
```

---

## 🚀 Finnhub (Real-time Stock Data)

### Status
- **Optional** (recommended if you want more data)
- **Cost**: Free tier (60 API calls/minute)
- **API Key**: Required (free to generate)
- **Rate Limit**: 60 calls/minute (free), unlimited for paid
- **Data Quality**: Very good (real-time)
- **Speed**: < 500ms

### Setup

#### Step 1: Get Finnhub API Key
1. Go to https://finnhub.io/register
2. Sign up (free)
3. Copy your API key from dashboard

#### Step 2: Update .env
```bash
cd /Users/christiangore/AI\ Stock\ Pick/backend
```

Edit `.env` file:
```
FINNHUB_API_KEY=your_api_key_here
```

Example:
```
FINNHUB_API_KEY=ck6k1cq8w1yl0gn1234a
```

#### Step 3: Test It
```javascript
// backend/test-finnhub.js
const stockData = require('./stock-data');

async function test() {
  const price = await stockData.getFinnhubPrice('AAPL');
  console.log('AAPL Price (Finnhub):', price);
  
  const history = await stockData.getFinnhubHistory('AAPL', 30);
  console.log('30-day history:', history.length, 'days');
}

test();
```

### Features
- Current stock prices with OHLC data (Open, High, Low, Close)
- Real-time market data
- News sentiment analysis (paid plans)
- Technical indicators data
- Supports 50+ stock exchanges

### What You Can Get With Finnhub
```json
{
  "ticker": "AAPL",
  "price": 185.42,      // Current price
  "high": 186.50,       // Day high
  "low": 184.20,        // Day low
  "open": 184.95,       // Day open
  "previousClose": 183.50,
  "change": 1.92,       // Price change
  "source": "finnhub"
}
```

---

## 📈 Alpha Vantage (Technical Data)

### Status
- **Optional** (technical indicators)
- **Cost**: Free tier (5 API calls/minute)
- **API Key**: Required (free)
- **Rate Limit**: 5 calls/minute (free), higher for paid
- **Data Quality**: Good for technical analysis
- **Speed**: 1-3 seconds

### Setup

#### Step 1: Get Alpha Vantage Key
1. Go to https://www.alphavantage.co/
2. Click "GET FREE API KEY"
3. Enter your email
4. Copy the API key

#### Step 2: Update .env
```bash
cd /Users/christiangore/AI\ Stock\ Pick/backend
```

Edit `.env` file:
```
ALPHA_VANTAGE_KEY=your_api_key_here
```

Example:
```
ALPHA_VANTAGE_KEY=ABCD1234EFGH5678
```

#### Step 3: Test It
```javascript
// backend/test-alpha.js
const stockData = require('./stock-data');

async function test() {
  const price = await stockData.getAlphaVantagePrice('AAPL');
  console.log('AAPL Price (Alpha Vantage):', price);
  
  const history = await stockData.getAlphaVantageHistory('AAPL', 30);
  console.log('30-day history:', history.length, 'days');
}

test();
```

### Features
- Current stock prices with % change
- Historical daily/weekly/monthly data
- Technical indicators (SMA, EMA, RSI, MACD, etc.)
- Foreign currency exchange rates
- Cryptocurrency data

### What You Can Get With Alpha Vantage
```json
{
  "ticker": "AAPL",
  "price": 185.42,
  "change": 1.92,
  "changePercent": 1.04,
  "source": "alpha-vantage"
}
```

---

## 🔧 Configuration Summary

### Current Setup (.env file)
```
# Data sources - Add your keys here
YAHOO_FINANCE_ENABLED=true           # Yahoo Finance (always enabled by default)
FINNHUB_API_KEY=your_key_here        # Optional: Real-time data
ALPHA_VANTAGE_KEY=your_key_here      # Optional: Technical data
```

### How to verify each source is working

Run the monitoring endpoint:
```bash
curl http://localhost:5002/status
```

Look for data source status:
```json
{
  "dataSourceStatus": {
    "yahooFinance": {
      "enabled": true,
      "available": "Free - Recommended",
      "latency": "1-2 seconds"
    },
    "finnhub": {
      "enabled": false,
      "available": "Free tier (60 calls/min)"
    },
    "alphaVantage": {
      "enabled": false,
      "available": "Free tier (5 calls/min)"
    }
  }
}
```

---

## 📊 Comparison Table

| Feature | Yahoo Finance | Finnhub | Alpha Vantage |
|---------|--------|---------|-------|
| **Cost** | Free | Free (60/min) | Free (5/min) |
| **Setup Time** | 0 min | 5 min | 5 min |
| **Real-time Data** | ~2s delay | <500ms | 1-3s delay |
| **Historical Data** | ✓ Excellent | ✓ Good | ✓ Good |
| **Technical Indicators** | Limited | Some | ✓ Excellent |
| **International Stocks** | ✓ 50+ exchanges | ✓ 50+ exchanges | Limited |
| **Recommended** | ⭐⭐⭐ | ⭐⭐ | ⭐ (optional) |

---

## 🚦 Current Implementation Flow

When your app calls `getStockPrice('AAPL')`:

```
1. Try Yahoo Finance
   └─ If success: Return AAPL price ✓
   └─ If fail: Continue to next...

2. Try Finnhub (if key configured)
   └─ If success: Return AAPL price ✓
   └─ If fail: Continue to next...

3. Try Alpha Vantage (if key configured)
   └─ If success: Return AAPL price ✓
   └─ If fail: Continue to next...

4. Use Mock Data (always available)
   └─ Return AAPL price from memory ✓
```

Each step logs what's happening:
```
[AAPL] Fetching price...
[AAPL] ✓ Price from Yahoo Finance: $185.42
```

---

## 🔍 Troubleshooting

### Yahoo Finance Not Working?

```bash
# Test Yahoo Finance directly
cd backend
node -e "
const sf = require('yahoo-finance2').default;
sf.quote('AAPL').then(q => console.log('Price:', q.regularMarketPrice));
"
```

**Common Issues:**
- Network blocked by firewall → Use VPN or check firewall
- Web scraping blocked → Yahoo sometimes blocks scrapers (temporary)
- Node modules not installed → Run `npm install`

### Finnhub Not Working?

1. Check API key is correct in `.env`
2. Verify internet connection
3. Check rate limit (60 calls/minute)
4. Test directly:
```bash
curl "https://finnhub.io/api/v1/quote?symbol=AAPL&token=YOUR_KEY"
```

### Alpha Vantage Not Working?

1. Check API key is correct in `.env`
2. Verify you have calls available (5/minute free tier)
3. Test directly:
```bash
curl "https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=AAPL&apikey=YOUR_KEY"
```

---

## 🎯 Recommended Setup

### For Development (Testing Phase)
- ✓ Yahoo Finance only (already enabled)
- No additional setup needed

### For Production (Real Trading)
1. Keep Yahoo Finance enabled (primary)
2. Add Finnhub API key (fast, reliable)
3. Optional: Add Alpha Vantage (technical data)

### For Best Accuracy
- Use all 3 sources:
  - Yahoo Finance: Main prices
  - Finnhub: Real-time confirmation
  - Alpha Vantage: Technical indicators

---

## 📊 Usage in Code

### Get Current Price (Automatic Fallback)
```javascript
const stockData = require('./stock-data');

async function getPriceAutomatically() {
  // This will try: Yahoo → Finnhub → Alpha Vantage → Mock
  const price = await stockData.getStockPrice('AAPL');
  console.log('Price:', price.price);
  console.log('Source:', price.source);  // Shows which source was used
}
```

### Get from Specific Source
```javascript
// Force Yahoo Finance
const yahooPrice = await stockData.getYahooFinancePrice('AAPL');

// Force Finnhub
const finnhubPrice = await stockData.getFinnhubPrice('AAPL');

// Force Alpha Vantage
const avPrice = await stockData.getAlphaVantagePrice('AAPL');

// Force Mock (for testing)
const mockPrice = await stockData.getMockPrice('AAPL');
```

### Get Historical Data (Automatic Fallback)
```javascript
// Get 90 days of history (tries all sources)
const history = await stockData.getHistoricalData('AAPL', 90);

// history = [
//   { date: '2026-01-01', price: 180.50, high: 182, low: 179, volume: 50000000 },
//   { date: '2026-01-02', price: 181.20, high: 183, low: 180, volume: 45000000 },
//   ...
// ]
```

---

## 🚀 Next Steps

1. **Test with Yahoo Finance** (no setup needed)
   ```bash
   npm start  # Start backend and frontend
   curl http://localhost:5002/api/predictions?ticker=AAPL
   ```

2. **Add Finnhub** (5 minutes setup)
   - Get free API key at https://finnhub.io/register
   - Add to `.env`: `FINNHUB_API_KEY=your_key`
   - Restart backend
   - Test same endpoint again

3. **Optional: Add Alpha Vantage** (5 minutes setup)
   - Get key at https://www.alphavantage.co
   - Add to `.env`: `ALPHA_VANTAGE_KEY=your_key`
   - Restart backend

4. **Monitor data quality**
   - Check logs for which source is being used
   - Verify predictions improve with more data

---

## 📞 API Endpoints Added

### Check Data Source Status
```bash
GET http://localhost:5002/data-status
```

Response:
```json
{
  "yahooFinance": { "enabled": true, "available": "Free", "latency": "1-2s" },
  "finnhub": { "enabled": false, "available": "Free (60/min)" },
  "alphaVantage": { "enabled": false, "available": "Free (5/min)" }
}
```

---

## 💡 Pro Tips

1. **Yahoo Finance is enough** → Thousands of professional investors use it daily
2. **Finnhub for speed** → If you need faster market data (< 500ms)
3. **Alpha Vantage for indicators** → If you implement custom technical strategies
4. **Don't overload API calls** → Keep reasonable rate limits in mind
5. **Monitor in production** → Log which source is being used for each request

---

## 🎉 You Now Have

✓ Professional-grade stock data pipeline  
✓ Automatic failover between 3 data sources  
✓ Real market data (not just mock data)  
✓ Fallback to mock data for development  
✓ Logged data source tracing (see logs)  
✓ Easy API key management via .env  

Start using real data to improve your predictions! 📈

