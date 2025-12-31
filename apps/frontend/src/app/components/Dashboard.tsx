import React, { useState, useEffect } from 'react';
import { StoredEvaluation, EvaluationResult, IncorrectSeverity } from '@agent-eval/shared';
import { AgentEvalClient } from '@agent-eval/api-client';
import { useSearchParams } from 'react-router-dom';

const apiClient = new AgentEvalClient();

interface EvaluationStats {
  correct: number;
  partial: number;
  incorrect: number;
  unevaluated: number;
  errors: number;
  total: number;
}

function PieChart({ stats }: { stats: EvaluationStats }) {
  const total = stats.total || 1;
  const data = [
    { label: 'Correct', value: stats.correct, color: '#27ae60' },
    { label: 'Partial', value: stats.partial, color: '#f39c12' },
    { label: 'Incorrect', value: stats.incorrect, color: '#e74c3c' },
    { label: 'Errors', value: stats.errors, color: '#8e44ad' },
    { label: 'Unevaluated', value: stats.unevaluated, color: '#95a5a6' },
  ].filter(d => d.value > 0);

  let currentAngle = 0;
  const paths = data.map((item) => {
    const percentage = item.value / total;
    const angle = percentage * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    const startRad = (startAngle - 90) * (Math.PI / 180);
    const endRad = (endAngle - 90) * (Math.PI / 180);

    const x1 = 50 + 40 * Math.cos(startRad);
    const y1 = 50 + 40 * Math.sin(startRad);
    const x2 = 50 + 40 * Math.cos(endRad);
    const y2 = 50 + 40 * Math.sin(endRad);

    const largeArc = angle > 180 ? 1 : 0;

    const pathD = percentage === 1
      ? `M 50 10 A 40 40 0 1 1 49.99 10 Z`
      : `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`;

    return { ...item, pathD, percentage };
  });

  return (
    <div className="pie-chart-container">
      <svg viewBox="0 0 100 100" className="pie-chart">
        {paths.map((item, i) => (
          <path key={i} d={item.pathD} fill={item.color} />
        ))}
      </svg>
      <div className="pie-legend">
        {paths.map((item, i) => (
          <div key={i} className="legend-item">
            <span className="legend-color" style={{ backgroundColor: item.color }} />
            <span className="legend-label">{item.label}</span>
            <span className="legend-value">{item.value} ({Math.round(item.percentage * 100)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Dashboard() {
  const [searchParams] = useSearchParams();
  const [evaluations, setEvaluations] = useState<StoredEvaluation[]>([]);
  const [selectedEvaluation, setSelectedEvaluation] = useState<StoredEvaluation | null>(null);
  const [results, setResults] = useState<EvaluationResult[]>([]);
  const [stats, setStats] = useState<EvaluationStats | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    loadEvaluations();
  }, []);

  useEffect(() => {
    const evalId = searchParams.get('id');
    if (evalId && evaluations.length > 0) {
      const evaluation = evaluations.find(e => e.id === evalId);
      if (evaluation) {
        handleSelectEvaluation(evaluation);
      }
    }
  }, [searchParams, evaluations]);

  const loadEvaluations = async () => {
    const response = await apiClient.getEvaluations();
    if (response.success && response.data) {
      setEvaluations(response.data);
    }
  };

  const handleSelectEvaluation = (evaluation: StoredEvaluation) => {
    setSelectedEvaluation(evaluation);

    // Extract results from finalOutput
    const evalResults = (evaluation.finalOutput as { results?: EvaluationResult[] })?.results || [];
    setResults(evalResults);
    calculateStats(evalResults);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Try to extract results from various formats
      let evalResults: EvaluationResult[] = [];

      if (Array.isArray(data)) {
        evalResults = data;
      } else if (data.results && Array.isArray(data.results)) {
        evalResults = data.results;
      } else if (data.finalOutput?.results && Array.isArray(data.finalOutput.results)) {
        evalResults = data.finalOutput.results;
      }

      if (evalResults.length === 0) {
        setUploadError('No evaluation results found in file');
        return;
      }

      setSelectedEvaluation(null);
      setResults(evalResults);
      calculateStats(evalResults);
    } catch {
      setUploadError('Invalid JSON file');
    }

    // Reset file input
    e.target.value = '';
  };

  const calculateStats = (evalResults: EvaluationResult[]) => {
    const stats: EvaluationStats = {
      correct: 0,
      partial: 0,
      incorrect: 0,
      unevaluated: 0,
      errors: 0,
      total: evalResults.length,
    };

    evalResults.forEach((result) => {
      if (result.isError) {
        stats.errors++;
      } else if (result.humanEvaluation === 'correct') {
        stats.correct++;
      } else if (result.humanEvaluation === 'partial') {
        stats.partial++;
      } else if (result.humanEvaluation === 'incorrect') {
        stats.incorrect++;
      } else {
        stats.unevaluated++;
      }
    });

    setStats(stats);
  };

  // Sort order for severity: critical > major > minor > (no severity/partial)
  const severityOrder: Record<IncorrectSeverity | 'none', number> = {
    critical: 0,
    major: 1,
    minor: 2,
    none: 3,
  };

  const problemResults = results
    .filter((r) => r.humanEvaluation === 'incorrect' || r.humanEvaluation === 'partial')
    .sort((a, b) => {
      // Incorrect answers come before partial
      if (a.humanEvaluation !== b.humanEvaluation) {
        return a.humanEvaluation === 'incorrect' ? -1 : 1;
      }
      // For incorrect answers, sort by severity
      if (a.humanEvaluation === 'incorrect' && b.humanEvaluation === 'incorrect') {
        const aSeverity = a.severity || 'none';
        const bSeverity = b.severity || 'none';
        return severityOrder[aSeverity] - severityOrder[bSeverity];
      }
      return 0;
    });

  const errorResults = results.filter((r) => r.isError);

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <h2>Evaluation Dashboard</h2>
      </div>

      <div className="dashboard-controls">
        <div className="control-group">
          <label>Select Stored Evaluation:</label>
          <select
            value={selectedEvaluation?.id || ''}
            onChange={(e) => {
              const evaluation = evaluations.find((ev) => ev.id === e.target.value);
              if (evaluation) handleSelectEvaluation(evaluation);
            }}
          >
            <option value="">Choose an evaluation...</option>
            {evaluations.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name} ({new Date(ev.createdAt).toLocaleDateString()})
              </option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label>Or Upload JSON File:</label>
          <input
            type="file"
            accept=".json"
            onChange={handleFileUpload}
          />
          {uploadError && <span className="error">{uploadError}</span>}
        </div>
      </div>

      {stats && results.length > 0 && (
        <div className="dashboard-content">
          {/* Top row: Accuracy and Summary side by side */}
          <div className="dashboard-top-row">
            <div className="dashboard-accuracy">
              <div className="accuracy-header">Accuracy Rate</div>
              <div className="accuracy-value">
                {(() => {
                  const evaluatedCount = stats.correct + stats.partial + stats.incorrect;
                  if (evaluatedCount === 0) return 'N/A';
                  const percentage = (stats.correct / evaluatedCount) * 100;
                  return `${percentage.toFixed(1)}%`;
                })()}
              </div>
              <div className="accuracy-details">
                {stats.correct} correct out of {stats.correct + stats.partial + stats.incorrect} evaluated
                {stats.unevaluated > 0 && ` (${stats.unevaluated} pending)`}
                {stats.errors > 0 && ` (${stats.errors} errors excluded)`}
              </div>
            </div>

            <div className="dashboard-stats">
              <h3>Evaluation Summary</h3>
              <PieChart stats={stats} />
            </div>
          </div>

          {/* Full width issues section */}
          <div className="dashboard-issues">
            {errorResults.length > 0 && (
              <div className="dashboard-errors">
                <h3>API Errors ({errorResults.length})</h3>
                <div className="problems-list">
                  {errorResults.map((result) => (
                    <div key={result.id} className="problem-card error">
                      <div className="problem-header">
                        <span className="status-badge error">ERROR</span>
                      </div>
                      <div className="problem-question">
                        <strong>Question:</strong> {result.question}
                      </div>
                      <div className="problem-answer error-text">
                        <strong>Error:</strong> {result.errorMessage || result.answer}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="dashboard-problems">
              <h3>Problem Questions ({problemResults.length})</h3>
              {problemResults.length === 0 ? (
                <div className="problems-empty">
                  <p>No incorrect or partial answers found. All evaluated answers are correct.</p>
                </div>
              ) : (
                <div className="problems-list">
                  {problemResults.map((result) => (
                    <div
                      key={result.id}
                      className={`problem-card ${result.humanEvaluation}`}
                    >
                      <div className="problem-header">
                        <span className={`status-badge ${result.humanEvaluation}`}>
                          {result.humanEvaluation}
                        </span>
                        {result.humanEvaluation === 'incorrect' && result.severity && (
                          <span className={`severity-badge ${result.severity}`}>
                            {result.severity}
                          </span>
                        )}
                        {result.executionId && (
                          <span className="execution-id">ID: {result.executionId}</span>
                        )}
                      </div>
                      <div className="problem-question">
                        <strong>Question:</strong> {result.question}
                      </div>
                      <div className="problem-answer">
                        <strong>Answer:</strong> {result.answer}
                      </div>
                      {result.expectedAnswer && (
                        <div className="problem-expected">
                          <strong>Expected:</strong> {result.expectedAnswer}
                        </div>
                      )}
                      {result.humanEvaluationDescription && (
                        <div className="problem-notes">
                          <strong>Notes:</strong> {result.humanEvaluationDescription}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!stats && (
        <div className="dashboard-empty">
          <p>Select an evaluation or upload a JSON file to view the dashboard.</p>
        </div>
      )}
    </div>
  );
}
