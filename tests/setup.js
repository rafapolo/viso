// Global test setup
// jest-environment-jsdom is configured in jest.config.js

// Import jest for proper mock setup
import { jest } from '@jest/globals';

// Mock fetch for testing
global.fetch = jest.fn();

// Mock performance API
global.performance = {
  now: jest.fn(() => Date.now())
};

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Mock HTMLCanvasElement first
global.HTMLCanvasElement = global.HTMLCanvasElement || class HTMLCanvasElement extends HTMLElement {
  constructor() {
    super();
    this.width = 300;
    this.height = 150;
  }
};

// Mock canvas for D3.js tests
global.HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
  fillRect: jest.fn(),
  clearRect: jest.fn(),
  getImageData: jest.fn(() => ({ data: new Array(4) })),
  putImageData: jest.fn(),
  createImageData: jest.fn(() => []),
  setTransform: jest.fn(),
  drawImage: jest.fn(),
  save: jest.fn(),
  restore: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  closePath: jest.fn(),
  stroke: jest.fn(),
  fill: jest.fn(),
  arc: jest.fn(),
  fillText: jest.fn(),
  measureText: jest.fn(() => ({ width: 0 }))
}));

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn((cb) => setTimeout(cb, 16));
global.cancelAnimationFrame = jest.fn();

// Mock URL API
global.URL = {
  createObjectURL: jest.fn(() => 'mock-blob-url'),
  revokeObjectURL: jest.fn()
};

// Mock OPFS APIs
global.navigator = {
  ...global.navigator,
  onLine: true,
  storage: {
    getDirectory: jest.fn(() => Promise.resolve({
      getDirectoryHandle: jest.fn(() => Promise.resolve({})),
      getFileHandle: jest.fn(() => Promise.resolve({
        getFile: jest.fn(() => Promise.resolve({
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
          text: () => Promise.resolve(''),
          size: 0,
          lastModified: Date.now()
        })),
        createWritable: jest.fn(() => Promise.resolve({
          write: jest.fn(),
          close: jest.fn()
        }))
      })),
      removeEntry: jest.fn(() => Promise.resolve()),
      entries: jest.fn(() => ({
        async *[Symbol.asyncIterator]() {
          // Empty iterator
        }
      }))
    }))
  }
};

// Mock Compression APIs
global.CompressionStream = jest.fn();
global.DecompressionStream = jest.fn();

// Mock crypto for hashing
global.crypto = {
  ...global.crypto,
  subtle: {
    digest: jest.fn(() => Promise.resolve(new ArrayBuffer(32)))
  }
};

// Mock TextEncoder/TextDecoder
global.TextEncoder = class {
  encode(str) {
    return new Uint8Array(str.split('').map(c => c.charCodeAt(0)));
  }
};

global.TextDecoder = class {
  decode(data) {
    return String.fromCharCode(...data);
  }
};

// Mock Worker for web workers
global.Worker = jest.fn(() => ({
  postMessage: jest.fn(),
  terminate: jest.fn(),
  onmessage: null,
  onerror: null
}));

// Mock PerformanceObserver
global.PerformanceObserver = jest.fn(() => ({
  observe: jest.fn(),
  disconnect: jest.fn()
}));

// Enhanced performance mock
global.performance = {
  ...global.performance,
  now: jest.fn(() => Date.now()),
  memory: {
    usedJSHeapSize: 50 * 1024 * 1024,
    totalJSHeapSize: 100 * 1024 * 1024,
    jsHeapSizeLimit: 1024 * 1024 * 1024
  }
};

// Mock window event listeners
global.window = global.window || {};
global.window.addEventListener = jest.fn();
global.window.removeEventListener = jest.fn();

// Add minimal DOM method mocks for tests that specifically need them
// These are only added if they don't already exist (let JSDOM handle most cases)
if (!global.document.getElementById.mock) {
  const originalGetElementById = global.document.getElementById;
  global.document.getElementById = jest.fn((...args) => originalGetElementById.apply(global.document, args));
}

if (!global.document.querySelectorAll.mock) {
  const originalQuerySelectorAll = global.document.querySelectorAll;
  global.document.querySelectorAll = jest.fn((...args) => originalQuerySelectorAll.apply(global.document, args));
}

if (!global.document.querySelector.mock) {
  const originalQuerySelector = global.document.querySelector;
  global.document.querySelector = jest.fn((...args) => originalQuerySelector.apply(global.document, args));
}

// Mock ServiceWorkerRegistration
global.ServiceWorkerRegistration = {
  prototype: {
    sync: {
      register: jest.fn()
    }
  }
};

// Mock navigator.serviceWorker
global.navigator.serviceWorker = {
  ready: Promise.resolve({
    sync: {
      register: jest.fn()
    }
  }),
  controller: {
    postMessage: jest.fn()
  }
};

// Mock MessageChannel
global.MessageChannel = jest.fn(() => ({
  port1: { onmessage: null, postMessage: jest.fn() },
  port2: { onmessage: null, postMessage: jest.fn() }
}));

// Mock window.matchMedia
global.window.matchMedia = jest.fn();

// Mock document.body properly for JSDOM
if (!global.document.body) {
  global.document.body = global.document.createElement('body');
}

// Global test hooks for proper isolation
beforeEach(() => {
  // Clear DOM
  document.body.innerHTML = '';

  // Reset all mocks and modules for isolation
  jest.clearAllMocks();
  jest.resetModules();

  // Reset global state
  global.fetch?.mockClear?.();
  global.performance.now?.mockClear?.();

  // Reset any global variables that might be set by modules
  if (typeof window !== 'undefined') {
    // Reset any window properties that tests might modify
    try {
      window.location = { href: 'http://localhost' };
    } catch (e) {
      // Ignore location reset errors in jsdom
    }
  }
});

afterEach(() => {
  // Clean up DOM completely
  document.body.innerHTML = '';
  document.head.innerHTML = '';

  // Clear any remaining timers
  jest.clearAllTimers();

  // Reset any modified global objects
  jest.restoreAllMocks();
});
