import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal, ConfirmDialog, AlertDialog } from './Modal';

describe('Modal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    title: 'Test Modal',
    children: <div>Modal content</div>,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders when isOpen is true', () => {
    render(<Modal {...defaultProps} />);
    expect(screen.getByText('Test Modal')).toBeInTheDocument();
    expect(screen.getByText('Modal content')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(<Modal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Test Modal')).not.toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    render(<Modal {...defaultProps} />);
    fireEvent.click(screen.getByText('×'));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape key is pressed', () => {
    render(<Modal {...defaultProps} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onSubmit when Enter key is pressed', () => {
    const onSubmit = jest.fn();
    render(<Modal {...defaultProps} onSubmit={onSubmit} />);
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('renders footer when provided', () => {
    render(<Modal {...defaultProps} footer={<button>Submit</button>} />);
    expect(screen.getByText('Submit')).toBeInTheDocument();
  });

  it('applies size class when size prop is provided', () => {
    const { container } = render(<Modal {...defaultProps} size="large" />);
    expect(container.querySelector('.modal-large')).toBeInTheDocument();
  });
});

describe('ConfirmDialog', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onConfirm: jest.fn(),
    title: 'Confirm Action',
    message: 'Are you sure?',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with title and message', () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByText('Confirm Action')).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  it('renders default button text', () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByText('Confirm')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('renders custom button text', () => {
    render(
      <ConfirmDialog
        {...defaultProps}
        confirmText="Yes, delete"
        cancelText="No, keep it"
      />
    );
    expect(screen.getByText('Yes, delete')).toBeInTheDocument();
    expect(screen.getByText('No, keep it')).toBeInTheDocument();
  });

  it('calls onConfirm and onClose when confirm button is clicked', () => {
    render(<ConfirmDialog {...defaultProps} />);
    fireEvent.click(screen.getByText('Confirm'));
    expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls only onClose when cancel button is clicked', () => {
    render(<ConfirmDialog {...defaultProps} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onConfirm).not.toHaveBeenCalled();
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });
});

describe('AlertDialog', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    title: 'Alert',
    message: 'Something happened',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with title and message', () => {
    render(<AlertDialog {...defaultProps} />);
    expect(screen.getByText('Alert')).toBeInTheDocument();
    expect(screen.getByText('Something happened')).toBeInTheDocument();
  });

  it('renders custom children instead of message', () => {
    render(
      <AlertDialog {...defaultProps} message={undefined}>
        <span>Custom content</span>
      </AlertDialog>
    );
    expect(screen.getByText('Custom content')).toBeInTheDocument();
    expect(screen.queryByText('Something happened')).not.toBeInTheDocument();
  });

  it('renders custom button text', () => {
    render(<AlertDialog {...defaultProps} buttonText="Got it" />);
    expect(screen.getByText('Got it')).toBeInTheDocument();
  });

  it('calls onClose when OK button is clicked', () => {
    render(<AlertDialog {...defaultProps} />);
    fireEvent.click(screen.getByText('OK'));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });
});
