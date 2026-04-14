// DuckDB WASM mock for testing
import { sampleDespesasData, sampleQueryResult, sampleSchema, sampleFilterOptions } from '../fixtures/sample-data.js';

interface MockResult {
  toArray(): unknown[];
  numRows: number;
  schema: { fields: { name: string }[] };
}

function createMockResult(data: unknown[], columns: string[]): MockResult {
  return {
    toArray: () => data,
    numRows: data.length,
    schema: {
      fields: columns.map(col => ({ name: col })),
    },
  };
}

export class MockAsyncDuckDB {
  isInstantiated: boolean;
  isTerminated: boolean;

  constructor() {
    this.isInstantiated = false;
    this.isTerminated = false;
  }

  async instantiate(): Promise<void> {
    this.isInstantiated = true;
  }

  async connect(): Promise<MockConnection> {
    if (!this.isInstantiated) {
      throw new Error('DuckDB not instantiated');
    }
    return new MockConnection();
  }

  async terminate(): Promise<void> {
    this.isTerminated = true;
  }
}

export class MockConnection {
  isClosed: boolean;
  registeredFiles: Map<string, unknown>;

  constructor() {
    this.isClosed = false;
    this.registeredFiles = new Map();
  }

  async query(sql: string): Promise<MockResult> {
    if (this.isClosed) {
      throw new Error('Connection is closed');
    }

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

    return createMockResult(sampleDespesasData, sampleQueryResult.columns);
  }

  async close(): Promise<void> {
    this.isClosed = true;
  }
}

export const mockDuckDBBundle = {
  mainWorker: 'mock-worker-url',
  mainModule: 'mock-module-url',
  pthreadWorker: 'mock-pthread-url',
};

export const mockDuckDBAPI = {
  getJsDelivrBundles: jest.fn(() => ({ bundles: [mockDuckDBBundle] })),
  selectBundle: jest.fn(() => Promise.resolve(mockDuckDBBundle)),
  createWorker: jest.fn(() => Promise.resolve({})),
  ConsoleLogger: jest.fn(() => ({})),
  AsyncDuckDB: MockAsyncDuckDB,
};

export const mockRegisterFileBuffer = jest.fn();
