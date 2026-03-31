import React, { useEffect, useState } from 'react';
import { apiClient } from '../api';

export function ModelInsightsTab() {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [retraining, setRetraining] = useState(false);
  const [error, setError] = useState(null);

  const fetchInsights = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.getModelInsights();
      setInsights(data.insights || null);
    } catch (fetchError) {
      setError(fetchError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  const handleRetrain = async () => {
    try {
      setRetraining(true);
      await apiClient.retrainModel();
      await fetchInsights();
    } catch (retrainError) {
      setError(retrainError.message);
    } finally {
      setRetraining(false);
    }
  };

  if (loading) {
    return <div className="algorithm-tab"><div className="loading">Loading model insights...</div></div>;
  }

  if (error) {
    return <div className="algorithm-tab"><div className="error-message">{error}</div></div>;
  }

  const walkForward = insights?.walkForward || {};
  const sourceReliability = insights?.sourceReliability || {};
  const currentWeights = insights?.currentWeights || {};
  const trainedModels = insights?.trainedModels || {};

  return (
    <div className="algorithm-tab">
      <h2>Model Insights</h2>
      <div className="algorithm-content">
        <section className="algorithm-section">
          <h3>Walk-Forward Evaluation</h3>
          {Object.entries(walkForward).map(([horizon, metrics]) => (
            <div key={horizon} className="factor-card">
              <h4>{horizon}</h4>
              {metrics.evaluated ? (
                <p>
                  MAE {Number(metrics.mae).toFixed(4)} | RMSE {Number(metrics.rmse).toFixed(4)} | Directional Accuracy {(Number(metrics.directionalAccuracy) * 100).toFixed(1)}%
                </p>
              ) : (
                <p>Not enough clean examples yet. Current examples: {metrics.examples}</p>
              )}
            </div>
          ))}
        </section>

        <section className="algorithm-section">
          <h3>Trained Models</h3>
          {Object.entries(trainedModels).map(([horizon, model]) => (
            <div key={horizon} className="factor-card">
              <h4>{horizon}</h4>
              {model ? (
                <p>
                  Examples {model.trainingExamples} | MAE {Number(model.mae).toFixed(4)} | RMSE {Number(model.rmse).toFixed(4)}
                </p>
              ) : (
                <p>No trained model persisted yet.</p>
              )}
            </div>
          ))}
        </section>

        <section className="algorithm-section">
          <h3>Source Reliability</h3>
          <div className="factors-grid">
            {Object.entries(sourceReliability).length ? Object.entries(sourceReliability).map(([source, score]) => (
              <div key={source} className="factor-card">
                <h4>{source}</h4>
                <p>Reliability: <strong>{Number(score).toFixed(1)}%</strong></p>
              </div>
            )) : <p>No source reliability data yet.</p>}
          </div>
        </section>

        <section className="algorithm-section">
          <h3>Current Adaptive Weights</h3>
          <div className="factors-grid">
            {Object.entries(currentWeights).map(([key, value]) => (
              <div key={key} className="factor-card">
                <h4>{key.split(/(?=[A-Z])/).join(' ')}</h4>
                <p>{(Number(value) * 100).toFixed(1)}%</p>
              </div>
            ))}
          </div>
          <button className="save-btn" onClick={handleRetrain} disabled={retraining}>
            {retraining ? 'Retraining...' : 'Retrain Model'}
          </button>
        </section>
      </div>
    </div>
  );
}
