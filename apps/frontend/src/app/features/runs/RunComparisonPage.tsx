import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  RunComparison,
  ComparisonResult,
  ChangeType,
  HumanEvaluationStatus,
} from '@agent-eval/shared';
import { apiClient } from '../../apiClient';
import styles from './runs.module.scss';

const changeTypeStyles: Record<string, string> = {
  improved: styles.improved,
  regressed: styles.regressed,
  unchanged: styles.unchanged,
  new: styles.newType,
  removed: styles.removed,
};

const changeIndicatorStyles: Record<string, string> = {
  improved: styles.changeImproved,
  regressed: styles.changeRegressed,
  unchanged: styles.changeUnchanged,
  new: styles.changeNew,
  removed: styles.changeRemoved,
};

const badgeStatusStyles: Record<string, string> = {
  pending: styles.badgePending,
  running: styles.badgeRunning,
  completed: styles.badgeCompleted,
  failed: styles.badgeFailed,
  canceled: styles.badgeCanceled,
};

const evalBadgeStyles: Record<string, string> = {
  correct: styles.correct,
  partial: styles.partial,
  incorrect: styles.incorrect,
  none: styles.none,
};

function formatEvaluation(eval_status?: HumanEvaluationStatus): string {
  if (!eval_status) return '-';
  return eval_status.charAt(0).toUpperCase() + eval_status.slice(1);
}

function ChangeIndicator({ changeType }: { changeType: ChangeType }) {
  const indicators: Record<ChangeType, { symbol: string; label: string }> = {
    improved: { symbol: '\u2191', label: 'Improved' },
    regressed: { symbol: '\u2193', label: 'Regressed' },
    unchanged: { symbol: '=', label: 'Unchanged' },
    new: { symbol: '+', label: 'New' },
    removed: { symbol: '-', label: 'Removed' },
  };

  const { symbol, label } = indicators[changeType];
  return (
    <span className={`${styles.changeIndicator} ${changeIndicatorStyles[changeType] || ''}`} title={label}>
      {symbol}
    </span>
  );
}

function ComparisonResultRow({ result }: { result: ComparisonResult }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`${styles.comparisonRow} ${changeTypeStyles[result.changeType] || ''}`}>
      <div className={styles.comparisonRowHeader} onClick={() => setExpanded(!expanded)}>
        <ChangeIndicator changeType={result.changeType} />
        <div className={styles.comparisonQuestion}>{result.question}</div>
        <div className={styles.comparisonEvals}>
          <span className={`${styles.evalBadge} ${evalBadgeStyles[result.leftResult?.humanEvaluation || 'none'] || ''}`}>
            {formatEvaluation(result.leftResult?.humanEvaluation)}
          </span>
          <span className={styles.evalArrow}>&rarr;</span>
          <span className={`${styles.evalBadge} ${evalBadgeStyles[result.rightResult?.humanEvaluation || 'none'] || ''}`}>
            {formatEvaluation(result.rightResult?.humanEvaluation)}
          </span>
        </div>
        <div className={styles.comparisonLatency}>
          {result.executionTimeChange?.from !== undefined && (
            <span>{result.executionTimeChange.from}ms</span>
          )}
          {result.executionTimeChange?.from !== undefined && result.executionTimeChange?.to !== undefined && (
            <span className={styles.latencyArrow}>&rarr;</span>
          )}
          {result.executionTimeChange?.to !== undefined && (
            <span>{result.executionTimeChange.to}ms</span>
          )}
          {result.executionTimeChange?.delta !== undefined && (
            <span className={`${styles.latencyDelta} ${result.executionTimeChange.delta > 0 ? styles.slower : styles.faster}`}>
              ({result.executionTimeChange.delta > 0 ? '+' : ''}{result.executionTimeChange.delta}ms)
            </span>
          )}
        </div>
        <span className={styles.expandIcon}>{expanded ? '\u25BC' : '\u25B6'}</span>
      </div>

      {expanded && (
        <div className={styles.comparisonRowDetails}>
          <div className={styles.comparisonColumns}>
            <div className={styles.comparisonColumn}>
              <h4>Left Run (Baseline)</h4>
              {result.leftResult ? (
                <>
                  <div className={styles.detailField}>
                    <strong>Answer:</strong>
                    <div className={styles.compDetailValue}>{result.leftResult.answer}</div>
                  </div>
                  {result.leftResult.expectedAnswer && (
                    <div className={styles.detailField}>
                      <strong>Expected:</strong>
                      <div className={styles.compDetailValue}>{result.leftResult.expectedAnswer}</div>
                    </div>
                  )}
                  {result.leftResult.humanEvaluationDescription && (
                    <div className={styles.detailField}>
                      <strong>Notes:</strong>
                      <div className={styles.compDetailValue}>{result.leftResult.humanEvaluationDescription}</div>
                    </div>
                  )}
                </>
              ) : (
                <div className={styles.noResult}>Question not in this run</div>
              )}
            </div>
            <div className={styles.comparisonColumn}>
              <h4>Right Run (Compared)</h4>
              {result.rightResult ? (
                <>
                  <div className={styles.detailField}>
                    <strong>Answer:</strong>
                    <div className={styles.compDetailValue}>{result.rightResult.answer}</div>
                  </div>
                  {result.rightResult.expectedAnswer && (
                    <div className={styles.detailField}>
                      <strong>Expected:</strong>
                      <div className={styles.compDetailValue}>{result.rightResult.expectedAnswer}</div>
                    </div>
                  )}
                  {result.rightResult.humanEvaluationDescription && (
                    <div className={styles.detailField}>
                      <strong>Notes:</strong>
                      <div className={styles.compDetailValue}>{result.rightResult.humanEvaluationDescription}</div>
                    </div>
                  )}
                </>
              ) : (
                <div className={styles.noResult}>Question not in this run</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function RunComparisonPage() {
  const { id, otherId } = useParams<{ id: string; otherId: string }>();
  const navigate = useNavigate();
  const [comparison, setComparison] = useState<RunComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ChangeType | 'all'>('all');

  const loadComparison = useCallback(async () => {
    if (!id || !otherId) return;
    setLoading(true);
    setError(null);

    const response = await apiClient.compareRuns(id, otherId);
    if (response.success && response.data) {
      setComparison(response.data);
    } else {
      setError(response.error || 'Failed to load comparison');
    }
    setLoading(false);
  }, [id, otherId]);

  useEffect(() => {
    loadComparison();
  }, [loadComparison]);

  const filteredResults = comparison?.results.filter(
    (r) => filter === 'all' || r.changeType === filter
  ) || [];

  if (loading) {
    return (
      <div className={styles.runComparisonPage}>
        <div className={styles.loadingState}>Loading comparison...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.runComparisonPage}>
        <div className={styles.errorState}>{error}</div>
        <button className={styles.backBtn} onClick={() => navigate('/runs')}>
          Back to Runs
        </button>
      </div>
    );
  }

  if (!comparison) {
    return (
      <div className={styles.runComparisonPage}>
        <div className={styles.errorState}>Comparison not found</div>
        <button className={styles.backBtn} onClick={() => navigate('/runs')}>
          Back to Runs
        </button>
      </div>
    );
  }

  const { leftRun, rightRun, summary } = comparison;

  return (
    <div className={styles.runComparisonPage}>
      <div className={styles.comparisonHeader}>
        <button className={styles.backBtn} onClick={() => navigate(`/runs/${id}`)}>
          &larr; Back to Run
        </button>
        <h2>Run Comparison</h2>
      </div>

      <div className={styles.comparisonRunsInfo}>
        <div className={`${styles.compRunInfo} ${styles.left}`}>
          <h3>Left Run (Baseline)</h3>
          <div className={styles.runInfoDetails}>
            <span className={styles.runTestName}>{leftRun.test?.name || 'Unknown Test'}</span>
            <span className={`${styles.statusBadge} ${badgeStatusStyles[leftRun.status] || ''}`}>{leftRun.status}</span>
            <span className={styles.runDate}>
              {leftRun.completedAt ? new Date(leftRun.completedAt).toLocaleString() : 'Not completed'}
            </span>
          </div>
        </div>
        <div className={styles.vsDivider}>vs</div>
        <div className={`${styles.compRunInfo} ${styles.right}`}>
          <h3>Right Run (Compared)</h3>
          <div className={styles.runInfoDetails}>
            <span className={styles.runTestName}>{rightRun.test?.name || 'Unknown Test'}</span>
            <span className={`${styles.statusBadge} ${badgeStatusStyles[rightRun.status] || ''}`}>{rightRun.status}</span>
            <span className={styles.runDate}>
              {rightRun.completedAt ? new Date(rightRun.completedAt).toLocaleString() : 'Not completed'}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.comparisonSummary}>
        <div className={`${styles.summaryItem} ${styles.improved}`}>
          <span className={styles.summaryValue}>{summary.improved}</span>
          <span className={styles.summaryLabel}>Improved</span>
        </div>
        <div className={`${styles.summaryItem} ${styles.regressed}`}>
          <span className={styles.summaryValue}>{summary.regressed}</span>
          <span className={styles.summaryLabel}>Regressed</span>
        </div>
        <div className={`${styles.summaryItem} ${styles.unchanged}`}>
          <span className={styles.summaryValue}>{summary.unchanged}</span>
          <span className={styles.summaryLabel}>Unchanged</span>
        </div>
        {summary.newQuestions > 0 && (
          <div className={`${styles.summaryItem} ${styles.newType}`}>
            <span className={styles.summaryValue}>{summary.newQuestions}</span>
            <span className={styles.summaryLabel}>New</span>
          </div>
        )}
        {summary.removedQuestions > 0 && (
          <div className={`${styles.summaryItem} ${styles.removed}`}>
            <span className={styles.summaryValue}>{summary.removedQuestions}</span>
            <span className={styles.summaryLabel}>Removed</span>
          </div>
        )}
        {summary.accuracyDelta !== null && (
          <div className={`${styles.summaryItem} ${styles.accuracy} ${summary.accuracyDelta >= 0 ? styles.positive : styles.negative}`}>
            <span className={styles.summaryValue}>
              {summary.accuracyDelta >= 0 ? '+' : ''}{summary.accuracyDelta}%
            </span>
            <span className={styles.summaryLabel}>Accuracy</span>
          </div>
        )}
        {summary.avgLatencyDelta !== null && (
          <div className={`${styles.summaryItem} ${styles.latency} ${summary.avgLatencyDelta <= 0 ? styles.positive : styles.negative}`}>
            <span className={styles.summaryValue}>
              {summary.avgLatencyDelta >= 0 ? '+' : ''}{summary.avgLatencyDelta}ms
            </span>
            <span className={styles.summaryLabel}>Avg Latency</span>
          </div>
        )}
      </div>

      <div className={styles.comparisonFilters}>
        <label>Filter by change:</label>
        <select value={filter} onChange={(e) => setFilter(e.target.value as ChangeType | 'all')}>
          <option value="all">All ({comparison.results.length})</option>
          <option value="improved">Improved ({summary.improved})</option>
          <option value="regressed">Regressed ({summary.regressed})</option>
          <option value="unchanged">Unchanged ({summary.unchanged})</option>
          {summary.newQuestions > 0 && <option value="new">New ({summary.newQuestions})</option>}
          {summary.removedQuestions > 0 && <option value="removed">Removed ({summary.removedQuestions})</option>}
        </select>
      </div>

      <div className={styles.comparisonResults}>
        {filteredResults.length === 0 ? (
          <div className={styles.noResults}>No results match the selected filter</div>
        ) : (
          filteredResults.map((result, index) => (
            <ComparisonResultRow key={`${result.question}-${index}`} result={result} />
          ))
        )}
      </div>
    </div>
  );
}
