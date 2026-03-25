import React, { useState, useEffect } from 'react';
import { apiClient } from '../api';
import './WeightsTab.css';

export function WeightsTab() {
  const [weightsHistory, setWeightsHistory] = useState([]);
  const [selectedTicker, setSelectedTicker] = useState('');
  const [loading, setLoading] = useState(false);
  const [tickers] = useState(['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA']);

  useEffect(() => {
    fetchWeightsHistory();
  }, [selectedTicker]);

  const fetchWeightsHistory = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getWeightsHistory(selectedTicker || null);
      setWeightsHistory(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching weights history:', error);
    } finally {
      setLoading(false);
    }
  };

  const parseWeights = (row) => {
    return {
      sentiment: row.weight_sentiment,
      volume: row.weight_volume,
      volatility: row.weight_volatility,
      newsFrequency: row.weight_news_frequency,
      analystRating: row.weight_analyst_rating
    };
  };

  const getWeightChange = (current, previous) => {
    if (!previous) return 'new';
    const diff = current - previous;
    if (diff > 0.05) return 'up';
    if (diff < -0.05) return 'down';
    return 'stable';
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: '2-digit'
    });
  };

  return (
    <div className="weights-tab">
      <h2>Algorithm Weights History</h2>

      <div className="weights-controls">
        <div className="ticker-selector">
          <label>Filter by Ticker (Optional):</label>
          <select 
            value={selectedTicker}
            onChange={(e) => setSelectedTicker(e.target.value)}
          >
            <option value="">All Tickers</option>
            {tickers.map(ticker => (
              <option key={ticker} value={ticker}>{ticker}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="weights-info">
        <p>Track how algorithm weights evolve over time based on prediction accuracy. 
           Weights are adjusted weekly to improve prediction performance.</p>
      </div>

      {loading ? (
        <div className="loading">Loading weights history...</div>
      ) : weightsHistory.length === 0 ? (
        <div className="no-data">No weights history available yet.</div>
      ) : (
        <div className="weights-history">
          <div className="weights-table-container">
            <table className="weights-table">
              <thead>
                <tr>
                  <th>Week / Year</th>
                  <th>Ticker</th>
                  <th>Sentiment</th>
                  <th>Volume</th>
                  <th>Volatility</th>
                  <th>News Frequency</th>
                  <th>Analyst Rating</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {weightsHistory.map((row, index) => {
                  const weights = parseWeights(row);
                  const prevWeights = index > 0 ? parseWeights(weightsHistory[index + 1]) : null;

                  return (
                    <tr key={row.id} className={index === 0 ? 'current' : ''}>
                      <td className="week-cell">
                        <strong>W{row.week_number}</strong>
                        <span className="year">{row.year}</span>
                      </td>
                      <td>{row.ticker || 'Global'}</td>
                      <td className={`weight-cell ${getWeightChange(weights.sentiment, prevWeights?.sentiment)}`}>
                        {(weights.sentiment * 100).toFixed(1)}%
                        <span className="trend">{getWeightChange(weights.sentiment, prevWeights?.sentiment) === 'up' ? '↑' : getWeightChange(weights.sentiment, prevWeights?.sentiment) === 'down' ? '↓' : '→'}</span>
                      </td>
                      <td className={`weight-cell ${getWeightChange(weights.volume, prevWeights?.volume)}`}>
                        {(weights.volume * 100).toFixed(1)}%
                        <span className="trend">{getWeightChange(weights.volume, prevWeights?.volume) === 'up' ? '↑' : getWeightChange(weights.volume, prevWeights?.volume) === 'down' ? '↓' : '→'}</span>
                      </td>
                      <td className={`weight-cell ${getWeightChange(weights.volatility, prevWeights?.volatility)}`}>
                        {(weights.volatility * 100).toFixed(1)}%
                        <span className="trend">{getWeightChange(weights.volatility, prevWeights?.volatility) === 'up' ? '↑' : getWeightChange(weights.volatility, prevWeights?.volatility) === 'down' ? '↓' : '→'}</span>
                      </td>
                      <td className={`weight-cell ${getWeightChange(weights.newsFrequency, prevWeights?.newsFrequency)}`}>
                        {(weights.newsFrequency * 100).toFixed(1)}%
                        <span className="trend">{getWeightChange(weights.newsFrequency, prevWeights?.newsFrequency) === 'up' ? '↑' : getWeightChange(weights.newsFrequency, prevWeights?.newsFrequency) === 'down' ? '↓' : '→'}</span>
                      </td>
                      <td className={`weight-cell ${getWeightChange(weights.analystRating, prevWeights?.analystRating)}`}>
                        {(weights.analystRating * 100).toFixed(1)}%
                        <span className="trend">{getWeightChange(weights.analystRating, prevWeights?.analystRating) === 'up' ? '↑' : getWeightChange(weights.analystRating, prevWeights?.analystRating) === 'down' ? '↓' : '→'}</span>
                      </td>
                      <td className="date-cell">
                        {formatDate(row.updated_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="weights-visualization">
            <h3>Weight Evolution</h3>
            <div className="chart-placeholder">
              <p>Visualize weight changes over time to understand algorithm evolution</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
