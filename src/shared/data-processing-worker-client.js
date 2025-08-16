// Data Processing Worker Client
// Provides a clean API to interact with the Data Processing Worker

import { ErrorHandler } from './error-handler.js';
import appConfig from './app-config.js';

export class DataProcessingWorkerClient {
  static instance = null;
  
  constructor() {
    this.worker = null;
    this.messageId = 0;
    this.pendingMessages = new Map();
    this.isInitialized = false;
    this.registeredDatasets = new Set();
    
    this.initializeWorker();
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new DataProcessingWorkerClient();
    }
    return this.instance;
  }

  /**
   * Initialize the worker
   */
  initializeWorker() {
    try {
      const workerUrl = new URL('./workers/data-processing-worker.js', import.meta.url);
      this.worker = new Worker(workerUrl);
      
      this.worker.onmessage = (e) => this.handleMessage(e);
      this.worker.onerror = (error) => {
        ErrorHandler.handleError(error, 'Data Processing Worker Error');
      };
      
      if (appConfig.development.enableLogging) {
        console.log('🔧 Data Processing Worker initialized');
      }
    } catch (error) {
      ErrorHandler.handleError(error, 'Data Processing Worker Initialization');
      throw error;
    }
  }

  /**
   * Handle messages from worker
   */
  handleMessage(e) {
    const { id, type, result, error } = e.data;
    
    const pendingMessage = this.pendingMessages.get(id);
    if (!pendingMessage) return;
    
    this.pendingMessages.delete(id);
    
    if (type === 'success') {
      pendingMessage.resolve(result);
    } else if (type === 'error') {
      const workerError = new Error(error.message);
      workerError.name = error.name;
      workerError.stack = error.stack;
      pendingMessage.reject(workerError);
    }
  }

  /**
   * Send message to worker
   */
  sendMessage(type, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.messageId;
      
      this.pendingMessages.set(id, { resolve, reject });
      this.worker.postMessage({ id, type, ...params });
    });
  }

  /**
   * Initialize DuckDB in worker
   */
  async initialize() {
    if (this.isInitialized) return true;
    
    try {
      await this.sendMessage('initialize');
      this.isInitialized = true;
      
      if (appConfig.development.enableLogging) {
        console.log('🗄️ Data Processing Worker DuckDB initialized');
      }
      
      return true;
    } catch (error) {
      ErrorHandler.handleError(error, 'Data Processing Worker DuckDB Initialization');
      throw error;
    }
  }

  /**
   * Register data in DuckDB
   */
  async registerData(name, data, options = {}) {
    await this.initialize();
    
    try {
      const result = await this.sendMessage('register', { name, data, options });
      this.registeredDatasets.add(name);
      
      if (appConfig.development.enableLogging) {
        console.log(`📊 Registered dataset: ${name}`);
      }
      
      return result;
    } catch (error) {
      ErrorHandler.handleError(error, `Data Registration: ${name}`);
      throw error;
    }
  }

  /**
   * Execute SQL query
   */
  async executeQuery(sql, options = {}) {
    await this.initialize();
    
    try {
      const startTime = performance.now();
      const result = await this.sendMessage('query', { sql, options });
      const duration = performance.now() - startTime;
      
      if (appConfig.development.enablePerformanceMonitoring) {
        console.log(`⏱️ Query executed in ${duration.toFixed(2)}ms: ${sql.substring(0, 100)}...`);
      }
      
      return result;
    } catch (error) {
      ErrorHandler.handleError(error, 'Query Execution');
      throw error;
    }
  }

  /**
   * Get data statistics
   */
  async getDataStatistics(tableName, columnName = null) {
    await this.initialize();
    
    try {
      return await this.sendMessage('statistics', { tableName, columnName });
    } catch (error) {
      ErrorHandler.handleError(error, `Data Statistics: ${tableName}`);
      throw error;
    }
  }

  /**
   * Aggregate data for visualization
   */
  async aggregateData(tableName, options = {}) {
    await this.initialize();
    
    try {
      const startTime = performance.now();
      const result = await this.sendMessage('aggregate', { tableName, options });
      const duration = performance.now() - startTime;
      
      if (appConfig.development.enablePerformanceMonitoring) {
        console.log(`⏱️ Data aggregation completed in ${duration.toFixed(2)}ms`);
      }
      
      return result;
    } catch (error) {
      ErrorHandler.handleError(error, `Data Aggregation: ${tableName}`);
      throw error;
    }
  }

  /**
   * Process network data for visualization
   */
  async processNetworkData(tableName, options = {}) {
    await this.initialize();
    
    try {
      const startTime = performance.now();
      const result = await this.sendMessage('network', { tableName, options });
      const duration = performance.now() - startTime;
      
      if (appConfig.development.enablePerformanceMonitoring) {
        console.log(`⏱️ Network data processing completed in ${duration.toFixed(2)}ms`);
      }
      
      return result;
    } catch (error) {
      ErrorHandler.handleError(error, `Network Data Processing: ${tableName}`);
      throw error;
    }
  }

  /**
   * Generate time series data
   */
  async generateTimeSeries(tableName, options = {}) {
    await this.initialize();
    
    try {
      return await this.sendMessage('timeseries', { tableName, options });
    } catch (error) {
      ErrorHandler.handleError(error, `Time Series Generation: ${tableName}`);
      throw error;
    }
  }

  /**
   * Calculate complex metrics
   */
  async calculateMetrics(tableName, metrics = {}) {
    await this.initialize();
    
    try {
      return await this.sendMessage('metrics', { tableName, metrics });
    } catch (error) {
      ErrorHandler.handleError(error, `Metrics Calculation: ${tableName}`);
      throw error;
    }
  }

  /**
   * Cached query with automatic invalidation
   */
  async cachedQuery(sql, cacheKey, maxAge = appConfig.performance.caching.maxAge) {
    const cache = this.getQueryCache();
    const now = Date.now();
    
    // Check cache
    if (cache.has(cacheKey)) {
      const { data, timestamp } = cache.get(cacheKey);
      if (now - timestamp < maxAge) {
        if (appConfig.development.enableLogging) {
          console.log(`🎯 Query cache hit: ${cacheKey}`);
        }
        return data;
      }
    }
    
    // Execute query and cache result
    const result = await this.executeQuery(sql);
    cache.set(cacheKey, { data: result, timestamp: now });
    
    // Clean old cache entries
    this.cleanQueryCache();
    
    return result;
  }

  /**
   * Get query cache
   */
  getQueryCache() {
    if (!this.queryCache) {
      this.queryCache = new Map();
    }
    return this.queryCache;
  }

  /**
   * Clean old query cache entries
   */
  cleanQueryCache() {
    const cache = this.getQueryCache();
    const now = Date.now();
    const maxAge = appConfig.performance.caching.maxAge;
    
    for (const [key, { timestamp }] of cache.entries()) {
      if (now - timestamp > maxAge) {
        cache.delete(key);
      }
    }
  }

  /**
   * Clear query cache
   */
  clearQueryCache() {
    if (this.queryCache) {
      this.queryCache.clear();
    }
  }

  /**
   * Get worker status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      registeredDatasets: Array.from(this.registeredDatasets),
      pendingMessages: this.pendingMessages.size,
      cacheSize: this.queryCache ? this.queryCache.size : 0
    };
  }

  /**
   * Batch execute multiple queries
   */
  async batchExecute(queries) {
    await this.initialize();
    
    try {
      const startTime = performance.now();
      const promises = queries.map(({ sql, options = {} }) => 
        this.executeQuery(sql, options)
      );
      
      const results = await Promise.all(promises);
      const duration = performance.now() - startTime;
      
      if (appConfig.development.enablePerformanceMonitoring) {
        console.log(`⏱️ Batch execution of ${queries.length} queries completed in ${duration.toFixed(2)}ms`);
      }
      
      return results;
    } catch (error) {
      ErrorHandler.handleError(error, 'Batch Query Execution');
      throw error;
    }
  }

  /**
   * Create a query builder helper
   */
  createQueryBuilder(tableName) {
    return {
      table: tableName,
      
      select: (columns = '*') => {
        const cols = Array.isArray(columns) ? columns.join(', ') : columns;
        return { ...this, _select: cols };
      },
      
      where: (condition) => {
        return { ...this, _where: this._where ? `${this._where} AND ${condition}` : condition };
      },
      
      groupBy: (columns) => {
        const cols = Array.isArray(columns) ? columns.join(', ') : columns;
        return { ...this, _groupBy: cols };
      },
      
      orderBy: (column, direction = 'ASC') => {
        return { ...this, _orderBy: `${column} ${direction}` };
      },
      
      limit: (count, offset = 0) => {
        return { ...this, _limit: count, _offset: offset };
      },
      
      build: function() {
        let sql = `SELECT ${this._select || '*'} FROM ${this.table}`;
        
        if (this._where) sql += ` WHERE ${this._where}`;
        if (this._groupBy) sql += ` GROUP BY ${this._groupBy}`;
        if (this._orderBy) sql += ` ORDER BY ${this._orderBy}`;
        if (this._limit) {
          sql += ` LIMIT ${this._limit}`;
          if (this._offset) sql += ` OFFSET ${this._offset}`;
        }
        
        return sql;
      },
      
      execute: async function(options = {}) {
        const sql = this.build();
        return await this.executeQuery(sql, options);
      }.bind(this)
    };
  }

  /**
   * Terminate worker
   */
  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
      this.registeredDatasets.clear();
      
      // Reject all pending messages
      this.pendingMessages.forEach(({ reject }) => {
        reject(new Error('Worker terminated'));
      });
      this.pendingMessages.clear();
      
      // Clear cache
      this.clearQueryCache();
    }
  }
}

// Export singleton instance
export default DataProcessingWorkerClient.getInstance();