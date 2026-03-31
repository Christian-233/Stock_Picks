const db = require('./database');

const VALID_SENTIMENTS = new Set(['positive', 'neutral', 'negative']);

function inferSentiment(text) {
  const value = String(text || '').toLowerCase();
  if (!value.trim()) {
    return 'neutral';
  }

  const positiveWords = ['bullish', 'surge', 'gain', 'rally', 'soar', 'profit', 'beat', 'strong', 'growth', 'upside'];
  const negativeWords = ['bearish', 'drop', 'loss', 'decline', 'crash', 'fall', 'miss', 'weak', 'risk', 'downgrade'];
  const positiveCount = positiveWords.filter((word) => value.includes(word)).length;
  const negativeCount = negativeWords.filter((word) => value.includes(word)).length;

  if (positiveCount > negativeCount) {
    return 'positive';
  }
  if (negativeCount > positiveCount) {
    return 'negative';
  }
  return 'neutral';
}

function parsePublishedAt(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 1e12 ? Math.floor(value / 1000) : Math.floor(value);
  }

  if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric > 1e12 ? Math.floor(numeric / 1000) : Math.floor(numeric);
    }

    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return Math.floor(parsed / 1000);
    }
  }

  return Math.floor(Date.now() / 1000);
}

function toOptionalNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function stableImportUrl(row, ticker, publishedAt) {
  if (row.url && String(row.url).trim()) {
    return String(row.url).trim();
  }
  const source = String(row.source || 'imported').toLowerCase().replace(/\s+/g, '-');
  const title = String(row.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'untitled';
  return `imported://${source}/${ticker}/${publishedAt}/${title}`;
}

function normalizeImportedRow(row, options = {}) {
  const defaultTicker = String(options.defaultTicker || '').toUpperCase();
  const ticker = String(row.ticker || defaultTicker || '').toUpperCase().trim();
  const title = String(row.title || '').trim();

  if (!ticker || !title) {
    return null;
  }

  const publishedAt = parsePublishedAt(row.published_at ?? row.publishedAt ?? row.created_at ?? row.createdAt);
  const source = String(row.source || options.defaultSource || 'imported').trim();
  const description = row.description == null ? null : String(row.description);
  const content = row.content == null ? null : String(row.content);
  const sentimentCandidate = String(row.sentiment || '').toLowerCase().trim();
  const sentiment = VALID_SENTIMENTS.has(sentimentCandidate)
    ? sentimentCandidate
    : inferSentiment(`${title} ${description || ''} ${content || ''}`);

  return {
    ticker,
    title,
    description,
    content,
    source,
    url: stableImportUrl(row, ticker, publishedAt),
    publishedAt,
    sentiment,
    relevanceScore: toOptionalNumber(row.relevance_score ?? row.relevanceScore),
    isHelpful: row.is_helpful === undefined && row.isHelpful === undefined
      ? null
      : ((row.is_helpful ?? row.isHelpful) ? 1 : 0)
  };
}

async function importNewsRows(rows = [], options = {}) {
  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const normalized = normalizeImportedRow(row, options);
    if (!normalized) {
      skipped += 1;
      continue;
    }

    await db.run(
      `INSERT INTO news (
        ticker, title, description, content, source, url, published_at, sentiment, relevance_score, is_helpful
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(url) DO UPDATE SET
        ticker = excluded.ticker,
        title = excluded.title,
        description = excluded.description,
        content = excluded.content,
        source = excluded.source,
        published_at = excluded.published_at,
        sentiment = excluded.sentiment,
        relevance_score = COALESCE(excluded.relevance_score, news.relevance_score),
        is_helpful = COALESCE(excluded.is_helpful, news.is_helpful),
        scraped_at = strftime('%s', 'now')`,
      [
        normalized.ticker,
        normalized.title,
        normalized.description,
        normalized.content,
        normalized.source,
        normalized.url,
        normalized.publishedAt,
        normalized.sentiment,
        normalized.relevanceScore,
        normalized.isHelpful
      ]
    );
    imported += 1;
  }

  return {
    received: rows.length,
    imported,
    skipped
  };
}

module.exports = {
  normalizeImportedRow,
  importNewsRows
};
