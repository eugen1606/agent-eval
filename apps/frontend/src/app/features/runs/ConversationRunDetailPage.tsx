import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  StoredRun,
  StoredConversation,
  ConversationRunStats,
  ConversationHumanEvaluation,
  ConversationStatus,
} from '@agent-eval/shared';
import { ConfirmDialog } from '../../components/Modal';
import { useNotification } from '../../context/NotificationContext';
import { apiClient } from '../../apiClient';
import styles from './runs.module.scss';

interface ConversationRunDetailPageProps {
  run: StoredRun;
  onReload: (showLoading?: boolean) => void;
}

const STATUS_ICONS: Record<ConversationStatus, string> = {
  running: '\u25B6',
  completed: '\u2714',
  goal_achieved: '\u2714',
  goal_not_achieved: '\u2718',
  max_turns_reached: '\u26A0',
  error: '\u26A0',
};

const STATUS_LABELS: Record<ConversationStatus, string> = {
  running: 'Running',
  completed: 'Completed',
  goal_achieved: 'Goal Achieved',
  goal_not_achieved: 'Goal Not Achieved',
  max_turns_reached: 'Max Turns',
  error: 'Error',
};

const EVAL_LABELS: Record<ConversationHumanEvaluation, string> = {
  good: 'Good',
  acceptable: 'Acceptable',
  poor: 'Poor',
};

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function ConversationRunDetailPage({ run, onReload }: ConversationRunDetailPageProps) {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [conversations, setConversations] = useState<StoredConversation[]>([]);
  const [stats, setStats] = useState<ConversationRunStats | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(true);
  const [showReRunConfirm, setShowReRunConfirm] = useState(false);
  const [rerunningScenarioId, setRerunningScenarioId] = useState<string | null>(null);
  const [evalNotes, setEvalNotes] = useState<string>('');
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const isRunning = run.status === 'running' || run.status === 'pending';

  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;

  const loadConversations = useCallback(async () => {
    const [convRes, statsRes] = await Promise.all([
      apiClient.getConversations(run.id),
      apiClient.getConversationRunStats(run.id),
    ]);
    if (convRes.success && convRes.data) {
      setConversations(convRes.data);
      if (!selectedIdRef.current && convRes.data.length > 0) {
        setSelectedId(convRes.data[0].id);
      }
    }
    if (statsRes.success && statsRes.data) {
      setStats(statsRes.data);
    }
    setLoading(false);
  }, [run.id]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Auto-refresh while run is active
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(async () => {
      onReload(false);
      const [convRes, statsRes] = await Promise.all([
        apiClient.getConversations(run.id),
        apiClient.getConversationRunStats(run.id),
      ]);
      if (convRes.success && convRes.data) {
        setConversations(convRes.data);
        if (!selectedIdRef.current && convRes.data.length > 0) {
          setSelectedId(convRes.data[0].id);
        }
      }
      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isRunning, run.id, onReload]);

  // Scroll to bottom of transcript when turns update for running conversations
  useEffect(() => {
    const selected = conversations.find((c) => c.id === selectedId);
    if (selected?.status === 'running' && transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversations, selectedId]);

  // Sync eval notes when selected conversation changes
  useEffect(() => {
    const selected = conversations.find((c) => c.id === selectedId);
    setEvalNotes(selected?.humanEvaluationNotes || '');
  }, [selectedId, conversations]);

  const selectedConversation = conversations.find((c) => c.id === selectedId) || null;

  // Keyboard shortcuts for evaluation (1=Good, 2=Acceptable, 3=Poor)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!selectedConversation || selectedConversation.status === 'running' || saving) return;

      if (e.key === '1') handleEvaluate('good');
      else if (e.key === '2') handleEvaluate('acceptable');
      else if (e.key === '3') handleEvaluate('poor');
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedConversation, saving]);

  const handleEvaluate = async (evaluation: ConversationHumanEvaluation) => {
    if (!selectedConversation) return;
    setSaving(true);
    const res = await apiClient.evaluateConversation(run.id, selectedConversation.id, {
      humanEvaluation: evaluation,
      humanEvaluationNotes: evalNotes || undefined,
    });
    if (res.success) {
      showNotification('success', 'Evaluation saved');
      await loadConversations();
    } else {
      showNotification('error', res.error || 'Failed to save evaluation');
    }
    setSaving(false);
  };

  const handleSaveNotes = async () => {
    if (!selectedConversation || !selectedConversation.humanEvaluation) return;
    setSaving(true);
    const res = await apiClient.evaluateConversation(run.id, selectedConversation.id, {
      humanEvaluation: selectedConversation.humanEvaluation,
      humanEvaluationNotes: evalNotes || undefined,
    });
    if (res.success) {
      showNotification('success', 'Notes saved');
      await loadConversations();
    } else {
      showNotification('error', res.error || 'Failed to save notes');
    }
    setSaving(false);
  };

  const handleStatusChange = async (newStatus: 'goal_achieved' | 'goal_not_achieved') => {
    if (!selectedConversation) return;
    setSaving(true);
    const res = await apiClient.evaluateConversation(run.id, selectedConversation.id, {
      humanEvaluation: selectedConversation.humanEvaluation || 'good',
      humanEvaluationNotes: selectedConversation.humanEvaluationNotes || undefined,
      status: newStatus,
    });
    if (res.success) {
      showNotification('success', 'Goal status updated');
      await loadConversations();
    } else {
      showNotification('error', res.error || 'Failed to update goal status');
    }
    setSaving(false);
  };

  const handleRerunScenario = async () => {
    if (!rerunningScenarioId) return;
    setShowReRunConfirm(false);
    const conv = conversations.find((c) => c.id === rerunningScenarioId);
    if (!conv) return;

    const res = await apiClient.rerunConversation(run.id, conv.id);
    if (res.success) {
      showNotification('success', 'Scenario re-run started');
      onReload();
      await loadConversations();
    } else {
      showNotification('error', res.error || 'Failed to re-run scenario');
    }
    setRerunningScenarioId(null);
  };

  const handleReRun = async (isRetry = false) => {
    if (!run.testId) return;

    const csrfToken = apiClient.getAuthToken();
    if (!csrfToken) {
      showNotification('error', 'Not authenticated. Please log in again.');
      return;
    }

    try {
      const response = await fetch(`${apiClient.getApiUrl()}/tests/${run.testId}/run`, {
        method: 'POST',
        headers: {
          'X-CSRF-Token': csrfToken,
          Accept: 'text/event-stream',
        },
        credentials: 'include',
      });

      if (response.status === 401 && !isRetry) {
        const refreshResponse = await fetch(`${apiClient.getApiUrl()}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
        if (refreshResponse.ok) {
          return handleReRun(true);
        } else {
          throw new Error('Session expired. Please log in again.');
        }
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorMessage;
        } catch {
          // Use default
        }
        throw new Error(errorMessage);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let newRunId = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'run_start' && data.runId) {
                newRunId = data.runId;
              }
              if (data.type === 'complete' || data.type === 'run:complete') {
                if (newRunId) {
                  navigate(`/runs/${newRunId}`);
                }
              }
              if (data.type === 'error' || data.type === 'run:error') {
                showNotification('error', data.message || data.errorMessage || 'Re-run failed');
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (error) {
      showNotification('error', error instanceof Error ? error.message : 'Failed to re-run test');
    }
  };

  const statusBadgeMap: Record<string, string> = {
    pending: styles.badgePending,
    running: styles.badgeRunning,
    completed: styles.badgeCompleted,
    failed: styles.badgeFailed,
    canceled: styles.badgeCanceled,
  };

  if (loading) {
    return (
      <div className={styles.runDetailPage}>
        <div className={styles.loadingState}>Loading conversations...</div>
      </div>
    );
  }

  return (
    <div className={styles.convRunPage}>
      {/* Header */}
      <div className={styles.runDetailHeader}>
        <div className={styles.headerTopRow}>
          <button className={styles.backBtn} onClick={() => navigate('/runs')}>
            &larr; Back to Runs
          </button>
          <div className={styles.runTitle}>
            <h2>{run.test?.name || 'Unknown Test'}</h2>
            <span className={`${styles.statusBadge} ${statusBadgeMap[run.status] || ''}`}>
              {run.status}
            </span>
            <span className={styles.convTypeBadge}>Conversation</span>
          </div>
        </div>
        <div className={styles.headerActions}>
          {run.testId && (
            <button
              className={styles.reRunBtn}
              onClick={() => handleReRun()}
              disabled={isRunning}
            >
              Re-Run Test
            </button>
          )}
        </div>
      </div>

      {/* Stats Bar */}
      {stats && !isRunning && (
        <div className={styles.convStatsBar}>
          <div className={styles.convStatItem}>
            <span className={styles.convStatValue}>{stats.totalScenarios}</span>
            <span className={styles.convStatLabel}>Total</span>
          </div>
          <div className={`${styles.convStatItem} ${styles.goalAchieved}`}>
            <span className={styles.convStatValue}>{stats.goalAchievedCount}</span>
            <span className={styles.convStatLabel}>Goal Achieved</span>
          </div>
          <div className={`${styles.convStatItem} ${styles.goalNotAchieved}`}>
            <span className={styles.convStatValue}>{stats.goalNotAchievedCount}</span>
            <span className={styles.convStatLabel}>Not Achieved</span>
          </div>
          <div className={`${styles.convStatItem} ${styles.maxTurns}`}>
            <span className={styles.convStatValue}>{stats.maxTurnsReachedCount}</span>
            <span className={styles.convStatLabel}>Max Turns</span>
          </div>
          {stats.errorCount > 0 && (
            <div className={`${styles.convStatItem} ${styles.convErrors}`}>
              <span className={styles.convStatValue}>{stats.errorCount}</span>
              <span className={styles.convStatLabel}>Errors</span>
            </div>
          )}
          <div className={`${styles.convStatItem} ${styles.avgTurns}`}>
            <span className={styles.convStatValue}>{stats.averageTurns.toFixed(1)}</span>
            <span className={styles.convStatLabel}>Avg Turns</span>
          </div>
          <div className={`${styles.convStatItem} ${styles.evalStat}`}>
            <span className={styles.convStatValue}>
              {stats.evaluations.good + stats.evaluations.acceptable + stats.evaluations.poor}/
              {stats.totalScenarios}
            </span>
            <span className={styles.convStatLabel}>Evaluated</span>
          </div>
        </div>
      )}

      {/* Running Progress */}
      {isRunning && (
        <div className={styles.convProgress}>
          <div className={styles.loadingSpinner}></div>
          <span>
            Running scenarios... {run.completedScenarios || 0}/{run.totalScenarios || '?'}
          </span>
        </div>
      )}

      {/* Main Layout: Sidebar + Transcript */}
      {conversations.length === 0 ? (
        <div className={styles.emptyState}>
          <p>{isRunning ? 'Waiting for scenarios to start...' : 'No conversations found'}</p>
        </div>
      ) : (
        <div className={styles.convLayout}>
          {/* Scenario Sidebar */}
          <div className={styles.convSidebar}>
            <div className={styles.convSidebarHeader}>
              <h3>Scenarios</h3>
            </div>
            <div className={styles.convScenarioList}>
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  className={`${styles.convScenarioItem} ${conv.id === selectedId ? styles.active : ''} ${styles['convStatus_' + conv.status]}`}
                  onClick={() => setSelectedId(conv.id)}
                >
                  <span className={styles.convScenarioIcon}>
                    {conv.status === 'running' ? (
                      <span className={styles.convSpinner}></span>
                    ) : (
                      STATUS_ICONS[conv.status] || '\u2022'
                    )}
                  </span>
                  <div className={styles.convScenarioInfo}>
                    <span className={styles.convScenarioName}>
                      {conv.scenario?.name || `Scenario ${conv.id.slice(0, 8)}`}
                    </span>
                    <span className={styles.convScenarioMeta}>
                      {STATUS_LABELS[conv.status]} &middot; {conv.totalTurns} turns
                    </span>
                  </div>
                  {conv.humanEvaluation && (
                    <span className={`${styles.convEvalBadge} ${styles['convEval_' + conv.humanEvaluation]}`}>
                      {EVAL_LABELS[conv.humanEvaluation]}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Transcript Panel */}
          <div className={styles.convTranscriptPanel}>
            {selectedConversation ? (
              <>
                {/* Conversation Header */}
                <div className={styles.convTranscriptHeader}>
                  <div className={styles.convTranscriptTitle}>
                    <h3>{selectedConversation.scenario?.name || 'Conversation'}</h3>
                    <span
                      className={`${styles.convStatusBadge} ${styles['convStatus_' + selectedConversation.status]}`}
                    >
                      {STATUS_LABELS[selectedConversation.status]}
                    </span>
                  </div>
                  <div className={styles.convTranscriptMeta}>
                    {selectedConversation.scenario?.persona?.name && (
                      <span>Persona: {selectedConversation.scenario.persona.name}</span>
                    )}
                    <span>{selectedConversation.totalTurns} turns</span>
                    {selectedConversation.status !== 'running' && (
                      <span className={styles.convGoalToggle}>
                        <button
                          className={`${styles.convGoalBtn} ${selectedConversation.status === 'goal_achieved' ? `${styles.active} ${styles.goalAchievedBtn}` : ''}`}
                          onClick={() => handleStatusChange('goal_achieved')}
                          disabled={saving || selectedConversation.status === 'goal_achieved'}
                        >
                          Goal Achieved
                        </button>
                        <button
                          className={`${styles.convGoalBtn} ${selectedConversation.status === 'goal_not_achieved' ? `${styles.active} ${styles.goalNotAchievedBtn}` : ''}`}
                          onClick={() => handleStatusChange('goal_not_achieved')}
                          disabled={saving || selectedConversation.status === 'goal_not_achieved'}
                        >
                          Goal Not Achieved
                        </button>
                      </span>
                    )}
                    {selectedConversation.status !== 'running' && (
                      <button
                        className={styles.convRerunBtn}
                        onClick={() => {
                          setRerunningScenarioId(selectedConversation.id);
                          setShowReRunConfirm(true);
                        }}
                      >
                        Re-run
                      </button>
                    )}
                  </div>
                  {selectedConversation.scenario?.goal && (
                    <div className={styles.convGoal}>
                      <strong>Goal:</strong> {selectedConversation.scenario.goal}
                    </div>
                  )}
                </div>

                {/* Chat Transcript */}
                <div className={styles.convTranscript}>
                  {selectedConversation.turns.length === 0 ? (
                    <div className={styles.convEmptyTranscript}>
                      {selectedConversation.status === 'running'
                        ? 'Waiting for first message...'
                        : 'No messages in this conversation'}
                    </div>
                  ) : (
                    selectedConversation.turns.map((turn) => (
                      <div
                        key={turn.index}
                        className={`${styles.convTurn} ${styles['convTurn_' + turn.role]}`}
                      >
                        <div className={styles.convTurnHeader}>
                          <span className={styles.convTurnRole}>
                            {turn.role === 'user' ? 'Simulated User' : 'Agent'}
                          </span>
                          {turn.timestamp && (
                            <span className={styles.convTurnTime}>
                              {formatTimestamp(turn.timestamp)}
                            </span>
                          )}
                        </div>
                        <div className={styles.convTurnMessage}>{turn.message}</div>
                      </div>
                    ))
                  )}
                  <div ref={transcriptEndRef} />
                </div>

                {/* End Reason */}
                {selectedConversation.endReason && (
                  <div className={styles.convEndReason}>
                    <strong>End reason:</strong> {selectedConversation.endReason}
                  </div>
                )}

                {/* Summary Panel */}
                {selectedConversation.summary && (
                  <div className={styles.convSummaryPanel}>
                    <button
                      className={styles.convSummaryToggle}
                      onClick={() => setSummaryExpanded(!summaryExpanded)}
                    >
                      <span>{summaryExpanded ? '\u25BC' : '\u25B6'} Summary</span>
                    </button>
                    {summaryExpanded && (
                      <div className={styles.convSummaryContent}>
                        {selectedConversation.summary}
                      </div>
                    )}
                  </div>
                )}

                {/* Evaluation Controls */}
                {selectedConversation.status !== 'running' && (
                  <div className={styles.convEvalSection}>
                    <div className={styles.convEvalButtons}>
                      <span>Evaluation:</span>
                      <button
                        className={`${styles.convEvalBtn} ${selectedConversation.humanEvaluation === 'good' ? `${styles.active} ${styles.good}` : ''}`}
                        onClick={() => handleEvaluate('good')}
                        disabled={saving}
                      >
                        Good
                      </button>
                      <button
                        className={`${styles.convEvalBtn} ${selectedConversation.humanEvaluation === 'acceptable' ? `${styles.active} ${styles.acceptable}` : ''}`}
                        onClick={() => handleEvaluate('acceptable')}
                        disabled={saving}
                      >
                        Acceptable
                      </button>
                      <button
                        className={`${styles.convEvalBtn} ${selectedConversation.humanEvaluation === 'poor' ? `${styles.active} ${styles.poor}` : ''}`}
                        onClick={() => handleEvaluate('poor')}
                        disabled={saving}
                      >
                        Poor
                      </button>
                    </div>
                    <div className={styles.convEvalNotes}>
                      <input
                        type="text"
                        placeholder="Add evaluation notes (optional)"
                        value={evalNotes}
                        onChange={(e) => setEvalNotes(e.target.value)}
                        onBlur={() => {
                          if (
                            selectedConversation.humanEvaluation &&
                            evalNotes !== (selectedConversation.humanEvaluationNotes || '')
                          ) {
                            handleSaveNotes();
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && selectedConversation.humanEvaluation) {
                            handleSaveNotes();
                          }
                        }}
                      />
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className={styles.convEmptyTranscript}>
                Select a scenario from the sidebar to view its transcript
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={showReRunConfirm}
        onClose={() => {
          setShowReRunConfirm(false);
          setRerunningScenarioId(null);
        }}
        onConfirm={handleRerunScenario}
        title="Re-run Scenario"
        message="This will create a new conversation for this scenario within the current run. The existing conversation will be kept."
        confirmText="Re-run"
        variant="info"
      />
    </div>
  );
}
