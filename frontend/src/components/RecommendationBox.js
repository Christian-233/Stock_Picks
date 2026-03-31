import React, { useEffect, useState } from 'react';
import { apiClient } from '../api';

const RECOMMENDATION_CONFIDENCE_FLOOR = 0.9;

function safeParse(value) {
  if (!value) {
    return null;
  }
  if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
    return value;
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (error) {
      return null;
    }
  }
  return null;
}

function formatDate(timestamp) {
  if (!Number.isFinite(Number(timestamp))) {
    return 'N/A';
  }
  return new Date(Number(timestamp) * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
}

function extractRecommendations(predictions) {
  const perTicker = new Map();

  predictions.forEach((prediction) => {
    const targetDates = safeParse(prediction.target_dates) || [];
    const priceRanges = safeParse(prediction.price_ranges) || [];
    const predictedPrices = safeParse(prediction.predicted_prices) || [];
    const confidenceScores = safeParse(prediction.confidence_scores) || [];
    const ticker = prediction.ticker;

    for (let index = 0; index < Math.max(targetDates.length, 2); index += 1) {
      const range = priceRanges?.[index] || null;
      const confidenceFromRange = Number(range?.confidence);
      const confidenceFromScores = Number(Array.isArray(confidenceScores) ? confidenceScores[index] : confidenceScores);
      const confidence = Number.isFinite(confidenceFromRange)
        ? confidenceFromRange
        : (Number.isFinite(confidenceFromScores) ? confidenceFromScores : null);

      if (!Number.isFinite(confidence) || confidence < RECOMMENDATION_CONFIDENCE_FLOOR) {
        continue;
      }

      const threshold = Number(range?.low);
      const fallbackThreshold = Number(Array.isArray(predictedPrices) ? predictedPrices[index] : predictedPrices);
      const record = {
        ticker,
        confidence,
        threshold: Number.isFinite(threshold) ? threshold : (Number.isFinite(fallbackThreshold) ? fallbackThreshold : null),
        targetDate: Number(targetDates[index]) || null
      };

      const existing = perTicker.get(ticker);
      if (!existing || record.confidence > existing.confidence) {
        perTicker.set(ticker, record);
      }
    }
  });

  return [...perTicker.values()].sort((a, b) => b.confidence - a.confidence);
}

export function RecommendationBox() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [recommendations, setRecommendations] = useState([]);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        setLoading(true);
        const predictions = await apiClient.getPredictions();
        if (!isMounted) {
          return;
        }
        setRecommendations(extractRecommendations(predictions || []));
        setError(null);
      } catch (err) {
        if (!isMounted) {
          return;
        }
        setRecommendations([]);
        setError(err.message || 'Failed to load recommendations.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section className="recommendation-box">
      <div className="recommendation-box-header">
        <h3>High-Confidence Threshold Recommendations</h3>
        <span className="recommendation-threshold">90%+ confidence</span>
      </div>

      {loading && <div className="recommendation-empty">Loading recommendations...</div>}
      {!loading && error && <div className="recommendation-empty">⚠️ {error}</div>}
      {!loading && !error && recommendations.length === 0 && (
        <div className="recommendation-empty">
          No stocks currently meet the 90% confidence threshold.
        </div>
      )}

      {!loading && !error && recommendations.length > 0 && (
        <div className="recommendation-list">
          {recommendations.map((item) => (
            <div key={item.ticker} className="recommendation-item">
              <div className="recommendation-ticker">{item.ticker}</div>
              <div className="recommendation-metrics">
                <span>Threshold: {Number.isFinite(item.threshold) ? `$${item.threshold.toFixed(2)}` : 'N/A'}</span>
                <span>Target: {formatDate(item.targetDate)}</span>
                <span>Confidence: {(item.confidence * 100).toFixed(0)}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
