import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  StoredTest,
  StoredAccessToken,
  StoredQuestionSet,
} from '@agent-eval/shared';
import { AgentEvalClient } from '@agent-eval/api-client';
import { Modal, ConfirmDialog } from './Modal';

const apiClient = new AgentEvalClient();

export function TestsPage() {
  const navigate = useNavigate();
  const [tests, setTests] = useState<StoredTest[]>([]);
  const [accessTokens, setAccessTokens] = useState<StoredAccessToken[]>([]);
  const [questionSets, setQuestionSets] = useState<StoredQuestionSet[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    flowId: '',
    basePath: '',
    accessTokenId: '',
    questionSetId: '',
    multiStepEvaluation: false,
  });
  const [loading, setLoading] = useState(false);
  const [runningTestId, setRunningTestId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    id: string | null;
  }>({ open: false, id: null });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [testsRes, tokensRes, questionsRes] = await Promise.all([
      apiClient.getTests(),
      apiClient.getAccessTokens(),
      apiClient.getQuestionSets(),
    ]);

    if (testsRes.success && testsRes.data) {
      setTests(testsRes.data);
    }
    if (tokensRes.success && tokensRes.data) {
      setAccessTokens(tokensRes.data);
    }
    if (questionsRes.success && questionsRes.data) {
      setQuestionSets(questionsRes.data);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!formData.name || !formData.flowId || !formData.basePath) return;

    setLoading(true);

    const data = {
      name: formData.name,
      description: formData.description || undefined,
      flowId: formData.flowId,
      basePath: formData.basePath,
      accessTokenId: formData.accessTokenId || undefined,
      questionSetId: formData.questionSetId || undefined,
      multiStepEvaluation: formData.multiStepEvaluation,
    };

    let response;
    if (editingId) {
      response = await apiClient.updateTest(editingId, data);
    } else {
      response = await apiClient.createTest(data);
    }

    if (response.success) {
      resetForm();
      loadData();
    }
    setLoading(false);
  };

  const handleEdit = (test: StoredTest) => {
    setEditingId(test.id);
    setFormData({
      name: test.name,
      description: test.description || '',
      flowId: test.flowId,
      basePath: test.basePath,
      accessTokenId: test.accessTokenId || '',
      questionSetId: test.questionSetId || '',
      multiStepEvaluation: test.multiStepEvaluation,
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      flowId: '',
      basePath: '',
      accessTokenId: '',
      questionSetId: '',
      multiStepEvaluation: false,
    });
    setShowForm(false);
    setEditingId(null);
  };

  const handleDelete = async () => {
    if (!deleteConfirm.id) return;
    await apiClient.deleteTest(deleteConfirm.id);
    setDeleteConfirm({ open: false, id: null });
    loadData();
  };

  const handleRun = async (testId: string) => {
    setRunningTestId(testId);
    // Navigate to runs page with the test running
    navigate(`/runs?runTest=${testId}`);
  };

  const getQuestionSetName = (id?: string) => {
    if (!id) return 'None';
    const qs = questionSets.find((q) => q.id === id);
    return qs?.name || 'Unknown';
  };

  const getAccessTokenName = (id?: string) => {
    if (!id) return 'None';
    const token = accessTokens.find((t) => t.id === id);
    return token?.name || 'Unknown';
  };

  return (
    <div className="tests-page">
      <div className="page-header">
        <h2>Tests</h2>
        <button className="primary-btn" onClick={() => setShowForm(true)}>
          + Create Test
        </button>
      </div>

      <Modal
        isOpen={showForm}
        onClose={resetForm}
        onSubmit={handleSubmit}
        title={editingId ? 'Edit Test' : 'Create Test'}
        footer={
          <>
            <button className="modal-btn cancel" onClick={resetForm}>
              Cancel
            </button>
            <button
              className="modal-btn confirm"
              onClick={() => handleSubmit()}
              disabled={
                loading ||
                !formData.name ||
                !formData.flowId ||
                !formData.basePath
              }
            >
              {loading ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Test Name *</label>
            <input
              type="text"
              placeholder="e.g., Customer Support Flow Test"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
            />
          </div>
          <div className="form-group">
            <label>Description</label>
            <input
              type="text"
              placeholder="Optional description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
            />
          </div>
          <div className="form-group">
            <label>Base URL *</label>
            <input
              type="text"
              placeholder="e.g., https://api.example.com"
              value={formData.basePath}
              onChange={(e) =>
                setFormData({ ...formData, basePath: e.target.value })
              }
            />
          </div>
          <div className="form-group">
            <label>Flow ID *</label>
            <input
              type="text"
              placeholder="e.g., flow_abc123"
              value={formData.flowId}
              onChange={(e) =>
                setFormData({ ...formData, flowId: e.target.value })
              }
            />
          </div>
          <div className="form-group">
            <label>Access Token</label>
            <select
              value={formData.accessTokenId}
              onChange={(e) =>
                setFormData({ ...formData, accessTokenId: e.target.value })
              }
            >
              <option value="">Select access token...</option>
              {accessTokens.map((token) => (
                <option key={token.id} value={token.id}>
                  {token.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Question Set</label>
            <select
              value={formData.questionSetId}
              onChange={(e) =>
                setFormData({ ...formData, questionSetId: e.target.value })
              }
            >
              <option value="">Select question set...</option>
              {questionSets.map((qs) => (
                <option key={qs.id} value={qs.id}>
                  {qs.name} ({qs.questions.length} questions)
                </option>
              ))}
            </select>
          </div>
          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={formData.multiStepEvaluation}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    multiStepEvaluation: e.target.checked,
                  })
                }
              />
              Multi-step evaluation (shared session)
            </label>
          </div>
        </form>
      </Modal>

      <div className="tests-list">
        {tests.length === 0 ? (
          <div className="empty-state">
            <p>No tests created yet</p>
            <p className="empty-hint">
              Create a test to define your flow configuration and question set
            </p>
          </div>
        ) : (
          tests.map((test) => (
            <div key={test.id} className="test-card">
              <div className="test-header">
                <h3>{test.name}</h3>
                <div className="test-actions">
                  <button
                    className="run-btn"
                    onClick={() => handleRun(test.id)}
                    disabled={!test.questionSetId || runningTestId === test.id}
                    title={
                      !test.questionSetId ? 'No question set configured' : 'Run test'
                    }
                  >
                    {runningTestId === test.id ? 'Starting...' : 'Run'}
                  </button>
                  <button className="edit-btn" onClick={() => handleEdit(test)}>
                    Edit
                  </button>
                  <button
                    className="delete-btn"
                    onClick={() => setDeleteConfirm({ open: true, id: test.id })}
                  >
                    Delete
                  </button>
                </div>
              </div>
              {test.description && (
                <p className="test-description">{test.description}</p>
              )}
              <div className="test-details">
                <div className="detail-row">
                  <span className="detail-label">Flow:</span>
                  <span className="detail-value">{test.flowId}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Base URL:</span>
                  <span className="detail-value">{test.basePath}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Questions:</span>
                  <span className="detail-value">
                    {getQuestionSetName(test.questionSetId)}
                    {test.questionSet && ` (${test.questionSet.questions.length})`}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Token:</span>
                  <span className="detail-value">
                    {getAccessTokenName(test.accessTokenId)}
                  </span>
                </div>
                {test.multiStepEvaluation && (
                  <div className="detail-row">
                    <span className="badge">Multi-step</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        isOpen={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, id: null })}
        onConfirm={handleDelete}
        title="Delete Test"
        message="Are you sure you want to delete this test? This will not delete associated runs."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
