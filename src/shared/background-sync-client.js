// Background Sync Worker Client
// Provides a clean API to interact with the Background Sync Worker

import { ErrorHandler } from './error-handler.js';
import appConfig from './app-config.js';

export class BackgroundSyncClient {
  static instance = null;
  
  constructor() {
    this.worker = null;
    this.listeners = new Map();
    this.taskTypes = null;
    this.config = null;
    this.isReady = false;
    
    this.initializeWorker();
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new BackgroundSyncClient();
    }
    return this.instance;
  }

  /**
   * Initialize the worker
   */
  initializeWorker() {
    try {
      const workerUrl = new URL('./workers/background-sync-worker.js', import.meta.url);
      this.worker = new Worker(workerUrl);
      
      this.worker.onmessage = (e) => this.handleMessage(e);
      this.worker.onerror = (error) => {
        ErrorHandler.handleError(error, 'Background Sync Worker Error');
      };
      
      if (appConfig.development.enableLogging) {
        console.log('🔄 Background Sync Worker initialized');
      }
    } catch (error) {
      ErrorHandler.handleError(error, 'Background Sync Worker Initialization');
      throw error;
    }
  }

  /**
   * Handle messages from worker
   */
  handleMessage(e) {
    const { type, ...data } = e.data;
    
    switch (type) {
      case 'worker_ready':
        this.taskTypes = data.taskTypes;
        this.config = data.config;
        this.isReady = true;
        this.emit('ready', data);
        if (appConfig.development.enableLogging) {
          console.log('🟢 Background Sync Worker ready');
        }
        break;
        
      case 'status':
        this.emit('status', data);
        break;
        
      case 'task_queued':
        this.emit('task:queued', data.task);
        break;
        
      case 'task_started':
        this.emit('task:started', data.task);
        break;
        
      case 'task_completed':
        this.emit('task:completed', data.task);
        break;
        
      case 'task_failed':
        this.emit('task:failed', data.task);
        break;
        
      case 'task_retry':
        this.emit('task:retry', data);
        break;
        
      case 'task_cancelled':
        this.emit('task:cancelled', { taskId: data.taskId });
        break;
        
      case 'tasks_cleared':
        this.emit('tasks:cleared', { removedCount: data.removedCount });
        break;
        
      case 'download_progress':
        this.emit('download:progress', data);
        break;
        
      case 'response':
        this.emit(`response:${data.originalType}`, data.result);
        break;
        
      case 'error':
        this.emit(`error:${data.originalType}`, data.error);
        break;
        
      default:
        if (appConfig.development.enableLogging) {
          console.log('Unknown message type from background sync worker:', type);
        }
    }
  }

  /**
   * Send message to worker
   */
  sendMessage(type, params = {}) {
    return new Promise((resolve, reject) => {
      if (!this.isReady && type !== 'get_status') {
        reject(new Error('Background Sync Worker not ready'));
        return;
      }
      
      const timeout = setTimeout(() => {
        this.off(`response:${type}`, responseHandler);
        this.off(`error:${type}`, errorHandler);
        reject(new Error(`Background Sync Worker timeout for ${type}`));
      }, 10000);
      
      const responseHandler = (result) => {
        clearTimeout(timeout);
        this.off(`error:${type}`, errorHandler);
        resolve(result);
      };
      
      const errorHandler = (error) => {
        clearTimeout(timeout);
        this.off(`response:${type}`, responseHandler);
        const workerError = new Error(error.message);
        workerError.name = error.name;
        workerError.stack = error.stack;
        reject(workerError);
      };
      
      this.on(`response:${type}`, responseHandler);
      this.on(`error:${type}`, errorHandler);
      
      this.worker.postMessage({ type, ...params });
    });
  }

  /**
   * Wait for worker to be ready
   */
  async waitForReady() {
    if (this.isReady) return true;
    
    return new Promise((resolve) => {
      this.on('ready', () => resolve(true));
    });
  }

  /**
   * Add download task
   */
  async addDownloadTask(url, filename, options = {}) {
    await this.waitForReady();
    
    const task = {
      type: this.taskTypes.DOWNLOAD_DATA,
      data: {
        url,
        filename,
        expectedSize: options.expectedSize,
        ...options
      },
      priority: options.priority || 'normal'
    };
    
    try {
      return await this.sendMessage('add_task', { task });
    } catch (error) {
      ErrorHandler.handleError(error, `Add Download Task: ${url}`);
      throw error;
    }
  }

  /**
   * Add update check task
   */
  async addUpdateCheckTask(url, currentETag = null, currentLastModified = null, options = {}) {
    await this.waitForReady();
    
    const task = {
      type: this.taskTypes.CHECK_UPDATES,
      data: {
        url,
        currentETag,
        currentLastModified,
        ...options
      },
      priority: options.priority || 'low'
    };
    
    try {
      return await this.sendMessage('add_task', { task });
    } catch (error) {
      ErrorHandler.handleError(error, `Add Update Check Task: ${url}`);
      throw error;
    }
  }

  /**
   * Add cache cleanup task
   */
  async addCacheCleanupTask(maxAge = appConfig.performance.caching.maxAge, options = {}) {
    await this.waitForReady();
    
    const task = {
      type: this.taskTypes.CACHE_CLEANUP,
      data: {
        maxAge,
        ...options
      },
      priority: options.priority || 'low'
    };
    
    try {
      return await this.sendMessage('add_task', { task });
    } catch (error) {
      ErrorHandler.handleError(error, 'Add Cache Cleanup Task');
      throw error;
    }
  }

  /**
   * Add analytics upload task
   */
  async addAnalyticsTask(endpoint, data, options = {}) {
    await this.waitForReady();
    
    const task = {
      type: this.taskTypes.UPLOAD_ANALYTICS,
      data: {
        endpoint,
        data,
        ...options
      },
      priority: options.priority || 'low'
    };
    
    try {
      return await this.sendMessage('add_task', { task });
    } catch (error) {
      ErrorHandler.handleError(error, `Add Analytics Task: ${endpoint}`);
      throw error;
    }
  }

  /**
   * Add cache validation task
   */
  async addCacheValidationTask(entries, options = {}) {
    await this.waitForReady();
    
    const task = {
      type: this.taskTypes.VALIDATE_CACHE,
      data: {
        entries,
        ...options
      },
      priority: options.priority || 'low'
    };
    
    try {
      return await this.sendMessage('add_task', { task });
    } catch (error) {
      ErrorHandler.handleError(error, 'Add Cache Validation Task');
      throw error;
    }
  }

  /**
   * Cancel a task
   */
  async cancelTask(taskId) {
    try {
      return await this.sendMessage('cancel_task', { taskId });
    } catch (error) {
      ErrorHandler.handleError(error, `Cancel Task: ${taskId}`);
      throw error;
    }
  }

  /**
   * Get sync status
   */
  async getStatus() {
    try {
      return await this.sendMessage('get_status');
    } catch (error) {
      ErrorHandler.handleError(error, 'Get Sync Status');
      throw error;
    }
  }

  /**
   * Clear completed tasks
   */
  async clearCompletedTasks() {
    try {
      return await this.sendMessage('clear_completed');
    } catch (error) {
      ErrorHandler.handleError(error, 'Clear Completed Tasks');
      throw error;
    }
  }

  /**
   * Start periodic sync
   */
  async startSync() {
    try {
      return await this.sendMessage('start_sync');
    } catch (error) {
      ErrorHandler.handleError(error, 'Start Sync');
      throw error;
    }
  }

  /**
   * Stop periodic sync
   */
  async stopSync() {
    try {
      return await this.sendMessage('stop_sync');
    } catch (error) {
      ErrorHandler.handleError(error, 'Stop Sync');
      throw error;
    }
  }

  /**
   * Process pending tasks manually
   */
  async processQueue() {
    try {
      return await this.sendMessage('process_queue');
    } catch (error) {
      ErrorHandler.handleError(error, 'Process Queue');
      throw error;
    }
  }

  /**
   * Create a managed download function
   */
  createManagedDownload(baseUrl, options = {}) {
    return async (path, localFilename = null) => {
      const url = new URL(path, baseUrl).href;
      const filename = localFilename || path.split('/').pop();
      
      // Add progress tracking
      let progressCallback = null;
      if (options.onProgress) {
        progressCallback = (data) => {
          if (data.taskId) {
            options.onProgress(data);
          }
        };
        this.on('download:progress', progressCallback);
      }
      
      try {
        const taskId = await this.addDownloadTask(url, filename, options);
        
        // Wait for completion
        return new Promise((resolve, reject) => {
          const completedHandler = (task) => {
            if (task.id === taskId) {
              this.off('task:completed', completedHandler);
              this.off('task:failed', failedHandler);
              if (progressCallback) {
                this.off('download:progress', progressCallback);
              }
              resolve(task.result);
            }
          };
          
          const failedHandler = (task) => {
            if (task.id === taskId) {
              this.off('task:completed', completedHandler);
              this.off('task:failed', failedHandler);
              if (progressCallback) {
                this.off('download:progress', progressCallback);
              }
              reject(new Error(task.error?.message || 'Download failed'));
            }
          };
          
          this.on('task:completed', completedHandler);
          this.on('task:failed', failedHandler);
        });
        
      } catch (error) {
        if (progressCallback) {
          this.off('download:progress', progressCallback);
        }
        throw error;
      }
    };
  }

  /**
   * Event listener management
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.warn(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Get task types
   */
  getTaskTypes() {
    return this.taskTypes;
  }

  /**
   * Get worker configuration
   */
  getConfig() {
    return this.config;
  }

  /**
   * Create a periodic task scheduler
   */
  createPeriodicTask(taskCreator, intervalMs) {
    let intervalId = null;
    
    return {
      start: () => {
        if (intervalId) return;
        
        intervalId = setInterval(async () => {
          try {
            const task = await taskCreator();
            if (task) {
              await this.sendMessage('add_task', { task });
            }
          } catch (error) {
            console.warn('Periodic task creation failed:', error);
          }
        }, intervalMs);
      },
      
      stop: () => {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      },
      
      isRunning: () => intervalId !== null
    };
  }

  /**
   * Terminate worker
   */
  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.isReady = false;
      this.listeners.clear();
    }
  }
}

// Export singleton instance
export default BackgroundSyncClient.getInstance();