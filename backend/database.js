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
    const ensureColumn = (tableName, columnName, columnDefinition) => {
      db.all(`PRAGMA table_info(${tableName})`, (err, rows) => {
        if (err) {
          console.error(`Error reading schema for ${tableName}:`, err);
          return;
        }

        if (!rows.some((row) => row.name === columnName)) {
          db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnDefinition}`, (alterErr) => {
            if (alterErr) {
              console.error(`Error adding ${columnName} to ${tableName}:`, alterErr);
            }
          });
        }
      });
    };

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
        analysis_summary TEXT,
        model_name TEXT,
        signal_context TEXT,
        feature_snapshot TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        UNIQUE(ticker, prediction_date, target_dates)
      )
    `);

    ensureColumn('predictions', 'price_ranges', 'price_ranges TEXT');
    ensureColumn('predictions', 'analysis_summary', 'analysis_summary TEXT');
    ensureColumn('predictions', 'model_name', 'model_name TEXT');
    ensureColumn('predictions', 'signal_context', 'signal_context TEXT');
    ensureColumn('predictions', 'feature_snapshot', 'feature_snapshot TEXT');

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
        realized_return_pct REAL,
        error_pct REAL,
        outcome_snapshot TEXT,
        checked_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY(prediction_id) REFERENCES predictions(id)
      )
    `);
    ensureColumn('accuracy_checks', 'realized_return_pct', 'realized_return_pct REAL');
    ensureColumn('accuracy_checks', 'error_pct', 'error_pct REAL');
    ensureColumn('accuracy_checks', 'outcome_snapshot', 'outcome_snapshot TEXT');

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

    db.run(`
      CREATE TABLE IF NOT EXISTS trained_models (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        model_name TEXT NOT NULL,
        horizon_label TEXT NOT NULL,
        intercept REAL NOT NULL,
        coefficients TEXT NOT NULL,
        feature_order TEXT NOT NULL,
        training_examples INTEGER NOT NULL,
        mae REAL,
        rmse REAL,
        trained_at INTEGER DEFAULT (strftime('%s', 'now')),
        is_active BOOLEAN DEFAULT 1,
        UNIQUE(model_name, horizon_label)
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
