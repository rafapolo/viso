// File System Worker Client
// Provides a clean API to interact with the File System Worker

import { ErrorHandler } from './error-handler.js';
import appConfig from './app-config.js';

export class FileSystemWorkerClient {
  static instance = null;
  
  constructor() {
    this.worker = null;
    this.messageId = 0;
    this.pendingMessages = new Map();
    this.progressCallbacks = new Map();
    this.isInitialized = false;
    
    this.initializeWorker();
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new FileSystemWorkerClient();
    }
    return this.instance;
  }

  /**
   * Initialize the worker
   */
  initializeWorker() {
    try {
      const workerUrl = new URL('./workers/filesystem-worker.js', import.meta.url);
      this.worker = new Worker(workerUrl, { type: 'module' });
      
      this.worker.onmessage = (e) => this.handleMessage(e);
      this.worker.onerror = (error) => {
        ErrorHandler.handleError(error, 'FileSystem Worker Error');
      };
      
      if (appConfig.development.enableLogging) {
        console.log('🔧 FileSystem Worker initialized');
      }
    } catch (error) {
      ErrorHandler.handleError(error, 'FileSystem Worker Initialization');
      throw error;
    }
  }

  /**
   * Handle messages from worker
   */
  handleMessage(e) {
    const { id, type, result, error } = e.data;
    
    if (type === 'progress') {
      // Handle progress updates
      const callback = this.progressCallbacks.get(result.operation + ':' + (result.path || result.url));
      if (callback) {
        callback(result);
      }
      return;
    }
    
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
  sendMessage(type, params = {}, progressCallback = null) {
    return new Promise((resolve, reject) => {
      const id = ++this.messageId;
      
      this.pendingMessages.set(id, { resolve, reject });
      
      // Store progress callback if provided
      if (progressCallback && (params.path || params.url)) {
        const key = type + ':' + (params.path || params.url);
        this.progressCallbacks.set(key, progressCallback);
      }
      
      this.worker.postMessage({ id, type, ...params });
    });
  }

  /**
   * Initialize OPFS in worker
   */
  async initialize() {
    if (this.isInitialized) return true;
    
    try {
      await this.sendMessage('initialize');
      this.isInitialized = true;
      
      if (appConfig.development.enableLogging) {
        console.log('🗂️ FileSystem Worker OPFS initialized');
      }
      
      return true;
    } catch (error) {
      ErrorHandler.handleError(error, 'FileSystem Worker OPFS Initialization');
      throw error;
    }
  }

  /**
   * Store a file
   */
  async storeFile(path, data, options = {}, progressCallback = null) {
    await this.initialize();
    
    try {
      const result = await this.sendMessage('store', {
        path,
        data,
        options: {
          ...options,
          reportProgress: !!progressCallback
        }
      }, progressCallback);
      
      // Clean up progress callback
      if (progressCallback) {
        this.progressCallbacks.delete('store:' + path);
      }
      
      return result;
    } catch (error) {
      ErrorHandler.handleError(error, `FileSystem Store: ${path}`);
      throw error;
    }
  }

  /**
   * Get a file
   */
  async getFile(path, options = {}) {
    await this.initialize();
    
    try {
      return await this.sendMessage('get', { path, options });
    } catch (error) {
      if (error.name === 'NotFoundError') {
        return null;
      }
      ErrorHandler.handleError(error, `FileSystem Get: ${path}`);
      throw error;
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(path, directory = 'datasets') {
    await this.initialize();
    
    try {
      return await this.sendMessage('exists', { path, directory });
    } catch (error) {
      ErrorHandler.handleError(error, `FileSystem Exists: ${path}`);
      return false;
    }
  }

  /**
   * Delete a file
   */
  async deleteFile(path, directory = 'datasets') {
    await this.initialize();
    
    try {
      return await this.sendMessage('delete', { path, directory });
    } catch (error) {
      ErrorHandler.handleError(error, `FileSystem Delete: ${path}`);
      throw error;
    }
  }

  /**
   * List files in directory
   */
  async listFiles(directory = 'datasets') {
    await this.initialize();
    
    try {
      return await this.sendMessage('list', { directory });
    } catch (error) {
      ErrorHandler.handleError(error, `FileSystem List: ${directory}`);
      return [];
    }
  }

  /**
   * Get file metadata
   */
  async getMetadata(path, directory = 'datasets') {
    await this.initialize();
    
    try {
      return await this.sendMessage('metadata', { path, directory });
    } catch (error) {
      return null;
    }
  }

  /**
   * Get storage usage
   */
  async getStorageUsage() {
    await this.initialize();
    
    try {
      const usage = await this.sendMessage('usage');
      
      // Add formatted sizes
      usage.formatted = {
        datasets: this.formatBytes(usage.datasets),
        cache: this.formatBytes(usage.cache),
        temp: this.formatBytes(usage.temp),
        total: this.formatBytes(usage.total)
      };
      
      return usage;
    } catch (error) {
      ErrorHandler.handleError(error, 'FileSystem Storage Usage');
      return { datasets: 0, cache: 0, temp: 0, total: 0 };
    }
  }

  /**
   * Cleanup old files
   */
  async cleanup(directory, maxAge = appConfig.performance.caching.maxAge) {
    await this.initialize();
    
    try {
      return await this.sendMessage('cleanup', { directory, maxAge });
    } catch (error) {
      ErrorHandler.handleError(error, `FileSystem Cleanup: ${directory}`);
      return 0;
    }
  }

  /**
   * Download and cache remote file
   */
  async downloadAndCache(url, filename, options = {}, progressCallback = null) {
    await this.initialize();
    
    try {
      const result = await this.sendMessage('download', {
        url,
        filename,
        options
      }, progressCallback);
      
      // Clean up progress callback
      if (progressCallback) {
        this.progressCallbacks.delete('download:' + url);
      }
      
      return result;
    } catch (error) {
      ErrorHandler.handleError(error, `FileSystem Download: ${url}`);
      throw error;
    }
  }

  /**
   * Format bytes to human readable format
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Create a cached fetch function
   */
  createCachedFetch(cacheKey, maxAge = appConfig.performance.caching.maxAge) {
    return async (url, fetchOptions = {}) => {
      const filename = `${cacheKey}_${this.hashUrl(url)}.cache`;
      
      try {
        // Check if cached version exists and is valid
        const metadata = await this.getMetadata(filename, 'cache');
        if (metadata && (Date.now() - metadata.createdAt) < maxAge) {
          const cachedData = await this.getFile(filename, { 
            directory: 'cache',
            asArrayBuffer: true 
          });
          
          if (cachedData) {
            if (appConfig.development.enableLogging) {
              console.log(`🎯 Cache hit for: ${url}`);
            }
            return cachedData;
          }
        }
        
        // Fetch and cache
        if (appConfig.development.enableLogging) {
          console.log(`🌐 Fetching and caching: ${url}`);
        }
        
        const response = await fetch(url, fetchOptions);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.arrayBuffer();
        
        // Store in cache
        await this.storeFile(filename, data, {
          directory: 'cache',
          metadata: {
            url,
            fetchedAt: Date.now(),
            contentType: response.headers.get('content-type'),
            size: data.byteLength
          }
        });
        
        return data;
      } catch (error) {
        ErrorHandler.handleError(error, `Cached Fetch: ${url}`);
        
        // Fallback to regular fetch
        const response = await fetch(url, fetchOptions);
        return response.arrayBuffer();
      }
    };
  }

  /**
   * Create a simple hash for URL caching
   */
  hashUrl(url) {
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Terminate worker
   */
  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
      
      // Reject all pending messages
      this.pendingMessages.forEach(({ reject }) => {
        reject(new Error('Worker terminated'));
      });
      this.pendingMessages.clear();
      this.progressCallbacks.clear();
    }
  }
}

// Export singleton instance
export default FileSystemWorkerClient.getInstance();