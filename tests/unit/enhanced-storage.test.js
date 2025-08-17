import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { OPFSStorageManager, CacheManager } from '../../src/shared/enhanced-storage.js';

// Mock OPFS API
const mockFileHandle = {
  createWritable: jest.fn(),
  getFile: jest.fn()
};

const mockWritable = {
  write: jest.fn(),
  close: jest.fn()
};

const mockDirectoryHandle = {
  getFileHandle: jest.fn(),
  getDirectoryHandle: jest.fn(),
  removeEntry: jest.fn()
};

const mockFile = {
  arrayBuffer: jest.fn(),
  size: 1024,
  lastModified: Date.now()
};

// Mock navigator.storage
global.navigator = {
  storage: {
    getDirectory: jest.fn()
  }
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
      read: jest.fn().mockResolvedValue({ done: true, value: new Uint8Array([1, 2, 3]) })
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
      read: jest.fn().mockResolvedValue({ done: true, value: new Uint8Array([1, 2, 3]) })
    })
  }
}));

describe('OPFSStorageManager', () => {
  let storageManager;

  beforeEach(() => {
    storageManager = new OPFSStorageManager();
    jest.clearAllMocks();
    
    // Setup default mocks
    mockFileHandle.createWritable.mockResolvedValue(mockWritable);
    mockFileHandle.getFile.mockResolvedValue(mockFile);
    mockDirectoryHandle.getFileHandle.mockResolvedValue(mockFileHandle);
    mockDirectoryHandle.getDirectoryHandle.mockResolvedValue(mockDirectoryHandle);
    mockFile.arrayBuffer.mockResolvedValue(new ArrayBuffer(10));
    navigator.storage.getDirectory.mockResolvedValue(mockDirectoryHandle);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with default values', () => {
      expect(storageManager.isSupported).toBe(false);
      expect(storageManager.rootHandle).toBeNull();
      expect(storageManager.initialized).toBe(false);
    });
  });

  describe('initialize', () => {
    it('should successfully initialize when OPFS is supported', async () => {
      const result = await storageManager.initialize();
      
      expect(result).toBe(true);
      expect(storageManager.isSupported).toBe(true);
      expect(storageManager.initialized).toBe(true);
      expect(storageManager.rootHandle).toBe(mockDirectoryHandle);
      expect(navigator.storage.getDirectory).toHaveBeenCalled();
    });

    it('should return false when OPFS is not supported', async () => {
      delete navigator.storage;
      
      const result = await storageManager.initialize();
      
      expect(result).toBe(false);
      expect(storageManager.isSupported).toBe(false);
      expect(storageManager.initialized).toBe(false);
    });

    it('should handle initialization errors gracefully', async () => {
      navigator.storage.getDirectory.mockRejectedValue(new Error('OPFS not available'));
      
      const result = await storageManager.initialize();
      
      expect(result).toBe(false);
      expect(storageManager.isSupported).toBe(false);
    });

    it('should not reinitialize if already initialized', async () => {
      storageManager.initialized = true;
      
      const result = await storageManager.initialize();
      
      expect(result).toBe(true);
      expect(navigator.storage.getDirectory).not.toHaveBeenCalled();
    });
  });

  describe('storeFile', () => {
    beforeEach(async () => {
      await storageManager.initialize();
    });

    it('should store a file successfully', async () => {
      const testData = 'test data';
      const testPath = 'test/file.txt';
      
      const updateMetadataSpy = jest.spyOn(storageManager, 'updateMetadata').mockResolvedValue();
      
      const result = await storageManager.storeFile(testPath, testData);
      
      expect(result).toBe(true);
      expect(mockDirectoryHandle.getDirectoryHandle).toHaveBeenCalledWith('test', { create: true });
      expect(mockDirectoryHandle.getFileHandle).toHaveBeenCalledWith('file.txt', { create: true });
      expect(mockWritable.write).toHaveBeenCalledWith(testData);
      expect(mockWritable.close).toHaveBeenCalled();
      expect(updateMetadataSpy).toHaveBeenCalledWith(testPath, expect.any(Object));
    });

    it('should throw error when OPFS is not supported', async () => {
      storageManager.isSupported = false;
      
      await expect(storageManager.storeFile('test.txt', 'data'))
        .rejects.toThrow('OPFS not supported');
    });

    it('should handle compression when enabled', async () => {
      const testData = new ArrayBuffer(10);
      const compressDataSpy = jest.spyOn(storageManager, 'compressData')
        .mockResolvedValue(new ArrayBuffer(5));
      
      await storageManager.storeFile('test.dat', testData, { compress: true });
      
      expect(compressDataSpy).toHaveBeenCalledWith(testData);
    });

    it('should handle file creation errors', async () => {
      mockDirectoryHandle.getFileHandle.mockRejectedValue(new Error('File creation failed'));
      
      await expect(storageManager.storeFile('test.txt', 'data'))
        .rejects.toThrow('Failed to store file test.txt: File creation failed');
    });
  });

  describe('getFile', () => {
    beforeEach(async () => {
      await storageManager.initialize();
    });

    it('should retrieve a file successfully', async () => {
      const testPath = 'test/file.txt';
      const mockMetadata = { compressed: false, size: 1024 };
      
      const getMetadataSpy = jest.spyOn(storageManager, 'getMetadata')
        .mockResolvedValue(mockMetadata);
      
      const result = await storageManager.getFile(testPath);
      
      expect(result).toEqual({
        data: expect.any(ArrayBuffer),
        metadata: expect.objectContaining({
          size: mockFile.size,
          lastModified: mockFile.lastModified,
          ...mockMetadata
        })
      });
      expect(mockDirectoryHandle.getDirectoryHandle).toHaveBeenCalledWith('test');
      expect(mockDirectoryHandle.getFileHandle).toHaveBeenCalledWith('file.txt');
      expect(getMetadataSpy).toHaveBeenCalledWith(testPath);
    });

    it('should return null for non-existent files', async () => {
      mockDirectoryHandle.getFileHandle.mockRejectedValue(
        Object.assign(new Error('Not found'), { name: 'NotFoundError' })
      );
      
      const result = await storageManager.getFile('nonexistent.txt');
      
      expect(result).toBeNull();
    });

    it('should decompress compressed files', async () => {
      const mockMetadata = { compressed: true };
      const decompressDataSpy = jest.spyOn(storageManager, 'decompressData')
        .mockResolvedValue(new ArrayBuffer(20));
      
      jest.spyOn(storageManager, 'getMetadata').mockResolvedValue(mockMetadata);
      
      const result = await storageManager.getFile('compressed.dat');
      
      expect(decompressDataSpy).toHaveBeenCalled();
      expect(result.data).toEqual(expect.any(ArrayBuffer));
    });

    it('should throw error when OPFS is not supported', async () => {
      storageManager.isSupported = false;
      
      await expect(storageManager.getFile('test.txt'))
        .rejects.toThrow('OPFS not supported');
    });
  });

  describe('deleteFile', () => {
    beforeEach(async () => {
      await storageManager.initialize();
    });

    it('should delete a file successfully', async () => {
      const testPath = 'test/file.txt';
      const deleteMetadataSpy = jest.spyOn(storageManager, 'deleteMetadata').mockResolvedValue();
      
      const result = await storageManager.deleteFile(testPath);
      
      expect(result).toBe(true);
      expect(mockDirectoryHandle.removeEntry).toHaveBeenCalledWith('file.txt');
      expect(deleteMetadataSpy).toHaveBeenCalledWith(testPath);
    });

    it('should return false when OPFS is not supported', async () => {
      storageManager.isSupported = false;
      
      const result = await storageManager.deleteFile('test.txt');
      
      expect(result).toBe(false);
    });

    it('should handle deletion errors gracefully', async () => {
      mockDirectoryHandle.removeEntry.mockRejectedValue(new Error('Delete failed'));
      
      const result = await storageManager.deleteFile('test.txt');
      
      expect(result).toBe(false);
    });
  });

  describe('compression', () => {
    beforeEach(async () => {
      await storageManager.initialize();
    });

    it('should compress data when CompressionStream is available', async () => {
      const testData = new ArrayBuffer(10);
      
      const result = await storageManager.compressData(testData);
      
      expect(result).toBeInstanceOf(ArrayBuffer);
      expect(global.CompressionStream).toHaveBeenCalledWith('gzip');
    });

    it('should return original data when CompressionStream is not available', async () => {
      const originalCompressionStream = global.CompressionStream;
      delete global.CompressionStream;
      
      const testData = new ArrayBuffer(10);
      const result = await storageManager.compressData(testData);
      
      expect(result).toBe(testData);
      
      global.CompressionStream = originalCompressionStream;
    });

    it('should decompress data when DecompressionStream is available', async () => {
      const testData = new ArrayBuffer(10);
      
      const result = await storageManager.decompressData(testData);
      
      expect(result).toBeInstanceOf(ArrayBuffer);
      expect(global.DecompressionStream).toHaveBeenCalledWith('gzip');
    });
  });
});

describe('CacheManager', () => {
  let cacheManager;
  let mockOPFSManager;

  beforeEach(() => {
    cacheManager = new CacheManager();
    mockOPFSManager = {
      initialize: jest.fn().mockResolvedValue(true),
      getFile: jest.fn(),
      storeFile: jest.fn(),
      deleteFile: jest.fn(),
      isSupported: true
    };
    
    // Replace internal OPFS manager
    cacheManager.opfsManager = mockOPFSManager;
    
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with default values', () => {
      expect(cacheManager.memoryCache).toBeInstanceOf(Map);
      expect(cacheManager.initialized).toBe(false);
      expect(cacheManager.stats).toEqual({
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0
      });
    });
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      const cleanupSpy = jest.spyOn(cacheManager, 'cleanup').mockResolvedValue(0);
      
      await cacheManager.initialize();
      
      expect(cacheManager.initialized).toBe(true);
      expect(mockOPFSManager.initialize).toHaveBeenCalled();
      expect(cleanupSpy).toHaveBeenCalled();
    });

    it('should not reinitialize if already initialized', async () => {
      cacheManager.initialized = true;
      
      await cacheManager.initialize();
      
      expect(mockOPFSManager.initialize).not.toHaveBeenCalled();
    });
  });

  describe('get', () => {
    beforeEach(async () => {
      await cacheManager.initialize();
    });

    it('should return data from memory cache', async () => {
      const testKey = 'test-key';
      const testData = { test: 'data' };
      const cacheEntry = {
        data: JSON.stringify(testData),
        expires: Date.now() + 3600000,
        created: Date.now()
      };
      
      cacheManager.memoryCache.set(testKey, cacheEntry);
      
      const result = await cacheManager.get(testKey);
      
      expect(result).toBe(JSON.stringify(testData));
      expect(cacheManager.stats.hits).toBe(1);
    });

    it('should return data from persistent cache when not in memory', async () => {
      const testKey = 'test-key';
      const testData = { test: 'data' };
      const cacheEntry = {
        data: JSON.stringify(testData),
        expires: Date.now() + 3600000,
        created: Date.now()
      };
      
      mockOPFSManager.getFile.mockResolvedValue({
        data: new TextEncoder().encode(JSON.stringify(cacheEntry))
      });
      
      const result = await cacheManager.get(testKey);
      
      expect(result).toBe(JSON.stringify(testData));
      expect(cacheManager.stats.hits).toBe(1);
      expect(mockOPFSManager.getFile).toHaveBeenCalledWith(`cache/${testKey}`);
    });

    it('should return null for expired entries', async () => {
      const testKey = 'test-key';
      const expiredEntry = {
        data: 'test data',
        expires: Date.now() - 1000, // Expired
        created: Date.now() - 3600000
      };
      
      cacheManager.memoryCache.set(testKey, expiredEntry);
      
      const result = await cacheManager.get(testKey);
      
      expect(result).toBeNull();
      expect(cacheManager.stats.misses).toBe(1);
      expect(cacheManager.memoryCache.has(testKey)).toBe(false);
    });

    it('should return null for non-existent keys', async () => {
      mockOPFSManager.getFile.mockResolvedValue(null);
      
      const result = await cacheManager.get('non-existent');
      
      expect(result).toBeNull();
      expect(cacheManager.stats.misses).toBe(1);
    });
  });

  describe('set', () => {
    beforeEach(async () => {
      await cacheManager.initialize();
    });

    it('should store data in both memory and persistent cache', async () => {
      const testKey = 'test-key';
      const testData = { test: 'data' };
      
      mockOPFSManager.storeFile.mockResolvedValue(true);
      
      const result = await cacheManager.set(testKey, testData);
      
      expect(result).toBe(true);
      expect(cacheManager.memoryCache.has(testKey)).toBe(true);
      expect(cacheManager.stats.sets).toBe(1);
      expect(mockOPFSManager.storeFile).toHaveBeenCalledWith(
        `cache/${testKey}`,
        expect.any(String),
        { compress: true }
      );
    });

    it('should handle custom TTL and tags', async () => {
      const testKey = 'test-key';
      const testData = 'test data';
      const customTTL = 7200000; // 2 hours
      const tags = ['tag1', 'tag2'];
      
      mockOPFSManager.storeFile.mockResolvedValue(true);
      
      await cacheManager.set(testKey, testData, { ttl: customTTL, tags });
      
      const entry = cacheManager.memoryCache.get(testKey);
      expect(entry.tags).toEqual(tags);
      expect(entry.expires).toBeGreaterThan(Date.now() + customTTL - 1000);
    });

    it('should handle storage failures gracefully', async () => {
      mockOPFSManager.storeFile.mockRejectedValue(new Error('Storage failed'));
      
      const result = await cacheManager.set('test-key', 'test data');
      
      expect(result).toBe(false);
    });
  });

  describe('delete', () => {
    beforeEach(async () => {
      await cacheManager.initialize();
    });

    it('should delete from both memory and persistent cache', async () => {
      const testKey = 'test-key';
      
      cacheManager.memoryCache.set(testKey, { data: 'test' });
      mockOPFSManager.deleteFile.mockResolvedValue(true);
      
      const result = await cacheManager.delete(testKey);
      
      expect(result).toBe(true);
      expect(cacheManager.memoryCache.has(testKey)).toBe(false);
      expect(cacheManager.stats.deletes).toBe(1);
      expect(mockOPFSManager.deleteFile).toHaveBeenCalledWith(`cache/${testKey}`);
    });

    it('should handle deletion failures gracefully', async () => {
      mockOPFSManager.deleteFile.mockRejectedValue(new Error('Delete failed'));
      
      const result = await cacheManager.delete('test-key');
      
      expect(result).toBe(false);
    });
  });

  describe('cleanup', () => {
    beforeEach(async () => {
      await cacheManager.initialize();
    });

    it('should remove expired entries from memory cache', async () => {
      const validEntry = {
        data: 'valid',
        expires: Date.now() + 3600000
      };
      const expiredEntry = {
        data: 'expired',
        expires: Date.now() - 1000
      };
      
      cacheManager.memoryCache.set('valid', validEntry);
      cacheManager.memoryCache.set('expired', expiredEntry);
      
      const cleaned = await cacheManager.cleanup();
      
      expect(cleaned).toBe(1);
      expect(cacheManager.memoryCache.has('valid')).toBe(true);
      expect(cacheManager.memoryCache.has('expired')).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', () => {
      cacheManager.stats = { hits: 10, misses: 5, sets: 8, deletes: 2 };
      cacheManager.memoryCache.set('test', { data: 'test' });
      
      const stats = cacheManager.getStats();
      
      expect(stats).toEqual({
        hits: 10,
        misses: 5,
        sets: 8,
        deletes: 2,
        hitRate: 67, // 10 / (10 + 5) * 100
        memoryCacheSize: 1
      });
    });
  });
});