import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  StoredPersona,
  SortDirection,
  PersonasSortField,
} from '@agent-eval/shared';
import { Modal, ConfirmDialog } from '../../components/Modal';
import { useNotification } from '../../context/NotificationContext';
import { FilterBar, FilterDefinition, SortOption, ActiveFilter } from '../../components/FilterBar';
import { Pagination } from '../../components/Pagination';
import { apiClient } from '../../apiClient';
import styles from './settings.module.scss';

export function PersonasManager() {
  const { showNotification } = useNotification();
  const [personas, setPersonas] = useState<StoredPersona[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    systemPrompt: '',
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
  const [sortBy, setSortBy] = useState<PersonasSortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      systemPrompt: '',
    });
    setShowForm(false);
    setEditingId(null);
    setFormSubmitAttempted(false);
  };

  const loadPersonas = useCallback(async () => {
    setIsLoading(true);
    const response = await apiClient.getPersonas({
      page: currentPage,
      limit: itemsPerPage,
      search: searchTerm || undefined,
      sortBy,
      sortDirection,
    });
    if (response.success && response.data) {
      setPersonas(response.data.data);
      setTotalItems(response.data.pagination.total);
      setTotalPages(response.data.pagination.totalPages);
    }
    setIsLoading(false);
  }, [currentPage, itemsPerPage, searchTerm, sortBy, sortDirection]);

  useEffect(() => {
    loadPersonas();
  }, [loadPersonas]);

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
    if (!formData.name || !formData.systemPrompt) return;

    setLoading(true);

    if (editingId) {
      const response = await apiClient.updatePersona(editingId, {
        name: formData.name,
        description: formData.description || undefined,
        systemPrompt: formData.systemPrompt,
      });
      if (response.success) {
        resetForm();
        loadPersonas();
        showNotification('success', 'Persona updated successfully');
      } else {
        showNotification('error', response.error || 'Failed to update persona');
      }
    } else {
      const response = await apiClient.createPersona({
        name: formData.name,
        description: formData.description || undefined,
        systemPrompt: formData.systemPrompt,
      });
      if (response.success) {
        resetForm();
        loadPersonas();
        showNotification('success', 'Persona created successfully');
      } else {
        showNotification('error', response.error || 'Failed to create persona');
      }
    }
    setLoading(false);
  };

  const handleEdit = async (persona: StoredPersona) => {
    setFormData({
      name: persona.name,
      description: persona.description || '',
      systemPrompt: persona.systemPrompt,
    });
    setEditingId(persona.id);
    setShowForm(true);
  };

  const handleClone = async (personaId: string) => {
    const response = await apiClient.clonePersona(personaId);
    if (response.success) {
      loadPersonas();
      showNotification('success', 'Persona cloned successfully');
    } else {
      showNotification('error', response.error || 'Failed to clone persona');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm.id) return;
    const response = await apiClient.deletePersona(deleteConfirm.id);
    setDeleteConfirm({ open: false, id: null });
    if (response.success) {
      loadPersonas();
      showNotification('success', 'Persona deleted successfully');
    } else {
      showNotification('error', response.error || 'Failed to delete persona');
    }
  };

  const hasNoPersonas = totalItems === 0 && !searchTerm;

  return (
    <div className={styles.section}>
      <div className={styles.managerHeader}>
        <h3>Personas</h3>
        <button onClick={() => setShowForm(true)}>+ Add Persona</button>
      </div>

      {!hasNoPersonas && (
        <FilterBar
          filters={filterDefinitions}
          activeFilters={activeFilters}
          onFilterAdd={handleFilterAdd}
          onFilterRemove={handleFilterRemove}
          onClearAll={clearFilters}
          searchValue={searchTerm}
          onSearchChange={handleSearchChange}
          searchPlaceholder="Search personas..."
          sortOptions={sortOptions}
          sortValue={sortBy}
          sortDirection={sortDirection}
          onSortChange={(value) => setSortBy(value as PersonasSortField)}
          onSortDirectionChange={setSortDirection}
        />
      )}

      <Modal
        isOpen={showForm}
        onClose={resetForm}
        onSubmit={handleSubmit}
        title={editingId ? 'Edit Persona' : 'Add Persona'}
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
              placeholder="Enter persona name"
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
              placeholder="Brief description of this persona"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>System Prompt *</label>
            <textarea
              rows={10}
              placeholder="Enter the system prompt that defines this persona's behavior..."
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
            <span className={styles.loadingText}>Loading personas...</span>
          </div>
        ) : personas.length === 0 ? (
          <p className={styles.emptyMessage}>
            {searchTerm ? 'No personas match your search' : 'No personas configured'}
          </p>
        ) : (
          personas.map((persona) => (
            <div key={persona.id} className={styles.managerItem}>
              <div className={styles.itemInfo}>
                <strong>{persona.name}</strong>
                {persona.isTemplate && (
                  <span className={styles.methodBadge}>Template</span>
                )}
                {persona.description && (
                  <span className={styles.itemDesc}>{persona.description}</span>
                )}
              </div>
              <div className={styles.itemActions}>
                <button onClick={() => handleClone(persona.id)} className={styles.exportBtn}>
                  Clone
                </button>
                <button onClick={() => handleEdit(persona)} className={styles.editBtn}>
                  Edit
                </button>
                <button
                  onClick={() => setDeleteConfirm({ open: true, id: persona.id })}
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
          itemName="personas"
        />
      )}

      <ConfirmDialog
        isOpen={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, id: null })}
        onConfirm={handleDelete}
        title="Delete Persona"
        message="Are you sure you want to delete this persona? Scenarios using this persona will have their persona reference removed."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
