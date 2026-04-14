// Enhanced Clients - All Worker Clients
import { createDataProcessingWorker, createBackgroundSyncWorker } from './enhanced-workers.js';
import { createFileSystemWorker } from './enhanced-storage.js';

interface PendingMessage {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  onProgress?: (data: unknown) => void;
  onComplete?: (data: unknown) => void;
  onError?: (error: Error) => void;
}

export class FileSystemWorkerClient {
  worker: Worker | null = null;
  private messageId = 0;
  private pendingMessages: Map<number, PendingMessage> = new Map();

  async initialize(): Promise<boolean> {
    if (this.worker) return true;
    try {
      this.worker = createFileSystemWorker();
      this.worker.onmessage = this.handleMessage.bind(this);
      this.worker.onerror = this.handleError.bind(this);
      const success = await this.sendMessage('init');
      return success as boolean;
    } catch {
      return false;
    }
  }

  async downloadAndCache(
    url: string,
    path: string,
    onProgress?: (progress: unknown) => void
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      this.sendMessage('download', { url, path }, {
        onProgress,
        onComplete: resolve,
        onError: reject,
      });
    });
  }

  async storeFile(path: string, data: unknown): Promise<unknown> {
    return await this.sendMessage('store', { path, data });
  }

  createCachedFetch(baseUrl: string, cachePath: string) {
    return async (relativePath: string, options: { onProgress?: (p: unknown) => void } = {}) => {
      const fullUrl = `${baseUrl}/${relativePath}`;
      const filePath = `${cachePath}/${relativePath}`;
      try {
        const result = await this.downloadAndCache(fullUrl, filePath, options.onProgress);
        return {
          ok: true,
          arrayBuffer: () => Promise.resolve((result as { data: ArrayBuffer }).data),
          headers: new Map<string, string>(),
        };
      } catch (error) {
        return { ok: false, status: 500, statusText: (error as Error).message };
      }
    };
  }

  sendMessage(type: string, data: Record<string, unknown> = {}, callbacks: Partial<PendingMessage> = {}): Promise<unknown> {
    const id = ++this.messageId;

    return new Promise((resolve, reject) => {
      this.pendingMessages.set(id, { resolve, reject, ...callbacks });

      this.worker!.postMessage({ id, type, data });

      setTimeout(() => {
        if (this.pendingMessages.has(id)) {
          this.pendingMessages.delete(id);
          reject(new Error('Worker operation timeout'));
        }
      }, 30000);
    });
  }

  handleMessage(event: MessageEvent): void {
    const { id, type, data, success, error } = event.data as {
      id: number;
      type?: string;
      data?: unknown;
      success?: unknown;
      error?: string;
    };

    if (!this.pendingMessages.has(id)) return;

    const { resolve, reject, onProgress, onComplete, onError } = this.pendingMessages.get(id)!;

    if (type === 'progress' && onProgress) {
      onProgress(data);
      return;
    }

    if (type === 'complete' && onComplete) {
      this.pendingMessages.delete(id);
      onComplete(data);
      return;
    }

    if (error) {
      this.pendingMessages.delete(id);
      if (onError) onError(new Error(error));
      else reject(new Error(error));
      return;
    }

    this.pendingMessages.delete(id);
    resolve(success !== undefined ? success : data);
  }

  handleError(error: ErrorEvent): void {
    for (const [, { reject }] of this.pendingMessages.entries()) {
      reject(new Error(error.message));
    }
    this.pendingMessages.clear();
  }

  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pendingMessages.clear();
  }
}

export class DataProcessingWorkerClient {
  private worker: Worker | null = null;
  private messageId = 0;
  private pendingMessages: Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }> = new Map();
  private isInitialized = false;

  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;
    try {
      this.worker = createDataProcessingWorker();
      this.worker.onmessage = this.handleMessage.bind(this);
      this.worker.onerror = this.handleError.bind(this);
      const success = await this.sendMessage('init');
      this.isInitialized = success as boolean;
      return this.isInitialized;
    } catch {
      return false;
    }
  }

  async executeQuery(sql: string, options: Record<string, unknown> = {}): Promise<unknown> {
    if (!this.isInitialized) await this.initialize();
    return await this.sendMessage('query', { sql, options });
  }

  async aggregateData(tableName: string, options: Record<string, unknown> = {}): Promise<unknown> {
    if (!this.isInitialized) await this.initialize();
    return await this.sendMessage('aggregate', { tableName, options });
  }

  sendMessage(type: string, data: Record<string, unknown> = {}): Promise<unknown> {
    const id = ++this.messageId;

    return new Promise((resolve, reject) => {
      this.pendingMessages.set(id, { resolve, reject });

      this.worker!.postMessage({ id, type, data });

      setTimeout(() => {
        if (this.pendingMessages.has(id)) {
          this.pendingMessages.delete(id);
          reject(new Error('Worker query timeout'));
        }
      }, 60000);
    });
  }

  handleMessage(event: MessageEvent): void {
    const { id, result, error } = event.data as { id: number; result?: unknown; error?: string };
    if (!this.pendingMessages.has(id)) return;
    const { resolve, reject } = this.pendingMessages.get(id)!;
    this.pendingMessages.delete(id);
    if (error) reject(new Error(error));
    else resolve(result);
  }

  handleError(_error: ErrorEvent): void {
    for (const [, { reject }] of this.pendingMessages.entries()) {
      reject(new Error('Worker error'));
    }
    this.pendingMessages.clear();
  }

  terminate(): void {
    if (this.worker) {
      this.worker.postMessage({ type: 'terminate' });
      this.worker.terminate();
      this.worker = null;
    }
    this.pendingMessages.clear();
    this.isInitialized = false;
  }
}

type SyncListener = (event: Record<string, unknown>) => void;

export class BackgroundSyncClient {
  private worker: Worker | null = null;
  private listeners: Map<string, Set<SyncListener>> = new Map();
  isActive = false;

  async initialize(): Promise<boolean> {
    if (this.worker) return true;
    try {
      this.worker = createBackgroundSyncWorker();
      this.worker.onmessage = this.handleMessage.bind(this);
      this.worker.onerror = this.handleError.bind(this);
      this.isActive = true;
      return true;
    } catch {
      return false;
    }
  }

  addTask(type: string, data: Record<string, unknown>, options: { id?: string; retryCount?: number } = {}): string | null {
    if (!this.worker) return null;
    const taskId = options.id ?? `${type}-${Date.now()}`;
    this.worker.postMessage({
      type: 'addTask',
      data: { id: taskId, type, ...data, retryCount: options.retryCount ?? 3 },
    });
    return taskId;
  }

  async downloadWithRetry(url: string, options: { timeout?: number; id?: string; retryCount?: number } = {}): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const taskId = this.addTask('download', { url }, options);

      const timeout = setTimeout(() => {
        this.removeListener('taskComplete', successHandler);
        this.removeListener('taskError', errorHandler);
        reject(new Error('Download timeout'));
      }, options.timeout ?? 30000);

      const successHandler = (event: Record<string, unknown>) => {
        if (event['taskId'] === taskId) {
          clearTimeout(timeout);
          this.removeListener('taskComplete', successHandler);
          this.removeListener('taskError', errorHandler);
          resolve(event['result']);
        }
      };

      const errorHandler = (event: Record<string, unknown>) => {
        if (event['taskId'] === taskId) {
          clearTimeout(timeout);
          this.removeListener('taskComplete', successHandler);
          this.removeListener('taskError', errorHandler);
          reject(new Error(event['error'] as string));
        }
      };

      this.addListener('taskComplete', successHandler);
      this.addListener('taskError', errorHandler);
    });
  }

  createManagedDownload(baseUrl: string, options: Record<string, unknown> = {}) {
    return (relativePath: string, downloadOptions: Record<string, unknown> = {}) => {
      const url = `${baseUrl}/${relativePath}`;
      return this.downloadWithRetry(url, { ...options, ...downloadOptions });
    };
  }

  addPeriodicTask(type: string, data: Record<string, unknown>, interval = 300000): { taskId: string; stop: () => void } {
    const taskId = `periodic-${type}-${Date.now()}`;
    const addTask = () => {
      if (this.isActive) this.addTask(type, { ...data, id: taskId });
    };
    addTask();
    const intervalId = setInterval(addTask, interval);
    return { taskId, stop: () => clearInterval(intervalId) };
  }

  async getQueueStatus(): Promise<unknown> {
    return new Promise((resolve) => {
      const handler = (event: Record<string, unknown>) => {
        if (event['type'] === 'queueStatus') {
          this.removeListener('queueStatus', handler);
          resolve(event['status']);
        }
      };
      this.addListener('queueStatus', handler);
      this.worker!.postMessage({ type: 'getQueueStatus' });
    });
  }

  clearCompletedTasks(): void {
    this.worker?.postMessage({ type: 'clearCompleted' });
  }

  startPeriodicSync(interval = 30000): void {
    this.worker?.postMessage({ type: 'startSync', data: { interval } });
  }

  stopPeriodicSync(): void {
    this.worker?.postMessage({ type: 'stopSync' });
  }

  forceSync(): void {
    this.worker?.postMessage({ type: 'forceSync' });
  }

  addListener(type: string, listener: SyncListener): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }

  removeListener(type: string, listener: SyncListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  handleMessage(event: MessageEvent): void {
    const { type } = event.data as { type: string };
    const listeners = this.listeners.get(type);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event.data as Record<string, unknown>);
        } catch {
          // Silently ignore listener errors
        }
      }
    }
  }

  handleError(_error: ErrorEvent): void {}

  terminate(): void {
    if (this.worker) {
      this.worker.postMessage({ type: 'terminate' });
      this.worker.terminate();
      this.worker = null;
    }
    this.listeners.clear();
    this.isActive = false;
  }
}
