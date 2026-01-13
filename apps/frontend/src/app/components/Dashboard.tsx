import React, { useState, useEffect } from 'react';
import { StoredTest, StoredRun } from '@agent-eval/shared';
import { AgentEvalClient } from '@agent-eval/api-client';
import { useNavigate } from 'react-router-dom';

const apiClient = new AgentEvalClient();

interface EvaluationStats {
  correct: number;
  partial: number;
  incorrect: number;
  unevaluated: number;
  errors: number;
  total: number;
}

interface TestRunData {
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

function LineChart({ data }: { data: TestRunData[] }) {
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

function BarChart({ data }: { data: TestRunData[] }) {
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
  const navigate = useNavigate();
  const [tests, setTests] = useState<StoredTest[]>([]);
  const [runs, setRuns] = useState<StoredRun[]>([]);
  const [selectedTestId, setSelectedTestId] = useState<string>('');
  const [testRuns, setTestRuns] = useState<TestRunData[]>([]);

  useEffect(() => {
    loadTests();
    loadRuns();
  }, []);

  const loadTests = async () => {
    const response = await apiClient.getTests({ limit: 100 });
    if (response.success && response.data) {
      setTests(response.data.data);
    }
  };

  const loadRuns = async () => {
    const response = await apiClient.getRuns({ limit: 1000 });
    if (response.success && response.data) {
      setRuns(response.data.data);
    }
  };

  const handleTestSelect = (testId: string) => {
    setSelectedTestId(testId);
  };

  // Update test runs when test selection changes
  useEffect(() => {
    if (!selectedTestId) {
      setTestRuns([]);
      return;
    }

    // Filter runs by testId and compute stats
    const testRunData = runs
      .filter((run) => run.testId === selectedTestId && run.status === 'completed')
      .map((run) => {
        const results = run.results || [];
        const stats = calculateEvalStats(results);
        const evaluated = stats.correct + stats.partial + stats.incorrect;
        const accuracy = evaluated > 0 ? (stats.correct / evaluated) * 100 : 0;

        return {
          id: run.id,
          name: `Run ${new Date(run.createdAt).toLocaleString()}`,
          date: run.completedAt || run.createdAt,
          accuracy,
          total: stats.total,
          correct: stats.correct,
          partial: stats.partial,
          incorrect: stats.incorrect,
          errors: stats.errors,
        };
      });

    setTestRuns(testRunData);
  }, [selectedTestId, runs]);

  const calculateEvalStats = (results: StoredRun['results']): EvaluationStats => {
    const stats: EvaluationStats = {
      correct: 0,
      partial: 0,
      incorrect: 0,
      unevaluated: 0,
      errors: 0,
      total: results.length,
    };

    results.forEach((result) => {
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

  // Calculate aggregate stats for test analytics
  const testRunAggregateStats = testRuns.length > 0 ? {
    avgAccuracy: testRuns.reduce((sum, e) => sum + e.accuracy, 0) / testRuns.length,
    totalRuns: testRuns.length,
    totalQuestions: testRuns.reduce((sum, e) => sum + e.total, 0),
    latestAccuracy: testRuns.length > 0
      ? [...testRuns].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].accuracy
      : 0,
    trend: testRuns.length >= 2
      ? (() => {
          const sorted = [...testRuns].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
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
      </div>

      <div className="dashboard-controls">
        <div className="control-group">
          <label>Select Test:</label>
          <select
            value={selectedTestId}
            onChange={(e) => handleTestSelect(e.target.value)}
          >
            <option value="">Choose a test...</option>
            {tests.map((test) => (
              <option key={test.id} value={test.id}>
                {test.name} ({test.flowId})
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedTestId && testRuns.length > 0 && testRunAggregateStats && (
        <div className="dashboard-content">
          {/* Top row: KPI cards */}
          <div className="dashboard-top-row">
            <div className="dashboard-accuracy">
              <div className="accuracy-section">
                <div className="accuracy-header">Average Accuracy</div>
                <div className="accuracy-value">
                  {testRunAggregateStats.avgAccuracy.toFixed(1)}%
                </div>
                <div className="accuracy-details">
                  Across {testRunAggregateStats.totalRuns} runs
                </div>
              </div>
              <div className="accuracy-section">
                <div className="accuracy-header">Latest Accuracy</div>
                <div className={`accuracy-value ${testRunAggregateStats.latestAccuracy >= 80 ? '' : testRunAggregateStats.latestAccuracy >= 50 ? 'medium' : 'low'}`}>
                  {testRunAggregateStats.latestAccuracy.toFixed(1)}%
                </div>
                <div className="accuracy-details">
                  {testRunAggregateStats.trend !== 0 && (
                    <span className={testRunAggregateStats.trend > 0 ? 'trend-up' : 'trend-down'}>
                      {testRunAggregateStats.trend > 0 ? '\u2191' : '\u2193'} {Math.abs(testRunAggregateStats.trend).toFixed(1)}% vs previous
                    </span>
                  )}
                </div>
              </div>
              <div className="accuracy-section">
                <div className="accuracy-header">Total Questions</div>
                <div className="accuracy-value total">{testRunAggregateStats.totalQuestions}</div>
                <div className="accuracy-details">
                  {testRunAggregateStats.totalRuns} test runs
                </div>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="analytics-charts">
            <div className="chart-card">
              <h3>Accuracy Trend Over Time</h3>
              <LineChart data={testRuns} />
            </div>
            <div className="chart-card">
              <h3>Accuracy by Run</h3>
              <BarChart data={testRuns} />
            </div>
          </div>

          {/* Runs table */}
          <div className="analytics-table">
            <h3>Run History</h3>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Accuracy</th>
                  <th>Correct</th>
                  <th>Partial</th>
                  <th>Incorrect</th>
                  <th>Errors</th>
                  <th>Total</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {[...testRuns]
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((run) => (
                    <tr key={run.id}>
                      <td>{new Date(run.date).toLocaleString()}</td>
                      <td className={run.accuracy >= 80 ? 'good' : run.accuracy >= 50 ? 'medium' : 'bad'}>
                        {run.accuracy.toFixed(1)}%
                      </td>
                      <td className="correct">{run.correct}</td>
                      <td className="partial">{run.partial}</td>
                      <td className="incorrect">{run.incorrect}</td>
                      <td className="errors">{run.errors}</td>
                      <td>{run.total}</td>
                      <td>
                        <button
                          className="view-btn"
                          onClick={() => navigate(`/runs/${run.id}`)}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedTestId && testRuns.length === 0 && (
        <div className="dashboard-empty">
          <p>No completed runs found for this test. Run the test first to see analytics.</p>
        </div>
      )}

      {!selectedTestId && (
        <div className="dashboard-empty">
          <p>Select a test to view analytics. Create tests from the Tests page.</p>
        </div>
      )}
    </div>
  );
}
