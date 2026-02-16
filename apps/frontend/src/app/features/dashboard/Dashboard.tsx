import React, { useState, useEffect, useMemo } from 'react';
import { StoredTest, StoredRun, StoredQuestionSet } from '@agent-eval/shared';
import { useNavigate } from 'react-router-dom';
import { Pagination, SearchableSelect } from '@agent-eval/ui';
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
type ConversationSortColumn =
  | 'date'
  | 'goalRate'
  | 'avgTurns'
  | 'scenarios'
  | 'achieved'
  | 'errors'
  | 'evaluation';
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

function EvaluationBreakdownChart({ data }: { data: TestRunData[] }) {
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

  const maxTotal = Math.max(...sortedData.map((d) => d.correct + d.partial + d.incorrect + d.errors));
  const yMax = maxTotal || 1;

  const barWidth = (chartWidth / sortedData.length) * 0.7;
  const gap = (chartWidth / sortedData.length) * 0.3;

  // Generate Y-axis labels (5 ticks)
  const yLabels = [0, 0.25, 0.5, 0.75, 1].map((pct) => Math.round(yMax * pct));

  const categories: { key: keyof Pick<TestRunData, 'correct' | 'partial' | 'incorrect' | 'errors'>; color: string; label: string }[] = [
    { key: 'correct', color: '#27ae60', label: 'Correct' },
    { key: 'partial', color: '#f39c12', label: 'Partial' },
    { key: 'incorrect', color: '#e74c3c', label: 'Incorrect' },
    { key: 'errors', color: '#8e44ad', label: 'Errors' },
  ];

  return (
    <div className={styles.barChartContainer}>
      <svg viewBox={`0 0 ${width} ${height}`} className={styles.barChart}>
        {/* Grid lines */}
        {yLabels.map((val) => {
          const y = padding + chartHeight - (val / yMax) * chartHeight;
          return (
            <g key={val}>
              <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#eee" strokeWidth="1" />
              <text x={padding - 5} y={y + 4} textAnchor="end" fontSize="10" fill="#888">{val}</text>
            </g>
          );
        })}

        {/* Stacked bars */}
        {sortedData.map((d, i) => {
          const x = padding + i * (barWidth + gap) + gap / 2;
          let currentY = padding + chartHeight;

          return (
            <g key={i}>
              {categories.map((cat) => {
                const value = d[cat.key];
                if (value === 0) return null;
                const segmentHeight = (value / yMax) * chartHeight;
                currentY -= segmentHeight;
                return (
                  <rect
                    key={cat.key}
                    x={x}
                    y={currentY}
                    width={barWidth}
                    height={segmentHeight}
                    fill={cat.color}
                    rx="1"
                  >
                    <title>{cat.label}: {value}</title>
                  </rect>
                );
              })}
              <text x={x + barWidth / 2} y={height - 10} textAnchor="middle" fontSize="9" fill="#888">
                {new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </text>
              <title>
                {new Date(d.date).toLocaleDateString()} - Correct: {d.correct}, Partial: {d.partial}, Incorrect: {d.incorrect}, Errors: {d.errors}
              </title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function AccuracyDistributionChart({ data }: { data: TestRunData[] }) {
  if (data.length === 0) return null;

  const padding = 40;
  const width = 600;
  const height = 250;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const buckets = [
    { label: '0-20%', min: 0, max: 20, color: '#e74c3c' },
    { label: '20-40%', min: 20, max: 40, color: '#f39c12' },
    { label: '40-60%', min: 40, max: 60, color: '#f1c40f' },
    { label: '60-80%', min: 60, max: 80, color: '#7dcea0' },
    { label: '80-100%', min: 80, max: 100.01, color: '#27ae60' },
  ];

  const counts = buckets.map((bucket) =>
    data.filter((d) => d.accuracy >= bucket.min && d.accuracy < bucket.max).length,
  );

  const maxCount = Math.max(...counts, 1);
  const yMax = maxCount;

  const barWidth = (chartWidth / buckets.length) * 0.7;
  const gap = (chartWidth / buckets.length) * 0.3;

  // Generate Y-axis labels (integer ticks)
  const ySteps = Math.min(yMax, 5);
  const yLabels = Array.from({ length: ySteps + 1 }, (_, i) =>
    Math.round((yMax / ySteps) * i),
  );

  return (
    <div className={styles.barChartContainer}>
      <svg viewBox={`0 0 ${width} ${height}`} className={styles.barChart}>
        {/* Grid lines */}
        {yLabels.map((val) => {
          const y = padding + chartHeight - (val / yMax) * chartHeight;
          return (
            <g key={val}>
              <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#eee" strokeWidth="1" />
              <text x={padding - 5} y={y + 4} textAnchor="end" fontSize="10" fill="#888">{val}</text>
            </g>
          );
        })}

        {/* Bars */}
        {buckets.map((bucket, i) => {
          const x = padding + i * (barWidth + gap) + gap / 2;
          const barHeight = (counts[i] / yMax) * chartHeight;
          const y = padding + chartHeight - barHeight;
          const pct = data.length > 0 ? ((counts[i] / data.length) * 100).toFixed(0) : '0';

          return (
            <g key={i}>
              <rect x={x} y={y} width={barWidth} height={barHeight} fill={bucket.color} rx="2" />
              <text x={x + barWidth / 2} y={height - 10} textAnchor="middle" fontSize="9" fill="#888">
                {bucket.label}
              </text>
              <title>{bucket.label}: {counts[i]} runs ({pct}% of total)</title>
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

interface ConversationRunData {
  id: string;
  name: string;
  date: string;
  totalScenarios: number;
  goalAchievedCount: number;
  goalNotAchievedCount: number;
  maxTurnsReachedCount: number;
  errorCount: number;
  averageTurns: number;
  goalAchievementRate: number;
  evaluations: { good: number; acceptable: number; poor: number; unevaluated: number };
}

function GoalAchievementChart({ data }: { data: ConversationRunData[] }) {
  if (data.length === 0) return null;

  const padding = 40;
  const width = 600;
  const height = 250;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const sortedData = [...data].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  const points = sortedData.map((d, i) => {
    const x = padding + (i / Math.max(sortedData.length - 1, 1)) * chartWidth;
    const y = padding + chartHeight - (d.goalAchievementRate / 100) * chartHeight;
    return { x, y, ...d };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  return (
    <div className={styles.lineChartContainer}>
      <svg viewBox={`0 0 ${width} ${height}`} className={styles.lineChart}>
        {[0, 25, 50, 75, 100].map((val) => {
          const y = padding + chartHeight - (val / 100) * chartHeight;
          return (
            <g key={val}>
              <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#eee" strokeWidth="1" />
              <text x={padding - 5} y={y + 4} textAnchor="end" fontSize="10" fill="#888">{val}%</text>
            </g>
          );
        })}
        <path d={linePath} fill="none" stroke="#27ae60" strokeWidth="2" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="5" fill="#27ae60" />
            <title>{p.name}: {p.goalAchievementRate.toFixed(1)}% ({new Date(p.date).toLocaleDateString()})</title>
          </g>
        ))}
        {points.length <= 10 && points.map((p, i) => (
          <text key={i} x={p.x} y={height - 10} textAnchor="middle" fontSize="9" fill="#888">
            {new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </text>
        ))}
      </svg>
    </div>
  );
}

function AvgTurnsChart({ data }: { data: ConversationRunData[] }) {
  if (data.length === 0) return null;

  const padding = 40;
  const width = 600;
  const height = 250;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const sortedData = [...data].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  const maxTurns = Math.max(...sortedData.map((d) => d.averageTurns), 1);
  const yMax = Math.ceil(maxTurns / 5) * 5 || 5;

  const points = sortedData.map((d, i) => {
    const x = padding + (i / Math.max(sortedData.length - 1, 1)) * chartWidth;
    const y = padding + chartHeight - (d.averageTurns / yMax) * chartHeight;
    return { x, y, ...d };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  const yLabels = [0, 0.25, 0.5, 0.75, 1].map((pct) => Math.round(yMax * pct));

  return (
    <div className={styles.lineChartContainer}>
      <svg viewBox={`0 0 ${width} ${height}`} className={styles.lineChart}>
        {yLabels.map((val) => {
          const y = padding + chartHeight - (val / yMax) * chartHeight;
          return (
            <g key={val}>
              <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#eee" strokeWidth="1" />
              <text x={padding - 5} y={y + 4} textAnchor="end" fontSize="10" fill="#888">{val}</text>
            </g>
          );
        })}
        <path d={linePath} fill="none" stroke="#3498db" strokeWidth="2" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="5" fill="#3498db" />
            <title>{p.name}: {p.averageTurns} avg turns ({new Date(p.date).toLocaleDateString()})</title>
          </g>
        ))}
        {points.length <= 10 && points.map((p, i) => (
          <text key={i} x={p.x} y={height - 10} textAnchor="middle" fontSize="9" fill="#888">
            {new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
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
  const [conversationRuns, setConversationRuns] = useState<ConversationRunData[]>([]);

  // Pagination and sorting state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortColumn, setSortColumn] = useState<SortColumn>('date');
  const [convSortColumn, setConvSortColumn] = useState<ConversationSortColumn>('date');
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

  const selectedTest = useMemo(
    () => tests.find((t) => t.id === selectedTestId),
    [tests, selectedTestId],
  );

  const isConversationTest = selectedTest?.type === 'conversation';

  // Update test runs when test or question set selection changes
  useEffect(() => {
    if (!selectedTestId) {
      setTestRuns([]);
      setConversationRuns([]);
      return;
    }

    const completedRuns = runs.filter((run) => {
      if (run.testId !== selectedTestId) return false;
      if (run.status !== 'completed') return false;
      if (selectedQuestionSetId && run.questionSetId !== selectedQuestionSetId)
        return false;
      return true;
    });

    if (isConversationTest) {
      setTestRuns([]);
      // Load conversation stats for each completed run
      const loadConversationData = async () => {
        const convData: ConversationRunData[] = [];
        for (const run of completedRuns) {
          const resp = await apiClient.getConversationRunStats(run.id);
          if (resp.success && resp.data) {
            const stats = resp.data;
            const goalRate =
              stats.totalScenarios > 0
                ? (stats.goalAchievedCount / stats.totalScenarios) * 100
                : 0;
            convData.push({
              id: run.id,
              name: `Run ${new Date(run.createdAt).toLocaleString()}`,
              date: run.completedAt || run.createdAt,
              totalScenarios: stats.totalScenarios,
              goalAchievedCount: stats.goalAchievedCount,
              goalNotAchievedCount: stats.goalNotAchievedCount,
              maxTurnsReachedCount: stats.maxTurnsReachedCount,
              errorCount: stats.errorCount,
              averageTurns: stats.averageTurns,
              goalAchievementRate: goalRate,
              evaluations: stats.evaluations,
            });
          }
        }
        setConversationRuns(convData);
      };
      loadConversationData();
    } else {
      setConversationRuns([]);
      // QA test - compute stats from results
      const testRunData = completedRuns.map((run) => {
        const results = run.results || [];
        const stats = calculateEvalStats(results);
        const evaluated = stats.correct + stats.partial + stats.incorrect;
        const accuracy = evaluated > 0 ? (stats.correct / evaluated) * 100 : 0;

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
    }
  }, [selectedTestId, selectedQuestionSetId, runs, isConversationTest]);

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

  // Calculate aggregate stats for conversation tests
  const convAggregateStats =
    conversationRuns.length > 0
      ? {
          avgGoalRate:
            conversationRuns.reduce((sum, r) => sum + r.goalAchievementRate, 0) /
            conversationRuns.length,
          totalRuns: conversationRuns.length,
          totalScenarios: conversationRuns.reduce(
            (sum, r) => sum + r.totalScenarios,
            0,
          ),
          avgTurns:
            conversationRuns.reduce((sum, r) => sum + r.averageTurns, 0) /
            conversationRuns.length,
          latestGoalRate:
            [...conversationRuns].sort(
              (a, b) =>
                new Date(b.date).getTime() - new Date(a.date).getTime(),
            )[0].goalAchievementRate,
          trend:
            conversationRuns.length >= 2
              ? (() => {
                  const sorted = [...conversationRuns].sort(
                    (a, b) =>
                      new Date(a.date).getTime() - new Date(b.date).getTime(),
                  );
                  return (
                    sorted[sorted.length - 1].goalAchievementRate -
                    sorted[sorted.length - 2].goalAchievementRate
                  );
                })()
              : 0,
          totalEvaluations: conversationRuns.reduce(
            (sum, r) =>
              sum +
              r.evaluations.good +
              r.evaluations.acceptable +
              r.evaluations.poor,
            0,
          ),
        }
      : null;

  // Reset pagination when test changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedTestId]);

  // Sort and paginate conversation runs
  const sortedAndPaginatedConvRuns = useMemo(() => {
    const sorted = [...conversationRuns].sort((a, b) => {
      let comparison = 0;
      switch (convSortColumn) {
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'goalRate':
          comparison = a.goalAchievementRate - b.goalAchievementRate;
          break;
        case 'avgTurns':
          comparison = a.averageTurns - b.averageTurns;
          break;
        case 'scenarios':
          comparison = a.totalScenarios - b.totalScenarios;
          break;
        case 'achieved':
          comparison = a.goalAchievedCount - b.goalAchievedCount;
          break;
        case 'errors':
          comparison = a.errorCount - b.errorCount;
          break;
        case 'evaluation':
          comparison = a.evaluations.good - b.evaluations.good;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    const startIndex = (currentPage - 1) * itemsPerPage;
    return sorted.slice(startIndex, startIndex + itemsPerPage);
  }, [conversationRuns, convSortColumn, sortDirection, currentPage, itemsPerPage]);

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

  const totalPages = Math.ceil(
    (isConversationTest ? conversationRuns.length : testRuns.length) / itemsPerPage,
  );

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
    setCurrentPage(1);
  };

  const handleConvSort = (column: ConversationSortColumn) => {
    if (convSortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setConvSortColumn(column);
      setSortDirection('desc');
    }
    setCurrentPage(1);
  };

  const getSortIndicator = (column: SortColumn) => {
    if (sortColumn !== column) return null;
    return sortDirection === 'asc' ? ' \u25B2' : ' \u25BC';
  };

  const getConvSortIndicator = (column: ConversationSortColumn) => {
    if (convSortColumn !== column) return null;
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
          <SearchableSelect
            options={tests.map((test) => ({
              value: test.id,
              label: test.name,
              sublabel: test.id,
            }))}
            value={selectedTestId}
            onChange={handleTestSelect}
            placeholder="Search tests..."
            allOptionLabel="Choose a test..."
          />
        </div>
        {selectedTestId && !isConversationTest && availableQuestionSets.length > 0 && (
          <div className={styles.controlGroup}>
            <label>Filter by Question Set:</label>
            <SearchableSelect
              options={availableQuestionSets.map((qs) => ({
                value: qs.id,
                label: qs.name,
              }))}
              value={selectedQuestionSetId}
              onChange={handleQuestionSetSelect}
              placeholder="Search question sets..."
              allOptionLabel="All Question Sets"
            />
          </div>
        )}
      </div>

      {/* Conversation Test Analytics */}
      {selectedTestId && isConversationTest && conversationRuns.length > 0 && convAggregateStats && (
        <div className={styles.dashboardContent}>
          <div className={styles.dashboardTopRow}>
            <div className={styles.dashboardAccuracy}>
              <div className={styles.accuracySection}>
                <div className={styles.accuracyHeader}>Avg Goal Achievement</div>
                <div className={styles.accuracyValue}>
                  {convAggregateStats.avgGoalRate.toFixed(1)}%
                </div>
                <div className={styles.accuracyDetails}>
                  Across {convAggregateStats.totalRuns} runs
                </div>
              </div>
              <div className={styles.accuracySection}>
                <div className={styles.accuracyHeader}>Latest Goal Rate</div>
                <div
                  className={`${styles.accuracyValue}${convAggregateStats.latestGoalRate >= 80 ? '' : convAggregateStats.latestGoalRate >= 50 ? ` ${styles.medium}` : ` ${styles.low}`}`}
                >
                  {convAggregateStats.latestGoalRate.toFixed(1)}%
                </div>
                <div className={styles.accuracyDetails}>
                  {convAggregateStats.trend !== 0 && (
                    <span
                      className={
                        convAggregateStats.trend > 0
                          ? styles.trendUp
                          : styles.trendDown
                      }
                    >
                      {convAggregateStats.trend > 0 ? '\u2191' : '\u2193'}{' '}
                      {Math.abs(convAggregateStats.trend).toFixed(1)}% vs previous
                    </span>
                  )}
                </div>
              </div>
              <div className={styles.accuracySection}>
                <div className={styles.accuracyHeader}>Avg Turns</div>
                <div className={`${styles.accuracyValue} ${styles.total}`}>
                  {convAggregateStats.avgTurns.toFixed(1)}
                </div>
                <div className={styles.accuracyDetails}>per conversation</div>
              </div>
              <div className={styles.accuracySection}>
                <div className={styles.accuracyHeader}>Total Scenarios</div>
                <div className={`${styles.accuracyValue} ${styles.total}`}>
                  {convAggregateStats.totalScenarios}
                </div>
                <div className={styles.accuracyDetails}>
                  {convAggregateStats.totalRuns} runs
                </div>
              </div>
            </div>
          </div>

          <div className={styles.analyticsCharts}>
            <div className={styles.chartCard}>
              <h3>Goal Achievement Over Time</h3>
              <GoalAchievementChart data={conversationRuns} />
            </div>
            <div className={styles.chartCard}>
              <h3>Average Turns Over Time</h3>
              <AvgTurnsChart data={conversationRuns} />
            </div>
          </div>

          <div className={styles.analyticsTable}>
            <div className={styles.tableHeader}>
              <h3>Run History</h3>
            </div>
            <table>
              <thead>
                <tr>
                  <th className={styles.sortable} onClick={() => handleConvSort('date')}>
                    Date{getConvSortIndicator('date')}
                  </th>
                  <th className={styles.sortable} onClick={() => handleConvSort('goalRate')}>
                    Goal Rate{getConvSortIndicator('goalRate')}
                  </th>
                  <th className={styles.sortable} onClick={() => handleConvSort('scenarios')}>
                    Scenarios{getConvSortIndicator('scenarios')}
                  </th>
                  <th className={styles.sortable} onClick={() => handleConvSort('achieved')}>
                    Achieved{getConvSortIndicator('achieved')}
                  </th>
                  <th className={styles.sortable} onClick={() => handleConvSort('avgTurns')}>
                    Avg Turns{getConvSortIndicator('avgTurns')}
                  </th>
                  <th className={styles.sortable} onClick={() => handleConvSort('errors')}>
                    Errors{getConvSortIndicator('errors')}
                  </th>
                  <th className={styles.sortable} onClick={() => handleConvSort('evaluation')}>
                    Evaluations{getConvSortIndicator('evaluation')}
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedAndPaginatedConvRuns.map((run) => (
                  <tr key={run.id}>
                    <td>{new Date(run.date).toLocaleString()}</td>
                    <td
                      className={
                        run.goalAchievementRate >= 80
                          ? styles.good
                          : run.goalAchievementRate >= 50
                            ? styles.medium
                            : styles.bad
                      }
                    >
                      {run.goalAchievementRate.toFixed(1)}%
                    </td>
                    <td>{run.totalScenarios}</td>
                    <td className={styles.correct}>{run.goalAchievedCount}</td>
                    <td>{run.averageTurns.toFixed(1)}</td>
                    <td className={styles.errors}>{run.errorCount}</td>
                    <td>
                      {run.evaluations.good + run.evaluations.acceptable + run.evaluations.poor > 0
                        ? `${run.evaluations.good}G / ${run.evaluations.acceptable}A / ${run.evaluations.poor}P`
                        : 'None'}
                    </td>
                    <td>
                      <button
                        className={styles.viewBtn}
                        onClick={() => navigate(`/runs/${run.id}/conversations`)}
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
              totalItems={conversationRuns.length}
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

      {/* QA Test Analytics */}
      {selectedTestId && !isConversationTest && testRuns.length > 0 && testRunAggregateStats && (
        <div className={styles.dashboardContent}>
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

          <div className={styles.analyticsCharts}>
            <div className={styles.chartCard}>
              <h3>Accuracy Trend Over Time</h3>
              <LineChart data={testRuns} />
            </div>
            <div className={styles.chartCard}>
              <h3>Evaluation Breakdown</h3>
              <EvaluationBreakdownChart data={testRuns} />
            </div>
            <div className={styles.chartCard}>
              <h3>Accuracy Distribution</h3>
              <AccuracyDistributionChart data={testRuns} />
            </div>
            {testRuns.some((r) => r.avgLatencyMs !== null) && (
              <div className={styles.chartCard}>
                <h3>Latency Trend Over Time</h3>
                <LatencyChart data={testRuns} />
              </div>
            )}
          </div>

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

      {selectedTestId &&
        ((isConversationTest && conversationRuns.length === 0) ||
          (!isConversationTest && testRuns.length === 0)) && (
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
