// Viso PWA Service Worker with OPFS Integration
const CACHE_NAME = 'viso-pwa-v1.0.0';
const STATIC_CACHE = `${CACHE_NAME}-static`;
const DATA_CACHE = `${CACHE_NAME}-data`;

// Static assets to cache
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/db.html',
  '/manifest.json',
  '/src/core.js',
  '/src/ui.js',
  '/src/utils.js',
  '/src/apps/network-app.js',
  '/src/apps/db-app.js',
  '/src/shared/enhanced-storage.js',
  '/src/shared/enhanced-core.js',
  '/src/shared/enhanced-clients.js',
  '/src/shared/enhanced-ui.js',
  '/src/shared/api-utils.js',
  '/src/shared/dom-utils.js',
  '/src/shared/state-manager.js',
  '/src/shared/ui-utils.js',
  '/src/shared/data-utils.js',
  '/src/shared/color-utils.js',
  '/src/shared/formatters.js',
  '/src/shared/app-config.js',
  '/src/shared/error-handler.js',
  '/src/styles/common.css',
  '/src/styles/index.css',
  '/src/styles/db.css',
  '/src/features/visualization/sankey-tab.js',
  '/src/utils/query-builder.js',
  '/src/utils/query-utils.js',
  '/src/db/editor-manager.js',
  '/src/db/query-executor.js',
  '/src/index/connection-monitor.js',
  '/src/index/node-details.js'
];

// External resources to cache
const EXTERNAL_ASSETS = [
  'https://cdn.tailwindcss.com/tailwindcss.js',
  'https://d3js.org/d3.v7.min.js',
  'https://fonts.googleapis.com/css2?family=Monda:wght@400;700&display=swap'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(STATIC_CACHE).then(async (cache) => {
        console.log('[SW] Caching static assets...');
        
        // Cache static assets individually to handle failures gracefully
        const staticPromises = STATIC_ASSETS.map(async (asset) => {
          try {
            await cache.add(asset);
            console.log('[SW] Cached:', asset);
          } catch (error) {
            console.warn('[SW] Failed to cache static asset:', asset, error);
          }
        });
        
        // Cache external assets individually
        const externalPromises = EXTERNAL_ASSETS.map(async (asset) => {
          try {
            await cache.add(asset);
            console.log('[SW] Cached external:', asset);
          } catch (error) {
            console.warn('[SW] Failed to cache external asset:', asset, error);
          }
        });
        
        await Promise.allSettled([...staticPromises, ...externalPromises]);
      }),
      
      // Initialize OPFS if available
      initializeOPFS()
    ]).then(() => {
      console.log('[SW] Service worker installed successfully');
      return self.skipWaiting();
    })
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== DATA_CACHE) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      
      // Take control of all pages
      self.clients.claim()
    ]).then(() => {
      console.log('[SW] Service worker activated successfully');
    })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') return;
  
  // Handle different types of requests
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
  } else if (isAPIRequest(url)) {
    event.respondWith(networkFirstWithOPFS(request));
  } else if (isExternalAsset(url)) {
    event.respondWith(staleWhileRevalidate(request));
  } else {
    event.respondWith(networkFirst(request));
  }
});

// Message handling for OPFS operations
self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'OPFS_STORE':
      handleOPFSStore(event, data);
      break;
    case 'OPFS_GET':
      handleOPFSGet(event, data);
      break;
    case 'OPFS_DELETE':
      handleOPFSDelete(event, data);
      break;
    case 'CACHE_CLEAR':
      handleCacheClear(event, data);
      break;
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
    default:
      console.log('[SW] Unknown message type:', type);
  }
});

// OPFS Integration
let opfsAvailable = false;
let opfsRoot = null;

async function initializeOPFS() {
  try {
    if ('storage' in navigator && 'getDirectory' in navigator.storage) {
      opfsRoot = await navigator.storage.getDirectory();
      opfsAvailable = true;
      console.log('[SW] OPFS initialized successfully');
    } else {
      console.log('[SW] OPFS not available');
    }
  } catch (error) {
    console.warn('[SW] OPFS initialization failed:', error);
    opfsAvailable = false;
  }
}

// Caching strategies
async function cacheFirst(request) {
  try {
    const cache = await caches.open(STATIC_CACHE);
    const cached = await cache.match(request);
    
    if (cached) {
      return cached;
    }
    
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error('[SW] Cache first failed:', error);
    return new Response('Offline - Resource not available', { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      const cache = await caches.open(DATA_CACHE);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    const cache = await caches.open(DATA_CACHE);
    const cached = await cache.match(request);
    
    if (cached) {
      return cached;
    }
    
    return new Response('Offline - No cached version available', { status: 503 });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => cached);
  
  return cached || fetchPromise;
}

async function networkFirstWithOPFS(request) {
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      // Store in both cache and OPFS
      const cache = await caches.open(DATA_CACHE);
      cache.put(request, response.clone());
      
      if (opfsAvailable) {
        await storeInOPFS(request.url, await response.clone().arrayBuffer());
      }
    }
    
    return response;
  } catch (error) {
    // Try OPFS first, then cache
    if (opfsAvailable) {
      const opfsData = await getFromOPFS(request.url);
      if (opfsData) {
        return new Response(opfsData, {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    const cache = await caches.open(DATA_CACHE);
    const cached = await cache.match(request);
    
    if (cached) {
      return cached;
    }
    
    return new Response('Offline - No data available', { status: 503 });
  }
}

// OPFS helper functions
async function storeInOPFS(url, data) {
  if (!opfsAvailable) return false;
  
  try {
    const fileName = `api_${btoa(url).replace(/[/+=]/g, '_')}.dat`;
    const fileHandle = await opfsRoot.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(data);
    await writable.close();
    return true;
  } catch (error) {
    console.warn('[SW] OPFS store failed:', error);
    return false;
  }
}

async function getFromOPFS(url) {
  if (!opfsAvailable) return null;
  
  try {
    const fileName = `api_${btoa(url).replace(/[/+=]/g, '_')}.dat`;
    const fileHandle = await opfsRoot.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    return await file.arrayBuffer();
  } catch (error) {
    return null;
  }
}

async function deleteFromOPFS(url) {
  if (!opfsAvailable) return false;
  
  try {
    const fileName = `api_${btoa(url).replace(/[/+=]/g, '_')}.dat`;
    await opfsRoot.removeEntry(fileName);
    return true;
  } catch (error) {
    return false;
  }
}

// Message handlers
async function handleOPFSStore(event, data) {
  const { path, content } = data;
  const success = await storeInOPFS(path, content);
  event.ports[0].postMessage({ success });
}

async function handleOPFSGet(event, data) {
  const { path } = data;
  const content = await getFromOPFS(path);
  event.ports[0].postMessage({ content });
}

async function handleOPFSDelete(event, data) {
  const { path } = data;
  const success = await deleteFromOPFS(path);
  event.ports[0].postMessage({ success });
}

async function handleCacheClear(event, data) {
  const { cacheType } = data;
  
  try {
    if (cacheType === 'all' || cacheType === 'static') {
      await caches.delete(STATIC_CACHE);
    }
    if (cacheType === 'all' || cacheType === 'data') {
      await caches.delete(DATA_CACHE);
    }
    event.ports[0].postMessage({ success: true });
  } catch (error) {
    event.ports[0].postMessage({ success: false, error: error.message });
  }
}

// Helper functions
function isStaticAsset(url) {
  return STATIC_ASSETS.some(asset => url.pathname === asset) ||
         url.pathname.endsWith('.css') ||
         url.pathname.endsWith('.js') ||
         url.pathname.endsWith('.png') ||
         url.pathname.endsWith('.jpg') ||
         url.pathname.endsWith('.svg') ||
         url.pathname.endsWith('.ico');
}

function isAPIRequest(url) {
  return url.pathname.includes('/api/') ||
         url.pathname.includes('/data/') ||
         url.searchParams.has('query');
}

function isExternalAsset(url) {
  return EXTERNAL_ASSETS.some(asset => url.href.startsWith(asset.split('?')[0])) ||
         url.hostname === 'fonts.googleapis.com' ||
         url.hostname === 'cdn.tailwindcss.com' ||
         url.hostname === 'd3js.org';
}

// Background sync for data synchronization
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(performBackgroundSync());
  }
});

async function performBackgroundSync() {
  console.log('[SW] Performing background sync...');
  
  try {
    // Sync OPFS data with server if online
    if (navigator.onLine && opfsAvailable) {
      // Implementation would depend on your specific sync requirements
      console.log('[SW] Background sync completed');
    }
  } catch (error) {
    console.warn('[SW] Background sync failed:', error);
  }
}

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'content-sync') {
    event.waitUntil(performPeriodicSync());
  }
});

async function performPeriodicSync() {
  console.log('[SW] Performing periodic sync...');
  // Implement periodic data synchronization
}