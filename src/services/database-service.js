/**
 * Unified Database Service
 * Centralizes all DuckDB functionality and provides a consistent interface
 */

import * as duckdb from '../../vendor/js/duckdb-module.js';
import { FormatUtils } from '../shared/formatters.js';
import { ErrorHandler } from '../shared/error-handler.js';

export class DatabaseService {
    constructor(options = {}) {
        this.db = null;
        this.conn = null;
        this.connectionStatus = 'disconnected';
        this.statusCallbacks = [];
        this.monitoringInterval = null;
        
        // Configuration
        this.config = {
            parquetPath: './despesas.parquet',
            tableName: 'despesas',
            monitoringInterval: 30000,
            maxRetries: 3,
            retryDelay: 1000,
            ...options
        };
    }

    // ===== CONNECTION MANAGEMENT =====

    addStatusCallback(callback) {
        if (typeof callback === 'function') {
            this.statusCallbacks.push(callback);
        }
    }

    removeStatusCallback(callback) {
        this.statusCallbacks = this.statusCallbacks.filter(cb => cb !== callback);
    }

    updateConnectionStatus(status, message = '') {
        this.connectionStatus = status;
        
        this.statusCallbacks.forEach(callback => {
            try {
                callback(status, message);
            } catch (error) {
                ErrorHandler.handleError(error, 'DatabaseService Status Callback', 'warning');
            }
        });
    }

    getConnectionStatus() {
        return this.connectionStatus;
    }

    async checkConnectionHealth() {
        try {
            if (!this.conn) return false;
            await this.conn.query("SELECT 1 as test");
            return true;
        } catch (error) {
            return false;
        }
    }

    async ensureConnection() {
        try {
            const isHealthy = await this.checkConnectionHealth();
            
            if (!isHealthy) {
                this.updateConnectionStatus('connecting', 'Reconectando...');
                
                if (this.conn) {
                    try {
                        await this.conn.close();
                    } catch (e) {
                        // Ignore close errors
                    }
                    this.conn = null;
                }
                
                if (this.db) {
                    this.conn = await this.db.connect();
                    await this.conn.query("SELECT 1 as test");
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
            throw ErrorHandler.handleError(error, 'DatabaseService Connection Recovery');
        }
    }

    // ===== INITIALIZATION =====

    async initialize() {
        try {
            this.updateConnectionStatus('connecting', 'Inicializando DuckDB...');
            
            if (this.db && this.conn) {
                this.updateConnectionStatus('connected', 'Já Conectado');
                return { success: true, db: this.db, conn: this.conn };
            }
            
            // Download and setup DuckDB
            this.updateConnectionStatus('connecting', 'Baixando DuckDB...');
            const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
            const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
            
            this.updateConnectionStatus('connecting', 'Criando worker...');
            const worker = await duckdb.createWorker(bundle.mainWorker);
            const logger = new duckdb.ConsoleLogger();
            
            this.updateConnectionStatus('connecting', 'Instanciando DuckDB...');
            this.db = new duckdb.AsyncDuckDB(logger, worker);
            await this.db.instantiate(bundle.mainModule, bundle.pthreadWorker);
            
            this.updateConnectionStatus('connecting', 'Estabelecendo conexão...');
            this.conn = await this.db.connect();
            
            // Test connection
            this.updateConnectionStatus('connecting', 'Testando conexão...');
            await this.conn.query('SELECT 1 as test');
            
            this.updateConnectionStatus('connected', 'Conectado e testado');
            
            return { success: true, db: this.db, conn: this.conn };
        } catch (error) {
            let errorMessage = error.message;
            if (error.message.includes('fetch')) {
                errorMessage = 'Erro de rede ao baixar DuckDB';
            } else if (error.message.includes('worker')) {
                errorMessage = 'Erro do worker';
            } else if (error.message.includes('instantiate')) {
                errorMessage = 'Erro de instanciação';
            }
            
            this.updateConnectionStatus('error', errorMessage);
            throw ErrorHandler.handleError(error, 'DatabaseService Initialization');
        }
    }

    async loadData(parquetPath = null) {
        try {
            const dataPath = parquetPath || this.config.parquetPath;
            this.updateConnectionStatus('connecting', 'Carregando dados...');
            
            const response = await fetch(dataPath);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            this.updateConnectionStatus('connecting', 'Processando dados...');
            
            // Register parquet file in DuckDB
            const fileName = `${this.config.tableName}.parquet`;
            await this.db.registerFileBuffer(fileName, new Uint8Array(arrayBuffer));
            
            // Create view
            await this.conn.query(`
                CREATE OR REPLACE VIEW ${this.config.tableName} AS 
                SELECT * FROM read_parquet('${fileName}')
            `);
            
            // Get record count
            const countResult = await this.conn.query(`SELECT COUNT(*) as total FROM ${this.config.tableName}`);
            const totalRecords = countResult.toArray()[0].total;
            
            this.updateConnectionStatus('connected', 
                `✅ ${this.config.tableName} • ${FormatUtils.formatNumberAbbreviated(totalRecords)} records`);
            
            return totalRecords;
            
        } catch (error) {
            this.updateConnectionStatus('error', 'Erro ao carregar dados');
            throw ErrorHandler.handleError(error, 'DatabaseService Data Loading');
        }
    }

    // ===== QUERY EXECUTION =====

    async query(sql) {
        await this.ensureConnection();
        return await this.conn.query(sql);
    }

    async executeQuery(sql) {
        await this.ensureConnection();
        
        try {
            const startTime = performance.now();
            const result = await this.conn.query(sql);
            const endTime = performance.now();
            const executionTime = endTime - startTime;
            
            const data = result.toArray();
            const columns = result.schema.fields.map(field => field.name);
            
            return {
                data,
                columns,
                rowCount: data.length,
                executionTime,
                success: true
            };
        } catch (error) {
            throw ErrorHandler.handleError(error, 'DatabaseService Query Execution');
        }
    }

    async executePaginatedQuery(sql, page = 1, pageSize = 100) {
        const offset = (page - 1) * pageSize;
        const paginatedSql = `${sql} LIMIT ${pageSize} OFFSET ${offset}`;
        
        const result = await this.executeQuery(paginatedSql);
        
        return {
            ...result,
            currentPage: page,
            pageSize,
            hasMore: result.data.length === pageSize
        };
    }

    // ===== SCHEMA OPERATIONS =====

    async getSchema(tableName = null) {
        await this.ensureConnection();
        const table = tableName || this.config.tableName;
        const result = await this.conn.query(`DESCRIBE ${table}`);
        return result.toArray();
    }

    async getTableSchema(tableName = null) {
        return await this.getSchema(tableName);
    }

    async getTableInfo(tableName = null) {
        await this.ensureConnection();
        const table = tableName || this.config.tableName;
        
        const [schema, count] = await Promise.all([
            this.getSchema(table),
            this.conn.query(`SELECT COUNT(*) as total FROM ${table}`)
        ]);
        
        return {
            schema,
            totalRecords: count.toArray()[0].total,
            tableName: table
        };
    }

    // ===== SPECIALIZED QUERIES =====

    async queryAggregatedData(minValue = 0, partyFilter = '', categoryFilter = '', searchFilter = '') {
        await this.ensureConnection();
        
        let whereClause = "WHERE nome_parlamentar IS NOT NULL AND fornecedor IS NOT NULL";
        const params = [];
        
        if (partyFilter) {
            whereClause += ` AND sigla_partido = ?`;
            params.push(partyFilter);
        }
        
        if (categoryFilter) {
            whereClause += ` AND categoria_despesa = ?`;
            params.push(categoryFilter);
        }
        
        if (searchFilter) {
            whereClause += ` AND (LOWER(nome_parlamentar) LIKE ? OR LOWER(fornecedor) LIKE ?)`;
            const searchPattern = `%${searchFilter.toLowerCase()}%`;
            params.push(searchPattern, searchPattern);
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
        
        const result = await this.conn.query(query);
        return result.toArray();
    }

    async getValueRange(partyFilter = '', categoryFilter = '', searchFilter = '') {
        await this.ensureConnection();
        
        let whereClause = "WHERE nome_parlamentar IS NOT NULL AND fornecedor IS NOT NULL";
        
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
                SELECT 
                    SUM(valor_liquido) as valor_total
                FROM ${this.config.tableName} 
                ${whereClause}
                GROUP BY nome_parlamentar, sigla_partido, fornecedor, categoria_despesa
                HAVING SUM(valor_liquido) > 1000
            ) as aggregated_data
        `;
        
        const result = await this.conn.query(query);
        const data = result.toArray();
        
        if (data.length && data[0].min_valor !== null) {
            return {
                min: Math.max(0, Number(data[0].min_valor)) || 0,
                max: Number(data[0].max_valor)
            };
        }
        
        return { min: 0, max: 100000 };
    }

    async getFilterOptions() {
        await this.ensureConnection();
        
        const [partiesResult, categoriesResult] = await Promise.all([
            this.conn.query(`
                SELECT DISTINCT sigla_partido 
                FROM ${this.config.tableName} 
                WHERE sigla_partido IS NOT NULL 
                ORDER BY sigla_partido
            `),
            this.conn.query(`
                SELECT DISTINCT categoria_despesa 
                FROM ${this.config.tableName} 
                WHERE categoria_despesa IS NOT NULL 
                ORDER BY categoria_despesa
            `)
        ]);
        
        const parties = partiesResult.toArray().map(r => r.sigla_partido);
        const categories = categoriesResult.toArray().map(r => r.categoria_despesa);
        
        return { parties, categories };
    }

    // ===== SANKEY-SPECIFIC QUERIES =====

    async getSankeyFlowData() {
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
        
        const result = await this.conn.query(query);
        return result.toArray();
    }

    async getTopSuppliers(limit = 20) {
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
        
        const result = await this.conn.query(query);
        return result.toArray();
    }

    // ===== MONITORING =====

    startConnectionMonitoring(intervalMs = null) {
        this.stopConnectionMonitoring();
        
        const interval = intervalMs || this.config.monitoringInterval;
        
        this.monitoringInterval = setInterval(async () => {
            try {
                await this.checkConnectionHealth();
            } catch (error) {
                ErrorHandler.handleError(error, 'DatabaseService Connection Monitoring', 'warning');
            }
        }, interval);
    }

    stopConnectionMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
    }

    // ===== CLEANUP =====

    async close() {
        this.stopConnectionMonitoring();
        
        if (this.conn) {
            try {
                await this.conn.close();
            } catch (e) {
                // Ignore close errors
            }
            this.conn = null;
        }
        
        if (this.db) {
            try {
                await this.db.terminate();
            } catch (e) {
                // Ignore termination errors
            }
            this.db = null;
        }
        
        this.updateConnectionStatus('disconnected', 'Desconectado');
    }
}

// Singleton instance for global use
let globalDatabaseService = null;

export function createDatabaseService(options = {}) {
    return new DatabaseService(options);
}

export function getGlobalDatabaseService(options = {}) {
    if (!globalDatabaseService) {
        globalDatabaseService = new DatabaseService(options);
    }
    return globalDatabaseService;
}

// Factory functions for different modes
export function createStandaloneDatabaseService() {
    return createDatabaseService({
        parquetPath: './despesas.parquet',
        tableName: 'despesas',
        monitoringInterval: 30000
    });
}

export function createEmbeddedDatabaseService() {
    return createDatabaseService({
        parquetPath: './despesas.parquet',
        tableName: 'despesas',
        monitoringInterval: 60000 // Less frequent monitoring for embedded use
    });
}

export default DatabaseService;