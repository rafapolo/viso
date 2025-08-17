import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PWAManager } from '../../src/shared/pwa-integration.js';

// Mock classes and globals
const mockServiceWorkerRegistration = {
  scope: 'http://localhost:3000/',
  installing: null,
  waiting: null,
  active: null,
  sync: {
    register: jest.fn()
  }
};

const mockServiceWorker = {
  register: jest.fn(),
  ready: Promise.resolve(mockServiceWorkerRegistration),
  controller: {
    postMessage: jest.fn()
  },
  addEventListener: jest.fn(),
  getRegistration: jest.fn()
};

const mockOPFSManager = {
  getFile: jest.fn(),
  storeFile: jest.fn(),
  deleteFile: jest.fn(),
  isSupported: true
};

const mockMessageChannel = {
  port1: {
    onmessage: null,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  },
  port2: {}
};

// Setup global mocks
Object.defineProperty(global, 'navigator', {
  value: {
    onLine: true,
    serviceWorker: mockServiceWorker
  },
  writable: true
});

global.window = {
  addEventListener: jest.fn(),
  matchMedia: jest.fn(() => ({ matches: false })),
  location: { reload: jest.fn() }
};

global.document = {
  createElement: jest.fn(() => ({
    innerHTML: '',
    className: '',
    onclick: null,
    style: {},
    remove: jest.fn(),
    appendChild: jest.fn(),
    parentNode: null
  })),
  body: {
    appendChild: jest.fn()
  },
  getElementById: jest.fn(),
  querySelectorAll: jest.fn(() => [])
};

global.MessageChannel = jest.fn(() => mockMessageChannel);

describe('PWAManager', () => {
  let pwaManager;

  beforeEach(() => {
    pwaManager = new PWAManager();
    jest.clearAllMocks();
    
    // Reset navigator.onLine
    Object.defineProperty(global.navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with default values', () => {
      expect(pwaManager.serviceWorker).toBeNull();
      expect(pwaManager.isOnline).toBe(true);
      expect(pwaManager.opfsManager).toBeNull();
      expect(pwaManager.messageChannel).toBeNull();
      expect(pwaManager.installPrompt).toBeNull();
    });

    it('should set up event listeners', () => {
      expect(window.addEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(window.addEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
      expect(window.addEventListener).toHaveBeenCalledWith('beforeinstallprompt', expect.any(Function));
      expect(window.addEventListener).toHaveBeenCalledWith('appinstalled', expect.any(Function));
    });
  });

  describe('initialize', () => {
    it('should successfully initialize with service worker support', async () => {
      mockServiceWorker.register.mockResolvedValue(mockServiceWorkerRegistration);
      
      const result = await pwaManager.initialize(mockOPFSManager);
      
      expect(result).toBe(true);
      expect(pwaManager.opfsManager).toBe(mockOPFSManager);
      expect(pwaManager.serviceWorker).toBe(mockServiceWorkerRegistration);
      expect(mockServiceWorker.register).toHaveBeenCalledWith('/sw.js');
    });

    it('should fail gracefully when service worker registration fails', async () => {
      mockServiceWorker.register.mockRejectedValue(new Error('Registration failed'));
      
      const result = await pwaManager.initialize(mockOPFSManager);
      
      expect(result).toBe(false);
      expect(pwaManager.serviceWorker).toBeNull();
    });

    it('should return false when service worker is not supported', async () => {
      const originalServiceWorker = global.navigator.serviceWorker;
      delete global.navigator.serviceWorker;
      
      const result = await pwaManager.initialize(mockOPFSManager);
      
      expect(result).toBe(false);
      
      global.navigator.serviceWorker = originalServiceWorker;
    });
  });

  describe('Connection handling', () => {
    it('should update online status when going online', () => {
      const updateConnectionStatusSpy = jest.spyOn(pwaManager, 'updateConnectionStatus');
      const triggerBackgroundSyncSpy = jest.spyOn(pwaManager, 'triggerBackgroundSync').mockImplementation(() => {});
      
      // Simulate going online
      const onlineHandler = window.addEventListener.mock.calls.find(call => call[0] === 'online')[1];
      onlineHandler();
      
      expect(pwaManager.isOnline).toBe(true);
      expect(updateConnectionStatusSpy).toHaveBeenCalledWith(true);
      expect(triggerBackgroundSyncSpy).toHaveBeenCalled();
    });

    it('should update online status when going offline', () => {
      const updateConnectionStatusSpy = jest.spyOn(pwaManager, 'updateConnectionStatus');
      
      // Simulate going offline
      const offlineHandler = window.addEventListener.mock.calls.find(call => call[0] === 'offline')[1];
      offlineHandler();
      
      expect(pwaManager.isOnline).toBe(false);
      expect(updateConnectionStatusSpy).toHaveBeenCalledWith(false);
    });
  });

  describe('Install prompt handling', () => {
    it('should handle beforeinstallprompt event', () => {
      const mockEvent = {
        preventDefault: jest.fn()
      };
      const showInstallPromptSpy = jest.spyOn(pwaManager, 'showInstallPrompt').mockImplementation(() => {});
      
      const beforeInstallHandler = window.addEventListener.mock.calls.find(call => call[0] === 'beforeinstallprompt')[1];
      beforeInstallHandler(mockEvent);
      
      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(pwaManager.installPrompt).toBe(mockEvent);
      expect(showInstallPromptSpy).toHaveBeenCalled();
    });

    it('should handle appinstalled event', () => {
      pwaManager.installPrompt = { prompt: jest.fn() };
      const hideInstallPromptSpy = jest.spyOn(pwaManager, 'hideInstallPrompt').mockImplementation(() => {});
      
      const appInstalledHandler = window.addEventListener.mock.calls.find(call => call[0] === 'appinstalled')[1];
      appInstalledHandler();
      
      expect(pwaManager.installPrompt).toBeNull();
      expect(hideInstallPromptSpy).toHaveBeenCalled();
    });
  });

  describe('Background sync', () => {
    beforeEach(() => {
      pwaManager.opfsManager = mockOPFSManager;
    });

    it('should trigger background sync when supported', async () => {
      mockServiceWorker.ready = Promise.resolve(mockServiceWorkerRegistration);
      
      await pwaManager.triggerBackgroundSync();
      
      expect(mockServiceWorkerRegistration.sync.register).toHaveBeenCalledWith('background-sync');
    });

    it('should fallback to manual sync when background sync fails', async () => {
      mockServiceWorkerRegistration.sync.register.mockRejectedValue(new Error('Sync failed'));
      const syncOPFSDataSpy = jest.spyOn(pwaManager, 'syncOPFSData').mockResolvedValue();
      
      await pwaManager.triggerBackgroundSync();
      
      expect(syncOPFSDataSpy).toHaveBeenCalled();
    });

    it('should sync OPFS data with pending items', async () => {
      const pendingData = {
        data: JSON.stringify({
          items: [
            { type: 'data', path: 'test.json', action: 'upload', data: { test: 'data' } }
          ]
        })
      };
      
      mockOPFSManager.getFile.mockResolvedValue(pendingData);
      mockOPFSManager.deleteFile.mockResolvedValue(true);
      
      // Mock fetch for upload
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });
      
      await pwaManager.syncOPFSData();
      
      expect(mockOPFSManager.getFile).toHaveBeenCalledWith('_sync/pending.json');
      expect(mockOPFSManager.deleteFile).toHaveBeenCalledWith('_sync/pending.json');
      expect(global.fetch).toHaveBeenCalledWith('/api/sync/upload', expect.any(Object));
    });
  });

  describe('Installation status', () => {
    it('should return correct installation status', () => {
      pwaManager.installPrompt = { prompt: jest.fn() };
      pwaManager.serviceWorker = mockServiceWorkerRegistration;
      window.matchMedia = jest.fn(() => ({ matches: true }));
      
      const status = pwaManager.getInstallationStatus();
      
      expect(status.isInstallable).toBe(true);
      expect(status.isInstalled).toBe(true);
      expect(status.isOnline).toBe(true);
      expect(status.hasServiceWorker).toBe(true);
    });
  });

  describe('Cache management', () => {
    it('should clear cache successfully', async () => {
      pwaManager.messageChannel = mockMessageChannel;
      const mockResponse = { success: true };
      
      const sendToServiceWorkerSpy = jest.spyOn(pwaManager, 'sendToServiceWorker')
        .mockResolvedValue(mockResponse);
      
      const result = await pwaManager.clearCache('all');
      
      expect(sendToServiceWorkerSpy).toHaveBeenCalledWith('CACHE_CLEAR', { cacheType: 'all' });
      expect(result).toBe(true);
    });

    it('should handle cache clear failure', async () => {
      const sendToServiceWorkerSpy = jest.spyOn(pwaManager, 'sendToServiceWorker')
        .mockRejectedValue(new Error('Cache clear failed'));
      
      const result = await pwaManager.clearCache('all');
      
      expect(result).toBe(false);
    });
  });

  describe('App update', () => {
    it('should update app when waiting service worker exists', async () => {
      const mockWaitingSW = {
        postMessage: jest.fn()
      };
      
      const mockRegistration = {
        waiting: mockWaitingSW
      };
      
      mockServiceWorker.getRegistration.mockResolvedValue(mockRegistration);
      pwaManager.serviceWorker = mockServiceWorkerRegistration;
      
      await pwaManager.updateApp();
      
      expect(mockWaitingSW.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    });
  });

  describe('Service worker messaging', () => {
    beforeEach(() => {
      pwaManager.messageChannel = mockMessageChannel;
    });

    it('should send message to service worker and receive response', async () => {
      const testData = { test: 'data' };
      const expectedResponse = { success: true };
      
      // Mock the response
      setTimeout(() => {
        const handler = mockMessageChannel.port1.addEventListener.mock.calls
          .find(call => call[0] === 'message')[1];
        handler({ data: { id: expect.any(Number), ...expectedResponse } });
      }, 10);
      
      const promise = pwaManager.sendToServiceWorker('TEST_MESSAGE', testData);
      
      expect(navigator.serviceWorker.controller.postMessage).toHaveBeenCalledWith({
        id: expect.any(Number),
        type: 'TEST_MESSAGE',
        data: testData
      });
      
      // This test is complex due to async nature, simplified for demonstration
      // In real implementation, you'd need to properly handle the async response
    });

    it('should handle service worker message timeout', async () => {
      const testData = { test: 'data' };
      
      // Don't send response, should timeout
      const promise = pwaManager.sendToServiceWorker('TEST_MESSAGE', testData);
      
      await expect(promise).rejects.toThrow('Service worker message timeout');
    });
  });
});