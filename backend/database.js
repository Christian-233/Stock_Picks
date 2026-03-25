const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'data', 'predictions.db');
const dataDir = path.dirname(dbPath);

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Connected to SQLite database');
  }
});

const init = () => {
  db.serialize(() => {
    // Predictions table
    db.run(`
      CREATE TABLE IF NOT EXISTS predictions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticker TEXT NOT NULL,
        prediction_date INTEGER NOT NULL,
        target_dates TEXT NOT NULL,
        predicted_prices TEXT NOT NULL,
        confidence_scores TEXT NOT NULL,
        price_ranges TEXT,
        news_summary TEXT,
        algorithm_weights TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        UNIQUE(ticker, prediction_date, target_dates)
      )
    `);

    // Add price_ranges column if it doesn't exist (for existing databases)
    db.run(`
      PRAGMA table_info(predictions);
    `, [], function(err, row) {
      if (err) return;
      // Column will be added automatically in new databases via CREATE TABLE above
    });

    // Accuracy table
    db.run(`
      CREATE TABLE IF NOT EXISTS accuracy_checks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticker TEXT NOT NULL,
        prediction_id INTEGER NOT NULL,
        target_date INTEGER NOT NULL,
        predicted_price REAL NOT NULL,
        actual_price REAL,
        was_correct BOOLEAN,
        checked_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY(prediction_id) REFERENCES predictions(id)
      )
    `);

    // News table
    db.run(`
      CREATE TABLE IF NOT EXISTS news (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticker TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        content TEXT,
        source TEXT,
        url TEXT UNIQUE,
        published_at INTEGER,
        scraped_at INTEGER DEFAULT (strftime('%s', 'now')),
        relevance_score REAL,
        sentiment TEXT,
        is_helpful BOOLEAN
      )
    `);

    // Algorithm weights history
    db.run(`
      CREATE TABLE IF NOT EXISTS weights_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        week_number INTEGER NOT NULL,
        year INTEGER NOT NULL,
        ticker TEXT,
        weight_sentiment REAL,
        weight_volume REAL,
        weight_volatility REAL,
        weight_news_frequency REAL,
        weight_analyst_rating REAL,
        updated_at INTEGER DEFAULT (strftime('%s', 'now')),
        UNIQUE(week_number, year, ticker)
      )
    `);

    console.log('Database tables initialized');
  });
};

const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

module.exports = {
  db,
  init,
  run,
  get,
  all
};
