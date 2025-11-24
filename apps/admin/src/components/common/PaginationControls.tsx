/**
 * PaginationControls Component
 * 
 * Reusable pagination UI component for list views.
 * Displays page numbers, prev/next buttons, and page info.
 */

import React from 'react';

interface PaginationControlsProps {
  total: number;
  limit: number;
  offset: number;
  onPageChange: (newOffset: number) => void;
  className?: string;
}

export const PaginationControls: React.FC<PaginationControlsProps> = ({
  total,
  limit,
  offset,
  onPageChange,
  className = ''
}) => {
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);
  const hasMore = (offset + limit) < total;

  const handlePrevious = () => {
    if (offset > 0) {
      const newOffset = Math.max(0, offset - limit);
      onPageChange(newOffset);
    }
  };

  const handleNext = () => {
    if (hasMore) {
      onPageChange(offset + limit);
    }
  };

  const handlePageClick = (page: number) => {
    const newOffset = (page - 1) * limit;
    onPageChange(newOffset);
  };

  // Don't render if no pages
  if (totalPages <= 1) {
    return null;
  }

  // Generate page numbers to show (max 7 pages)
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 7;
    
    if (totalPages <= maxVisible) {
      // Show all pages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show first, last, and pages around current
      if (currentPage <= 3) {
        // Near start
        for (let i = 1; i <= 5; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        // Near end
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        // Middle
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  return (
    <div className={`flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200 ${className}`}>
      <div className="flex items-center text-sm text-gray-700">
        <span>
          Showing <span className="font-medium">{offset + 1}</span> to{' '}
          <span className="font-medium">{Math.min(offset + limit, total)}</span> of{' '}
          <span className="font-medium">{total}</span> results
        </span>
      </div>
      
      <div className="flex items-center space-x-2">
        {/* Previous Button */}
        <button
          onClick={handlePrevious}
          disabled={offset === 0}
          className={`px-3 py-2 text-sm font-medium rounded-md ${
            offset === 0
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Previous
        </button>

        {/* Page Numbers */}
        <div className="flex items-center space-x-1">
          {getPageNumbers().map((page, idx) => {
            if (page === '...') {
              return (
                <span key={`ellipsis-${idx}`} className="px-2 py-1 text-gray-500">
                  ...
                </span>
              );
            }
            
            const pageNum = page as number;
            const isActive = pageNum === currentPage;
            
            return (
              <button
                key={pageNum}
                onClick={() => handlePageClick(pageNum)}
                className={`px-3 py-2 text-sm font-medium rounded-md ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        {/* Next Button */}
        <button
          onClick={handleNext}
          disabled={!hasMore}
          className={`px-3 py-2 text-sm font-medium rounded-md ${
            !hasMore
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Next
        </button>
      </div>

      {/* Page Info */}
      <div className="text-sm text-gray-700">
        Page <span className="font-medium">{currentPage}</span> of{' '}
        <span className="font-medium">{totalPages}</span>
      </div>
    </div>
  );
};

export default PaginationControls;

