// Offline Data Manager
// Integrates OPFS, Cache, Workers and Background Sync for progressive loading and offline support

import filesystemWorkerClient from './filesystem-worker-client.js';
import dataProcessingWorkerClient from './data-processing-worker-client.js';
import backgroundSyncClient from './background-sync-client.js';
import cacheManager from './cache-manager.js';
import { ErrorHandler } from './error-handler.js';
import appConfig from './app-config.js';

export class OfflineDataManager {
  static instance = null;
  
  constructor() {
    this.isInitialized = false;
    this.isOnline = navigator.onLine;
    this.datasets = new Map();
    this.loadingPromises = new Map();
    this.updateListeners = new Set();
    
    // Configuration
    this.config = {
      enableOfflineMode: appConfig.features.offlineMode,
      enableProgressiveLoading: true,
      enableBackgroundSync: true,
      dataCheckInterval: 30 * 60 * 1000, // 30 minutes
      staleDataThreshold: 24 * 60 * 60 * 1000, // 24 hours
      maxConcurrentDownloads: 3
    };
    
    this.setupNetworkListeners();
    this.initialize();
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new OfflineDataManager();
    }
    return this.instance;
  }

  /**
   * Initialize the manager
   */
  async initialize() {
    if (this.isInitialized) return;
    
    try {
      // Wait for all workers to be ready
      await Promise.all([
        filesystemWorkerClient.initialize(),
        dataProcessingWorkerClient.initialize(),
        backgroundSyncClient.waitForReady()
      ]);
      
      // Load dataset registry from cache
      await this.loadDatasetRegistry();
      
      // Setup background sync
      if (this.config.enableBackgroundSync) {
        this.setupBackgroundSync();
      }
      
      this.isInitialized = true;
      
      if (appConfig.development.enableLogging) {
        console.log('🏠 Offline Data Manager initialized');
      }
      
      this.notifyListeners('initialized', { isOnline: this.isOnline });
      
    } catch (error) {
      ErrorHandler.handleError(error, 'Offline Data Manager Initialization');
      throw error;
    }
  }

  /**
   * Setup network status listeners
   */
  setupNetworkListeners() {
    const updateOnlineStatus = () => {
      const wasOnline = this.isOnline;
      this.isOnline = navigator.onLine;
      
      if (!wasOnline && this.isOnline) {
        // Came back online
        this.notifyListeners('online', {});
        if (this.config.enableBackgroundSync) {
          this.syncPendingData();
        }
      } else if (wasOnline && !this.isOnline) {
        // Went offline
        this.notifyListeners('offline', {});
      }
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
  }

  /**
   * Setup background synchronization
   */
  setupBackgroundSync() {
    // Listen to background sync events
    backgroundSyncClient.on('task:completed', (task) => {
      if (task.type === backgroundSyncClient.getTaskTypes().DOWNLOAD_DATA) {
        this.handleDataDownloadCompleted(task);
      } else if (task.type === backgroundSyncClient.getTaskTypes().CHECK_UPDATES) {
        this.handleUpdateCheckCompleted(task);
      }
    });

    // Start periodic sync
    backgroundSyncClient.startSync();
  }

  /**
   * Load dataset registry from storage
   */
  async loadDatasetRegistry() {
    try {
      const registryData = await cacheManager.get('dataset:registry', { format: 'json' });
      
      if (registryData) {
        for (const [key, dataset] of Object.entries(registryData)) {
          this.datasets.set(key, dataset);
        }
        
        if (appConfig.development.enableLogging) {
          console.log(`📋 Loaded ${this.datasets.size} datasets from registry`);
        }
      }
    } catch (error) {
      console.warn('Failed to load dataset registry:', error);
    }
  }

  /**
   * Save dataset registry to storage
   */
  async saveDatasetRegistry() {
    try {
      const registryData = Object.fromEntries(this.datasets.entries());
      
      await cacheManager.set('dataset:registry', JSON.stringify(registryData), {
        tags: ['registry', 'metadata'],
        ttl: 7 * 24 * 60 * 60 * 1000 // 7 days
      });
    } catch (error) {
      console.warn('Failed to save dataset registry:', error);
    }
  }

  /**
   * Register a dataset
   */
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
    
    if (appConfig.development.enableLogging) {
      console.log(`📝 Registered dataset: ${name}`);
    }
    
    return dataset;
  }

  /**
   * Load dataset with progressive loading support
   */
  async loadDataset(name, options = {}) {
    await this.initialize();
    
    // Prevent concurrent loads of the same dataset
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

  /**
   * Internal dataset loading logic
   */
  async _loadDatasetInternal(name, options = {}) {
    const {
      forceRefresh = false,
      onProgress = null,
      fallbackToCache = true,
      registerInWorker = true
    } = options;
    
    let dataset = this.datasets.get(name);
    if (!dataset) {
      throw new Error(`Dataset '${name}' is not registered`);
    }
    
    const cacheKey = `dataset:${name}`;
    const metadataKey = `metadata:${name}`;
    
    // Strategy 1: Try to load from cache first (progressive loading)
    if (!forceRefresh && fallbackToCache) {
      try {
        const cachedData = await this.loadFromCache(name, cacheKey);
        if (cachedData) {
          // Load cached data immediately
          if (registerInWorker) {
            await this.registerDataInWorker(name, cachedData, dataset);
          }
          
          this.notifyListeners('dataLoaded', { 
            name, 
            fromCache: true, 
            size: cachedData.byteLength,
            dataset 
          });
          
          // Check for updates in background if online
          if (this.isOnline && dataset.autoUpdate) {
            this.scheduleUpdateCheck(name);
          }
          
          return {
            data: cachedData,
            fromCache: true,
            dataset: this.datasets.get(name)
          };
        }
      } catch (error) {
        console.warn(`Failed to load ${name} from cache:`, error);
      }
    }
    
    // Strategy 2: Download from network
    if (!this.isOnline && !fallbackToCache) {
      throw new Error(`Dataset '${name}' is not available offline and no network connection`);
    }
    
    if (this.isOnline) {
      try {
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
        
      } catch (error) {
        if (fallbackToCache) {
          // Try cache as last resort
          const cachedData = await this.loadFromCache(name, cacheKey);
          if (cachedData) {
            if (registerInWorker) {
              await this.registerDataInWorker(name, cachedData, dataset);
            }
            
            this.notifyListeners('dataLoaded', { 
              name, 
              fromCache: true, 
              size: cachedData.byteLength,
              dataset,
              warning: 'Loaded stale data due to network error'
            });
            
            return {
              data: cachedData,
              fromCache: true,
              dataset: this.datasets.get(name),
              stale: true
            };
          }
        }
        throw error;
      }
    }
    
    throw new Error(`Dataset '${name}' is not available offline`);
  }

  /**
   * Load data from cache
   */
  async loadFromCache(name, cacheKey) {
    // Try memory/OPFS cache first
    let cachedData = await cacheManager.get(cacheKey);
    
    if (!cachedData) {
      // Try direct OPFS access
      const filename = `${name}.${this.datasets.get(name)?.format || 'parquet'}`;
      cachedData = await filesystemWorkerClient.getFile(filename, {
        directory: 'datasets',
        asArrayBuffer: true
      });
    }
    
    return cachedData;
  }

  /**
   * Download dataset from network
   */
  async downloadDataset(name, dataset, onProgress = null) {
    const filename = `${name}.${dataset.format}`;
    
    // Use background sync for download with progress
    const taskId = await backgroundSyncClient.addDownloadTask(
      dataset.url, 
      filename,
      { 
        expectedSize: dataset.size,
        priority: 'high'
      }
    );
    
    // Setup progress tracking
    if (onProgress) {
      const progressHandler = (data) => {
        if (data.taskId === taskId) {
          onProgress({
            progress: data.progress,
            received: data.received,
            total: data.total
          });
        }
      };
      backgroundSyncClient.on('download:progress', progressHandler);
    }
    
    // Wait for download completion
    return new Promise((resolve, reject) => {
      const completedHandler = (task) => {
        if (task.id === taskId) {
          backgroundSyncClient.off('task:completed', completedHandler);
          backgroundSyncClient.off('task:failed', failedHandler);
          
          // Update dataset metadata
          dataset.lastUpdated = Date.now();
          dataset.etag = task.result.etag;
          dataset.size = task.result.size;
          dataset.isAvailableOffline = true;
          this.saveDatasetRegistry();
          
          resolve(task.result);
        }
      };
      
      const failedHandler = (task) => {
        if (task.id === taskId) {
          backgroundSyncClient.off('task:completed', completedHandler);
          backgroundSyncClient.off('task:failed', failedHandler);
          reject(new Error(task.error?.message || 'Download failed'));
        }
      };
      
      backgroundSyncClient.on('task:completed', completedHandler);
      backgroundSyncClient.on('task:failed', failedHandler);
    });
  }

  /**
   * Register data in processing worker
   */
  async registerDataInWorker(name, data, dataset) {
    try {
      await dataProcessingWorkerClient.registerData(
        `${name}.${dataset.format}`,
        data,
        { 
          format: dataset.format,
          createView: true 
        }
      );
      
      if (appConfig.development.enableLogging) {
        console.log(`🔧 Registered ${name} in data processing worker`);
      }
    } catch (error) {
      console.warn(`Failed to register ${name} in worker:`, error);
      // Don't fail the whole load process for this
    }
  }

  /**
   * Schedule update check for a dataset
   */
  scheduleUpdateCheck(name) {
    const dataset = this.datasets.get(name);
    if (!dataset || !dataset.autoUpdate) return;
    
    // Don't check too frequently
    const timeSinceLastCheck = Date.now() - (dataset.lastChecked || 0);
    if (timeSinceLastCheck < dataset.updateInterval) return;
    
    backgroundSyncClient.addUpdateCheckTask(
      dataset.url,
      dataset.etag,
      null,
      { priority: 'low' }
    );
    
    dataset.lastChecked = Date.now();
    this.saveDatasetRegistry();
  }

  /**
   * Handle completed data download from background sync
   */
  async handleDataDownloadCompleted(task) {
    try {
      // Store in cache
      const filename = task.data.filename;
      const datasetName = filename.replace(/\.[^/.]+$/, ''); // Remove extension
      
      await cacheManager.set(
        `dataset:${datasetName}`,
        task.result.data,
        {
          tags: ['dataset', 'offline'],
          ttl: 7 * 24 * 60 * 60 * 1000, // 7 days
          version: task.result.etag || '1.0'
        }
      );
      
      this.notifyListeners('dataUpdated', { 
        name: datasetName,
        size: task.result.size,
        etag: task.result.etag
      });
      
    } catch (error) {
      console.warn('Failed to handle data download completion:', error);
    }
  }

  /**
   * Handle completed update check
   */
  async handleUpdateCheckCompleted(task) {
    if (task.result.hasUpdate) {
      // Trigger background download
      const url = task.data.url;
      const dataset = Array.from(this.datasets.values()).find(d => d.url === url);
      
      if (dataset) {
        const filename = `${dataset.name}.${dataset.format}`;
        
        await backgroundSyncClient.addDownloadTask(url, filename, {
          priority: 'normal',
          expectedSize: task.result.contentLength
        });
        
        this.notifyListeners('updateAvailable', {
          name: dataset.name,
          hasUpdate: true
        });
      }
    }
  }

  /**
   * Sync pending data when coming back online
   */
  async syncPendingData() {
    if (!this.isOnline) return;
    
    try {
      // Process any pending background tasks
      await backgroundSyncClient.processQueue();
      
      // Check for updates on all auto-update datasets
      for (const [name, dataset] of this.datasets.entries()) {
        if (dataset.autoUpdate) {
          this.scheduleUpdateCheck(name);
        }
      }
      
      this.notifyListeners('syncStarted', {});
    } catch (error) {
      console.warn('Failed to sync pending data:', error);
    }
  }

  /**
   * Get offline availability status
   */
  async getOfflineStatus() {
    const status = {
      isOfflineSupported: this.config.enableOfflineMode,
      isOnline: this.isOnline,
      datasets: {},
      storage: await filesystemWorkerClient.getStorageUsage(),
      cache: await cacheManager.getStatistics()
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

  /**
   * Check if dataset is available offline
   */
  async isDatasetAvailableOffline(name) {
    try {
      const cachedData = await this.loadFromCache(name, `dataset:${name}`);
      return !!cachedData;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clear offline data for a dataset
   */
  async clearDataset(name) {
    try {
      // Remove from cache
      await cacheManager.delete(`dataset:${name}`);
      
      // Remove from OPFS
      const dataset = this.datasets.get(name);
      if (dataset) {
        const filename = `${name}.${dataset.format}`;
        await filesystemWorkerClient.deleteFile(filename, 'datasets');
        
        dataset.isAvailableOffline = false;
        await this.saveDatasetRegistry();
      }
      
      this.notifyListeners('dataCleared', { name });
      
    } catch (error) {
      ErrorHandler.handleError(error, `Clear Dataset: ${name}`);
      throw error;
    }
  }

  /**
   * Clear all offline data
   */
  async clearAllData() {
    try {
      // Clear cache
      await cacheManager.clear({ tags: ['dataset'] });
      
      // Clear OPFS datasets
      await filesystemWorkerClient.cleanup('datasets', 0);
      
      // Update registry
      for (const dataset of this.datasets.values()) {
        dataset.isAvailableOffline = false;
      }
      await this.saveDatasetRegistry();
      
      this.notifyListeners('allDataCleared', {});
      
    } catch (error) {
      ErrorHandler.handleError(error, 'Clear All Data');
      throw error;
    }
  }

  /**
   * Add update listener
   */
  addListener(callback) {
    this.updateListeners.add(callback);
  }

  /**
   * Remove update listener
   */
  removeListener(callback) {
    this.updateListeners.delete(callback);
  }

  /**
   * Notify listeners
   */
  notifyListeners(event, data) {
    this.updateListeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.warn('Error in offline data manager listener:', error);
      }
    });
  }

  /**
   * Get dataset info
   */
  getDataset(name) {
    return this.datasets.get(name);
  }

  /**
   * List all datasets
   */
  listDatasets() {
    return Array.from(this.datasets.values());
  }

  /**
   * Shutdown and cleanup
   */
  async shutdown() {
    this.updateListeners.clear();
    
    if (this.config.enableBackgroundSync) {
      await backgroundSyncClient.stopSync();
    }
    
    await this.saveDatasetRegistry();
  }
}

// Export singleton instance
export default OfflineDataManager.getInstance();