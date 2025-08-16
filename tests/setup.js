// Global test setup
require('jest-environment-jsdom');

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
global.TextEncoder = jest.fn(() => ({
  encode: jest.fn((str) => new Uint8Array(str.split('').map(c => c.charCodeAt(0))))
}));

global.TextDecoder = jest.fn(() => ({
  decode: jest.fn((data) => String.fromCharCode(...data))
}));

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

// Setup DOM elements that are expected to exist
beforeEach(() => {
  document.body.innerHTML = '';
  
  // Clear all mocks
  jest.clearAllMocks();
});

afterEach(() => {
  // Clean up DOM
  document.body.innerHTML = '';
});