import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  StoredEvaluator,
  StoredAccessToken,
  SortDirection,
  EvaluatorsSortField,
} from '@agent-eval/shared';
import { Modal, ConfirmDialog } from '../../components/Modal';
import { useNotification } from '../../context/NotificationContext';
import { FilterBar, FilterDefinition, SortOption, ActiveFilter } from '../../components/FilterBar';
import { Pagination } from '../../components/Pagination';
import { apiClient } from '../../apiClient';
import styles from './settings.module.scss';

const DEFAULT_SYSTEM_PROMPT = `You are an expert evaluator assessing AI-generated answers.

Evaluate the answer based on accuracy, completeness, and relevance to the question.
If an expected answer is provided, compare the AI's answer against it.

You MUST respond with ONLY a JSON object in this exact format, no other text:
{"score": <0-100>, "isCorrect": <true/false>, "reasoning": "<brief explanation>"}

Scoring guide:
- 80-100: Correct — answer is accurate and complete
- 40-79: Partial — answer is partially correct or incomplete
- 0-39: Incorrect — answer is wrong or irrelevant`;

const MODEL_SUGGESTIONS: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini'],
  anthropic: ['claude-sonnet-4-5-20250929', 'claude-haiku-4-5-20251001'],
};

export function EvaluatorsManager() {
  const { showNotification } = useNotification();
  const [evaluators, setEvaluators] = useState<StoredEvaluator[]>([]);
  const [credentials, setCredentials] = useState<StoredAccessToken[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    accessTokenId: '',
    model: '',
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    reasoningModel: false,
    reasoningEffort: 'medium',
  });
  const [loading, setLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    id: string | null;
  }>({ open: false, id: null });
  const [formSubmitAttempted, setFormSubmitAttempted] = useState(false);

  // Filter and pagination state
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [sortBy, setSortBy] = useState<EvaluatorsSortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      accessTokenId: '',
      model: '',
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      reasoningModel: false,
      reasoningEffort: 'medium',
    });
    setShowForm(false);
    setEditingId(null);
    setFormSubmitAttempted(false);
  };

  const loadEvaluators = useCallback(async () => {
    setIsLoading(true);
    const response = await apiClient.getEvaluators({
      page: currentPage,
      limit: itemsPerPage,
      search: searchTerm || undefined,
      sortBy,
      sortDirection,
    });
    if (response.success && response.data) {
      setEvaluators(response.data.data);
      setTotalItems(response.data.pagination.total);
      setTotalPages(response.data.pagination.totalPages);
    }
    setIsLoading(false);
  }, [currentPage, itemsPerPage, searchTerm, sortBy, sortDirection]);

  const loadCredentials = useCallback(async () => {
    // Load only OpenAI/Anthropic credentials for evaluators
    const [openaiRes, anthropicRes] = await Promise.all([
      apiClient.getAccessTokens({ type: 'openai', limit: 100 }),
      apiClient.getAccessTokens({ type: 'anthropic', limit: 100 }),
    ]);
    const tokens: StoredAccessToken[] = [];
    if (openaiRes.success && openaiRes.data) tokens.push(...openaiRes.data.data);
    if (anthropicRes.success && anthropicRes.data) tokens.push(...anthropicRes.data.data);
    setCredentials(tokens);
  }, []);

  useEffect(() => {
    loadEvaluators();
  }, [loadEvaluators]);

  useEffect(() => {
    loadCredentials();
  }, [loadCredentials]);

  // Derive model suggestions from selected credential
  const selectedCredential = credentials.find((c) => c.id === formData.accessTokenId);
  const modelSuggestions = selectedCredential
    ? MODEL_SUGGESTIONS[selectedCredential.type] || []
    : [];

  const filterDefinitions: FilterDefinition[] = useMemo(() => [], []);
  const sortOptions: SortOption[] = [
    { value: 'createdAt', label: 'Date Created' },
    { value: 'updatedAt', label: 'Date Updated' },
    { value: 'name', label: 'Name' },
  ];
  const activeFilters: ActiveFilter[] = useMemo(() => [], []);

  const handleFilterAdd = () => setCurrentPage(1);
  const handleFilterRemove = () => setCurrentPage(1);
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };
  const clearFilters = () => {
    setSearchTerm('');
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
    if (!formData.name || !formData.accessTokenId || !formData.model || !formData.systemPrompt)
      return;

    setLoading(true);

    if (editingId) {
      const response = await apiClient.updateEvaluator(editingId, {
        name: formData.name,
        description: formData.description || undefined,
        accessTokenId: formData.accessTokenId,
        model: formData.model,
        systemPrompt: formData.systemPrompt,
        reasoningModel: formData.reasoningModel,
        reasoningEffort: formData.reasoningModel ? formData.reasoningEffort : undefined,
      });
      if (response.success) {
        resetForm();
        loadEvaluators();
        showNotification('success', 'Evaluator updated successfully');
      } else {
        showNotification('error', response.error || 'Failed to update evaluator');
      }
    } else {
      const response = await apiClient.createEvaluator({
        name: formData.name,
        description: formData.description || undefined,
        accessTokenId: formData.accessTokenId,
        model: formData.model,
        systemPrompt: formData.systemPrompt,
        reasoningModel: formData.reasoningModel,
        reasoningEffort: formData.reasoningModel ? formData.reasoningEffort : undefined,
      });
      if (response.success) {
        resetForm();
        loadEvaluators();
        showNotification('success', 'Evaluator created successfully');
      } else {
        showNotification('error', response.error || 'Failed to create evaluator');
      }
    }
    setLoading(false);
  };

  const handleEdit = async (evaluatorId: string) => {
    const response = await apiClient.getEvaluator(evaluatorId);
    if (response.success && response.data) {
      const ev = response.data;
      setFormData({
        name: ev.name,
        description: ev.description || '',
        accessTokenId: ev.accessTokenId || '',
        model: ev.model,
        systemPrompt: ev.systemPrompt,
        reasoningModel: ev.reasoningModel || false,
        reasoningEffort: ev.reasoningEffort || 'medium',
      });
      setEditingId(evaluatorId);
      setShowForm(true);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm.id) return;
    const response = await apiClient.deleteEvaluator(deleteConfirm.id);
    setDeleteConfirm({ open: false, id: null });
    if (response.success) {
      loadEvaluators();
      showNotification('success', 'Evaluator deleted successfully');
    } else {
      showNotification('error', response.error || 'Failed to delete evaluator');
    }
  };

  const hasNoEvaluators = totalItems === 0 && !searchTerm;

  return (
    <div className={styles.section}>
      <div className={styles.managerHeader}>
        <h3>Evaluators</h3>
        <button onClick={() => setShowForm(true)}>+ Add Evaluator</button>
      </div>

      {!hasNoEvaluators && (
        <FilterBar
          filters={filterDefinitions}
          activeFilters={activeFilters}
          onFilterAdd={handleFilterAdd}
          onFilterRemove={handleFilterRemove}
          onClearAll={clearFilters}
          searchValue={searchTerm}
          onSearchChange={handleSearchChange}
          searchPlaceholder="Search evaluators..."
          sortOptions={sortOptions}
          sortValue={sortBy}
          sortDirection={sortDirection}
          onSortChange={(value) => setSortBy(value as EvaluatorsSortField)}
          onSortDirectionChange={setSortDirection}
        />
      )}

      <Modal
        isOpen={showForm}
        onClose={resetForm}
        onSubmit={handleSubmit}
        title={editingId ? 'Edit Evaluator' : 'Add Evaluator'}
        footer={
          <>
            <button className="modal-btn cancel" onClick={resetForm}>
              Cancel
            </button>
            <button className="modal-btn confirm" onClick={() => handleSubmit()} disabled={loading}>
              {loading ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Name *</label>
            <input
              type="text"
              placeholder="Enter evaluator name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={formSubmitAttempted && !formData.name ? 'input-error' : ''}
            />
            {formSubmitAttempted && !formData.name && (
              <span className="field-error">Name is required</span>
            )}
          </div>
          <div className="form-group">
            <label>Description (optional)</label>
            <input
              type="text"
              placeholder="Enter description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Credential *</label>
            <select
              value={formData.accessTokenId}
              onChange={(e) =>
                setFormData({ ...formData, accessTokenId: e.target.value, model: '' })
              }
              className={formSubmitAttempted && !formData.accessTokenId ? 'input-error' : ''}
            >
              <option value="">Select a credential...</option>
              {credentials.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.type === 'openai' ? 'OpenAI' : 'Anthropic'})
                </option>
              ))}
            </select>
            {credentials.length === 0 && (
              <span className="form-hint">
                No OpenAI or Anthropic credentials found. Add one in the Credentials tab first.
              </span>
            )}
            {formSubmitAttempted && !formData.accessTokenId && (
              <span className="field-error">Credential is required</span>
            )}
          </div>
          <div className="form-group">
            <label>Model *</label>
            <input
              type="text"
              placeholder="Enter model name"
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              list="model-suggestions"
              className={formSubmitAttempted && !formData.model ? 'input-error' : ''}
            />
            {modelSuggestions.length > 0 && (
              <datalist id="model-suggestions">
                {modelSuggestions.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            )}
            {formSubmitAttempted && !formData.model && (
              <span className="field-error">Model is required</span>
            )}
          </div>
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.reasoningModel}
                onChange={(e) => setFormData({ ...formData, reasoningModel: e.target.checked })}
              />
              Reasoning model
            </label>
          </div>
          {formData.reasoningModel && (
            <div className="form-group">
              <label>Reasoning Effort</label>
              <select
                value={formData.reasoningEffort}
                onChange={(e) => setFormData({ ...formData, reasoningEffort: e.target.value })}
              >
                <option value="none">None</option>
                <option value="minimal">Minimal</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          )}
          <div className="form-group">
            <label>System Prompt *</label>
            <textarea
              rows={10}
              placeholder="Enter evaluation system prompt"
              value={formData.systemPrompt}
              onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
              className={formSubmitAttempted && !formData.systemPrompt ? 'input-error' : ''}
            />
            {formSubmitAttempted && !formData.systemPrompt && (
              <span className="field-error">System prompt is required</span>
            )}
          </div>
        </form>
      </Modal>

      <div className={styles.managerList}>
        {isLoading ? (
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner}></div>
            <span className={styles.loadingText}>Loading evaluators...</span>
          </div>
        ) : evaluators.length === 0 ? (
          <p className={styles.emptyMessage}>
            {searchTerm ? 'No evaluators match your search' : 'No evaluators configured'}
          </p>
        ) : (
          evaluators.map((evaluator) => (
            <div key={evaluator.id} className={styles.managerItem}>
              <div className={styles.itemInfo}>
                <strong>{evaluator.name}</strong>
                {evaluator.accessTokenName && (
                  <span className={styles.methodBadge}>{evaluator.accessTokenName}</span>
                )}
                <span className={styles.methodBadge}>{evaluator.model}</span>
                {evaluator.description && (
                  <span className={styles.itemDesc}>{evaluator.description}</span>
                )}
              </div>
              <div className={styles.itemActions}>
                <button onClick={() => handleEdit(evaluator.id)} className={styles.editBtn}>
                  Edit
                </button>
                <button
                  onClick={() => setDeleteConfirm({ open: true, id: evaluator.id })}
                  className={styles.deleteBtn}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {!isLoading && totalItems > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={totalItems}
          itemsPerPage={itemsPerPage}
          onItemsPerPageChange={handleItemsPerPageChange}
          itemName="evaluators"
        />
      )}

      <ConfirmDialog
        isOpen={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, id: null })}
        onConfirm={handleDelete}
        title="Delete Evaluator"
        message="Are you sure you want to delete this evaluator? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
