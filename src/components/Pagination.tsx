import { useTranslation } from 'react-i18next';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  const { t } = useTranslation();

  if (totalPages <= 1) return null;

  // Generate page numbers with ellipses (e.g. 1 ... 4 5 6 ... 12)
  const getPageNumbers = () => {
    const delta = 1; // number of pages to show around the current page
    const left = currentPage - delta;
    const right = currentPage + delta;
    const range: number[] = [];
    const rangeWithDots: (number | string)[] = [];
    let prevValue: number | undefined;

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= left && i <= right)) {
        range.push(i);
      }
    }

    for (const i of range) {
      if (prevValue !== undefined) {
        if (i - prevValue === 2) {
          rangeWithDots.push(prevValue + 1);
        } else if (i - prevValue > 2) {
          rangeWithDots.push('...');
        }
      }
      rangeWithDots.push(i);
      prevValue = i;
    }

    return rangeWithDots;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="flex items-center justify-center gap-2 mt-8 py-4 animate-fade-in">
      {/* Previous Page Button */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 border border-[var(--color-border-glass)] backdrop-blur-md select-none
          ${
            currentPage === 1
              ? 'opacity-40 cursor-not-allowed text-[var(--color-text-muted)] bg-transparent'
              : 'cursor-pointer bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-card-hover)] hover:border-[var(--color-border-glass-hover)] hover:scale-[1.02] active:scale-[0.98] text-[var(--color-text-primary)] shadow-sm'
          }`}
        aria-label={t('catalog.prevPage')}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
        </svg>
        <span>{t('catalog.prevPage')}</span>
      </button>

      {/* Page Numbers for Desktop Screen */}
      <div className="hidden sm:flex items-center gap-1.5">
        {pageNumbers.map((page, index) => {
          if (page === '...') {
            return (
              <span
                key={`ellipsis-${index}`}
                className="w-10 h-10 flex items-center justify-center text-sm font-semibold text-[var(--color-text-tertiary)] select-none"
              >
                &hellip;
              </span>
            );
          }

          const pageNum = page as number;
          const isActive = pageNum === currentPage;

          return (
            <button
              key={`page-${pageNum}`}
              onClick={() => onPageChange(pageNum)}
              className={`w-10 h-10 flex items-center justify-center rounded-xl text-sm font-bold transition-all duration-300 border select-none cursor-pointer
                ${
                  isActive
                    ? 'bg-gradient-to-br from-[var(--color-accent-primary)] to-[var(--color-accent-secondary)] border-transparent text-white shadow-md shadow-[oklch(0.55_0.25_285_/_0.2)] hover:scale-105 active:scale-95'
                    : 'bg-[var(--color-bg-card)] border-[var(--color-border-glass)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card-hover)] hover:border-[var(--color-border-glass-hover)] hover:scale-[1.05] active:scale-95'
                }`}
            >
              {pageNum}
            </button>
          );
        })}
      </div>

      {/* Compact Page Indicator for Mobile Screen */}
      <div className="block sm:hidden text-sm font-semibold text-[var(--color-text-secondary)] px-3 select-none">
        {currentPage} <span className="text-[var(--color-text-tertiary)]">/</span> {totalPages}
      </div>

      {/* Next Page Button */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 border border-[var(--color-border-glass)] backdrop-blur-md select-none
          ${
            currentPage === totalPages
              ? 'opacity-40 cursor-not-allowed text-[var(--color-text-muted)] bg-transparent'
              : 'cursor-pointer bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-card-hover)] hover:border-[var(--color-border-glass-hover)] hover:scale-[1.02] active:scale-[0.98] text-[var(--color-text-primary)] shadow-sm'
          }`}
        aria-label={t('catalog.nextPage')}
      >
        <span>{t('catalog.nextPage')}</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
