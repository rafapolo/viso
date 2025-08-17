import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PWAManager, createConnectionStatusIndicator } from '../../src/shared/pwa-integration.js';
import { OPFSStorageManager, CacheManager } from '../../src/shared/enhanced-storage.js';

// Mock DOM and browser APIs
const mockElement = {
  textContent: '',
  className: '',
  style: {},
  innerHTML: '',
  onclick: null,
  remove: jest.fn(),
  appendChild: jest.fn(),
  parentNode: null,
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
};

global.document = {
  createElement: jest.fn(() => ({ ...mockElement })),
  body: { appendChild: jest.fn() },
  getElementById: jest.fn(() => mockElement),
  querySelectorAll: jest.fn(() => [mockElement])
};

global.window = {
  addEventListener: jest.fn(),
  matchMedia: jest.fn(() => ({ matches: false })),
  location: { reload: jest.fn() },
  ServiceWorkerRegistration: {
    prototype: { sync: true }
  }
};

Object.defineProperty(global, 'navigator', {
  value: {
    onLine: true,
    serviceWorker: {
      register: jest.fn(),
      ready: Promise.resolve({
        scope: 'http://localhost:3000/',
        sync: { register: jest.fn() }
      }),
      controller: { postMessage: jest.fn() },
      addEventListener: jest.fn(),
      getRegistration: jest.fn()
    },
    storage: {
      getDirectory: jest.fn()
    }
  },
  writable: true
});

global.MessageChannel = jest.fn(() => ({
  port1: {
    onmessage: null,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  },
  port2: {}
}));

global.fetch = jest.fn();

describe('PWA-OPFS Integration', () => {
  let pwaManager;
  let opfsManager;
  let cacheManager;

  beforeEach(() => {
    pwaManager = new PWAManager();
    opfsManager = new OPFSStorageManager();
    cacheManager = new CacheManager();
    
    jest.clearAllMocks();
    
    // Reset navigator with fresh mocks
    Object.defineProperty(global, 'navigator', {
      value: {
        onLine: true,
        serviceWorker: {
          register: jest.fn().mockResolvedValue({
            scope: 'http://localhost:3000/',
            sync: { register: jest.fn() }
          }),
          ready: Promise.resolve({
            scope: 'http://localhost:3000/',
            sync: { register: jest.fn() }
          }),
          controller: { postMessage: jest.fn() },
          addEventListener: jest.fn(),
          getRegistration: jest.fn()
        },
        storage: {
          getDirectory: jest.fn().mockResolvedValue({
            getFileHandle: jest.fn(),
            getDirectoryHandle: jest.fn(),
            removeEntry: jest.fn()
          })
        }
      },
      writable: true,
      configurable: true
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Full Integration Flow', () => {
    it('should initialize PWA with OPFS support', async () => {
      // Initialize OPFS first
      const opfsResult = await opfsManager.initialize();
      expect(opfsResult).toBe(true);
      
      // Initialize PWA with OPFS
      const pwaResult = await pwaManager.initialize(opfsManager);
      expect(pwaResult).toBe(true);
      
      expect(pwaManager.opfsManager).toBe(opfsManager);
      expect(navigator.serviceWorker.register).toHaveBeenCalledWith('/sw.js');
    });

    it('should handle offline data sync workflow', async () => {
      await opfsManager.initialize();
      await pwaManager.initialize(opfsManager);
      
      // Mock pending sync data
      const pendingSyncData = {
        items: [
          {
            type: 'data',
            path: 'expenses/2024.json',
            action: 'upload',
            data: { expenses: [{ id: 1, amount: 100 }] },
            timestamp: Date.now()
          }
        ]
      };
      
      // Mock OPFS file operations
      const mockFile = {
        data: new TextEncoder().encode(JSON.stringify(pendingSyncData))
      };
      
      jest.spyOn(opfsManager, 'getFile').mockResolvedValue(mockFile);
      jest.spyOn(opfsManager, 'deleteFile').mockResolvedValue(true);
      
      // Mock successful API call
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });
      
      // Trigger sync
      await pwaManager.syncOPFSData();
      
      expect(opfsManager.getFile).toHaveBeenCalledWith('_sync/pending.json');
      expect(global.fetch).toHaveBeenCalledWith('/api/sync/upload', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: 'expenses/2024.json',
          data: { expenses: [{ id: 1, amount: 100 }] }
        })
      }));
      expect(opfsManager.deleteFile).toHaveBeenCalledWith('_sync/pending.json');
    });

    it('should handle failed sync and re-queue items', async () => {
      await opfsManager.initialize();
      await pwaManager.initialize(opfsManager);
      
      const syncItem = {
        type: 'data',
        path: 'failed-item.json',
        action: 'upload',
        data: { test: 'data' }
      };
      
      // Mock failed API call
      global.fetch.mockResolvedValue({
        ok: false,
        statusText: 'Server Error'
      });
      
      const addToPendingSyncSpy = jest.spyOn(pwaManager, 'addToPendingSync').mockResolvedValue();
      
      // Try to sync item
      await pwaManager.syncDataItem(syncItem);
      
      expect(addToPendingSyncSpy).toHaveBeenCalledWith(syncItem);
    });

    it('should integrate cache manager with PWA offline capabilities', async () => {
      await cacheManager.initialize();
      await pwaManager.initialize(cacheManager.opfsManager);
      
      // Test data caching
      const testData = { visualization: 'network-data', nodes: 100 };
      const cacheKey = 'network-visualization-cache';
      
      // Store in cache
      const setResult = await cacheManager.set(cacheKey, testData, {
        ttl: 3600000,
        tags: ['visualization', 'network']
      });
      expect(setResult).toBe(true);
      
      // Simulate offline scenario
      Object.defineProperty(global.navigator, 'onLine', { value: false, writable: true, configurable: true });
      
      // Retrieve from cache while offline
      const cachedData = await cacheManager.get(cacheKey);
      expect(cachedData).toBeTruthy();
      
      // Verify cache statistics
      const stats = cacheManager.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.sets).toBe(1);
    });
  });

  describe('Connection Status Management', () => {
    it('should handle online/offline transitions', async () => {
      await pwaManager.initialize(opfsManager);
      
      const updateConnectionStatusSpy = jest.spyOn(pwaManager, 'updateConnectionStatus');
      const triggerBackgroundSyncSpy = jest.spyOn(pwaManager, 'triggerBackgroundSync').mockResolvedValue();
      
      // Simulate going offline
      Object.defineProperty(global.navigator, 'onLine', { value: false, writable: true, configurable: true });
      const offlineHandler = window.addEventListener.mock.calls.find(call => call[0] === 'offline')[1];
      offlineHandler();
      
      expect(pwaManager.isOnline).toBe(false);
      expect(updateConnectionStatusSpy).toHaveBeenCalledWith(false);
      
      // Simulate coming back online
      Object.defineProperty(global.navigator, 'onLine', { value: true, writable: true, configurable: true });
      const onlineHandler = window.addEventListener.mock.calls.find(call => call[0] === 'online')[1];
      onlineHandler();
      
      expect(pwaManager.isOnline).toBe(true);
      expect(updateConnectionStatusSpy).toHaveBeenCalledWith(true);
      expect(triggerBackgroundSyncSpy).toHaveBeenCalled();
    });

    it('should update UI elements based on connection status', () => {
      const statusElement = { textContent: '', className: '' };
      const offlineIndicator = { style: { display: '' } };
      
      document.getElementById.mockReturnValue(statusElement);
      document.querySelectorAll.mockReturnValue([offlineIndicator]);
      
      // Test online status
      pwaManager.updateConnectionStatus(true);
      expect(statusElement.textContent).toBe('Online');
      expect(statusElement.className).toBe('text-green-600 dark:text-green-400');
      expect(offlineIndicator.style.display).toBe('none');
      
      // Test offline status
      pwaManager.updateConnectionStatus(false);
      expect(statusElement.textContent).toBe('Offline');
      expect(statusElement.className).toBe('text-red-600 dark:text-red-400');
      expect(offlineIndicator.style.display).toBe('block');
    });
  });

  describe('Install Prompt Management', () => {
    it('should handle install prompt lifecycle', async () => {
      await pwaManager.initialize(opfsManager);
      
      // Mock install prompt event
      const mockInstallEvent = {
        preventDefault: jest.fn(),
        prompt: jest.fn().mockResolvedValue({ outcome: 'accepted' })
      };
      
      const showInstallPromptSpy = jest.spyOn(pwaManager, 'showInstallPrompt').mockImplementation(() => {});
      
      // Trigger beforeinstallprompt
      const beforeInstallHandler = window.addEventListener.mock.calls
        .find(call => call[0] === 'beforeinstallprompt')[1];
      beforeInstallHandler(mockInstallEvent);
      
      expect(mockInstallEvent.preventDefault).toHaveBeenCalled();
      expect(pwaManager.installPrompt).toBe(mockInstallEvent);
      expect(showInstallPromptSpy).toHaveBeenCalled();
      
      // Test install flow
      await pwaManager.installApp();
      
      expect(mockInstallEvent.prompt).toHaveBeenCalled();
      expect(pwaManager.installPrompt).toBeNull();
    });

    it('should handle app installation completion', () => {
      pwaManager.installPrompt = { prompt: jest.fn() };
      const hideInstallPromptSpy = jest.spyOn(pwaManager, 'hideInstallPrompt').mockImplementation(() => {});
      
      // Trigger appinstalled
      const appInstalledHandler = window.addEventListener.mock.calls
        .find(call => call[0] === 'appinstalled')[1];
      appInstalledHandler();
      
      expect(pwaManager.installPrompt).toBeNull();
      expect(hideInstallPromptSpy).toHaveBeenCalled();
    });
  });

  describe('Service Worker Communication', () => {
    it('should setup message channel for OPFS operations', async () => {
      await pwaManager.initialize(opfsManager);
      
      expect(global.MessageChannel).toHaveBeenCalled();
      expect(navigator.serviceWorker.controller.postMessage).toHaveBeenCalledWith(
        { type: 'SETUP_PORT' },
        expect.any(Array)
      );
    });

    it('should handle service worker messages', () => {
      const mockMessage = {
        type: 'CACHE_UPDATED',
        data: { cacheKey: 'test-cache', size: 1024 }
      };
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      pwaManager.handleServiceWorkerMessage(mockMessage);
      
      expect(consoleSpy).toHaveBeenCalledWith('[PWA] Cache updated:', mockMessage.data);
      
      consoleSpy.mockRestore();
    });

    it('should handle background sync messages', async () => {
      const mockMessage = {
        type: 'BACKGROUND_SYNC',
        data: { syncId: 'test-sync' }
      };
      
      pwaManager.isOnline = true;
      pwaManager.opfsManager = opfsManager;
      
      const syncOPFSDataSpy = jest.spyOn(pwaManager, 'syncOPFSData').mockResolvedValue();
      
      await pwaManager.handleServiceWorkerMessage(mockMessage);
      
      expect(syncOPFSDataSpy).toHaveBeenCalled();
    });
  });

  describe('Cache Management Integration', () => {
    it('should clear cache through service worker', async () => {
      await pwaManager.initialize(opfsManager);
      
      const mockResponse = { success: true };
      const sendToServiceWorkerSpy = jest.spyOn(pwaManager, 'sendToServiceWorker')
        .mockResolvedValue(mockResponse);
      
      const result = await pwaManager.clearCache('data');
      
      expect(sendToServiceWorkerSpy).toHaveBeenCalledWith('CACHE_CLEAR', { cacheType: 'data' });
      expect(result).toBe(true);
    });

    it('should handle app updates', async () => {
      const mockWaitingSW = { postMessage: jest.fn() };
      const mockRegistration = { waiting: mockWaitingSW };
      
      navigator.serviceWorker.getRegistration.mockResolvedValue(mockRegistration);
      pwaManager.serviceWorker = { scope: 'test' };
      
      await pwaManager.updateApp();
      
      expect(mockWaitingSW.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    });
  });

  describe('Installation Status', () => {
    it('should provide comprehensive installation status', () => {
      pwaManager.installPrompt = { prompt: jest.fn() };
      pwaManager.serviceWorker = { scope: 'test' };
      pwaManager.isOnline = true;
      
      window.matchMedia.mockReturnValue({ matches: true });
      
      const status = pwaManager.getInstallationStatus();
      
      expect(status).toEqual({
        isInstallable: true,
        isInstalled: true,
        isOnline: true,
        hasServiceWorker: true
      });
    });
  });

  describe('Connection Status Indicator', () => {
    it('should create connection status indicator with correct initial state', () => {
      const indicator = createConnectionStatusIndicator();
      
      expect(document.createElement).toHaveBeenCalledWith('div');
      expect(indicator.id).toBe('connection-status-indicator');
      expect(indicator.className).toContain('fixed bottom-4 right-4');
      
      // Should be hidden when online
      expect(indicator.style.display).toBe('none');
    });

    it('should show indicator when offline', () => {
      Object.defineProperty(global.navigator, 'onLine', { value: false, writable: true, configurable: true });
      
      const indicator = createConnectionStatusIndicator();
      
      expect(indicator.style.display).not.toBe('none');
    });
  });

  describe('Error Handling', () => {
    it('should handle OPFS initialization failure gracefully', async () => {
      navigator.storage.getDirectory.mockRejectedValue(new Error('OPFS not supported'));
      
      const opfsResult = await opfsManager.initialize();
      expect(opfsResult).toBe(false);
      
      const pwaResult = await pwaManager.initialize(opfsManager);
      expect(pwaResult).toBe(true); // PWA should still work without OPFS
    });

    it('should handle service worker registration failure', async () => {
      navigator.serviceWorker.register.mockRejectedValue(new Error('SW registration failed'));
      
      const result = await pwaManager.initialize(opfsManager);
      
      expect(result).toBe(false);
      expect(pwaManager.serviceWorker).toBeNull();
    });

    it('should handle network errors during sync', async () => {
      await pwaManager.initialize(opfsManager);
      
      const syncItem = {
        type: 'data',
        path: 'network-error.json',
        action: 'upload',
        data: { test: 'data' }
      };
      
      // Mock network error
      global.fetch.mockRejectedValue(new Error('Network error'));
      
      const addToPendingSyncSpy = jest.spyOn(pwaManager, 'addToPendingSync').mockResolvedValue();
      
      await pwaManager.syncDataItem(syncItem);
      
      expect(addToPendingSyncSpy).toHaveBeenCalledWith(syncItem);
    });
  });
});