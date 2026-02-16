import React, { useState } from 'react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  itemsPerPage: number;
  onItemsPerPageChange?: (itemsPerPage: number) => void;
  itemName?: string;
}

const ITEMS_PER_PAGE_OPTIONS = [5, 10, 20];

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage,
  onItemsPerPageChange,
  itemName = 'items',
}: PaginationProps) {
  const [goToPageInput, setGoToPageInput] = useState('');

  if (totalItems === 0) return null;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const handleGoToPage = () => {
    const pageNum = parseInt(goToPageInput, 10);
    if (!isNaN(pageNum) && pageNum >= 1) {
      // Go to last page if input exceeds max
      const targetPage = pageNum > totalPages ? totalPages : pageNum;
      onPageChange(targetPage);
      setGoToPageInput('');
    }
  };

  const handleGoToPageKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleGoToPage();
    }
  };

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      if (currentPage > 3) {
        pages.push('...');
      }

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push('...');
      }

      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <div className="pagination">
      <div className="pagination-row">
        <div className="pagination-left">
          <div className="pagination-info">
            Showing {startItem}-{endItem} of {totalItems} {itemName}
          </div>
          {onItemsPerPageChange && (
            <div className="items-per-page">
              <span>Show:</span>
              <select
                value={itemsPerPage}
                onChange={(e) =>
                  onItemsPerPageChange(parseInt(e.target.value, 10))
                }
              >
                {ITEMS_PER_PAGE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="pagination-controls">
            <button
              className="pagination-btn first-last"
              onClick={() => onPageChange(1)}
              disabled={currentPage === 1}
              title="First page"
            >
              First
            </button>
            <button
              className="pagination-btn"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <div className="pagination-pages">
              {getPageNumbers().map((page, index) =>
                typeof page === 'number' ? (
                  <button
                    key={index}
                    className={`pagination-page ${currentPage === page ? 'active' : ''}`}
                    onClick={() => onPageChange(page)}
                  >
                    {page}
                  </button>
                ) : (
                  <span key={index} className="pagination-ellipsis">
                    {page}
                  </span>
                ),
              )}
            </div>
            <button
              className="pagination-btn"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
            <button
              className="pagination-btn first-last"
              onClick={() => onPageChange(totalPages)}
              disabled={currentPage === totalPages}
              title="Last page"
            >
              Last
            </button>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="go-to-page">
          <span>Go to page:</span>
          <input
            type="text"
            inputMode="numeric"
            value={goToPageInput}
            onChange={(e) => {
              const v = e.target.value;
              if (v === '' || /^\d+$/.test(v)) {
                setGoToPageInput(v);
              }
            }}
            onKeyDown={handleGoToPageKeyDown}
            placeholder={`1-${totalPages}`}
          />
          <button
            onClick={handleGoToPage}
            disabled={!goToPageInput || parseInt(goToPageInput, 10) < 1}
          >
            Go
          </button>
        </div>
      )}
    </div>
  );
}

export function usePagination<T>(items: T[], itemsPerPage = 10) {
  const [currentPage, setCurrentPage] = React.useState(1);

  const totalPages = Math.ceil(items.length / itemsPerPage);

  // Reset to page 1 if current page is out of bounds
  React.useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [items.length, currentPage, totalPages]);

  const paginatedItems = React.useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return items.slice(start, start + itemsPerPage);
  }, [items, currentPage, itemsPerPage]);

  return {
    currentPage,
    setCurrentPage,
    totalPages,
    paginatedItems,
    totalItems: items.length,
    itemsPerPage,
  };
}
