import React, { useState } from 'react';
import { PredictionsTab } from './components/PredictionsTab';
import { NewsTab } from './components/NewsTab';
import { AlgorithmTab } from './components/AlgorithmTab';
import { WeightsTab } from './components/WeightsTab';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('predictions');

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="logo">
            <div className="logo-with-back">
              <a href="/" className="back-link" title="Back to home">←</a>
              <h1>📈 AI Stock Predictor</h1>
            </div>
            <p className="tagline">Intelligent Stock Price Predictions with News Analysis</p>
          </div>
        </div>
      </header>

      <nav className="app-nav">
        <div className="nav-tabs">
          <button
            className={`nav-tab ${activeTab === 'predictions' ? 'active' : ''}`}
            onClick={() => setActiveTab('predictions')}
          >
            <span className="tab-icon">🎯</span>
            Predictions
          </button>
          <button
            className={`nav-tab ${activeTab === 'news' ? 'active' : ''}`}
            onClick={() => setActiveTab('news')}
          >
            <span className="tab-icon">📰</span>
            News
          </button>
          <button
            className={`nav-tab ${activeTab === 'algorithm' ? 'active' : ''}`}
            onClick={() => setActiveTab('algorithm')}
          >
            <span className="tab-icon">⚙️</span>
            Algorithm
          </button>
          <button
            className={`nav-tab ${activeTab === 'weights' ? 'active' : ''}`}
            onClick={() => setActiveTab('weights')}
          >
            <span className="tab-icon">📊</span>
            Weights History
          </button>
        </div>
      </nav>

      <main className="app-main">
        {activeTab === 'predictions' && <PredictionsTab />}
        {activeTab === 'news' && <NewsTab />}
        {activeTab === 'algorithm' && <AlgorithmTab />}
        {activeTab === 'weights' && <WeightsTab />}
      </main>

      <footer className="app-footer">
        <p>AI Stock Predictor • Data updates daily • Predictions generated every Monday</p>
      </footer>
    </div>
  );
}

export default App;
