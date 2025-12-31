import React, { useEffect, useState } from 'react';
import { EvaluationSession } from '@agent-eval/shared';
import { AgentEvalClient } from '@agent-eval/api-client';
import { useAppContext } from '../context/AppContext';
import { Modal, ConfirmDialog } from './Modal';

const apiClient = new AgentEvalClient();

export function SessionsPanel() {
  const { state, setResults, setCurrentSession, setConfig } = useAppContext();
  const [sessions, setSessions] = useState<EvaluationSession[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [flowName, setFlowName] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  const resetSaveDialog = () => {
    setFlowName('');
    setShowSaveDialog(false);
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    const response = await apiClient.getSessions();
    if (response.success && response.data) {
      setSessions(response.data);
    }
  };

  const handleLoadSession = async (session: EvaluationSession) => {
    setCurrentSession(session);
    setResults(session.results);
    setConfig(session.flowConfig);
  };

  const handleSaveSession = async () => {
    if (!flowName.trim()) return;

    setSaving(true);

    // Always create a new session (backend ignores any passed ID)
    const session: EvaluationSession = {
      id: '',
      flowName,
      flowConfig: state.config,
      results: state.results,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const response = await apiClient.saveSession(flowName, session);
    if (response.success) {
      resetSaveDialog();
      loadSessions();
    }
    setSaving(false);
  };

  const handleExport = async (sessionId: string, format: 'json' | 'csv') => {
    const response = await apiClient.exportSession(sessionId, format);
    if (response.success && response.data) {
      const blob = new Blob([response.data], {
        type: format === 'json' ? 'application/json' : 'text/csv',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `evaluation-${sessionId}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleDeleteSession = async () => {
    if (!deleteConfirm.id) return;
    await apiClient.deleteSession(deleteConfirm.id);
    setDeleteConfirm({ open: false, id: null });
    loadSessions();
  };

  const handleExportCurrent = (format: 'json' | 'csv') => {
    const data =
      format === 'json'
        ? JSON.stringify(
            {
              config: state.config,
              results: state.results,
              exportedAt: new Date().toISOString(),
            },
            null,
            2
          )
        : convertToCSV(state.results);

    const blob = new Blob([data], {
      type: format === 'json' ? 'application/json' : 'text/csv',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `evaluation-export.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const convertToCSV = (results: typeof state.results) => {
    const headers = [
      'question',
      'answer',
      'expectedAnswer',
      'isCorrect',
      'llmJudgeScore',
      'humanEvaluation',
    ];
    const rows = results.map((r) =>
      [
        `"${r.question.replace(/"/g, '""')}"`,
        `"${r.answer.replace(/"/g, '""')}"`,
        `"${(r.expectedAnswer || '').replace(/"/g, '""')}"`,
        r.isCorrect ?? '',
        r.llmJudgeScore ?? '',
        r.humanEvaluation ?? '',
      ].join(',')
    );
    return [headers.join(','), ...rows].join('\n');
  };

  return (
    <div className="sessions-panel">
      <h2>Sessions</h2>

      {state.results.length > 0 && (
        <div className="current-session-actions">
          <button onClick={() => setShowSaveDialog(true)}>Save Session</button>
          <button onClick={() => handleExportCurrent('json')}>Export JSON</button>
          <button onClick={() => handleExportCurrent('csv')}>Export CSV</button>
        </div>
      )}

      <Modal
        isOpen={showSaveDialog}
        onClose={resetSaveDialog}
        onSubmit={handleSaveSession}
        title="Save Session"
        footer={
          <>
            <button className="modal-btn cancel" onClick={resetSaveDialog}>
              Cancel
            </button>
            <button
              className="modal-btn confirm"
              onClick={handleSaveSession}
              disabled={saving || !flowName.trim()}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </>
        }
      >
        <form className="modal-form" onSubmit={(e) => { e.preventDefault(); handleSaveSession(); }}>
          <div className="form-group">
            <label>Session Name</label>
            <input
              type="text"
              placeholder="Enter session name"
              value={flowName}
              onChange={(e) => setFlowName(e.target.value)}
              autoFocus
            />
          </div>
        </form>
      </Modal>

      <div className="sessions-list">
        <h3>Saved Sessions</h3>
        {sessions.length === 0 ? (
          <p>No saved sessions</p>
        ) : (
          sessions.map((session) => (
            <div key={session.id} className="session-item">
              <div className="session-info">
                <strong>{session.flowName}</strong>
                <span>{new Date(session.updatedAt).toLocaleDateString()}</span>
                <span>{session.results.length} results</span>
              </div>
              <div className="session-actions">
                <button onClick={() => handleLoadSession(session)}>Load</button>
                <button onClick={() => handleExport(session.id, 'json')}>JSON</button>
                <button onClick={() => handleExport(session.id, 'csv')}>CSV</button>
                <button onClick={() => setDeleteConfirm({ open: true, id: session.id })} className="delete-btn">Delete</button>
              </div>
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        isOpen={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, id: null })}
        onConfirm={handleDeleteSession}
        title="Delete Session"
        message="Are you sure you want to delete this session? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
