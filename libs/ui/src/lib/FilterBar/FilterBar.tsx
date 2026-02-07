import React, { useState, useRef, useEffect } from 'react';
import { SortDirection } from '@agent-eval/shared';

export interface FilterOption {
  value: string;
  label: string;
  sublabel?: string;
}

export interface FilterDefinition {
  key: string;
  label: string;
  type: 'select' | 'text' | 'boolean';
  options?: FilterOption[];
  placeholder?: string;
}

export interface SortOption {
  value: string;
  label: string;
}

export interface ActiveFilter {
  key: string;
  value: string;
  label: string;
  displayValue: string;
}

export interface FilterBarProps {
  filters: FilterDefinition[];
  activeFilters: ActiveFilter[];
  onFilterAdd: (key: string, value: string) => void;
  onFilterRemove: (key: string) => void;
  onClearAll: () => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  sortOptions: SortOption[];
  sortValue: string;
  sortDirection: SortDirection;
  onSortChange: (value: string) => void;
  onSortDirectionChange: (direction: SortDirection) => void;
}

export function FilterBar({
  filters,
  activeFilters,
  onFilterAdd,
  onFilterRemove,
  onClearAll,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  sortOptions,
  sortValue,
  sortDirection,
  onSortChange,
  onSortDirectionChange,
}: FilterBarProps) {
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [selectedFilterKey, setSelectedFilterKey] = useState<string | null>(null);
  const [filterSearchValue, setFilterSearchValue] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowFilterDropdown(false);
        setSelectedFilterKey(null);
        setFilterSearchValue('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const availableFilters = filters.filter(
    (f) => !activeFilters.some((af) => af.key === f.key)
  );

  const selectedFilter = selectedFilterKey
    ? filters.find((f) => f.key === selectedFilterKey)
    : null;

  const handleFilterSelect = (key: string) => {
    const filter = filters.find((f) => f.key === key);
    if (filter?.type === 'boolean') {
      onFilterAdd(key, 'true');
      setShowFilterDropdown(false);
      setSelectedFilterKey(null);
    } else {
      setSelectedFilterKey(key);
      setFilterSearchValue('');
    }
  };

  const handleValueSelect = (value: string, displayValue: string) => {
    if (selectedFilterKey) {
      onFilterAdd(selectedFilterKey, value);
      setShowFilterDropdown(false);
      setSelectedFilterKey(null);
      setFilterSearchValue('');
    }
  };

  const filteredOptions = selectedFilter?.options?.filter((opt) =>
    opt.label.toLowerCase().includes(filterSearchValue.toLowerCase()) ||
    opt.sublabel?.toLowerCase().includes(filterSearchValue.toLowerCase())
  );

  const hasActiveFilters = activeFilters.length > 0 || searchValue;

  return (
    <div className="filter-bar-container">
      <div className="filter-bar-main">
        {/* Add Filter Button - only show when filters are available */}
        {filters.length > 0 && (
          <div className="filter-add-wrapper" ref={dropdownRef}>
            <button
              className="filter-add-btn"
              onClick={() => {
                setShowFilterDropdown(!showFilterDropdown);
                setSelectedFilterKey(null);
                setFilterSearchValue('');
              }}
              disabled={availableFilters.length === 0}
            >
              + Filter
            </button>

          {showFilterDropdown && (
            <div className="filter-dropdown">
              {!selectedFilterKey ? (
                // Show available filters
                <div className="filter-dropdown-list">
                  {availableFilters.map((filter) => (
                    <button
                      key={filter.key}
                      className="filter-dropdown-item"
                      onClick={() => handleFilterSelect(filter.key)}
                    >
                      {filter.label}
                    </button>
                  ))}
                  {availableFilters.length === 0 && (
                    <div className="filter-dropdown-empty">All filters applied</div>
                  )}
                </div>
              ) : (
                // Show filter value selector
                <div className="filter-value-selector">
                  <div className="filter-value-header">
                    <button
                      className="filter-back-btn"
                      onClick={() => setSelectedFilterKey(null)}
                    >
                      &larr;
                    </button>
                    <span>{selectedFilter?.label}</span>
                  </div>
                  {selectedFilter?.type === 'select' && (
                    <>
                      <input
                        type="text"
                        className="filter-value-search"
                        placeholder={`Search ${selectedFilter.label.toLowerCase()}...`}
                        value={filterSearchValue}
                        onChange={(e) => setFilterSearchValue(e.target.value)}
                        autoFocus
                      />
                      <div className="filter-dropdown-list">
                        {filteredOptions?.map((opt) => (
                          <button
                            key={opt.value}
                            className="filter-dropdown-item"
                            onClick={() => handleValueSelect(opt.value, opt.label)}
                          >
                            <span className="filter-option-label">{opt.label}</span>
                            {opt.sublabel && (
                              <span className="filter-option-sublabel">{opt.sublabel}</span>
                            )}
                          </button>
                        ))}
                        {filteredOptions?.length === 0 && (
                          <div className="filter-dropdown-empty">No matches</div>
                        )}
                      </div>
                    </>
                  )}
                  {selectedFilter?.type === 'text' && (
                    <div className="filter-text-input">
                      <input
                        type="text"
                        placeholder={selectedFilter.placeholder || `Enter ${selectedFilter.label.toLowerCase()}...`}
                        value={filterSearchValue}
                        onChange={(e) => setFilterSearchValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && filterSearchValue) {
                            handleValueSelect(filterSearchValue, filterSearchValue);
                          }
                        }}
                        autoFocus
                      />
                      <button
                        className="filter-apply-btn"
                        onClick={() => {
                          if (filterSearchValue) {
                            handleValueSelect(filterSearchValue, filterSearchValue);
                          }
                        }}
                        disabled={!filterSearchValue}
                      >
                        Apply
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          </div>
        )}

        {/* Search Input */}
        <div className="filter-search-wrapper">
          <input
            type="text"
            className="filter-search-input"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        {/* Sort Controls */}
        <div className="filter-sort-wrapper">
          <span className="filter-sort-label">Sort:</span>
          <select
            className="filter-sort-select"
            value={sortValue}
            onChange={(e) => onSortChange(e.target.value)}
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            className={`filter-sort-direction ${sortDirection === 'asc' ? 'active' : ''}`}
            onClick={() => onSortDirectionChange('asc')}
            title="Ascending"
          >
            &#9650;
          </button>
          <button
            className={`filter-sort-direction ${sortDirection === 'desc' ? 'active' : ''}`}
            onClick={() => onSortDirectionChange('desc')}
            title="Descending"
          >
            &#9660;
          </button>
        </div>
      </div>

      {/* Active Filters Pills */}
      {hasActiveFilters && (
        <div className="filter-bar-pills">
          {activeFilters.map((filter) => (
            <div key={filter.key} className="filter-pill">
              <span className="filter-pill-label">{filter.label}:</span>
              <span className="filter-pill-value">{filter.displayValue}</span>
              <button
                className="filter-pill-remove"
                onClick={() => onFilterRemove(filter.key)}
              >
                &times;
              </button>
            </div>
          ))}
          <button className="filter-clear-all-btn" onClick={onClearAll}>
            Clear All
          </button>
        </div>
      )}
    </div>
  );
}
