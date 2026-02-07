import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterBar, FilterDefinition, ActiveFilter } from './FilterBar';

describe('FilterBar', () => {
  const filters: FilterDefinition[] = [
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
      ],
    },
    {
      key: 'name',
      label: 'Name',
      type: 'text',
      placeholder: 'Enter name',
    },
    {
      key: 'featured',
      label: 'Featured',
      type: 'boolean',
    },
  ];

  const sortOptions = [
    { value: 'name', label: 'Name' },
    { value: 'date', label: 'Date' },
  ];

  const defaultProps = {
    filters,
    activeFilters: [] as ActiveFilter[],
    onFilterAdd: jest.fn(),
    onFilterRemove: jest.fn(),
    onClearAll: jest.fn(),
    searchValue: '',
    onSearchChange: jest.fn(),
    sortOptions,
    sortValue: 'name',
    sortDirection: 'asc' as const,
    onSortChange: jest.fn(),
    onSortDirectionChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders filter button', () => {
    render(<FilterBar {...defaultProps} />);
    expect(screen.getByText('+ Filter')).toBeInTheDocument();
  });

  it('renders search input with placeholder', () => {
    render(<FilterBar {...defaultProps} searchPlaceholder="Find items..." />);
    expect(screen.getByPlaceholderText('Find items...')).toBeInTheDocument();
  });

  it('calls onSearchChange when search input changes', () => {
    render(<FilterBar {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText('Search...'), {
      target: { value: 'test' },
    });
    expect(defaultProps.onSearchChange).toHaveBeenCalledWith('test');
  });

  it('renders sort controls', () => {
    render(<FilterBar {...defaultProps} />);
    expect(screen.getByText('Sort:')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveValue('name');
  });

  it('calls onSortChange when sort selection changes', () => {
    render(<FilterBar {...defaultProps} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'date' } });
    expect(defaultProps.onSortChange).toHaveBeenCalledWith('date');
  });

  it('calls onSortDirectionChange when direction button is clicked', () => {
    render(<FilterBar {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Descending'));
    expect(defaultProps.onSortDirectionChange).toHaveBeenCalledWith('desc');
  });

  it('opens filter dropdown when filter button is clicked', () => {
    render(<FilterBar {...defaultProps} />);
    fireEvent.click(screen.getByText('+ Filter'));
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
  });

  it('shows filter value options when filter is selected', () => {
    render(<FilterBar {...defaultProps} />);
    fireEvent.click(screen.getByText('+ Filter'));
    fireEvent.click(screen.getByText('Status'));
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('calls onFilterAdd when filter value is selected', () => {
    render(<FilterBar {...defaultProps} />);
    fireEvent.click(screen.getByText('+ Filter'));
    fireEvent.click(screen.getByText('Status'));
    fireEvent.click(screen.getByText('Active'));
    expect(defaultProps.onFilterAdd).toHaveBeenCalledWith('status', 'active');
  });

  it('calls onFilterAdd for boolean filters immediately', () => {
    render(<FilterBar {...defaultProps} />);
    fireEvent.click(screen.getByText('+ Filter'));
    fireEvent.click(screen.getByText('Featured'));
    expect(defaultProps.onFilterAdd).toHaveBeenCalledWith('featured', 'true');
  });

  it('renders active filter pills', () => {
    const activeFilters: ActiveFilter[] = [
      { key: 'status', value: 'active', label: 'Status', displayValue: 'Active' },
    ];
    render(<FilterBar {...defaultProps} activeFilters={activeFilters} />);
    expect(screen.getByText('Status:')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('calls onFilterRemove when pill remove button is clicked', () => {
    const activeFilters: ActiveFilter[] = [
      { key: 'status', value: 'active', label: 'Status', displayValue: 'Active' },
    ];
    render(<FilterBar {...defaultProps} activeFilters={activeFilters} />);
    fireEvent.click(screen.getByText('×'));
    expect(defaultProps.onFilterRemove).toHaveBeenCalledWith('status');
  });

  it('renders Clear All button when filters are active', () => {
    const activeFilters: ActiveFilter[] = [
      { key: 'status', value: 'active', label: 'Status', displayValue: 'Active' },
    ];
    render(<FilterBar {...defaultProps} activeFilters={activeFilters} />);
    expect(screen.getByText('Clear All')).toBeInTheDocument();
  });

  it('calls onClearAll when Clear All button is clicked', () => {
    const activeFilters: ActiveFilter[] = [
      { key: 'status', value: 'active', label: 'Status', displayValue: 'Active' },
    ];
    render(<FilterBar {...defaultProps} activeFilters={activeFilters} />);
    fireEvent.click(screen.getByText('Clear All'));
    expect(defaultProps.onClearAll).toHaveBeenCalled();
  });

  it('disables filter button when all filters are applied', () => {
    const activeFilters: ActiveFilter[] = [
      { key: 'status', value: 'active', label: 'Status', displayValue: 'Active' },
      { key: 'name', value: 'test', label: 'Name', displayValue: 'test' },
      { key: 'featured', value: 'true', label: 'Featured', displayValue: 'Yes' },
    ];
    render(<FilterBar {...defaultProps} activeFilters={activeFilters} />);
    expect(screen.getByText('+ Filter')).toBeDisabled();
  });

  it('handles text filter input', () => {
    render(<FilterBar {...defaultProps} />);
    fireEvent.click(screen.getByText('+ Filter'));
    fireEvent.click(screen.getByText('Name'));
    const input = screen.getByPlaceholderText('Enter name');
    fireEvent.change(input, { target: { value: 'John' } });
    fireEvent.click(screen.getByText('Apply'));
    expect(defaultProps.onFilterAdd).toHaveBeenCalledWith('name', 'John');
  });

  it('handles text filter submit on Enter', () => {
    render(<FilterBar {...defaultProps} />);
    fireEvent.click(screen.getByText('+ Filter'));
    fireEvent.click(screen.getByText('Name'));
    const input = screen.getByPlaceholderText('Enter name');
    fireEvent.change(input, { target: { value: 'John' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(defaultProps.onFilterAdd).toHaveBeenCalledWith('name', 'John');
  });
});
