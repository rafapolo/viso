// Offline Data Manager - Orchestrates all offline capabilities
import { FileSystemWorkerClient, DataProcessingWorkerClient, BackgroundSyncClient } from './enhanced-clients.js';
import { CacheManager } from './enhanced-storage.js';

export interface DatasetConfig {
  url: string;
  format?: string;
  autoUpdate?: boolean;
  version?: string;
  [key: string]: unknown;
}

export interface Dataset {
  name: string;
  url: string;
  format: string;
  autoUpdate: boolean;
  version: string;
  lastModified: number | null;
  size: number;
  cached: boolean;
  [key: string]: unknown;
}

export interface LoadDatasetOptions {
  forceRefresh?: boolean;
  onProgress?: ((progress: unknown) => void) | null;
}

export interface LoadResult {
  data: ArrayBuffer;
  fromCache: boolean;
  dataset: Dataset;
}

export interface StorageUsage {
  total: number;
  datasets: number;
  cache: number;
  temporary: number;
}

export interface OfflineStatus {
  isOfflineSupported: boolean;
  isOnline: boolean;
  datasets: Record<string, Omit<Dataset, 'url' | 'format' | 'autoUpdate'>>;
  storage: StorageUsage;
  cacheStats: ReturnType<CacheManager['getStats']>;
}

type OfflineListener = (event: string, data: Record<string, unknown>) => void;

export class OfflineDataManager {
  private fileSystemClient: FileSystemWorkerClient;
  private dataProcessingClient: DataProcessingWorkerClient;
  private backgroundSyncClient: BackgroundSyncClient;
  private cacheManager: CacheManager;

  private datasets: Map<string, Dataset> = new Map();
  private listeners: Map<string, Set<OfflineListener>> = new Map();
  isOnline = navigator.onLine;
  private isInitialized = false;
  private networkCleanup: (() => void) | null = null;

  constructor() {
    this.fileSystemClient = new FileSystemWorkerClient();
    this.dataProcessingClient = new DataProcessingWorkerClient();
    this.backgroundSyncClient = new BackgroundSyncClient();
    this.cacheManager = new CacheManager();

    this.bindNetworkEvents();
  }

  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;
    try {
      await Promise.all([
        this.fileSystemClient.initialize(),
        this.dataProcessingClient.initialize(),
        this.backgroundSyncClient.initialize(),
        this.cacheManager.initialize(),
      ]);
      this.isInitialized = true;
      this.emit('initialized', { success: true });
      return true;
    } catch (error) {
      this.emit('error', { type: 'initialization', error });
      return false;
    }
  }

  async registerDataset(name: string, config: DatasetConfig): Promise<Dataset> {
    const dataset: Dataset = {
      name,
      url: config.url,
      format: (config.format as string) ?? 'parquet',
      autoUpdate: config.autoUpdate !== false,
      version: (config.version as string) ?? '1.0',
      lastModified: null,
      size: 0,
      cached: false,
      ...config,
    };
    this.datasets.set(name, dataset);
    this.emit('datasetRegistered', { name, dataset });
    return dataset;
  }

  async loadDataset(name: string, options: LoadDatasetOptions = {}): Promise<LoadResult> {
    const dataset = this.datasets.get(name);
    if (!dataset) throw new Error(`Dataset ${name} not found`);

    const { forceRefresh = false, onProgress = null } = options;

    try {
      this.emit('loadStart', { name, dataset });

      if (!forceRefresh) {
        const cached = await this.getCachedDataset(name);
        if (cached) {
          this.emit('dataLoaded', { name, dataset, fromCache: true, size: cached.data.byteLength, data: cached.data });
          return { data: cached.data, fromCache: true, dataset };
        }
      }

      const cachePath = `datasets/${name}`;
      const result = await this.fileSystemClient.downloadAndCache(
        dataset.url,
        cachePath,
        (progress) => {
          if (onProgress) onProgress(progress);
          this.emit('loadProgress', { name, progress });
        }
      ) as { data: ArrayBuffer; size: number };

      dataset.lastModified = Date.now();
      dataset.size = result.size;
      dataset.cached = true;

      await this.cacheManager.set(
        `dataset:${name}:meta`,
        { ...dataset, dataPath: cachePath },
        { ttl: 24 * 60 * 60 * 1000 }
      );

      this.emit('dataLoaded', { name, dataset, fromCache: false, size: result.size, data: result.data });
      return { data: result.data, fromCache: false, dataset };
    } catch (error) {
      this.emit('loadError', { name, dataset, error });

      if (!forceRefresh) {
        const cached = await this.getCachedDataset(name);
        if (cached) return { data: cached.data, fromCache: true, dataset };
      }

      throw error;
    }
  }

  async getCachedDataset(name: string): Promise<{ data: ArrayBuffer; metadata: unknown } | null> {
    try {
      const meta = await this.cacheManager.get(`dataset:${name}:meta`, { format: 'json' }) as ({ dataPath: string } | null);
      if (!meta) return null;

      const fileResult = await (this.fileSystemClient.worker as unknown as { getFile?: (p: string) => Promise<{ data: ArrayBuffer } | null> })?.getFile?.(meta.dataPath);
      if (!fileResult) return null;

      return { data: fileResult.data, metadata: meta };
    } catch {
      return null;
    }
  }

  async getOfflineStatus(): Promise<OfflineStatus> {
    const storage = await this.getStorageUsage();
    const datasets: OfflineStatus['datasets'] = {};

    for (const [name, dataset] of this.datasets.entries()) {
      datasets[name] = {
        name,
        cached: dataset.cached,
        size: dataset.size,
        lastModified: dataset.lastModified,
        version: dataset.version,
      };
    }

    return {
      isOfflineSupported: true,
      isOnline: this.isOnline,
      datasets,
      storage,
      cacheStats: this.cacheManager.getStats(),
    };
  }

  async getStorageUsage(): Promise<StorageUsage> {
    return {
      total: 50 * 1024 * 1024,
      datasets: 35 * 1024 * 1024,
      cache: 12 * 1024 * 1024,
      temporary: 3 * 1024 * 1024,
    };
  }

  async clearAllData(): Promise<void> {
    await this.cacheManager.clear();
    this.datasets.forEach((dataset) => {
      dataset.cached = false;
      dataset.lastModified = null;
      dataset.size = 0;
    });
    this.emit('dataCleared', {});
  }

  createProgressiveLoader(datasetNames: string[]) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    return {
      async loadAll(onProgress?: (progress: unknown) => void) {
        const results = new Map<string, LoadResult | { error: Error }>();
        let completed = 0;

        for (const name of datasetNames) {
          try {
            const result = await self.loadDataset(name, {
              onProgress: (progress) => {
                if (onProgress) {
                  onProgress({ dataset: name, progress, completed, total: datasetNames.length });
                }
              },
            });
            results.set(name, result);
            completed++;
            if (onProgress) {
              onProgress({ dataset: name, progress: 100, completed, total: datasetNames.length });
            }
          } catch (error) {
            results.set(name, { error: error as Error });
          }
        }

        return results;
      },
    };
  }

  bindNetworkEvents(): void {
    const handleOnline = () => {
      this.isOnline = true;
      this.emit('online', { isOnline: true });
    };

    const handleOffline = () => {
      this.isOnline = false;
      this.emit('offline', { isOnline: false });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    this.networkCleanup = () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }

  addListener(event: string, listener: OfflineListener): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener);
  }

  removeListener(event: string, listener: OfflineListener): void {
    this.listeners.get(event)?.delete(listener);
  }

  emit(event: string, data: Record<string, unknown>): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event, data);
        } catch {
          // Ignore errors during cleanup
        }
      }
    }
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  async shutdown(): Promise<void> {
    try {
      this.networkCleanup?.();
      this.fileSystemClient.terminate();
      this.dataProcessingClient.terminate();
      this.backgroundSyncClient.terminate();
      await this.cacheManager.shutdown();
      this.listeners.clear();
      this.isInitialized = false;
    } catch {
      // Ignore errors during shutdown
    }
  }
}
