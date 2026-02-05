import React, { useState, useRef } from 'react';
import {
  ExportBundle,
  ConflictStrategy,
  ImportPreviewResult,
} from '@agent-eval/shared';
import { Modal } from './Modal';
import { apiClient } from '../apiClient';

// Helper function to download an export bundle as JSON
export function downloadExportBundle(bundle: ExportBundle, filename: string) {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Generate a filename for export
export function generateExportFilename(type: string, name: string): string {
  const date = new Date().toISOString().split('T')[0];
  const safeName = name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  return `${type}-${safeName}-${date}.json`;
}

// Conflict strategy options
const CONFLICT_STRATEGIES: {
  value: ConflictStrategy;
  label: string;
  description: string;
}[] = [
  {
    value: 'skip',
    label: 'Skip',
    description: 'Keep existing, ignore imported',
  },
  {
    value: 'overwrite',
    label: 'Overwrite',
    description: 'Replace existing with imported',
  },
  { value: 'rename', label: 'Rename', description: 'Import with new name' },
];

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  entityType: string;
  showNotification: (type: 'success' | 'error', message: string) => void;
}

export function ImportModal({
  isOpen,
  onClose,
  onSuccess,
  entityType,
  showNotification,
}: ImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importBundle, setImportBundle] = useState<ExportBundle | null>(null);
  const [importPreview, setImportPreview] =
    useState<ImportPreviewResult | null>(null);
  const [conflictStrategy, setConflictStrategy] =
    useState<ConflictStrategy>('skip');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const resetState = () => {
    setImportFile(null);
    setImportBundle(null);
    setImportPreview(null);
    setConflictStrategy('skip');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setImportPreview(null);

    try {
      const text = await file.text();
      const bundle = JSON.parse(text) as ExportBundle;

      if (!bundle.metadata || !bundle.metadata.version) {
        showNotification('error', 'Invalid export file format');
        setImportFile(null);
        return;
      }

      setImportBundle(bundle);

      // Automatically preview
      setIsPreviewLoading(true);
      const response = await apiClient.previewImport(bundle);
      if (response.success && response.data) {
        setImportPreview(response.data);
      } else {
        showNotification('error', response.error || 'Failed to preview import');
      }
      setIsPreviewLoading(false);
    } catch {
      showNotification('error', 'Failed to parse import file');
      setImportFile(null);
    }
  };

  const handleImport = async () => {
    if (!importBundle) return;

    setIsImporting(true);
    try {
      const response = await apiClient.importConfig(
        importBundle,
        conflictStrategy
      );
      if (response.success && response.data) {
        const result = response.data;
        const totalCreated = Object.values(result.created).reduce(
          (a, b) => a + b,
          0
        );
        const totalSkipped = Object.values(result.skipped).reduce(
          (a, b) => a + b,
          0
        );
        const totalOverwritten = Object.values(result.overwritten).reduce(
          (a, b) => a + b,
          0
        );
        const totalRenamed = Object.values(result.renamed).reduce(
          (a, b) => a + b,
          0
        );

        let message = 'Import completed: ';
        const parts = [];
        if (totalCreated > 0) parts.push(`${totalCreated} created`);
        if (totalSkipped > 0) parts.push(`${totalSkipped} skipped`);
        if (totalOverwritten > 0) parts.push(`${totalOverwritten} overwritten`);
        if (totalRenamed > 0) parts.push(`${totalRenamed} renamed`);
        message += parts.join(', ') || 'no changes';

        showNotification('success', message);
        handleClose();
        onSuccess();
      } else {
        showNotification('error', response.error || 'Import failed');
      }
    } catch {
      showNotification('error', 'Import failed');
    }
    setIsImporting(false);
  };

  const getEntityCount = (
    counts: Record<string, number>,
    type: string
  ): number => {
    return counts[type] || 0;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Import ${entityType}`}
      footer={
        importPreview && !isPreviewLoading ? (
          <>
            <button className="modal-btn cancel" onClick={handleClose}>
              Cancel
            </button>
            <button
              className="modal-btn confirm"
              onClick={handleImport}
              disabled={isImporting}
            >
              {isImporting ? 'Importing...' : 'Import'}
            </button>
          </>
        ) : (
          <button className="modal-btn cancel" onClick={handleClose}>
            Cancel
          </button>
        )
      }
    >
      <div className="import-modal-content">
        <div className="file-upload-section">
          <div className="file-input-row">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              id="import-file-input"
              className="file-input-hidden"
            />
            <button
              type="button"
              className="file-choose-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              Choose File
            </button>
            <span className="file-name">
              {importFile ? importFile.name : 'No file chosen'}
            </span>
          </div>
        </div>

        {isPreviewLoading && (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <span className="loading-text">Analyzing import file...</span>
          </div>
        )}

        {importPreview && !isPreviewLoading && (
          <div className="import-preview-section">
            <div className="preview-metadata">
              <span>Version: {importBundle?.metadata.version}</span>
              <span>
                Exported:{' '}
                {importBundle?.metadata.exportedAt
                  ? new Date(importBundle.metadata.exportedAt).toLocaleString()
                  : 'Unknown'}
              </span>
            </div>

            <div className="preview-summary">
              <h4>Will Import:</h4>
              <ul>
                {importPreview.toCreate.tests > 0 && (
                  <li>{importPreview.toCreate.tests} test(s)</li>
                )}
                {importPreview.toCreate.questionSets > 0 && (
                  <li>{importPreview.toCreate.questionSets} question set(s)</li>
                )}
                {importPreview.toCreate.flowConfigs > 0 && (
                  <li>{importPreview.toCreate.flowConfigs} flow config(s)</li>
                )}
                {importPreview.toCreate.tags > 0 && (
                  <li>{importPreview.toCreate.tags} tag(s)</li>
                )}
                {importPreview.toCreate.webhooks > 0 && (
                  <li>{importPreview.toCreate.webhooks} webhook(s)</li>
                )}
              </ul>
            </div>

            {importPreview.conflicts.length > 0 && (
              <div className="preview-conflicts">
                <h4>Conflicts ({importPreview.conflicts.length}):</h4>
                <div className="conflicts-list">
                  {importPreview.conflicts.slice(0, 5).map((conflict, index) => (
                    <div key={index} className="conflict-item">
                      <span className="conflict-type">{conflict.type}</span>
                      <span className="conflict-name">"{conflict.name}"</span>
                    </div>
                  ))}
                  {importPreview.conflicts.length > 5 && (
                    <div className="conflict-item">
                      ... and {importPreview.conflicts.length - 5} more
                    </div>
                  )}
                </div>

                <div className="conflict-strategy-section">
                  <label>How to handle conflicts:</label>
                  <div className="strategy-options">
                    {CONFLICT_STRATEGIES.map(({ value, label, description }) => (
                      <label key={value} className="strategy-option">
                        <input
                          type="radio"
                          name="conflictStrategy"
                          value={value}
                          checked={conflictStrategy === value}
                          onChange={() => setConflictStrategy(value)}
                        />
                        <span className="strategy-label">{label}</span>
                        <span className="strategy-description">
                          {description}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {importPreview.errors.length > 0 && (
              <div className="preview-errors">
                <h4>Warnings:</h4>
                <ul>
                  {importPreview.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
