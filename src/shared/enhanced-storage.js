// Enhanced Storage - OPFS Manager + Cache Manager + File System Worker
export class OPFSStorageManager {
  constructor() {
    this.isSupported = false;
    this.rootHandle = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return true;

    try {
      if ('storage' in navigator && 'getDirectory' in navigator.storage) {
        this.rootHandle = await navigator.storage.getDirectory();
        this.isSupported = true;
        this.initialized = true;
        console.log('✅ OPFS initialized successfully');
        return true;
      } else {
        console.warn('⚠️ OPFS not supported in this browser');
        return false;
      }
    } catch (error) {
      console.error('❌ Failed to initialize OPFS:', error);
      return false;
    }
  }

  async storeFile(path, data, options = {}) {
    if (!this.isSupported) throw new Error('OPFS not supported');
    
    try {
      const pathParts = path.split('/').filter(part => part.length > 0);
      const fileName = pathParts.pop();
      
      let dirHandle = this.rootHandle;
      for (const dirName of pathParts) {
        dirHandle = await dirHandle.getDirectoryHandle(dirName, { create: true });
      }
      
      const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      
      if (options.compress && data instanceof ArrayBuffer) {
        data = await this.compressData(data);
      }
      
      await writable.write(data);
      await writable.close();
      
      await this.updateMetadata(path, {
        size: data.byteLength || data.length,
        modified: Date.now(),
        compressed: options.compress || false,
        tags: options.tags || []
      });
      
      return true;
    } catch (error) {
      throw new Error(`Failed to store file ${path}: ${error.message}`);
    }
  }

  async getFile(path, options = {}) {
    if (!this.isSupported) throw new Error('OPFS not supported');
    
    try {
      const pathParts = path.split('/').filter(part => part.length > 0);
      const fileName = pathParts.pop();
      
      let dirHandle = this.rootHandle;
      for (const dirName of pathParts) {
        dirHandle = await dirHandle.getDirectoryHandle(dirName);
      }
      
      const fileHandle = await dirHandle.getFileHandle(fileName);
      const file = await fileHandle.getFile();
      let data = await file.arrayBuffer();
      
      const metadata = await this.getMetadata(path);
      if (metadata?.compressed) {
        data = await this.decompressData(data);
      }
      
      return {
        data,
        metadata: {
          size: file.size,
          lastModified: file.lastModified,
          ...metadata
        }
      };
    } catch (error) {
      if (error.name === 'NotFoundError') {
        return null;
      }
      throw new Error(`Failed to get file ${path}: ${error.message}`);
    }
  }

  async deleteFile(path) {
    if (!this.isSupported) return false;
    
    try {
      const pathParts = path.split('/').filter(part => part.length > 0);
      const fileName = pathParts.pop();
      
      let dirHandle = this.rootHandle;
      for (const dirName of pathParts) {
        dirHandle = await dirHandle.getDirectoryHandle(dirName);
      }
      
      await dirHandle.removeEntry(fileName);
      await this.deleteMetadata(path);
      return true;
    } catch (error) {
      console.warn(`Failed to delete file ${path}:`, error);
      return false;
    }
  }

  async compressData(data) {
    if (!('CompressionStream' in window)) return data;
    
    try {
      const stream = new CompressionStream('gzip');
      const writer = stream.writable.getWriter();
      const reader = stream.readable.getReader();
      
      const chunks = [];
      const readPromise = (async () => {
        let result;
        while (!(result = await reader.read()).done) {
          chunks.push(result.value);
        }
      })();
      
      await writer.write(data);
      await writer.close();
      await readPromise;
      
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
      const compressed = new Uint8Array(totalLength);
      let offset = 0;
      
      for (const chunk of chunks) {
        compressed.set(new Uint8Array(chunk), offset);
        offset += chunk.byteLength;
      }
      
      return compressed.buffer;
    } catch (error) {
      console.warn('Compression failed, storing uncompressed:', error);
      return data;
    }
  }

  async decompressData(data) {
    if (!('DecompressionStream' in window)) return data;
    
    try {
      const stream = new DecompressionStream('gzip');
      const writer = stream.writable.getWriter();
      const reader = stream.readable.getReader();
      
      const chunks = [];
      const readPromise = (async () => {
        let result;
        while (!(result = await reader.read()).done) {
          chunks.push(result.value);
        }
      })();
      
      await writer.write(data);
      await writer.close();
      await readPromise;
      
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
      const decompressed = new Uint8Array(totalLength);
      let offset = 0;
      
      for (const chunk of chunks) {
        decompressed.set(new Uint8Array(chunk), offset);
        offset += chunk.byteLength;
      }
      
      return decompressed.buffer;
    } catch (error) {
      console.warn('Decompression failed, returning as-is:', error);
      return data;
    }
  }

  async updateMetadata(path, metadata) {
    const metaPath = `_metadata/${path}.meta`;
    await this.storeFile(metaPath, JSON.stringify(metadata));
  }

  async getMetadata(path) {
    const metaPath = `_metadata/${path}.meta`;
    const result = await this.getFile(metaPath);
    return result ? JSON.parse(new TextDecoder().decode(result.data)) : null;
  }

  async deleteMetadata(path) {
    const metaPath = `_metadata/${path}.meta`;
    await this.deleteFile(metaPath);
  }
}

export class CacheManager {
  constructor() {
    this.memoryCache = new Map();
    this.opfsManager = new OPFSStorageManager();
    this.initialized = false;
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };
  }

  async initialize() {
    if (this.initialized) return;
    
    await this.opfsManager.initialize();
    this.initialized = true;
    
    // Cleanup expired items on initialization
    await this.cleanup();
  }

  async get(key, options = {}) {
    const { format = 'auto', useMemoryCache = true } = options;
    
    try {
      // Check memory cache first
      if (useMemoryCache && this.memoryCache.has(key)) {
        const entry = this.memoryCache.get(key);
        if (!this.isExpired(entry)) {
          this.stats.hits++;
          return this.deserializeData(entry.data, format);
        } else {
          this.memoryCache.delete(key);
        }
      }
      
      // Check persistent cache
      const result = await this.opfsManager.getFile(`cache/${key}`);
      if (result) {
        const entry = JSON.parse(new TextDecoder().decode(result.data));
        if (!this.isExpired(entry)) {
          // Update memory cache
          if (useMemoryCache) {
            this.memoryCache.set(key, entry);
          }
          this.stats.hits++;
          return this.deserializeData(entry.data, format);
        } else {
          await this.delete(key);
        }
      }
      
      this.stats.misses++;
      return null;
      
    } catch (error) {
      console.warn(`Cache get failed for key ${key}:`, error);
      this.stats.misses++;
      return null;
    }
  }

  async set(key, data, options = {}) {
    const { 
      ttl = 3600000, // 1 hour default
      tags = [],
      useMemoryCache = true,
      compress = true 
    } = options;
    
    try {
      const entry = {
        data: this.serializeData(data),
        expires: Date.now() + ttl,
        created: Date.now(),
        tags,
        size: this.calculateSize(data)
      };
      
      // Store in memory cache
      if (useMemoryCache) {
        this.memoryCache.set(key, entry);
      }
      
      // Store in persistent cache
      const entryData = JSON.stringify(entry);
      await this.opfsManager.storeFile(`cache/${key}`, entryData, { compress });
      
      this.stats.sets++;
      return true;
      
    } catch (error) {
      console.warn(`Cache set failed for key ${key}:`, error);
      return false;
    }
  }

  async delete(key) {
    try {
      this.memoryCache.delete(key);
      await this.opfsManager.deleteFile(`cache/${key}`);
      this.stats.deletes++;
      return true;
    } catch (error) {
      console.warn(`Cache delete failed for key ${key}:`, error);
      return false;
    }
  }

  async clear(options = {}) {
    const { tags = null } = options;
    let cleared = 0;
    
    try {
      if (tags) {
        // Clear by tags
        for (const [key, entry] of this.memoryCache.entries()) {
          if (entry.tags && entry.tags.some(tag => tags.includes(tag))) {
            await this.delete(key);
            cleared++;
          }
        }
      } else {
        // Clear all
        this.memoryCache.clear();
        // Note: Would need to implement directory clearing in OPFS
        cleared = this.memoryCache.size;
      }
      
      return cleared;
    } catch (error) {
      console.warn('Cache clear failed:', error);
      return 0;
    }
  }

  async cleanup() {
    let cleaned = 0;
    const now = Date.now();
    
    // Clean memory cache
    for (const [key, entry] of this.memoryCache.entries()) {
      if (this.isExpired(entry)) {
        this.memoryCache.delete(key);
        cleaned++;
      }
    }
    
    return cleaned;
  }

  isExpired(entry) {
    return Date.now() > entry.expires;
  }

  serializeData(data) {
    if (typeof data === 'string') return data;
    if (data instanceof ArrayBuffer) return Array.from(new Uint8Array(data));
    return JSON.stringify(data);
  }

  deserializeData(data, format) {
    if (format === 'json' && typeof data === 'string') {
      return JSON.parse(data);
    }
    if (format === 'buffer' && Array.isArray(data)) {
      return new Uint8Array(data).buffer;
    }
    return data;
  }

  calculateSize(data) {
    if (typeof data === 'string') return data.length;
    if (data instanceof ArrayBuffer) return data.byteLength;
    return JSON.stringify(data).length;
  }

  getStats() {
    const hitRate = this.stats.hits / (this.stats.hits + this.stats.misses) || 0;
    return {
      ...this.stats,
      hitRate: Math.round(hitRate * 100),
      memoryCacheSize: this.memoryCache.size
    };
  }

  async shutdown() {
    this.memoryCache.clear();
  }
}

// FileSystem Worker Implementation (embedded)
export const createFileSystemWorker = () => {
  const workerCode = `
    let opfsManager = null;
    
    class WorkerOPFSManager {
      constructor() {
        this.rootHandle = null;
        this.isSupported = false;
      }
      
      async initialize() {
        try {
          if ('storage' in navigator && 'getDirectory' in navigator.storage) {
            this.rootHandle = await navigator.storage.getDirectory();
            this.isSupported = true;
            return true;
          }
          return false;
        } catch (error) {
          console.error('OPFS init failed:', error);
          return false;
        }
      }
      
      async storeFile(path, data) {
        const pathParts = path.split('/').filter(p => p);
        const fileName = pathParts.pop();
        
        let dirHandle = this.rootHandle;
        for (const dirName of pathParts) {
          dirHandle = await dirHandle.getDirectoryHandle(dirName, { create: true });
        }
        
        const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(data);
        await writable.close();
        
        return true;
      }
      
      async downloadAndCache(url, path, onProgress) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
        
        const total = parseInt(response.headers.get('content-length')) || 0;
        const reader = response.body.getReader();
        const chunks = [];
        let loaded = 0;
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          chunks.push(value);
          loaded += value.length;
          
          if (onProgress && total > 0) {
            onProgress({ loaded, total, progress: (loaded / total) * 100 });
          }
        }
        
        const data = new Uint8Array(loaded);
        let offset = 0;
        for (const chunk of chunks) {
          data.set(chunk, offset);
          offset += chunk.length;
        }
        
        await this.storeFile(path, data);
        return { data: data.buffer, size: loaded };
      }
    }
    
    self.onmessage = async (event) => {
      const { id, type, data } = event.data;
      
      try {
        if (type === 'init') {
          opfsManager = new WorkerOPFSManager();
          const success = await opfsManager.initialize();
          self.postMessage({ id, success });
          
        } else if (type === 'download') {
          const { url, path } = data;
          const result = await opfsManager.downloadAndCache(url, path, (progress) => {
            self.postMessage({ id, type: 'progress', data: progress });
          });
          self.postMessage({ id, type: 'complete', data: result });
          
        } else if (type === 'store') {
          const { path, data } = data;
          await opfsManager.storeFile(path, data);
          self.postMessage({ id, success: true });
        }
        
      } catch (error) {
        self.postMessage({ id, error: error.message });
      }
    };
  `;
  
  const blob = new Blob([workerCode], { type: 'application/javascript' });
  return new Worker(URL.createObjectURL(blob));
};