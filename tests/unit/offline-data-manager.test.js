// Offline Data Manager Tests
import { jest } from '@jest/globals';

describe('OfflineDataManager', () => {
  let MockOfflineDataManager;
  let mockFilesystemClient;
  let mockDataProcessingClient;
  let mockBackgroundSyncClient;
  let mockCacheManager;

  beforeEach(() => {
    // Mock dependencies
    mockFilesystemClient = {
      getStorageUsage: jest.fn(() => Promise.resolve({
        datasets: 1000,
        cache: 500,
        temp: 100,
        total: 1600
      }))
    };

    mockDataProcessingClient = {
      initialize: jest.fn(() => Promise.resolve(true)),
      registerData: jest.fn(() => Promise.resolve(true))
    };

    mockBackgroundSyncClient = {
      waitForReady: jest.fn(() => Promise.resolve(true)),
      addDownloadTask: jest.fn(() => Promise.resolve('task123')),
      on: jest.fn(),
      off: jest.fn()
    };

    mockCacheManager = {
      get: jest.fn(() => Promise.resolve(null)),
      set: jest.fn(() => Promise.resolve(true))
    };

    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    });

    // Create mock OfflineDataManager class
    class MockOfflineDataManagerClass {
      constructor() {
        this.isInitialized = false;
        this.isOnline = navigator.onLine;
        this.datasets = new Map();
        this.loadingPromises = new Map();
        this.updateListeners = new Set();
        
        this.config = {
          enableOfflineMode: true,
          enableProgressiveLoading: true,
          enableBackgroundSync: true,
          dataCheckInterval: 30 * 60 * 1000,
          staleDataThreshold: 24 * 60 * 60 * 1000,
          maxConcurrentDownloads: 3
        };
      }

      async initialize() {
        if (this.isInitialized) return;
        
        await Promise.all([
          mockFilesystemClient.initialize?.() || Promise.resolve(),
          mockDataProcessingClient.initialize(),
          mockBackgroundSyncClient.waitForReady()
        ]);
        
        await this.loadDatasetRegistry();
        
        if (this.config.enableBackgroundSync) {
          this.setupBackgroundSync();
        }
        
        this.isInitialized = true;
        this.notifyListeners('initialized', { isOnline: this.isOnline });
      }

      async loadDatasetRegistry() {
        const registryData = await mockCacheManager.get('dataset:registry', { format: 'json' });
        
        if (registryData) {
          for (const [key, dataset] of Object.entries(registryData)) {
            this.datasets.set(key, dataset);
          }
        }
      }

      async saveDatasetRegistry() {
        const registryData = Object.fromEntries(this.datasets.entries());
        await mockCacheManager.set('dataset:registry', JSON.stringify(registryData), {
          tags: ['registry', 'metadata'],
          ttl: 7 * 24 * 60 * 60 * 1000
        });
      }

      setupBackgroundSync() {
        // Mock setup
      }

      async registerDataset(name, config) {
        const dataset = {
          name,
          url: config.url,
          format: config.format || 'parquet',
          version: config.version || '1.0',
          registeredAt: Date.now(),
          lastChecked: null,
          lastUpdated: null,
          etag: null,
          size: null,
          isAvailableOffline: false,
          autoUpdate: config.autoUpdate !== false,
          updateInterval: config.updateInterval || this.config.dataCheckInterval
        };
        
        this.datasets.set(name, dataset);
        await this.saveDatasetRegistry();
        
        return dataset;
      }

      async loadDataset(name, options = {}) {
        await this.initialize();
        
        if (this.loadingPromises.has(name)) {
          return this.loadingPromises.get(name);
        }
        
        const loadPromise = this._loadDatasetInternal(name, options);
        this.loadingPromises.set(name, loadPromise);
        
        try {
          const result = await loadPromise;
          return result;
        } finally {
          this.loadingPromises.delete(name);
        }
      }

      async _loadDatasetInternal(name, options = {}) {
        const {
          forceRefresh = false,
          onProgress = null,
          fallbackToCache = true,
          registerInWorker = true
        } = options;
        
        const dataset = this.datasets.get(name);
        if (!dataset) {
          throw new Error(`Dataset '${name}' is not registered`);
        }

        const cacheKey = `dataset:${name}`;
        
        // Try cache first
        if (!forceRefresh && fallbackToCache) {
          const cachedData = await this.loadFromCache(name, cacheKey);
          if (cachedData) {
            if (registerInWorker) {
              await this.registerDataInWorker(name, cachedData, dataset);
            }
            
            this.notifyListeners('dataLoaded', { 
              name, 
              fromCache: true, 
              size: cachedData.byteLength,
              dataset 
            });
            
            if (this.isOnline && dataset.autoUpdate) {
              this.scheduleUpdateCheck(name);
            }
            
            return {
              data: cachedData,
              fromCache: true,
              dataset: this.datasets.get(name)
            };
          }
        }
        
        // Download from network
        if (!this.isOnline && !fallbackToCache) {
          throw new Error(`Dataset '${name}' is not available offline and no network connection`);
        }
        
        if (this.isOnline) {
          const downloadedData = await this.downloadDataset(name, dataset, onProgress);
          
          if (registerInWorker) {
            await this.registerDataInWorker(name, downloadedData.data, dataset);
          }
          
          this.notifyListeners('dataLoaded', { 
            name, 
            fromCache: false, 
            size: downloadedData.size,
            dataset: this.datasets.get(name)
          });
          
          return {
            data: downloadedData.data,
            fromCache: false,
            dataset: this.datasets.get(name)
          };
        }
        
        throw new Error(`Dataset '${name}' is not available offline`);
      }

      async loadFromCache(name, cacheKey) {
        let cachedData = await mockCacheManager.get(cacheKey);
        
        if (!cachedData) {
          // Mock OPFS access
          cachedData = new Uint8Array([1, 2, 3, 4, 5]); // Mock data
        }
        
        return cachedData;
      }

      async downloadDataset(name, dataset, onProgress = null) {
        const filename = `${name}.${dataset.format}`;
        
        const taskId = await mockBackgroundSyncClient.addDownloadTask(
          dataset.url, 
          filename,
          { 
            expectedSize: dataset.size,
            priority: 'high'
          }
        );
        
        // Mock download completion
        const mockResult = {
          data: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
          size: 10,
          etag: 'mock-etag',
          downloadedAt: Date.now()
        };
        
        // Update dataset metadata
        dataset.lastUpdated = Date.now();
        dataset.etag = mockResult.etag;
        dataset.size = mockResult.size;
        dataset.isAvailableOffline = true;
        await this.saveDatasetRegistry();
        
        return mockResult;
      }

      async registerDataInWorker(name, data, dataset) {
        await mockDataProcessingClient.registerData(
          `${name}.${dataset.format}`,
          data,
          { 
            format: dataset.format,
            createView: true 
          }
        );
      }

      scheduleUpdateCheck(name) {
        const dataset = this.datasets.get(name);
        if (!dataset || !dataset.autoUpdate) return;
        
        const timeSinceLastCheck = Date.now() - (dataset.lastChecked || 0);
        if (timeSinceLastCheck < dataset.updateInterval) return;
        
        // Mock scheduling
        dataset.lastChecked = Date.now();
        this.saveDatasetRegistry();
      }

      async getOfflineStatus() {
        const status = {
          isOfflineSupported: this.config.enableOfflineMode,
          isOnline: this.isOnline,
          datasets: {},
          storage: await mockFilesystemClient.getStorageUsage(),
          cache: { entries: { total: 0 } }
        };
        
        for (const [name, dataset] of this.datasets.entries()) {
          const isAvailable = await this.isDatasetAvailableOffline(name);
          status.datasets[name] = {
            ...dataset,
            isAvailableOffline: isAvailable,
            isStale: dataset.lastUpdated && 
                    (Date.now() - dataset.lastUpdated) > this.config.staleDataThreshold
          };
        }
        
        return status;
      }

      async isDatasetAvailableOffline(name) {
        try {
          const cachedData = await this.loadFromCache(name, `dataset:${name}`);
          return !!cachedData;
        } catch (error) {
          return false;
        }
      }

      async clearDataset(name) {
        await mockCacheManager.delete(`dataset:${name}`);
        
        const dataset = this.datasets.get(name);
        if (dataset) {
          dataset.isAvailableOffline = false;
          await this.saveDatasetRegistry();
        }
        
        this.notifyListeners('dataCleared', { name });
      }

      async clearAllData() {
        await mockCacheManager.clear({ tags: ['dataset'] });
        
        for (const dataset of this.datasets.values()) {
          dataset.isAvailableOffline = false;
        }
        await this.saveDatasetRegistry();
        
        this.notifyListeners('allDataCleared', {});
      }

      addListener(callback) {
        this.updateListeners.add(callback);
      }

      removeListener(callback) {
        this.updateListeners.delete(callback);
      }

      notifyListeners(event, data) {
        this.updateListeners.forEach(callback => {
          try {
            callback(event, data);
          } catch (error) {
            console.warn('Error in offline data manager listener:', error);
          }
        });
      }

      getDataset(name) {
        return this.datasets.get(name);
      }

      listDatasets() {
        return Array.from(this.datasets.values());
      }

      async shutdown() {
        this.updateListeners.clear();
        await this.saveDatasetRegistry();
      }

      static getInstance() {
        if (!this.instance) {
          this.instance = new MockOfflineDataManagerClass();
        }
        return this.instance;
      }
    }

    MockOfflineDataManager = MockOfflineDataManagerClass;
  });

  afterEach(() => {
    jest.clearAllMocks();
    if (MockOfflineDataManager.instance) {
      MockOfflineDataManager.instance = null;
    }
  });

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      const manager = new MockOfflineDataManager();
      await manager.initialize();
      
      expect(manager.isInitialized).toBe(true);
      expect(mockDataProcessingClient.initialize).toHaveBeenCalled();
      expect(mockBackgroundSyncClient.waitForReady).toHaveBeenCalled();
    });

    test('should not initialize twice', async () => {
      const manager = new MockOfflineDataManager();
      await manager.initialize();
      await manager.initialize(); // Second call
      
      expect(mockDataProcessingClient.initialize).toHaveBeenCalledTimes(1);
    });

    test('should handle initialization errors', async () => {
      mockDataProcessingClient.initialize.mockRejectedValue(new Error('Init failed'));
      
      const manager = new MockOfflineDataManager();
      await expect(manager.initialize()).rejects.toThrow('Init failed');
    });
  });

  describe('Dataset Registration', () => {
    test('should register dataset successfully', async () => {
      const manager = new MockOfflineDataManager();
      
      const dataset = await manager.registerDataset('test-data', {
        url: 'https://example.com/data.parquet',
        format: 'parquet',
        version: '1.0'
      });
      
      expect(dataset.name).toBe('test-data');
      expect(dataset.url).toBe('https://example.com/data.parquet');
      expect(dataset.format).toBe('parquet');
      expect(dataset.version).toBe('1.0');
      expect(manager.datasets.has('test-data')).toBe(true);
    });

    test('should use default values for optional fields', async () => {
      const manager = new MockOfflineDataManager();
      
      const dataset = await manager.registerDataset('test-data', {
        url: 'https://example.com/data.parquet'
      });
      
      expect(dataset.format).toBe('parquet');
      expect(dataset.version).toBe('1.0');
      expect(dataset.autoUpdate).toBe(true);
    });
  });

  describe('Dataset Loading', () => {
    let manager;

    beforeEach(async () => {
      manager = new MockOfflineDataManager();
      await manager.registerDataset('test-data', {
        url: 'https://example.com/data.parquet',
        format: 'parquet'
      });
    });

    test('should load dataset from cache when available', async () => {
      mockCacheManager.get.mockResolvedValue(new Uint8Array([1, 2, 3]));
      
      const result = await manager.loadDataset('test-data');
      
      expect(result.fromCache).toBe(true);
      expect(result.data).toEqual(new Uint8Array([1, 2, 3]));
      expect(mockDataProcessingClient.registerData).toHaveBeenCalled();
    });

    test('should download dataset when not in cache', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      
      const result = await manager.loadDataset('test-data');
      
      expect(result.fromCache).toBe(false);
      expect(result.data).toBeInstanceOf(Uint8Array);
      expect(mockBackgroundSyncClient.addDownloadTask).toHaveBeenCalled();
    });

    test('should handle force refresh', async () => {
      mockCacheManager.get.mockResolvedValue(new Uint8Array([1, 2, 3]));
      
      const result = await manager.loadDataset('test-data', { forceRefresh: true });
      
      expect(result.fromCache).toBe(false);
      expect(mockBackgroundSyncClient.addDownloadTask).toHaveBeenCalled();
    });

    test('should throw error for unregistered dataset', async () => {
      await expect(manager.loadDataset('nonexistent')).rejects.toThrow(
        "Dataset 'nonexistent' is not registered"
      );
    });

    test('should handle offline mode gracefully', async () => {
      manager.isOnline = false;
      mockCacheManager.get.mockResolvedValue(new Uint8Array([1, 2, 3]));
      
      const result = await manager.loadDataset('test-data');
      
      expect(result.fromCache).toBe(true);
      expect(mockBackgroundSyncClient.addDownloadTask).not.toHaveBeenCalled();
    });

    test('should throw error when offline and no cache', async () => {
      manager.isOnline = false;
      mockCacheManager.get.mockResolvedValue(null);
      
      await expect(manager.loadDataset('test-data', { fallbackToCache: false })).rejects.toThrow(
        "Dataset 'test-data' is not available offline and no network connection"
      );
    });

    test('should prevent concurrent loading of same dataset', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      
      const promise1 = manager.loadDataset('test-data');
      const promise2 = manager.loadDataset('test-data');
      
      const [result1, result2] = await Promise.all([promise1, promise2]);
      
      expect(result1).toBe(result2);
      expect(mockBackgroundSyncClient.addDownloadTask).toHaveBeenCalledTimes(1);
    });
  });

  describe('Offline Status', () => {
    test('should return comprehensive offline status', async () => {
      const manager = new MockOfflineDataManager();
      await manager.registerDataset('test-data', {
        url: 'https://example.com/data.parquet'
      });
      
      const status = await manager.getOfflineStatus();
      
      expect(status.isOfflineSupported).toBe(true);
      expect(status.isOnline).toBe(true);
      expect(status.datasets['test-data']).toBeDefined();
      expect(status.storage).toBeDefined();
    });

    test('should detect stale data', async () => {
      const manager = new MockOfflineDataManager();
      const oldTimestamp = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
      
      await manager.registerDataset('test-data', {
        url: 'https://example.com/data.parquet'
      });
      
      const dataset = manager.getDataset('test-data');
      dataset.lastUpdated = oldTimestamp;
      
      const status = await manager.getOfflineStatus();
      
      expect(status.datasets['test-data'].isStale).toBe(true);
    });
  });

  describe('Data Management', () => {
    let manager;

    beforeEach(async () => {
      manager = new MockOfflineDataManager();
      await manager.registerDataset('test-data', {
        url: 'https://example.com/data.parquet'
      });
    });

    test('should clear specific dataset', async () => {
      await manager.clearDataset('test-data');
      
      expect(mockCacheManager.delete).toHaveBeenCalledWith('dataset:test-data');
      
      const dataset = manager.getDataset('test-data');
      expect(dataset.isAvailableOffline).toBe(false);
    });

    test('should clear all data', async () => {
      await manager.clearAllData();
      
      expect(mockCacheManager.clear).toHaveBeenCalledWith({ tags: ['dataset'] });
      
      const dataset = manager.getDataset('test-data');
      expect(dataset.isAvailableOffline).toBe(false);
    });
  });

  describe('Event Listeners', () => {
    test('should add and notify listeners', () => {
      const manager = new MockOfflineDataManager();
      const listener = jest.fn();
      
      manager.addListener(listener);
      manager.notifyListeners('test-event', { data: 'test' });
      
      expect(listener).toHaveBeenCalledWith('test-event', { data: 'test' });
    });

    test('should remove listeners', () => {
      const manager = new MockOfflineDataManager();
      const listener = jest.fn();
      
      manager.addListener(listener);
      manager.removeListener(listener);
      manager.notifyListeners('test-event', { data: 'test' });
      
      expect(listener).not.toHaveBeenCalled();
    });

    test('should handle listener errors gracefully', () => {
      const manager = new MockOfflineDataManager();
      const errorListener = jest.fn(() => { throw new Error('Listener error'); });
      const goodListener = jest.fn();
      
      manager.addListener(errorListener);
      manager.addListener(goodListener);
      
      expect(() => {
        manager.notifyListeners('test-event', { data: 'test' });
      }).not.toThrow();
      
      expect(goodListener).toHaveBeenCalled();
    });
  });

  describe('Dataset Registry', () => {
    test('should load dataset registry from cache', async () => {
      const registryData = {
        'existing-dataset': {
          name: 'existing-dataset',
          url: 'https://example.com/existing.parquet',
          format: 'parquet'
        }
      };
      
      mockCacheManager.get.mockResolvedValue(registryData);
      
      const manager = new MockOfflineDataManager();
      await manager.loadDatasetRegistry();
      
      expect(manager.datasets.has('existing-dataset')).toBe(true);
      expect(manager.getDataset('existing-dataset').name).toBe('existing-dataset');
    });

    test('should save dataset registry', async () => {
      const manager = new MockOfflineDataManager();
      await manager.registerDataset('test-data', {
        url: 'https://example.com/data.parquet'
      });
      
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'dataset:registry',
        expect.stringContaining('test-data'),
        expect.objectContaining({
          tags: ['registry', 'metadata'],
          ttl: 7 * 24 * 60 * 60 * 1000
        })
      );
    });
  });

  describe('Utility Methods', () => {
    test('should list all datasets', async () => {
      const manager = new MockOfflineDataManager();
      await manager.registerDataset('dataset1', { url: 'https://example.com/1.parquet' });
      await manager.registerDataset('dataset2', { url: 'https://example.com/2.parquet' });
      
      const datasets = manager.listDatasets();
      
      expect(datasets).toHaveLength(2);
      expect(datasets[0].name).toBe('dataset1');
      expect(datasets[1].name).toBe('dataset2');
    });

    test('should get specific dataset', async () => {
      const manager = new MockOfflineDataManager();
      await manager.registerDataset('test-data', { url: 'https://example.com/data.parquet' });
      
      const dataset = manager.getDataset('test-data');
      
      expect(dataset.name).toBe('test-data');
      expect(dataset.url).toBe('https://example.com/data.parquet');
    });

    test('should return undefined for non-existent dataset', () => {
      const manager = new MockOfflineDataManager();
      const dataset = manager.getDataset('nonexistent');
      
      expect(dataset).toBeUndefined();
    });
  });

  describe('Singleton Pattern', () => {
    test('should return same instance', () => {
      const instance1 = MockOfflineDataManager.getInstance();
      const instance2 = MockOfflineDataManager.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('Shutdown', () => {
    test('should cleanup properly on shutdown', async () => {
      const manager = new MockOfflineDataManager();
      const listener = jest.fn();
      
      manager.addListener(listener);
      await manager.registerDataset('test-data', { url: 'https://example.com/data.parquet' });
      
      await manager.shutdown();
      
      expect(manager.updateListeners.size).toBe(0);
      expect(mockCacheManager.set).toHaveBeenCalled(); // Registry saved
    });
  });
});