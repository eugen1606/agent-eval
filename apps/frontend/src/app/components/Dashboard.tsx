import React, { useState, useEffect } from 'react';
import { StoredEvaluation, EvaluationResult, IncorrectSeverity, StoredFlowConfig } from '@agent-eval/shared';
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

interface FlowEvaluationData {
  id: string;
  name: string;
  date: string;
  accuracy: number;
  total: number;
  correct: number;
  partial: number;
  incorrect: number;
  errors: number;
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

function LineChart({ data }: { data: FlowEvaluationData[] }) {
  if (data.length === 0) return null;

  const maxAccuracy = 100;
  const padding = 40;
  const width = 600;
  const height = 250;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // Sort by date
  const sortedData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const points = sortedData.map((d, i) => {
    const x = padding + (i / Math.max(sortedData.length - 1, 1)) * chartWidth;
    const y = padding + chartHeight - (d.accuracy / maxAccuracy) * chartHeight;
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <div className="line-chart-container">
      <svg viewBox={`0 0 ${width} ${height}`} className="line-chart">
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((val) => {
          const y = padding + chartHeight - (val / maxAccuracy) * chartHeight;
          return (
            <g key={val}>
              <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#eee" strokeWidth="1" />
              <text x={padding - 5} y={y + 4} textAnchor="end" fontSize="10" fill="#888">{val}%</text>
            </g>
          );
        })}

        {/* Line */}
        <path d={linePath} fill="none" stroke="#667eea" strokeWidth="2" />

        {/* Points */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="5" fill="#667eea" />
            <title>{p.name}: {p.accuracy.toFixed(1)}% ({new Date(p.date).toLocaleDateString()})</title>
          </g>
        ))}

        {/* X-axis labels */}
        {points.length <= 10 && points.map((p, i) => (
          <text
            key={i}
            x={p.x}
            y={height - 10}
            textAnchor="middle"
            fontSize="9"
            fill="#888"
          >
            {new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </text>
        ))}
      </svg>
    </div>
  );
}

function BarChart({ data }: { data: FlowEvaluationData[] }) {
  if (data.length === 0) return null;

  const padding = 40;
  const width = 600;
  const height = 250;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // Sort by date and take last 10
  const sortedData = [...data]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-10);

  const barWidth = chartWidth / sortedData.length * 0.7;
  const gap = chartWidth / sortedData.length * 0.3;

  return (
    <div className="bar-chart-container">
      <svg viewBox={`0 0 ${width} ${height}`} className="bar-chart">
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((val) => {
          const y = padding + chartHeight - (val / 100) * chartHeight;
          return (
            <g key={val}>
              <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#eee" strokeWidth="1" />
              <text x={padding - 5} y={y + 4} textAnchor="end" fontSize="10" fill="#888">{val}%</text>
            </g>
          );
        })}

        {/* Bars */}
        {sortedData.map((d, i) => {
          const x = padding + i * (barWidth + gap) + gap / 2;
          const barHeight = (d.accuracy / 100) * chartHeight;
          const y = padding + chartHeight - barHeight;
          const color = d.accuracy >= 80 ? '#27ae60' : d.accuracy >= 50 ? '#f39c12' : '#e74c3c';

          return (
            <g key={i}>
              <rect x={x} y={y} width={barWidth} height={barHeight} fill={color} rx="2" />
              <text
                x={x + barWidth / 2}
                y={height - 10}
                textAnchor="middle"
                fontSize="9"
                fill="#888"
              >
                {new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </text>
              <title>{d.name}: {d.accuracy.toFixed(1)}%</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function Dashboard() {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'evaluation' | 'analytics'>('evaluation');

  // Evaluation Details tab state
  const [evaluations, setEvaluations] = useState<StoredEvaluation[]>([]);
  const [selectedEvaluation, setSelectedEvaluation] = useState<StoredEvaluation | null>(null);
  const [results, setResults] = useState<EvaluationResult[]>([]);
  const [stats, setStats] = useState<EvaluationStats | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Flow Analytics tab state
  const [flowConfigs, setFlowConfigs] = useState<StoredFlowConfig[]>([]);
  const [selectedFlowId, setSelectedFlowId] = useState<string>('');
  const [flowEvaluations, setFlowEvaluations] = useState<FlowEvaluationData[]>([]);

  useEffect(() => {
    loadEvaluations();
    loadFlowConfigs();
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

  const loadFlowConfigs = async () => {
    const response = await apiClient.getFlowConfigs();
    if (response.success && response.data) {
      setFlowConfigs(response.data);
    }
  };

  const handleFlowSelect = (flowId: string) => {
    setSelectedFlowId(flowId);
    if (!flowId) {
      setFlowEvaluations([]);
      return;
    }

    // Filter evaluations by flowId and calculate stats for each
    const flowEvals = evaluations
      .filter((ev) => ev.flowId === flowId)
      .map((ev) => {
        const evalResults = (ev.finalOutput as { results?: EvaluationResult[] })?.results || [];
        const stats = calculateEvalStats(evalResults);
        const evaluated = stats.correct + stats.partial + stats.incorrect;
        const accuracy = evaluated > 0 ? (stats.correct / evaluated) * 100 : 0;

        return {
          id: ev.id,
          name: ev.name,
          date: ev.createdAt,
          accuracy,
          total: stats.total,
          correct: stats.correct,
          partial: stats.partial,
          incorrect: stats.incorrect,
          errors: stats.errors,
        };
      });

    setFlowEvaluations(flowEvals);
  };

  const calculateEvalStats = (evalResults: EvaluationResult[]): EvaluationStats => {
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

    return stats;
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

  // Calculate aggregate stats for flow analytics
  const flowAggregateStats = flowEvaluations.length > 0 ? {
    avgAccuracy: flowEvaluations.reduce((sum, e) => sum + e.accuracy, 0) / flowEvaluations.length,
    totalEvaluations: flowEvaluations.length,
    totalQuestions: flowEvaluations.reduce((sum, e) => sum + e.total, 0),
    latestAccuracy: flowEvaluations.length > 0
      ? [...flowEvaluations].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].accuracy
      : 0,
    trend: flowEvaluations.length >= 2
      ? (() => {
          const sorted = [...flowEvaluations].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          const latest = sorted[sorted.length - 1].accuracy;
          const previous = sorted[sorted.length - 2].accuracy;
          return latest - previous;
        })()
      : 0,
  } : null;

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <h2>Dashboard</h2>
        <div className="dashboard-tabs">
          <button
            className={activeTab === 'evaluation' ? 'active' : ''}
            onClick={() => setActiveTab('evaluation')}
          >
            Evaluation Details
          </button>
          <button
            className={activeTab === 'analytics' ? 'active' : ''}
            onClick={() => setActiveTab('analytics')}
          >
            Flow Analytics
          </button>
        </div>
      </div>

      {activeTab === 'evaluation' && (
        <>
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
              <div className="accuracy-section">
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
              <div className="accuracy-section">
                <div className="accuracy-header">Total Answers</div>
                <div className="accuracy-value total">{stats.total}</div>
                <div className="accuracy-details">
                  {stats.correct + stats.partial + stats.incorrect} evaluated, {stats.unevaluated} pending
                  {stats.errors > 0 && `, ${stats.errors} errors`}
                </div>
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
        </>
      )}

      {activeTab === 'analytics' && (
        <>
          <div className="dashboard-controls">
            <div className="control-group">
              <label>Select Flow:</label>
              <select
                value={selectedFlowId}
                onChange={(e) => handleFlowSelect(e.target.value)}
              >
                <option value="">Choose a flow configuration...</option>
                {flowConfigs.map((fc) => (
                  <option key={fc.id} value={fc.flowId}>
                    {fc.name} ({fc.flowId})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedFlowId && flowEvaluations.length > 0 && flowAggregateStats && (
            <div className="dashboard-content">
              {/* Top row: KPI cards */}
              <div className="dashboard-top-row">
                <div className="dashboard-accuracy">
                  <div className="accuracy-section">
                    <div className="accuracy-header">Average Accuracy</div>
                    <div className="accuracy-value">
                      {flowAggregateStats.avgAccuracy.toFixed(1)}%
                    </div>
                    <div className="accuracy-details">
                      Across {flowAggregateStats.totalEvaluations} evaluations
                    </div>
                  </div>
                  <div className="accuracy-section">
                    <div className="accuracy-header">Latest Accuracy</div>
                    <div className={`accuracy-value ${flowAggregateStats.latestAccuracy >= 80 ? '' : flowAggregateStats.latestAccuracy >= 50 ? 'medium' : 'low'}`}>
                      {flowAggregateStats.latestAccuracy.toFixed(1)}%
                    </div>
                    <div className="accuracy-details">
                      {flowAggregateStats.trend !== 0 && (
                        <span className={flowAggregateStats.trend > 0 ? 'trend-up' : 'trend-down'}>
                          {flowAggregateStats.trend > 0 ? '↑' : '↓'} {Math.abs(flowAggregateStats.trend).toFixed(1)}% vs previous
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="accuracy-section">
                    <div className="accuracy-header">Total Questions</div>
                    <div className="accuracy-value total">{flowAggregateStats.totalQuestions}</div>
                    <div className="accuracy-details">
                      {flowAggregateStats.totalEvaluations} evaluation runs
                    </div>
                  </div>
                </div>
              </div>

              {/* Charts */}
              <div className="analytics-charts">
                <div className="chart-card">
                  <h3>Accuracy Trend Over Time</h3>
                  <LineChart data={flowEvaluations} />
                </div>
                <div className="chart-card">
                  <h3>Accuracy by Evaluation</h3>
                  <BarChart data={flowEvaluations} />
                </div>
              </div>

              {/* Evaluations table */}
              <div className="analytics-table">
                <h3>Evaluation History</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Date</th>
                      <th>Accuracy</th>
                      <th>Correct</th>
                      <th>Partial</th>
                      <th>Incorrect</th>
                      <th>Errors</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...flowEvaluations]
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((ev) => (
                        <tr key={ev.id}>
                          <td>{ev.name}</td>
                          <td>{new Date(ev.date).toLocaleDateString()}</td>
                          <td className={ev.accuracy >= 80 ? 'good' : ev.accuracy >= 50 ? 'medium' : 'bad'}>
                            {ev.accuracy.toFixed(1)}%
                          </td>
                          <td className="correct">{ev.correct}</td>
                          <td className="partial">{ev.partial}</td>
                          <td className="incorrect">{ev.incorrect}</td>
                          <td className="errors">{ev.errors}</td>
                          <td>{ev.total}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {selectedFlowId && flowEvaluations.length === 0 && (
            <div className="dashboard-empty">
              <p>No evaluations found for this flow. Run some evaluations first.</p>
            </div>
          )}

          {!selectedFlowId && (
            <div className="dashboard-empty">
              <p>Select a flow configuration to view analytics.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
