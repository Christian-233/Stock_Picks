const { summarizeAccuracyHistory, summarizeNewsMetrics } = require('./prediction-math');

describe('prediction-math accuracy summary', () => {
  test('counts only resolved threshold checks in the reported accuracy percentage', () => {
    const summary = summarizeAccuracyHistory([
      { predicted_price: 100, actual_price: 102, was_correct: 1 },
      { predicted_price: 100, actual_price: 98, was_correct: 0 },
      { predicted_price: 100, actual_price: null, was_correct: null },
      { predicted_price: 100, actual_price: 101, was_correct: null }
    ]);

    expect(summary).toEqual({
      totalChecks: 2,
      resolvedChecks: 2,
      unresolvedChecks: 2,
      correctChecks: 1,
      accuracyRate: 50
    });
  });

  test('treats boolean and numeric true values as correct threshold hits', () => {
    const summary = summarizeAccuracyHistory([
      { predicted_price: 100, actual_price: 102, was_correct: true },
      { predicted_price: 100, actual_price: 103, was_correct: 1 },
      { predicted_price: 100, actual_price: 99, was_correct: false }
    ]);

    expect(summary).toEqual({
      totalChecks: 3,
      resolvedChecks: 3,
      unresolvedChecks: 0,
      correctChecks: 2,
      accuracyRate: 66.67
    });
  });

  test('computes accuracy percentage from resolved checks only with expected rounding', () => {
    const summary = summarizeAccuracyHistory([
      { predicted_price: 100, actual_price: 101, was_correct: 1 },
      { predicted_price: 100, actual_price: 102, was_correct: 1 },
      { predicted_price: 100, actual_price: 99, was_correct: 0 },
      { predicted_price: 100, actual_price: 98, was_correct: 0 },
      { predicted_price: 100, actual_price: 103, was_correct: null }
    ]);

    expect(summary.totalChecks).toBe(4);
    expect(summary.resolvedChecks).toBe(4);
    expect(summary.unresolvedChecks).toBe(1);
    expect(summary.correctChecks).toBe(2);
    expect(summary.accuracyRate).toBe(50);
  });

  test('extracts richer news and reddit signal quality metrics', () => {
    const now = Math.floor(Date.now() / 1000);
    const metrics = summarizeNewsMetrics([
      {
        title: 'AAPL rally continues',
        source: 'Reuters',
        sentiment: 'positive',
        published_at: now - 3600
      },
      {
        title: 'AAPL discussion on Reddit',
        source: 'reddit',
        description: 'r/stocks | 120 comments | 450 upvotes',
        sentiment: 'positive',
        published_at: now - 7200
      }
    ]);

    expect(metrics.articleCount).toBe(2);
    expect(metrics.redditMentions).toBe(1);
    expect(metrics.sourceDiversity).toBe(2);
    expect(metrics.sourceDiversityScore).toBeGreaterThan(0);
    expect(metrics.recencyScore).toBeGreaterThan(0);
    expect(metrics.articleQualityScore).toBeGreaterThan(0);
    expect(metrics.redditEngagementScore).toBeGreaterThan(0);
    expect(metrics.redditPostRatio).toBe(0.5);
  });
});
