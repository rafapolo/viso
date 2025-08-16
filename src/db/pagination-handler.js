// Pagination Management
// import { APP_CONSTANTS } from '../shared/constants.js';
import { DOMUtils } from '../shared/dom-utils.js';

export class PaginationHandler {
  constructor() {
    this.currentPage = 1;
    this.totalPages = 0;
    this.currentResults = null;
    
    this.ROWS_PER_PAGE = 50; // APP_CONSTANTS.PAGINATION.ROWS_PER_PAGE;
    this.MAX_VISIBLE_PAGES = 7; // APP_CONSTANTS.PAGINATION.MAX_VISIBLE_PAGES;
  }

  /**
   * Initialize pagination for results
   * @param {Object} results - Query results
   */
  initializePagination(results) {
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

  /**
   * Show pagination controls
   */
  showPagination() {
    const paginationContainer = DOMUtils.getElementById('pagination-container');
    if (paginationContainer) {
      DOMUtils.removeClass(paginationContainer, 'hidden');
    }
  }

  /**
   * Hide pagination controls
   */
  hidePagination() {
    const paginationContainer = DOMUtils.getElementById('pagination-container');
    if (paginationContainer) {
      DOMUtils.addClass(paginationContainer, 'hidden');
    }
  }

  /**
   * Update pagination information display
   */
  updatePaginationInfo() {
    if (!this.currentResults) return;

    const startIndex = (this.currentPage - 1) * this.ROWS_PER_PAGE + 1;
    const endIndex = Math.min(this.currentPage * this.ROWS_PER_PAGE, this.currentResults.rowCount);

    DOMUtils.updateContent('pagination-start', startIndex.toLocaleString(), false);
    DOMUtils.updateContent('pagination-end', endIndex.toLocaleString(), false);
    DOMUtils.updateContent('pagination-total', this.currentResults.rowCount.toLocaleString(), false);
  }

  /**
   * Generate pagination buttons
   */
  generatePaginationButtons() {
    const paginationNav = DOMUtils.getElementById('pagination-nav');
    if (!paginationNav) return;

    // Update mobile buttons
    this.updateMobileButtons();

    let buttonsHTML = '';

    // Previous button
    buttonsHTML += this.createPreviousButton();

    // Calculate visible page range
    let startPage = Math.max(1, this.currentPage - Math.floor(this.MAX_VISIBLE_PAGES / 2));
    const endPage = Math.min(this.totalPages, startPage + this.MAX_VISIBLE_PAGES - 1);

    // Adjust start if we're near the end
    if (endPage - startPage < this.MAX_VISIBLE_PAGES - 1) {
      startPage = Math.max(1, endPage - this.MAX_VISIBLE_PAGES + 1);
    }

    // First page and ellipsis if needed
    if (startPage > 1) {
      buttonsHTML += this.createPageButton(1);
      if (startPage > 2) {
        buttonsHTML += this.createEllipsis();
      }
    }

    // Page numbers
    for (let i = startPage; i <= endPage; i++) {
      buttonsHTML += this.createPageButton(i, i === this.currentPage);
    }

    // Last page and ellipsis if needed
    if (endPage < this.totalPages) {
      if (endPage < this.totalPages - 1) {
        buttonsHTML += this.createEllipsis();
      }
      buttonsHTML += this.createPageButton(this.totalPages);
    }

    // Next button
    buttonsHTML += this.createNextButton();

    DOMUtils.updateContent(paginationNav, buttonsHTML, true);
  }

  /**
   * Create previous button HTML
   * @returns {string} Button HTML
   */
  createPreviousButton() {
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

  /**
   * Create next button HTML
   * @returns {string} Button HTML
   */
  createNextButton() {
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

  /**
   * Create page button HTML
   * @param {number} pageNumber - Page number
   * @param {boolean} isActive - Whether this is the current page
   * @returns {string} Button HTML
   */
  createPageButton(pageNumber, isActive = false) {
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

  /**
   * Create ellipsis HTML
   * @returns {string} Ellipsis HTML
   */
  createEllipsis() {
    return `
      <span class="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200">
        ...
      </span>
    `;
  }

  /**
   * Update mobile pagination buttons
   */
  updateMobileButtons() {
    const prevMobileBtn = DOMUtils.getElementById('pagination-prev-mobile');
    const nextMobileBtn = DOMUtils.getElementById('pagination-next-mobile');

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

  /**
   * Go to specific page
   * @param {number} page - Page number to go to
   */
  goToPage(page) {
    if (!this.currentResults || page < 1 || page > this.totalPages) {
      return;
    }

    this.currentPage = page;
    
    // Dispatch event to update results display
    document.dispatchEvent(new CustomEvent('pageChanged', {
      detail: { 
        page: this.currentPage,
        results: this.currentResults
      }
    }));

    // Update pagination info and buttons
    this.updatePaginationInfo();
    this.generatePaginationButtons();
  }

  /**
   * Get current page data slice
   * @returns {Array} Current page data
   */
  getCurrentPageData() {
    if (!this.currentResults) return [];

    const startIndex = (this.currentPage - 1) * this.ROWS_PER_PAGE;
    const endIndex = Math.min(startIndex + this.ROWS_PER_PAGE, this.currentResults.rowCount);
    
    return this.currentResults.data.slice(startIndex, endIndex);
  }

  /**
   * Get pagination info
   * @returns {Object} Pagination information
   */
  getPaginationInfo() {
    return {
      currentPage: this.currentPage,
      totalPages: this.totalPages,
      rowsPerPage: this.ROWS_PER_PAGE,
      totalRows: this.currentResults ? this.currentResults.rowCount : 0,
      startIndex: (this.currentPage - 1) * this.ROWS_PER_PAGE + 1,
      endIndex: Math.min(this.currentPage * this.ROWS_PER_PAGE, this.currentResults ? this.currentResults.rowCount : 0)
    };
  }

  /**
   * Setup event listeners for mobile pagination
   */
  setupMobileEventListeners() {
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

  /**
   * Reset pagination
   */
  reset() {
    this.currentPage = 1;
    this.totalPages = 0;
    this.currentResults = null;
    this.hidePagination();
  }

  /**
   * Check if pagination is needed
   * @param {number} totalRows - Total number of rows
   * @returns {boolean} Whether pagination is needed
   */
  static isPaginationNeeded(totalRows) {
    return totalRows > this.ROWS_PER_PAGE;
  }

  /**
   * Calculate total pages
   * @param {number} totalRows - Total number of rows
   * @returns {number} Total pages needed
   */
  static calculateTotalPages(totalRows) {
    return Math.ceil(totalRows / this.ROWS_PER_PAGE);
  }
}