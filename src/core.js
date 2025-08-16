import * as duckdb from 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.28.0/+esm';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';

// Import utilities from new locations
import { FormatUtils } from './shared/formatters.js';
import { ColorUtils } from './shared/color-utils.js';
import { DataUtils } from './shared/data-utils.js';

// Make d3 available globally
window.d3 = d3;

// Re-export utilities for backward compatibility
export { FormatUtils, ColorUtils, DataUtils };

// ===== DUCKDB MANAGER =====
class DuckDBManager {
    constructor() {
        this.db = null;
        this.conn = null;
        this.connectionStatus = 'disconnected';
        this.statusCallbacks = [];
        this.monitoringInterval = null;
    }

    addStatusCallback(callback) {
        this.statusCallbacks.push(callback);
    }

    removeStatusCallback(callback) {
        this.statusCallbacks = this.statusCallbacks.filter(cb => cb !== callback);
    }

    updateConnectionStatus(status, message = '') {
        this.connectionStatus = status;
        // Connection status updated
        
        this.statusCallbacks.forEach(callback => {
            try {
                callback(status, message);
            } catch (error) {
                console.error('Error in status callback:', error);
            }
        });
    }

    getConnectionStatus() {
        return this.connectionStatus;
    }

    async initDuckDB() {
        try {
            this.updateConnectionStatus('connecting', 'Inicializando DuckDB...');
            // Initializing DuckDB
            
            if (this.db && this.conn) {
                // DuckDB already initialized, reusing connection
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
            await this.db.instantiate(bundle.mainModule, bundle.pthreadWorker);
            
            this.updateConnectionStatus('connecting', 'Estabelecendo conexão...');
            this.conn = await this.db.connect();
            
            this.updateConnectionStatus('connecting', 'Testando conexão...');
            await this.conn.query('SELECT 1 as test');
            
            // DuckDB initialized and tested successfully
            this.updateConnectionStatus('connected', 'Conectado e testado');
            
            return { db: this.db, conn: this.conn };
        } catch (error) {
            console.error('❌ Error initializing DuckDB:', error);
            
            let errorMessage = error.message;
            if (error.message.includes('fetch')) {
                errorMessage = 'Erro de rede ao baixar DuckDB';
            } else if (error.message.includes('worker')) {
                errorMessage = 'Erro do worker';
            } else if (error.message.includes('instantiate')) {
                errorMessage = 'Erro de instanciação';
            }
            
            this.updateConnectionStatus('error', errorMessage);
            throw error;
        }
    }

    async loadParquetData(parquetPath = './despesas.parquet') {
        try {
            this.updateConnectionStatus('connecting', 'Carregando dados...');
            // Loading parquet file into DuckDB
            
            const response = await fetch(parquetPath);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            // Downloaded parquet data
            
            this.updateConnectionStatus('connecting', 'Processando dados...');
            
            await this.db.registerFileBuffer('despesas.parquet', new Uint8Array(arrayBuffer));
            
            await this.conn.query(`
                CREATE OR REPLACE VIEW despesas AS 
                SELECT * FROM read_parquet('despesas.parquet')
            `);
            
            const countResult = await this.conn.query("SELECT COUNT(*) as total FROM despesas");
            const totalRecords = countResult.toArray()[0].total;
            // Loaded records from parquet
            
            this.updateConnectionStatus('connected', `✅ despesas • ${FormatUtils.formatNumberAbbreviated(totalRecords)} records`);
            return totalRecords;
            
        } catch (error) {
            console.error('❌ Error loading parquet:', error);
            this.updateConnectionStatus('error', 'Erro ao carregar dados');
            throw error;
        }
    }

    async checkConnectionHealth() {
        try {
            if (!this.conn) return false;
            await this.conn.query("SELECT 1 as test");
            return true;
        } catch (error) {
            console.warn('Connection health check failed:', error);
            return false;
        }
    }

    async ensureConnection() {
        try {
            const isHealthy = await this.checkConnectionHealth();
            
            if (!isHealthy) {
                this.updateConnectionStatus('connecting', 'Reconectando...');
                // Connection lost, attempting to reconnect
                
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
                    await this.conn.query("SELECT 1 as test");
                    this.updateConnectionStatus('connected', 'Reconectado');
                    // Reconnected successfully
                    return true;
                } else {
                    // DB instance lost, reinitializing
                    await this.initDuckDB();
                    await this.loadParquetData();
                    return true;
                }
            }
            
            return true;
        } catch (error) {
            console.error('❌ Connection recovery failed:', error);
            this.updateConnectionStatus('error', 'Falha na reconexão');
            throw new Error(`Connection recovery failed: ${error.message}`);
        }
    }

    async query(sql) {
        await this.ensureConnection();
        return await this.conn.query(sql);
    }

    async executeQuery(sql) {
        await this.ensureConnection();
        const result = await this.conn.query(sql);
        const data = result.toArray();
        const columns = result.schema.fields.map(field => field.name);
        
        return {
            rows: data,
            columns,
            rowCount: data.length
        };
    }

    async getSchema() {
        await this.ensureConnection();
        const result = await this.conn.query(`DESCRIBE despesas`);
        return result.toArray();
    }

    async getTableSchema() {
        await this.ensureConnection();
        const result = await this.conn.query(`DESCRIBE despesas`);
        return result.toArray();
    }

    async queryAggregatedData(minValue = 0, partyFilter = '', categoryFilter = '', searchFilter = '') {
        await this.ensureConnection();
        // Querying aggregated data
        
        let whereClause = "WHERE nome_parlamentar IS NOT NULL AND fornecedor IS NOT NULL";
        
        if (partyFilter) {
            whereClause += ` AND sigla_partido = '${partyFilter}'`;
        }
        
        if (categoryFilter) {
            whereClause += ` AND categoria_despesa = '${categoryFilter}'`;
        }
        
        if (searchFilter) {
            whereClause += ` AND (LOWER(nome_parlamentar) LIKE '%${searchFilter.toLowerCase()}%' OR LOWER(fornecedor) LIKE '%${searchFilter.toLowerCase()}%')`;
        }
        
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
            HAVING SUM(valor_liquido) > ${Math.max(minValue, 1000)}
            ORDER BY valor_total DESC
            LIMIT 10000
        `;
        
        // Executing query
        const result = await this.conn.query(query);
        const data = result.toArray();
        
        // Query completed
        return data;
    }

    async getValueRange(partyFilter = '', categoryFilter = '', searchFilter = '') {
        await this.ensureConnection();
        // Querying value range
        
        let whereClause = "WHERE nome_parlamentar IS NOT NULL AND fornecedor IS NOT NULL";
        
        if (partyFilter) {
            whereClause += ` AND sigla_partido = '${partyFilter}'`;
        }
        
        if (categoryFilter) {
            whereClause += ` AND categoria_despesa = '${categoryFilter}'`;
        }
        
        if (searchFilter) {
            whereClause += ` AND (LOWER(nome_parlamentar) LIKE '%${searchFilter.toLowerCase()}%' OR LOWER(fornecedor) LIKE '%${searchFilter.toLowerCase()}%')`;
        }
        
        const query = `
            SELECT 
                MIN(valor_total) as min_valor,
                MAX(valor_total) as max_valor
            FROM (
                SELECT 
                    SUM(valor_liquido) as valor_total
                FROM despesas 
                ${whereClause}
                GROUP BY nome_parlamentar, sigla_partido, fornecedor, categoria_despesa
                HAVING SUM(valor_liquido) > 1000
            ) as aggregated_data
        `;
        
        // Executing value range query
        const result = await this.conn.query(query);
        const data = result.toArray();
        
        if (data.length && data[0].min_valor !== null) {
            const range = {
                min: Math.max(0, Number(data[0].min_valor)) || 0,
                max: Number(data[0].max_valor)
            };
            // Value range from DB
            return range;
        }
        
        return { min: 0, max: 100000 };
    }

    async getFilterOptions() {
        await this.ensureConnection();
        // Getting filter options
        
        const partiesResult = await this.conn.query(`
            SELECT DISTINCT sigla_partido 
            FROM despesas 
            WHERE sigla_partido IS NOT NULL 
            ORDER BY sigla_partido
        `);
        const parties = partiesResult.toArray().map(r => r.sigla_partido);
        
        const categoriesResult = await this.conn.query(`
            SELECT DISTINCT categoria_despesa 
            FROM despesas 
            WHERE categoria_despesa IS NOT NULL 
            ORDER BY categoria_despesa
        `);
        const categories = categoriesResult.toArray().map(r => r.categoria_despesa);
        
        return { parties, categories };
    }

    startConnectionMonitoring(intervalMs = 30000) {
        this.stopConnectionMonitoring();
        
        this.monitoringInterval = setInterval(async () => {
            try {
                await this.checkConnectionHealth();
            } catch (error) {
                console.warn('Connection monitoring check failed:', error);
            }
        }, intervalMs);
        
        // Connection monitoring started
    }

    stopConnectionMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
            // Connection monitoring stopped
        }
    }

    async close() {
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
    loadParquetData: () => duckDBManager.loadParquetData(),
    queryAggregatedData: (minValue, partyFilter, categoryFilter, searchFilter) => 
        duckDBManager.queryAggregatedData(minValue, partyFilter, categoryFilter, searchFilter),
    getValueRange: (partyFilter, categoryFilter, searchFilter) => 
        duckDBManager.getValueRange(partyFilter, categoryFilter, searchFilter),
    getFilterOptions: () => duckDBManager.getFilterOptions(),
    checkConnectionHealth: () => duckDBManager.checkConnectionHealth(),
    query: (sql) => duckDBManager.query(sql),
    executeQuery: (sql) => duckDBManager.executeQuery(sql),
    getConnectionStatus: () => duckDBManager.getConnectionStatus(),
    ensureConnection: () => duckDBManager.ensureConnection()
};

window.updateConnectionStatus = (status, message) => duckDBManager.updateConnectionStatus(status, message);
window.getConnectionStatus = () => duckDBManager.getConnectionStatus();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.stopConnectionMonitoring) {
        window.stopConnectionMonitoring();
    }
    duckDBManager.close();
});

export default duckDBManager;
export { duckDBManager };