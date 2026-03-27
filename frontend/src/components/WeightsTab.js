import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api';
import { SearchableTickerInput } from './SearchableTickerInput';
import './WeightsTab.css';

export function WeightsTab() {
  const [weightsHistory, setWeightsHistory] = useState([]);
  const [selectedTicker, setSelectedTicker] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchWeightsHistory = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient.getWeightsHistory(selectedTicker || null);
      setWeightsHistory(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching weights history:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedTicker]);

  useEffect(() => {
    fetchWeightsHistory();
  }, [fetchWeightsHistory]);

  const parseWeights = (row) => {
    const source = row.algorithm_weights || row;

    return {
      historicalTrend: Number(source.historicalTrend ?? row.weight_historical_trend ?? row.weight_sentiment ?? 0),
      technicalSignals: Number(source.technicalSignals ?? row.weight_technical_signals ?? 0),
      newsSentiment: Number(source.newsSentiment ?? row.weight_news_sentiment ?? 0),
      redditSentiment: Number(source.redditSentiment ?? row.weight_reddit_sentiment ?? 0),
      volatilityControl: Number(source.volatilityControl ?? row.weight_volatility ?? 0),
      calibrationAdjustment: Number(source.calibrationAdjustment ?? row.weight_calibration_adjustment ?? 0)
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
          <SearchableTickerInput 
            onSelectTicker={(ticker) => setSelectedTicker(ticker)}
            placeholder="Search stocks by name or ticker..."
          />
          {selectedTicker && (
            <button 
              className="clear-ticker-btn"
              onClick={() => setSelectedTicker('')}
            >
              Clear filter
            </button>
          )}
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
                  <th>Historical Trend</th>
                  <th>Technical Signals</th>
                  <th>News Sentiment</th>
                  <th>Reddit Sentiment</th>
                  <th>Volatility Control</th>
                  <th>Calibration</th>
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
                      <td className={`weight-cell ${getWeightChange(weights.historicalTrend, prevWeights?.historicalTrend)}`}>
                        {(weights.historicalTrend * 100).toFixed(1)}%
                        <span className="trend">{getWeightChange(weights.historicalTrend, prevWeights?.historicalTrend) === 'up' ? '↑' : getWeightChange(weights.historicalTrend, prevWeights?.historicalTrend) === 'down' ? '↓' : '→'}</span>
                      </td>
                      <td className={`weight-cell ${getWeightChange(weights.technicalSignals, prevWeights?.technicalSignals)}`}>
                        {(weights.technicalSignals * 100).toFixed(1)}%
                        <span className="trend">{getWeightChange(weights.technicalSignals, prevWeights?.technicalSignals) === 'up' ? '↑' : getWeightChange(weights.technicalSignals, prevWeights?.technicalSignals) === 'down' ? '↓' : '→'}</span>
                      </td>
                      <td className={`weight-cell ${getWeightChange(weights.newsSentiment, prevWeights?.newsSentiment)}`}>
                        {(weights.newsSentiment * 100).toFixed(1)}%
                        <span className="trend">{getWeightChange(weights.newsSentiment, prevWeights?.newsSentiment) === 'up' ? '↑' : getWeightChange(weights.newsSentiment, prevWeights?.newsSentiment) === 'down' ? '↓' : '→'}</span>
                      </td>
                      <td className={`weight-cell ${getWeightChange(weights.redditSentiment, prevWeights?.redditSentiment)}`}>
                        {(weights.redditSentiment * 100).toFixed(1)}%
                        <span className="trend">{getWeightChange(weights.redditSentiment, prevWeights?.redditSentiment) === 'up' ? '↑' : getWeightChange(weights.redditSentiment, prevWeights?.redditSentiment) === 'down' ? '↓' : '→'}</span>
                      </td>
                      <td className={`weight-cell ${getWeightChange(weights.volatilityControl, prevWeights?.volatilityControl)}`}>
                        {(weights.volatilityControl * 100).toFixed(1)}%
                        <span className="trend">{getWeightChange(weights.volatilityControl, prevWeights?.volatilityControl) === 'up' ? '↑' : getWeightChange(weights.volatilityControl, prevWeights?.volatilityControl) === 'down' ? '↓' : '→'}</span>
                      </td>
                      <td className={`weight-cell ${getWeightChange(weights.calibrationAdjustment, prevWeights?.calibrationAdjustment)}`}>
                        {(weights.calibrationAdjustment * 100).toFixed(1)}%
                        <span className="trend">{getWeightChange(weights.calibrationAdjustment, prevWeights?.calibrationAdjustment) === 'up' ? '↑' : getWeightChange(weights.calibrationAdjustment, prevWeights?.calibrationAdjustment) === 'down' ? '↓' : '→'}</span>
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
