import React, { useEffect, useState, useCallback } from 'react';
import {
  StoredTest,
  StoredAccessToken,
  StoredQuestionSet,
  StoredFlowConfig,
} from '@agent-eval/shared';
import { AgentEvalClient } from '@agent-eval/api-client';
import { Modal, ConfirmDialog } from './Modal';
import { Pagination } from './Pagination';
import { SearchableSelect } from './SearchableSelect';

const apiClient = new AgentEvalClient();

export function TestsPage() {
  const [tests, setTests] = useState<StoredTest[]>([]);
  const [accessTokens, setAccessTokens] = useState<StoredAccessToken[]>([]);
  const [questionSets, setQuestionSets] = useState<StoredQuestionSet[]>([]);
  const [flowConfigs, setFlowConfigs] = useState<StoredFlowConfig[]>([]);
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
  // Map of testId -> runId for running tests
  const [runningTests, setRunningTests] = useState<Map<string, string>>(new Map());
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    id: string | null;
  }>({ open: false, id: null });
  const [cancelConfirm, setCancelConfirm] = useState<{
    open: boolean;
    testId: string | null;
  }>({ open: false, testId: null });

  // Filter and pagination state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterQuestionSet, setFilterQuestionSet] = useState('');
  const [filterFlowId, setFilterFlowId] = useState('');
  const [filterMultiStep, setFilterMultiStep] = useState<'all' | 'yes' | 'no'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Load supporting data (tokens, questions, configs) once
  useEffect(() => {
    const loadSupportingData = async () => {
      const [tokensRes, questionsRes, flowConfigsRes] = await Promise.all([
        apiClient.getAccessTokens(),
        apiClient.getQuestionSets(),
        apiClient.getFlowConfigs(),
      ]);

      if (tokensRes.success && tokensRes.data) {
        setAccessTokens(tokensRes.data);
      }
      if (questionsRes.success && questionsRes.data) {
        setQuestionSets(questionsRes.data);
      }
      if (flowConfigsRes.success && flowConfigsRes.data) {
        setFlowConfigs(flowConfigsRes.data);
      }
    };
    loadSupportingData();
  }, []);

  // Load tests with filters and pagination
  const loadTests = useCallback(async () => {
    setIsLoading(true);
    const response = await apiClient.getTests({
      page: currentPage,
      limit: itemsPerPage,
      search: searchTerm || undefined,
      questionSetId: filterQuestionSet || undefined,
      multiStep: filterMultiStep === 'all' ? undefined : filterMultiStep === 'yes',
      flowId: filterFlowId || undefined,
    });

    if (response.success && response.data) {
      setTests(response.data.data);
      setTotalItems(response.data.pagination.total);
      setTotalPages(response.data.pagination.totalPages);
    }
    setIsLoading(false);
  }, [currentPage, itemsPerPage, searchTerm, filterQuestionSet, filterMultiStep, filterFlowId]);

  // Reload tests when filters or page changes
  useEffect(() => {
    loadTests();
  }, [loadTests]);

  // Reset to page 1 when filters change
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleQuestionSetFilterChange = (value: string) => {
    setFilterQuestionSet(value);
    setCurrentPage(1);
  };

  const handleFlowIdFilterChange = (value: string) => {
    setFilterFlowId(value);
    setCurrentPage(1);
  };

  const handleMultiStepFilterChange = (value: 'all' | 'yes' | 'no') => {
    setFilterMultiStep(value);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilterQuestionSet('');
    setFilterFlowId('');
    setFilterMultiStep('all');
    setCurrentPage(1);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
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
      loadTests();
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
    loadTests();
  };

  const handleRun = async (testId: string) => {
    // Prevent double-clicking the same test
    if (runningTests.has(testId)) return;

    setRunningTests((prev) => new Map(prev).set(testId, ''));

    const token = apiClient.getAuthToken();
    if (!token) {
      setRunningTests((prev) => {
        const next = new Map(prev);
        next.delete(testId);
        return next;
      });
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:3001/api/tests/${testId}/run`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'text/event-stream',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

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
              // Track run ID when run starts
              if (data.type === 'run_start' && data.runId) {
                setRunningTests((prev) => new Map(prev).set(testId, data.runId));
              }
              if (data.type === 'complete' || data.type === 'error' || data.type === 'canceled') {
                setRunningTests((prev) => {
                  const next = new Map(prev);
                  next.delete(testId);
                  return next;
                });
                loadTests();
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch {
      setRunningTests((prev) => {
        const next = new Map(prev);
        next.delete(testId);
        return next;
      });
    }
  };

  const handleCancel = async () => {
    if (!cancelConfirm.testId) return;
    const runId = runningTests.get(cancelConfirm.testId);
    if (runId) {
      await apiClient.cancelRun(runId);
      setRunningTests((prev) => {
        const next = new Map(prev);
        next.delete(cancelConfirm.testId!);
        return next;
      });
      loadTests();
    }
    setCancelConfirm({ open: false, testId: null });
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

  const hasActiveFilters = searchTerm || filterQuestionSet || filterFlowId || filterMultiStep !== 'all';

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
            <label>Flow Configuration</label>
            <select
              onChange={(e) => {
                const config = flowConfigs.find((fc) => fc.id === e.target.value);
                if (config) {
                  setFormData({
                    ...formData,
                    flowId: config.flowId,
                    basePath: config.basePath || '',
                  });
                }
              }}
              value=""
            >
              <option value="">Select from saved configs...</option>
              {flowConfigs.map((fc) => (
                <option key={fc.id} value={fc.id}>
                  {fc.name} ({fc.flowId})
                </option>
              ))}
            </select>
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

      <div className="filter-bar">
        <div className="filter-group">
          <input
            type="text"
            placeholder="Search tests..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="filter-input"
          />
        </div>
        <div className="filter-group">
          <SearchableSelect
            value={filterQuestionSet}
            onChange={handleQuestionSetFilterChange}
            options={questionSets.map((qs) => ({
              value: qs.id,
              label: qs.name,
              sublabel: `${qs.questions.length} questions`,
            }))}
            placeholder="Search question sets..."
            allOptionLabel="All Question Sets"
          />
        </div>
        <div className="filter-group">
          <input
            type="text"
            placeholder="Filter by Flow ID..."
            value={filterFlowId}
            onChange={(e) => handleFlowIdFilterChange(e.target.value)}
            className="filter-input"
          />
        </div>
        <div className="filter-group">
          <select
            value={filterMultiStep}
            onChange={(e) => handleMultiStepFilterChange(e.target.value as 'all' | 'yes' | 'no')}
            className="filter-select"
          >
            <option value="all">All Types</option>
            <option value="yes">Multi-step Only</option>
            <option value="no">Single-step Only</option>
          </select>
        </div>
        {hasActiveFilters && (
          <button
            className="filter-clear-btn"
            onClick={clearFilters}
          >
            Clear Filters
          </button>
        )}
      </div>

      <div className="tests-list">
        {isLoading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <span className="loading-text">Loading tests...</span>
          </div>
        ) : totalItems === 0 && !hasActiveFilters ? (
          <div className="empty-state">
            <p>No tests created yet</p>
            <p className="empty-hint">
              Create a test to define your flow configuration and question set
            </p>
          </div>
        ) : totalItems === 0 && hasActiveFilters ? (
          <div className="empty-state">
            <p>No tests match your filters</p>
            <p className="empty-hint">
              Try adjusting your search or filter criteria
            </p>
          </div>
        ) : (
          tests.map((test) => (
            <div key={test.id} className="test-card">
              <div className="test-header">
                <h3>{test.name}</h3>
                <div className="test-actions">
                  {runningTests.has(test.id) ? (
                    <button
                      className="cancel-btn"
                      onClick={() => setCancelConfirm({ open: true, testId: test.id })}
                      disabled={!runningTests.get(test.id)}
                      title={runningTests.get(test.id) ? 'Cancel run' : 'Starting...'}
                    >
                      {runningTests.get(test.id) ? 'Cancel' : 'Starting...'}
                    </button>
                  ) : (
                    <button
                      className="run-btn"
                      onClick={() => handleRun(test.id)}
                      disabled={!test.questionSetId}
                      title={!test.questionSetId ? 'No question set configured' : 'Run test'}
                    >
                      Run
                    </button>
                  )}
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

      {totalPages > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={totalItems}
          itemsPerPage={itemsPerPage}
          onItemsPerPageChange={handleItemsPerPageChange}
          itemName="tests"
        />
      )}

      <ConfirmDialog
        isOpen={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, id: null })}
        onConfirm={handleDelete}
        title="Delete Test"
        message="Are you sure you want to delete this test? This will not delete associated runs."
        confirmText="Delete"
        variant="danger"
      />

      <ConfirmDialog
        isOpen={cancelConfirm.open}
        onClose={() => setCancelConfirm({ open: false, testId: null })}
        onConfirm={handleCancel}
        title="Cancel Run"
        message="Are you sure you want to cancel this run? Progress will be saved but the run will be marked as failed."
        confirmText="Cancel Run"
        variant="danger"
      />
    </div>
  );
}
