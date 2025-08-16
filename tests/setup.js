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