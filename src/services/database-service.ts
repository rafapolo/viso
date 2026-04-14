/**
 * Unified Database Service
 * Centralizes all DuckDB functionality and provides a consistent interface
 */

import * as duckdb from '../../vendor/js/duckdb-module.js';
import { FormatUtils } from '../shared/formatters.js';
import { ErrorHandler } from '../shared/error-handler.js';

type StatusCallback = (status: string, message: string) => void;

interface DatabaseServiceConfig {
  parquetPath?: string;
  tableName?: string;
  monitoringInterval?: number;
  maxRetries?: number;
  retryDelay?: number;
}

export interface QueryResult {
  data: Record<string, unknown>[];
  columns: string[];
  rowCount: number;
  executionTime: number;
  success: boolean;
}

export interface PaginatedQueryResult extends QueryResult {
  currentPage: number;
  pageSize: number;
  hasMore: boolean;
}

export class DatabaseService {
  db: InstanceType<typeof duckdb.AsyncDuckDB> | null;
  conn: Awaited<ReturnType<InstanceType<typeof duckdb.AsyncDuckDB>['connect']>> | null;
  private connectionStatus: string;
  private statusCallbacks: StatusCallback[];
  private monitoringInterval: ReturnType<typeof setInterval> | null;
  private config: Required<DatabaseServiceConfig>;

  constructor(options: DatabaseServiceConfig = {}) {
    this.db = null;
    this.conn = null;
    this.connectionStatus = 'disconnected';
    this.statusCallbacks = [];
    this.monitoringInterval = null;

    this.config = {
      parquetPath: './despesas.parquet',
      tableName: 'despesas',
      monitoringInterval: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      ...options,
    };
  }

  addStatusCallback(callback: StatusCallback): void {
    if (typeof callback === 'function') {
      this.statusCallbacks.push(callback);
    }
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
        ErrorHandler.handleError(error as Error, 'DatabaseService Status Callback', 'warning');
      }
    });
  }

  getConnectionStatus(): string {
    return this.connectionStatus;
  }

  async checkConnectionHealth(): Promise<boolean> {
    try {
      if (!this.conn) return false;
      await this.conn.query('SELECT 1 as test');
      return true;
    } catch {
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
          } catch {
            // Ignore close errors
          }
          this.conn = null;
        }

        if (this.db) {
          this.conn = await this.db.connect();
          await this.conn.query('SELECT 1 as test');
          this.updateConnectionStatus('connected', 'Reconectado');
          return true;
        } else {
          await this.initialize();
          return true;
        }
      }

      return true;
    } catch (error) {
      this.updateConnectionStatus('error', 'Falha na reconexão');
      throw ErrorHandler.handleError(error as Error, 'DatabaseService Connection Recovery');
    }
  }

  async initialize(): Promise<{ success: boolean; db: typeof this.db; conn: typeof this.conn }> {
    try {
      this.updateConnectionStatus('connecting', 'Inicializando DuckDB...');

      if (this.db && this.conn) {
        this.updateConnectionStatus('connected', 'Já Conectado');
        return { success: true, db: this.db, conn: this.conn };
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

      return { success: true, db: this.db, conn: this.conn };
    } catch (error) {
      const err = error as Error;
      let errorMessage = err.message;
      if (err.message.includes('fetch')) {
        errorMessage = 'Erro de rede ao baixar DuckDB';
      } else if (err.message.includes('worker')) {
        errorMessage = 'Erro do worker';
      } else if (err.message.includes('instantiate')) {
        errorMessage = 'Erro de instanciação';
      }

      this.updateConnectionStatus('error', errorMessage);
      throw ErrorHandler.handleError(err, 'DatabaseService Initialization');
    }
  }

  // Alias for backward compatibility
  async initDuckDB(): Promise<{ success: boolean; db: typeof this.db; conn: typeof this.conn }> {
    return this.initialize();
  }

  async loadData(parquetPath: string | null = null): Promise<number> {
    try {
      const dataPath = parquetPath || this.config.parquetPath;
      this.updateConnectionStatus('connecting', 'Carregando dados...');

      const response = await fetch(dataPath);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      this.updateConnectionStatus('connecting', 'Processando dados...');

      const fileName = `${this.config.tableName}.parquet`;
      await this.db!.registerFileBuffer(fileName, new Uint8Array(arrayBuffer));

      await this.conn!.query(`
        CREATE OR REPLACE VIEW ${this.config.tableName} AS
        SELECT * FROM read_parquet('${fileName}')
      `);

      const countResult = await this.conn!.query(`SELECT COUNT(*) as total FROM ${this.config.tableName}`);
      const totalRecords = countResult.toArray()[0]['total'] as number;

      this.updateConnectionStatus('connected',
        `✅ ${this.config.tableName} • ${FormatUtils.formatNumberAbbreviated(totalRecords)} records`);

      return totalRecords;
    } catch (error) {
      this.updateConnectionStatus('error', 'Erro ao carregar dados');
      throw ErrorHandler.handleError(error as Error, 'DatabaseService Data Loading');
    }
  }

  // Alias for backward compatibility
  async loadParquetData(parquetPath: string | null = null): Promise<number> {
    return this.loadData(parquetPath);
  }

  async query(sql: string): Promise<ReturnType<typeof this.conn.query>> {
    await this.ensureConnection();
    return await this.conn!.query(sql);
  }

  async executeQuery(sql: string): Promise<QueryResult> {
    await this.ensureConnection();

    try {
      const startTime = performance.now();
      const result = await this.conn!.query(sql);
      const endTime = performance.now();
      const executionTime = endTime - startTime;

      const data = result.toArray();
      const columns = result.schema.fields.map((field: { name: string }) => field.name);

      return {
        data,
        columns,
        rowCount: data.length,
        executionTime,
        success: true,
      };
    } catch (error) {
      throw ErrorHandler.handleError(error as Error, 'DatabaseService Query Execution');
    }
  }

  async executePaginatedQuery(sql: string, page = 1, pageSize = 100): Promise<PaginatedQueryResult> {
    const offset = (page - 1) * pageSize;
    const paginatedSql = `${sql} LIMIT ${pageSize} OFFSET ${offset}`;

    const result = await this.executeQuery(paginatedSql);

    return {
      ...result,
      currentPage: page,
      pageSize,
      hasMore: result.data.length === pageSize,
    };
  }

  async getSchema(tableName: string | null = null): Promise<Record<string, unknown>[]> {
    await this.ensureConnection();
    const table = tableName || this.config.tableName;
    const result = await this.conn!.query(`DESCRIBE ${table}`);
    return result.toArray();
  }

  async getTableSchema(tableName: string | null = null): Promise<Record<string, unknown>[]> {
    return this.getSchema(tableName);
  }

  async getTableInfo(tableName: string | null = null): Promise<{ schema: Record<string, unknown>[]; totalRecords: number; tableName: string }> {
    await this.ensureConnection();
    const table = tableName || this.config.tableName;

    const [schema, count] = await Promise.all([
      this.getSchema(table),
      this.conn!.query(`SELECT COUNT(*) as total FROM ${table}`),
    ]);

    return {
      schema,
      totalRecords: count.toArray()[0]['total'] as number,
      tableName: table,
    };
  }

  async queryAggregatedData(
    minValue = 0,
    partyFilter = '',
    categoryFilter = '',
    searchFilter = ''
  ): Promise<Record<string, unknown>[]> {
    await this.ensureConnection();

    let whereClause = 'WHERE nome_parlamentar IS NOT NULL AND fornecedor IS NOT NULL';

    if (partyFilter) {
      whereClause += ` AND sigla_partido = '${partyFilter.replace(/'/g, "''")}'`;
    }
    if (categoryFilter) {
      whereClause += ` AND categoria_despesa = '${categoryFilter.replace(/'/g, "''")}'`;
    }
    if (searchFilter) {
      const escaped = searchFilter.replace(/'/g, "''").toLowerCase();
      whereClause += ` AND (LOWER(nome_parlamentar) LIKE '%${escaped}%' OR LOWER(fornecedor) LIKE '%${escaped}%')`;
    }

    const query = `
      SELECT
        nome_parlamentar,
        sigla_partido,
        fornecedor,
        categoria_despesa,
        SUM(valor_liquido) as valor_total,
        COUNT(*) as num_transacoes
      FROM ${this.config.tableName}
      ${whereClause}
      GROUP BY nome_parlamentar, sigla_partido, fornecedor, categoria_despesa
      HAVING SUM(valor_liquido) > ${Math.max(minValue, 1000)}
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

    if (partyFilter) {
      whereClause += ` AND sigla_partido = '${partyFilter.replace(/'/g, "''")}'`;
    }
    if (categoryFilter) {
      whereClause += ` AND categoria_despesa = '${categoryFilter.replace(/'/g, "''")}'`;
    }
    if (searchFilter) {
      const escaped = searchFilter.replace(/'/g, "''").toLowerCase();
      whereClause += ` AND (LOWER(nome_parlamentar) LIKE '%${escaped}%' OR LOWER(fornecedor) LIKE '%${escaped}%')`;
    }

    const query = `
      SELECT
        MIN(valor_total) as min_valor,
        MAX(valor_total) as max_valor
      FROM (
        SELECT SUM(valor_liquido) as valor_total
        FROM ${this.config.tableName}
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

    const [partiesResult, categoriesResult] = await Promise.all([
      this.conn!.query(`
        SELECT DISTINCT sigla_partido
        FROM ${this.config.tableName}
        WHERE sigla_partido IS NOT NULL
        ORDER BY sigla_partido
      `),
      this.conn!.query(`
        SELECT DISTINCT categoria_despesa
        FROM ${this.config.tableName}
        WHERE categoria_despesa IS NOT NULL
        ORDER BY categoria_despesa
      `),
    ]);

    const parties = partiesResult.toArray().map((r: Record<string, unknown>) => r['sigla_partido'] as string);
    const categories = categoriesResult.toArray().map((r: Record<string, unknown>) => r['categoria_despesa'] as string);

    return { parties, categories };
  }

  async getSankeyFlowData(): Promise<Record<string, unknown>[]> {
    await this.ensureConnection();

    const query = `
      SELECT
        sigla_partido as source_party,
        categoria_despesa as category,
        fornecedor as supplier,
        SUM(valor_liquido) as total_value,
        COUNT(*) as transaction_count
      FROM ${this.config.tableName}
      WHERE sigla_partido IS NOT NULL
        AND categoria_despesa IS NOT NULL
        AND fornecedor IS NOT NULL
        AND valor_liquido > 0
      GROUP BY sigla_partido, categoria_despesa, fornecedor
      HAVING SUM(valor_liquido) > 5000
      ORDER BY total_value DESC
      LIMIT 1000
    `;

    const result = await this.conn!.query(query);
    return result.toArray();
  }

  async getTopSuppliers(limit = 20): Promise<Record<string, unknown>[]> {
    await this.ensureConnection();

    const query = `
      SELECT
        fornecedor,
        SUM(valor_liquido) as total_received,
        COUNT(*) as transaction_count,
        COUNT(DISTINCT sigla_partido) as party_count
      FROM ${this.config.tableName}
      WHERE fornecedor IS NOT NULL AND valor_liquido > 0
      GROUP BY fornecedor
      ORDER BY total_received DESC
      LIMIT ${limit}
    `;

    const result = await this.conn!.query(query);
    return result.toArray();
  }

  startConnectionMonitoring(intervalMs: number | null = null): void {
    this.stopConnectionMonitoring();

    const interval = intervalMs || this.config.monitoringInterval;

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkConnectionHealth();
      } catch (error) {
        ErrorHandler.handleError(error as Error, 'DatabaseService Connection Monitoring', 'warning');
      }
    }, interval);
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
      } catch {
        // Ignore close errors
      }
      this.conn = null;
    }

    if (this.db) {
      try {
        await this.db.terminate();
      } catch {
        // Ignore termination errors
      }
      this.db = null;
    }

    this.updateConnectionStatus('disconnected', 'Desconectado');
  }
}

let globalDatabaseService: DatabaseService | null = null;

export function createDatabaseService(options: DatabaseServiceConfig = {}): DatabaseService {
  return new DatabaseService(options);
}

export function getGlobalDatabaseService(options: DatabaseServiceConfig = {}): DatabaseService {
  if (!globalDatabaseService) {
    globalDatabaseService = new DatabaseService(options);
  }
  return globalDatabaseService;
}

export function createStandaloneDatabaseService(): DatabaseService {
  return createDatabaseService({
    parquetPath: './despesas.parquet',
    tableName: 'despesas',
    monitoringInterval: 30000,
  });
}

export function createEmbeddedDatabaseService(): DatabaseService {
  return createDatabaseService({
    parquetPath: './despesas.parquet',
    tableName: 'despesas',
    monitoringInterval: 60000,
  });
}

export default DatabaseService;
