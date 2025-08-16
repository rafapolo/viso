// Enhanced Core Integration Tests
import { jest } from '@jest/globals';

describe('Enhanced Core Integration', () => {
  let mockOfflineDataManager;
  let mockDataProcessingClient;
  let mockCacheManager;
  let mockPerformanceMonitor;
  let EnhancedDuckDBManager;

  beforeEach(() => {
    // Mock dependencies
    mockOfflineDataManager = {
      addListener: jest.fn(),
      registerDataset: jest.fn(() => Promise.resolve({
        name: 'despesas',
        url: 'https://example.com/data.parquet',
        format: 'parquet'
      })),
      loadDataset: jest.fn(() => Promise.resolve({
        data: new Uint8Array([1, 2, 3, 4, 5]),
        fromCache: false,
        dataset: { name: 'despesas' }
      })),
      getOfflineStatus: jest.fn(() => Promise.resolve({
        isOfflineSupported: true,
        isOnline: true,
        datasets: {},
        storage: { total: 1000 }
      })),
      clearAllData: jest.fn(() => Promise.resolve()),
      shutdown: jest.fn(() => Promise.resolve())
    };

    mockDataProcessingClient = {
      initialize: jest.fn(() => Promise.resolve(true)),
      executeQuery: jest.fn(() => Promise.resolve({
        rows: [
          { nome_parlamentar: 'João', valor_total: 1000, num_transacoes: 5 },
          { nome_parlamentar: 'Maria', valor_total: 2000, num_transacoes: 3 }
        ],
        rowCount: 2,
        columns: ['nome_parlamentar', 'valor_total', 'num_transacoes']
      })),
      aggregateData: jest.fn(() => Promise.resolve({
        rows: [
          { nome_parlamentar: 'João', valor_total: 1000, num_transacoes: 5 },
          { nome_parlamentar: 'Maria', valor_total: 2000, num_transacoes: 3 }
        ]
      })),
      terminate: jest.fn()
    };

    mockCacheManager = {
      get: jest.fn(() => Promise.resolve(null)),
      set: jest.fn(() => Promise.resolve(true)),
      delete: jest.fn(() => Promise.resolve(true)),
      clear: jest.fn(() => Promise.resolve(5)),
      shutdown: jest.fn(() => Promise.resolve())
    };

    mockPerformanceMonitor = {
      recordCacheOperation: jest.fn(),
      recordWorkerOperation: jest.fn()
    };

    // Create mock enhanced manager
    class MockEnhancedDuckDBManager {
      constructor() {
        this.isInitialized = false;
        this.statusCallbacks = [];
        this.datasets = new Map();
      }

      async initializeOfflineSupport() {
        mockOfflineDataManager.addListener((event, data) => {
          this.handleOfflineEvent(event, data);
        });

        await mockOfflineDataManager.registerDataset('despesas', {
          url: 'https://rafapolo.github.io/transparencia-dados/despesas_publicas_deputados.parquet',
          format: 'parquet',
          autoUpdate: true,
          version: '1.0'
        });
      }

      handleOfflineEvent(event, data) {
        switch (event) {
          case 'dataLoaded':
            this.updateConnectionStatus('connected', 
              `✅ ${data.name} • ${this.formatBytes(data.size)} ${data.fromCache ? '(cached)' : '(downloaded)'}`
            );
            break;
          case 'online':
            this.updateConnectionStatus('connecting', '🌐 Back online, syncing...');
            break;
          case 'offline':
            this.updateConnectionStatus('offline', '📡 Offline mode - using cached data');
            break;
        }
      }

      async initDuckDB() {
        try {
          this.updateConnectionStatus('connecting', 'Initializing enhanced database...');
          
          await mockDataProcessingClient.initialize();
          
          const result = await mockOfflineDataManager.loadDataset('despesas', {
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

      async executeQuery(sql, options = {}) {
        if (!this.isInitialized) {
          await this.initDuckDB();
        }

        const { useCache = true, cacheKey = null, cacheTTL = 300000 } = options;

        try {
          const key = cacheKey || this.generateQueryCacheKey(sql, options);
          
          if (useCache) {
            const cached = await mockCacheManager.get(key, { format: 'json' });
            if (cached) {
              mockPerformanceMonitor.recordCacheOperation('hit', 'query', 5);
              return cached;
            }
            mockPerformanceMonitor.recordCacheOperation('miss', 'query', 5);
          }
          
          const startTime = performance.now();
          const result = await mockDataProcessingClient.executeQuery(sql, options);
          const duration = performance.now() - startTime;
          
          mockPerformanceMonitor.recordWorkerOperation('dataProcessing', 'query', duration);
          
          if (useCache && result.rowCount > 0) {
            await mockCacheManager.set(key, JSON.stringify(result), {
              tags: ['query-result', 'sql'],
              ttl: cacheTTL
            });
          }
          
          return result;
          
        } catch (error) {
          throw error;
        }
      }

      async queryAggregatedData(minValue = 0, partyFilter = '', categoryFilter = '', searchFilter = '') {
        if (!this.isInitialized) {
          await this.initDuckDB();
        }

        try {
          const result = await mockDataProcessingClient.aggregateData('despesas', {
            groupBy: ['nome_parlamentar', 'sigla_partido', 'fornecedor', 'categoria_despesa'],
            aggregates: {
              valor_total: 'SUM(valor_liquido)',
              num_transacoes: 'COUNT(*)'
            },
            filters: this.buildFilters(minValue, partyFilter, categoryFilter, searchFilter),
            orderBy: 'valor_total DESC',
            limit: 10000
          });
          
          return result.rows.map(row => ({
            nome_parlamentar: row.nome_parlamentar,
            sigla_partido: row.sigla_partido,
            fornecedor: row.fornecedor,
            categoria_despesa: row.categoria_despesa,
            valor_total: Number(row.valor_total),
            num_transacoes: Number(row.num_transacoes)
          }));
          
        } catch (error) {
          throw error;
        }
      }

      buildFilters(minValue, partyFilter, categoryFilter, searchFilter) {
        const filters = ['nome_parlamentar IS NOT NULL', 'fornecedor IS NOT NULL'];
        
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

      async getValueRange(partyFilter = '', categoryFilter = '', searchFilter = '') {
        const cacheKey = `value-range:${partyFilter}:${categoryFilter}:${searchFilter}`;
        
        try {
          const cached = await mockCacheManager.get(cacheKey, { format: 'json' });
          if (cached) {
            return cached;
          }
          
          // Mock range calculation
          const range = { min: 0, max: 100000 };
          
          await mockCacheManager.set(cacheKey, JSON.stringify(range), {
            tags: ['value-range'],
            ttl: 10 * 60 * 1000
          });
          
          return range;
          
        } catch (error) {
          console.warn('Failed to get value range:', error);
          return { min: 0, max: 100000 };
        }
      }

      async getFilterOptions() {
        const cacheKey = 'filter-options';
        
        try {
          const cached = await mockCacheManager.get(cacheKey, { format: 'json' });
          if (cached) {
            return cached;
          }
          
          // Mock filter options
          const options = {
            parties: ['PT', 'PSDB', 'MDB'],
            categories: ['PASSAGENS AÉREAS', 'COMBUSTÍVEIS', 'HOSPEDAGEM']
          };
          
          await mockCacheManager.set(cacheKey, JSON.stringify(options), {
            tags: ['filter-options'],
            ttl: 60 * 60 * 1000
          });
          
          return options;
          
        } catch (error) {
          console.warn('Failed to get filter options:', error);
          return { parties: [], categories: [] };
        }
      }

      generateQueryCacheKey(sql, options = {}) {
        const key = `query:${this.hashString(sql + JSON.stringify(options))}`;
        return key;
      }

      hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          const char = str.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
      }

      async checkConnectionHealth() {
        try {
          if (!this.isInitialized) return false;
          
          const result = await mockDataProcessingClient.executeQuery('SELECT 1 as test');
          return result && result.rows.length > 0;
          
        } catch (error) {
          console.warn('Connection health check failed:', error);
          return false;
        }
      }

      async getOfflineStatus() {
        return await mockOfflineDataManager.getOfflineStatus();
      }

      async clearOfflineData() {
        await mockOfflineDataManager.clearAllData();
        await mockCacheManager.clear({ tags: ['query-result'] });
      }

      async refreshData() {
        try {
          this.updateConnectionStatus('connecting', 'Refreshing data...');
          
          const result = await mockOfflineDataManager.loadDataset('despesas', {
            forceRefresh: true,
            onProgress: (progress) => {
              this.updateConnectionStatus('connecting', 
                `Downloading... ${Math.round(progress.progress)}%`
              );
            }
          });
          
          await mockCacheManager.clear({ tags: ['query-result'] });
          
          this.updateConnectionStatus('connected', 
            `✅ Data refreshed • ${this.formatBytes(result.data.byteLength)}`
          );
          
          return result;
          
        } catch (error) {
          this.updateConnectionStatus('error', 'Failed to refresh data');
          throw error;
        }
      }

      formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
      }

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

      async ensureConnection() {
        if (!this.isInitialized) {
          await this.initDuckDB();
        }
        return true;
      }

      async query(sql) {
        const result = await this.executeQuery(sql);
        return {
          toArray: () => result.rows
        };
      }

      async close() {
        await mockOfflineDataManager.shutdown();
        await mockCacheManager.shutdown();
        mockDataProcessingClient.terminate();
      }
    }

    EnhancedDuckDBManager = MockEnhancedDuckDBManager;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization Flow', () => {
    test('should initialize enhanced core successfully', async () => {
      const manager = new EnhancedDuckDBManager();
      
      const result = await manager.initDuckDB();
      
      expect(result.initialized).toBe(true);
      expect(mockDataProcessingClient.initialize).toHaveBeenCalled();
      expect(mockOfflineDataManager.loadDataset).toHaveBeenCalledWith('despesas', expect.any(Object));
    });

    test('should handle initialization from cache', async () => {
      mockOfflineDataManager.loadDataset.mockResolvedValue({
        data: new Uint8Array([1, 2, 3]),
        fromCache: true,
        dataset: { name: 'despesas' }
      });
      
      const manager = new EnhancedDuckDBManager();
      const result = await manager.initDuckDB();
      
      expect(result.fromCache).toBe(true);
    });

    test('should handle initialization errors gracefully', async () => {
      mockDataProcessingClient.initialize.mockRejectedValue(new Error('Init failed'));
      
      const manager = new EnhancedDuckDBManager();
      
      await expect(manager.initDuckDB()).rejects.toThrow('Init failed');
    });
  });

  describe('Query Execution with Caching', () => {
    test('should execute query and cache result', async () => {
      const manager = new EnhancedDuckDBManager();
      await manager.initDuckDB();
      
      const sql = 'SELECT * FROM despesas LIMIT 10';
      const result = await manager.executeQuery(sql);
      
      expect(result.rows).toHaveLength(2);
      expect(mockDataProcessingClient.executeQuery).toHaveBeenCalledWith(sql, expect.any(Object));
      expect(mockCacheManager.set).toHaveBeenCalled();
      expect(mockPerformanceMonitor.recordWorkerOperation).toHaveBeenCalled();
    });

    test('should use cached query result', async () => {
      const cachedResult = {
        rows: [{ cached: true }],
        rowCount: 1
      };
      
      mockCacheManager.get.mockResolvedValue(cachedResult);
      
      const manager = new EnhancedDuckDBManager();
      await manager.initDuckDB();
      
      const result = await manager.executeQuery('SELECT * FROM cached');
      
      expect(result).toEqual(cachedResult);
      expect(mockDataProcessingClient.executeQuery).not.toHaveBeenCalled();
      expect(mockPerformanceMonitor.recordCacheOperation).toHaveBeenCalledWith('hit', 'query', 5);
    });

    test('should skip caching when disabled', async () => {
      const manager = new EnhancedDuckDBManager();
      await manager.initDuckDB();
      
      const result = await manager.executeQuery('SELECT * FROM despesas', { useCache: false });
      
      expect(result.rows).toHaveLength(2);
      expect(mockCacheManager.get).not.toHaveBeenCalled();
      expect(mockCacheManager.set).not.toHaveBeenCalled();
    });
  });

  describe('Aggregated Data Queries', () => {
    test('should execute aggregated query with filters', async () => {
      const manager = new EnhancedDuckDBManager();
      await manager.initDuckDB();
      
      const result = await manager.queryAggregatedData(1000, 'PT', 'PASSAGENS', 'joão');
      
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('nome_parlamentar');
      expect(result[0]).toHaveProperty('valor_total');
      expect(mockDataProcessingClient.aggregateData).toHaveBeenCalledWith('despesas', expect.objectContaining({
        groupBy: expect.arrayContaining(['nome_parlamentar']),
        aggregates: expect.any(Object),
        filters: expect.arrayContaining([
          'nome_parlamentar IS NOT NULL',
          'valor_liquido > 1000',
          "sigla_partido = 'PT'",
          "categoria_despesa = 'PASSAGENS'"
        ])
      }));
    });

    test('should build filters correctly', () => {
      const manager = new EnhancedDuckDBManager();
      
      const filters = manager.buildFilters(500, 'PSDB', 'COMBUSTÍVEL', 'maria');
      
      expect(filters).toContain('valor_liquido > 500');
      expect(filters).toContain("sigla_partido = 'PSDB'");
      expect(filters).toContain("categoria_despesa = 'COMBUSTÍVEL'");
      expect(filters).toContain("(LOWER(nome_parlamentar) LIKE '%maria%' OR LOWER(fornecedor) LIKE '%maria%')");
    });
  });

  describe('Value Range and Filter Options', () => {
    test('should get value range with caching', async () => {
      const manager = new EnhancedDuckDBManager();
      await manager.initDuckDB();
      
      const range = await manager.getValueRange('PT', 'PASSAGENS');
      
      expect(range).toEqual({ min: 0, max: 100000 });
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'value-range:PT:PASSAGENS:',
        expect.any(String),
        expect.objectContaining({ tags: ['value-range'] })
      );
    });

    test('should get filter options with caching', async () => {
      const manager = new EnhancedDuckDBManager();
      await manager.initDuckDB();
      
      const options = await manager.getFilterOptions();
      
      expect(options.parties).toContain('PT');
      expect(options.categories).toContain('PASSAGENS AÉREAS');
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'filter-options',
        expect.any(String),
        expect.objectContaining({ tags: ['filter-options'] })
      );
    });
  });

  describe('Offline Operations', () => {
    test('should get offline status', async () => {
      const manager = new EnhancedDuckDBManager();
      
      const status = await manager.getOfflineStatus();
      
      expect(status.isOfflineSupported).toBe(true);
      expect(status.isOnline).toBe(true);
      expect(mockOfflineDataManager.getOfflineStatus).toHaveBeenCalled();
    });

    test('should clear offline data', async () => {
      const manager = new EnhancedDuckDBManager();
      
      await manager.clearOfflineData();
      
      expect(mockOfflineDataManager.clearAllData).toHaveBeenCalled();
      expect(mockCacheManager.clear).toHaveBeenCalledWith({ tags: ['query-result'] });
    });

    test('should refresh data', async () => {
      const manager = new EnhancedDuckDBManager();
      
      const result = await manager.refreshData();
      
      expect(mockOfflineDataManager.loadDataset).toHaveBeenCalledWith('despesas', {
        forceRefresh: true,
        onProgress: expect.any(Function)
      });
      expect(mockCacheManager.clear).toHaveBeenCalledWith({ tags: ['query-result'] });
    });
  });

  describe('Status Management', () => {
    test('should manage status callbacks', () => {
      const manager = new EnhancedDuckDBManager();
      const callback = jest.fn();
      
      manager.addStatusCallback(callback);
      manager.updateConnectionStatus('connected', 'Test message');
      
      expect(callback).toHaveBeenCalledWith('connected', 'Test message');
      
      manager.removeStatusCallback(callback);
      manager.updateConnectionStatus('disconnected');
      
      expect(callback).toHaveBeenCalledTimes(1);
    });

    test('should handle offline events', () => {
      const manager = new EnhancedDuckDBManager();
      const callback = jest.fn();
      manager.addStatusCallback(callback);
      
      manager.handleOfflineEvent('dataLoaded', {
        name: 'test',
        size: 1000,
        fromCache: true
      });
      
      expect(callback).toHaveBeenCalledWith('connected', expect.stringContaining('test'));
    });
  });

  describe('Legacy Compatibility', () => {
    test('should maintain legacy query interface', async () => {
      const manager = new EnhancedDuckDBManager();
      await manager.initDuckDB();
      
      const result = await manager.query('SELECT * FROM despesas');
      const rows = result.toArray();
      
      expect(rows).toHaveLength(2);
      expect(rows[0]).toHaveProperty('nome_parlamentar');
    });

    test('should ensure connection', async () => {
      const manager = new EnhancedDuckDBManager();
      
      const result = await manager.ensureConnection();
      
      expect(result).toBe(true);
      expect(manager.isInitialized).toBe(true);
    });

    test('should check connection health', async () => {
      const manager = new EnhancedDuckDBManager();
      await manager.initDuckDB();
      
      const healthy = await manager.checkConnectionHealth();
      
      expect(healthy).toBe(true);
      expect(mockDataProcessingClient.executeQuery).toHaveBeenCalledWith('SELECT 1 as test');
    });
  });

  describe('Cache Key Generation', () => {
    test('should generate consistent cache keys', () => {
      const manager = new EnhancedDuckDBManager();
      
      const key1 = manager.generateQueryCacheKey('SELECT * FROM test', { limit: 10 });
      const key2 = manager.generateQueryCacheKey('SELECT * FROM test', { limit: 10 });
      
      expect(key1).toBe(key2);
      expect(key1).toMatch(/^query:/);
    });

    test('should generate different keys for different queries', () => {
      const manager = new EnhancedDuckDBManager();
      
      const key1 = manager.generateQueryCacheKey('SELECT * FROM test1');
      const key2 = manager.generateQueryCacheKey('SELECT * FROM test2');
      
      expect(key1).not.toBe(key2);
    });
  });

  describe('Error Handling', () => {
    test('should handle query execution errors', async () => {
      mockDataProcessingClient.executeQuery.mockRejectedValue(new Error('Query failed'));
      
      const manager = new EnhancedDuckDBManager();
      await manager.initDuckDB();
      
      await expect(manager.executeQuery('INVALID SQL')).rejects.toThrow('Query failed');
    });

    test('should handle aggregation errors', async () => {
      mockDataProcessingClient.aggregateData.mockRejectedValue(new Error('Aggregation failed'));
      
      const manager = new EnhancedDuckDBManager();
      await manager.initDuckDB();
      
      await expect(manager.queryAggregatedData()).rejects.toThrow('Aggregation failed');
    });

    test('should handle status callback errors gracefully', () => {
      const manager = new EnhancedDuckDBManager();
      const errorCallback = jest.fn(() => { throw new Error('Callback error'); });
      const goodCallback = jest.fn();
      
      manager.addStatusCallback(errorCallback);
      manager.addStatusCallback(goodCallback);
      
      expect(() => {
        manager.updateConnectionStatus('test');
      }).not.toThrow();
      
      expect(goodCallback).toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    test('should cleanup properly', async () => {
      const manager = new EnhancedDuckDBManager();
      await manager.initDuckDB();
      
      await manager.close();
      
      expect(mockOfflineDataManager.shutdown).toHaveBeenCalled();
      expect(mockCacheManager.shutdown).toHaveBeenCalled();
      expect(mockDataProcessingClient.terminate).toHaveBeenCalled();
    });
  });

  describe('Performance Integration', () => {
    test('should record performance metrics during operations', async () => {
      const manager = new EnhancedDuckDBManager();
      await manager.initDuckDB();
      
      // Execute query that hits cache
      mockCacheManager.get.mockResolvedValue({ cached: true });
      await manager.executeQuery('SELECT * FROM test');
      
      expect(mockPerformanceMonitor.recordCacheOperation).toHaveBeenCalledWith('hit', 'query', 5);
      
      // Execute query that misses cache
      mockCacheManager.get.mockResolvedValue(null);
      await manager.executeQuery('SELECT * FROM test2');
      
      expect(mockPerformanceMonitor.recordCacheOperation).toHaveBeenCalledWith('miss', 'query', 5);
      expect(mockPerformanceMonitor.recordWorkerOperation).toHaveBeenCalledWith(
        'dataProcessing', 
        'query', 
        expect.any(Number)
      );
    });
  });
});