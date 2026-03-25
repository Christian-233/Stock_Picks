const schedule = require('node-schedule');
const newsScraper = require('./news-scraper');
const aiPredictor = require('./ai-predictor');

let scheduledJobs = [];

function initializeScheduler() {
  console.log('Initializing scheduler...');

  // Get tickers from environment or database (in production)
  // For now, using a default list
  const defaultTickers = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA'];

  // Schedule daily news scraping at 6 PM
  const dailyNewsJob = schedule.scheduleJob('0 18 * * *', async () => {
    console.log('Running daily news scrape...');
    await newsScraper.scrapeAllNews(defaultTickers);
  });
  scheduledJobs.push(dailyNewsJob);
  console.log('Daily news scraping scheduled for 18:00');

  // Schedule Monday predictions at 9:30 AM EST (market open)
  const mondayPredictionJob = schedule.scheduleJob('30 9 * * 1', async () => {
    console.log('Running Monday predictions...');
    await aiPredictor.generateMondayPredictions(defaultTickers);
  });
  scheduledJobs.push(mondayPredictionJob);
  console.log('Monday predictions scheduled for 09:30');

  // Schedule Wednesday accuracy check at 4:05 PM EST (after market close)
  const wednesdayAccuracyJob = schedule.scheduleJob('5 16 * * 3', async () => {
    console.log('Running Wednesday accuracy checks...');
    for (const ticker of defaultTickers) {
      const today = new Date();
      const timestamp = Math.floor(today.getTime() / 1000);
      await aiPredictor.checkAccuracy(ticker, timestamp);
    }
  });
  scheduledJobs.push(wednesdayAccuracyJob);
  console.log('Wednesday accuracy check scheduled for 16:05');

  // Schedule Friday accuracy check at 4:05 PM EST (after market close)
  const fridayAccuracyJob = schedule.scheduleJob('5 16 * * 5', async () => {
    console.log('Running Friday accuracy checks...');
    for (const ticker of defaultTickers) {
      const today = new Date();
      const timestamp = Math.floor(today.getTime() / 1000);
      await aiPredictor.checkAccuracy(ticker, timestamp);
    }
  });
  scheduledJobs.push(fridayAccuracyJob);
  console.log('Friday accuracy check scheduled for 16:05');

  // Run initial news scrape on startup
  newsScraper.scrapeAllNews(defaultTickers).catch(err => {
    console.error('Initial news scrape failed:', err);
  });

  console.log(`Scheduler initialized with ${scheduledJobs.length} jobs`);
}

function stopScheduler() {
  scheduledJobs.forEach(job => job.cancel());
  scheduledJobs = [];
  console.log('Scheduler stopped');
}

module.exports = {
  initializeScheduler,
  stopScheduler
};
