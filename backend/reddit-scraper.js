const axios = require('axios');
const db = require('./database');

// Reddit doesn't require authentication for public data
// But we need a User-Agent
const REDDIT_HEADERS = {
  'User-Agent': 'AIStockPicker/1.0 (by your_reddit_username)'
};

const SUBREDDITS = ['stocks', 'investing', 'wallstreetbets'];
const MAX_POSTS_PER_SUBREDDIT = 25;

/**
 * Search Reddit for posts mentioning a specific ticker
 */
async function scrapeRedditForTicker(ticker) {
  try {
    const posts = [];

    // Search each subreddit
    for (const subreddit of SUBREDDITS) {
      try {
        const url = `https://www.reddit.com/r/${subreddit}/search.json`;
        const params = {
          q: ticker,
          sort: 'new',
          limit: MAX_POSTS_PER_SUBREDDIT,
          t: 'week', // Last week
          restrict_sr: 'on'
        };

        const response = await axios.get(url, {
          headers: REDDIT_HEADERS,
          params,
          timeout: 10000
        });

        if (response.data?.data?.children) {
          const subredditPosts = response.data.data.children.map(item => {
            const post = item.data;
            return {
              title: post.title,
              url: `https://reddit.com${post.permalink}`,
              score: post.score,
              num_comments: post.num_comments,
              created_at: Math.floor(post.created_utc),
              subreddit: subreddit,
              author: post.author
            };
          });

          posts.push(...subredditPosts);
        }
      } catch (error) {
        console.warn(`Error scraping r/${subreddit} for ${ticker}:`, error.message);
        // Continue to next subreddit
      }
    }

    // Analyze sentiment and store in database
    for (const post of posts) {
      const sentiment = analyzeSentiment(post.title);

      try {
        await db.run(
          `INSERT OR IGNORE INTO news 
           (ticker, title, description, source, url, published_at, sentiment)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            ticker,
            post.title,
            `r/${post.subreddit} | ${post.num_comments} comments | ${post.score} upvotes`,
            'reddit',
            post.url,
            post.created_at,
            sentiment
          ]
        );
      } catch (error) {
        // Ignore duplicates
        if (!error.message.includes('UNIQUE')) {
          console.error('Error storing Reddit post:', error);
        }
      }
    }

    console.log(`✓ Scraped Reddit: Found ${posts.length} posts for ${ticker}`);
    return posts;
  } catch (error) {
    console.error(`Error scraping Reddit for ${ticker}:`, error.message);
    return [];
  }
}

/**
 * Analyze sentiment from Reddit post title
 * Looks for keywords indicating positive/negative sentiment
 */
function analyzeSentiment(title) {
  const lowerTitle = title.toLowerCase();

  // Positive indicators
  const positiveWords = [
    'bull', 'buy', 'pump', 'moon', 'surge', 'rally', 'gain', 'profit',
    'strong', 'bullish', 'breakout', 'good', 'great', 'excellent',
    'increase', 'jump', 'spike', 'boom', 'opportunity', 'undervalued',
    'recovery', 'upside', 'beat', 'upgrade'
  ];

  // Negative indicators
  const negativeWords = [
    'bear', 'sell', 'dump', 'crash', 'drop', 'fall', 'loss', 'bearish',
    'dead', 'fail', 'bankruptcy', 'decline', 'plunge', 'red', 'bad',
    'disaster', 'warning', 'downgrade', 'weak', 'collapse', 'broken'
  ];

  let positiveCount = 0;
  let negativeCount = 0;

  positiveWords.forEach(word => {
    if (lowerTitle.includes(word)) positiveCount++;
  });

  negativeWords.forEach(word => {
    if (lowerTitle.includes(word)) negativeCount++;
  });

  if (positiveCount > negativeCount) {
    return 'positive';
  } else if (negativeCount > positiveCount) {
    return 'negative';
  }

  return 'neutral';
}

/**
 * Scrape all tickers from Reddit
 */
async function scrapeAllTickers(tickers) {
  console.log('Starting Reddit scrape for:', tickers);

  const results = {};
  for (const ticker of tickers) {
    const posts = await scrapeRedditForTicker(ticker);
    results[ticker] = posts.length;
    
    // Add delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return results;
}

module.exports = {
  scrapeRedditForTicker,
  scrapeAllTickers,
  analyzeSentiment
};
