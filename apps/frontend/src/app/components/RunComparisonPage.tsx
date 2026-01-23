import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  RunComparison,
  ComparisonResult,
  ChangeType,
  HumanEvaluationStatus,
} from '@agent-eval/shared';
import { apiClient } from '../apiClient';

function formatEvaluation(eval_status?: HumanEvaluationStatus): string {
  if (!eval_status) return '-';
  return eval_status.charAt(0).toUpperCase() + eval_status.slice(1);
}

function ChangeIndicator({ changeType }: { changeType: ChangeType }) {
  const indicators: Record<ChangeType, { symbol: string; className: string; label: string }> = {
    improved: { symbol: '\u2191', className: 'change-improved', label: 'Improved' },
    regressed: { symbol: '\u2193', className: 'change-regressed', label: 'Regressed' },
    unchanged: { symbol: '=', className: 'change-unchanged', label: 'Unchanged' },
    new: { symbol: '+', className: 'change-new', label: 'New' },
    removed: { symbol: '-', className: 'change-removed', label: 'Removed' },
  };

  const { symbol, className, label } = indicators[changeType];
  return (
    <span className={`change-indicator ${className}`} title={label}>
      {symbol}
    </span>
  );
}

function ComparisonResultRow({ result }: { result: ComparisonResult }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`comparison-row ${result.changeType}`}>
      <div className="comparison-row-header" onClick={() => setExpanded(!expanded)}>
        <ChangeIndicator changeType={result.changeType} />
        <div className="comparison-question">{result.question}</div>
        <div className="comparison-evals">
          <span className={`eval-badge ${result.leftResult?.humanEvaluation || 'none'}`}>
            {formatEvaluation(result.leftResult?.humanEvaluation)}
          </span>
          <span className="eval-arrow">&rarr;</span>
          <span className={`eval-badge ${result.rightResult?.humanEvaluation || 'none'}`}>
            {formatEvaluation(result.rightResult?.humanEvaluation)}
          </span>
        </div>
        <div className="comparison-latency">
          {result.executionTimeChange?.from !== undefined && (
            <span>{result.executionTimeChange.from}ms</span>
          )}
          {result.executionTimeChange?.from !== undefined && result.executionTimeChange?.to !== undefined && (
            <span className="latency-arrow">&rarr;</span>
          )}
          {result.executionTimeChange?.to !== undefined && (
            <span>{result.executionTimeChange.to}ms</span>
          )}
          {result.executionTimeChange?.delta !== undefined && (
            <span className={`latency-delta ${result.executionTimeChange.delta > 0 ? 'slower' : 'faster'}`}>
              ({result.executionTimeChange.delta > 0 ? '+' : ''}{result.executionTimeChange.delta}ms)
            </span>
          )}
        </div>
        <span className="expand-icon">{expanded ? '\u25BC' : '\u25B6'}</span>
      </div>

      {expanded && (
        <div className="comparison-row-details">
          <div className="comparison-columns">
            <div className="comparison-column left">
              <h4>Left Run (Baseline)</h4>
              {result.leftResult ? (
                <>
                  <div className="detail-field">
                    <strong>Answer:</strong>
                    <div className="detail-value">{result.leftResult.answer}</div>
                  </div>
                  {result.leftResult.expectedAnswer && (
                    <div className="detail-field">
                      <strong>Expected:</strong>
                      <div className="detail-value">{result.leftResult.expectedAnswer}</div>
                    </div>
                  )}
                  {result.leftResult.humanEvaluationDescription && (
                    <div className="detail-field">
                      <strong>Notes:</strong>
                      <div className="detail-value">{result.leftResult.humanEvaluationDescription}</div>
                    </div>
                  )}
                </>
              ) : (
                <div className="no-result">Question not in this run</div>
              )}
            </div>
            <div className="comparison-column right">
              <h4>Right Run (Compared)</h4>
              {result.rightResult ? (
                <>
                  <div className="detail-field">
                    <strong>Answer:</strong>
                    <div className="detail-value">{result.rightResult.answer}</div>
                  </div>
                  {result.rightResult.expectedAnswer && (
                    <div className="detail-field">
                      <strong>Expected:</strong>
                      <div className="detail-value">{result.rightResult.expectedAnswer}</div>
                    </div>
                  )}
                  {result.rightResult.humanEvaluationDescription && (
                    <div className="detail-field">
                      <strong>Notes:</strong>
                      <div className="detail-value">{result.rightResult.humanEvaluationDescription}</div>
                    </div>
                  )}
                </>
              ) : (
                <div className="no-result">Question not in this run</div>
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
      <div className="run-comparison-page">
        <div className="loading-state">Loading comparison...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="run-comparison-page">
        <div className="error-state">{error}</div>
        <button className="back-btn" onClick={() => navigate('/runs')}>
          Back to Runs
        </button>
      </div>
    );
  }

  if (!comparison) {
    return (
      <div className="run-comparison-page">
        <div className="error-state">Comparison not found</div>
        <button className="back-btn" onClick={() => navigate('/runs')}>
          Back to Runs
        </button>
      </div>
    );
  }

  const { leftRun, rightRun, summary } = comparison;

  return (
    <div className="run-comparison-page">
      <div className="comparison-header">
        <button className="back-btn" onClick={() => navigate(`/runs/${id}`)}>
          &larr; Back to Run
        </button>
        <h2>Run Comparison</h2>
      </div>

      <div className="comparison-runs-info">
        <div className="run-info left">
          <h3>Left Run (Baseline)</h3>
          <div className="run-info-details">
            <span className="run-test-name">{leftRun.test?.name || 'Unknown Test'}</span>
            <span className={`status-badge badge-${leftRun.status}`}>{leftRun.status}</span>
            <span className="run-date">
              {leftRun.completedAt ? new Date(leftRun.completedAt).toLocaleString() : 'Not completed'}
            </span>
          </div>
        </div>
        <div className="vs-divider">vs</div>
        <div className="run-info right">
          <h3>Right Run (Compared)</h3>
          <div className="run-info-details">
            <span className="run-test-name">{rightRun.test?.name || 'Unknown Test'}</span>
            <span className={`status-badge badge-${rightRun.status}`}>{rightRun.status}</span>
            <span className="run-date">
              {rightRun.completedAt ? new Date(rightRun.completedAt).toLocaleString() : 'Not completed'}
            </span>
          </div>
        </div>
      </div>

      <div className="comparison-summary">
        <div className="summary-item improved">
          <span className="summary-value">{summary.improved}</span>
          <span className="summary-label">Improved</span>
        </div>
        <div className="summary-item regressed">
          <span className="summary-value">{summary.regressed}</span>
          <span className="summary-label">Regressed</span>
        </div>
        <div className="summary-item unchanged">
          <span className="summary-value">{summary.unchanged}</span>
          <span className="summary-label">Unchanged</span>
        </div>
        {summary.newQuestions > 0 && (
          <div className="summary-item new">
            <span className="summary-value">{summary.newQuestions}</span>
            <span className="summary-label">New</span>
          </div>
        )}
        {summary.removedQuestions > 0 && (
          <div className="summary-item removed">
            <span className="summary-value">{summary.removedQuestions}</span>
            <span className="summary-label">Removed</span>
          </div>
        )}
        {summary.accuracyDelta !== null && (
          <div className={`summary-item accuracy ${summary.accuracyDelta >= 0 ? 'positive' : 'negative'}`}>
            <span className="summary-value">
              {summary.accuracyDelta >= 0 ? '+' : ''}{summary.accuracyDelta}%
            </span>
            <span className="summary-label">Accuracy</span>
          </div>
        )}
        {summary.avgLatencyDelta !== null && (
          <div className={`summary-item latency ${summary.avgLatencyDelta <= 0 ? 'positive' : 'negative'}`}>
            <span className="summary-value">
              {summary.avgLatencyDelta >= 0 ? '+' : ''}{summary.avgLatencyDelta}ms
            </span>
            <span className="summary-label">Avg Latency</span>
          </div>
        )}
      </div>

      <div className="comparison-filters">
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

      <div className="comparison-results">
        {filteredResults.length === 0 ? (
          <div className="no-results">No results match the selected filter</div>
        ) : (
          filteredResults.map((result, index) => (
            <ComparisonResultRow key={`${result.question}-${index}`} result={result} />
          ))
        )}
      </div>
    </div>
  );
}
