import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  StoredTag,
  StoredTest,
  SortDirection,
  TagsSortField,
} from '@agent-eval/shared';
import { Modal, ConfirmDialog } from './Modal';
import { useNotification } from '../context/NotificationContext';
import { FilterBar, FilterDefinition, SortOption, ActiveFilter } from './FilterBar';
import { Pagination } from './Pagination';
import { apiClient } from '../apiClient';

interface Props {
  onSelect?: (tag: StoredTag) => void;
  selectable?: boolean;
}

const DEFAULT_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
];

export function TagManager({ onSelect, selectable }: Props) {
  const { showNotification } = useNotification();
  const [tags, setTags] = useState<StoredTag[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTag, setEditingTag] = useState<StoredTag | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    color: DEFAULT_COLORS[0],
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
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [sortBy, setSortBy] = useState<TagsSortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const resetForm = () => {
    setFormData({ name: '', color: DEFAULT_COLORS[0] });
    setShowForm(false);
    setEditingTag(null);
    setFormSubmitAttempted(false);
  };

  const loadTags = useCallback(async () => {
    setIsLoading(true);
    const response = await apiClient.getTags({
      page: currentPage,
      limit: itemsPerPage,
      search: searchTerm || undefined,
      sortBy,
      sortDirection,
    });
    if (response.success && response.data) {
      setTags(response.data.data);
      setTotalItems(response.data.pagination.total);
      setTotalPages(response.data.pagination.totalPages);
    }
    setIsLoading(false);
  }, [currentPage, itemsPerPage, searchTerm, sortBy, sortDirection]);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  // Filter definitions (empty for tags - only search and sort)
  const filterDefinitions: FilterDefinition[] = useMemo(() => [], []);

  // Sort options
  const sortOptions: SortOption[] = [
    { value: 'name', label: 'Name' },
    { value: 'createdAt', label: 'Date Created' },
    { value: 'updatedAt', label: 'Date Updated' },
  ];

  // Active filters (empty for tags)
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
    setSortBy('name');
    setSortDirection('asc');
    setCurrentPage(1);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  const handleEdit = (tag: StoredTag) => {
    setEditingTag(tag);
    setFormData({
      name: tag.name,
      color: tag.color || DEFAULT_COLORS[0],
    });
    setShowForm(true);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setFormSubmitAttempted(true);
    if (!formData.name) return;

    setLoading(true);

    if (editingTag) {
      // Update existing tag
      const response = await apiClient.updateTag(editingTag.id, {
        name: formData.name,
        color: formData.color,
      });

      if (response.success) {
        resetForm();
        loadTags();
        showNotification('success', 'Tag updated successfully');
      } else {
        showNotification('error', response.error || 'Failed to update tag');
      }
    } else {
      // Create new tag
      const response = await apiClient.createTag({
        name: formData.name,
        color: formData.color,
      });

      if (response.success) {
        resetForm();
        loadTags();
        showNotification('success', 'Tag created successfully');
      } else {
        showNotification('error', response.error || 'Failed to create tag');
      }
    }
    setLoading(false);
  };

  const handleDeleteClick = async (tagId: string) => {
    // Fetch tests that use this tag
    const response = await apiClient.getTagUsage(tagId);
    const dependentTests =
      response.success && response.data ? response.data.tests : [];
    setDeleteConfirm({
      open: true,
      id: tagId,
      dependentTests: dependentTests as StoredTest[],
    });
  };

  const handleDelete = async () => {
    if (!deleteConfirm.id) return;
    const response = await apiClient.deleteTag(deleteConfirm.id);
    setDeleteConfirm({ open: false, id: null, dependentTests: [] });
    if (response.success) {
      loadTags();
      showNotification('success', 'Tag deleted successfully');
    } else {
      showNotification('error', response.error || 'Failed to delete tag');
    }
  };

  const hasNoTags = totalItems === 0 && !searchTerm;

  return (
    <div className="manager-section">
      <div className="manager-header">
        <h3>Tags</h3>
        <button onClick={() => setShowForm(true)}>+ Add Tag</button>
      </div>

      {!hasNoTags && (
        <FilterBar
          filters={filterDefinitions}
          activeFilters={activeFilters}
          onFilterAdd={handleFilterAdd}
          onFilterRemove={handleFilterRemove}
          onClearAll={clearFilters}
          searchValue={searchTerm}
          onSearchChange={handleSearchChange}
          searchPlaceholder="Search tags..."
          sortOptions={sortOptions}
          sortValue={sortBy}
          sortDirection={sortDirection}
          onSortChange={(value) => setSortBy(value as TagsSortField)}
          onSortDirectionChange={setSortDirection}
        />
      )}

      <Modal
        isOpen={showForm}
        onClose={resetForm}
        onSubmit={handleSubmit}
        title={editingTag ? 'Edit Tag' : 'Add Tag'}
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
              {loading ? 'Saving...' : editingTag ? 'Update Tag' : 'Save Tag'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Tag Name *</label>
            <input
              type="text"
              placeholder="Enter tag name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className={
                formSubmitAttempted && !formData.name ? 'input-error' : ''
              }
            />
            {formSubmitAttempted && !formData.name && (
              <span className="field-error">Tag name is required</span>
            )}
          </div>
          <div className="form-group">
            <label>Color</label>
            <div className="color-picker">
              {DEFAULT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`color-swatch ${formData.color === color ? 'selected' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setFormData({ ...formData, color })}
                  title={color}
                />
              ))}
              <input
                type="color"
                value={formData.color}
                onChange={(e) =>
                  setFormData({ ...formData, color: e.target.value })
                }
                className="color-input"
                title="Custom color"
              />
            </div>
          </div>
        </form>
      </Modal>

      <div className="manager-list">
        {isLoading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <span className="loading-text">Loading tags...</span>
          </div>
        ) : tags.length === 0 ? (
          <p className="empty-message">
            {searchTerm ? 'No tags match your search' : 'No tags created yet'}
          </p>
        ) : (
          tags.map((tag) => (
            <div key={tag.id} className="manager-item">
              <div className="item-info">
                <span
                  className="tag-chip"
                  style={{ backgroundColor: tag.color || DEFAULT_COLORS[0] }}
                >
                  {tag.name}
                </span>
              </div>
              <div className="item-actions">
                {selectable && onSelect && (
                  <button onClick={() => onSelect(tag)} className="select-btn">
                    Select
                  </button>
                )}
                <button
                  onClick={() => handleEdit(tag)}
                  className="edit-btn"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteClick(tag.id)}
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
          itemName="tags"
        />
      )}

      <ConfirmDialog
        isOpen={deleteConfirm.open}
        onClose={() =>
          setDeleteConfirm({ open: false, id: null, dependentTests: [] })
        }
        onConfirm={handleDelete}
        title="Delete Tag"
        message={
          deleteConfirm.dependentTests.length > 0
            ? `This tag is used by the following tests:\n\n${deleteConfirm.dependentTests.map((t) => `- ${t.name}`).join('\n')}\n\nDeleting this tag will remove it from these tests. This action cannot be undone.`
            : 'Are you sure you want to delete this tag? This action cannot be undone.'
        }
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
