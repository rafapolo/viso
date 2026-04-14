// Test utilities for common testing patterns
import { jest } from '@jest/globals';

/**
 * Creates a mock DuckDB manager with common methods
 */
export function createMockDuckDBManager() {
  return {
    query: jest.fn(),
    getConnection: jest.fn(),
    isConnected: jest.fn(() => true),
    connect: jest.fn(() => Promise.resolve()),
    disconnect: jest.fn(() => Promise.resolve()),
    getConnectionStatus: jest.fn(() => 'connected'),
  };
}

interface MockElement {
  tagName: string;
  innerHTML: string;
  textContent: string;
  style: Record<string, unknown>;
  classList: {
    add: jest.Mock;
    remove: jest.Mock;
    contains: jest.Mock;
    toggle: jest.Mock;
  };
  addEventListener: jest.Mock;
  removeEventListener: jest.Mock;
  setAttribute: jest.Mock;
  getAttribute: jest.Mock;
  querySelector: jest.Mock;
  querySelectorAll: jest.Mock;
  appendChild: jest.Mock;
  removeChild: jest.Mock;
}

/**
 * Creates a mock DOM element with common methods
 */
export function createMockElement(tagName = 'div'): MockElement {
  return {
    tagName: tagName.toUpperCase(),
    innerHTML: '',
    textContent: '',
    style: {},
    classList: {
      add: jest.fn(),
      remove: jest.fn(),
      contains: jest.fn(() => false),
      toggle: jest.fn(),
    },
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    setAttribute: jest.fn(),
    getAttribute: jest.fn(() => null),
    querySelector: jest.fn(() => null),
    querySelectorAll: jest.fn(() => []),
    appendChild: jest.fn(),
    removeChild: jest.fn(),
  };
}

/**
 * Mock factory for creating consistent test data
 */
export const TestDataFactory = {
  createExpenseData: (overrides: Record<string, unknown> = {}) => ({
    nome_parlamentar: 'João Silva',
    fornecedor: 'Empresa Teste LTDA',
    categoria_despesa: 'COMBUSTÍVEL',
    valor_liquido: 1000.00,
    data_emissao: '2023-01-15',
    ...overrides,
  }),

  createNetworkNode: (overrides: Record<string, unknown> = {}) => ({
    id: 'node_1',
    name: 'Test Node',
    type: 'deputy',
    value: 1000,
    ...overrides,
  }),

  createNetworkLink: (overrides: Record<string, unknown> = {}) => ({
    source: 'deputy_1',
    target: 'supplier_1',
    value: 500,
    category: 'COMBUSTÍVEL',
    ...overrides,
  }),
};

/**
 * Helper to wait for async operations in tests
 */
export function waitFor(ms = 0): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Helper to flush all promises
 */
export function flushPromises(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve));
}

/**
 * Creates a spy on console methods for testing
 */
export function spyOnConsole() {
  const consoleSpy = {
    log: jest.spyOn(console, 'log').mockImplementation(() => {}),
    warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
    error: jest.spyOn(console, 'error').mockImplementation(() => {}),
    restore: () => {
      consoleSpy.log.mockRestore();
      consoleSpy.warn.mockRestore();
      consoleSpy.error.mockRestore();
    },
  };
  return consoleSpy;
}

/**
 * Mock fetch responses helper
 */
export function mockFetchResponse(data: unknown, status = 200): void {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn(() => Promise.resolve(data)),
    text: jest.fn(() => Promise.resolve(JSON.stringify(data))),
  });
}

/**
 * Helper to mock module implementations
 */
export function mockModule(modulePath: string, implementation: Record<string, unknown>): Promise<unknown> {
  return jest.unstable_mockModule(modulePath, () => implementation);
}
