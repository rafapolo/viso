// Storage Management UI Component
// Provides user interface for managing OPFS storage, cache, and offline data

import offlineDataManager from './offline-data-manager.js';
import cacheManager from './cache-manager.js';
import filesystemWorkerClient from './filesystem-worker-client.js';
import backgroundSyncClient from './background-sync-client.js';
import { ErrorHandler } from './error-handler.js';
import appConfig from './app-config.js';

export class StorageManagementUI {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.isVisible = false;
    this.refreshInterval = null;
    
    if (!this.container) {
      throw new Error(`Container element with id '${containerId}' not found`);
    }
    
    this.initialize();
  }

  /**
   * Initialize the UI
   */
  async initialize() {
    this.createUI();
    this.setupEventListeners();
    await this.refreshData();
    
    if (appConfig.development.enableLogging) {
      console.log('💾 Storage Management UI initialized');
    }
  }

  /**
   * Create the UI structure
   */
  createUI() {
    this.container.innerHTML = `
      <div class="storage-management-modal" id="storageModal" style="display: none;">
        <div class="storage-modal-backdrop" onclick="storageUI.hide()"></div>
        <div class="storage-modal-content">
          <div class="storage-modal-header">
            <h2>🗄️ Storage Management</h2>
            <button class="storage-close-btn" onclick="storageUI.hide()">&times;</button>
          </div>
          
          <div class="storage-modal-body">
            <!-- Offline Status -->
            <div class="storage-section">
              <h3>📡 Connection Status</h3>
              <div class="status-indicator" id="connectionStatus">
                <span class="status-dot"></span>
                <span class="status-text">Checking...</span>
              </div>
            </div>

            <!-- Storage Overview -->
            <div class="storage-section">
              <h3>📊 Storage Usage</h3>
              <div class="storage-stats" id="storageStats">
                <div class="loading">Loading storage statistics...</div>
              </div>
            </div>

            <!-- Dataset Management -->
            <div class="storage-section">
              <h3>📁 Datasets</h3>
              <div class="dataset-list" id="datasetList">
                <div class="loading">Loading datasets...</div>
              </div>
            </div>

            <!-- Cache Management -->
            <div class="storage-section">
              <h3>🚀 Cache</h3>
              <div class="cache-stats" id="cacheStats">
                <div class="loading">Loading cache statistics...</div>
              </div>
              <div class="cache-actions">
                <button class="btn btn-secondary" onclick="storageUI.clearQueryCache()">
                  Clear Query Cache
                </button>
                <button class="btn btn-secondary" onclick="storageUI.clearExpiredCache()">
                  Clear Expired
                </button>
                <button class="btn btn-warning" onclick="storageUI.clearAllCache()">
                  Clear All Cache
                </button>
              </div>
            </div>

            <!-- Background Tasks -->
            <div class="storage-section">
              <h3>⚙️ Background Tasks</h3>
              <div class="sync-status" id="syncStatus">
                <div class="loading">Loading sync status...</div>
              </div>
              <div class="sync-actions">
                <button class="btn btn-primary" onclick="storageUI.forcSync()">
                  Sync Now
                </button>
                <button class="btn btn-secondary" onclick="storageUI.clearCompletedTasks()">
                  Clear Completed
                </button>
              </div>
            </div>

            <!-- Actions -->
            <div class="storage-section">
              <h3>🛠️ Actions</h3>
              <div class="storage-actions">
                <button class="btn btn-primary" onclick="storageUI.refreshData()">
                  🔄 Refresh Data
                </button>
                <button class="btn btn-warning" onclick="storageUI.clearOfflineData()">
                  🗑️ Clear Offline Data
                </button>
                <button class="btn btn-secondary" onclick="storageUI.exportSettings()">
                  📤 Export Settings
                </button>
              </div>
            </div>
          </div>

          <div class="storage-modal-footer">
            <div class="auto-refresh">
              <label>
                <input type="checkbox" id="autoRefresh" checked> Auto-refresh (5s)
              </label>
            </div>
            <button class="btn btn-secondary" onclick="storageUI.hide()">Close</button>
          </div>
        </div>
      </div>
    `;

    // Add CSS styles
    this.addStyles();
  }

  /**
   * Add CSS styles for the storage management UI
   */
  addStyles() {
    const existingStyles = document.getElementById('storage-management-styles');
    if (existingStyles) return;

    const styles = document.createElement('style');
    styles.id = 'storage-management-styles';
    styles.textContent = `
      .storage-management-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .storage-modal-backdrop {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
      }

      .storage-modal-content {
        position: relative;
        background: var(--bg-color, #ffffff);
        border-radius: 12px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
        width: 90%;
        max-width: 800px;
        max-height: 90vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }

      .storage-modal-header {
        padding: 20px 24px;
        border-bottom: 1px solid var(--border-color, #e5e7eb);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .storage-modal-header h2 {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 600;
      }

      .storage-close-btn {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        color: var(--text-secondary, #6b7280);
      }

      .storage-close-btn:hover {
        background: var(--hover-bg, #f3f4f6);
      }

      .storage-modal-body {
        padding: 20px 24px;
        overflow-y: auto;
        flex: 1;
      }

      .storage-section {
        margin-bottom: 24px;
        padding-bottom: 20px;
        border-bottom: 1px solid var(--border-light, #f3f4f6);
      }

      .storage-section:last-child {
        border-bottom: none;
        margin-bottom: 0;
      }

      .storage-section h3 {
        margin: 0 0 12px 0;
        font-size: 1rem;
        font-weight: 600;
        color: var(--text-primary, #111827);
      }

      .status-indicator {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 6px;
        background: var(--status-bg, #f9fafb);
      }

      .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--status-color, #6b7280);
      }

      .status-indicator.online .status-dot {
        background: #10b981;
      }

      .status-indicator.offline .status-dot {
        background: #ef4444;
      }

      .status-indicator.syncing .status-dot {
        background: #f59e0b;
        animation: pulse 1.5s infinite;
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }

      .storage-stats, .cache-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px;
        margin-bottom: 16px;
      }

      .stat-card {
        padding: 16px;
        border-radius: 8px;
        background: var(--card-bg, #f9fafb);
        border: 1px solid var(--border-light, #f3f4f6);
      }

      .stat-label {
        font-size: 0.875rem;
        color: var(--text-secondary, #6b7280);
        margin-bottom: 4px;
      }

      .stat-value {
        font-size: 1.125rem;
        font-weight: 600;
        color: var(--text-primary, #111827);
      }

      .dataset-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px;
        border-radius: 6px;
        background: var(--item-bg, #f9fafb);
        margin-bottom: 8px;
      }

      .dataset-info {
        flex: 1;
      }

      .dataset-name {
        font-weight: 600;
        margin-bottom: 4px;
      }

      .dataset-details {
        font-size: 0.875rem;
        color: var(--text-secondary, #6b7280);
      }

      .dataset-status {
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 500;
        margin-left: 8px;
      }

      .dataset-status.available {
        background: #d1fae5;
        color: #065f46;
      }

      .dataset-status.unavailable {
        background: #fee2e2;
        color: #991b1b;
      }

      .dataset-status.stale {
        background: #fef3c7;
        color: #92400e;
      }

      .cache-actions, .sync-actions, .storage-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .btn {
        padding: 8px 16px;
        border-radius: 6px;
        border: 1px solid transparent;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
      }

      .btn-primary {
        background: #3b82f6;
        color: white;
      }

      .btn-primary:hover {
        background: #2563eb;
      }

      .btn-secondary {
        background: #f3f4f6;
        color: #374151;
        border-color: #d1d5db;
      }

      .btn-secondary:hover {
        background: #e5e7eb;
      }

      .btn-warning {
        background: #f59e0b;
        color: white;
      }

      .btn-warning:hover {
        background: #d97706;
      }

      .sync-task {
        padding: 8px 12px;
        border-radius: 4px;
        background: var(--task-bg, #f9fafb);
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .task-info {
        flex: 1;
      }

      .task-type {
        font-weight: 500;
        font-size: 0.875rem;
      }

      .task-status {
        font-size: 0.75rem;
        color: var(--text-secondary, #6b7280);
      }

      .task-progress {
        width: 100px;
        height: 4px;
        background: var(--progress-bg, #e5e7eb);
        border-radius: 2px;
        overflow: hidden;
        margin: 4px 0;
      }

      .task-progress-bar {
        height: 100%;
        background: #3b82f6;
        transition: width 0.3s;
      }

      .storage-modal-footer {
        padding: 16px 24px;
        border-top: 1px solid var(--border-color, #e5e7eb);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .auto-refresh label {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.875rem;
        color: var(--text-secondary, #6b7280);
        cursor: pointer;
      }

      .loading {
        text-align: center;
        color: var(--text-secondary, #6b7280);
        font-style: italic;
        padding: 20px;
      }

      /* Dark mode support */
      @media (prefers-color-scheme: dark) {
        :root {
          --bg-color: #1f2937;
          --text-primary: #f9fafb;
          --text-secondary: #9ca3af;
          --border-color: #374151;
          --border-light: #374151;
          --card-bg: #374151;
          --item-bg: #374151;
          --hover-bg: #4b5563;
          --status-bg: #374151;
          --task-bg: #374151;
          --progress-bg: #4b5563;
        }
      }
    `;
    
    document.head.appendChild(styles);
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Auto-refresh toggle
    const autoRefreshCheckbox = document.getElementById('autoRefresh');
    autoRefreshCheckbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        this.startAutoRefresh();
      } else {
        this.stopAutoRefresh();
      }
    });

    // Background sync event listeners
    backgroundSyncClient.on('task:queued', () => this.updateSyncStatus());
    backgroundSyncClient.on('task:completed', () => this.updateSyncStatus());
    backgroundSyncClient.on('task:failed', () => this.updateSyncStatus());
    backgroundSyncClient.on('download:progress', (data) => this.updateTaskProgress(data));

    // Offline data manager listeners
    offlineDataManager.addListener((event, data) => {
      if (this.isVisible) {
        this.updateConnectionStatus();
        this.updateStorageStats();
      }
    });
  }

  /**
   * Show the storage management modal
   */
  show() {
    document.getElementById('storageModal').style.display = 'flex';
    this.isVisible = true;
    this.refreshData();
    this.startAutoRefresh();
  }

  /**
   * Hide the storage management modal
   */
  hide() {
    document.getElementById('storageModal').style.display = 'none';
    this.isVisible = false;
    this.stopAutoRefresh();
  }

  /**
   * Toggle modal visibility
   */
  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Refresh all data
   */
  async refreshData() {
    if (!this.isVisible) return;

    try {
      await Promise.all([
        this.updateConnectionStatus(),
        this.updateStorageStats(),
        this.updateDatasetList(),
        this.updateCacheStats(),
        this.updateSyncStatus()
      ]);
    } catch (error) {
      ErrorHandler.handleError(error, 'Storage UI Refresh');
    }
  }

  /**
   * Update connection status
   */
  async updateConnectionStatus() {
    const statusElement = document.getElementById('connectionStatus');
    const offlineStatus = await offlineDataManager.getOfflineStatus();
    
    let statusClass = 'offline';
    let statusText = 'Offline';
    
    if (offlineStatus.isOnline) {
      statusClass = 'online';
      statusText = 'Online';
    }
    
    // Check for sync activity
    const syncStatus = await backgroundSyncClient.getStatus();
    if (syncStatus.processingTasks > 0) {
      statusClass = 'syncing';
      statusText = 'Syncing...';
    }
    
    statusElement.className = `status-indicator ${statusClass}`;
    statusElement.querySelector('.status-text').textContent = statusText;
  }

  /**
   * Update storage statistics
   */
  async updateStorageStats() {
    const statsElement = document.getElementById('storageStats');
    
    try {
      const storageUsage = await filesystemWorkerClient.getStorageUsage();
      
      statsElement.innerHTML = `
        <div class="stat-card">
          <div class="stat-label">Total Storage</div>
          <div class="stat-value">${storageUsage.formatted.total}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Datasets</div>
          <div class="stat-value">${storageUsage.formatted.datasets}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Cache</div>
          <div class="stat-value">${storageUsage.formatted.cache}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Temporary</div>
          <div class="stat-value">${storageUsage.formatted.temp}</div>
        </div>
      `;
    } catch (error) {
      statsElement.innerHTML = '<div class="error">Failed to load storage statistics</div>';
    }
  }

  /**
   * Update dataset list
   */
  async updateDatasetList() {
    const listElement = document.getElementById('datasetList');
    
    try {
      const datasets = offlineDataManager.listDatasets();
      const offlineStatus = await offlineDataManager.getOfflineStatus();
      
      if (datasets.length === 0) {
        listElement.innerHTML = '<div class="no-data">No datasets registered</div>';
        return;
      }
      
      listElement.innerHTML = datasets.map(dataset => {
        const status = offlineStatus.datasets[dataset.name];
        let statusClass = 'unavailable';
        let statusText = 'Not Available';
        
        if (status?.isAvailableOffline) {
          statusClass = status.isStale ? 'stale' : 'available';
          statusText = status.isStale ? 'Stale' : 'Available';
        }
        
        const lastUpdated = dataset.lastUpdated 
          ? new Date(dataset.lastUpdated).toLocaleString()
          : 'Never';
        
        return `
          <div class="dataset-item">
            <div class="dataset-info">
              <div class="dataset-name">${dataset.name}</div>
              <div class="dataset-details">
                Format: ${dataset.format} • 
                Size: ${dataset.size ? this.formatBytes(dataset.size) : 'Unknown'} • 
                Last Updated: ${lastUpdated}
              </div>
            </div>
            <div class="dataset-status ${statusClass}">${statusText}</div>
          </div>
        `;
      }).join('');
    } catch (error) {
      listElement.innerHTML = '<div class="error">Failed to load datasets</div>';
    }
  }

  /**
   * Update cache statistics
   */
  async updateCacheStats() {
    const statsElement = document.getElementById('cacheStats');
    
    try {
      const cacheStats = await cacheManager.getStatistics();
      
      statsElement.innerHTML = `
        <div class="stat-card">
          <div class="stat-label">Total Entries</div>
          <div class="stat-value">${cacheStats.entries.total}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Memory Cache</div>
          <div class="stat-value">${cacheStats.entries.memory}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Persistent Cache</div>
          <div class="stat-value">${cacheStats.entries.persistent}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Hit Rate</div>
          <div class="stat-value">${cacheStats.hitRate.toFixed(1)}</div>
        </div>
      `;
    } catch (error) {
      statsElement.innerHTML = '<div class="error">Failed to load cache statistics</div>';
    }
  }

  /**
   * Update sync status
   */
  async updateSyncStatus() {
    const statusElement = document.getElementById('syncStatus');
    
    try {
      const syncStatus = await backgroundSyncClient.getStatus();
      
      statusElement.innerHTML = `
        <div class="sync-overview">
          <div class="stat-card">
            <div class="stat-label">Queue</div>
            <div class="stat-value">${syncStatus.queueLength}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Processing</div>
            <div class="stat-value">${syncStatus.processingTasks}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Completed</div>
            <div class="stat-value">${syncStatus.completedTasks}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Failed</div>
            <div class="stat-value">${syncStatus.failedTasks}</div>
          </div>
        </div>
      `;
    } catch (error) {
      statusElement.innerHTML = '<div class="error">Failed to load sync status</div>';
    }
  }

  /**
   * Update task progress
   */
  updateTaskProgress(data) {
    // This would update individual task progress bars if we had them
    // For now, just trigger a sync status update
    this.updateSyncStatus();
  }

  /**
   * Start auto-refresh
   */
  startAutoRefresh() {
    if (this.refreshInterval) return;
    
    this.refreshInterval = setInterval(() => {
      if (this.isVisible) {
        this.refreshData();
      }
    }, 5000);
  }

  /**
   * Stop auto-refresh
   */
  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  /**
   * Clear query cache
   */
  async clearQueryCache() {
    try {
      await cacheManager.clear({ tags: ['query-result'] });
      this.updateCacheStats();
      this.showNotification('Query cache cleared', 'success');
    } catch (error) {
      this.showNotification('Failed to clear query cache', 'error');
    }
  }

  /**
   * Clear expired cache
   */
  async clearExpiredCache() {
    try {
      const removed = await cacheManager.cleanup();
      this.updateCacheStats();
      this.showNotification(`Cleared ${removed} expired entries`, 'success');
    } catch (error) {
      this.showNotification('Failed to clear expired cache', 'error');
    }
  }

  /**
   * Clear all cache
   */
  async clearAllCache() {
    if (!confirm('Are you sure you want to clear all cache? This will remove all cached data.')) {
      return;
    }
    
    try {
      await cacheManager.clear();
      this.updateCacheStats();
      this.showNotification('All cache cleared', 'success');
    } catch (error) {
      this.showNotification('Failed to clear cache', 'error');
    }
  }

  /**
   * Force sync
   */
  async forcSync() {
    try {
      await backgroundSyncClient.processQueue();
      this.updateSyncStatus();
      this.showNotification('Sync started', 'success');
    } catch (error) {
      this.showNotification('Failed to start sync', 'error');
    }
  }

  /**
   * Clear completed tasks
   */
  async clearCompletedTasks() {
    try {
      const result = await backgroundSyncClient.clearCompletedTasks();
      this.updateSyncStatus();
      this.showNotification(`Cleared ${result.removedCount} completed tasks`, 'success');
    } catch (error) {
      this.showNotification('Failed to clear completed tasks', 'error');
    }
  }

  /**
   * Clear offline data
   */
  async clearOfflineData() {
    if (!confirm('Are you sure you want to clear all offline data? This will remove all cached datasets.')) {
      return;
    }
    
    try {
      await offlineDataManager.clearAllData();
      this.refreshData();
      this.showNotification('Offline data cleared', 'success');
    } catch (error) {
      this.showNotification('Failed to clear offline data', 'error');
    }
  }

  /**
   * Export settings
   */
  async exportSettings() {
    try {
      const settings = {
        datasets: offlineDataManager.listDatasets(),
        offlineStatus: await offlineDataManager.getOfflineStatus(),
        cacheStats: await cacheManager.getStatistics(),
        exportedAt: new Date().toISOString()
      };
      
      const blob = new Blob([JSON.stringify(settings, null, 2)], { 
        type: 'application/json' 
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `viso-storage-settings-${Date.now()}.json`;
      a.click();
      
      URL.revokeObjectURL(url);
      this.showNotification('Settings exported', 'success');
    } catch (error) {
      this.showNotification('Failed to export settings', 'error');
    }
  }

  /**
   * Show notification
   */
  showNotification(message, type = 'info') {
    // Simple notification - can be enhanced with a proper notification system
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // Could integrate with existing toast system if available
    if (window.showToast) {
      window.showToast(message, type);
    }
  }

  /**
   * Format bytes
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}

// Export for global use
window.StorageManagementUI = StorageManagementUI;
export default StorageManagementUI;