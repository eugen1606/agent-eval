import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  StoredQuestionSet,
  StoredTest,
  SortDirection,
  QuestionSetsSortField,
} from '@agent-eval/shared';
import { Modal, ConfirmDialog, FilterBar, FilterDefinition, SortOption, ActiveFilter, Pagination } from '@agent-eval/ui';
import { useNotification } from '../../context/NotificationContext';
import { apiClient } from '../../apiClient';
import { downloadExportBundle, generateExportFilename, ImportModal } from '../../shared/exportImportUtils';
import { JsonEditor } from '../../components/JsonEditor';
import styles from './settings.module.scss';

interface Props {
  onSelect?: (questionSet: StoredQuestionSet) => void;
  selectable?: boolean;
}

export function QuestionSetsManager({ onSelect, selectable }: Props) {
  const { showNotification } = useNotification();
  const [questionSets, setQuestionSets] = useState<StoredQuestionSet[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    questionsJson: '',
    description: '',
  });
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    id: string | null;
    dependentTests: StoredTest[];
  }>({ open: false, id: null, dependentTests: [] });
  const [formSubmitAttempted, setFormSubmitAttempted] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // Filter and pagination state
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [sortBy, setSortBy] = useState<QuestionSetsSortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const qsRequestIdRef = useRef(0);
  const loadQuestionSets = useCallback(async () => {
    const requestId = ++qsRequestIdRef.current;
    setIsLoading(true);
    const response = await apiClient.getQuestionSets({
      page: currentPage,
      limit: itemsPerPage,
      search: searchTerm || undefined,
      sortBy,
      sortDirection,
    });
    if (requestId !== qsRequestIdRef.current) return;
    if (response.success && response.data) {
      setQuestionSets(response.data.data);
      setTotalItems(response.data.pagination.total);
      setTotalPages(response.data.pagination.totalPages);
    }
    setIsLoading(false);
  }, [currentPage, itemsPerPage, searchTerm, sortBy, sortDirection]);

  useEffect(() => {
    loadQuestionSets();
  }, [loadQuestionSets]);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // Filter definitions (empty for question sets - only search and sort)
  const filterDefinitions: FilterDefinition[] = useMemo(() => [], []);

  // Sort options
  const sortOptions: SortOption[] = [
    { value: 'createdAt', label: 'Date Created' },
    { value: 'updatedAt', label: 'Date Updated' },
    { value: 'name', label: 'Name' },
  ];

  // Active filters (empty for question sets)
  const activeFilters: ActiveFilter[] = useMemo(() => [], []);

  // Handlers
  const handleFilterAdd = () => {
    setCurrentPage(1);
  };

  const handleFilterRemove = () => {
    setCurrentPage(1);
  };

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
    if (!formData.name || !formData.questionsJson) return;

    try {
      const questions = JSON.parse(formData.questionsJson);
      if (!Array.isArray(questions)) {
        setJsonError('Questions must be an array');
        return;
      }

      setLoading(true);

      let response;
      if (editingId) {
        response = await apiClient.updateQuestionSet(editingId, {
          name: formData.name,
          questions,
          description: formData.description || undefined,
        });
      } else {
        response = await apiClient.createQuestionSet({
          name: formData.name,
          questions,
          description: formData.description || undefined,
        });
      }

      if (response.success) {
        resetForm();
        loadQuestionSets();
        showNotification(
          'success',
          editingId
            ? 'Question set updated successfully'
            : 'Question set created successfully'
        );
      } else {
        showNotification(
          'error',
          response.error || 'Failed to save question set'
        );
      }
    } catch {
      setJsonError('Invalid JSON format');
    }
    setLoading(false);
  };

  const handleEdit = (qs: StoredQuestionSet) => {
    setEditingId(qs.id);
    setFormData({
      name: qs.name,
      questionsJson: JSON.stringify(qs.questions, null, 2),
      description: qs.description || '',
    });
    setShowForm(true);
    setJsonError(null);
  };

  const resetForm = () => {
    setFormData({ name: '', questionsJson: '', description: '' });
    setShowForm(false);
    setEditingId(null);
    setJsonError(null);
    setFormSubmitAttempted(false);
  };

  const handleDeleteClick = async (questionSetId: string) => {
    // Fetch tests that use this question set
    const response = await apiClient.getTests({ questionSetId, limit: 100 });
    const dependentTests =
      response.success && response.data ? response.data.data : [];
    setDeleteConfirm({ open: true, id: questionSetId, dependentTests });
  };

  const handleDelete = async () => {
    if (!deleteConfirm.id) return;
    const response = await apiClient.deleteQuestionSet(deleteConfirm.id);
    setDeleteConfirm({ open: false, id: null, dependentTests: [] });
    if (response.success) {
      loadQuestionSets();
      showNotification('success', 'Question set deleted successfully');
    } else {
      showNotification(
        'error',
        response.error || 'Failed to delete question set'
      );
    }
  };

  const handleExport = async (qs: StoredQuestionSet) => {
    const response = await apiClient.exportConfig({
      types: ['questionSets'],
      questionSetIds: [qs.id],
    });

    if (response.success && response.data) {
      downloadExportBundle(
        response.data,
        generateExportFilename('question-set', qs.name)
      );
      showNotification('success', `Exported "${qs.name}"`);
    } else {
      showNotification('error', response.error || 'Export failed');
    }
  };

  const hasNoQuestionSets = totalItems === 0 && !searchTerm;

  return (
    <div className={styles.section}>
      <div className={styles.managerHeader}>
        <h3>Question Sets</h3>
        <div className={styles.headerActions}>
          <button onClick={() => setShowImportModal(true)} className={styles.importBtn}>
            Import
          </button>
          <button onClick={() => setShowForm(true)}>+ Add Question Set</button>
        </div>
      </div>

      {!hasNoQuestionSets && (
        <FilterBar
          filters={filterDefinitions}
          activeFilters={activeFilters}
          onFilterAdd={handleFilterAdd}
          onFilterRemove={handleFilterRemove}
          onClearAll={clearFilters}
          searchValue={searchTerm}
          onSearchChange={handleSearchChange}
          searchPlaceholder="Search question sets..."
          sortOptions={sortOptions}
          sortValue={sortBy}
          sortDirection={sortDirection}
          onSortChange={(value) => setSortBy(value as QuestionSetsSortField)}
          onSortDirectionChange={setSortDirection}
        />
      )}

      <Modal
        isOpen={showForm}
        onClose={resetForm}
        onSubmit={handleSubmit}
        title={editingId ? 'Edit Question Set' : 'Add Question Set'}
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
              {loading ? 'Saving...' : editingId ? 'Update' : 'Save'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Question Set Name *</label>
            <input
              type="text"
              placeholder="Enter question set name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className={
                formSubmitAttempted && !formData.name ? 'input-error' : ''
              }
            />
            {formSubmitAttempted && !formData.name && (
              <span className="field-error">Question set name is required</span>
            )}
          </div>
          <div className="form-group">
            <label>Questions (JSON) *</label>
            <JsonEditor
              value={formData.questionsJson}
              onChange={(val) => {
                setFormData({ ...formData, questionsJson: val });
                setJsonError(null);
              }}
              minHeight="150px"
              placeholder={`[
  { "question": "What is 2+2?", "expectedAnswer": "4", "inputVariables": { "lang": "en" } },
  { "question": "Greet the user", "inputVariables": { "user": { "name": "Alice", "role": "admin" } } },
  { "question": "Capital of France?" }
]`}
              className={
                formSubmitAttempted && !formData.questionsJson
                  ? 'input-error'
                  : ''
              }
            />
            {jsonError && <span className="error">{jsonError}</span>}
            {formSubmitAttempted && !formData.questionsJson && !jsonError && (
              <span className="field-error">Questions JSON is required</span>
            )}
          </div>
          <div className="form-group">
            <label>Description (optional)</label>
            <input
              type="text"
              placeholder="Enter description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
            />
          </div>
        </form>
      </Modal>

      <div className={styles.managerList}>
        {isLoading ? (
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner}></div>
            <span className={styles.loadingText}>Loading question sets...</span>
          </div>
        ) : questionSets.length === 0 ? (
          <p className={styles.emptyMessage}>
            {searchTerm
              ? 'No question sets match your search'
              : 'No question sets stored'}
          </p>
        ) : (
          questionSets.map((qs) => (
            <div key={qs.id} className={styles.managerItem}>
              <div className={styles.itemInfo}>
                <strong>{qs.name}</strong>
                <span className={styles.itemMeta}>
                  {qs.questions.length} questions
                </span>
                {qs.description && (
                  <span className={styles.itemDesc}>{qs.description}</span>
                )}
              </div>
              <div className={styles.itemActions}>
                {selectable && onSelect && (
                  <button onClick={() => onSelect(qs)} className={styles.selectBtn}>
                    Select
                  </button>
                )}
                <button onClick={() => handleExport(qs)} className={styles.exportBtn}>
                  Export
                </button>
                <button onClick={() => handleEdit(qs)} className={styles.editBtn}>
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteClick(qs.id)}
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
          itemName="question sets"
        />
      )}

      <ConfirmDialog
        isOpen={deleteConfirm.open}
        onClose={() =>
          setDeleteConfirm({ open: false, id: null, dependentTests: [] })
        }
        onConfirm={handleDelete}
        title="Delete Question Set"
        message={
          deleteConfirm.dependentTests.length > 0
            ? `This question set is used by the following tests:\n\n${deleteConfirm.dependentTests.map((t) => `• ${t.name}`).join('\n')}\n\nDeleting this question set will remove it from these tests. This action cannot be undone.`
            : 'Are you sure you want to delete this question set? This action cannot be undone.'
        }
        confirmText="Delete"
        variant="danger"
      />

      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => {
          setShowImportModal(false);
          loadQuestionSets();
        }}
        entityType="Question Sets"
        showNotification={showNotification}
      />
    </div>
  );
}
