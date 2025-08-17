// PWA Integration with OPFS
export class PWAManager {
  constructor() {
    this.serviceWorker = null;
    this.isOnline = navigator.onLine;
    this.opfsManager = null;
    this.messageChannel = null;
    this.installPrompt = null;
    
    this.setupEventListeners();
  }

  async initialize(opfsManager) {
    this.opfsManager = opfsManager;
    
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        this.serviceWorker = registration;
        console.log('[PWA] Service worker registered:', registration);
        
        // Setup message channel for OPFS communication
        this.setupMessageChannel();
        
        return true;
      } catch (error) {
        console.error('[PWA] Service worker registration failed:', error);
        return false;
      }
    }
    
    return false;
  }

  setupEventListeners() {
    // Online/offline status
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.onConnectionChange(true);
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.onConnectionChange(false);
    });

    // Install prompt handling
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.installPrompt = e;
      this.showInstallPrompt();
    });

    // App installed
    window.addEventListener('appinstalled', () => {
      console.log('[PWA] App installed successfully');
      this.installPrompt = null;
      this.hideInstallPrompt();
    });
  }

  setupMessageChannel() {
    if (!this.serviceWorker) return;

    this.messageChannel = new MessageChannel();
    this.messageChannel.port1.onmessage = (event) => {
      this.handleServiceWorkerMessage(event.data);
    };

    // Send port to service worker
    navigator.serviceWorker.controller?.postMessage(
      { type: 'SETUP_PORT' },
      [this.messageChannel.port2]
    );
  }

  async sendToServiceWorker(type, data) {
    return new Promise((resolve, reject) => {
      if (!this.messageChannel) {
        reject(new Error('Message channel not setup'));
        return;
      }

      const messageId = Date.now() + Math.random();
      
      const timeout = setTimeout(() => {
        reject(new Error('Service worker message timeout'));
      }, 5000);

      const handler = (event) => {
        if (event.data.id === messageId) {
          clearTimeout(timeout);
          this.messageChannel.port1.removeEventListener('message', handler);
          resolve(event.data);
        }
      };

      this.messageChannel.port1.addEventListener('message', handler);
      
      navigator.serviceWorker.controller?.postMessage({
        id: messageId,
        type,
        data
      });
    });
  }

  handleServiceWorkerMessage(message) {
    const { type, data } = message;
    
    switch (type) {
      case 'CACHE_UPDATED':
        console.log('[PWA] Cache updated:', data);
        break;
      case 'BACKGROUND_SYNC':
        this.handleBackgroundSync(data);
        break;
      case 'OPFS_SYNC_COMPLETE':
        console.log('[PWA] OPFS sync completed:', data);
        break;
      default:
        console.log('[PWA] Unknown message from SW:', message);
    }
  }

  async handleBackgroundSync(data) {
    if (this.opfsManager && this.isOnline) {
      try {
        // Sync OPFS data with server
        await this.syncOPFSData();
      } catch (error) {
        console.error('[PWA] Background sync failed:', error);
      }
    }
  }

  async syncOPFSData() {
    if (!this.opfsManager) return;

    try {
      // Get pending sync items from OPFS
      const pendingSync = await this.opfsManager.getFile('_sync/pending.json');
      
      if (pendingSync) {
        const syncData = JSON.parse(new TextDecoder().decode(pendingSync.data));
        
        for (const item of syncData.items) {
          await this.syncDataItem(item);
        }
        
        // Clear pending sync
        await this.opfsManager.deleteFile('_sync/pending.json');
        console.log('[PWA] OPFS sync completed');
      }
    } catch (error) {
      console.error('[PWA] OPFS sync failed:', error);
    }
  }

  async syncDataItem(item) {
    const { type, path, data, action } = item;
    
    try {
      switch (action) {
        case 'upload':
          // Upload data to server
          const response = await fetch('/api/sync/upload', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ path, data })
          });
          
          if (!response.ok) {
            throw new Error(`Upload failed: ${response.statusText}`);
          }
          break;
          
        case 'download':
          // Download data from server
          const downloadResponse = await fetch(`/api/sync/download?path=${encodeURIComponent(path)}`);
          
          if (downloadResponse.ok) {
            const serverData = await downloadResponse.arrayBuffer();
            await this.opfsManager.storeFile(path, serverData);
          }
          break;
      }
    } catch (error) {
      console.error('[PWA] Sync item failed:', item, error);
      // Re-add to pending sync
      await this.addToPendingSync(item);
    }
  }

  async addToPendingSync(item) {
    try {
      let pendingSync = { items: [] };
      
      const existing = await this.opfsManager.getFile('_sync/pending.json');
      if (existing) {
        pendingSync = JSON.parse(new TextDecoder().decode(existing.data));
      }
      
      pendingSync.items.push({
        ...item,
        timestamp: Date.now()
      });
      
      await this.opfsManager.storeFile(
        '_sync/pending.json',
        JSON.stringify(pendingSync)
      );
    } catch (error) {
      console.error('[PWA] Failed to add to pending sync:', error);
    }
  }

  onConnectionChange(isOnline) {
    console.log('[PWA] Connection status:', isOnline ? 'online' : 'offline');
    
    // Update UI to show connection status
    this.updateConnectionStatus(isOnline);
    
    if (isOnline) {
      // Trigger background sync when coming online
      this.triggerBackgroundSync();
    }
  }

  updateConnectionStatus(isOnline) {
    const statusElement = document.getElementById('connection-status');
    if (statusElement) {
      statusElement.textContent = isOnline ? 'Online' : 'Offline';
      statusElement.className = isOnline 
        ? 'text-green-600 dark:text-green-400' 
        : 'text-red-600 dark:text-red-400';
    }

    // Show/hide offline indicators
    const offlineIndicators = document.querySelectorAll('.offline-indicator');
    offlineIndicators.forEach(indicator => {
      indicator.style.display = isOnline ? 'none' : 'block';
    });
  }

  async triggerBackgroundSync() {
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register('background-sync');
        console.log('[PWA] Background sync registered');
      } catch (error) {
        console.error('[PWA] Background sync registration failed:', error);
        // Fallback to manual sync
        await this.syncOPFSData();
      }
    } else {
      // Fallback for browsers without background sync
      await this.syncOPFSData();
    }
  }

  showInstallPrompt() {
    const existingPrompt = document.getElementById('pwa-install-prompt');
    if (existingPrompt) return;

    const promptDiv = document.createElement('div');
    promptDiv.id = 'pwa-install-prompt';
    promptDiv.className = 'fixed top-4 left-4 bg-blue-600 text-white p-4 rounded-lg shadow-lg z-50 max-w-sm';
    promptDiv.innerHTML = `
      <div class="flex items-center gap-3">
        <span class="text-2xl">📱</span>
        <div class="flex-1">
          <div class="font-semibold">Instalar Viso</div>
          <div class="text-sm opacity-90">Adicionar à tela inicial para acesso rápido</div>
        </div>
        <div class="flex gap-2">
          <button id="install-app" class="bg-white text-blue-600 px-3 py-1 rounded text-sm font-medium">
            Instalar
          </button>
          <button id="dismiss-install" class="text-white opacity-70 hover:opacity-100">
            ✕
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(promptDiv);

    // Event listeners
    document.getElementById('install-app').onclick = () => this.installApp();
    document.getElementById('dismiss-install').onclick = () => this.hideInstallPrompt();

    // Auto-hide after 15 seconds
    setTimeout(() => {
      if (document.getElementById('pwa-install-prompt')) {
        this.hideInstallPrompt();
      }
    }, 15000);
  }

  hideInstallPrompt() {
    const prompt = document.getElementById('pwa-install-prompt');
    if (prompt) {
      prompt.remove();
    }
  }

  async installApp() {
    if (this.installPrompt) {
      try {
        const result = await this.installPrompt.prompt();
        console.log('[PWA] Install prompt result:', result.outcome);
        
        if (result.outcome === 'accepted') {
          this.installPrompt = null;
          this.hideInstallPrompt();
        }
      } catch (error) {
        console.error('[PWA] Install prompt failed:', error);
      }
    }
  }

  async clearCache(type = 'all') {
    try {
      const result = await this.sendToServiceWorker('CACHE_CLEAR', { cacheType: type });
      return result.success;
    } catch (error) {
      console.error('[PWA] Cache clear failed:', error);
      return false;
    }
  }

  async updateApp() {
    if (this.serviceWorker) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration && registration.waiting) {
          // Send skip waiting message
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          
          // Reload page when new SW takes control
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            window.location.reload();
          });
        }
      } catch (error) {
        console.error('[PWA] App update failed:', error);
      }
    }
  }

  getInstallationStatus() {
    return {
      isInstallable: !!this.installPrompt,
      isInstalled: window.matchMedia('(display-mode: standalone)').matches,
      isOnline: this.isOnline,
      hasServiceWorker: !!this.serviceWorker
    };
  }
}

// Connection status component
export function createConnectionStatusIndicator() {
  const indicator = document.createElement('div');
  indicator.id = 'connection-status-indicator';
  indicator.className = 'fixed bottom-4 right-4 bg-gray-800 text-white px-3 py-2 rounded-lg text-sm shadow-lg z-40';
  indicator.innerHTML = `
    <div class="flex items-center gap-2">
      <div class="w-2 h-2 rounded-full bg-current"></div>
      <span id="connection-status">${navigator.onLine ? 'Online' : 'Offline'}</span>
    </div>
  `;
  
  // Auto-hide when online
  if (navigator.onLine) {
    indicator.style.display = 'none';
  }
  
  return indicator;
}

// Export singleton instance
export const pwaManager = new PWAManager();