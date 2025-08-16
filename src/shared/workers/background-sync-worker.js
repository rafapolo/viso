// Background Sync Worker
// Handles data synchronization, updates, and background tasks

let syncQueue = [];
let isOnline = true;
let syncInterval = null;
let retryTimers = new Map();

// Configuration
const CONFIG = {
  syncIntervalMs: 30 * 60 * 1000, // 30 minutes
  maxRetries: 3,
  retryDelays: [1000, 5000, 15000], // Progressive retry delays
  batchSize: 5,
  timeouts: {
    fetch: 30000, // 30 seconds
    upload: 60000  // 60 seconds
  }
};

// Sync task types
const TASK_TYPES = {
  DOWNLOAD_DATA: 'download_data',
  CHECK_UPDATES: 'check_updates',
  CACHE_CLEANUP: 'cache_cleanup',
  UPLOAD_ANALYTICS: 'upload_analytics',
  VALIDATE_CACHE: 'validate_cache'
};

/**
 * Network status monitoring
 */
function updateOnlineStatus() {
  const wasOnline = isOnline;
  isOnline = navigator.onLine;
  
  if (!wasOnline && isOnline) {
    // Just came back online, process pending tasks
    self.postMessage({
      type: 'status',
      status: 'online',
      message: 'Connection restored, processing pending tasks'
    });
    processPendingTasks();
  } else if (wasOnline && !isOnline) {
    self.postMessage({
      type: 'status',
      status: 'offline',
      message: 'Connection lost, tasks will be queued'
    });
  }
}

// Listen to online/offline events
self.addEventListener('online', updateOnlineStatus);
self.addEventListener('offline', updateOnlineStatus);

/**
 * Add task to sync queue
 */
function addTask(task) {
  const taskId = generateTaskId();
  const queuedTask = {
    id: taskId,
    ...task,
    createdAt: Date.now(),
    attempts: 0,
    lastAttempt: null,
    status: 'pending'
  };
  
  syncQueue.push(queuedTask);
  
  self.postMessage({
    type: 'task_queued',
    task: queuedTask
  });
  
  // Process immediately if online
  if (isOnline) {
    processNextTask();
  }
  
  return taskId;
}

/**
 * Generate unique task ID
 */
function generateTaskId() {
  return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Process next task in queue
 */
async function processNextTask() {
  if (syncQueue.length === 0 || !isOnline) {
    return;
  }
  
  const task = syncQueue.find(t => t.status === 'pending');
  if (!task) {
    return;
  }
  
  task.status = 'processing';
  task.lastAttempt = Date.now();
  task.attempts++;
  
  try {
    self.postMessage({
      type: 'task_started',
      task: { ...task }
    });
    
    const result = await executeTask(task);
    
    // Task completed successfully
    task.status = 'completed';
    task.completedAt = Date.now();
    task.result = result;
    
    self.postMessage({
      type: 'task_completed',
      task: { ...task }
    });
    
    // Remove from queue
    syncQueue = syncQueue.filter(t => t.id !== task.id);
    
  } catch (error) {
    console.error(`Task ${task.id} failed:`, error);
    
    if (task.attempts >= CONFIG.maxRetries) {
      // Max retries reached
      task.status = 'failed';
      task.error = {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
      
      self.postMessage({
        type: 'task_failed',
        task: { ...task }
      });
      
      // Remove from queue
      syncQueue = syncQueue.filter(t => t.id !== task.id);
    } else {
      // Schedule retry
      task.status = 'pending';
      const retryDelay = CONFIG.retryDelays[Math.min(task.attempts - 1, CONFIG.retryDelays.length - 1)];
      
      self.postMessage({
        type: 'task_retry',
        task: { ...task },
        retryDelay
      });
      
      // Schedule retry
      const retryTimer = setTimeout(() => {
        retryTimers.delete(task.id);
        processNextTask();
      }, retryDelay);
      
      retryTimers.set(task.id, retryTimer);
    }
  }
  
  // Process next task
  setTimeout(processNextTask, 100);
}

/**
 * Process all pending tasks (when coming back online)
 */
async function processPendingTasks() {
  const pendingTasks = syncQueue.filter(t => t.status === 'pending');
  
  for (let i = 0; i < pendingTasks.length && i < CONFIG.batchSize; i++) {
    await new Promise(resolve => setTimeout(resolve, 100)); // Small delay between tasks
    processNextTask();
  }
}

/**
 * Execute specific task
 */
async function executeTask(task) {
  switch (task.type) {
    case TASK_TYPES.DOWNLOAD_DATA:
      return await downloadData(task);
      
    case TASK_TYPES.CHECK_UPDATES:
      return await checkForUpdates(task);
      
    case TASK_TYPES.CACHE_CLEANUP:
      return await performCacheCleanup(task);
      
    case TASK_TYPES.UPLOAD_ANALYTICS:
      return await uploadAnalytics(task);
      
    case TASK_TYPES.VALIDATE_CACHE:
      return await validateCache(task);
      
    default:
      throw new Error(`Unknown task type: ${task.type}`);
  }
}

/**
 * Download data with progress reporting
 */
async function downloadData(task) {
  const { url, filename, expectedSize } = task.data;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeouts.fetch);
  
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Cache-Control': 'no-cache'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const contentLength = parseInt(response.headers.get('content-length') || expectedSize || '0');
    const etag = response.headers.get('etag');
    const lastModified = response.headers.get('last-modified');
    
    // Read response with progress
    const reader = response.body.getReader();
    const chunks = [];
    let receivedLength = 0;
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      chunks.push(value);
      receivedLength += value.length;
      
      // Report progress
      if (contentLength > 0) {
        self.postMessage({
          type: 'download_progress',
          taskId: task.id,
          progress: (receivedLength / contentLength) * 100,
          received: receivedLength,
          total: contentLength
        });
      }
    }
    
    // Combine chunks
    const data = new Uint8Array(receivedLength);
    let position = 0;
    for (const chunk of chunks) {
      data.set(chunk, position);
      position += chunk.length;
    }
    
    return {
      data,
      size: receivedLength,
      etag,
      lastModified,
      downloadedAt: Date.now()
    };
    
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Check for data updates
 */
async function checkForUpdates(task) {
  const { url, currentETag, currentLastModified } = task.data;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout for HEAD request
  
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'Cache-Control': 'no-cache'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const etag = response.headers.get('etag');
    const lastModified = response.headers.get('last-modified');
    const contentLength = response.headers.get('content-length');
    
    const hasUpdate = (etag && etag !== currentETag) || 
                     (lastModified && lastModified !== currentLastModified);
    
    return {
      hasUpdate,
      etag,
      lastModified,
      contentLength: contentLength ? parseInt(contentLength) : null,
      checkedAt: Date.now()
    };
    
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Perform cache cleanup
 */
async function performCacheCleanup(task) {
  const { maxAge = 24 * 60 * 60 * 1000 } = task.data; // 24 hours default
  
  // This would typically interface with the cache manager
  // For now, return a mock result
  const now = Date.now();
  const cutoffTime = now - maxAge;
  
  return {
    cleanedEntries: Math.floor(Math.random() * 10), // Mock
    freedSpace: Math.floor(Math.random() * 1024 * 1024), // Mock
    cleanupTime: now
  };
}

/**
 * Upload analytics data
 */
async function uploadAnalytics(task) {
  const { endpoint, data } = task.data;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeouts.upload);
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return {
      uploaded: true,
      responseStatus: response.status,
      uploadedAt: Date.now()
    };
    
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Validate cache integrity
 */
async function validateCache(task) {
  const { entries } = task.data;
  
  const results = {
    total: entries.length,
    valid: 0,
    invalid: 0,
    missing: 0,
    corrupted: 0
  };
  
  // Mock validation for now
  for (const entry of entries) {
    // Simulate validation logic
    const random = Math.random();
    if (random > 0.95) {
      results.corrupted++;
    } else if (random > 0.9) {
      results.missing++;
    } else if (random > 0.85) {
      results.invalid++;
    } else {
      results.valid++;
    }
  }
  
  return {
    ...results,
    validatedAt: Date.now()
  };
}

/**
 * Start periodic sync
 */
function startPeriodicSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
  }
  
  syncInterval = setInterval(() => {
    if (isOnline) {
      // Add periodic tasks
      addTask({
        type: TASK_TYPES.CHECK_UPDATES,
        data: {
          url: 'https://example.com/data-check',
          currentETag: null,
          currentLastModified: null
        },
        priority: 'low'
      });
    }
  }, CONFIG.syncIntervalMs);
}

/**
 * Stop periodic sync
 */
function stopPeriodicSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

/**
 * Get sync status
 */
function getSyncStatus() {
  return {
    isOnline,
    queueLength: syncQueue.length,
    pendingTasks: syncQueue.filter(t => t.status === 'pending').length,
    processingTasks: syncQueue.filter(t => t.status === 'processing').length,
    completedTasks: syncQueue.filter(t => t.status === 'completed').length,
    failedTasks: syncQueue.filter(t => t.status === 'failed').length,
    lastActivity: syncQueue.length > 0 ? Math.max(...syncQueue.map(t => t.lastAttempt || t.createdAt)) : null
  };
}

/**
 * Cancel task
 */
function cancelTask(taskId) {
  const task = syncQueue.find(t => t.id === taskId);
  if (task && task.status === 'pending') {
    task.status = 'cancelled';
    
    // Clear retry timer if exists
    if (retryTimers.has(taskId)) {
      clearTimeout(retryTimers.get(taskId));
      retryTimers.delete(taskId);
    }
    
    // Remove from queue
    syncQueue = syncQueue.filter(t => t.id !== taskId);
    
    self.postMessage({
      type: 'task_cancelled',
      taskId
    });
    
    return true;
  }
  return false;
}

/**
 * Clear completed tasks
 */
function clearCompletedTasks() {
  const beforeCount = syncQueue.length;
  syncQueue = syncQueue.filter(t => t.status !== 'completed' && t.status !== 'failed');
  const removedCount = beforeCount - syncQueue.length;
  
  self.postMessage({
    type: 'tasks_cleared',
    removedCount
  });
  
  return removedCount;
}

// Message handler
self.onmessage = function(e) {
  const { type, ...params } = e.data;
  
  try {
    let result;
    
    switch (type) {
      case 'add_task':
        result = addTask(params.task);
        break;
        
      case 'cancel_task':
        result = cancelTask(params.taskId);
        break;
        
      case 'get_status':
        result = getSyncStatus();
        break;
        
      case 'clear_completed':
        result = clearCompletedTasks();
        break;
        
      case 'start_sync':
        startPeriodicSync();
        result = { started: true };
        break;
        
      case 'stop_sync':
        stopPeriodicSync();
        result = { stopped: true };
        break;
        
      case 'process_queue':
        processPendingTasks();
        result = { processing: true };
        break;
        
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
    
    self.postMessage({
      type: 'response',
      originalType: type,
      result
    });
    
  } catch (error) {
    self.postMessage({
      type: 'error',
      originalType: type,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    });
  }
};

// Initialize
updateOnlineStatus();
startPeriodicSync();

// Export task types for use by client
self.postMessage({
  type: 'worker_ready',
  taskTypes: TASK_TYPES,
  config: CONFIG
});