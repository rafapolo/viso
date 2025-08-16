// API Utilities for DuckDB and other API interactions
import { APP_CONSTANTS } from './constants.js';

export class APIUtils {
  /**
   * Execute DuckDB query with error handling and timing
   * @param {string} sql - SQL query to execute
   * @returns {Promise<Object>} Query result with data, columns, timing
   */
  static async executeDuckDBQuery(sql) {
    if (!window.duckdbAPI) {
      throw new Error('DuckDB API not available');
    }

    try {
      const startTime = performance.now();
      const result = await window.duckdbAPI.executeQuery(sql);
      const endTime = performance.now();

      return {
        ...result,
        executionTime: endTime - startTime,
        success: true
      };
    } catch (error) {
      console.error('DuckDB query error:', error);
      throw new Error(`Query execution failed: ${error.message}`);
    }
  }

  /**
   * Initialize DuckDB with connection monitoring
   * @returns {Promise<Object>} Initialization result
   */
  static async initializeDuckDB() {
    if (!window.duckdbAPI) {
      throw new Error('DuckDB API not loaded');
    }

    try {
      await window.duckdbAPI.initDuckDB();
      return { success: true };
    } catch (error) {
      console.error('❌ DuckDB initialization failed:', error);
      throw new Error(`DuckDB initialization failed: ${error.message}`);
    }
  }

  /**
   * Load parquet data with progress tracking
   * @param {string} filePath - Path to parquet file
   * @param {Function} onProgress - Progress callback function
   * @returns {Promise<number>} Total number of records loaded
   */
  static async loadParquetData(filePath = './despesas.parquet', onProgress = null) {
    if (!window.duckdbAPI) {
      throw new Error('DuckDB API not available');
    }

    try {
      if (onProgress) onProgress('Loading parquet data...');
      
      const totalRecords = await window.duckdbAPI.loadParquetData(filePath);
      
      if (onProgress) onProgress(`Loaded ${totalRecords.toLocaleString()} records`);
      
      return totalRecords;
    } catch (error) {
      console.error('❌ Failed to load parquet data:', error);
      throw new Error(`Failed to load data: ${error.message}`);
    }
  }

  /**
   * Get database schema with error handling
   * @returns {Promise<Array>} Database schema information
   */
  static async getDatabaseSchema() {
    if (!window.duckdbAPI) {
      throw new Error('DuckDB API not available');
    }

    try {
      const schema = await window.duckdbAPI.getSchema();
      return schema;
    } catch (error) {
      console.error('❌ Failed to get database schema:', error);
      throw new Error(`Schema retrieval failed: ${error.message}`);
    }
  }

  /**
   * Wait for DuckDB API to be available
   * @param {number} maxAttempts - Maximum number of attempts
   * @param {number} intervalMs - Interval between attempts in milliseconds
   * @returns {Promise<boolean>} Whether API is available
   */
  static async waitForDuckDBAPI(
    maxAttempts = APP_CONSTANTS.TIMING.MAX_INIT_ATTEMPTS, 
    intervalMs = 100
  ) {
    let attempts = 0;
    
    while (typeof window.duckdbAPI === 'undefined' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, intervalMs));
      attempts++;
    }
    
    const isAvailable = typeof window.duckdbAPI !== 'undefined';
    
    if (!isAvailable) {
      console.error(`❌ DuckDB API not loaded after ${maxAttempts} attempts (${maxAttempts * intervalMs}ms)`);
    } else {
    }
    
    return isAvailable;
  }

  /**
   * Execute query with pagination
   * @param {string} baseQuery - Base SQL query
   * @param {number} page - Page number (1-based)
   * @param {number} pageSize - Number of rows per page
   * @returns {Promise<Object>} Paginated results
   */
  static async executePaginatedQuery(
    baseQuery, 
    page = 1, 
    pageSize = APP_CONSTANTS.PAGINATION.ROWS_PER_PAGE
  ) {
    const offset = (page - 1) * pageSize;
    const paginatedQuery = `${baseQuery} LIMIT ${pageSize} OFFSET ${offset}`;
    
    try {
      const result = await this.executeDuckDBQuery(paginatedQuery);
      
      return {
        ...result,
        currentPage: page,
        pageSize,
        hasMore: result.data.length === pageSize
      };
    } catch (error) {
      console.error('Paginated query error:', error);
      throw error;
    }
  }

  /**
   * Execute multiple queries in sequence
   * @param {Array<string>} queries - Array of SQL queries
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<Array>} Array of query results
   */
  static async executeMultipleQueries(queries, onProgress = null) {
    const results = [];
    
    for (let i = 0; i < queries.length; i++) {
      if (onProgress) {
        onProgress(`Executing query ${i + 1} of ${queries.length}...`);
      }
      
      try {
        const result = await this.executeDuckDBQuery(queries[i]);
        results.push(result);
      } catch (error) {
        console.error(`Query ${i + 1} failed:`, error);
        results.push({ success: false, error: error.message });
      }
    }
    
    return results;
  }

  /**
   * Check database connection health
   * @returns {Promise<boolean>} Whether connection is healthy
   */
  static async checkConnectionHealth() {
    try {
      // Simple query to test connection
      const result = await this.executeDuckDBQuery('SELECT 1 as test');
      return result.success && result.data.length > 0;
    } catch (error) {
      console.warn('Connection health check failed:', error);
      return false;
    }
  }

  /**
   * Build common filter queries
   * @param {Object} filters - Filter options
   * @returns {string} WHERE clause string
   */
  static buildFilterClause(filters = {}) {
    const conditions = [];
    
    const {
      minValue,
      maxValue,
      partyFilter,
      categoryFilter,
      searchFilter,
      dateRange
    } = filters;

    if (minValue !== undefined && minValue > 0) {
      conditions.push(`valor_liquido >= ${minValue}`);
    }
    
    if (maxValue !== undefined) {
      conditions.push(`valor_liquido <= ${maxValue}`);
    }
    
    if (partyFilter && partyFilter.trim()) {
      conditions.push(`sigla_partido = '${partyFilter.replace(/'/g, "''")}'`);
    }
    
    if (categoryFilter && categoryFilter.trim()) {
      conditions.push(`categoria_despesa = '${categoryFilter.replace(/'/g, "''")}'`);
    }
    
    if (searchFilter && searchFilter.trim()) {
      const searchTerm = searchFilter.replace(/'/g, "''");
      conditions.push(`(
        nome_parlamentar ILIKE '%${searchTerm}%' OR 
        fornecedor ILIKE '%${searchTerm}%' OR
        categoria_despesa ILIKE '%${searchTerm}%'
      )`);
    }
    
    if (dateRange && dateRange.start && dateRange.end) {
      conditions.push(`data_emissao BETWEEN '${dateRange.start}' AND '${dateRange.end}'`);
    }

    return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  }

  /**
   * Escape SQL string values
   * @param {string} value - String to escape
   * @returns {string} Escaped string
   */
  static escapeSQLString(value) {
    if (typeof value !== 'string') return value;
    return value.replace(/'/g, "''");
  }

  /**
   * Format SQL query for better readability
   * @param {string} sql - SQL query to format
   * @returns {string} Formatted SQL
   */
  static formatSQL(sql) {
    if (!sql || typeof sql !== 'string') return sql;
    
    try {
      if (typeof window.sqlFormatter !== 'undefined' && window.sqlFormatter.format) {
        return window.sqlFormatter.format(sql.trim(), {
          language: 'sql',
          indent: '    ',
          uppercase: true,
          linesBetweenQueries: 2
        });
      } else {
        console.warn('SQL formatter not available');
        return sql.trim();
      }
    } catch (error) {
      console.warn('SQL formatting error:', error);
      return sql.trim();
    }
  }

  /**
   * Export query results to CSV
   * @param {Object} results - Query results with data and columns
   * @param {string} filename - Output filename
   */
  static exportToCSV(results, filename = 'query_results.csv') {
    if (!results || !results.data || !results.columns) {
      throw new Error('Invalid results data for CSV export');
    }

    try {
      // Create CSV headers
      const headers = results.columns.join(',');
      
      // Create CSV rows
      const rows = results.data.map(row => 
        results.columns.map(col => {
          const value = row[col];
          if (value === null || value === undefined) return '';
          
          // Escape values containing commas or quotes
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          
          return value;
        }).join(',')
      );

      // Combine headers and rows
      const csvContent = [headers, ...rows].join('\n');

      // Create and trigger download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('CSV export failed:', error);
      throw new Error(`Failed to export CSV: ${error.message}`);
    }
  }

  /**
   * Create a retry wrapper for API calls
   * @param {Function} apiCall - Function to retry
   * @param {number} maxRetries - Maximum number of retries
   * @param {number} delayMs - Delay between retries
   * @returns {Function} Wrapped function with retry logic
   */
  static withRetry(apiCall, maxRetries = 3, delayMs = 1000) {
    return async (...args) => {
      let lastError;
      
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await apiCall(...args);
        } catch (error) {
          lastError = error;
          
          if (attempt < maxRetries) {
            console.warn(`API call failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying...`, error);
            await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, attempt)));
          }
        }
      }
      
      throw lastError;
    };
  }
}