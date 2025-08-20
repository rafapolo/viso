// Basic Service Worker for Viso
const CACHE_NAME = 'viso-cache-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/db.html',
  '/manifest.json',
  '/src/styles/common.css',
  '/src/styles/index.css',
  '/vendor/css/google-fonts.css',
  '/vendor/js/d3.v7.min.js',
  '/vendor/js/d3-sankey.min.js'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('SW: Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.log('SW: Cache installation failed:', error);
      })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('SW: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version if available
        if (response) {
          return response;
        }
        
        // Otherwise fetch from network
        return fetch(event.request);
      })
      .catch((error) => {
        console.log('SW: Fetch failed:', error);
        // Return a basic offline page for navigation requests
        if (event.request.mode === 'navigate') {
          return new Response(
            '<!DOCTYPE html><html><head><title>Offline</title></head><body><h1>App is offline</h1><p>Please check your connection.</p></body></html>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        }
        // For non-navigation requests, return a basic response
        return new Response('', { status: 404, statusText: 'Not Found' });
      })
  );
});