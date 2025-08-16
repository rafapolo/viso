// DuckDB WASM mock for testing
import { sampleDespesasData, sampleQueryResult, sampleSchema, sampleFilterOptions } from '../fixtures/sample-data.js';

export class MockAsyncDuckDB {
  constructor() {
    this.isInstantiated = false;
    this.isTerminated = false;
  }

  async instantiate() {
    this.isInstantiated = true;
    return Promise.resolve();
  }

  async connect() {
    if (!this.isInstantiated) {
      throw new Error('DuckDB not instantiated');
    }
    return new MockConnection();
  }

  async terminate() {
    this.isTerminated = true;
    return Promise.resolve();
  }
}

export class MockConnection {
  constructor() {
    this.isClosed = false;
    this.registeredFiles = new Map();
  }

  async query(sql) {
    if (this.isClosed) {
      throw new Error('Connection is closed');
    }

    // Simulate different query responses based on SQL content
    if (sql.includes('SELECT 1 as test')) {
      return createMockResult([{ test: 1 }], ['test']);
    }
    
    if (sql.includes('COUNT(*)')) {
      return createMockResult([{ total: sampleDespesasData.length }], ['total']);
    }
    
    if (sql.includes('DESCRIBE despesas')) {
      return createMockResult(sampleSchema, ['column_name', 'column_type', 'null']);
    }
    
    if (sql.includes('DISTINCT sigla_partido')) {
      return createMockResult(
        sampleFilterOptions.parties.map(party => ({ sigla_partido: party })), 
        ['sigla_partido']
      );
    }
    
    if (sql.includes('DISTINCT categoria_despesa')) {
      return createMockResult(
        sampleFilterOptions.categories.map(cat => ({ categoria_despesa: cat })), 
        ['categoria_despesa']
      );
    }

    // Default query result
    return createMockResult(sampleDespesasData, sampleQueryResult.columns);
  }

  async close() {
    this.isClosed = true;
    return Promise.resolve();
  }
}

function createMockResult(data, columns) {
  return {
    toArray: () => data,
    numRows: data.length,
    schema: {
      fields: columns.map(col => ({ name: col }))
    }
  };
}

// Mock DuckDB bundle and worker creation
export const mockDuckDBBundle = {
  mainWorker: 'mock-worker-url',
  mainModule: 'mock-module-url',
  pthreadWorker: 'mock-pthread-url'
};

export const mockDuckDBAPI = {
  getJsDelivrBundles: jest.fn(() => ({ bundles: [mockDuckDBBundle] })),
  selectBundle: jest.fn(() => Promise.resolve(mockDuckDBBundle)),
  createWorker: jest.fn(() => Promise.resolve({})),
  ConsoleLogger: jest.fn(() => ({})),
  AsyncDuckDB: MockAsyncDuckDB
};

// Mock file registration
export const mockRegisterFileBuffer = jest.fn();