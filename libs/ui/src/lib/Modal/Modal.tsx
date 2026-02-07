import React, { useEffect, useRef, useCallback } from 'react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'default' | 'large' | 'xlarge';
}

export function Modal({ isOpen, onClose, onSubmit, title, children, footer, size = 'default' }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && onSubmit) {
      // Don't trigger on textarea or if modifier keys are pressed
      const target = e.target as HTMLElement;
      if (target.tagName !== 'TEXTAREA' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        onSubmit();
      }
    }
  }, [onClose, onSubmit]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === modalRef.current) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const sizeClass = size !== 'default' ? `modal-${size}` : '';

  return (
    <div className="modal-backdrop" ref={modalRef} onClick={handleBackdropClick}>
      <div className={`modal-content ${sizeClass}`.trim()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          {children}
        </div>
        {footer && (
          <div className="modal-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'info',
}: ConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleConfirm}
      title={title}
      footer={
        <>
          <button className="modal-btn cancel" onClick={onClose}>
            {cancelText}
          </button>
          <button className={`modal-btn confirm ${variant}`} onClick={handleConfirm}>
            {confirmText}
          </button>
        </>
      }
    >
      <p style={{ whiteSpace: 'pre-line' }}>{message}</p>
    </Modal>
  );
}

export interface AlertDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  children?: React.ReactNode;
  buttonText?: string;
  variant?: 'success' | 'error' | 'info';
}

export function AlertDialog({
  isOpen,
  onClose,
  title,
  message,
  children,
  buttonText = 'OK',
  variant = 'info',
}: AlertDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <button className={`modal-btn confirm ${variant}`} onClick={onClose}>
          {buttonText}
        </button>
      }
    >
      {children ? children : <p>{message}</p>}
    </Modal>
  );
}
