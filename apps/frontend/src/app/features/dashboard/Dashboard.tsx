import React, { useState, useEffect, useMemo } from 'react';
import { StoredTest, StoredRun, StoredQuestionSet } from '@agent-eval/shared';
import { useNavigate } from 'react-router-dom';
import { Pagination } from '../../components/Pagination';
import { useNotification } from '../../context/NotificationContext';
import { downloadAuthenticatedFile } from '../../shared/exportImportUtils';
import { apiClient } from '../../apiClient';
import styles from './dashboard.module.scss';

type SortColumn =
  | 'date'
  | 'accuracy'
  | 'correct'
  | 'partial'
  | 'incorrect'
  | 'errors'
  | 'total';
type SortDirection = 'asc' | 'desc';

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
  avgLatencyMs: number | null;
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
  const sortedData = [...data].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  const points = sortedData.map((d, i) => {
    const x = padding + (i / Math.max(sortedData.length - 1, 1)) * chartWidth;
    const y = padding + chartHeight - (d.accuracy / maxAccuracy) * chartHeight;
    return { x, y, ...d };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  return (
    <div className={styles.lineChartContainer}>
      <svg viewBox={`0 0 ${width} ${height}`} className={styles.lineChart}>
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((val) => {
          const y = padding + chartHeight - (val / maxAccuracy) * chartHeight;
          return (
            <g key={val}>
              <line
                x1={padding}
                y1={y}
                x2={width - padding}
                y2={y}
                stroke="#eee"
                strokeWidth="1"
              />
              <text
                x={padding - 5}
                y={y + 4}
                textAnchor="end"
                fontSize="10"
                fill="#888"
              >
                {val}%
              </text>
            </g>
          );
        })}

        {/* Line */}
        <path d={linePath} fill="none" stroke="#667eea" strokeWidth="2" />

        {/* Points */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="5" fill="#667eea" />
            <title>
              {p.name}: {p.accuracy.toFixed(1)}% (
              {new Date(p.date).toLocaleDateString()})
            </title>
          </g>
        ))}

        {/* X-axis labels */}
        {points.length <= 10 &&
          points.map((p, i) => (
            <text
              key={i}
              x={p.x}
              y={height - 10}
              textAnchor="middle"
              fontSize="9"
              fill="#888"
            >
              {new Date(p.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
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

  const barWidth = (chartWidth / sortedData.length) * 0.7;
  const gap = (chartWidth / sortedData.length) * 0.3;

  return (
    <div className={styles.barChartContainer}>
      <svg viewBox={`0 0 ${width} ${height}`} className={styles.barChart}>
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((val) => {
          const y = padding + chartHeight - (val / 100) * chartHeight;
          return (
            <g key={val}>
              <line
                x1={padding}
                y1={y}
                x2={width - padding}
                y2={y}
                stroke="#eee"
                strokeWidth="1"
              />
              <text
                x={padding - 5}
                y={y + 4}
                textAnchor="end"
                fontSize="10"
                fill="#888"
              >
                {val}%
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {sortedData.map((d, i) => {
          const x = padding + i * (barWidth + gap) + gap / 2;
          const barHeight = (d.accuracy / 100) * chartHeight;
          const y = padding + chartHeight - barHeight;
          const color =
            d.accuracy >= 80
              ? '#27ae60'
              : d.accuracy >= 50
                ? '#f39c12'
                : '#e74c3c';

          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill={color}
                rx="2"
              />
              <text
                x={x + barWidth / 2}
                y={height - 10}
                textAnchor="middle"
                fontSize="9"
                fill="#888"
              >
                {new Date(d.date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </text>
              <title>
                {d.name}: {d.accuracy.toFixed(1)}%
              </title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function LatencyChart({ data }: { data: TestRunData[] }) {
  const runsWithLatency = data.filter((d) => d.avgLatencyMs !== null);
  if (runsWithLatency.length === 0) return null;

  const padding = 40;
  const width = 600;
  const height = 250;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // Sort by date
  const sortedData = [...runsWithLatency].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  const maxLatency = Math.max(...sortedData.map((d) => d.avgLatencyMs || 0));
  const yMax = Math.ceil(maxLatency / 1000) * 1000 || 1000; // Round up to nearest 1000ms

  const points = sortedData.map((d, i) => {
    const x = padding + (i / Math.max(sortedData.length - 1, 1)) * chartWidth;
    const y = padding + chartHeight - ((d.avgLatencyMs || 0) / yMax) * chartHeight;
    return { x, y, ...d };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  // Generate Y-axis labels
  const yLabels = [0, 0.25, 0.5, 0.75, 1].map((pct) => Math.round(yMax * pct));

  return (
    <div className={styles.lineChartContainer}>
      <svg viewBox={`0 0 ${width} ${height}`} className={styles.lineChart}>
        {/* Grid lines */}
        {yLabels.map((val) => {
          const y = padding + chartHeight - (val / yMax) * chartHeight;
          return (
            <g key={val}>
              <line
                x1={padding}
                y1={y}
                x2={width - padding}
                y2={y}
                stroke="#eee"
                strokeWidth="1"
              />
              <text
                x={padding - 5}
                y={y + 4}
                textAnchor="end"
                fontSize="10"
                fill="#888"
              >
                {val >= 1000 ? `${(val / 1000).toFixed(1)}s` : `${val}ms`}
              </text>
            </g>
          );
        })}

        {/* Line */}
        <path d={linePath} fill="none" stroke="#e67e22" strokeWidth="2" />

        {/* Points */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="5" fill="#e67e22" />
            <title>
              {p.name}: {p.avgLatencyMs}ms (
              {new Date(p.date).toLocaleDateString()})
            </title>
          </g>
        ))}

        {/* X-axis labels */}
        {points.length <= 10 &&
          points.map((p, i) => (
            <text
              key={i}
              x={p.x}
              y={height - 10}
              textAnchor="middle"
              fontSize="9"
              fill="#888"
            >
              {new Date(p.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </text>
          ))}
      </svg>
    </div>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [tests, setTests] = useState<StoredTest[]>([]);
  const [questionSets, setQuestionSets] = useState<StoredQuestionSet[]>([]);
  const [runs, setRuns] = useState<StoredRun[]>([]);
  const [selectedTestId, setSelectedTestId] = useState<string>('');
  const [selectedQuestionSetId, setSelectedQuestionSetId] =
    useState<string>('');
  const [testRuns, setTestRuns] = useState<TestRunData[]>([]);

  // Pagination and sorting state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortColumn, setSortColumn] = useState<SortColumn>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    loadTests();
    loadQuestionSets();
    loadRuns();
  }, []);

  const loadTests = async () => {
    const response = await apiClient.getTests({ limit: 100 });
    if (response.success && response.data) {
      setTests(response.data.data);
    }
  };

  const loadQuestionSets = async () => {
    const response = await apiClient.getQuestionSets();
    if (response.success && response.data) {
      setQuestionSets(response.data.data);
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
    setSelectedQuestionSetId(''); // Reset question set filter when test changes
  };

  const handleQuestionSetSelect = (questionSetId: string) => {
    setSelectedQuestionSetId(questionSetId);
  };

  // Get unique question set IDs used in runs for the selected test
  const availableQuestionSets = useMemo(() => {
    if (!selectedTestId) return [];
    const uniqueIds = new Set<string>();
    runs
      .filter((run) => run.testId === selectedTestId && run.questionSetId)
      .forEach((run) => uniqueIds.add(run.questionSetId!));
    return Array.from(uniqueIds).map((id) => {
      const qs = questionSets.find((q) => q.id === id);
      return { id, name: qs?.name || 'Unknown Question Set' };
    });
  }, [selectedTestId, runs, questionSets]);

  // Update test runs when test or question set selection changes
  useEffect(() => {
    if (!selectedTestId) {
      setTestRuns([]);
      return;
    }

    // Filter runs by testId, questionSetId, and compute stats
    const testRunData = runs
      .filter((run) => {
        if (run.testId !== selectedTestId) return false;
        if (run.status !== 'completed') return false;
        // Filter by questionSetId if selected
        if (
          selectedQuestionSetId &&
          run.questionSetId !== selectedQuestionSetId
        )
          return false;
        return true;
      })
      .map((run) => {
        const results = run.results || [];
        const stats = calculateEvalStats(results);
        const evaluated = stats.correct + stats.partial + stats.incorrect;
        const accuracy = evaluated > 0 ? (stats.correct / evaluated) * 100 : 0;

        // Calculate average latency
        const latencies = results
          .filter((r) => r.executionTimeMs !== undefined && r.executionTimeMs !== null)
          .map((r) => r.executionTimeMs as number);
        const avgLatencyMs = latencies.length > 0
          ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
          : null;

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
          avgLatencyMs,
        };
      });

    setTestRuns(testRunData);
  }, [selectedTestId, selectedQuestionSetId, runs]);

  const calculateEvalStats = (
    results: StoredRun['results'],
  ): EvaluationStats => {
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
  const testRunAggregateStats =
    testRuns.length > 0
      ? {
          avgAccuracy:
            testRuns.reduce((sum, e) => sum + e.accuracy, 0) / testRuns.length,
          totalRuns: testRuns.length,
          totalQuestions: testRuns.reduce((sum, e) => sum + e.total, 0),
          latestAccuracy:
            testRuns.length > 0
              ? [...testRuns].sort(
                  (a, b) =>
                    new Date(b.date).getTime() - new Date(a.date).getTime(),
                )[0].accuracy
              : 0,
          trend:
            testRuns.length >= 2
              ? (() => {
                  const sorted = [...testRuns].sort(
                    (a, b) =>
                      new Date(a.date).getTime() - new Date(b.date).getTime(),
                  );
                  const latest = sorted[sorted.length - 1].accuracy;
                  const previous = sorted[sorted.length - 2].accuracy;
                  return latest - previous;
                })()
              : 0,
          avgLatencyMs: (() => {
            const runsWithLatency = testRuns.filter((r) => r.avgLatencyMs !== null);
            if (runsWithLatency.length === 0) return null;
            return Math.round(
              runsWithLatency.reduce((sum, r) => sum + (r.avgLatencyMs || 0), 0) / runsWithLatency.length
            );
          })(),
        }
      : null;

  // Reset pagination when test changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedTestId]);

  // Sort and paginate runs
  const sortedAndPaginatedRuns = useMemo(() => {
    const sorted = [...testRuns].sort((a, b) => {
      let comparison = 0;
      switch (sortColumn) {
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'accuracy':
          comparison = a.accuracy - b.accuracy;
          break;
        case 'correct':
          comparison = a.correct - b.correct;
          break;
        case 'partial':
          comparison = a.partial - b.partial;
          break;
        case 'incorrect':
          comparison = a.incorrect - b.incorrect;
          break;
        case 'errors':
          comparison = a.errors - b.errors;
          break;
        case 'total':
          comparison = a.total - b.total;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    const startIndex = (currentPage - 1) * itemsPerPage;
    return sorted.slice(startIndex, startIndex + itemsPerPage);
  }, [testRuns, sortColumn, sortDirection, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(testRuns.length / itemsPerPage);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
    setCurrentPage(1);
  };

  const getSortIndicator = (column: SortColumn) => {
    if (sortColumn !== column) return null;
    return sortDirection === 'asc' ? ' \u25B2' : ' \u25BC';
  };

  const handleExportDashboardCsv = async () => {
    if (!selectedTestId) return;
    const date = new Date().toISOString().split('T')[0];
    const ok = await downloadAuthenticatedFile(
      apiClient.getDashboardExportCsvUrl(selectedTestId),
      `dashboard-${date}.csv`,
    );
    showNotification(ok ? 'success' : 'error', ok ? 'CSV exported' : 'Failed to export CSV');
  };

  return (
    <div className={styles.dashboardPage}>
      <div className={styles.dashboardHeader}>
        <h2>Dashboard</h2>
      </div>

      <div className={styles.dashboardControls}>
        <div className={styles.controlGroup}>
          <label>Select Test:</label>
          <select
            value={selectedTestId}
            onChange={(e) => handleTestSelect(e.target.value)}
          >
            <option value="">Choose a test...</option>
            {tests.map((test) => (
              <option key={test.id} value={test.id}>
                {test.name} ({test.id})
              </option>
            ))}
          </select>
        </div>
        {selectedTestId && availableQuestionSets.length > 0 && (
          <div className={styles.controlGroup}>
            <label>Filter by Question Set:</label>
            <select
              value={selectedQuestionSetId}
              onChange={(e) => handleQuestionSetSelect(e.target.value)}
            >
              <option value="">All Question Sets</option>
              {availableQuestionSets.map((qs) => (
                <option key={qs.id} value={qs.id}>
                  {qs.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {selectedTestId && testRuns.length > 0 && testRunAggregateStats && (
        <div className={styles.dashboardContent}>
          {/* Top row: KPI cards */}
          <div className={styles.dashboardTopRow}>
            <div className={styles.dashboardAccuracy}>
              <div className={styles.accuracySection}>
                <div className={styles.accuracyHeader}>Average Accuracy</div>
                <div className={styles.accuracyValue}>
                  {testRunAggregateStats.avgAccuracy.toFixed(1)}%
                </div>
                <div className={styles.accuracyDetails}>
                  Across {testRunAggregateStats.totalRuns} runs
                </div>
              </div>
              <div className={styles.accuracySection}>
                <div className={styles.accuracyHeader}>Latest Accuracy</div>
                <div
                  className={`${styles.accuracyValue}${testRunAggregateStats.latestAccuracy >= 80 ? '' : testRunAggregateStats.latestAccuracy >= 50 ? ` ${styles.medium}` : ` ${styles.low}`}`}
                >
                  {testRunAggregateStats.latestAccuracy.toFixed(1)}%
                </div>
                <div className={styles.accuracyDetails}>
                  {testRunAggregateStats.trend !== 0 && (
                    <span
                      className={
                        testRunAggregateStats.trend > 0
                          ? styles.trendUp
                          : styles.trendDown
                      }
                    >
                      {testRunAggregateStats.trend > 0 ? '\u2191' : '\u2193'}{' '}
                      {Math.abs(testRunAggregateStats.trend).toFixed(1)}% vs
                      previous
                    </span>
                  )}
                </div>
              </div>
              <div className={styles.accuracySection}>
                <div className={styles.accuracyHeader}>Total Questions</div>
                <div className={`${styles.accuracyValue} ${styles.total}`}>
                  {testRunAggregateStats.totalQuestions}
                </div>
                <div className={styles.accuracyDetails}>
                  {testRunAggregateStats.totalRuns} test runs
                </div>
              </div>
              {testRunAggregateStats.avgLatencyMs !== null && (
                <div className={`${styles.accuracySection} ${styles.latency}`}>
                  <div className={styles.accuracyHeader}>Avg Latency</div>
                  <div className={styles.accuracyValue}>
                    {testRunAggregateStats.avgLatencyMs >= 1000
                      ? `${(testRunAggregateStats.avgLatencyMs / 1000).toFixed(1)}s`
                      : `${testRunAggregateStats.avgLatencyMs}ms`}
                  </div>
                  <div className={styles.accuracyDetails}>per question</div>
                </div>
              )}
            </div>
          </div>

          {/* Charts */}
          <div className={styles.analyticsCharts}>
            <div className={styles.chartCard}>
              <h3>Accuracy Trend Over Time</h3>
              <LineChart data={testRuns} />
            </div>
            <div className={styles.chartCard}>
              <h3>Accuracy by Run</h3>
              <BarChart data={testRuns} />
            </div>
            {testRuns.some((r) => r.avgLatencyMs !== null) && (
              <div className={styles.chartCard}>
                <h3>Latency Trend Over Time</h3>
                <LatencyChart data={testRuns} />
              </div>
            )}
          </div>

          {/* Runs table */}
          <div className={styles.analyticsTable}>
            <div className={styles.tableHeader}>
              <h3>Run History</h3>
              {selectedTestId && (
                <button
                  className={styles.exportCsvBtn}
                  onClick={handleExportDashboardCsv}
                >
                  Export CSV
                </button>
              )}
            </div>
            <table>
              <thead>
                <tr>
                  <th className={styles.sortable} onClick={() => handleSort('date')}>
                    Date{getSortIndicator('date')}
                  </th>
                  <th
                    className={styles.sortable}
                    onClick={() => handleSort('accuracy')}
                  >
                    Accuracy{getSortIndicator('accuracy')}
                  </th>
                  <th
                    className={styles.sortable}
                    onClick={() => handleSort('correct')}
                  >
                    Correct{getSortIndicator('correct')}
                  </th>
                  <th
                    className={styles.sortable}
                    onClick={() => handleSort('partial')}
                  >
                    Partial{getSortIndicator('partial')}
                  </th>
                  <th
                    className={styles.sortable}
                    onClick={() => handleSort('incorrect')}
                  >
                    Incorrect{getSortIndicator('incorrect')}
                  </th>
                  <th className={styles.sortable} onClick={() => handleSort('errors')}>
                    Errors{getSortIndicator('errors')}
                  </th>
                  <th className={styles.sortable} onClick={() => handleSort('total')}>
                    Total{getSortIndicator('total')}
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedAndPaginatedRuns.map((run) => (
                  <tr key={run.id}>
                    <td>{new Date(run.date).toLocaleString()}</td>
                    <td
                      className={
                        run.accuracy >= 80
                          ? styles.good
                          : run.accuracy >= 50
                            ? styles.medium
                            : styles.bad
                      }
                    >
                      {run.accuracy.toFixed(1)}%
                    </td>
                    <td className={styles.correct}>{run.correct}</td>
                    <td className={styles.partial}>{run.partial}</td>
                    <td className={styles.incorrect}>{run.incorrect}</td>
                    <td className={styles.errors}>{run.errors}</td>
                    <td>{run.total}</td>
                    <td>
                      <button
                        className={styles.viewBtn}
                        onClick={() => navigate(`/runs/${run.id}`)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={testRuns.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={(newItemsPerPage) => {
                setItemsPerPage(newItemsPerPage);
                setCurrentPage(1);
              }}
              itemName="runs"
            />
          </div>
        </div>
      )}

      {selectedTestId && testRuns.length === 0 && (
        <div className={styles.dashboardEmpty}>
          <p>
            No completed runs found for this test. Run the test first to see
            analytics.
          </p>
        </div>
      )}

      {!selectedTestId && (
        <div className={styles.dashboardEmpty}>
          <p>
            Select a test to view analytics. Create tests from the Tests page.
          </p>
        </div>
      )}
    </div>
  );
}
