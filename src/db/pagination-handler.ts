// Pagination Management
import { DOMUtils } from '../shared/dom-utils.js';

interface QueryResults {
  rowCount: number;
  data: Record<string, unknown>[];
}

export class PaginationHandler {
  private currentPage: number;
  private totalPages: number;
  private currentResults: QueryResults | null;

  readonly ROWS_PER_PAGE = 50;
  readonly MAX_VISIBLE_PAGES = 7;

  constructor() {
    this.currentPage = 1;
    this.totalPages = 0;
    this.currentResults = null;
  }

  initializePagination(results: QueryResults): void {
    this.currentResults = results;
    this.currentPage = 1;
    this.totalPages = Math.ceil(results.rowCount / this.ROWS_PER_PAGE);

    if (results.rowCount > this.ROWS_PER_PAGE) {
      this.showPagination();
      this.updatePaginationInfo();
      this.generatePaginationButtons();
    } else {
      this.hidePagination();
    }
  }

  showPagination(): void {
    const paginationContainer = DOMUtils.getElementById('pagination-container');
    if (paginationContainer) {
      DOMUtils.removeClass(paginationContainer, 'hidden');
    }
  }

  hidePagination(): void {
    const paginationContainer = DOMUtils.getElementById('pagination-container');
    if (paginationContainer) {
      DOMUtils.addClass(paginationContainer, 'hidden');
    }
  }

  updatePaginationInfo(): void {
    if (!this.currentResults) return;

    const startIndex = (this.currentPage - 1) * this.ROWS_PER_PAGE + 1;
    const endIndex = Math.min(this.currentPage * this.ROWS_PER_PAGE, this.currentResults.rowCount);

    DOMUtils.updateContent('pagination-start', startIndex.toLocaleString(), false);
    DOMUtils.updateContent('pagination-end', endIndex.toLocaleString(), false);
    DOMUtils.updateContent('pagination-total', this.currentResults.rowCount.toLocaleString(), false);
  }

  generatePaginationButtons(): void {
    const paginationNav = DOMUtils.getElementById('pagination-nav');
    if (!paginationNav) return;

    this.updateMobileButtons();

    let buttonsHTML = '';

    buttonsHTML += this.createPreviousButton();

    let startPage = Math.max(1, this.currentPage - Math.floor(this.MAX_VISIBLE_PAGES / 2));
    const endPage = Math.min(this.totalPages, startPage + this.MAX_VISIBLE_PAGES - 1);

    if (endPage - startPage < this.MAX_VISIBLE_PAGES - 1) {
      startPage = Math.max(1, endPage - this.MAX_VISIBLE_PAGES + 1);
    }

    if (startPage > 1) {
      buttonsHTML += this.createPageButton(1);
      if (startPage > 2) {
        buttonsHTML += this.createEllipsis();
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      buttonsHTML += this.createPageButton(i, i === this.currentPage);
    }

    if (endPage < this.totalPages) {
      if (endPage < this.totalPages - 1) {
        buttonsHTML += this.createEllipsis();
      }
      buttonsHTML += this.createPageButton(this.totalPages);
    }

    buttonsHTML += this.createNextButton();

    DOMUtils.updateContent(paginationNav, buttonsHTML, true);
  }

  createPreviousButton(): string {
    const isDisabled = this.currentPage === 1;
    return `
      <button onclick="window.paginationHandler.goToPage(${this.currentPage - 1})"
              class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 ${isDisabled ? 'cursor-not-allowed opacity-50' : ''}"
              ${isDisabled ? 'disabled' : ''}>
        <span class="sr-only">Anterior</span>
        <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" />
        </svg>
      </button>
    `;
  }

  createNextButton(): string {
    const isDisabled = this.currentPage === this.totalPages;
    return `
      <button onclick="window.paginationHandler.goToPage(${this.currentPage + 1})"
              class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 ${isDisabled ? 'cursor-not-allowed opacity-50' : ''}"
              ${isDisabled ? 'disabled' : ''}>
        <span class="sr-only">Próximo</span>
        <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
        </svg>
      </button>
    `;
  }

  createPageButton(pageNumber: number, isActive = false): string {
    const activeClasses = isActive
      ? 'z-10 bg-duckdb-500 border-duckdb-500 text-black'
      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700';

    return `
      <button onclick="window.paginationHandler.goToPage(${pageNumber})"
              class="relative inline-flex items-center px-4 py-2 border text-sm font-medium ${activeClasses}">
        ${pageNumber}
      </button>
    `;
  }

  createEllipsis(): string {
    return `
      <span class="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200">
        ...
      </span>
    `;
  }

  updateMobileButtons(): void {
    const prevMobileBtn = DOMUtils.getElementById('pagination-prev-mobile') as HTMLButtonElement | null;
    const nextMobileBtn = DOMUtils.getElementById('pagination-next-mobile') as HTMLButtonElement | null;

    if (prevMobileBtn) {
      const isPrevDisabled = this.currentPage === 1;
      prevMobileBtn.disabled = isPrevDisabled;
      DOMUtils.toggleClass(prevMobileBtn, 'opacity-50', isPrevDisabled);
      DOMUtils.toggleClass(prevMobileBtn, 'cursor-not-allowed', isPrevDisabled);
    }

    if (nextMobileBtn) {
      const isNextDisabled = this.currentPage === this.totalPages;
      nextMobileBtn.disabled = isNextDisabled;
      DOMUtils.toggleClass(nextMobileBtn, 'opacity-50', isNextDisabled);
      DOMUtils.toggleClass(nextMobileBtn, 'cursor-not-allowed', isNextDisabled);
    }
  }

  goToPage(page: number): void {
    if (!this.currentResults || page < 1 || page > this.totalPages) {
      return;
    }

    this.currentPage = page;

    document.dispatchEvent(new CustomEvent('pageChanged', {
      detail: {
        page: this.currentPage,
        results: this.currentResults,
      },
    }));

    this.updatePaginationInfo();
    this.generatePaginationButtons();
  }

  getCurrentPageData(): Record<string, unknown>[] {
    if (!this.currentResults) return [];

    const startIndex = (this.currentPage - 1) * this.ROWS_PER_PAGE;
    const endIndex = Math.min(startIndex + this.ROWS_PER_PAGE, this.currentResults.rowCount);

    return this.currentResults.data.slice(startIndex, endIndex);
  }

  getPaginationInfo(): {
    currentPage: number;
    totalPages: number;
    rowsPerPage: number;
    totalRows: number;
    startIndex: number;
    endIndex: number;
  } {
    return {
      currentPage: this.currentPage,
      totalPages: this.totalPages,
      rowsPerPage: this.ROWS_PER_PAGE,
      totalRows: this.currentResults ? this.currentResults.rowCount : 0,
      startIndex: (this.currentPage - 1) * this.ROWS_PER_PAGE + 1,
      endIndex: Math.min(
        this.currentPage * this.ROWS_PER_PAGE,
        this.currentResults ? this.currentResults.rowCount : 0
      ),
    };
  }

  setupMobileEventListeners(): void {
    const prevMobileBtn = DOMUtils.getElementById('pagination-prev-mobile');
    const nextMobileBtn = DOMUtils.getElementById('pagination-next-mobile');

    if (prevMobileBtn) {
      DOMUtils.addEventListener(prevMobileBtn, 'click', () => {
        this.goToPage(this.currentPage - 1);
      });
    }

    if (nextMobileBtn) {
      DOMUtils.addEventListener(nextMobileBtn, 'click', () => {
        this.goToPage(this.currentPage + 1);
      });
    }
  }

  reset(): void {
    this.currentPage = 1;
    this.totalPages = 0;
    this.currentResults = null;
    this.hidePagination();
  }
}
