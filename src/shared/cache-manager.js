// Advanced Cache Manager with Data Versioning and OPFS Integration
import filesystemWorkerClient from './filesystem-worker-client.js';
import { ErrorHandler } from './error-handler.js';
import appConfig from './app-config.js';

export class CacheManager {
  static instance = null;
  
  constructor() {
    this.memoryCache = new Map();
    this.cacheMetadata = new Map();
    this.compressionSupported = typeof CompressionStream !== 'undefined';
    this.encryptionSupported = typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined';
    
    // Cache configuration
    this.config = {
      maxMemoryCacheSize: 50 * 1024 * 1024, // 50MB
      maxPersistentCacheSize: 500 * 1024 * 1024, // 500MB
      defaultTTL: appConfig.performance.caching.maxAge,
      compressionThreshold: 10 * 1024, // 10KB
      enableCompression: true,
      enableEncryption: false,
      cleanupInterval: 5 * 60 * 1000 // 5 minutes
    };
    
    this.startCleanupTimer();
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new CacheManager();
    }
    return this.instance;
  }

  /**
   * Generate cache key
   */
  generateKey(namespace, identifier, params = {}) {
    const paramString = Object.keys(params).sort().map(key => `${key}=${params[key]}`).join('&');
    const baseKey = `${namespace}:${identifier}`;
    return paramString ? `${baseKey}?${paramString}` : baseKey;
  }

  /**
   * Hash string for consistent key generation
   */
  async hashString(str) {
    if (this.encryptionSupported) {
      const encoder = new TextEncoder();
      const data = encoder.encode(str);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } else {
      // Simple hash fallback
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return Math.abs(hash).toString(36);
    }
  }

  /**
   * Compress data if supported and beneficial
   */
  async compressData(data) {
    if (!this.compressionSupported || !this.config.enableCompression) {
      return { data, compressed: false };
    }

    try {
      const dataArray = typeof data === 'string' ? new TextEncoder().encode(data) : data;
      
      if (dataArray.byteLength < this.config.compressionThreshold) {
        return { data: dataArray, compressed: false };
      }

      const stream = new CompressionStream('gzip');
      const writer = stream.writable.getWriter();
      const reader = stream.readable.getReader();
      
      writer.write(dataArray);
      writer.close();
      
      const chunks = [];
      let result = await reader.read();
      
      while (!result.done) {
        chunks.push(result.value);
        result = await reader.read();
      }

      const compressedSize = chunks.reduce((size, chunk) => size + chunk.byteLength, 0);
      const compressedData = new Uint8Array(compressedSize);
      let offset = 0;
      
      for (const chunk of chunks) {
        compressedData.set(chunk, offset);
        offset += chunk.byteLength;
      }

      // Only use compression if it actually saves space
      if (compressedData.byteLength < dataArray.byteLength * 0.9) {
        return { data: compressedData, compressed: true };
      } else {
        return { data: dataArray, compressed: false };
      }
    } catch (error) {
      console.warn('Compression failed, using uncompressed data:', error);
      return { data: typeof data === 'string' ? new TextEncoder().encode(data) : data, compressed: false };
    }
  }

  /**
   * Decompress data if needed
   */
  async decompressData(data, isCompressed) {
    if (!isCompressed || !this.compressionSupported) {
      return data;
    }

    try {
      const stream = new DecompressionStream('gzip');
      const writer = stream.writable.getWriter();
      const reader = stream.readable.getReader();
      
      writer.write(data);
      writer.close();
      
      const chunks = [];
      let result = await reader.read();
      
      while (!result.done) {
        chunks.push(result.value);
        result = await reader.read();
      }

      const decompressedSize = chunks.reduce((size, chunk) => size + chunk.byteLength, 0);
      const decompressedData = new Uint8Array(decompressedSize);
      let offset = 0;
      
      for (const chunk of chunks) {
        decompressedData.set(chunk, offset);
        offset += chunk.byteLength;
      }

      return decompressedData;
    } catch (error) {
      console.warn('Decompression failed:', error);
      return data;
    }
  }

  /**
   * Create cache metadata
   */
  createMetadata(key, options = {}) {
    const now = Date.now();
    return {
      key,
      createdAt: now,
      lastAccessed: now,
      accessCount: 0,
      ttl: options.ttl || this.config.defaultTTL,
      version: options.version || '1.0',
      tags: options.tags || [],
      compressed: false,
      encrypted: false,
      size: 0,
      etag: options.etag || null,
      dependencies: options.dependencies || []
    };
  }

  /**
   * Check if cache entry is valid
   */
  isValid(metadata) {
    if (!metadata) return false;
    
    const now = Date.now();
    return (now - metadata.createdAt) < metadata.ttl;
  }

  /**
   * Set cache entry
   */
  async set(key, data, options = {}) {
    try {
      const metadata = this.createMetadata(key, options);
      const { data: processedData, compressed } = await this.compressData(data);
      
      metadata.compressed = compressed;
      metadata.size = processedData.byteLength || processedData.length;

      // Decide storage location based on size and persistence requirements
      const { persistent = false, memoryOnly = false } = options;
      
      if (memoryOnly || (!persistent && metadata.size < 1024 * 1024)) {
        // Store in memory cache
        this.memoryCache.set(key, processedData);
        this.cacheMetadata.set(key, { ...metadata, location: 'memory' });
        
        // Check memory cache size limit
        this.enforceMemoryCacheLimit();
      } else {
        // Store in persistent cache (OPFS)
        const filename = await this.hashString(key);
        
        await filesystemWorkerClient.storeFile(filename, processedData, {
          directory: 'cache',
          metadata: {
            ...metadata,
            originalKey: key
          }
        });
        
        this.cacheMetadata.set(key, { ...metadata, location: 'persistent', filename });
      }
      
      if (appConfig.development.enableLogging) {
        console.log(`💾 Cached: ${key} (${this.formatBytes(metadata.size)}, ${metadata.location})`);
      }
      
      return true;
    } catch (error) {
      ErrorHandler.handleError(error, `Cache Set: ${key}`);
      return false;
    }
  }

  /**
   * Get cache entry
   */
  async get(key, options = {}) {
    try {
      const metadata = this.cacheMetadata.get(key);
      
      if (!metadata || !this.isValid(metadata)) {
        if (metadata) {
          await this.delete(key);
        }
        return null;
      }

      // Update access statistics
      metadata.lastAccessed = Date.now();
      metadata.accessCount++;

      let rawData;
      
      if (metadata.location === 'memory') {
        rawData = this.memoryCache.get(key);
      } else {
        // Load from persistent storage
        rawData = await filesystemWorkerClient.getFile(metadata.filename, {
          directory: 'cache',
          asArrayBuffer: true
        });
      }

      if (!rawData) {
        await this.delete(key);
        return null;
      }

      // Decompress if necessary
      const data = await this.decompressData(rawData, metadata.compressed);
      
      // Convert back to appropriate format
      const { format = 'auto' } = options;
      let result = data;
      
      if (format === 'text' || (format === 'auto' && metadata.tags.includes('text'))) {
        result = new TextDecoder().decode(data);
      } else if (format === 'json' || (format === 'auto' && metadata.tags.includes('json'))) {
        const text = new TextDecoder().decode(data);
        result = JSON.parse(text);
      }
      
      if (appConfig.development.enableLogging) {
        console.log(`🎯 Cache hit: ${key} (${metadata.location})`);
      }
      
      return result;
    } catch (error) {
      ErrorHandler.handleError(error, `Cache Get: ${key}`);
      await this.delete(key);
      return null;
    }
  }

  /**
   * Check if key exists in cache
   */
  async has(key) {
    const metadata = this.cacheMetadata.get(key);
    return metadata && this.isValid(metadata);
  }

  /**
   * Delete cache entry
   */
  async delete(key) {
    try {
      const metadata = this.cacheMetadata.get(key);
      
      if (metadata) {
        if (metadata.location === 'memory') {
          this.memoryCache.delete(key);
        } else {
          await filesystemWorkerClient.deleteFile(metadata.filename, 'cache');
        }
        
        this.cacheMetadata.delete(key);
        
        if (appConfig.development.enableLogging) {
          console.log(`🗑️ Cache deleted: ${key}`);
        }
      }
      
      return true;
    } catch (error) {
      ErrorHandler.handleError(error, `Cache Delete: ${key}`);
      return false;
    }
  }

  /**
   * Clear cache by pattern or tags
   */
  async clear(options = {}) {
    const { pattern, tags, namespace } = options;
    const keysToDelete = [];
    
    for (const [key, metadata] of this.cacheMetadata.entries()) {
      let shouldDelete = false;
      
      if (pattern && key.includes(pattern)) {
        shouldDelete = true;
      } else if (tags && tags.some(tag => metadata.tags.includes(tag))) {
        shouldDelete = true;
      } else if (namespace && key.startsWith(namespace + ':')) {
        shouldDelete = true;
      } else if (!pattern && !tags && !namespace) {
        shouldDelete = true; // Clear all
      }
      
      if (shouldDelete) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      await this.delete(key);
    }
    
    if (appConfig.development.enableLogging) {
      console.log(`🧹 Cache cleared: ${keysToDelete.length} entries`);
    }
    
    return keysToDelete.length;
  }

  /**
   * Get cache statistics
   */
  async getStatistics() {
    const memoryEntries = Array.from(this.cacheMetadata.values()).filter(m => m.location === 'memory');
    const persistentEntries = Array.from(this.cacheMetadata.values()).filter(m => m.location === 'persistent');
    
    const memorySize = memoryEntries.reduce((total, m) => total + m.size, 0);
    const persistentSize = persistentEntries.reduce((total, m) => total + m.size, 0);
    
    const storageUsage = await filesystemWorkerClient.getStorageUsage();
    
    return {
      entries: {
        total: this.cacheMetadata.size,
        memory: memoryEntries.length,
        persistent: persistentEntries.length
      },
      size: {
        memory: memorySize,
        persistent: persistentSize,
        total: memorySize + persistentSize,
        formatted: {
          memory: this.formatBytes(memorySize),
          persistent: this.formatBytes(persistentSize),
          total: this.formatBytes(memorySize + persistentSize)
        }
      },
      storage: storageUsage,
      hitRate: this.calculateHitRate(),
      compression: this.calculateCompressionStats()
    };
  }

  /**
   * Calculate cache hit rate
   */
  calculateHitRate() {
    const entries = Array.from(this.cacheMetadata.values());
    if (entries.length === 0) return 0;
    
    const totalAccesses = entries.reduce((total, m) => total + m.accessCount, 0);
    return totalAccesses / entries.length;
  }

  /**
   * Calculate compression statistics
   */
  calculateCompressionStats() {
    const entries = Array.from(this.cacheMetadata.values());
    const compressedEntries = entries.filter(m => m.compressed);
    
    return {
      enabled: this.config.enableCompression,
      supported: this.compressionSupported,
      entriesCompressed: compressedEntries.length,
      totalEntries: entries.length,
      compressionRatio: compressedEntries.length / Math.max(entries.length, 1)
    };
  }

  /**
   * Enforce memory cache size limit
   */
  enforceMemoryCacheLimit() {
    const memoryEntries = Array.from(this.cacheMetadata.entries())
      .filter(([_, metadata]) => metadata.location === 'memory')
      .sort(([_, a], [__, b]) => a.lastAccessed - b.lastAccessed); // LRU
    
    const currentSize = memoryEntries.reduce((total, [_, metadata]) => total + metadata.size, 0);
    
    if (currentSize > this.config.maxMemoryCacheSize) {
      let sizeToRemove = currentSize - this.config.maxMemoryCacheSize;
      
      for (const [key, metadata] of memoryEntries) {
        if (sizeToRemove <= 0) break;
        
        this.memoryCache.delete(key);
        this.cacheMetadata.delete(key);
        sizeToRemove -= metadata.size;
        
        if (appConfig.development.enableLogging) {
          console.log(`🧹 Evicted from memory cache: ${key}`);
        }
      }
    }
  }

  /**
   * Cleanup expired entries
   */
  async cleanup() {
    const now = Date.now();
    const keysToDelete = [];
    
    for (const [key, metadata] of this.cacheMetadata.entries()) {
      if (!this.isValid(metadata)) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      await this.delete(key);
    }
    
    // Also cleanup orphaned files in OPFS cache directory
    await filesystemWorkerClient.cleanup('cache', this.config.defaultTTL);
    
    if (appConfig.development.enableLogging && keysToDelete.length > 0) {
      console.log(`🧹 Cache cleanup: removed ${keysToDelete.length} expired entries`);
    }
    
    return keysToDelete.length;
  }

  /**
   * Start automatic cleanup timer
   */
  startCleanupTimer() {
    this.cleanupTimer = setInterval(() => {
      this.cleanup().catch(error => {
        console.warn('Cache cleanup error:', error);
      });
    }, this.config.cleanupInterval);
  }

  /**
   * Stop cleanup timer
   */
  stopCleanupTimer() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Invalidate cache by dependency
   */
  async invalidateByDependency(dependency) {
    const keysToDelete = [];
    
    for (const [key, metadata] of this.cacheMetadata.entries()) {
      if (metadata.dependencies.includes(dependency)) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      await this.delete(key);
    }
    
    return keysToDelete.length;
  }

  /**
   * Create a cached function wrapper
   */
  createCachedFunction(fn, namespace, options = {}) {
    return async (...args) => {
      const cacheKey = this.generateKey(namespace, fn.name, { args: JSON.stringify(args) });
      
      // Try to get from cache first
      const cached = await this.get(cacheKey, options);
      if (cached !== null) {
        return cached;
      }
      
      // Execute function and cache result
      const result = await fn(...args);
      await this.set(cacheKey, result, {
        ...options,
        tags: [...(options.tags || []), 'function-result']
      });
      
      return result;
    };
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
   * Cleanup on application shutdown
   */
  async shutdown() {
    this.stopCleanupTimer();
    await this.cleanup();
    this.memoryCache.clear();
    this.cacheMetadata.clear();
  }
}

// Export singleton instance
export default CacheManager.getInstance();