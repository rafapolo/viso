// Enhanced Storage - OPFS Manager + Cache Manager + File System Worker

export interface StoreFileOptions {
  compress?: boolean;
  tags?: string[];
}

export interface FileMetadata {
  size: number;
  modified: number;
  compressed: boolean;
  tags: string[];
  lastModified?: number;
  [key: string]: unknown;
}

export interface FileResult {
  data: ArrayBuffer;
  metadata: FileMetadata;
}

export interface CacheGetOptions {
  format?: 'auto' | 'json' | 'buffer';
  useMemoryCache?: boolean;
}

export interface CacheSetOptions {
  ttl?: number;
  tags?: string[];
  useMemoryCache?: boolean;
  compress?: boolean;
}

export interface CacheClearOptions {
  tags?: string[] | null;
}

export interface CacheEntry {
  data: unknown;
  expires: number;
  created: number;
  tags: string[];
  size: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  hitRate: number;
  memoryCacheSize: number;
}

export class OPFSStorageManager {
  isSupported = false;
  rootHandle: FileSystemDirectoryHandle | null = null;
  initialized = false;

  async initialize(): Promise<boolean> {
    if (this.initialized) return true;
    try {
      if ('storage' in navigator && 'getDirectory' in navigator.storage) {
        this.rootHandle = await navigator.storage.getDirectory();
        this.isSupported = true;
        this.initialized = true;
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async storeFile(path: string, data: ArrayBuffer | string, options: StoreFileOptions = {}): Promise<boolean> {
    if (!this.isSupported || !this.rootHandle) throw new Error('OPFS not supported');
    try {
      const pathParts = path.split('/').filter((part) => part.length > 0);
      const fileName = pathParts.pop()!;

      let dirHandle: FileSystemDirectoryHandle = this.rootHandle;
      for (const dirName of pathParts) {
        dirHandle = await dirHandle.getDirectoryHandle(dirName, { create: true });
      }

      const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();

      let writeData: ArrayBuffer | string = data;
      if (options.compress && data instanceof ArrayBuffer) {
        writeData = await this.compressData(data);
      }

      await writable.write(writeData);
      await writable.close();

      const size =
        typeof writeData === 'string' ? writeData.length : (writeData as ArrayBuffer).byteLength;

      await this.updateMetadata(path, {
        size,
        modified: Date.now(),
        compressed: options.compress ?? false,
        tags: options.tags ?? [],
      });

      return true;
    } catch (error) {
      throw new Error(`Failed to store file ${path}: ${(error as Error).message}`);
    }
  }

  async getFile(path: string, _options: Record<string, unknown> = {}): Promise<FileResult | null> {
    if (!this.isSupported || !this.rootHandle) throw new Error('OPFS not supported');
    try {
      const pathParts = path.split('/').filter((part) => part.length > 0);
      const fileName = pathParts.pop()!;

      let dirHandle: FileSystemDirectoryHandle = this.rootHandle;
      for (const dirName of pathParts) {
        dirHandle = await dirHandle.getDirectoryHandle(dirName);
      }

      const fileHandle = await dirHandle.getFileHandle(fileName);
      const file = await fileHandle.getFile();
      let data: ArrayBuffer = await file.arrayBuffer();

      const metadata = await this.getMetadata(path);
      if (metadata?.compressed) {
        data = await this.decompressData(data);
      }

      return {
        data,
        metadata: {
          size: file.size,
          lastModified: file.lastModified,
          ...(metadata ?? {}),
        } as FileMetadata,
      };
    } catch (error) {
      if ((error as Error & { name?: string }).name === 'NotFoundError') return null;
      throw new Error(`Failed to get file ${path}: ${(error as Error).message}`);
    }
  }

  async deleteFile(path: string): Promise<boolean> {
    if (!this.isSupported || !this.rootHandle) return false;
    try {
      const pathParts = path.split('/').filter((part) => part.length > 0);
      const fileName = pathParts.pop()!;

      let dirHandle: FileSystemDirectoryHandle = this.rootHandle;
      for (const dirName of pathParts) {
        dirHandle = await dirHandle.getDirectoryHandle(dirName);
      }

      await dirHandle.removeEntry(fileName);
      await this.deleteMetadata(path);
      return true;
    } catch {
      return false;
    }
  }

  async compressData(data: ArrayBuffer): Promise<ArrayBuffer> {
    if (!('CompressionStream' in window)) return data;
    try {
      const stream = new CompressionStream('gzip');
      const writer = stream.writable.getWriter();
      const reader = stream.readable.getReader();

      const chunks: Uint8Array[] = [];
      const readPromise = (async () => {
        let result: ReadableStreamReadResult<Uint8Array>;
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
    } catch {
      return data;
    }
  }

  async decompressData(data: ArrayBuffer): Promise<ArrayBuffer> {
    if (!('DecompressionStream' in window)) return data;
    try {
      const stream = new DecompressionStream('gzip');
      const writer = stream.writable.getWriter();
      const reader = stream.readable.getReader();

      const chunks: Uint8Array[] = [];
      const readPromise = (async () => {
        let result: ReadableStreamReadResult<Uint8Array>;
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
    } catch {
      return data;
    }
  }

  async updateMetadata(path: string, metadata: FileMetadata): Promise<void> {
    const metaPath = `_metadata/${path}.meta`;
    await this.storeFile(metaPath, JSON.stringify(metadata));
  }

  async getMetadata(path: string): Promise<FileMetadata | null> {
    const metaPath = `_metadata/${path}.meta`;
    const result = await this.getFile(metaPath);
    return result ? (JSON.parse(new TextDecoder().decode(result.data)) as FileMetadata) : null;
  }

  async deleteMetadata(path: string): Promise<void> {
    const metaPath = `_metadata/${path}.meta`;
    await this.deleteFile(metaPath);
  }
}

export class CacheManager {
  private memoryCache: Map<string, CacheEntry> = new Map();
  private opfsManager: OPFSStorageManager = new OPFSStorageManager();
  initialized = false;
  private stats = { hits: 0, misses: 0, sets: 0, deletes: 0 };

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.opfsManager.initialize();
    this.initialized = true;
    await this.cleanup();
  }

  async get(key: string, options: CacheGetOptions = {}): Promise<unknown> {
    const { format = 'auto', useMemoryCache = true } = options;
    try {
      if (useMemoryCache && this.memoryCache.has(key)) {
        const entry = this.memoryCache.get(key)!;
        if (!this.isExpired(entry)) {
          this.stats.hits++;
          return this.deserializeData(entry.data, format);
        } else {
          this.memoryCache.delete(key);
        }
      }

      const result = await this.opfsManager.getFile(`cache/${key}`);
      if (result) {
        const entry = JSON.parse(new TextDecoder().decode(result.data)) as CacheEntry;
        if (!this.isExpired(entry)) {
          if (useMemoryCache) this.memoryCache.set(key, entry);
          this.stats.hits++;
          return this.deserializeData(entry.data, format);
        } else {
          await this.delete(key);
        }
      }

      this.stats.misses++;
      return null;
    } catch {
      this.stats.misses++;
      return null;
    }
  }

  async set(key: string, data: unknown, options: CacheSetOptions = {}): Promise<boolean> {
    const { ttl = 3600000, tags = [], useMemoryCache = true, compress = true } = options;
    try {
      const entry: CacheEntry = {
        data: this.serializeData(data),
        expires: Date.now() + ttl,
        created: Date.now(),
        tags,
        size: this.calculateSize(data),
      };

      if (useMemoryCache) this.memoryCache.set(key, entry);

      const entryData = JSON.stringify(entry);
      await this.opfsManager.storeFile(`cache/${key}`, entryData, { compress });
      this.stats.sets++;
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      this.memoryCache.delete(key);
      await this.opfsManager.deleteFile(`cache/${key}`);
      this.stats.deletes++;
      return true;
    } catch {
      return false;
    }
  }

  async clear(options: CacheClearOptions = {}): Promise<number> {
    const { tags = null } = options;
    let cleared = 0;
    try {
      if (tags) {
        for (const [key, entry] of this.memoryCache.entries()) {
          if (entry.tags && entry.tags.some((tag) => tags.includes(tag))) {
            await this.delete(key);
            cleared++;
          }
        }
      } else {
        cleared = this.memoryCache.size;
        this.memoryCache.clear();
      }
      return cleared;
    } catch {
      return 0;
    }
  }

  async cleanup(): Promise<number> {
    let cleaned = 0;
    for (const [key, entry] of this.memoryCache.entries()) {
      if (this.isExpired(entry)) {
        this.memoryCache.delete(key);
        cleaned++;
      }
    }
    return cleaned;
  }

  isExpired(entry: CacheEntry): boolean {
    return Date.now() > entry.expires;
  }

  serializeData(data: unknown): unknown {
    if (typeof data === 'string') return data;
    if (data instanceof ArrayBuffer) return Array.from(new Uint8Array(data));
    return JSON.stringify(data);
  }

  deserializeData(data: unknown, format: string): unknown {
    if (format === 'json' && typeof data === 'string') return JSON.parse(data);
    if (format === 'buffer' && Array.isArray(data))
      return new Uint8Array(data as number[]).buffer;
    return data;
  }

  calculateSize(data: unknown): number {
    if (typeof data === 'string') return data.length;
    if (data instanceof ArrayBuffer) return data.byteLength;
    return JSON.stringify(data).length;
  }

  getStats(): CacheStats {
    const hitRate = this.stats.hits / (this.stats.hits + this.stats.misses) || 0;
    return {
      ...this.stats,
      hitRate: Math.round(hitRate * 100),
      memoryCacheSize: this.memoryCache.size,
    };
  }

  async shutdown(): Promise<void> {
    this.memoryCache.clear();
  }
}

// FileSystem Worker (embedded blob)
export const createFileSystemWorker = (): Worker => {
  const workerCode = `
    let opfsManager = null;

    class WorkerOPFSManager {
      constructor() { this.rootHandle = null; this.isSupported = false; }

      async initialize() {
        try {
          if ('storage' in navigator && 'getDirectory' in navigator.storage) {
            this.rootHandle = await navigator.storage.getDirectory();
            this.isSupported = true;
            return true;
          }
          return false;
        } catch { return false; }
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
          if (onProgress && total > 0) onProgress({ loaded, total, progress: (loaded / total) * 100 });
        }
        const data = new Uint8Array(loaded);
        let offset = 0;
        for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; }
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
          const result = await opfsManager.downloadAndCache(data.url, data.path, (progress) => {
            self.postMessage({ id, type: 'progress', data: progress });
          });
          self.postMessage({ id, type: 'complete', data: result });
        } else if (type === 'store') {
          await opfsManager.storeFile(data.path, data.data);
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
