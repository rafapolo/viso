// File System Worker for OPFS Operations
// This worker handles all file system operations to keep the main thread responsive

let opfsRoot = null;
let isInitialized = false;

// Initialize OPFS in worker context
async function initializeOPFS() {
  if (isInitialized) return true;
  
  try {
    if (!('navigator' in self && 'storage' in navigator && 'getDirectory' in navigator.storage)) {
      throw new Error('OPFS not supported in worker context');
    }
    
    opfsRoot = await navigator.storage.getDirectory();
    
    // Create necessary directories
    await ensureDirectoryExists('datasets');
    await ensureDirectoryExists('cache');
    await ensureDirectoryExists('temp');
    
    isInitialized = true;
    return true;
  } catch (error) {
    console.error('Worker OPFS initialization failed:', error);
    throw error;
  }
}

// Ensure directory exists
async function ensureDirectoryExists(path) {
  try {
    await opfsRoot.getDirectoryHandle(path, { create: true });
    return true;
  } catch (error) {
    console.error(`Failed to create directory ${path}:`, error);
    throw error;
  }
}

// Store file with progress reporting
async function storeFile(path, data, options = {}) {
  await initializeOPFS();
  
  const {
    directory = 'datasets',
    overwrite = true,
    metadata = {},
    reportProgress = false
  } = options;

  try {
    const dirHandle = await opfsRoot.getDirectoryHandle(directory, { create: true });
    const fileHandle = await dirHandle.getFileHandle(path, { create: true });
    
    const writable = await fileHandle.createWritable();
    
    // Convert data to appropriate format
    let writeData = data;
    if (data instanceof ArrayBuffer) {
      writeData = new Uint8Array(data);
    } else if (typeof data === 'string') {
      writeData = new TextEncoder().encode(data);
    }
    
    // Write in chunks if large file and progress reporting is enabled
    if (reportProgress && writeData.byteLength > 1024 * 1024) { // 1MB chunks
      const chunkSize = 1024 * 1024;
      const totalSize = writeData.byteLength;
      let written = 0;
      
      for (let offset = 0; offset < totalSize; offset += chunkSize) {
        const chunk = writeData.slice(offset, Math.min(offset + chunkSize, totalSize));
        await writable.write(chunk);
        written += chunk.byteLength;
        
        // Report progress
        self.postMessage({
          type: 'progress',
          operation: 'store',
          path,
          progress: (written / totalSize) * 100,
          written,
          total: totalSize
        });
      }
    } else {
      await writable.write(writeData);
    }
    
    await writable.close();

    // Store metadata if provided
    if (Object.keys(metadata).length > 0) {
      await storeMetadata(path, metadata, directory);
    }

    return {
      success: true,
      size: writeData.byteLength || writeData.length,
      path,
      directory
    };
  } catch (error) {
    console.error(`Failed to store file ${path}:`, error);
    throw error;
  }
}

// Get file
async function getFile(path, options = {}) {
  await initializeOPFS();
  
  const {
    directory = 'datasets',
    asArrayBuffer = false,
    asText = false
  } = options;

  try {
    const dirHandle = await opfsRoot.getDirectoryHandle(directory);
    const fileHandle = await dirHandle.getFileHandle(path);
    const file = await fileHandle.getFile();

    if (asArrayBuffer) {
      return await file.arrayBuffer();
    } else if (asText) {
      return await file.text();
    } else {
      return {
        name: file.name,
        size: file.size,
        lastModified: file.lastModified,
        type: file.type,
        data: await file.arrayBuffer()
      };
    }
  } catch (error) {
    if (error.name === 'NotFoundError') {
      return null;
    }
    throw error;
  }
}

// Check if file exists
async function fileExists(path, directory = 'datasets') {
  try {
    await initializeOPFS();
    const dirHandle = await opfsRoot.getDirectoryHandle(directory);
    await dirHandle.getFileHandle(path);
    return true;
  } catch (error) {
    if (error.name === 'NotFoundError') {
      return false;
    }
    throw error;
  }
}

// Delete file
async function deleteFile(path, directory = 'datasets') {
  await initializeOPFS();

  try {
    const dirHandle = await opfsRoot.getDirectoryHandle(directory);
    await dirHandle.removeEntry(path);
    
    // Also delete metadata
    await deleteMetadata(path, directory);
    
    return true;
  } catch (error) {
    if (error.name === 'NotFoundError') {
      return false;
    }
    throw error;
  }
}

// List files in directory
async function listFiles(directory = 'datasets') {
  await initializeOPFS();

  try {
    const dirHandle = await opfsRoot.getDirectoryHandle(directory);
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

// Store metadata
async function storeMetadata(path, metadata, directory = 'datasets') {
  const metadataPath = `${path}.meta`;
  const metadataContent = JSON.stringify({
    ...metadata,
    createdAt: Date.now(),
    path,
    directory,
    version: metadata.version || '1.0'
  });
  
  await storeFile(metadataPath, metadataContent, { 
    directory: 'cache',
    overwrite: true 
  });
}

// Get metadata
async function getMetadata(path, directory = 'datasets') {
  try {
    const metadataPath = `${path}.meta`;
    const metadataContent = await getFile(metadataPath, { 
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

// Delete metadata
async function deleteMetadata(path, directory = 'datasets') {
  try {
    const metadataPath = `${path}.meta`;
    await deleteFile(metadataPath, 'cache');
  } catch (error) {
    // Ignore metadata deletion errors
  }
}

// Get storage usage
async function getStorageUsage() {
  await initializeOPFS();

  try {
    const usage = { datasets: 0, cache: 0, temp: 0, total: 0 };
    
    for (const directory of ['datasets', 'cache', 'temp']) {
      const files = await listFiles(directory);
      usage[directory] = files.reduce((total, file) => total + file.size, 0);
    }
    
    usage.total = usage.datasets + usage.cache + usage.temp;
    
    return usage;
  } catch (error) {
    console.error('Failed to get storage usage:', error);
    return { datasets: 0, cache: 0, temp: 0, total: 0 };
  }
}

// Cleanup old files
async function cleanup(directory, maxAge = 24 * 60 * 60 * 1000) { // 24 hours default
  try {
    const files = await listFiles(directory);
    const now = Date.now();
    let deletedCount = 0;
    
    for (const file of files) {
      if (now - file.lastModified > maxAge) {
        await deleteFile(file.name, directory);
        deletedCount++;
      }
    }
    
    return deletedCount;
  } catch (error) {
    console.error(`Cleanup failed for ${directory}:`, error);
    return 0;
  }
}

// Download and cache remote file
async function downloadAndCache(url, filename, options = {}) {
  const {
    directory = 'datasets',
    checkETag = true,
    metadata = {}
  } = options;

  try {
    // Check if file exists and is current
    if (checkETag) {
      const existingMetadata = await getMetadata(filename, directory);
      if (existingMetadata && existingMetadata.etag) {
        // Make HEAD request to check ETag
        const headResponse = await fetch(url, { method: 'HEAD' });
        const currentETag = headResponse.headers.get('etag');
        
        if (currentETag && currentETag === existingMetadata.etag) {
          // File is up to date
          return {
            fromCache: true,
            path: filename,
            directory,
            size: existingMetadata.size
          };
        }
      }
    }

    // Download file
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentLength = parseInt(response.headers.get('content-length') || '0');
    const etag = response.headers.get('etag');
    
    // Read with progress reporting
    const reader = response.body.getReader();
    const chunks = [];
    let receivedLength = 0;

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      chunks.push(value);
      receivedLength += value.length;
      
      // Report download progress
      if (contentLength > 0) {
        self.postMessage({
          type: 'progress',
          operation: 'download',
          url,
          progress: (receivedLength / contentLength) * 100,
          received: receivedLength,
          total: contentLength
        });
      }
    }

    // Combine chunks
    const arrayBuffer = new Uint8Array(receivedLength);
    let position = 0;
    for (const chunk of chunks) {
      arrayBuffer.set(chunk, position);
      position += chunk.length;
    }

    // Store file with metadata
    const fileMetadata = {
      ...metadata,
      url,
      etag,
      downloadedAt: Date.now(),
      size: receivedLength
    };

    await storeFile(filename, arrayBuffer, {
      directory,
      metadata: fileMetadata,
      reportProgress: true
    });

    return {
      fromCache: false,
      path: filename,
      directory,
      size: receivedLength,
      etag
    };
  } catch (error) {
    console.error(`Download failed for ${url}:`, error);
    throw error;
  }
}

// Message handler
self.onmessage = async function(e) {
  const { id, type, ...params } = e.data;
  
  try {
    let result;
    
    switch (type) {
      case 'initialize':
        result = await initializeOPFS();
        break;
        
      case 'store':
        result = await storeFile(params.path, params.data, params.options);
        break;
        
      case 'get':
        result = await getFile(params.path, params.options);
        break;
        
      case 'exists':
        result = await fileExists(params.path, params.directory);
        break;
        
      case 'delete':
        result = await deleteFile(params.path, params.directory);
        break;
        
      case 'list':
        result = await listFiles(params.directory);
        break;
        
      case 'metadata':
        result = await getMetadata(params.path, params.directory);
        break;
        
      case 'usage':
        result = await getStorageUsage();
        break;
        
      case 'cleanup':
        result = await cleanup(params.directory, params.maxAge);
        break;
        
      case 'download':
        result = await downloadAndCache(params.url, params.filename, params.options);
        break;
        
      default:
        throw new Error(`Unknown operation: ${type}`);
    }
    
    self.postMessage({
      id,
      type: 'success',
      result
    });
    
  } catch (error) {
    self.postMessage({
      id,
      type: 'error',
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    });
  }
};