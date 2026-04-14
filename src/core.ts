import * as duckdb from '../vendor/js/duckdb-module.js';

// Import utilities from new locations
import { FormatUtils } from './shared/formatters.js';
import { ColorUtils } from './shared/color-utils.js';
import { DataUtils } from './shared/data-utils.js';

// Re-export utilities for backward compatibility
export { FormatUtils, ColorUtils, DataUtils };

type StatusCallback = (status: string, message: string) => void;

// ===== DUCKDB MANAGER =====
class DuckDBManager {
  private db: InstanceType<typeof duckdb.AsyncDuckDB> | null;
  private conn: Awaited<ReturnType<InstanceType<typeof duckdb.AsyncDuckDB>['connect']>> | null;
  private connectionStatus: string;
  private statusCallbacks: StatusCallback[];
  private monitoringInterval: ReturnType<typeof setInterval> | null;

  constructor() {
    this.db = null;
    this.conn = null;
    this.connectionStatus = 'disconnected';
    this.statusCallbacks = [];
    this.monitoringInterval = null;
  }

  addStatusCallback(callback: StatusCallback): void {
    this.statusCallbacks.push(callback);
  }

  removeStatusCallback(callback: StatusCallback): void {
    this.statusCallbacks = this.statusCallbacks.filter(cb => cb !== callback);
  }

  updateConnectionStatus(status: string, message = ''): void {
    this.connectionStatus = status;

    this.statusCallbacks.forEach(callback => {
      try {
        callback(status, message);
      } catch (error) {
        console.error('Error in status callback:', error);
      }
    });
  }

  getConnectionStatus(): string {
    return this.connectionStatus;
  }

  async initDuckDB(): Promise<{ db: typeof this.db; conn: typeof this.conn }> {
    try {
      if (typeof window.Arrow === 'undefined' && !window.arrowReady) {
        this.updateConnectionStatus('connecting', 'Aguardando Apache Arrow...');
        await new Promise<void>((resolve) => {
          let attempts = 0;
          const maxAttempts = 300;
          const checkArrow = () => {
            attempts++;
            if (typeof window.Arrow !== 'undefined' || window.arrowReady) {
              resolve();
            } else if (attempts >= maxAttempts) {
              console.warn('Apache Arrow loading timeout - continuing anyway');
              resolve();
            } else {
              setTimeout(checkArrow, 100);
            }
          };
          checkArrow();
        });
      }

      this.updateConnectionStatus('connecting', 'Inicializando DuckDB...');

      if (this.db && this.conn) {
        this.updateConnectionStatus('connected', 'Já Conectado');
        return { db: this.db, conn: this.conn };
      }

      this.updateConnectionStatus('connecting', 'Baixando DuckDB...');
      const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
      const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

      this.updateConnectionStatus('connecting', 'Criando worker...');
      const worker = await duckdb.createWorker(bundle.mainWorker);
      const logger = new duckdb.ConsoleLogger();

      this.updateConnectionStatus('connecting', 'Instanciando DuckDB...');
      this.db = new duckdb.AsyncDuckDB(logger, worker);
      await this.db.instantiate(bundle.mainModule, bundle.pthreadWorker ?? null);

      this.updateConnectionStatus('connecting', 'Estabelecendo conexão...');
      this.conn = await this.db.connect();

      this.updateConnectionStatus('connecting', 'Testando conexão...');
      await this.conn.query('SELECT 1 as test');

      this.updateConnectionStatus('connected', 'Conectado e testado');

      return { db: this.db, conn: this.conn };
    } catch (error) {
      console.error('❌ Error initializing DuckDB:', error);

      const err = error as Error;
      let errorMessage = err.message;
      if (err.message.includes('fetch')) errorMessage = 'Erro de rede ao baixar DuckDB';
      else if (err.message.includes('worker')) errorMessage = 'Erro do worker';
      else if (err.message.includes('instantiate')) errorMessage = 'Erro de instanciação';

      this.updateConnectionStatus('error', errorMessage);
      throw error;
    }
  }

  async loadParquetData(parquetPath = './despesas.parquet'): Promise<number> {
    try {
      this.updateConnectionStatus('connecting', 'Carregando dados...');

      const response = await fetch(parquetPath);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      this.updateConnectionStatus('connecting', 'Processando dados...');

      await this.db!.registerFileBuffer('despesas.parquet', new Uint8Array(arrayBuffer));

      await this.conn!.query(`
        CREATE OR REPLACE VIEW despesas AS
        SELECT * FROM read_parquet('despesas.parquet')
      `);

      const countResult = await this.conn!.query('SELECT COUNT(*) as total FROM despesas');
      const totalRecords = countResult.toArray()[0]['total'] as number;

      this.updateConnectionStatus('connected', `✅ despesas • ${FormatUtils.formatNumberAbbreviated(totalRecords)} records`);
      return totalRecords;
    } catch (error) {
      console.error('❌ Error loading parquet:', error);
      this.updateConnectionStatus('error', 'Erro ao carregar dados');
      throw error;
    }
  }

  async checkConnectionHealth(): Promise<boolean> {
    try {
      if (!this.conn) return false;
      await this.conn.query('SELECT 1 as test');
      return true;
    } catch (error) {
      console.warn('Connection health check failed:', error);
      return false;
    }
  }

  async ensureConnection(): Promise<boolean> {
    try {
      const isHealthy = await this.checkConnectionHealth();

      if (!isHealthy) {
        this.updateConnectionStatus('connecting', 'Reconectando...');

        if (this.conn) {
          try {
            await this.conn.close();
          } catch (e) {
            console.warn('Error closing existing connection:', e);
          }
          this.conn = null;
        }

        if (this.db) {
          this.conn = await this.db.connect();
          await this.conn.query('SELECT 1 as test');
          this.updateConnectionStatus('connected', 'Reconectado');
          return true;
        } else {
          await this.initDuckDB();
          await this.loadParquetData();
          return true;
        }
      }

      return true;
    } catch (error) {
      console.error('❌ Connection recovery failed:', error);
      this.updateConnectionStatus('error', 'Falha na reconexão');
      throw new Error(`Connection recovery failed: ${(error as Error).message}`);
    }
  }

  async query(sql: string): Promise<ReturnType<typeof this.conn.query>> {
    await this.ensureConnection();
    return await this.conn!.query(sql);
  }

  async executeQuery(sql: string): Promise<{ rows: Record<string, unknown>[]; columns: string[]; rowCount: number }> {
    await this.ensureConnection();
    const result = await this.conn!.query(sql);
    const data = result.toArray();
    const columns = result.schema.fields.map((field: { name: string }) => field.name);

    return {
      rows: data,
      columns,
      rowCount: data.length,
    };
  }

  async getSchema(): Promise<Record<string, unknown>[]> {
    await this.ensureConnection();
    const result = await this.conn!.query('DESCRIBE despesas');
    return result.toArray();
  }

  async getTableSchema(): Promise<Record<string, unknown>[]> {
    return this.getSchema();
  }

  async queryAggregatedData(
    minValue = 0,
    partyFilter = '',
    categoryFilter = '',
    searchFilter = '',
    applyDefaultMinFloor = true
  ): Promise<Record<string, unknown>[]> {
    await this.ensureConnection();

    let whereClause = 'WHERE nome_parlamentar IS NOT NULL AND fornecedor IS NOT NULL';

    if (partyFilter) {
      whereClause += ` AND sigla_partido = '${partyFilter}'`;
    }
    if (categoryFilter) {
      whereClause += ` AND categoria_despesa = '${categoryFilter}'`;
    }
    if (searchFilter) {
      whereClause += ` AND (LOWER(nome_parlamentar) LIKE '%${searchFilter.toLowerCase()}%' OR LOWER(fornecedor) LIKE '%${searchFilter.toLowerCase()}%')`;
    }

    const effectiveMinValue = applyDefaultMinFloor ? Math.max(minValue, 1000) : Math.max(minValue, 0);

    const query = `
      SELECT
        nome_parlamentar,
        sigla_partido,
        fornecedor,
        categoria_despesa,
        SUM(valor_liquido) as valor_total,
        COUNT(*) as num_transacoes
      FROM despesas
      ${whereClause}
      GROUP BY nome_parlamentar, sigla_partido, fornecedor, categoria_despesa
      HAVING SUM(valor_liquido) > ${effectiveMinValue}
      ORDER BY valor_total DESC
      LIMIT 10000
    `;

    const result = await this.conn!.query(query);
    return result.toArray();
  }

  async getValueRange(
    partyFilter = '',
    categoryFilter = '',
    searchFilter = ''
  ): Promise<{ min: number; max: number }> {
    await this.ensureConnection();

    let whereClause = 'WHERE nome_parlamentar IS NOT NULL AND fornecedor IS NOT NULL';

    if (partyFilter) whereClause += ` AND sigla_partido = '${partyFilter}'`;
    if (categoryFilter) whereClause += ` AND categoria_despesa = '${categoryFilter}'`;
    if (searchFilter) {
      whereClause += ` AND (LOWER(nome_parlamentar) LIKE '%${searchFilter.toLowerCase()}%' OR LOWER(fornecedor) LIKE '%${searchFilter.toLowerCase()}%')`;
    }

    const query = `
      SELECT
        MIN(valor_total) as min_valor,
        MAX(valor_total) as max_valor
      FROM (
        SELECT SUM(valor_liquido) as valor_total
        FROM despesas
        ${whereClause}
        GROUP BY nome_parlamentar, sigla_partido, fornecedor, categoria_despesa
        HAVING SUM(valor_liquido) > 1000
      ) as aggregated_data
    `;

    const result = await this.conn!.query(query);
    const data = result.toArray();

    if (data.length && data[0]['min_valor'] !== null) {
      return {
        min: Math.max(0, Number(data[0]['min_valor'])) || 0,
        max: Number(data[0]['max_valor']),
      };
    }

    return { min: 0, max: 100000 };
  }

  async getFilterOptions(): Promise<{ parties: string[]; categories: string[] }> {
    await this.ensureConnection();

    const partiesResult = await this.conn!.query(`
      SELECT DISTINCT sigla_partido
      FROM despesas
      WHERE sigla_partido IS NOT NULL
      ORDER BY sigla_partido
    `);
    const parties = partiesResult.toArray().map((r: Record<string, unknown>) => r['sigla_partido'] as string);

    const categoriesResult = await this.conn!.query(`
      SELECT DISTINCT categoria_despesa
      FROM despesas
      WHERE categoria_despesa IS NOT NULL
      ORDER BY categoria_despesa
    `);
    const categories = categoriesResult.toArray().map((r: Record<string, unknown>) => r['categoria_despesa'] as string);

    return { parties, categories };
  }

  startConnectionMonitoring(intervalMs = 30000): void {
    this.stopConnectionMonitoring();

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkConnectionHealth();
      } catch (error) {
        console.warn('Connection monitoring check failed:', error);
      }
    }, intervalMs);
  }

  stopConnectionMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  async close(): Promise<void> {
    this.stopConnectionMonitoring();

    if (this.conn) {
      try {
        await this.conn.close();
      } catch (e) {
        console.warn('Error closing connection:', e);
      }
      this.conn = null;
    }

    if (this.db) {
      try {
        await this.db.terminate();
      } catch (e) {
        console.warn('Error terminating database:', e);
      }
      this.db = null;
    }

    this.updateConnectionStatus('disconnected', 'Desconectado');
  }
}

const duckDBManager = new DuckDBManager();

// Global API for compatibility with existing code
window.duckdbAPI = {
  initDuckDB: () => duckDBManager.initDuckDB(),
  loadParquetData: (path?: string) => duckDBManager.loadParquetData(path),
  executeQuery: async (sql: string) => {
    const result = await duckDBManager.query(sql);
    return {
      toArray: () => result.toArray(),
      schema: result.schema,
      numRows: result.numRows,
    } as import('@duckdb/duckdb-wasm').ArrowTable;
  },
  getSchema: async () => duckDBManager.getSchema() as Promise<Record<string, unknown>[]>,
  query: async (sql: string) => {
    const result = await duckDBManager.query(sql);
    return { numRows: result.numRows, toArray: () => result.toArray() as Record<string, unknown>[] };
  },
  getFilterOptions: () => duckDBManager.getFilterOptions(),
  getValueRange: (partyFilter?: string, categoryFilter?: string, searchFilter?: string) =>
    duckDBManager.getValueRange(partyFilter ?? '', categoryFilter ?? '', searchFilter ?? ''),
  queryAggregatedData: (minValue?: number, partyFilter?: string, categoryFilter?: string, searchFilter?: string) =>
    duckDBManager.queryAggregatedData(minValue ?? 0, partyFilter ?? '', categoryFilter ?? '', searchFilter ?? '') as Promise<Record<string, unknown>[]>,
  checkConnectionHealth: () => duckDBManager.checkConnectionHealth(),
};

window.updateConnectionStatus = (status: string, message?: string) =>
  duckDBManager.updateConnectionStatus(status, message ?? '');
window.getConnectionStatus = () => duckDBManager.getConnectionStatus();

window.addEventListener('beforeunload', () => {
  window.stopConnectionMonitoring?.();
  duckDBManager.close();
});

export default duckDBManager;
export { duckDBManager };
