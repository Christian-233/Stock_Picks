import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../api';
import './ApiStatusTab.css';

export function ApiStatusTab() {
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);

  const checkApis = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/health-check`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      setHealthData(data);
      setLastChecked(new Date());
      console.log('Health check data:', data);
    } catch (err) {
      setError(err.message);
      console.error('Health check error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial check on mount
    checkApis();
    
    // Set up auto-refresh every 30 seconds
    const interval = setInterval(checkApis, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'working':
        return '✅';
      case 'error':
        return '❌';
      case 'failed':
        return '❌';
      case 'unauthorized':
        return '🔑';
      case 'nokey':
        return '⚠️';
      default:
        return '❓';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'working':
        return '#28a745';
      case 'error':
        return '#dc3545';
      case 'failed':
        return '#dc3545';
      case 'unauthorized':
        return '#ffc107';
      case 'nokey':
        return '#ffc107';
      default:
        return '#6c757d';
    }
  };

  return (
    <div className="api-status-container">
      <div className="status-header">
        <h2>🔌 API Status Monitor</h2>
        <p className="subtitle">Verify all data sources and APIs are working correctly</p>
      </div>

      <div className="status-controls">
        <button 
          className="refresh-button"
          onClick={checkApis}
          disabled={loading}
        >
          {loading ? '⏳ Checking...' : '🔄 Refresh Status'}
        </button>
        
        {lastChecked && (
          <div className="last-checked">
            Last checked: {lastChecked.toLocaleTimeString()}
          </div>
        )}
      </div>

      {error && (
        <div className="error-message">
          <p>❌ Error checking APIs: {error}</p>
          <p className="error-hint">Make sure the backend is running and the frontend API URL matches it.</p>
        </div>
      )}

      {loading && !healthData && (
        <div className="loading-state">
          <p>⏳ Checking all APIs...</p>
        </div>
      )}

      {healthData && (
        <div className="status-content">
          {/* Summary Card */}
          <div className="summary-card">
            <div className={`summary-status ${healthData.summary.overallStatus}`}>
              {healthData.summary.overallStatus === 'all_failed' && '🔴'}
              {healthData.summary.overallStatus === 'partial' && '🟡'}
              {healthData.summary.overallStatus === 'working' && '🟢'}
            </div>
            <div className="summary-text">
              <h3>{healthData.summary.message}</h3>
              <p>{healthData.summary.working} out of {healthData.summary.total} APIs operational</p>
            </div>
          </div>

          {/* Data Sources Card */}
          <div className="sources-card">
            <h3>📊 Data Sources</h3>
            <div className="sources-grid">
              {/* Yahoo Finance */}
              <div className="source-item">
                <div className="source-header">
                  <span className="status-badge" style={{ backgroundColor: getStatusColor(healthData.sources.yahooFinance?.status) }}>
                    {getStatusIcon(healthData.sources.yahooFinance?.status)}
                  </span>
                  <h4>Yahoo Finance</h4>
                </div>
                <div className="source-details">
                  <p className="status-text">{healthData.sources.yahooFinance?.message}</p>
                  {healthData.sources.yahooFinance?.price && (
                    <p className="price-info">AAPL: ${healthData.sources.yahooFinance.price.toFixed(2)}</p>
                  )}
                  {healthData.sources.yahooFinance?.timestamp && (
                    <p className="timestamp">{healthData.sources.yahooFinance.timestamp}</p>
                  )}
                  {healthData.sources.yahooFinance?.error && (
                    <p className="error-info">{healthData.sources.yahooFinance.error}</p>
                  )}
                </div>
              </div>

              {/* Finnhub */}
              <div className="source-item">
                <div className="source-header">
                  <span className="status-badge" style={{ backgroundColor: getStatusColor(healthData.sources.finnhub?.status) }}>
                    {getStatusIcon(healthData.sources.finnhub?.status)}
                  </span>
                  <h4>Finnhub</h4>
                </div>
                <div className="source-details">
                  <p className="status-text">{healthData.sources.finnhub?.message}</p>
                  {healthData.sources.finnhub?.price && (
                    <p className="price-info">AAPL: ${healthData.sources.finnhub.price.toFixed(2)}</p>
                  )}
                  {healthData.sources.finnhub?.timestamp && (
                    <p className="timestamp">{healthData.sources.finnhub.timestamp}</p>
                  )}
                  {healthData.sources.finnhub?.error && (
                    <p className="error-info">{healthData.sources.finnhub.error}</p>
                  )}
                </div>
              </div>

              {/* Alpha Vantage */}
              <div className="source-item">
                <div className="source-header">
                  <span className="status-badge" style={{ backgroundColor: getStatusColor(healthData.sources.alphaVantage?.status) }}>
                    {getStatusIcon(healthData.sources.alphaVantage?.status)}
                  </span>
                  <h4>Alpha Vantage</h4>
                </div>
                <div className="source-details">
                  <p className="status-text">{healthData.sources.alphaVantage?.message}</p>
                  {healthData.sources.alphaVantage?.price && (
                    <p className="price-info">AAPL: ${healthData.sources.alphaVantage.price.toFixed(2)}</p>
                  )}
                  {healthData.sources.alphaVantage?.timestamp && (
                    <p className="timestamp">{healthData.sources.alphaVantage.timestamp}</p>
                  )}
                  {healthData.sources.alphaVantage?.error && (
                    <p className="error-info">{healthData.sources.alphaVantage.error}</p>
                  )}
                </div>
              </div>

              {/* News API */}
              <div className="source-item">
                <div className="source-header">
                  <span className="status-badge" style={{ backgroundColor: getStatusColor(healthData.sources.newsAPI?.status) }}>
                    {getStatusIcon(healthData.sources.newsAPI?.status)}
                  </span>
                  <h4>News API</h4>
                </div>
                <div className="source-details">
                  <p className="status-text">{healthData.sources.newsAPI?.message}</p>
                  {healthData.sources.newsAPI?.articlesFound !== undefined && (
                    <p className="articles-info">{healthData.sources.newsAPI.articlesFound.toLocaleString()} articles available</p>
                  )}
                  {healthData.sources.newsAPI?.timestamp && (
                    <p className="timestamp">{healthData.sources.newsAPI.timestamp}</p>
                  )}
                  {healthData.sources.newsAPI?.error && (
                    <p className="error-info">{healthData.sources.newsAPI.error}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Info Section */}
          <div className="info-section">
            <h3>ℹ️ What This Means</h3>
            <div className="info-items">
              <div className="info-item">
                <span className="info-icon">✅</span>
                <div>
                  <strong>Working:</strong> API is responding and providing real data
                </div>
              </div>
              <div className="info-item">
                <span className="info-icon">⚠️</span>
                <div>
                  <strong>No Key / Not Configured:</strong> API key not set in .env or optional
                </div>
              </div>
              <div className="info-item">
                <span className="info-icon">🔑</span>
                <div>
                  <strong>Authentication Error:</strong> API key is invalid or expired
                </div>
              </div>
              <div className="info-item">
                <span className="info-icon">❌</span>
                <div>
                  <strong>Error:</strong> API connection failed or rate limit reached
                </div>
              </div>
            </div>
          </div>

          {/* Details Section */}
          <div className="details-section">
            <h3>📋 Setup Guide</h3>
            <div className="setup-items">
              <div className="setup-item">
                <h4>Yahoo Finance</h4>
                <p>✅ Default - free, no setup needed</p>
              </div>
              <div className="setup-item">
                <h4>Finnhub</h4>
                <p>Optional - get key at <a href="https://finnhub.io/register" target="_blank" rel="noopener noreferrer">finnhub.io/register</a></p>
                <p>Add to .env: <code>FINNHUB_API_KEY=your_key</code></p>
              </div>
              <div className="setup-item">
                <h4>Alpha Vantage</h4>
                <p>Optional - get key at <a href="https://www.alphavantage.co" target="_blank" rel="noopener noreferrer">alphavantage.co</a></p>
                <p>Add to .env: <code>ALPHA_VANTAGE_KEY=your_key</code></p>
              </div>
              <div className="setup-item">
                <h4>News API</h4>
                <p>Required for news scraping - get key at <a href="https://newsapi.org/register" target="_blank" rel="noopener noreferrer">newsapi.org/register</a></p>
                <p>Add to .env: <code>NEWS_API_KEY=your_key</code></p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
