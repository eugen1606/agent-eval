import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Pagination, usePagination } from './Pagination';
import { renderHook, act } from '@testing-library/react';

describe('Pagination', () => {
  const defaultProps = {
    currentPage: 1,
    totalPages: 5,
    onPageChange: jest.fn(),
    totalItems: 50,
    itemsPerPage: 10,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders pagination info correctly', () => {
    render(<Pagination {...defaultProps} />);
    expect(screen.getByText(/Showing 1-10 of 50 items/)).toBeInTheDocument();
  });

  it('renders custom item name', () => {
    render(<Pagination {...defaultProps} itemName="records" />);
    expect(screen.getByText(/50 records/)).toBeInTheDocument();
  });

  it('returns null when totalItems is 0', () => {
    const { container } = render(<Pagination {...defaultProps} totalItems={0} />);
    expect(container.firstChild).toBeNull();
  });

  it('calls onPageChange when Next button is clicked', () => {
    render(<Pagination {...defaultProps} />);
    fireEvent.click(screen.getByText('Next'));
    expect(defaultProps.onPageChange).toHaveBeenCalledWith(2);
  });

  it('calls onPageChange when Previous button is clicked', () => {
    render(<Pagination {...defaultProps} currentPage={3} />);
    fireEvent.click(screen.getByText('Previous'));
    expect(defaultProps.onPageChange).toHaveBeenCalledWith(2);
  });

  it('disables Previous button on first page', () => {
    render(<Pagination {...defaultProps} currentPage={1} />);
    expect(screen.getByText('Previous')).toBeDisabled();
  });

  it('disables Next button on last page', () => {
    render(<Pagination {...defaultProps} currentPage={5} />);
    expect(screen.getByText('Next')).toBeDisabled();
  });

  it('calls onPageChange when First button is clicked', () => {
    render(<Pagination {...defaultProps} currentPage={3} />);
    fireEvent.click(screen.getByText('First'));
    expect(defaultProps.onPageChange).toHaveBeenCalledWith(1);
  });

  it('calls onPageChange when Last button is clicked', () => {
    render(<Pagination {...defaultProps} currentPage={3} />);
    fireEvent.click(screen.getByText('Last'));
    expect(defaultProps.onPageChange).toHaveBeenCalledWith(5);
  });

  it('renders items per page selector when callback provided', () => {
    const onItemsPerPageChange = jest.fn();
    render(
      <Pagination {...defaultProps} onItemsPerPageChange={onItemsPerPageChange} />
    );
    expect(screen.getByText('Show:')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('calls onItemsPerPageChange when selection changes', () => {
    const onItemsPerPageChange = jest.fn();
    render(
      <Pagination {...defaultProps} onItemsPerPageChange={onItemsPerPageChange} />
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '20' } });
    expect(onItemsPerPageChange).toHaveBeenCalledWith(20);
  });

  it('handles go to page input', () => {
    render(<Pagination {...defaultProps} />);
    const input = screen.getByPlaceholderText('1-5');
    fireEvent.change(input, { target: { value: '3' } });
    fireEvent.click(screen.getByText('Go'));
    expect(defaultProps.onPageChange).toHaveBeenCalledWith(3);
  });

  it('goes to last page when input exceeds max', () => {
    render(<Pagination {...defaultProps} />);
    const input = screen.getByPlaceholderText('1-5');
    fireEvent.change(input, { target: { value: '100' } });
    fireEvent.click(screen.getByText('Go'));
    expect(defaultProps.onPageChange).toHaveBeenCalledWith(5);
  });
});

describe('usePagination', () => {
  const items = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }));

  it('returns correct initial state', () => {
    const { result } = renderHook(() => usePagination(items, 10));
    expect(result.current.currentPage).toBe(1);
    expect(result.current.totalPages).toBe(3);
    expect(result.current.totalItems).toBe(25);
    expect(result.current.itemsPerPage).toBe(10);
  });

  it('returns correct paginated items for page 1', () => {
    const { result } = renderHook(() => usePagination(items, 10));
    expect(result.current.paginatedItems).toHaveLength(10);
    expect(result.current.paginatedItems[0]).toEqual({ id: 1 });
  });

  it('returns correct paginated items for page 2', () => {
    const { result } = renderHook(() => usePagination(items, 10));
    act(() => {
      result.current.setCurrentPage(2);
    });
    expect(result.current.paginatedItems).toHaveLength(10);
    expect(result.current.paginatedItems[0]).toEqual({ id: 11 });
  });

  it('returns correct paginated items for last page', () => {
    const { result } = renderHook(() => usePagination(items, 10));
    act(() => {
      result.current.setCurrentPage(3);
    });
    expect(result.current.paginatedItems).toHaveLength(5);
    expect(result.current.paginatedItems[0]).toEqual({ id: 21 });
  });

  it('resets to page 1 when current page exceeds total', () => {
    const { result, rerender } = renderHook(
      ({ items }) => usePagination(items, 10),
      { initialProps: { items } }
    );
    act(() => {
      result.current.setCurrentPage(3);
    });
    // Reduce items to only have 1 page
    rerender({ items: items.slice(0, 5) });
    expect(result.current.currentPage).toBe(1);
  });
});
