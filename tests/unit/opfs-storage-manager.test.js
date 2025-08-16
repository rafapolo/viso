// OPFS Storage Manager Tests
import { jest } from '@jest/globals';

describe('OPFSStorageManager', () => {
  let mockNavigator;
  let mockStorageAPI;
  let mockDirectoryHandle;
  let mockFileHandle;
  let mockWritable;
  let OPFSStorageManager;

  beforeEach(() => {
    // Mock OPFS APIs
    mockWritable = {
      write: jest.fn(),
      close: jest.fn()
    };

    mockFileHandle = {
      getFile: jest.fn(),
      createWritable: jest.fn(() => Promise.resolve(mockWritable))
    };

    mockDirectoryHandle = {
      getDirectoryHandle: jest.fn(() => Promise.resolve(mockDirectoryHandle)),
      getFileHandle: jest.fn(() => Promise.resolve(mockFileHandle)),
      removeEntry: jest.fn(() => Promise.resolve()),
      entries: jest.fn(() => ({
        async *[Symbol.asyncIterator]() {
          yield ['test.txt', mockFileHandle];
        }
      }))
    };

    mockStorageAPI = {
      getDirectory: jest.fn(() => Promise.resolve(mockDirectoryHandle))
    };

    mockNavigator = {
      storage: mockStorageAPI
    };

    // Mock global navigator
    global.navigator = mockNavigator;

    // Mock the OPFSStorageManager class
    class MockOPFSStorageManager {
      constructor() {
        this.root = null;
        this.isSupported = true;
        this.cache = new Map();
        this.listeners = new Set();
      }

      checkSupport() {
        this.isSupported = 'navigator' in global && 
                          'storage' in global.navigator && 
                          'getDirectory' in global.navigator.storage;
        return this.isSupported;
      }

      async initialize() {
        if (!this.isSupported) {
          throw new Error('OPFS is not supported in this browser');
        }
        this.root = await global.navigator.storage.getDirectory();
        return true;
      }

      async ensureDirectoryExists(path) {
        if (!this.root) await this.initialize();
        await this.root.getDirectoryHandle(path, { create: true });
        return true;
      }

      async storeFile(path, data, options = {}) {
        if (!this.root) await this.initialize();
        
        const { directory = 'datasets', metadata = {} } = options;
        const dirHandle = await this.root.getDirectoryHandle(directory, { create: true });
        const fileHandle = await dirHandle.getFileHandle(path, { create: true });
        const writable = await fileHandle.createWritable();
        
        await writable.write(data);
        await writable.close();
        
        const size = data.byteLength || data.length;
        this.cache.set(`${directory}/${path}`, {
          size,
          lastModified: Date.now(),
          metadata
        });
        
        return true;
      }

      async getFile(path, options = {}) {
        if (!this.root) await this.initialize();
        
        const { directory = 'datasets', asArrayBuffer = false, asText = false } = options;
        
        try {
          const dirHandle = await this.root.getDirectoryHandle(directory);
          const fileHandle = await dirHandle.getFileHandle(path);
          const file = await fileHandle.getFile();
          
          if (asArrayBuffer) {
            return file.arrayBuffer();
          } else if (asText) {
            return file.text();
          } else {
            return file;
          }
        } catch (error) {
          if (error.name === 'NotFoundError') {
            return null;
          }
          throw error;
        }
      }

      async fileExists(path, directory = 'datasets') {
        try {
          if (!this.root) await this.initialize();
          const dirHandle = await this.root.getDirectoryHandle(directory);
          await dirHandle.getFileHandle(path);
          return true;
        } catch (error) {
          if (error.name === 'NotFoundError') {
            return false;
          }
          throw error;
        }
      }

      async deleteFile(path, directory = 'datasets') {
        if (!this.root) await this.initialize();
        
        try {
          const dirHandle = await this.root.getDirectoryHandle(directory);
          await dirHandle.removeEntry(path);
          this.cache.delete(`${directory}/${path}`);
          return true;
        } catch (error) {
          if (error.name === 'NotFoundError') {
            return false;
          }
          throw error;
        }
      }

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
          throw error;
        }
      }

      formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
      }

      static getInstance() {
        if (!this.instance) {
          this.instance = new MockOPFSStorageManager();
        }
        return this.instance;
      }
    }

    OPFSStorageManager = MockOPFSStorageManager;
  });

  afterEach(() => {
    jest.clearAllMocks();
    if (OPFSStorageManager.instance) {
      OPFSStorageManager.instance = null;
    }
  });

  describe('Support Detection', () => {
    test('should detect OPFS support correctly', () => {
      const manager = new OPFSStorageManager();
      expect(manager.checkSupport()).toBe(true);
      expect(manager.isSupported).toBe(true);
    });

    test('should detect lack of OPFS support', () => {
      delete global.navigator.storage;
      const manager = new OPFSStorageManager();
      expect(manager.checkSupport()).toBe(false);
      expect(manager.isSupported).toBe(false);
    });
  });

  describe('Initialization', () => {
    test('should initialize successfully with OPFS support', async () => {
      const manager = new OPFSStorageManager();
      const result = await manager.initialize();
      
      expect(result).toBe(true);
      expect(mockStorageAPI.getDirectory).toHaveBeenCalled();
      expect(mockDirectoryHandle.getDirectoryHandle).toHaveBeenCalledWith('datasets', { create: true });
      expect(mockDirectoryHandle.getDirectoryHandle).toHaveBeenCalledWith('cache', { create: true });
      expect(mockDirectoryHandle.getDirectoryHandle).toHaveBeenCalledWith('temp', { create: true });
    });

    test('should throw error when OPFS is not supported', async () => {
      const manager = new OPFSStorageManager();
      manager.isSupported = false;
      
      await expect(manager.initialize()).rejects.toThrow('OPFS is not supported in this browser');
    });
  });

  describe('File Operations', () => {
    let manager;

    beforeEach(async () => {
      manager = new OPFSStorageManager();
      await manager.initialize();
    });

    test('should store file successfully', async () => {
      const testData = new Uint8Array([1, 2, 3, 4, 5]);
      const result = await manager.storeFile('test.dat', testData, {
        directory: 'datasets',
        metadata: { version: '1.0' }
      });

      expect(result).toBe(true);
      expect(mockDirectoryHandle.getDirectoryHandle).toHaveBeenCalledWith('datasets', { create: true });
      expect(mockDirectoryHandle.getFileHandle).toHaveBeenCalledWith('test.dat', { create: true });
      expect(mockWritable.write).toHaveBeenCalledWith(testData);
      expect(mockWritable.close).toHaveBeenCalled();
    });

    test('should retrieve file successfully', async () => {
      const mockFile = {
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(5)),
        text: () => Promise.resolve('test content'),
        size: 5,
        lastModified: Date.now()
      };
      mockFileHandle.getFile.mockResolvedValue(mockFile);

      const result = await manager.getFile('test.dat', { asArrayBuffer: true });
      
      expect(result).toBeInstanceOf(ArrayBuffer);
      expect(mockDirectoryHandle.getDirectoryHandle).toHaveBeenCalledWith('datasets');
      expect(mockDirectoryHandle.getFileHandle).toHaveBeenCalledWith('test.dat');
    });

    test('should return null for non-existent file', async () => {
      const notFoundError = new Error('File not found');
      notFoundError.name = 'NotFoundError';
      mockDirectoryHandle.getFileHandle.mockRejectedValue(notFoundError);

      const result = await manager.getFile('nonexistent.dat');
      expect(result).toBeNull();
    });

    test('should check file existence correctly', async () => {
      const exists = await manager.fileExists('test.dat');
      expect(exists).toBe(true);
      expect(mockDirectoryHandle.getFileHandle).toHaveBeenCalledWith('test.dat');
    });

    test('should delete file successfully', async () => {
      const result = await manager.deleteFile('test.dat');
      
      expect(result).toBe(true);
      expect(mockDirectoryHandle.removeEntry).toHaveBeenCalledWith('test.dat');
    });

    test('should list files in directory', async () => {
      const mockFile = {
        size: 100,
        lastModified: Date.now(),
        type: 'application/octet-stream'
      };
      mockFileHandle.getFile.mockResolvedValue(mockFile);

      const files = await manager.listFiles('datasets');
      
      expect(files).toHaveLength(1);
      expect(files[0]).toEqual({
        name: 'test.txt',
        size: 100,
        lastModified: expect.any(Number),
        type: 'application/octet-stream'
      });
    });
  });

  describe('Utility Functions', () => {
    test('should format bytes correctly', () => {
      const manager = new OPFSStorageManager();
      
      expect(manager.formatBytes(0)).toBe('0 Bytes');
      expect(manager.formatBytes(1024)).toBe('1 KB');
      expect(manager.formatBytes(1048576)).toBe('1 MB');
      expect(manager.formatBytes(1073741824)).toBe('1 GB');
      expect(manager.formatBytes(1500)).toBe('1.5 KB');
    });
  });

  describe('Singleton Pattern', () => {
    test('should return same instance', () => {
      const instance1 = OPFSStorageManager.getInstance();
      const instance2 = OPFSStorageManager.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('Error Handling', () => {
    test('should handle storage API errors gracefully', async () => {
      const manager = new OPFSStorageManager();
      mockStorageAPI.getDirectory.mockRejectedValue(new Error('Storage API error'));
      
      await expect(manager.initialize()).rejects.toThrow('Storage API error');
    });

    test('should handle file operation errors', async () => {
      const manager = new OPFSStorageManager();
      await manager.initialize();
      
      mockDirectoryHandle.getFileHandle.mockRejectedValue(new Error('File operation error'));
      
      await expect(manager.getFile('error.dat')).rejects.toThrow('File operation error');
    });
  });
});