// Origin Private File System Storage Manager
import { ErrorHandler } from './error-handler.js';
import appConfig from './app-config.js';

export class OPFSStorageManager {
  static instance = null;
  
  constructor() {
    this.root = null;
    this.isSupported = false;
    this.cache = new Map();
    this.listeners = new Set();
    
    this.checkSupport();
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new OPFSStorageManager();
    }
    return this.instance;
  }

  /**
   * Check if OPFS is supported in the current browser
   */
  checkSupport() {
    this.isSupported = 'navigator' in window && 
                      'storage' in navigator && 
                      'getDirectory' in navigator.storage;
    
    if (appConfig.development.enableLogging) {
      console.log(`🗂️ OPFS Support: ${this.isSupported ? '✅ Available' : '❌ Not Available'}`);
    }
    
    return this.isSupported;
  }

  /**
   * Initialize OPFS root directory
   */
  async initialize() {
    if (!this.isSupported) {
      throw new Error('OPFS is not supported in this browser');
    }

    try {
      this.root = await navigator.storage.getDirectory();
      
      // Create necessary directories
      await this.ensureDirectoryExists('datasets');
      await this.ensureDirectoryExists('cache');
      await this.ensureDirectoryExists('temp');
      
      if (appConfig.development.enableLogging) {
        console.log('🗂️ OPFS initialized successfully');
      }
      
      return true;
    } catch (error) {
      ErrorHandler.handleError(error, 'OPFS Initialization');
      throw error;
    }
  }

  /**
   * Ensure a directory exists, create if it doesn't
   */
  async ensureDirectoryExists(path) {
    if (!this.root) await this.initialize();
    
    try {
      await this.root.getDirectoryHandle(path, { create: true });
      return true;
    } catch (error) {
      ErrorHandler.handleError(error, `OPFS Directory Creation: ${path}`);
      throw error;
    }
  }

  /**
   * Store a file in OPFS
   */
  async storeFile(path, data, options = {}) {
    if (!this.root) await this.initialize();
    
    const {
      overwrite = true,
      directory = 'datasets',
      metadata = {}
    } = options;

    try {
      const dirHandle = await this.root.getDirectoryHandle(directory, { create: true });
      const fileHandle = await dirHandle.getFileHandle(path, { create: true });
      
      // Check if file exists and overwrite is false
      if (!overwrite) {
        try {
          await fileHandle.getFile();
          throw new Error(`File ${path} already exists and overwrite is disabled`);
        } catch (error) {
          if (error.name !== 'NotFoundError') {
            throw error;
          }
          // File doesn't exist, continue
        }
      }

      const writable = await fileHandle.createWritable();
      
      // Convert data to appropriate format
      let writeData = data;
      if (data instanceof ArrayBuffer) {
        writeData = new Uint8Array(data);
      } else if (typeof data === 'string') {
        writeData = new TextEncoder().encode(data);
      }
      
      await writable.write(writeData);
      await writable.close();

      // Store metadata
      if (Object.keys(metadata).length > 0) {
        await this.storeMetadata(path, metadata, directory);
      }

      // Update cache
      this.cache.set(`${directory}/${path}`, {
        size: writeData.byteLength || writeData.length,
        lastModified: Date.now(),
        metadata
      });

      this.notifyListeners('file-stored', { path, directory, size: writeData.byteLength || writeData.length });

      if (appConfig.development.enableLogging) {
        console.log(`🗂️ Stored file: ${directory}/${path} (${(writeData.byteLength || writeData.length / 1024).toFixed(1)} KB)`);
      }

      return true;
    } catch (error) {
      ErrorHandler.handleError(error, `OPFS Store File: ${path}`);
      throw error;
    }
  }

  /**
   * Retrieve a file from OPFS
   */
  async getFile(path, options = {}) {
    if (!this.root) await this.initialize();
    
    const {
      directory = 'datasets',
      asArrayBuffer = false,
      asText = false
    } = options;

    try {
      const dirHandle = await this.root.getDirectoryHandle(directory);
      const fileHandle = await dirHandle.getFileHandle(path);
      const file = await fileHandle.getFile();

      // Return different formats based on options
      if (asArrayBuffer) {
        return await file.arrayBuffer();
      } else if (asText) {
        return await file.text();
      } else {
        return file;
      }
    } catch (error) {
      if (error.name === 'NotFoundError') {
        return null;
      }
      ErrorHandler.handleError(error, `OPFS Get File: ${path}`);
      throw error;
    }
  }

  /**
   * Check if a file exists
   */
  async fileExists(path, directory = 'datasets') {
    try {
      if (!this.root) await this.initialize();
      
      const dirHandle = await this.root.getDirectoryHandle(directory);
      const fileHandle = await dirHandle.getFileHandle(path);
      return true;
    } catch (error) {
      if (error.name === 'NotFoundError') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Delete a file from OPFS
   */
  async deleteFile(path, directory = 'datasets') {
    if (!this.root) await this.initialize();

    try {
      const dirHandle = await this.root.getDirectoryHandle(directory);
      await dirHandle.removeEntry(path);
      
      // Remove from cache
      this.cache.delete(`${directory}/${path}`);
      
      // Delete metadata
      await this.deleteMetadata(path, directory);
      
      this.notifyListeners('file-deleted', { path, directory });
      
      if (appConfig.development.enableLogging) {
        console.log(`🗂️ Deleted file: ${directory}/${path}`);
      }
      
      return true;
    } catch (error) {
      if (error.name === 'NotFoundError') {
        return false;
      }
      ErrorHandler.handleError(error, `OPFS Delete File: ${path}`);
      throw error;
    }
  }

  /**
   * List files in a directory
   */
  async listFiles(directory = 'datasets') {
    if (!this.root) await this.initialize();

    try {
      const dirHandle = await this.root.getDirectoryHandle(directory);
      const files = [];
      
      for await (const [name, handle] of dirHandle.entries()) {
        if (handle.kind === 'file') {
          const file = await handle.getFile();
          files.push({
            name,
            size: file.size,
            lastModified: file.lastModified,
            type: file.type
          });
        }
      }
      
      return files;
    } catch (error) {
      if (error.name === 'NotFoundError') {
        return [];
      }
      ErrorHandler.handleError(error, `OPFS List Files: ${directory}`);
      throw error;
    }
  }

  /**
   * Store metadata for a file
   */
  async storeMetadata(path, metadata, directory = 'datasets') {
    const metadataPath = `${path}.meta`;
    const metadataContent = JSON.stringify({
      ...metadata,
      createdAt: Date.now(),
      path,
      directory
    });
    
    await this.storeFile(metadataPath, metadataContent, { 
      directory: 'cache',
      overwrite: true 
    });
  }

  /**
   * Get metadata for a file
   */
  async getMetadata(path, directory = 'datasets') {
    try {
      const metadataPath = `${path}.meta`;
      const metadataContent = await this.getFile(metadataPath, { 
        directory: 'cache',
        asText: true 
      });
      
      if (metadataContent) {
        return JSON.parse(metadataContent);
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Delete metadata for a file
   */
  async deleteMetadata(path, directory = 'datasets') {
    try {
      const metadataPath = `${path}.meta`;
      await this.deleteFile(metadataPath, 'cache');
    } catch (error) {
      // Ignore metadata deletion errors
    }
  }

  /**
   * Get storage usage information
   */
  async getStorageUsage() {
    if (!this.root) await this.initialize();

    try {
      const usage = { datasets: 0, cache: 0, temp: 0, total: 0 };
      
      for (const directory of Object.keys(usage)) {
        if (directory === 'total') continue;
        
        const files = await this.listFiles(directory);
        usage[directory] = files.reduce((total, file) => total + file.size, 0);
      }
      
      usage.total = usage.datasets + usage.cache + usage.temp;
      
      return {
        ...usage,
        formatted: {
          datasets: this.formatBytes(usage.datasets),
          cache: this.formatBytes(usage.cache),
          temp: this.formatBytes(usage.temp),
          total: this.formatBytes(usage.total)
        }
      };
    } catch (error) {
      ErrorHandler.handleError(error, 'OPFS Storage Usage');
      return { datasets: 0, cache: 0, temp: 0, total: 0 };
    }
  }

  /**
   * Clean up temporary files
   */
  async cleanupTemp() {
    try {
      const files = await this.listFiles('temp');
      let deletedCount = 0;
      
      for (const file of files) {
        await this.deleteFile(file.name, 'temp');
        deletedCount++;
      }
      
      if (appConfig.development.enableLogging && deletedCount > 0) {
        console.log(`🗂️ Cleaned up ${deletedCount} temporary files`);
      }
      
      return deletedCount;
    } catch (error) {
      ErrorHandler.handleError(error, 'OPFS Cleanup');
      return 0;
    }
  }

  /**
   * Clean up old cache files
   */
  async cleanupCache(maxAge = appConfig.performance.caching.maxAge) {
    try {
      const files = await this.listFiles('cache');
      const now = Date.now();
      let deletedCount = 0;
      
      for (const file of files) {
        if (now - file.lastModified > maxAge) {
          await this.deleteFile(file.name, 'cache');
          deletedCount++;
        }
      }
      
      if (appConfig.development.enableLogging && deletedCount > 0) {
        console.log(`🗂️ Cleaned up ${deletedCount} old cache files`);
      }
      
      return deletedCount;
    } catch (error) {
      ErrorHandler.handleError(error, 'OPFS Cache Cleanup');
      return 0;
    }
  }

  /**
   * Add event listener for storage events
   */
  addEventListener(callback) {
    this.listeners.add(callback);
  }

  /**
   * Remove event listener
   */
  removeEventListener(callback) {
    this.listeners.delete(callback);
  }

  /**
   * Notify listeners of storage events
   */
  notifyListeners(event, data) {
    this.listeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.warn('Error in OPFS event listener:', error);
      }
    });
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
   * Get fallback storage (localStorage) when OPFS is not available
   */
  getFallbackStorage() {
    return {
      setItem: (key, value) => {
        try {
          localStorage.setItem(`opfs_fallback_${key}`, value);
        } catch (error) {
          console.warn('Fallback storage error:', error);
        }
      },
      getItem: (key) => {
        try {
          return localStorage.getItem(`opfs_fallback_${key}`);
        } catch (error) {
          console.warn('Fallback storage error:', error);
          return null;
        }
      },
      removeItem: (key) => {
        try {
          localStorage.removeItem(`opfs_fallback_${key}`);
        } catch (error) {
          console.warn('Fallback storage error:', error);
        }
      }
    };
  }
}

// Export singleton instance
export default OPFSStorageManager.getInstance();