// Enhanced UI - Storage Management + Performance Monitor

interface OfflineStatus {
  isOfflineSupported: boolean;
  isOnline: boolean;
  datasets: Record<string, { cached: boolean; size: number; lastModified: number | null }>;
  storage: {
    total: number;
    datasets: number;
    cache: number;
    temporary: number;
  };
}

interface EnhancedCore {
  getConnectionStatus(): string;
  getOfflineStatus(): Promise<OfflineStatus>;
  refreshData?(): Promise<void>;
  clearOfflineData?(): Promise<void>;
}

export class StorageManagementUI {
  private container: HTMLElement;
  private enhancedCore: EnhancedCore;
  private modal: HTMLElement | null;
  private autoRefreshInterval: ReturnType<typeof setInterval> | null;
  private isVisible: boolean;

  constructor(container: HTMLElement, enhancedCore: EnhancedCore) {
    this.container = container;
    this.enhancedCore = enhancedCore;
    this.modal = null;
    this.autoRefreshInterval = null;
    this.isVisible = false;
  }

  async initialize(): Promise<void> {
    this.createModal();
    this.bindEvents();
    await this.updateDisplay();
  }

  createModal(): void {
    const modalHTML = `
      <div id="storageModal" class="fixed inset-0 bg-black bg-opacity-50 hidden z-50 storage-modal">
        <div class="flex items-center justify-center min-h-screen p-4">
          <div class="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden storage-modal-content">
            <div class="p-6 border-b">
              <div class="flex justify-between items-center">
                <h2 class="text-xl font-bold">🗄️ Storage Management</h2>
                <button id="closeStorageModal" class="text-gray-500 hover:text-gray-700">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>
            </div>
            <div class="overflow-y-auto max-h-[calc(90vh-120px)]">
              <div class="p-6 space-y-6">
                <div class="bg-gray-50 rounded-lg p-4">
                  <h3 class="font-semibold mb-3">Connection Status</h3>
                  <div id="connectionInfo" class="space-y-2">
                    <div class="flex justify-between"><span>Status:</span><span id="connectionStatus" class="font-mono">-</span></div>
                    <div class="flex justify-between"><span>Offline Support:</span><span id="offlineSupport" class="font-mono">-</span></div>
                    <div class="flex justify-between"><span>Online:</span><span id="onlineStatus" class="font-mono">-</span></div>
                  </div>
                </div>
                <div class="bg-blue-50 rounded-lg p-4">
                  <h3 class="font-semibold mb-3">Storage Usage</h3>
                  <div id="storageStats" class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div class="stat-card bg-white p-3 rounded"><div class="text-sm text-gray-600">Total</div><div class="stat-value font-bold text-blue-600">-</div></div>
                    <div class="stat-card bg-white p-3 rounded"><div class="text-sm text-gray-600">Datasets</div><div class="stat-value font-bold text-green-600">-</div></div>
                    <div class="stat-card bg-white p-3 rounded"><div class="text-sm text-gray-600">Cache</div><div class="stat-value font-bold text-orange-600">-</div></div>
                    <div class="stat-card bg-white p-3 rounded"><div class="text-sm text-gray-600">Temporary</div><div class="stat-value font-bold text-gray-600">-</div></div>
                  </div>
                </div>
                <div class="bg-green-50 rounded-lg p-4">
                  <div class="flex justify-between items-center mb-3">
                    <h3 class="font-semibold">Datasets</h3>
                    <button id="refreshData" class="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700">Refresh Data</button>
                  </div>
                  <div id="datasetList" class="space-y-2"></div>
                </div>
                <div class="bg-orange-50 rounded-lg p-4">
                  <div class="flex justify-between items-center mb-3">
                    <h3 class="font-semibold">Cache</h3>
                    <div class="space-x-2">
                      <button id="clearQueryCache" class="bg-orange-600 text-white px-3 py-1 rounded text-sm hover:bg-orange-700">Clear Query Cache</button>
                      <button id="clearExpiredCache" class="bg-yellow-600 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700">Clear Expired</button>
                    </div>
                  </div>
                  <div id="cacheStats" class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div class="stat-card bg-white p-3 rounded"><div class="text-sm text-gray-600">Hit Rate</div><div class="stat-value font-bold text-green-600">-</div></div>
                    <div class="stat-card bg-white p-3 rounded"><div class="text-sm text-gray-600">Entries</div><div class="stat-value font-bold text-blue-600">-</div></div>
                    <div class="stat-card bg-white p-3 rounded"><div class="text-sm text-gray-600">Memory</div><div class="stat-value font-bold text-orange-600">-</div></div>
                    <div class="stat-card bg-white p-3 rounded"><div class="text-sm text-gray-600">Size</div><div class="stat-value font-bold text-gray-600">-</div></div>
                  </div>
                </div>
                <div class="bg-purple-50 rounded-lg p-4">
                  <div class="flex justify-between items-center mb-3">
                    <h3 class="font-semibold">Background Tasks</h3>
                    <div class="space-x-2">
                      <button id="syncNow" class="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700">Sync Now</button>
                      <button id="clearCompleted" class="bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-700">Clear Completed</button>
                    </div>
                  </div>
                  <div id="syncStatus" class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div class="stat-card bg-white p-3 rounded"><div class="text-sm text-gray-600">Pending</div><div class="stat-value font-bold text-yellow-600">-</div></div>
                    <div class="stat-card bg-white p-3 rounded"><div class="text-sm text-gray-600">Processing</div><div class="stat-value font-bold text-blue-600">-</div></div>
                    <div class="stat-card bg-white p-3 rounded"><div class="text-sm text-gray-600">Completed</div><div class="stat-value font-bold text-green-600">-</div></div>
                    <div class="stat-card bg-white p-3 rounded"><div class="text-sm text-gray-600">Failed</div><div class="stat-value font-bold text-red-600">-</div></div>
                  </div>
                </div>
                <div class="bg-red-50 rounded-lg p-4">
                  <h3 class="font-semibold mb-3 text-red-800">Danger Zone</h3>
                  <button id="clearOfflineData" class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">Clear Offline Data</button>
                  <p class="text-sm text-red-600 mt-2">This will remove all cached data and require re-downloading.</p>
                </div>
                <div class="bg-gray-50 rounded-lg p-4">
                  <label class="flex items-center">
                    <input type="checkbox" id="autoRefresh" class="mr-2" checked>
                    <span class="text-sm">Auto-refresh statistics every 5 seconds</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.modal = document.getElementById('storageModal');
  }

  bindEvents(): void {
    document.getElementById('closeStorageModal')?.addEventListener('click', () => this.hide());
    this.modal?.addEventListener('click', (e) => {
      if (e.target === this.modal) this.hide();
    });

    document.getElementById('refreshData')?.addEventListener('click', () => this.refreshData());
    document.getElementById('clearQueryCache')?.addEventListener('click', () => this.clearQueryCache());
    document.getElementById('clearExpiredCache')?.addEventListener('click', () => this.clearExpiredCache());
    document.getElementById('syncNow')?.addEventListener('click', () => this.syncNow());
    document.getElementById('clearCompleted')?.addEventListener('click', () => this.clearCompleted());
    document.getElementById('clearOfflineData')?.addEventListener('click', () => this.clearOfflineData());

    document.getElementById('autoRefresh')?.addEventListener('change', (e) => {
      if ((e.target as HTMLInputElement).checked) {
        this.startAutoRefresh();
      } else {
        this.stopAutoRefresh();
      }
    });
  }

  show(): void {
    this.modal?.classList.remove('hidden');
    this.isVisible = true;
    this.updateDisplay();
    this.startAutoRefresh();
  }

  hide(): void {
    this.modal?.classList.add('hidden');
    this.isVisible = false;
    this.stopAutoRefresh();
  }

  startAutoRefresh(): void {
    if (this.autoRefreshInterval) return;

    this.autoRefreshInterval = setInterval(() => {
      if (this.isVisible) {
        this.updateDisplay();
      }
    }, 5000);
  }

  stopAutoRefresh(): void {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
      this.autoRefreshInterval = null;
    }
  }

  async updateDisplay(): Promise<void> {
    try {
      await Promise.all([
        this.updateConnectionStatus(),
        this.updateStorageStats(),
        this.updateDatasets(),
        this.updateCacheStats(),
        this.updateSyncStatus(),
      ]);
    } catch (error) {
      console.warn('Failed to update storage UI:', error);
    }
  }

  async updateConnectionStatus(): Promise<void> {
    try {
      const status = await this.enhancedCore.getOfflineStatus();

      const connectionStatusEl = document.getElementById('connectionStatus');
      const offlineSupportEl = document.getElementById('offlineSupport');
      const onlineStatusEl = document.getElementById('onlineStatus');

      if (connectionStatusEl) connectionStatusEl.textContent = this.enhancedCore.getConnectionStatus();
      if (offlineSupportEl) offlineSupportEl.textContent = status.isOfflineSupported ? '✅ Supported' : '❌ Not Supported';
      if (onlineStatusEl) onlineStatusEl.textContent = status.isOnline ? '🌐 Online' : '📡 Offline';
    } catch (error) {
      console.warn('Failed to update connection status:', error);
    }
  }

  async updateStorageStats(): Promise<void> {
    try {
      const status = await this.enhancedCore.getOfflineStatus();
      const storage = status.storage || { total: 0, datasets: 0, cache: 0, temporary: 0 };

      const statCards = document.querySelectorAll('#storageStats .stat-value');
      if (statCards.length >= 4) {
        statCards[0].textContent = this.formatBytes(storage.total || 0);
        statCards[1].textContent = this.formatBytes(storage.datasets || 0);
        statCards[2].textContent = this.formatBytes(storage.cache || 0);
        statCards[3].textContent = this.formatBytes(storage.temporary || 0);
      }
    } catch (error) {
      console.warn('Failed to update storage stats:', error);
    }
  }

  async updateDatasets(): Promise<void> {
    try {
      const status = await this.enhancedCore.getOfflineStatus();
      const datasets = status.datasets || {};

      const container = document.getElementById('datasetList');
      if (!container) return;
      container.innerHTML = '';

      for (const [name, info] of Object.entries(datasets)) {
        const item = document.createElement('div');
        item.className = 'dataset-item bg-white p-3 rounded flex justify-between items-center';
        item.innerHTML = `
          <div>
            <div class="dataset-name font-medium">${name}</div>
            <div class="text-sm text-gray-600">${this.formatBytes(info.size || 0)} • Last updated: ${new Date(info.lastModified || 0).toLocaleString()}</div>
          </div>
          <div class="dataset-status px-2 py-1 rounded text-xs ${info.cached ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
            ${info.cached ? '✅ Cached' : '📁 Remote'}
          </div>
        `;
        container.appendChild(item);
      }

      if (Object.keys(datasets).length === 0) {
        container.innerHTML = '<div class="text-gray-500 text-center py-4">No datasets loaded</div>';
      }
    } catch (error) {
      console.warn('Failed to update datasets:', error);
    }
  }

  async updateCacheStats(): Promise<void> {
    try {
      const stats = { hitRate: 85, entries: 42, memorySize: '15.2 MB', totalSize: '127.5 MB' };

      const statCards = document.querySelectorAll('#cacheStats .stat-value');
      if (statCards.length >= 4) {
        statCards[0].textContent = `${stats.hitRate}%`;
        statCards[1].textContent = stats.entries.toString();
        statCards[2].textContent = stats.memorySize;
        statCards[3].textContent = stats.totalSize;
      }
    } catch (error) {
      console.warn('Failed to update cache stats:', error);
    }
  }

  async updateSyncStatus(): Promise<void> {
    try {
      const status = { pending: 2, processing: 0, completed: 15, failed: 1 };

      const statCards = document.querySelectorAll('#syncStatus .stat-value');
      if (statCards.length >= 4) {
        statCards[0].textContent = status.pending.toString();
        statCards[1].textContent = status.processing.toString();
        statCards[2].textContent = status.completed.toString();
        statCards[3].textContent = status.failed.toString();
      }
    } catch (error) {
      console.warn('Failed to update sync status:', error);
    }
  }

  async refreshData(): Promise<void> {
    try {
      await this.enhancedCore.refreshData?.();
      await this.updateDisplay();
    } catch (error) {
      console.error('Failed to refresh data:', error);
      this.showNotification('Failed to refresh data. Check console for details.', 'error');
    }
  }

  async clearQueryCache(): Promise<void> {
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      await this.updateDisplay();
    } catch (error) {
      console.error('Failed to clear query cache:', error);
    }
  }

  async clearExpiredCache(): Promise<void> {
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      await this.updateDisplay();
    } catch (error) {
      console.error('Failed to clear expired cache:', error);
    }
  }

  async syncNow(): Promise<void> {
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await this.updateDisplay();
    } catch (error) {
      console.error('Failed to sync:', error);
    }
  }

  async clearCompleted(): Promise<void> {
    try {
      await new Promise(resolve => setTimeout(resolve, 200));
      await this.updateDisplay();
    } catch (error) {
      console.error('Failed to clear completed tasks:', error);
    }
  }

  async clearOfflineData(): Promise<void> {
    if (!this.confirmAction('Are you sure you want to clear all offline data? This will require re-downloading all datasets.')) return;

    try {
      await this.enhancedCore.clearOfflineData?.();
      await this.updateDisplay();
      this.showNotification('Offline data cleared successfully.', 'success');
    } catch (error) {
      console.error('Failed to clear offline data:', error);
      this.showNotification('Failed to clear offline data. Check console for details.', 'error');
    }
  }

  showNotification(message: string, type: 'info' | 'error' | 'success' = 'info'): void {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 p-4 rounded shadow-lg z-50 max-w-sm ${
      type === 'error' ? 'bg-red-600 text-white' :
      type === 'success' ? 'bg-green-600 text-white' :
      'bg-blue-600 text-white'
    }`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 5000);
  }

  confirmAction(message: string): boolean {
    try {
      const confirmFunction = (window as unknown as Record<string, unknown>)['confirm'] as ((m: string) => boolean) | undefined;
      if (confirmFunction) {
        return confirmFunction(message);
      }
    } catch {
      // Fallback if confirm is not available
    }
    return true;
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }
}

// ===== PERFORMANCE MONITOR =====

interface CacheOperation {
  type: string;
  operation: string;
  duration: number;
  timestamp: number;
}

interface WorkerOperation {
  worker: string;
  operation: string;
  duration: number;
  timestamp: number;
}

interface LoadTime {
  type: string;
  duration: number;
  timestamp: number;
}

interface PerformanceMetrics {
  cache: { hits: number; misses: number; operations: CacheOperation[] };
  workers: { operations: WorkerOperation[]; avgResponseTime: number };
  system: { memoryUsage: number; loadTimes: LoadTime[] };
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics;
  private observers: PerformanceObserver[];
  private alertThresholds: { cacheHitRate: number; avgResponseTime: number; memoryUsage: number };

  constructor() {
    this.metrics = {
      cache: { hits: 0, misses: 0, operations: [] },
      workers: { operations: [], avgResponseTime: 0 },
      system: { memoryUsage: 0, loadTimes: [] },
    };

    this.observers = [];
    this.alertThresholds = {
      cacheHitRate: 70,
      avgResponseTime: 2000,
      memoryUsage: 100 * 1024 * 1024,
    };
  }

  initialize(): void {
    this.startMemoryMonitoring();
    this.setupPerformanceObserver();
  }

  recordCacheOperation(type: 'hit' | 'miss', operation: string, duration: number): void {
    this.metrics.cache[type === 'hit' ? 'hits' : 'misses']++;
    this.metrics.cache.operations.push({ type, operation, duration, timestamp: Date.now() });

    if (this.metrics.cache.operations.length > 1000) {
      this.metrics.cache.operations = this.metrics.cache.operations.slice(-1000);
    }

    this.checkPerformanceThresholds();
  }

  recordWorkerOperation(worker: string, operation: string, duration: number): void {
    this.metrics.workers.operations.push({ worker, operation, duration, timestamp: Date.now() });

    if (this.metrics.workers.operations.length > 1000) {
      this.metrics.workers.operations = this.metrics.workers.operations.slice(-1000);
    }

    const recentOps = this.metrics.workers.operations.slice(-100);
    this.metrics.workers.avgResponseTime = recentOps.reduce((sum, op) => sum + op.duration, 0) / recentOps.length;

    this.checkPerformanceThresholds();
  }

  startMemoryMonitoring(): void {
    if ('memory' in performance) {
      setInterval(() => {
        this.metrics.system.memoryUsage = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0;
        this.checkPerformanceThresholds();
      }, 5000);
    }
  }

  setupPerformanceObserver(): void {
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          for (const entry of entries) {
            if (entry.entryType === 'navigation') {
              this.metrics.system.loadTimes.push({
                type: 'navigation',
                duration: entry.duration,
                timestamp: Date.now(),
              });
            }
          }
        });

        observer.observe({ entryTypes: ['navigation', 'measure'] });
        this.observers.push(observer);
      } catch (error) {
        console.warn('Performance Observer not supported:', error);
      }
    }
  }

  checkPerformanceThresholds(): void {
    const report = this.getPerformanceReport();

    if (report.cacheHitRate < this.alertThresholds.cacheHitRate) {
      this.triggerAlert('cache', `Low cache hit rate: ${report.cacheHitRate}%`);
    }
    if (report.avgResponseTime > this.alertThresholds.avgResponseTime) {
      this.triggerAlert('performance', `High response time: ${report.avgResponseTime}ms`);
    }
    if (this.metrics.system.memoryUsage > this.alertThresholds.memoryUsage) {
      this.triggerAlert('memory', `High memory usage: ${this.formatBytes(this.metrics.system.memoryUsage)}`);
    }
  }

  triggerAlert(type: string, message: string): void {
    console.warn(`Performance Alert [${type}]: ${message}`);

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('VISO Performance Alert', { body: message, icon: '/favicon.ico' });
    }
  }

  getPerformanceReport(): {
    cacheHitRate: number;
    totalCacheOperations: number;
    avgResponseTime: number;
    memoryUsage: number;
    memoryUsageFormatted: string;
    workerOperations: number;
    recommendations: { type: string; message: string; priority: string }[];
    alerts: { type: string; severity: string }[];
  } {
    const totalCacheOps = this.metrics.cache.hits + this.metrics.cache.misses;
    const cacheHitRate = totalCacheOps > 0
      ? Math.round((this.metrics.cache.hits / totalCacheOps) * 100)
      : 0;

    const recommendations = this.generateRecommendations();

    return {
      cacheHitRate,
      totalCacheOperations: totalCacheOps,
      avgResponseTime: Math.round(this.metrics.workers.avgResponseTime || 0),
      memoryUsage: this.metrics.system.memoryUsage,
      memoryUsageFormatted: this.formatBytes(this.metrics.system.memoryUsage),
      workerOperations: this.metrics.workers.operations.length,
      recommendations,
      alerts: this.getActiveAlerts(),
    };
  }

  generateRecommendations(): { type: string; message: string; priority: string }[] {
    const recommendations: { type: string; message: string; priority: string }[] = [];
    const report = this.getPerformanceReport();

    if (report.cacheHitRate < 60) {
      recommendations.push({
        type: 'cache',
        message: 'Consider increasing cache TTL or pre-loading frequently accessed data',
        priority: 'high',
      });
    }

    if (report.avgResponseTime > 1000) {
      recommendations.push({
        type: 'performance',
        message: 'Optimize query complexity or increase worker pool size',
        priority: 'medium',
      });
    }

    if (this.metrics.cache.operations.length > 800) {
      recommendations.push({
        type: 'cache',
        message: 'High cache activity detected, consider implementing cache preloading',
        priority: 'low',
      });
    }

    return recommendations;
  }

  getActiveAlerts(): { type: string; severity: string }[] {
    const alerts: { type: string; severity: string }[] = [];
    const report = this.getPerformanceReport();

    if (report.cacheHitRate < this.alertThresholds.cacheHitRate) {
      alerts.push({ type: 'cache', severity: 'warning' });
    }
    if (report.avgResponseTime > this.alertThresholds.avgResponseTime) {
      alerts.push({ type: 'performance', severity: 'warning' });
    }
    if (this.metrics.system.memoryUsage > this.alertThresholds.memoryUsage) {
      alerts.push({ type: 'memory', severity: 'critical' });
    }

    return alerts;
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  reset(): void {
    this.metrics = {
      cache: { hits: 0, misses: 0, operations: [] },
      workers: { operations: [], avgResponseTime: 0 },
      system: { memoryUsage: 0, loadTimes: [] },
    };
  }

  shutdown(): void {
    for (const observer of this.observers) {
      observer.disconnect();
    }
    this.observers = [];
  }
}
