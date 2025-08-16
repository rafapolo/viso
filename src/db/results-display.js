// Results Display Management
import { DOMUtils } from '../shared/dom-utils.js';
import { DATA_TYPE_ICONS } from '../shared/constants.js';
import { ErrorHandler } from '../shared/error-handler.js';

export class ResultsDisplay {
  constructor(paginationHandler = null) {
    this.paginationHandler = paginationHandler;
  }

  /**
   * Display query results in table format
   * @param {Object} result - Query result object
   */
  displayResults(result) {
    const resultsContent = DOMUtils.getElementById('results');
    if (!resultsContent) {
      ErrorHandler.handleError('Results container not found', 'Results Display');
      return;
    }

    try {
      // Ensure the results container has proper classes for scrolling
      resultsContent.className = 'w-full h-full overflow-auto';

      if (result.rowCount === 0) {
        this.displayNoResults(resultsContent);
        return;
      }

      // Initialize pagination if handler is available
      if (this.paginationHandler) {
        this.paginationHandler.initializePagination(result);
      }

      // Get current page data
      const displayRows = this.paginationHandler 
        ? this.paginationHandler.getCurrentPageData()
        : result.data;

      // Create and display table
      const tableHTML = this.createTableHTML(result.columns, displayRows);
      DOMUtils.updateContent(resultsContent, tableHTML, true);

      // Update statistics
      this.updateResultStats(result);

    } catch (error) {
      ErrorHandler.handleError(error, 'Results Display');
      this.displayError(resultsContent, error.message);
    }
  }

  /**
   * Display message when no results found
   * @param {Element} container - Results container element
   */
  displayNoResults(container) {
    const noResultsHTML = `
      <div class="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 gap-2">
        <div class="text-2xl opacity-50">📄</div>
        <div>Nenhum resultado encontrado</div>
      </div>
    `;
    
    DOMUtils.updateContent(container, noResultsHTML, true);
    
    if (this.paginationHandler) {
      this.paginationHandler.hidePagination();
    }
  }

  /**
   * Display error message in results area
   * @param {Element} container - Results container element
   * @param {string} errorMessage - Error message to display
   */
  displayError(container, errorMessage) {
    const errorHTML = `
      <div class="flex flex-col items-center justify-center h-full text-red-500 dark:text-red-400 gap-2">
        <div class="text-2xl opacity-50">❌</div>
        <div>Erro ao exibir resultados</div>
        <div class="text-sm opacity-75">${errorMessage}</div>
      </div>
    `;
    
    DOMUtils.updateContent(container, errorHTML, true);
  }

  /**
   * Create HTML table from results data
   * @param {Array} columns - Column names
   * @param {Array} rows - Data rows
   * @returns {string} Table HTML
   */
  createTableHTML(columns, rows) {
    let tableHTML = '<div class="p-4"><table class="border-collapse text-xs" style="width: auto; min-width: max-content;">';
    
    // Headers
    tableHTML += '<thead><tr>';
    columns.forEach(col => {
      tableHTML += `
        <th class="bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 p-2 border-b border-r border-gray-300 dark:border-gray-700 font-medium text-left sticky top-0 z-10 whitespace-nowrap" style="min-width: 150px;">
          ${this.escapeHtml(col)}
        </th>
      `;
    });
    tableHTML += '</tr></thead>';
    
    // Rows
    tableHTML += '<tbody>';
    rows.forEach((row, _index) => {
      tableHTML += `<tr class="hover:bg-gray-100 dark:hover:bg-gray-900">`;
      columns.forEach(col => {
        const value = row[col];
        const displayValue = this.formatCellValue(value);
        tableHTML += `
          <td class="p-1.5 border-b border-r border-gray-300 dark:border-gray-700 whitespace-nowrap" style="min-width: 150px;">
            ${displayValue}
          </td>
        `;
      });
      tableHTML += '</tr>';
    });
    tableHTML += '</tbody></table></div>';
    
    return tableHTML;
  }

  /**
   * Format cell value for display
   * @param {any} value - Cell value to format
   * @returns {string} Formatted value HTML
   */
  formatCellValue(value) {
    if (value === null || value === undefined) {
      return '<span class="text-gray-500 dark:text-gray-400 italic">NULL</span>';
    }
    
    if (typeof value === 'number') {
      return value.toLocaleString();
    }
    
    const stringValue = String(value);
    
    // Truncate long strings
    if (stringValue.length > 100) {
      return `<span title="${this.escapeHtml(stringValue)}">${this.escapeHtml(stringValue.substring(0, 97))}...</span>`;
    }
    
    return this.escapeHtml(stringValue);
  }

  /**
   * Update result statistics display
   * @param {Object} result - Query result object
   */
  updateResultStats(result) {
    const resultStats = DOMUtils.getElementById('result-stats');
    const executionStats = DOMUtils.getElementById('execution-stats');
    
    if (resultStats) {
      DOMUtils.updateContent(resultStats, `${result.rowCount} linhas`, false);
    }
    
    if (executionStats) {
      const timeText = result.executionTime 
        ? `Consulta executada em ${result.executionTime.toFixed(2)}ms`
        : 'Consulta executada';
      DOMUtils.updateContent(executionStats, timeText, false);
    }
  }

  /**
   * Clear results display
   */
  clearResults() {
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

    // Clear stats
    DOMUtils.updateContent('execution-stats', 'despesas', false);
    DOMUtils.updateContent('result-stats', '', false);

    // Hide pagination
    if (this.paginationHandler) {
      this.paginationHandler.reset();
    }
  }

  /**
   * Display schema information
   * @param {Array} schema - Database schema
   */
  displaySchema(schema) {
    const schemaTree = DOMUtils.getElementById('schema-tree');
    if (!schemaTree) return;

    try {
      if (schema.length > 0) {
        const schemaHTML = `
          <div class="py-2 border-b border-gray-300 dark:border-gray-700">
            <div id="connection-status" class="text-xs text-red-500 dark:text-red-400">
              ❌ Desconectado
            </div>
          </div>
          ${schema.map(col => 
            `<div class="py-1 flex items-center gap-1.5 text-xs">
              <span class="w-3 h-3 opacity-60">${this.getDataTypeIcon(col.column_type)}</span>
              <span>${this.escapeHtml(col.column_name)}</span>
              <span class="text-gray-500 dark:text-gray-400 text-xs ml-auto">${this.escapeHtml(col.column_type)}</span>
            </div>`
          ).join('')}`;
        
        DOMUtils.updateContent(schemaTree, schemaHTML, true);
      } else {
        DOMUtils.updateContent(schemaTree, '<div class="text-red-500 dark:text-red-400">Falha ao carregar esquema</div>', true);
      }
    } catch (error) {
      ErrorHandler.handleError(error, 'Schema Display');
      DOMUtils.updateContent(schemaTree, '<div class="text-red-500 dark:text-red-400">Erro ao carregar esquema</div>', true);
    }
  }

  /**
   * Get data type icon for schema display
   * @param {string} columnType - Database column type
   * @returns {string} Icon emoji
   */
  getDataTypeIcon(columnType) {
    const type = columnType.toUpperCase();
    
    // String/Text types
    if (type.includes('VARCHAR') || type.includes('TEXT') || type.includes('CHAR') || type.includes('STRING')) {
      return DATA_TYPE_ICONS.STRING;
    }
    
    // Integer types
    if (type.includes('BIGINT') || type.includes('INTEGER') || type.includes('INT') || type.includes('TINYINT') || type.includes('SMALLINT')) {
      return DATA_TYPE_ICONS.INTEGER;
    }
    
    // Decimal/Float types
    if (type.includes('DOUBLE') || type.includes('FLOAT') || type.includes('REAL') || type.includes('DECIMAL') || type.includes('NUMERIC')) {
      return DATA_TYPE_ICONS.DECIMAL;
    }
    
    // Date/Time types
    if (type.includes('TIMESTAMP') || type.includes('DATETIME') || type.includes('DATE') || type.includes('TIME')) {
      return DATA_TYPE_ICONS.DATETIME;
    }
    
    // Boolean types
    if (type.includes('BOOLEAN') || type.includes('BOOL') || type.includes('BIT')) {
      return DATA_TYPE_ICONS.BOOLEAN;
    }
    
    // JSON/Object types
    if (type.includes('JSON') || type.includes('OBJECT')) {
      return DATA_TYPE_ICONS.JSON;
    }
    
    // Array/List types
    if (type.includes('ARRAY') || type.includes('LIST')) {
      return DATA_TYPE_ICONS.ARRAY;
    }
    
    // UUID types
    if (type.includes('UUID')) {
      return DATA_TYPE_ICONS.UUID;
    }
    
    // Binary/Blob types
    if (type.includes('BLOB') || type.includes('BINARY') || type.includes('VARBINARY')) {
      return DATA_TYPE_ICONS.BINARY;
    }
    
    // Default fallback
    return DATA_TYPE_ICONS.DEFAULT;
  }

  /**
   * Update connection status display
   * @param {string} message - Status message
   * @param {boolean} isError - Whether this is an error state
   */
  updateConnectionStatus(message, isError = false) {
    const statusEl = DOMUtils.getElementById('connection-status');
    if (statusEl) {
      const icon = isError ? '❌' : '✅';
      const className = isError 
        ? 'text-xs text-red-500 dark:text-red-400' 
        : 'text-xs text-duckdb-500';
      
      DOMUtils.updateContent(statusEl, `${icon} ${message}`, true);
      statusEl.className = className;
    }
  }

  /**
   * Set disconnected status
   */
  setDisconnectedStatus() {
    this.updateConnectionStatus('Desconectado', true);
  }

  /**
   * Escape HTML characters for safe display
   * @param {string} unsafe - Unsafe string
   * @returns {string} HTML-escaped string
   */
  escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
    
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Create summary statistics for results
   * @param {Object} result - Query results
   * @returns {Object} Summary statistics
   */
  createResultSummary(result) {
    if (!result || !result.data) return null;

    const summary = {
      totalRows: result.rowCount,
      columns: result.columns.length,
      executionTime: result.executionTime,
      dataTypes: {}
    };

    // Analyze data types from first few rows
    if (result.data.length > 0) {
      const sampleSize = Math.min(100, result.data.length);
      result.columns.forEach(col => {
        const sampleValues = result.data.slice(0, sampleSize).map(row => row[col]);
        summary.dataTypes[col] = this.analyzeColumnType(sampleValues);
      });
    }

    return summary;
  }

  /**
   * Analyze column data type from sample values
   * @param {Array} values - Sample column values
   * @returns {string} Detected data type
   */
  analyzeColumnType(values) {
    const nonNullValues = values.filter(v => v !== null && v !== undefined);
    if (nonNullValues.length === 0) return 'unknown';

    const firstValue = nonNullValues[0];
    
    if (typeof firstValue === 'number') {
      return Number.isInteger(firstValue) ? 'integer' : 'decimal';
    }
    
    if (typeof firstValue === 'boolean') {
      return 'boolean';
    }
    
    if (firstValue instanceof Date) {
      return 'datetime';
    }
    
    // Check if string looks like a date
    if (typeof firstValue === 'string') {
      const dateRegex = /^\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}/;
      if (dateRegex.test(firstValue)) {
        return 'datetime';
      }
    }
    
    return 'string';
  }
}