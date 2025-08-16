// Enhanced Core with Offline Support
// Integrates existing DuckDB functionality with new OPFS and Worker capabilities

import { OfflineDataManager } from './offline-manager.js';
import { DataProcessingWorkerClient, BackgroundSyncClient } from './enhanced-clients.js';
import { CacheManager } from './enhanced-storage.js';
import { ErrorHandler } from './error-handler.js';
import appConfig from './app-config.js';

// Re-export utilities from original core
export { FormatUtils, ColorUtils, DataUtils } from '../core.js';

export class EnhancedDuckDBManager {
  constructor() {
    this.isInitialized = false;
    this.statusCallbacks = [];
    this.datasets = new Map();
    
    // Initialize components
    this.offlineDataManager = new OfflineDataManager();
    this.dataProcessingWorkerClient = new DataProcessingWorkerClient();
    this.backgroundSyncClient = new BackgroundSyncClient();
    this.cacheManager = new CacheManager();
    
    // Initialize offline data manager
    this.initializeOfflineSupport();
  }

  /**
   * Initialize offline support
   */
  async initializeOfflineSupport() {
    try {
      // Setup offline data manager listeners
      this.offlineDataManager.addListener((event, data) => {
        this.handleOfflineEvent(event, data);
      });

      // Register default dataset
      await this.offlineDataManager.registerDataset('despesas', {
        url: 'https://rafapolo.github.io/transparencia-dados/despesas_publicas_deputados.parquet',
        format: 'parquet',
        autoUpdate: true,
        version: '1.0'
      });

      if (appConfig.development.enableLogging) {
        console.log('🚀 Enhanced Core initialized with offline support');
      }
      
    } catch (error) {
      console.warn('Failed to initialize offline support:', error);
    }
  }

  /**
   * Handle offline events
   */
  handleOfflineEvent(event, data) {
    switch (event) {
      case 'dataLoaded':
        this.updateConnectionStatus('connected', 
          `✅ ${data.name} • ${this.formatBytes(data.size)} ${data.fromCache ? '(cached)' : '(downloaded)'}`
        );
        break;
        
      case 'dataUpdated':
        this.updateConnectionStatus('connected', 
          `🔄 ${data.name} updated • ${this.formatBytes(data.size)}`
        );
        break;
        
      case 'online':
        this.updateConnectionStatus('connecting', '🌐 Back online, syncing...');
        break;
        
      case 'offline':
        this.updateConnectionStatus('offline', '📡 Offline mode - using cached data');
        break;
        
      case 'updateAvailable':
        this.updateConnectionStatus('update-available', 
          `🆕 Update available for ${data.name}`
        );
        break;
    }
  }

  /**
   * Initialize DuckDB with offline support
   */
  async initDuckDB() {
    try {
      this.updateConnectionStatus('connecting', 'Initializing enhanced database...');
      
      // Initialize workers first
      await this.dataProcessingWorkerClient.initialize();
      
      // Load data with progressive loading
      const result = await this.offlineDataManager.loadDataset('despesas', {
        onProgress: (progress) => {
          this.updateConnectionStatus('connecting', 
            `Loading data... ${Math.round(progress.progress)}%`
          );
        }
      });
      
      this.isInitialized = true;
      
      if (result.fromCache) {
        this.updateConnectionStatus('connected', 
          `✅ Loaded from cache • ${this.formatBytes(result.data.byteLength)}`
        );
      } else {
        this.updateConnectionStatus('connected', 
          `✅ Downloaded • ${this.formatBytes(result.data.byteLength)}`
        );
      }
      
      return { initialized: true, fromCache: result.fromCache };
      
    } catch (error) {
      console.error('❌ Error initializing enhanced DuckDB:', error);
      this.updateConnectionStatus('error', 'Failed to initialize database');
      throw error;
    }
  }

  /**
   * Enhanced query execution with caching
   */
  async executeQuery(sql, options = {}) {
    if (!this.isInitialized) {
      await this.initDuckDB();
    }

    const {
      useCache = true,
      cacheKey = null,
      cacheTTL = appConfig.performance.caching.maxAge
    } = options;

    try {
      // Generate cache key if not provided
      const key = cacheKey || this.generateQueryCacheKey(sql, options);
      
      if (useCache) {
        // Try cached result first
        const cached = await this.cacheManager.get(key, { format: 'json' });
        if (cached) {
          console.log(`🎯 Query cache hit: ${sql.substring(0, 50)}...`);
          return cached;
        }
      }
      
      // Execute query in worker
      const result = await this.dataProcessingWorkerClient.executeQuery(sql, options);
      
      // Cache result if caching is enabled
      if (useCache && result.rowCount > 0) {
        await this.cacheManager.set(key, JSON.stringify(result), {
          tags: ['query-result', 'sql'],
          ttl: cacheTTL
        });
      }
      
      return result;
      
    } catch (error) {
      ErrorHandler.handleError(error, 'Enhanced Query Execution');
      throw error;
    }
  }

  /**
   * Get aggregated data with enhanced caching
   */
  async queryAggregatedData(minValue = 0, partyFilter = '', categoryFilter = '', searchFilter = '') {
    if (!this.isInitialized) {
      await this.initDuckDB();
    }

    try {
      // Use data processing worker for aggregation
      const result = await this.dataProcessingWorkerClient.aggregateData('despesas', {
        groupBy: ['nome_parlamentar', 'sigla_partido', 'fornecedor', 'categoria_despesa'],
        aggregates: {
          valor_total: 'SUM(valor_liquido)',
          num_transacoes: 'COUNT(*)'
        },
        filters: this.buildFilters(minValue, partyFilter, categoryFilter, searchFilter),
        orderBy: 'valor_total DESC',
        limit: 10000
      });
      
      // Convert to expected format
      return result.rows.map(row => ({
        nome_parlamentar: row.nome_parlamentar,
        sigla_partido: row.sigla_partido,
        fornecedor: row.fornecedor,
        categoria_despesa: row.categoria_despesa,
        valor_total: Number(row.valor_total),
        num_transacoes: Number(row.num_transacoes)
      }));
      
    } catch (error) {
      ErrorHandler.handleError(error, 'Enhanced Aggregated Query');
      throw error;
    }
  }

  /**
   * Build filter conditions
   */
  buildFilters(minValue, partyFilter, categoryFilter, searchFilter) {
    const filters = [
      'nome_parlamentar IS NOT NULL',
      'fornecedor IS NOT NULL'
    ];
    
    if (minValue > 0) {
      filters.push(`valor_liquido > ${minValue}`);
    }
    
    if (partyFilter) {
      filters.push(`sigla_partido = '${partyFilter}'`);
    }
    
    if (categoryFilter) {
      filters.push(`categoria_despesa = '${categoryFilter}'`);
    }
    
    if (searchFilter) {
      const search = searchFilter.toLowerCase().replace(/'/g, "''");
      filters.push(`(LOWER(nome_parlamentar) LIKE '%${search}%' OR LOWER(fornecedor) LIKE '%${search}%')`);
    }
    
    return filters;
  }

  /**
   * Get value range with caching
   */
  async getValueRange(partyFilter = '', categoryFilter = '', searchFilter = '') {
    const cacheKey = `value-range:${partyFilter}:${categoryFilter}:${searchFilter}`;
    
    try {
      // Try cache first
      const cached = await this.cacheManager.get(cacheKey, { format: 'json' });
      if (cached) {
        return cached;
      }
      
      // Calculate using aggregation
      const result = await this.dataProcessingWorkerClient.aggregateData('despesas', {
        aggregates: {
          min_valor: 'MIN(grouped_total)',
          max_valor: 'MAX(grouped_total)'
        },
        // This would need a subquery - simplified for now
        filters: this.buildFilters(1000, partyFilter, categoryFilter, searchFilter)
      });
      
      const range = {
        min: Math.max(0, Number(result.rows[0]?.min_valor) || 0),
        max: Number(result.rows[0]?.max_valor) || 100000
      };
      
      // Cache result
      await this.cacheManager.set(cacheKey, JSON.stringify(range), {
        tags: ['value-range'],
        ttl: 10 * 60 * 1000 // 10 minutes
      });
      
      return range;
      
    } catch (error) {
      console.warn('Failed to get value range:', error);
      return { min: 0, max: 100000 };
    }
  }

  /**
   * Get filter options with caching
   */
  async getFilterOptions() {
    const cacheKey = 'filter-options';
    
    try {
      // Try cache first
      const cached = await this.cacheManager.get(cacheKey, { format: 'json' });
      if (cached) {
        return cached;
      }
      
      // Get distinct values using worker
      const [partiesResult, categoriesResult] = await Promise.all([
        this.dataProcessingWorkerClient.executeQuery(`
          SELECT DISTINCT sigla_partido 
          FROM despesas 
          WHERE sigla_partido IS NOT NULL 
          ORDER BY sigla_partido
        `),
        this.dataProcessingWorkerClient.executeQuery(`
          SELECT DISTINCT categoria_despesa 
          FROM despesas 
          WHERE categoria_despesa IS NOT NULL 
          ORDER BY categoria_despesa
        `)
      ]);
      
      const options = {
        parties: partiesResult.rows.map(r => r.sigla_partido),
        categories: categoriesResult.rows.map(r => r.categoria_despesa)
      };
      
      // Cache for 1 hour
      await this.cacheManager.set(cacheKey, JSON.stringify(options), {
        tags: ['filter-options'],
        ttl: 60 * 60 * 1000
      });
      
      return options;
      
    } catch (error) {
      console.warn('Failed to get filter options:', error);
      return { parties: [], categories: [] };
    }
  }

  /**
   * Generate cache key for queries
   */
  generateQueryCacheKey(sql, options = {}) {
    const key = `query:${this.hashString(sql + JSON.stringify(options))}`;
    return key;
  }

  /**
   * Simple hash function
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Check connection health
   */
  async checkConnectionHealth() {
    try {
      if (!this.isInitialized) return false;
      
      // Simple test query
      const result = await this.dataProcessingWorkerClient.executeQuery('SELECT 1 as test');
      return result && result.rows.length > 0;
      
    } catch (error) {
      console.warn('Connection health check failed:', error);
      return false;
    }
  }

  /**
   * Get offline status
   */
  async getOfflineStatus() {
    return await this.offlineDataManager.getOfflineStatus();
  }

  /**
   * Clear offline data
   */
  async clearOfflineData() {
    await this.offlineDataManager.clearAllData();
    await this.cacheManager.clear({ tags: ['query-result'] });
  }

  /**
   * Force data refresh
   */
  async refreshData() {
    try {
      this.updateConnectionStatus('connecting', 'Refreshing data...');
      
      const result = await this.offlineDataManager.loadDataset('despesas', {
        forceRefresh: true,
        onProgress: (progress) => {
          this.updateConnectionStatus('connecting', 
            `Downloading... ${Math.round(progress.progress)}%`
          );
        }
      });
      
      // Clear query cache to ensure fresh results
      await this.cacheManager.clear({ tags: ['query-result'] });
      
      this.updateConnectionStatus('connected', 
        `✅ Data refreshed • ${this.formatBytes(result.data.byteLength)}`
      );
      
      return result;
      
    } catch (error) {
      this.updateConnectionStatus('error', 'Failed to refresh data');
      throw error;
    }
  }

  /**
   * Format bytes
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  // Connection status methods (compatible with original)
  addStatusCallback(callback) {
    this.statusCallbacks.push(callback);
  }

  removeStatusCallback(callback) {
    this.statusCallbacks = this.statusCallbacks.filter(cb => cb !== callback);
  }

  updateConnectionStatus(status, message = '') {
    console.log(`🔌 Enhanced Status: ${status}${message ? ` - ${message}` : ''}`);
    
    this.statusCallbacks.forEach(callback => {
      try {
        callback(status, message);
      } catch (error) {
        console.error('Error in status callback:', error);
      }
    });
  }

  getConnectionStatus() {
    return this.isInitialized ? 'connected' : 'disconnected';
  }

  // Legacy method compatibility
  async ensureConnection() {
    if (!this.isInitialized) {
      await this.initDuckDB();
    }
    return true;
  }

  // Legacy method compatibility
  async query(sql) {
    const result = await this.executeQuery(sql);
    return {
      toArray: () => result.rows
    };
  }

  // Cleanup
  async close() {
    await this.offlineDataManager.shutdown();
    await this.cacheManager.shutdown();
    this.dataProcessingWorkerClient.terminate();
    this.backgroundSyncClient.terminate();
  }
}

// Create enhanced manager instance
const enhancedDuckDBManager = new EnhancedDuckDBManager();

// Export for compatibility with existing code
export { enhancedDuckDBManager };
export default enhancedDuckDBManager;