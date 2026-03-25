import React, { useState, useEffect } from 'react';
import { apiClient } from '../api';
import './NewsTab.css';

export function NewsTab() {
  const [selectedTicker, setSelectedTicker] = useState('AAPL');
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tickers] = useState(['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA']);

  useEffect(() => {
    fetchNews(selectedTicker);
  }, [selectedTicker]);

  const fetchNews = async (ticker) => {
    try {
      setLoading(true);
      const data = await apiClient.getNews(ticker, 50);
      // Sort by published date and filter helpful indicators
      const sortedNews = Array.isArray(data) ? data.sort((a, b) => {
        return (b.published_at || 0) - (a.published_at || 0);
      }) : [];
      setNews(sortedNews);
    } catch (error) {
      console.error('Error fetching news:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleHelpful = async (newsId, currentState) => {
    try {
      await apiClient.updateNewsHelpful(newsId, !currentState);
      // Refresh news
      await fetchNews(selectedTicker);
    } catch (error) {
      console.error('Error updating news helpfulness:', error);
    }
  };

  const getSentimentColor = (sentiment) => {
    switch (sentiment) {
      case 'positive':
        return '#28a745';
      case 'negative':
        return '#dc3545';
      default:
        return '#6c757d';
    }
  };

  const getSentimentLabel = (sentiment) => {
    switch (sentiment) {
      case 'positive':
        return '📈 Positive';
      case 'negative':
        return '📉 Negative';
      default:
        return '➡️ Neutral';
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="news-tab">
      <h2>News & Analysis</h2>

      <div className="news-controls">
        <div className="ticker-selector">
          <label>Select Ticker:</label>
          <select 
            value={selectedTicker}
            onChange={(e) => setSelectedTicker(e.target.value)}
          >
            {tickers.map(ticker => (
              <option key={ticker} value={ticker}>{ticker}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="news-info">
        <p>Articles are sorted by most relevant (recent and sentiment-weighted). 
           Click the thumbs up/down to help train the algorithm.</p>
      </div>

      {loading ? (
        <div className="loading">Loading news...</div>
      ) : news.length === 0 ? (
        <div className="no-data">No news articles found. Try scraping news first.</div>
      ) : (
        <div className="news-list">
          {news.map((article, index) => (
            <div key={article.id || index} className="news-card">
              <div className="news-rank">
                <span className="rank-number">#{index + 1}</span>
              </div>

              <div className="news-content">
                <h4 className="news-title">
                  <a href={article.url} target="_blank" rel="noopener noreferrer">
                    {article.title}
                  </a>
                </h4>

                <div className="news-meta">
                  <span className="source">📰 {article.source}</span>
                  <span className="date">🕐 {formatDate(article.published_at)}</span>
                </div>

                {article.description && (
                  <p className="news-description">{article.description}</p>
                )}

                <div className="news-footer">
                  <div className="sentiment">
                    <span 
                      className="sentiment-badge"
                      style={{ backgroundColor: getSentimentColor(article.sentiment) }}
                    >
                      {getSentimentLabel(article.sentiment)}
                    </span>
                  </div>

                  <div className="helpful-buttons">
                    <button 
                      className={`helpful-btn ${article.is_helpful === 1 ? 'active' : ''}`}
                      onClick={() => toggleHelpful(article.id, article.is_helpful === 1)}
                      title="Mark as helpful"
                    >
                      👍 Helpful
                    </button>
                    <button 
                      className={`helpful-btn ${article.is_helpful === 0 ? 'active' : ''}`}
                      onClick={() => toggleHelpful(article.id, article.is_helpful === 0)}
                      title="Mark as not helpful"
                    >
                      👎 Not Helpful
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
