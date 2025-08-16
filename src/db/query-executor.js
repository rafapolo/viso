// Query Execution Management
import { APIUtils } from '../shared/api-utils.js';
import { ErrorHandler } from '../shared/error-handler.js';
import { DOMUtils } from '../shared/dom-utils.js';

export class QueryExecutor {
  constructor() {
    this.currentResults = null;
    this.isExecuting = false;
  }

  /**
   * Execute SQL query with error handling and UI updates
   * @param {string} sql - SQL query to execute
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<Object>} Query results
   */
  async executeQuery(sql, onProgress = null) {
    if (!sql || !sql.trim()) {
      throw new Error('Empty query provided');
    }

    if (this.isExecuting) {
      console.warn('Query already executing, skipping...');
      return null;
    }

    this.isExecuting = true;
    console.log('🔍 Starting query execution:', `${sql.substring(0, 100)}...`);
    
    try {
      // Update UI to show loading state
      this.showLoadingState();
      console.log('🔄 Loading state shown');
      
      if (onProgress) onProgress('Formatting query...');
      console.log('📝 Formatting SQL...');
      
      // Format the SQL before execution
      const formattedSQL = APIUtils.formatSQL(sql);
      
      if (onProgress) onProgress('Executing query...');
      console.log('⚡ Executing query via DuckDB API...');
      
      // Execute the query
      const result = await APIUtils.executeDuckDBQuery(formattedSQL);
      console.log('✅ Query executed, rows:', result.rowCount);
      
      if (onProgress) onProgress('Processing results...');
      console.log('🔄 Processing results...');
      
      // Store results
      this.currentResults = result;
      
      if (onProgress) onProgress(`Query completed - ${result.rowCount} rows`);
      
      return result;
      
    } catch (error) {
      ErrorHandler.handleDatabaseError(error, 'Query Execution');
      this.showErrorState(error.message);
      throw error;
    } finally {
      this.isExecuting = false;
      this.hideLoadingState();
    }
  }

  /**
   * Show loading state in UI
   */
  showLoadingState() {
    const runBtn = DOMUtils.getElementById('run-query-btn');
    const resultsContent = DOMUtils.getElementById('results');
    
    if (runBtn) {
      runBtn.disabled = true;
      DOMUtils.updateContent(runBtn, '<span class="loading-spinner"></span> Executando', true);
    }
    
    if (resultsContent) {
      DOMUtils.updateContent(
        resultsContent, 
        '<div class="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 gap-2"><span class="loading-spinner"></span><div>Executando consulta...</div></div>',
        true
      );
    }
  }

  /**
   * Hide loading state and reset UI
   */
  hideLoadingState() {
    console.log('🔄 Hiding loading state...');
    const runBtn = DOMUtils.getElementById('run-query-btn');
    
    if (runBtn) {
      runBtn.disabled = false;
      DOMUtils.updateContent(runBtn, '▶️ Executar', true);
      console.log('✅ Loading state hidden, button re-enabled');
    } else {
      console.warn('⚠️ Run button not found when hiding loading state');
    }
  }

  /**
   * Show error state in results area
   * @param {string} errorMessage - Error message to display
   */
  showErrorState(errorMessage) {
    const resultsContent = DOMUtils.getElementById('results');
    const executionStats = DOMUtils.getElementById('execution-stats');
    
    if (resultsContent) {
      const errorHTML = `
        <div class="bg-red-900/20 border border-red-500 text-red-200 p-3 m-3 rounded">
          <strong>Erro:</strong> ${errorMessage}
        </div>
      `;
      DOMUtils.updateContent(resultsContent, errorHTML, true);
    }
    
    if (executionStats) {
      DOMUtils.updateContent(executionStats, 'Consulta falhou', false);
    }
  }

  /**
   * Get current query results
   * @returns {Object|null} Current results
   */
  getCurrentResults() {
    return this.currentResults;
  }

  /**
   * Clear current results
   */
  clearResults() {
    this.currentResults = null;
    
    const resultsContent = DOMUtils.getElementById('results');
    if (resultsContent) {
      const clearHTML = `
        <div class="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 gap-2">
          <div class="text-5xl opacity-30">📊</div>
          <div>Execute uma consulta para ver os resultados</div>
        </div>
      `;
      DOMUtils.updateContent(resultsContent, clearHTML, true);
    }
    
    this.updateExecutionStats('despesas', '');
  }

  /**
   * Update execution statistics display
   * @param {string} status - Status message
   * @param {string} resultInfo - Result information
   */
  updateExecutionStats(status, resultInfo = '') {
    const executionStats = DOMUtils.getElementById('execution-stats');
    const resultStats = DOMUtils.getElementById('result-stats');
    
    if (executionStats) {
      DOMUtils.updateContent(executionStats, status, false);
    }
    
    if (resultStats) {
      DOMUtils.updateContent(resultStats, resultInfo, false);
    }
  }

  /**
   * Execute query from sample button
   * @param {Element} buttonElement - Button element that was clicked
   */
  async executeFromSampleButton(buttonElement) {
    const {query} = buttonElement.dataset;
    const analysisId = buttonElement.dataset.id;
    
    if (!query) {
      console.warn('No query found in button dataset');
      return;
    }

    try {
      // Reset filters if needed
      if (analysisId === 'top-categorias') {
        this.resetAllFilters();
      }
      
      // Update button selection state
      this.updateButtonSelection(buttonElement);
      
      // Format and execute query
      const formattedQuery = APIUtils.formatSQL(query);
      
      // Dispatch event to update editor
      document.dispatchEvent(new CustomEvent('updateEditor', {
        detail: { query: formattedQuery }
      }));
      
      // Update URL for sharing
      this.updateURLWithQuery(formattedQuery, buttonElement.textContent.trim(), analysisId);
      
      // Execute the query
      await this.executeQuery(formattedQuery);
      
    } catch (error) {
      ErrorHandler.handleError(error, 'Sample Query Execution');
    }
  }

  /**
   * Update button selection state
   * @param {Element} selectedButton - Button that was selected
   */
  updateButtonSelection(selectedButton) {
    // Remove selected class from all query buttons
    DOMUtils.getElements('.sample-query').forEach(button => {
      DOMUtils.removeClass(button, 'selected');
    });
    
    // Add selected class to clicked button
    DOMUtils.addClass(selectedButton, 'selected');
  }

  /**
   * Reset all filters (placeholder - should be implemented based on app needs)
   */
  resetAllFilters() {
    // Clear search input
    const searchInput = DOMUtils.getElementById('query-search');
    if (searchInput) {
      searchInput.value = '';
    }
    
    // Dispatch event for other components to handle filter reset
    document.dispatchEvent(new CustomEvent('resetFilters'));
  }

  /**
   * Update URL with query parameters for sharing
   * @param {string} query - SQL query
   * @param {string} analysisName - Analysis name
   * @param {string} analysisId - Analysis ID
   */
  updateURLWithQuery(query, analysisName, analysisId = null) {
    try {
      const url = new URL(window.location);
      
      // Clear old parameters
      url.searchParams.delete('query');
      url.searchParams.delete('name');
      url.searchParams.delete('analise');
      
      if (analysisId) {
        url.searchParams.set('analise', analysisId);
      } else {
        url.searchParams.set('query', btoa(encodeURIComponent(query)));
        url.searchParams.set('name', encodeURIComponent(analysisName));
      }
      
      // Update URL without page reload
      window.history.pushState({query, analysisName, analysisId}, analysisName, url);
      
    } catch (error) {
      ErrorHandler.handleError(error, 'URL Update');
    }
  }

  /**
   * Export current results to CSV
   * @param {string} filename - Output filename
   */
  exportResults(filename = 'query_results.csv') {
    if (!this.currentResults || !this.currentResults.data.length) {
      ErrorHandler.showUserError('Nenhum resultado para exportar', null, { type: 'warning' });
      return;
    }

    try {
      APIUtils.exportToCSV(this.currentResults, filename);
      ErrorHandler.showUserError(`Resultados exportados para ${filename}`, null, { 
        type: 'success',
        duration: 3000 
      });
    } catch (error) {
      ErrorHandler.handleError(error, 'CSV Export');
      ErrorHandler.showUserError('Falha ao exportar resultados', null, { type: 'error' });
    }
  }

  /**
   * Check if query is currently executing
   * @returns {boolean} Whether query is executing
   */
  isQueryExecuting() {
    return this.isExecuting;
  }

  /**
   * Validate SQL query before execution
   * @param {string} sql - SQL to validate
   * @returns {Object} Validation result
   */
  validateSQL(sql) {
    const errors = [];
    const warnings = [];
    
    if (!sql || !sql.trim()) {
      errors.push('Query cannot be empty');
    }
    
    // Basic SQL validation
    const sqlUpper = sql.toUpperCase().trim();
    
    // Check for dangerous operations
    const dangerousKeywords = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE', 'TRUNCATE'];
    dangerousKeywords.forEach(keyword => {
      if (sqlUpper.includes(keyword)) {
        warnings.push(`Query contains potentially dangerous keyword: ${keyword}`);
      }
    });
    
    // Check for SELECT statements
    if (!sqlUpper.startsWith('SELECT') && !sqlUpper.startsWith('WITH')) {
      warnings.push('Only SELECT queries are recommended');
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}