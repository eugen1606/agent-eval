import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  StoredTest,
  StoredAccessToken,
  StoredQuestionSet,
  StoredFlowConfig,
  StoredWebhook,
  StoredTag,
  TestsSortField,
  SortDirection,
} from '@agent-eval/shared';
import { Modal, ConfirmDialog } from './Modal';
import { Pagination } from './Pagination';
import {
  FilterBar,
  FilterDefinition,
  SortOption,
  ActiveFilter,
} from './FilterBar';
import { SearchableSelect } from './SearchableSelect';
import { useNotification } from '../context/NotificationContext';
import { apiClient } from '../apiClient';

export function TestsPage() {
  const { showNotification } = useNotification();
  const [tests, setTests] = useState<StoredTest[]>([]);
  const [accessTokens, setAccessTokens] = useState<StoredAccessToken[]>([]);
  const [questionSets, setQuestionSets] = useState<StoredQuestionSet[]>([]);
  const [flowConfigs, setFlowConfigs] = useState<StoredFlowConfig[]>([]);
  const [webhooks, setWebhooks] = useState<StoredWebhook[]>([]);
  const [tags, setTags] = useState<StoredTag[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    flowConfigId: '',
    accessTokenId: '',
    questionSetId: '',
    multiStepEvaluation: false,
    webhookId: '',
    tagIds: [] as string[],
  });
  const [loading, setLoading] = useState(false);
  // Map of testId -> runId for running tests
  const [runningTests, setRunningTests] = useState<Map<string, string>>(
    new Map(),
  );
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    id: string | null;
  }>({ open: false, id: null });
  const [cancelConfirm, setCancelConfirm] = useState<{
    open: boolean;
    testId: string | null;
  }>({ open: false, testId: null });
  const [formSubmitAttempted, setFormSubmitAttempted] = useState(false);

  // Filter and pagination state
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Sorting state
  const [sortBy, setSortBy] = useState<TestsSortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Load supporting data (tokens, questions, configs, webhooks, tags) once
  useEffect(() => {
    const loadSupportingData = async () => {
      const [tokensRes, questionsRes, flowConfigsRes, webhooksRes, tagsRes] =
        await Promise.all([
          apiClient.getAccessTokens(),
          apiClient.getQuestionSets(),
          apiClient.getFlowConfigs(),
          apiClient.getWebhooks(),
          apiClient.getTags({ limit: 100 }),
        ]);

      if (tokensRes.success && tokensRes.data) {
        setAccessTokens(tokensRes.data.data);
      }
      if (questionsRes.success && questionsRes.data) {
        setQuestionSets(questionsRes.data.data);
      }
      if (flowConfigsRes.success && flowConfigsRes.data) {
        setFlowConfigs(flowConfigsRes.data.data);
      }
      if (webhooksRes.success && webhooksRes.data) {
        setWebhooks(webhooksRes.data.data);
      }
      if (tagsRes.success && tagsRes.data) {
        setTags(tagsRes.data.data);
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
      questionSetId: filters.questionSet || undefined,
      multiStep: filters.multiStep ? filters.multiStep === 'yes' : undefined,
      flowConfigId: filters.flowConfig || undefined,
      tagIds: filters.tag ? [filters.tag] : undefined,
      sortBy,
      sortDirection,
    });

    if (response.success && response.data) {
      setTests(response.data.data);
      setTotalItems(response.data.pagination.total);
      setTotalPages(response.data.pagination.totalPages);
    }
    setIsLoading(false);
  }, [currentPage, itemsPerPage, searchTerm, filters, sortBy, sortDirection]);

  // Reload tests when filters or page changes
  useEffect(() => {
    loadTests();
  }, [loadTests]);

  // Filter definitions for FilterBar
  const filterDefinitions: FilterDefinition[] = useMemo(
    () => [
      {
        key: 'questionSet',
        label: 'Question Set',
        type: 'select',
        options: questionSets.map((qs) => ({
          value: qs.id,
          label: qs.name,
          sublabel: `${qs.questions.length} questions`,
        })),
      },
      {
        key: 'flowConfig',
        label: 'Flow Config',
        type: 'select',
        options: flowConfigs.map((fc) => ({
          value: fc.id,
          label: fc.name,
          sublabel: fc.flowId,
        })),
      },
      {
        key: 'tag',
        label: 'Tag',
        type: 'select',
        options: tags.map((tag) => ({
          value: tag.id,
          label: tag.name,
        })),
      },
      {
        key: 'multiStep',
        label: 'Multi-step',
        type: 'select',
        options: [
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' },
        ],
      },
    ],
    [questionSets, flowConfigs, tags],
  );

  const sortOptions: SortOption[] = [
    { value: 'createdAt', label: 'Date Created' },
    { value: 'updatedAt', label: 'Date Updated' },
    { value: 'name', label: 'Name' },
  ];

  // Build active filters array for FilterBar
  const activeFilters: ActiveFilter[] = useMemo(() => {
    const result: ActiveFilter[] = [];
    if (filters.questionSet) {
      const qs = questionSets.find((q) => q.id === filters.questionSet);
      result.push({
        key: 'questionSet',
        value: filters.questionSet,
        label: 'Question Set',
        displayValue: qs?.name || 'Unknown',
      });
    }
    if (filters.flowConfig) {
      const fc = flowConfigs.find((f) => f.id === filters.flowConfig);
      result.push({
        key: 'flowConfig',
        value: filters.flowConfig,
        label: 'Flow Config',
        displayValue: fc?.name || 'Unknown',
      });
    }
    if (filters.tag) {
      const tag = tags.find((t) => t.id === filters.tag);
      result.push({
        key: 'tag',
        value: filters.tag,
        label: 'Tag',
        displayValue: tag?.name || 'Unknown',
      });
    }
    if (filters.multiStep) {
      result.push({
        key: 'multiStep',
        value: filters.multiStep,
        label: 'Multi-step',
        displayValue: filters.multiStep === 'yes' ? 'Yes' : 'No',
      });
    }
    return result;
  }, [filters, questionSets, flowConfigs, tags]);

  const handleFilterAdd = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const handleFilterRemove = (key: string) => {
    setFilters((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setCurrentPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilters({});
    setSortBy('createdAt');
    setSortDirection('desc');
    setCurrentPage(1);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setFormSubmitAttempted(true);
    if (!formData.name || !formData.flowConfigId) return;

    const selectedFlowConfig = flowConfigs.find(
      (fc) => fc.id === formData.flowConfigId,
    );
    if (!selectedFlowConfig) return;

    setLoading(true);

    const data = {
      name: formData.name,
      description: formData.description || undefined,
      flowConfigId: formData.flowConfigId,
      // Use null to explicitly clear optional FK fields (undefined is stripped by JSON.stringify)
      accessTokenId: formData.accessTokenId || null,
      questionSetId: formData.questionSetId || null,
      multiStepEvaluation: formData.multiStepEvaluation,
      webhookId: formData.webhookId || null,
      tagIds: formData.tagIds,
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
      showNotification(
        'success',
        editingId ? 'Test updated successfully' : 'Test created successfully',
      );
    } else {
      showNotification('error', response.error || 'Failed to save test');
    }
    setLoading(false);
  };

  const handleEdit = (test: StoredTest) => {
    setEditingId(test.id);
    setFormData({
      name: test.name,
      description: test.description || '',
      flowConfigId: test.flowConfigId || '',
      accessTokenId: test.accessTokenId || '',
      questionSetId: test.questionSetId || '',
      multiStepEvaluation: test.multiStepEvaluation,
      webhookId: test.webhookId || '',
      tagIds: test.tags?.map((t) => t.id) || [],
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      flowConfigId: '',
      accessTokenId: '',
      questionSetId: '',
      multiStepEvaluation: false,
      webhookId: '',
      tagIds: [],
    });
    setShowForm(false);
    setEditingId(null);
    setFormSubmitAttempted(false);
  };

  const handleDelete = async () => {
    if (!deleteConfirm.id) return;
    const response = await apiClient.deleteTest(deleteConfirm.id);
    setDeleteConfirm({ open: false, id: null });
    if (response.success) {
      loadTests();
      showNotification('success', 'Test deleted successfully');
    } else {
      showNotification('error', response.error || 'Failed to delete test');
    }
  };

  const handleRun = async (testId: string, isRetry = false) => {
    // Prevent double-clicking the same test
    if (runningTests.has(testId)) return;

    setRunningTests((prev) => new Map(prev).set(testId, ''));

    const csrfToken = apiClient.getAuthToken();
    if (!csrfToken) {
      setRunningTests((prev) => {
        const next = new Map(prev);
        next.delete(testId);
        return next;
      });
      showNotification('error', 'Not authenticated. Please log in again.');
      return;
    }

    try {
      const response = await fetch(
        `${apiClient.getApiUrl()}/tests/${testId}/run`,
        {
          method: 'POST',
          headers: {
            'X-CSRF-Token': csrfToken,
            Accept: 'text/event-stream',
          },
          credentials: 'include', // Send cookies for auth
        },
      );

      // Handle 401 - try to refresh token once
      if (response.status === 401 && !isRetry) {
        // Try refreshing the token
        const refreshResponse = await fetch(
          `${apiClient.getApiUrl()}/auth/refresh`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
          },
        );

        if (refreshResponse.ok) {
          // Clear running state and retry
          setRunningTests((prev) => {
            const next = new Map(prev);
            next.delete(testId);
            return next;
          });
          return handleRun(testId, true);
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
          // Use default error message
        }
        throw new Error(errorMessage);
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
                setRunningTests((prev) =>
                  new Map(prev).set(testId, data.runId),
                );
              }
              if (
                data.type === 'complete' ||
                data.type === 'error' ||
                data.type === 'canceled'
              ) {
                setRunningTests((prev) => {
                  const next = new Map(prev);
                  next.delete(testId);
                  return next;
                });
                if (data.type === 'error') {
                  showNotification('error', data.message || 'Test run failed');
                }
                loadTests();
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (error) {
      setRunningTests((prev) => {
        const next = new Map(prev);
        next.delete(testId);
        return next;
      });
      showNotification(
        'error',
        error instanceof Error ? error.message : 'Failed to run test',
      );
    }
  };

  const handleCancel = async () => {
    if (!cancelConfirm.testId) return;
    const runId = runningTests.get(cancelConfirm.testId);
    if (runId) {
      const response = await apiClient.cancelRun(runId);
      setRunningTests((prev) => {
        const next = new Map(prev);
        next.delete(cancelConfirm.testId!);
        return next;
      });
      if (response.success) {
        loadTests();
        showNotification('success', 'Test run canceled');
      } else {
        showNotification('error', response.error || 'Failed to cancel run');
      }
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

  const getWebhookName = (id?: string) => {
    if (!id) return 'None';
    const webhook = webhooks.find((w) => w.id === id);
    return webhook?.name || 'Unknown';
  };


  const hasActiveFilters = searchTerm || Object.keys(filters).length > 0;

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
              disabled={loading}
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
              className={
                formSubmitAttempted && !formData.name ? 'input-error' : ''
              }
            />
            {formSubmitAttempted && !formData.name && (
              <span className="field-error">Test name is required</span>
            )}
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
            <label>Flow Configuration *</label>
            <SearchableSelect
              value={formData.flowConfigId}
              onChange={(value) =>
                setFormData({ ...formData, flowConfigId: value })
              }
              options={flowConfigs.map((fc) => ({
                value: fc.id,
                label: fc.name,
                sublabel: `${fc.flowId}${fc.basePath ? ` - ${fc.basePath}` : ''}`,
              }))}
              placeholder="Search flow configs..."
              allOptionLabel="Select flow configuration..."
            />
            {formSubmitAttempted && !formData.flowConfigId && (
              <span className="field-error">Flow configuration is required</span>
            )}
            {formData.flowConfigId && (() => {
              const selectedConfig = flowConfigs.find(
                (fc) => fc.id === formData.flowConfigId,
              );
              return selectedConfig ? (
                <span className="form-hint">
                  Flow ID: {selectedConfig.flowId}
                  {selectedConfig.basePath && ` | Base URL: ${selectedConfig.basePath}`}
                </span>
              ) : null;
            })()}
          </div>
          <div className="form-group">
            <label>Access Token</label>
            <SearchableSelect
              value={formData.accessTokenId}
              onChange={(value) =>
                setFormData({ ...formData, accessTokenId: value })
              }
              options={accessTokens.map((token) => ({
                value: token.id,
                label: token.name,
              }))}
              placeholder="Search tokens..."
              allOptionLabel="Select access token..."
            />
          </div>
          <div className="form-group">
            <label>Question Set</label>
            <SearchableSelect
              value={formData.questionSetId}
              onChange={(value) =>
                setFormData({ ...formData, questionSetId: value })
              }
              options={questionSets.map((qs) => ({
                value: qs.id,
                label: qs.name,
                sublabel: `${qs.questions.length} questions`,
              }))}
              placeholder="Search question sets..."
              allOptionLabel="Select question set..."
            />
          </div>
          <div className="form-group">
            <label>Webhook</label>
            <SearchableSelect
              value={formData.webhookId}
              onChange={(value) =>
                setFormData({ ...formData, webhookId: value })
              }
              options={webhooks
                .filter((w) => w.enabled)
                .map((webhook) => ({
                  value: webhook.id,
                  label: webhook.name,
                }))}
              placeholder="Search webhooks..."
              allOptionLabel="No webhook"
            />
            <span className="form-hint">
              Trigger webhook on run events (running, completed, failed,
              evaluated)
            </span>
          </div>
          <div className="form-group">
            <label>Tags</label>
            <div className="tag-select">
              {tags.map((tag) => (
                <label key={tag.id} className="tag-option">
                  <input
                    type="checkbox"
                    checked={formData.tagIds.includes(tag.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({
                          ...formData,
                          tagIds: [...formData.tagIds, tag.id],
                        });
                      } else {
                        setFormData({
                          ...formData,
                          tagIds: formData.tagIds.filter((id) => id !== tag.id),
                        });
                      }
                    }}
                  />
                  <span
                    className="tag-chip"
                    style={{ backgroundColor: tag.color || '#3B82F6' }}
                  >
                    {tag.name}
                  </span>
                </label>
              ))}
              {tags.length === 0 && (
                <span className="form-hint">No tags created yet. Create tags in Settings.</span>
              )}
            </div>
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

      <FilterBar
        filters={filterDefinitions}
        activeFilters={activeFilters}
        onFilterAdd={handleFilterAdd}
        onFilterRemove={handleFilterRemove}
        onClearAll={clearFilters}
        searchValue={searchTerm}
        onSearchChange={handleSearchChange}
        searchPlaceholder="Search tests..."
        sortOptions={sortOptions}
        sortValue={sortBy}
        sortDirection={sortDirection}
        onSortChange={(value) => {
          setSortBy(value as TestsSortField);
          setCurrentPage(1);
        }}
        onSortDirectionChange={(dir) => {
          setSortDirection(dir);
          setCurrentPage(1);
        }}
      />

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
                      onClick={() =>
                        setCancelConfirm({ open: true, testId: test.id })
                      }
                      disabled={!runningTests.get(test.id)}
                      title={
                        runningTests.get(test.id) ? 'Cancel run' : 'Starting...'
                      }
                    >
                      {runningTests.get(test.id) ? 'Cancel' : 'Starting...'}
                    </button>
                  ) : (
                    <button
                      className="run-btn"
                      onClick={() => handleRun(test.id)}
                      disabled={!test.questionSetId || !test.flowConfigId}
                      title={
                        !test.flowConfigId
                          ? 'No flow config - edit test to add one'
                          : !test.questionSetId
                          ? 'No question set configured'
                          : 'Run test'
                      }
                    >
                      Run
                    </button>
                  )}
                  <button className="edit-btn" onClick={() => handleEdit(test)}>
                    Edit
                  </button>
                  <button
                    className="delete-btn"
                    onClick={() =>
                      setDeleteConfirm({ open: true, id: test.id })
                    }
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
                  <span className="detail-label">Flow Config:</span>
                  <span className="detail-value">
                    {test.flowConfig?.name || (
                      <span className="text-muted">Not configured</span>
                    )}
                  </span>
                </div>
                {test.flowConfig?.basePath && (
                  <div className="detail-row">
                    <span className="detail-label">Base URL:</span>
                    <span className="detail-value">{test.flowConfig.basePath}</span>
                  </div>
                )}
                <div className="detail-row">
                  <span className="detail-label">Questions:</span>
                  <span className="detail-value">
                    {getQuestionSetName(test.questionSetId)}
                    {test.questionSet &&
                      ` (${test.questionSet.questions.length})`}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Token:</span>
                  <span className="detail-value">
                    {getAccessTokenName(test.accessTokenId)}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Webhook:</span>
                  <span className="detail-value">
                    {getWebhookName(test.webhookId)}
                  </span>
                </div>
                {test.tags && test.tags.length > 0 && (
                  <div className="detail-row">
                    <span className="detail-label">Tags:</span>
                    <div className="tag-chips">
                      {test.tags.map((tag) => (
                        <span
                          key={tag.id}
                          className="tag-chip"
                          style={{ backgroundColor: tag.color || '#3B82F6' }}
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
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
