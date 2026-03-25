import React, { useState, useEffect } from 'react';
import { apiClient } from '../api';
import './AlgorithmTab.css';

export function AlgorithmTab() {
  const [algorithm, setAlgorithm] = useState(null);
  const [weights, setWeights] = useState({});
  const [editingWeights, setEditingWeights] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAlgorithm();
  }, []);

  const fetchAlgorithm = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getAlgorithmDetails();
      setAlgorithm(data);
      setWeights(data.weights);
      setEditingWeights({ ...data.weights });
    } catch (error) {
      console.error('Error fetching algorithm details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWeightChange = (key, value) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 1) {
      setEditingWeights({
        ...editingWeights,
        [key]: numValue
      });
    }
  };

  const handleSaveWeights = async () => {
    try {
      setSaving(true);
      // Normalize weights to sum to 1
      const total = Object.values(editingWeights).reduce((a, b) => a + b, 0);
      const normalized = {};
      for (const key in editingWeights) {
        normalized[key] = editingWeights[key] / total;
      }
      
      await apiClient.updateWeights(normalized);
      setWeights(normalized);
      setEditingWeights(normalized);
      alert('Weights saved successfully!');
    } catch (error) {
      console.error('Error saving weights:', error);
      alert('Error saving weights');
    } finally {
      setSaving(false);
    }
  };

  const resetWeights = () => {
    setEditingWeights({ ...weights });
  };

  const totalWeight = Object.values(editingWeights).reduce((a, b) => a + b, 0);

  if (loading) {
    return <div className="algorithm-tab"><div className="loading">Loading algorithm details...</div></div>;
  }

  return (
    <div className="algorithm-tab">
      <h2>Prediction Algorithm</h2>

      {algorithm && (
        <div className="algorithm-content">
          <section className="algorithm-section">
            <h3>How It Works</h3>
            <p>
              The AI agent analyzes multiple factors to predict the highest stock price 
              each ticker will reach by the end of Wednesday and Friday. Predictions are 
              generated every Monday and remain fixed until the prediction window closes.
            </p>
            <div className="prediction-flow">
              <div className="flow-step">
                <span className="step-number">1</span>
                <h4>Monday</h4>
                <p>Generate predictions for Wed & Fri</p>
              </div>
              <div className="flow-step">
                <span className="step-number">2</span>
                <h4>Wed/Fri</h4>
                <p>Predictions remain locked</p>
              </div>
              <div className="flow-step">
                <span className="step-number">3</span>
                <h4>Check Accuracy</h4>
                <p>Compare to actual prices</p>
              </div>
              <div className="flow-step">
                <span className="step-number">4</span>
                <h4>Adjust Weights</h4>
                <p>Improve algorithm weekly</p>
              </div>
            </div>
          </section>

          <section className="algorithm-section">
            <h3>Factors & Analysis</h3>
            <div className="factors-grid">
              {algorithm.description && Object.entries(algorithm.description).map(([key, description]) => (
                <div key={key} className="factor-card">
                  <h4>{key.split(/(?=[A-Z])/).join(' ')}</h4>
                  <p>{description}</p>
                  <div className="current-weight">
                    Weight: <strong>{(weights[key] * 100).toFixed(1)}%</strong>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="algorithm-section">
            <h3>Algorithm Weights</h3>
            <p className="info-text">
              Week {algorithm.week} of {algorithm.year} - Adjust weights to influence predictions
            </p>

            <div className="weights-editor">
              {Object.entries(editingWeights).map(([key, value]) => (
                <div key={key} className="weight-input-group">
                  <label>{key.split(/(?=[A-Z])/).join(' ')}</label>
                  <div className="weight-input">
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      value={value.toFixed(2)}
                      onChange={(e) => handleWeightChange(key, e.target.value)}
                    />
                    <span className="percentage">{(value * 100).toFixed(1)}%</span>
                  </div>
                  <div className="weight-bar">
                    <div
                      className="weight-fill"
                      style={{ width: `${value * 100}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>

            <div className="weight-total">
              <strong>Total Weight:</strong> <span className={totalWeight === 1 ? 'valid' : 'invalid'}>
                {(totalWeight * 100).toFixed(1)}%
              </span>
              {totalWeight !== 1 && (
                <small>Note: Weights will be automatically normalized to 100% when saved</small>
              )}
            </div>

            <div className="button-group">
              <button
                className="save-btn"
                onClick={handleSaveWeights}
                disabled={saving || JSON.stringify(editingWeights) === JSON.stringify(weights)}
              >
                {saving ? 'Saving...' : 'Save Weights'}
              </button>
              <button
                className="reset-btn"
                onClick={resetWeights}
                disabled={JSON.stringify(editingWeights) === JSON.stringify(weights)}
              >
                Reset
              </button>
            </div>
          </section>

          <section className="algorithm-section">
            <h3>Recent Performance</h3>
            <div className="performance-chart">
              <p>Check the Predictions tab to see accuracy rates for each ticker</p>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
