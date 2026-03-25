import React, { useState, useEffect } from 'react';
import { apiClient } from '../api';
import './PredictionsTab.css';

export function PredictionsTab() {
  const [tickers, setTickers] = useState(['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA']);
  const [newTicker, setNewTicker] = useState('');
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [accuracy, setAccuracy] = useState({});

  useEffect(() => {
    fetchPredictions();
  }, []);

  const fetchPredictions = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getPredictions();
      setPredictions(data);

      // Fetch accuracy for each ticker
      const accuracyData = {};
      for (const ticker of [...new Set(data.map(p => p.ticker))]) {
        const acc = await apiClient.getAccuracy(ticker);
        accuracyData[ticker] = acc;
      }
      setAccuracy(accuracyData);
    } catch (error) {
      console.error('Error fetching predictions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTicker = (e) => {
    e.preventDefault();
    const ticker = newTicker.toUpperCase();
    if (ticker && !tickers.includes(ticker)) {
      setTickers([...tickers, ticker]);
      setNewTicker('');
    }
  };

  const handleRemoveTicker = (ticker) => {
    setTickers(tickers.filter(t => t !== ticker));
  };

  const handleGeneratePredictions = async () => {
    try {
      setLoading(true);
      await apiClient.generatePredictions(tickers);
      await fetchPredictions();
    } catch (error) {
      console.error('Error generating predictions:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="predictions-tab">
      <h2>Stock Predictions</h2>
      
      <div className="ticker-controls">
        <div className="ticker-input-group">
          <input
            type="text"
            value={newTicker}
            onChange={(e) => setNewTicker(e.target.value)}
            placeholder="Enter ticker symbol (e.g., AAPL)"
            maxLength="5"
          />
          <button onClick={handleAddTicker}>Add Ticker</button>
        </div>

        <div className="selected-tickers">
          <h4>Selected Tickers:</h4>
          <div className="ticker-list">
            {tickers.map(ticker => (
              <div key={ticker} className="ticker-badge">
                {ticker}
                <button onClick={() => handleRemoveTicker(ticker)}>×</button>
              </div>
            ))}
          </div>
        </div>

        <button 
          className="generate-btn"
          onClick={handleGeneratePredictions}
          disabled={loading || tickers.length === 0}
        >
          {loading ? 'Generating...' : 'Generate Predictions for This Week'}
        </button>
      </div>

      {loading ? (
        <div className="loading">Loading predictions...</div>
      ) : (
        <div className="predictions-grid">
          {predictions.length === 0 ? (
            <div className="no-data">No predictions yet. Generate predictions to get started.</div>
          ) : (
            predictions.map(prediction => {
              const targetDates = prediction.target_dates;
              const priceRanges = prediction.price_ranges ? JSON.parse(prediction.price_ranges) : null;
              const predictedPrices = prediction.predicted_prices;
              const confidenceScores = prediction.confidence_scores;
              const tickerAccuracy = accuracy[prediction.ticker];
              const accuracyRate = tickerAccuracy ? tickerAccuracy.accuracyRate : 'N/A';

              // Helper function to render price range or single price
              const renderPriceForecasts = (index) => {
                const priceRange = priceRanges ? priceRanges[index] : null;
                
                if (priceRange) {
                  return (
                    <div className="price-range-container">
                      <div className="price-range-item low">
                        <span className="label">Low</span>
                        <span className="price">${priceRange.low.toFixed(2)}</span>
                      </div>
                      <div className="price-range-item mid">
                        <span className="label">Mid</span>
                        <span className="price">${priceRange.mid.toFixed(2)}</span>
                      </div>
                      <div className="price-range-item high">
                        <span className="label">High</span>
                        <span className="price">${priceRange.high.toFixed(2)}</span>
                        <span className="confidence-badge">
                          {(priceRange.confidences.high * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  );
                }
                
                // Fallback to single price if no range available
                return (
                  <div className="price-forecast">
                    <div className="predicted-price">
                      ${predictedPrices[index].toFixed(2)}
                    </div>
                    <div className="confidence">
                      Confidence: {(confidenceScores[index] * 100).toFixed(0)}%
                    </div>
                  </div>
                );
              };

              return (
                <div key={prediction.id} className="prediction-card">
                  <div className="card-header">
                    <h3>{prediction.ticker}</h3>
                    <span className="accuracy-badge">
                      Accuracy: {accuracyRate}%
                    </span>
                  </div>

                  <div className="prediction-details">
                    <div className="prediction-item">
                      <div className="target-day">
                        <strong>Wednesday</strong>
                        <span className="date">{formatDate(targetDates[0])}</span>
                      </div>
                      {renderPriceForecasts(0)}
                    </div>

                    <div className="prediction-item">
                      <div className="target-day">
                        <strong>Friday</strong>
                        <span className="date">{formatDate(targetDates[1])}</span>
                      </div>
                      {renderPriceForecasts(1)}
                    </div>
                  </div>

                  <div className="prediction-footer">
                    <small>Generated: {new Date(prediction.created_at * 1000).toLocaleDateString()}</small>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
