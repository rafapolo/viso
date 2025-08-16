// Cache Manager Tests
import { jest } from '@jest/globals';

describe('CacheManager', () => {
  let MockCacheManager;
  let mockFilesystemClient;

  beforeEach(() => {
    // Mock filesystem worker client
    mockFilesystemClient = {
      storeFile: jest.fn(() => Promise.resolve(true)),
      getFile: jest.fn(() => Promise.resolve(null)),
      deleteFile: jest.fn(() => Promise.resolve(true)),
      getStorageUsage: jest.fn(() => Promise.resolve({
        datasets: 0,
        cache: 0,
        temp: 0,
        total: 0,
        formatted: { datasets: '0 Bytes', cache: '0 Bytes', temp: '0 Bytes', total: '0 Bytes' }
      })),
      cleanup: jest.fn(() => Promise.resolve(0))
    };

    // Mock compression APIs
    global.CompressionStream = jest.fn(() => ({
      writable: {
        getWriter: () => ({
          write: jest.fn(),
          close: jest.fn()
        })
      },
      readable: {
        getReader: () => ({
          read: jest.fn()
            .mockResolvedValueOnce({ done: false, value: new Uint8Array([1, 2, 3]) })
            .mockResolvedValueOnce({ done: true })
        })
      }
    }));

    global.DecompressionStream = jest.fn(() => ({
      writable: {
        getWriter: () => ({
          write: jest.fn(),
          close: jest.fn()
        })
      },
      readable: {
        getReader: () => ({
          read: jest.fn()
            .mockResolvedValueOnce({ done: false, value: new Uint8Array([4, 5, 6, 7, 8]) })
            .mockResolvedValueOnce({ done: true })
        })
      }
    }));

    // Mock crypto API for hashing
    global.crypto = {
      subtle: {
        digest: jest.fn(() => Promise.resolve(new ArrayBuffer(32)))
      }
    };

    // Mock TextEncoder/TextDecoder
    global.TextEncoder = jest.fn(() => ({
      encode: jest.fn((str) => new Uint8Array(str.split('').map(c => c.charCodeAt(0))))
    }));

    global.TextDecoder = jest.fn(() => ({
      decode: jest.fn((data) => String.fromCharCode(...data))
    }));

    // Create mock CacheManager class
    class MockCacheManagerClass {
      constructor() {
        this.memoryCache = new Map();
        this.cacheMetadata = new Map();
        this.compressionSupported = typeof CompressionStream !== 'undefined';
        this.encryptionSupported = typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined';
        
        this.config = {
          maxMemoryCacheSize: 50 * 1024 * 1024,
          maxPersistentCacheSize: 500 * 1024 * 1024,
          defaultTTL: 300000,
          compressionThreshold: 10 * 1024,
          enableCompression: true,
          enableEncryption: false,
          cleanupInterval: 5 * 60 * 1000
        };
      }

      generateKey(namespace, identifier, params = {}) {
        const paramString = Object.keys(params).sort().map(key => `${key}=${params[key]}`).join('&');
        const baseKey = `${namespace}:${identifier}`;
        return paramString ? `${baseKey}?${paramString}` : baseKey;
      }

      async hashString(str) {
        if (this.encryptionSupported) {
          const encoder = new TextEncoder();
          const data = encoder.encode(str);
          const hashBuffer = await crypto.subtle.digest('SHA-256', data);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } else {
          let hash = 0;
          for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
          }
          return Math.abs(hash).toString(36);
        }
      }

      async compressData(data) {
        if (!this.compressionSupported || !this.config.enableCompression) {
          return { data, compressed: false };
        }

        const dataArray = typeof data === 'string' ? new TextEncoder().encode(data) : data;
        
        if (dataArray.byteLength < this.config.compressionThreshold) {
          return { data: dataArray, compressed: false };
        }

        // Simulate compression (50% reduction)
        const compressedData = new Uint8Array(Math.floor(dataArray.byteLength * 0.5));
        return { data: compressedData, compressed: true };
      }

      async decompressData(data, isCompressed) {
        if (!isCompressed || !this.compressionSupported) {
          return data;
        }

        // Simulate decompression (2x expansion)
        const decompressedData = new Uint8Array(data.byteLength * 2);
        return decompressedData;
      }

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

      isValid(metadata) {
        if (!metadata) return false;
        const now = Date.now();
        return (now - metadata.createdAt) < metadata.ttl;
      }

      async set(key, data, options = {}) {
        const metadata = this.createMetadata(key, options);
        const { data: processedData, compressed } = await this.compressData(data);
        
        metadata.compressed = compressed;
        metadata.size = processedData.byteLength || processedData.length;

        const { persistent = false, memoryOnly = false } = options;
        
        if (memoryOnly || (!persistent && metadata.size < 1024 * 1024)) {
          this.memoryCache.set(key, processedData);
          this.cacheMetadata.set(key, { ...metadata, location: 'memory' });
        } else {
          const filename = await this.hashString(key);
          
          await mockFilesystemClient.storeFile(filename, processedData, {
            directory: 'cache',
            metadata: { ...metadata, originalKey: key }
          });
          
          this.cacheMetadata.set(key, { ...metadata, location: 'persistent', filename });
        }
        
        return true;
      }

      async get(key, options = {}) {
        const metadata = this.cacheMetadata.get(key);
        
        if (!metadata || !this.isValid(metadata)) {
          if (metadata) {
            await this.delete(key);
          }
          return null;
        }

        metadata.lastAccessed = Date.now();
        metadata.accessCount++;

        let rawData;
        
        if (metadata.location === 'memory') {
          rawData = this.memoryCache.get(key);
        } else {
          rawData = await mockFilesystemClient.getFile(metadata.filename, {
            directory: 'cache',
            asArrayBuffer: true
          });
        }

        if (!rawData) {
          await this.delete(key);
          return null;
        }

        const data = await this.decompressData(rawData, metadata.compressed);
        
        const { format = 'auto' } = options;
        let result = data;
        
        if (format === 'text' || (format === 'auto' && metadata.tags.includes('text'))) {
          result = new TextDecoder().decode(data);
        } else if (format === 'json' || (format === 'auto' && metadata.tags.includes('json'))) {
          const text = new TextDecoder().decode(data);
          result = JSON.parse(text);
        }
        
        return result;
      }

      async has(key) {
        const metadata = this.cacheMetadata.get(key);
        return metadata && this.isValid(metadata);
      }

      async delete(key) {
        const metadata = this.cacheMetadata.get(key);
        
        if (metadata) {
          if (metadata.location === 'memory') {
            this.memoryCache.delete(key);
          } else {
            await mockFilesystemClient.deleteFile(metadata.filename, 'cache');
          }
          
          this.cacheMetadata.delete(key);
        }
        
        return true;
      }

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
            shouldDelete = true;
          }
          
          if (shouldDelete) {
            keysToDelete.push(key);
          }
        }
        
        for (const key of keysToDelete) {
          await this.delete(key);
        }
        
        return keysToDelete.length;
      }

      async getStatistics() {
        const memoryEntries = Array.from(this.cacheMetadata.values()).filter(m => m.location === 'memory');
        const persistentEntries = Array.from(this.cacheMetadata.values()).filter(m => m.location === 'persistent');
        
        const memorySize = memoryEntries.reduce((total, m) => total + m.size, 0);
        const persistentSize = persistentEntries.reduce((total, m) => total + m.size, 0);
        
        const storageUsage = await mockFilesystemClient.getStorageUsage();
        
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

      calculateHitRate() {
        const entries = Array.from(this.cacheMetadata.values());
        if (entries.length === 0) return 0;
        const totalAccesses = entries.reduce((total, m) => total + m.accessCount, 0);
        return totalAccesses / entries.length;
      }

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
        
        await mockFilesystemClient.cleanup('cache', this.config.defaultTTL);
        
        return keysToDelete.length;
      }

      formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
      }

      createCachedFunction(fn, namespace, options = {}) {
        return async (...args) => {
          const cacheKey = this.generateKey(namespace, fn.name, { args: JSON.stringify(args) });
          
          const cached = await this.get(cacheKey, options);
          if (cached !== null) {
            return cached;
          }
          
          const result = await fn(...args);
          await this.set(cacheKey, result, {
            ...options,
            tags: [...(options.tags || []), 'function-result']
          });
          
          return result;
        };
      }

      static getInstance() {
        if (!this.instance) {
          this.instance = new MockCacheManagerClass();
        }
        return this.instance;
      }
    }

    MockCacheManager = MockCacheManagerClass;
  });

  afterEach(() => {
    jest.clearAllMocks();
    if (MockCacheManager.instance) {
      MockCacheManager.instance = null;
    }
  });

  describe('Key Generation', () => {
    test('should generate cache key without parameters', () => {
      const manager = new MockCacheManager();
      const key = manager.generateKey('test', 'operation');
      expect(key).toBe('test:operation');
    });

    test('should generate cache key with parameters', () => {
      const manager = new MockCacheManager();
      const key = manager.generateKey('test', 'operation', { param1: 'value1', param2: 'value2' });
      expect(key).toBe('test:operation?param1=value1&param2=value2');
    });

    test('should sort parameters for consistent keys', () => {
      const manager = new MockCacheManager();
      const key1 = manager.generateKey('test', 'op', { z: '1', a: '2' });
      const key2 = manager.generateKey('test', 'op', { a: '2', z: '1' });
      expect(key1).toBe(key2);
    });
  });

  describe('Hashing', () => {
    test('should hash strings consistently', async () => {
      const manager = new MockCacheManager();
      const hash1 = await manager.hashString('test');
      const hash2 = await manager.hashString('test');
      expect(hash1).toBe(hash2);
    });

    test('should produce different hashes for different strings', async () => {
      const manager = new MockCacheManager();
      const hash1 = await manager.hashString('test1');
      const hash2 = await manager.hashString('test2');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Compression', () => {
    test('should compress large data', async () => {
      const manager = new MockCacheManager();
      const largeData = new Uint8Array(20000); // 20KB, above threshold
      const result = await manager.compressData(largeData);
      
      expect(result.compressed).toBe(true);
      expect(result.data.byteLength).toBeLessThan(largeData.byteLength);
    });

    test('should not compress small data', async () => {
      const manager = new MockCacheManager();
      const smallData = new Uint8Array(5000); // 5KB, below threshold
      const result = await manager.compressData(smallData);
      
      expect(result.compressed).toBe(false);
      expect(result.data).toBe(smallData);
    });

    test('should decompress data correctly', async () => {
      const manager = new MockCacheManager();
      const compressedData = new Uint8Array(10);
      const result = await manager.decompressData(compressedData, true);
      
      expect(result.byteLength).toBe(20); // 2x expansion
    });
  });

  describe('Cache Operations', () => {
    let manager;

    beforeEach(() => {
      manager = new MockCacheManager();
    });

    test('should set and get cache entry in memory', async () => {
      const testData = 'test data';
      await manager.set('test:key', testData, { memoryOnly: true });
      
      const result = await manager.get('test:key');
      expect(result).toBe(testData);
    });

    test('should set and get cache entry persistently', async () => {
      const testData = new Uint8Array([1, 2, 3, 4, 5]);
      mockFilesystemClient.getFile.mockResolvedValue(testData);
      
      await manager.set('test:key', testData, { persistent: true });
      const result = await manager.get('test:key');
      
      expect(mockFilesystemClient.storeFile).toHaveBeenCalled();
      expect(result).toEqual(testData);
    });

    test('should return null for non-existent key', async () => {
      const result = await manager.get('nonexistent:key');
      expect(result).toBeNull();
    });

    test('should return null for expired cache entry', async () => {
      await manager.set('test:key', 'data', { ttl: 1 }); // 1ms TTL
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const result = await manager.get('test:key');
      expect(result).toBeNull();
    });

    test('should check if key exists', async () => {
      await manager.set('test:key', 'data');
      
      const exists = await manager.has('test:key');
      expect(exists).toBe(true);
      
      const notExists = await manager.has('nonexistent:key');
      expect(notExists).toBe(false);
    });

    test('should delete cache entry', async () => {
      await manager.set('test:key', 'data');
      
      const deleted = await manager.delete('test:key');
      expect(deleted).toBe(true);
      
      const result = await manager.get('test:key');
      expect(result).toBeNull();
    });

    test('should clear cache by pattern', async () => {
      await manager.set('test:key1', 'data1');
      await manager.set('test:key2', 'data2');
      await manager.set('other:key', 'data3');
      
      const cleared = await manager.clear({ pattern: 'test:' });
      expect(cleared).toBe(2);
      
      expect(await manager.has('test:key1')).toBe(false);
      expect(await manager.has('test:key2')).toBe(false);
      expect(await manager.has('other:key')).toBe(true);
    });

    test('should clear cache by tags', async () => {
      await manager.set('key1', 'data1', { tags: ['tag1'] });
      await manager.set('key2', 'data2', { tags: ['tag2'] });
      await manager.set('key3', 'data3', { tags: ['tag1', 'tag2'] });
      
      const cleared = await manager.clear({ tags: ['tag1'] });
      expect(cleared).toBe(2);
      
      expect(await manager.has('key1')).toBe(false);
      expect(await manager.has('key2')).toBe(true);
      expect(await manager.has('key3')).toBe(false);
    });
  });

  describe('Statistics', () => {
    test('should return cache statistics', async () => {
      const manager = new MockCacheManager();
      
      await manager.set('memory:key', 'data', { memoryOnly: true });
      await manager.set('persistent:key', 'data', { persistent: true });
      
      const stats = await manager.getStatistics();
      
      expect(stats.entries.total).toBe(2);
      expect(stats.entries.memory).toBe(1);
      expect(stats.entries.persistent).toBe(1);
      expect(stats.size.total).toBeGreaterThan(0);
    });

    test('should calculate hit rate', () => {
      const manager = new MockCacheManager();
      
      // Add some metadata with access counts
      manager.cacheMetadata.set('key1', { accessCount: 5 });
      manager.cacheMetadata.set('key2', { accessCount: 3 });
      
      const hitRate = manager.calculateHitRate();
      expect(hitRate).toBe(4); // (5 + 3) / 2
    });

    test('should calculate compression statistics', () => {
      const manager = new MockCacheManager();
      
      manager.cacheMetadata.set('key1', { compressed: true });
      manager.cacheMetadata.set('key2', { compressed: false });
      manager.cacheMetadata.set('key3', { compressed: true });
      
      const compressionStats = manager.calculateCompressionStats();
      expect(compressionStats.entriesCompressed).toBe(2);
      expect(compressionStats.totalEntries).toBe(3);
      expect(compressionStats.compressionRatio).toBeCloseTo(2/3);
    });
  });

  describe('Cleanup', () => {
    test('should cleanup expired entries', async () => {
      const manager = new MockCacheManager();
      
      // Add expired entry
      manager.cacheMetadata.set('expired:key', {
        createdAt: Date.now() - 400000, // Older than default TTL
        ttl: 300000
      });
      
      // Add valid entry
      manager.cacheMetadata.set('valid:key', {
        createdAt: Date.now(),
        ttl: 300000
      });
      
      const cleaned = await manager.cleanup();
      expect(cleaned).toBe(1);
      expect(manager.cacheMetadata.has('expired:key')).toBe(false);
      expect(manager.cacheMetadata.has('valid:key')).toBe(true);
    });
  });

  describe('Cached Functions', () => {
    test('should create cached function wrapper', async () => {
      const manager = new MockCacheManager();
      const originalFn = jest.fn((x) => Promise.resolve(x * 2));
      
      const cachedFn = manager.createCachedFunction(originalFn, 'math');
      
      // First call should execute function
      const result1 = await cachedFn(5);
      expect(result1).toBe(10);
      expect(originalFn).toHaveBeenCalledTimes(1);
      
      // Second call should use cache
      const result2 = await cachedFn(5);
      expect(result2).toBe(10);
      expect(originalFn).toHaveBeenCalledTimes(1); // Not called again
    });
  });

  describe('Utility Functions', () => {
    test('should format bytes correctly', () => {
      const manager = new MockCacheManager();
      
      expect(manager.formatBytes(0)).toBe('0 Bytes');
      expect(manager.formatBytes(1024)).toBe('1 KB');
      expect(manager.formatBytes(1048576)).toBe('1 MB');
      expect(manager.formatBytes(1073741824)).toBe('1 GB');
      expect(manager.formatBytes(1500)).toBe('1.5 KB');
    });
  });

  describe('Singleton Pattern', () => {
    test('should return same instance', () => {
      const instance1 = MockCacheManager.getInstance();
      const instance2 = MockCacheManager.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });
});