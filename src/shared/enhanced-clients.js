// Enhanced Clients - All Worker Clients
import { createDataProcessingWorker, createBackgroundSyncWorker } from './enhanced-workers.js';
import { createFileSystemWorker } from './enhanced-storage.js';

export class FileSystemWorkerClient {
  constructor() {
    this.worker = null;
    this.messageId = 0;
    this.pendingMessages = new Map();
  }

  async initialize() {
    if (this.worker) return true;
    
    try {
      this.worker = createFileSystemWorker();
      this.worker.onmessage = this.handleMessage.bind(this);
      this.worker.onerror = this.handleError.bind(this);
      
      const success = await this.sendMessage('init');
      return success;
      
    } catch (error) {
      console.error('Failed to initialize filesystem worker:', error);
      return false;
    }
  }

  async downloadAndCache(url, path, onProgress) {
    return new Promise((resolve, reject) => {
      const id = this.sendMessage('download', { url, path }, {
        onProgress,
        onComplete: resolve,
        onError: reject
      });
    });
  }

  async storeFile(path, data) {
    return await this.sendMessage('store', { path, data });
  }

  createCachedFetch(baseUrl, cachePath) {
    return async (relativePath, options = {}) => {
      const fullUrl = `${baseUrl}/${relativePath}`;
      const filePath = `${cachePath}/${relativePath}`;
      
      try {
        const result = await this.downloadAndCache(fullUrl, filePath, options.onProgress);
        return {
          ok: true,
          arrayBuffer: () => Promise.resolve(result.data),
          headers: new Map()
        };
      } catch (error) {
        return {
          ok: false,
          status: 500,
          statusText: error.message
        };
      }
    };
  }

  sendMessage(type, data = {}, callbacks = {}) {
    const id = ++this.messageId;
    
    return new Promise((resolve, reject) => {
      this.pendingMessages.set(id, {
        resolve,
        reject,
        ...callbacks
      });
      
      this.worker.postMessage({ id, type, data });
      
      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingMessages.has(id)) {
          this.pendingMessages.delete(id);
          reject(new Error('Worker operation timeout'));
        }
      }, 30000);
    });
  }

  handleMessage(event) {
    const { id, type, data, success, error } = event.data;
    
    if (!this.pendingMessages.has(id)) return;
    
    const { resolve, reject, onProgress, onComplete, onError } = this.pendingMessages.get(id);
    
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
    
    if (success !== undefined) {
      this.pendingMessages.delete(id);
      resolve(success);
      return;
    }
    
    this.pendingMessages.delete(id);
    resolve(data);
  }

  handleError(error) {
    console.error('Filesystem worker error:', error);
    for (const [id, { reject }] of this.pendingMessages.entries()) {
      reject(error);
    }
    this.pendingMessages.clear();
  }

  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pendingMessages.clear();
  }
}

export class DataProcessingWorkerClient {
  constructor() {
    this.worker = null;
    this.messageId = 0;
    this.pendingMessages = new Map();
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return true;
    
    try {
      this.worker = createDataProcessingWorker();
      this.worker.onmessage = this.handleMessage.bind(this);
      this.worker.onerror = this.handleError.bind(this);
      
      const success = await this.sendMessage('init');
      this.isInitialized = success;
      return success;
      
    } catch (error) {
      console.error('Failed to initialize data processing worker:', error);
      return false;
    }
  }

  async executeQuery(sql, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const result = await this.sendMessage('query', { sql, options });
    return result;
  }

  async aggregateData(tableName, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const result = await this.sendMessage('aggregate', { tableName, options });
    return result;
  }

  createQueryBuilder() {
    return {
      select: (columns) => ({
        from: (table) => ({
          where: (conditions) => ({
            groupBy: (cols) => ({
              orderBy: (order) => ({
                limit: (count) => ({
                  build: () => {
                    let sql = `SELECT ${columns.join(', ')} FROM ${table}`;
                    if (conditions.length > 0) sql += ` WHERE ${conditions.join(' AND ')}`;
                    if (cols.length > 0) sql += ` GROUP BY ${cols.join(', ')}`;
                    if (order) sql += ` ORDER BY ${order}`;
                    if (count) sql += ` LIMIT ${count}`;
                    return sql;
                  },
                  execute: async () => {
                    const sql = this.build();
                    return await this.executeQuery(sql);
                  }
                })
              })
            })
          })
        })
      })
    };
  }

  sendMessage(type, data = {}) {
    const id = ++this.messageId;
    
    return new Promise((resolve, reject) => {
      this.pendingMessages.set(id, { resolve, reject });
      
      this.worker.postMessage({ id, type, data });
      
      // Timeout after 60 seconds
      setTimeout(() => {
        if (this.pendingMessages.has(id)) {
          this.pendingMessages.delete(id);
          reject(new Error('Worker query timeout'));
        }
      }, 60000);
    });
  }

  handleMessage(event) {
    const { id, result, error } = event.data;
    
    if (!this.pendingMessages.has(id)) return;
    
    const { resolve, reject } = this.pendingMessages.get(id);
    this.pendingMessages.delete(id);
    
    if (error) {
      reject(new Error(error));
    } else {
      resolve(result);
    }
  }

  handleError(error) {
    console.error('Data processing worker error:', error);
    for (const [id, { reject }] of this.pendingMessages.entries()) {
      reject(error);
    }
    this.pendingMessages.clear();
  }

  terminate() {
    if (this.worker) {
      this.worker.postMessage({ type: 'terminate' });
      this.worker.terminate();
      this.worker = null;
    }
    this.pendingMessages.clear();
    this.isInitialized = false;
  }
}

export class BackgroundSyncClient {
  constructor() {
    this.worker = null;
    this.listeners = new Map();
    this.isActive = false;
  }

  async initialize() {
    if (this.worker) return true;
    
    try {
      this.worker = createBackgroundSyncWorker();
      this.worker.onmessage = this.handleMessage.bind(this);
      this.worker.onerror = this.handleError.bind(this);
      
      this.isActive = true;
      return true;
      
    } catch (error) {
      console.error('Failed to initialize background sync worker:', error);
      return false;
    }
  }

  addTask(type, data, options = {}) {
    if (!this.worker) return null;
    
    const taskId = options.id || `${type}-${Date.now()}`;
    
    this.worker.postMessage({
      type: 'addTask',
      data: {
        id: taskId,
        type,
        ...data,
        retryCount: options.retryCount || 3
      }
    });
    
    return taskId;
  }

  async downloadWithRetry(url, options = {}) {
    return new Promise((resolve, reject) => {
      const taskId = this.addTask('download', { url }, options);
      
      const timeout = setTimeout(() => {
        this.removeListener('taskComplete', successHandler);
        this.removeListener('taskError', errorHandler);
        reject(new Error('Download timeout'));
      }, options.timeout || 30000);
      
      const successHandler = (event) => {
        if (event.taskId === taskId) {
          clearTimeout(timeout);
          this.removeListener('taskComplete', successHandler);
          this.removeListener('taskError', errorHandler);
          resolve(event.result);
        }
      };
      
      const errorHandler = (event) => {
        if (event.taskId === taskId) {
          clearTimeout(timeout);
          this.removeListener('taskComplete', successHandler);
          this.removeListener('taskError', errorHandler);
          reject(new Error(event.error));
        }
      };
      
      this.addListener('taskComplete', successHandler);
      this.addListener('taskError', errorHandler);
    });
  }

  createManagedDownload(baseUrl, options = {}) {
    return (relativePath, downloadOptions = {}) => {
      const url = `${baseUrl}/${relativePath}`;
      return this.downloadWithRetry(url, { ...options, ...downloadOptions });
    };
  }

  addPeriodicTask(type, data, interval = 300000) { // 5 minutes default
    const taskId = `periodic-${type}-${Date.now()}`;
    
    const addTask = () => {
      if (this.isActive) {
        this.addTask(type, { ...data, id: taskId });
      }
    };
    
    addTask();
    const intervalId = setInterval(addTask, interval);
    
    return {
      taskId,
      stop: () => clearInterval(intervalId)
    };
  }

  async getQueueStatus() {
    return new Promise((resolve) => {
      const handler = (event) => {
        if (event.type === 'queueStatus') {
          this.removeListener('queueStatus', handler);
          resolve(event.status);
        }
      };
      
      this.addListener('queueStatus', handler);
      this.worker.postMessage({ type: 'getQueueStatus' });
    });
  }

  clearCompletedTasks() {
    if (this.worker) {
      this.worker.postMessage({ type: 'clearCompleted' });
    }
  }

  startPeriodicSync(interval = 30000) {
    if (this.worker) {
      this.worker.postMessage({ type: 'startSync', data: { interval } });
    }
  }

  stopPeriodicSync() {
    if (this.worker) {
      this.worker.postMessage({ type: 'stopSync' });
    }
  }

  forceSync() {
    if (this.worker) {
      this.worker.postMessage({ type: 'forceSync' });
    }
  }

  addListener(type, listener) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type).add(listener);
  }

  removeListener(type, listener) {
    const listeners = this.listeners.get(type);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  handleMessage(event) {
    const { type } = event.data;
    const listeners = this.listeners.get(type);
    
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event.data);
        } catch (error) {
          console.error('Background sync listener error:', error);
        }
      }
    }
  }

  handleError(error) {
    console.error('Background sync worker error:', error);
  }

  terminate() {
    if (this.worker) {
      this.worker.postMessage({ type: 'terminate' });
      this.worker.terminate();
      this.worker = null;
    }
    this.listeners.clear();
    this.isActive = false;
  }
}