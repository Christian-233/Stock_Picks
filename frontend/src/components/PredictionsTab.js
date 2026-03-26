import React, { useState, useEffect } from 'react';
import { apiClient } from '../api';
import { SearchableTickerInput } from './SearchableTickerInput';
import './PredictionsTab.css';

export function PredictionsTab() {
  // Initialize from localStorage, fallback to default list
  const [tickers, setTickers] = useState(() => {
    const saved = localStorage.getItem('selectedTickers');
    return saved ? JSON.parse(saved) : ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA'];
  });
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [accuracy, setAccuracy] = useState({});
  const [error, setError] = useState(null);
  const [suggestedStocks, setSuggestedStocks] = useState(['NVDA', 'META', 'NFLX']); // Will be updated from scraping

  // Persist tickers to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('selectedTickers', JSON.stringify(tickers));
  }, [tickers]);

  useEffect(() => {
    fetchPredictions();
    fetchSuggestedStocks();
  }, []);

  const fetchSuggestedStocks = async () => {
    try {
      const data = await apiClient.getSuggestedStocks();
      setSuggestedStocks(data.suggestedStocks || ['NVDA', 'META', 'NFLX']);
    } catch (error) {
      console.warn('Could not fetch suggested stocks:', error);
      // Keep default suggestions
    }
  };

  const fetchPredictions = async () => {
    try {
      setLoading(true);
      setError(null); // Clear previous errors
      const data = await apiClient.getPredictions();
      setPredictions(data);

      // Fetch accuracy for each ticker
      const accuracyData = {};
      for (const ticker of [...new Set(data.map(p => p.ticker))]) {
        try {
          const acc = await apiClient.getAccuracy(ticker);
          accuracyData[ticker] = acc;
        } catch (err) {
          console.warn(`Could not fetch accuracy for ${ticker}:`, err);
          accuracyData[ticker] = { accuracyRate: 0, checks: [] };
        }
      }
      setAccuracy(accuracyData);
    } catch (error) {
      console.error('Error fetching predictions:', error);
      setError(error.message || 'Failed to fetch predictions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTicker = (ticker) => {
    if (ticker && !tickers.includes(ticker)) {
      setTickers([...tickers, ticker]);
    }
  };

  const handleRemoveTicker = (ticker) => {
    setTickers(tickers.filter(t => t !== ticker));
  };

  const handleGeneratePredictions = async () => {
    if (tickers.length === 0) {
      setError('Please select at least one ticker');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      console.log('Generating predictions for:', tickers);
      const result = await apiClient.generatePredictions(tickers);
      console.log('Prediction result:', result);
      if (!result.success && result.error) {
        setError(result.error);
      } else if (result.error) {
        setError(result.error);
      } else {
        await fetchPredictions();
      }
    } catch (error) {
      const errorMsg = error.message || 'Unknown error';
      const fullError = `Failed to generate predictions: ${errorMsg}`;
      setError(fullError);
      console.error('Full error details:', error);
      console.error('Error stack:', error.stack);
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
      
      {error && (
        <div className="error-message">
          ⚠️ {error}
        </div>
      )}
      
      <div className="ticker-controls">
        <div className="ticker-input-group">
          <SearchableTickerInput 
            onSelectTicker={handleAddTicker}
            placeholder="Search stocks by name or ticker..."
          />
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

        <div className="suggested-tickers">
          <h4>Suggested Stocks:</h4>
          <div className="ticker-list">
            {suggestedStocks.slice(0, 3).map(ticker => (
              <div key={ticker} className="ticker-badge suggested">
                {ticker}
                <button onClick={() => handleAddTicker(ticker)}>+</button>
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
            predictions
              .filter(prediction => {
                // Only show user-selected stocks + 3 suggested stocks
                const allAllowedStocks = [...tickers, ...suggestedStocks.slice(0, 3)];
                return allAllowedStocks.includes(prediction.ticker);
              })
              .map(prediction => {
              try {
                // Safe JSON parsing - check if already an object or string
                const safeParse = (value) => {
                  if (!value) return null;
                  if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
                    return value; // Already parsed
                  }
                  if (typeof value === 'string') {
                    try {
                      return JSON.parse(value);
                    } catch (e) {
                      console.error('Failed to parse:', value, e);
                      return null;
                    }
                  }
                  return null;
                };

                const targetDates = safeParse(prediction.target_dates);
                const priceRanges = safeParse(prediction.price_ranges);
                const predictedPrices = safeParse(prediction.predicted_prices);
                const confidenceScores = safeParse(prediction.confidence_scores);
                const tickerAccuracy = accuracy[prediction.ticker];
                const accuracyRate = tickerAccuracy ? tickerAccuracy.accuracyRate : 'N/A';

                // Validate data exists
                if (!targetDates || !predictedPrices || !confidenceScores) {
                  return (
                    <div key={prediction.id} className="prediction-card error">
                      <div className="card-header">
                        <h3>{prediction.ticker}</h3>
                      </div>
                      <div className="error-message">Unable to render prediction data</div>
                    </div>
                  );
                }

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
                  const price = Array.isArray(predictedPrices) ? predictedPrices[index] : predictedPrices;
                  const confidence = Array.isArray(confidenceScores) ? confidenceScores[index] : confidenceScores;
                  
                  return (
                    <div className="price-forecast">
                      <div className="predicted-price">
                        ${typeof price === 'number' ? price.toFixed(2) : 'N/A'}
                      </div>
                      <div className="confidence">
                        Confidence: {typeof confidence === 'number' ? (confidence * 100).toFixed(0) : '0'}%
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
              } catch (error) {
                console.error('Error rendering prediction for', prediction?.ticker, error);
                return (
                  <div key={prediction?.id} className="prediction-card error">
                    <div className="card-header">
                      <h3>{prediction?.ticker || 'Unknown'}</h3>
                    </div>
                    <div className="error-message">
                      Error: {error.message || 'Unknown error rendering prediction'}
                    </div>
                  </div>
                );
              }
            })
          )}
        </div>
      )}
    </div>
  );
}
