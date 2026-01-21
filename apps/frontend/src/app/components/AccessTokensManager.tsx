import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  StoredAccessToken,
  StoredTest,
  SortDirection,
  AccessTokensSortField,
} from '@agent-eval/shared';
import { Modal, ConfirmDialog } from './Modal';
import { useNotification } from '../context/NotificationContext';
import { FilterBar, FilterDefinition, SortOption, ActiveFilter } from './FilterBar';
import { Pagination } from './Pagination';
import { apiClient } from '../apiClient';

interface Props {
  onSelect?: (token: StoredAccessToken) => void;
  selectable?: boolean;
}

export function AccessTokensManager({ onSelect, selectable }: Props) {
  const { showNotification } = useNotification();
  const [tokens, setTokens] = useState<StoredAccessToken[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    token: '',
    description: '',
  });
  const [loading, setLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    id: string | null;
    dependentTests: StoredTest[];
  }>({ open: false, id: null, dependentTests: [] });
  const [formSubmitAttempted, setFormSubmitAttempted] = useState(false);

  // Filter and pagination state
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [sortBy, setSortBy] = useState<AccessTokensSortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const resetForm = () => {
    setFormData({ name: '', token: '', description: '' });
    setShowForm(false);
    setFormSubmitAttempted(false);
  };

  const loadTokens = useCallback(async () => {
    setIsLoading(true);
    const response = await apiClient.getAccessTokens({
      page: currentPage,
      limit: itemsPerPage,
      search: searchTerm || undefined,
      sortBy,
      sortDirection,
    });
    if (response.success && response.data) {
      setTokens(response.data.data);
      setTotalItems(response.data.pagination.total);
      setTotalPages(response.data.pagination.totalPages);
    }
    setIsLoading(false);
  }, [currentPage, itemsPerPage, searchTerm, sortBy, sortDirection]);

  useEffect(() => {
    loadTokens();
  }, [loadTokens]);

  // Filter definitions (empty for access tokens - only search and sort)
  const filterDefinitions: FilterDefinition[] = useMemo(() => [], []);

  // Sort options
  const sortOptions: SortOption[] = [
    { value: 'createdAt', label: 'Date Created' },
    { value: 'updatedAt', label: 'Date Updated' },
    { value: 'name', label: 'Name' },
  ];

  // Active filters (empty for access tokens)
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
    if (!formData.name || !formData.token) return;

    setLoading(true);
    const response = await apiClient.createAccessToken({
      name: formData.name,
      token: formData.token,
      description: formData.description || undefined,
    });

    if (response.success) {
      resetForm();
      loadTokens();
      showNotification('success', 'Access token created successfully');
    } else {
      showNotification(
        'error',
        response.error || 'Failed to create access token'
      );
    }
    setLoading(false);
  };

  const handleDeleteClick = async (tokenId: string) => {
    // Fetch tests that use this access token
    const response = await apiClient.getTests({
      accessTokenId: tokenId,
      limit: 100,
    });
    const dependentTests =
      response.success && response.data ? response.data.data : [];
    setDeleteConfirm({ open: true, id: tokenId, dependentTests });
  };

  const handleDelete = async () => {
    if (!deleteConfirm.id) return;
    const response = await apiClient.deleteAccessToken(deleteConfirm.id);
    setDeleteConfirm({ open: false, id: null, dependentTests: [] });
    if (response.success) {
      loadTokens();
      showNotification('success', 'Access token deleted successfully');
    } else {
      showNotification(
        'error',
        response.error || 'Failed to delete access token'
      );
    }
  };

  const hasNoTokens = totalItems === 0 && !searchTerm;

  return (
    <div className="manager-section">
      <div className="manager-header">
        <h3>AI Studio Access Tokens</h3>
        <button onClick={() => setShowForm(true)}>+ Add Token</button>
      </div>

      {!hasNoTokens && (
        <FilterBar
          filters={filterDefinitions}
          activeFilters={activeFilters}
          onFilterAdd={handleFilterAdd}
          onFilterRemove={handleFilterRemove}
          onClearAll={clearFilters}
          searchValue={searchTerm}
          onSearchChange={handleSearchChange}
          searchPlaceholder="Search tokens..."
          sortOptions={sortOptions}
          sortValue={sortBy}
          sortDirection={sortDirection}
          onSortChange={(value) => setSortBy(value as AccessTokensSortField)}
          onSortDirectionChange={setSortDirection}
        />
      )}

      <Modal
        isOpen={showForm}
        onClose={resetForm}
        onSubmit={handleSubmit}
        title="Add Access Token"
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
              {loading ? 'Saving...' : 'Save Token'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Token Name *</label>
            <input
              type="text"
              placeholder="Enter token name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className={
                formSubmitAttempted && !formData.name ? 'input-error' : ''
              }
            />
            {formSubmitAttempted && !formData.name && (
              <span className="field-error">Token name is required</span>
            )}
          </div>
          <div className="form-group">
            <label>Bearer Token *</label>
            <input
              type="password"
              placeholder="Enter bearer token (will be encrypted)"
              value={formData.token}
              onChange={(e) =>
                setFormData({ ...formData, token: e.target.value })
              }
              className={
                formSubmitAttempted && !formData.token ? 'input-error' : ''
              }
            />
            <span className="form-hint">
              The bearer token used for API authentication
            </span>
            {formSubmitAttempted && !formData.token && (
              <span className="field-error">Bearer token is required</span>
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
            <span className="loading-text">Loading tokens...</span>
          </div>
        ) : tokens.length === 0 ? (
          <p className="empty-message">
            {searchTerm ? 'No tokens match your search' : 'No access tokens stored'}
          </p>
        ) : (
          tokens.map((token) => (
            <div key={token.id} className="manager-item">
              <div className="item-info">
                <strong>{token.name}</strong>
                {token.description && (
                  <span className="item-desc">{token.description}</span>
                )}
              </div>
              <div className="item-actions">
                {selectable && onSelect && (
                  <button
                    onClick={() => onSelect(token)}
                    className="select-btn"
                  >
                    Select
                  </button>
                )}
                <button
                  onClick={() => handleDeleteClick(token.id)}
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
          itemName="tokens"
        />
      )}

      <ConfirmDialog
        isOpen={deleteConfirm.open}
        onClose={() =>
          setDeleteConfirm({ open: false, id: null, dependentTests: [] })
        }
        onConfirm={handleDelete}
        title="Delete Access Token"
        message={
          deleteConfirm.dependentTests.length > 0
            ? `This access token is used by the following tests:\n\n${deleteConfirm.dependentTests.map((t) => `• ${t.name}`).join('\n')}\n\nDeleting this access token will remove it from these tests. This action cannot be undone.`
            : 'Are you sure you want to delete this access token? This action cannot be undone.'
        }
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
