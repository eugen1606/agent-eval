import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchableSelect } from './SearchableSelect';

describe('SearchableSelect', () => {
  const options = [
    { value: '1', label: 'Option 1' },
    { value: '2', label: 'Option 2', sublabel: 'Description' },
    { value: '3', label: 'Option 3' },
  ];

  const defaultProps = {
    options,
    value: '',
    onChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with "All" as default display value', () => {
    render(<SearchableSelect {...defaultProps} />);
    expect(screen.getByText('All')).toBeInTheDocument();
  });

  it('renders custom allOptionLabel', () => {
    render(<SearchableSelect {...defaultProps} allOptionLabel="Select..." />);
    expect(screen.getByText('Select...')).toBeInTheDocument();
  });

  it('displays selected option label', () => {
    render(<SearchableSelect {...defaultProps} value="2" />);
    expect(screen.getByText('Option 2')).toBeInTheDocument();
  });

  it('opens dropdown when trigger is clicked', () => {
    render(<SearchableSelect {...defaultProps} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
    expect(screen.getAllByText('Option 1')).toHaveLength(1);
  });

  it('filters options based on search term', () => {
    render(<SearchableSelect {...defaultProps} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.change(screen.getByPlaceholderText('Search...'), {
      target: { value: 'Option 1' },
    });
    expect(screen.getByText('Option 1')).toBeInTheDocument();
    expect(screen.queryByText('Option 3')).not.toBeInTheDocument();
  });

  it('filters by sublabel', () => {
    render(<SearchableSelect {...defaultProps} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.change(screen.getByPlaceholderText('Search...'), {
      target: { value: 'Description' },
    });
    expect(screen.getByText('Option 2')).toBeInTheDocument();
    expect(screen.queryByText('Option 1')).not.toBeInTheDocument();
  });

  it('shows "No matches found" when no options match', () => {
    render(<SearchableSelect {...defaultProps} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.change(screen.getByPlaceholderText('Search...'), {
      target: { value: 'xyz' },
    });
    expect(screen.getByText('No matches found')).toBeInTheDocument();
  });

  it('calls onChange when option is selected', () => {
    render(<SearchableSelect {...defaultProps} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Option 1'));
    expect(defaultProps.onChange).toHaveBeenCalledWith('1');
  });

  it('calls onChange with empty string when "All" is selected', () => {
    render(<SearchableSelect {...defaultProps} value="1" />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('All'));
    expect(defaultProps.onChange).toHaveBeenCalledWith('');
  });

  it('closes dropdown after selection', () => {
    render(<SearchableSelect {...defaultProps} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Option 1'));
    expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument();
  });

  it('closes dropdown when clicking outside', () => {
    render(
      <div>
        <SearchableSelect {...defaultProps} />
        <div data-testid="outside">Outside</div>
      </div>
    );
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <SearchableSelect {...defaultProps} className="custom-class" />
    );
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });

  it('renders sublabels in options', () => {
    render(<SearchableSelect {...defaultProps} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Description')).toBeInTheDocument();
  });
});
