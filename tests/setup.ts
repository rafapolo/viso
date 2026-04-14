// Global test setup
// jest-environment-jsdom is configured in jest.config.js

import { jest } from '@jest/globals';

// Mock fetch for testing
(global as unknown as Record<string, unknown>).fetch = jest.fn();

// Mock performance API
(global as unknown as Record<string, unknown>).performance = {
  now: jest.fn(() => Date.now()),
};

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn() as unknown as typeof console.log,
  warn: jest.fn() as unknown as typeof console.warn,
  error: jest.fn() as unknown as typeof console.error,
};

// Mock HTMLCanvasElement first
if (!global.HTMLCanvasElement) {
  (global as unknown as Record<string, unknown>).HTMLCanvasElement = class HTMLCanvasElement extends HTMLElement {
    width = 300;
    height = 150;
  };
}

// Mock canvas for D3.js tests
HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
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
  measureText: jest.fn(() => ({ width: 0 })),
})) as unknown as typeof HTMLCanvasElement.prototype.getContext;

// Mock requestAnimationFrame
(global as unknown as Record<string, unknown>).requestAnimationFrame = jest.fn((cb: FrameRequestCallback) => setTimeout(cb, 16));
(global as unknown as Record<string, unknown>).cancelAnimationFrame = jest.fn();

// Mock URL API
(global as unknown as Record<string, unknown>).URL = {
  createObjectURL: jest.fn(() => 'mock-blob-url'),
  revokeObjectURL: jest.fn(),
};

// Mock OPFS APIs
(global as unknown as Record<string, unknown>).navigator = {
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
          lastModified: Date.now(),
        })),
        createWritable: jest.fn(() => Promise.resolve({
          write: jest.fn(),
          close: jest.fn(),
        })),
      })),
      removeEntry: jest.fn(() => Promise.resolve()),
      entries: jest.fn(() => ({
        async *[Symbol.asyncIterator]() {
          // Empty iterator
        },
      })),
    })),
  },
};

// Mock Compression APIs
(global as unknown as Record<string, unknown>).CompressionStream = jest.fn();
(global as unknown as Record<string, unknown>).DecompressionStream = jest.fn();

// Mock crypto for hashing — returns a deterministic varying buffer based on input
Object.assign(global.crypto, {
  subtle: {
    digest: jest.fn((_algorithm: string, data: ArrayBuffer | ArrayBufferView) => {
      const view = new Uint8Array(data instanceof ArrayBuffer ? data : data.buffer);
      const result = new Uint8Array(32);
      for (let i = 0; i < view.length; i++) {
        result[i % 32] ^= view[i];
      }
      return Promise.resolve(result.buffer);
    }),
  },
});

// Mock TextEncoder/TextDecoder
(global as unknown as Record<string, unknown>).TextEncoder = class {
  encode(str: string): Uint8Array {
    return new Uint8Array(str.split('').map(c => c.charCodeAt(0)));
  }
};

(global as unknown as Record<string, unknown>).TextDecoder = class {
  decode(data: { [Symbol.iterator](): Iterator<number> }): string {
    return String.fromCharCode(...data);
  }
};

// Mock Worker for web workers
(global as unknown as Record<string, unknown>).Worker = jest.fn(() => ({
  postMessage: jest.fn(),
  terminate: jest.fn(),
  onmessage: null,
  onerror: null,
}));

// Mock PerformanceObserver
(global as unknown as Record<string, unknown>).PerformanceObserver = jest.fn(() => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
}));

// Enhanced performance mock
(global as unknown as Record<string, unknown>).performance = {
  now: jest.fn(() => Date.now()),
  memory: {
    usedJSHeapSize: 50 * 1024 * 1024,
    totalJSHeapSize: 100 * 1024 * 1024,
    jsHeapSizeLimit: 1024 * 1024 * 1024,
  },
};

// Mock window event listeners
if (!global.window) {
  (global as unknown as Record<string, unknown>).window = {};
}
(global.window as unknown as Record<string, unknown>).addEventListener = jest.fn();
(global.window as unknown as Record<string, unknown>).removeEventListener = jest.fn();

// Add minimal DOM method mocks for tests that specifically need them
const docAny = global.document as unknown as Record<string, unknown>;
if (!(docAny['getElementById'] as jest.Mock)?.mock) {
  const originalGetElementById = global.document.getElementById.bind(global.document);
  global.document.getElementById = jest.fn((...args: Parameters<typeof document.getElementById>) => originalGetElementById(...args));
}

if (!(docAny['querySelectorAll'] as jest.Mock)?.mock) {
  const originalQuerySelectorAll = global.document.querySelectorAll.bind(global.document);
  global.document.querySelectorAll = jest.fn((...args: Parameters<typeof document.querySelectorAll>) => originalQuerySelectorAll(...args));
}

if (!(docAny['querySelector'] as jest.Mock)?.mock) {
  const originalQuerySelector = global.document.querySelector.bind(global.document);
  global.document.querySelector = jest.fn((...args: Parameters<typeof document.querySelector>) => originalQuerySelector(...args));
}

// Mock ServiceWorkerRegistration
(global as unknown as Record<string, unknown>).ServiceWorkerRegistration = {
  prototype: {
    sync: {
      register: jest.fn(),
    },
  },
};

// Mock navigator.serviceWorker
(global as unknown as Record<string, unknown>).navigator = {
  ...global.navigator,
  serviceWorker: {
    ready: Promise.resolve({
      sync: { register: jest.fn() },
    }),
    controller: {
      postMessage: jest.fn(),
    },
  },
};

// Mock MessageChannel
(global as unknown as Record<string, unknown>).MessageChannel = jest.fn(() => ({
  port1: { onmessage: null, postMessage: jest.fn() },
  port2: { onmessage: null, postMessage: jest.fn() },
}));

// Mock window.matchMedia
(global.window as unknown as Record<string, unknown>).matchMedia = jest.fn();

// Mock document.body properly for JSDOM
if (!global.document.body) {
  global.document.body = global.document.createElement('body');
}

// Global test hooks for proper isolation
beforeEach(() => {
  document.body.innerHTML = '';
  jest.clearAllMocks();
  jest.resetModules();

  (global as unknown as { fetch?: { mockClear?: () => void } }).fetch?.mockClear?.();
  (global.performance.now as unknown as { mockClear?: () => void })?.mockClear?.();

  if (typeof window !== 'undefined') {
    try {
      (window as unknown as Record<string, unknown>).location = { href: 'http://localhost' };
    } catch {
      // Ignore location reset errors in jsdom
    }
  }
});

afterEach(() => {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  jest.clearAllTimers();
  jest.restoreAllMocks();
});
