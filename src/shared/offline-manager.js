// Offline Data Manager - Orchestrates all offline capabilities
import { FileSystemWorkerClient, DataProcessingWorkerClient, BackgroundSyncClient } from './enhanced-clients.js';
import { CacheManager } from './enhanced-storage.js';

export class OfflineDataManager {
  constructor() {
    this.fileSystemClient = new FileSystemWorkerClient();
    this.dataProcessingClient = new DataProcessingWorkerClient();
    this.backgroundSyncClient = new BackgroundSyncClient();
    this.cacheManager = new CacheManager();
    
    this.datasets = new Map();
    this.listeners = new Map();
    this.isOnline = navigator.onLine;
    this.isInitialized = false;
    
    this.bindNetworkEvents();
  }

  async initialize() {
    if (this.isInitialized) return true;
    
    try {
      console.log('🚀 Initializing Offline Data Manager...');
      
      // Initialize all components
      await Promise.all([
        this.fileSystemClient.initialize(),
        this.dataProcessingClient.initialize(),
        this.backgroundSyncClient.initialize(),
        this.cacheManager.initialize()
      ]);
      
      this.isInitialized = true;
      console.log('✅ Offline Data Manager initialized successfully');
      
      this.emit('initialized', { success: true });
      return true;
      
    } catch (error) {
      console.error('❌ Failed to initialize Offline Data Manager:', error);
      this.emit('error', { type: 'initialization', error });
      return false;
    }
  }

  async registerDataset(name, config) {
    const dataset = {
      name,
      url: config.url,
      format: config.format || 'parquet',
      autoUpdate: config.autoUpdate !== false,
      version: config.version || '1.0',
      lastModified: null,
      size: 0,
      cached: false,
      ...config
    };
    
    this.datasets.set(name, dataset);
    console.log(`📊 Registered dataset: ${name}`);
    
    this.emit('datasetRegistered', { name, dataset });
    return dataset;
  }

  async loadDataset(name, options = {}) {
    const dataset = this.datasets.get(name);
    if (!dataset) {
      throw new Error(`Dataset ${name} not found`);
    }
    
    const { forceRefresh = false, onProgress = null } = options;
    
    try {
      console.log(`📥 Loading dataset: ${name}${forceRefresh ? ' (force refresh)' : ''}`);
      
      this.emit('loadStart', { name, dataset });
      
      // Check cache first (unless force refresh)
      if (!forceRefresh) {
        const cached = await this.getCachedDataset(name);
        if (cached) {
          console.log(`💾 Dataset ${name} loaded from cache (${this.formatBytes(cached.data.byteLength)})`);
          
          this.emit('dataLoaded', {
            name,
            dataset,
            fromCache: true,
            size: cached.data.byteLength,
            data: cached.data
          });
          
          return {
            data: cached.data,
            fromCache: true,
            dataset
          };
        }
      }
      
      // Download from remote
      console.log(`🌐 Downloading dataset ${name} from ${dataset.url}`);
      
      const cachePath = `datasets/${name}`;
      const result = await this.fileSystemClient.downloadAndCache(
        dataset.url,
        cachePath,
        (progress) => {
          if (onProgress) onProgress(progress);
          this.emit('loadProgress', { name, progress });
        }
      );
      
      // Update dataset info
      dataset.lastModified = Date.now();
      dataset.size = result.size;
      dataset.cached = true;
      
      // Cache metadata
      await this.cacheManager.set(`dataset:${name}:meta`, {
        ...dataset,
        dataPath: cachePath
      }, { ttl: 24 * 60 * 60 * 1000 }); // 24 hours
      
      console.log(`✅ Dataset ${name} downloaded and cached (${this.formatBytes(result.size)})`);
      
      this.emit('dataLoaded', {
        name,
        dataset,
        fromCache: false,
        size: result.size,
        data: result.data
      });
      
      return {
        data: result.data,
        fromCache: false,
        dataset
      };
      
    } catch (error) {
      console.error(`❌ Failed to load dataset ${name}:`, error);
      
      this.emit('loadError', { name, dataset, error });
      
      // Try to fall back to cached version if available
      if (!forceRefresh) {
        const cached = await this.getCachedDataset(name);
        if (cached) {
          console.warn(`⚠️ Using cached version of ${name} due to download failure`);
          return {
            data: cached.data,
            fromCache: true,
            dataset
          };
        }
      }
      
      throw error;
    }
  }

  async getCachedDataset(name) {
    try {
      const meta = await this.cacheManager.get(`dataset:${name}:meta`, { format: 'json' });
      if (!meta) return null;
      
      const fileResult = await this.fileSystemClient.worker?.getFile?.(meta.dataPath);
      if (!fileResult) return null;
      
      return {
        data: fileResult.data,
        metadata: meta
      };
      
    } catch (error) {
      console.warn(`Failed to get cached dataset ${name}:`, error);
      return null;
    }
  }

  async getOfflineStatus() {
    const storage = await this.getStorageUsage();
    const datasets = {};
    
    for (const [name, dataset] of this.datasets.entries()) {
      datasets[name] = {
        name,
        cached: dataset.cached,
        size: dataset.size,
        lastModified: dataset.lastModified,
        version: dataset.version
      };
    }
    
    return {
      isOfflineSupported: true,
      isOnline: this.isOnline,
      datasets,
      storage,
      cacheStats: this.cacheManager.getStats()
    };
  }

  async getStorageUsage() {
    // Mock storage calculation - in real implementation would calculate actual usage
    const mockUsage = {
      total: 50 * 1024 * 1024, // 50MB
      datasets: 35 * 1024 * 1024, // 35MB
      cache: 12 * 1024 * 1024, // 12MB
      temporary: 3 * 1024 * 1024 // 3MB
    };
    
    return mockUsage;
  }

  async clearAllData() {
    try {
      console.log('🗑️ Clearing all offline data...');
      
      // Clear cache
      await this.cacheManager.clear();
      
      // Clear datasets metadata
      this.datasets.forEach(dataset => {
        dataset.cached = false;
        dataset.lastModified = null;
        dataset.size = 0;
      });
      
      console.log('✅ All offline data cleared');
      this.emit('dataCleared', {});
      
    } catch (error) {
      console.error('❌ Failed to clear offline data:', error);
      throw error;
    }
  }

  createProgressiveLoader(datasets, options = {}) {
    return {
      async loadAll(onProgress) {
        const results = new Map();
        let completed = 0;
        
        for (const name of datasets) {
          try {
            const result = await this.loadDataset(name, {
              onProgress: (progress) => {
                if (onProgress) {
                  onProgress({
                    dataset: name,
                    progress: progress.progress,
                    completed,
                    total: datasets.length
                  });
                }
              }
            });
            
            results.set(name, result);
            completed++;
            
            if (onProgress) {
              onProgress({
                dataset: name,
                progress: 100,
                completed,
                total: datasets.length
              });
            }
            
          } catch (error) {
            console.error(`Failed to load dataset ${name}:`, error);
            results.set(name, { error });
          }
        }
        
        return results;
      }
    };
  }

  bindNetworkEvents() {
    const handleOnline = () => {
      this.isOnline = true;
      console.log('🌐 Network: Back online');
      this.emit('online', { isOnline: true });
    };
    
    const handleOffline = () => {
      this.isOnline = false;
      console.log('📡 Network: Gone offline');
      this.emit('offline', { isOnline: false });
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Store for cleanup
    this.networkCleanup = () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }

  addListener(event, listener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(listener);
  }

  removeListener(event, listener) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  emit(event, data) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event, data);
        } catch (error) {
          console.error(`Error in listener for event ${event}:`, error);
        }
      }
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  async shutdown() {
    console.log('🔌 Shutting down Offline Data Manager...');
    
    try {
      // Cleanup network listeners
      if (this.networkCleanup) {
        this.networkCleanup();
      }
      
      // Terminate workers
      this.fileSystemClient.terminate();
      this.dataProcessingClient.terminate();
      this.backgroundSyncClient.terminate();
      
      // Shutdown cache
      await this.cacheManager.shutdown();
      
      // Clear listeners
      this.listeners.clear();
      
      this.isInitialized = false;
      console.log('✅ Offline Data Manager shut down successfully');
      
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
    }
  }
}