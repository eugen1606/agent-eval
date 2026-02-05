import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  StoredFlowConfig,
  SortDirection,
  FlowConfigsSortField,
} from '@agent-eval/shared';
import { Modal, ConfirmDialog } from './Modal';
import { useNotification } from '../context/NotificationContext';
import {
  FilterBar,
  FilterDefinition,
  SortOption,
  ActiveFilter,
} from './FilterBar';
import { Pagination } from './Pagination';
import { apiClient } from '../apiClient';
import { downloadExportBundle, generateExportFilename, ImportModal } from './exportImportUtils';

interface Props {
  onSelect?: (flowConfig: StoredFlowConfig) => void;
  selectable?: boolean;
}

export function FlowConfigsManager({ onSelect, selectable }: Props) {
  const { showNotification } = useNotification();
  const [flowConfigs, setFlowConfigs] = useState<StoredFlowConfig[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    flowId: '',
    basePath: '',
    description: '',
  });
  const [loading, setLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    id: string | null;
  }>({ open: false, id: null });
  const [formSubmitAttempted, setFormSubmitAttempted] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // Filter and pagination state
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [sortBy, setSortBy] = useState<FlowConfigsSortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const loadFlowConfigs = useCallback(async () => {
    setIsLoading(true);
    const response = await apiClient.getFlowConfigs({
      page: currentPage,
      limit: itemsPerPage,
      search: searchTerm || undefined,
      sortBy,
      sortDirection,
    });
    if (response.success && response.data) {
      setFlowConfigs(response.data.data);
      setTotalItems(response.data.pagination.total);
      setTotalPages(response.data.pagination.totalPages);
    }
    setIsLoading(false);
  }, [currentPage, itemsPerPage, searchTerm, sortBy, sortDirection]);

  useEffect(() => {
    loadFlowConfigs();
  }, [loadFlowConfigs]);

  // Filter definitions (empty for flow configs - only search and sort)
  const filterDefinitions: FilterDefinition[] = useMemo(() => [], []);

  // Sort options
  const sortOptions: SortOption[] = [
    { value: 'createdAt', label: 'Date Created' },
    { value: 'updatedAt', label: 'Date Updated' },
    { value: 'name', label: 'Name' },
  ];

  // Active filters (empty for flow configs)
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
    if (!formData.name || !formData.flowId || !formData.basePath) return;

    setLoading(true);

    let response;
    if (editingId) {
      response = await apiClient.updateFlowConfig(editingId, {
        name: formData.name,
        flowId: formData.flowId,
        basePath: formData.basePath,
        description: formData.description || undefined,
      });
    } else {
      response = await apiClient.createFlowConfig({
        name: formData.name,
        flowId: formData.flowId,
        basePath: formData.basePath,
        description: formData.description || undefined,
      });
    }

    if (response.success) {
      resetForm();
      loadFlowConfigs();
      showNotification(
        'success',
        editingId
          ? 'Flow config updated successfully'
          : 'Flow config created successfully',
      );
    } else {
      showNotification('error', response.error || 'Failed to save flow config');
    }
    setLoading(false);
  };

  const handleEdit = (fc: StoredFlowConfig) => {
    setEditingId(fc.id);
    setFormData({
      name: fc.name,
      flowId: fc.flowId,
      basePath: fc.basePath || '',
      description: fc.description || '',
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({ name: '', flowId: '', basePath: '', description: '' });
    setShowForm(false);
    setEditingId(null);
    setFormSubmitAttempted(false);
  };

  const handleDelete = async () => {
    if (!deleteConfirm.id) return;
    const response = await apiClient.deleteFlowConfig(deleteConfirm.id);
    setDeleteConfirm({ open: false, id: null });
    if (response.success) {
      loadFlowConfigs();
      showNotification('success', 'Flow config deleted successfully');
    } else {
      showNotification(
        'error',
        response.error || 'Failed to delete flow config',
      );
    }
  };

  const handleExport = async (fc: StoredFlowConfig) => {
    const response = await apiClient.exportConfig({
      types: ['flowConfigs'],
      flowConfigIds: [fc.id],
    });

    if (response.success && response.data) {
      downloadExportBundle(
        response.data,
        generateExportFilename('flow-config', fc.name)
      );
      showNotification('success', `Exported "${fc.name}"`);
    } else {
      showNotification('error', response.error || 'Export failed');
    }
  };

  const hasNoFlowConfigs = totalItems === 0 && !searchTerm;

  return (
    <div className="manager-section">
      <div className="manager-header">
        <h3>Flow Configurations</h3>
        <div className="header-actions">
          <button onClick={() => setShowImportModal(true)} className="import-btn">
            Import
          </button>
          <button onClick={() => setShowForm(true)}>+ Add Flow Config</button>
        </div>
      </div>

      {!hasNoFlowConfigs && (
        <FilterBar
          filters={filterDefinitions}
          activeFilters={activeFilters}
          onFilterAdd={handleFilterAdd}
          onFilterRemove={handleFilterRemove}
          onClearAll={clearFilters}
          searchValue={searchTerm}
          onSearchChange={handleSearchChange}
          searchPlaceholder="Search flow configs..."
          sortOptions={sortOptions}
          sortValue={sortBy}
          sortDirection={sortDirection}
          onSortChange={(value) => setSortBy(value as FlowConfigsSortField)}
          onSortDirectionChange={setSortDirection}
        />
      )}

      <Modal
        isOpen={showForm}
        onClose={resetForm}
        onSubmit={handleSubmit}
        title={editingId ? 'Edit Flow Config' : 'Add Flow Config'}
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
            <label>Config Name *</label>
            <input
              type="text"
              placeholder="Enter config name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className={
                formSubmitAttempted && !formData.name ? 'input-error' : ''
              }
            />
            {formSubmitAttempted && !formData.name && (
              <span className="field-error">Config name is required</span>
            )}
          </div>
          <div className="form-group">
            <label>Flow ID *</label>
            <input
              type="text"
              placeholder="Enter flow ID"
              value={formData.flowId}
              onChange={(e) =>
                setFormData({ ...formData, flowId: e.target.value })
              }
              className={
                formSubmitAttempted && !formData.flowId ? 'input-error' : ''
              }
            />
            {formSubmitAttempted && !formData.flowId && (
              <span className="field-error">Flow ID is required</span>
            )}
          </div>
          <div className="form-group">
            <label>Base Path *</label>
            <input
              type="text"
              placeholder="Enter base path"
              value={formData.basePath}
              onChange={(e) =>
                setFormData({ ...formData, basePath: e.target.value })
              }
            />
            {formSubmitAttempted && !formData.basePath && (
              <span className="field-error">Base Path is required</span>
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

      <div className="manager-list">
        {isLoading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <span className="loading-text">Loading flow configs...</span>
          </div>
        ) : flowConfigs.length === 0 ? (
          <p className="empty-message">
            {searchTerm
              ? 'No flow configs match your search'
              : 'No flow configs stored'}
          </p>
        ) : (
          flowConfigs.map((fc) => (
            <div key={fc.id} className="manager-item">
              <div className="item-info">
                <strong>{fc.name}</strong>
                <span className="item-meta">Flow: {fc.flowId}</span>
                {fc.basePath && (
                  <span className="item-meta">{fc.basePath}</span>
                )}
                {fc.description && (
                  <span className="item-desc">{fc.description}</span>
                )}
              </div>
              <div className="item-actions">
                {selectable && onSelect && (
                  <button onClick={() => onSelect(fc)} className="select-btn">
                    Select
                  </button>
                )}
                <button onClick={() => handleExport(fc)} className="export-btn">
                  Export
                </button>
                <button onClick={() => handleEdit(fc)} className="edit-btn">
                  Edit
                </button>
                <button
                  onClick={() => setDeleteConfirm({ open: true, id: fc.id })}
                  className="delete-btn"
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
          itemName="flow configs"
        />
      )}

      <ConfirmDialog
        isOpen={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, id: null })}
        onConfirm={handleDelete}
        title="Delete Flow Config"
        message="Are you sure you want to delete this flow configuration? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />

      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={loadFlowConfigs}
        entityType="Flow Config"
        showNotification={showNotification}
      />
    </div>
  );
}
