/**
 * Consolidated Database Service
 * Merges db-api.js, db-config.js, and database-service.js into a unified service
 */

import * as duckdb from '../../vendor/js/duckdb-module.js';
import { format as sqlFormat } from '../../vendor/js/sql-formatter-module.js';
import { FormatUtils } from '../shared/formatters.js';
import { ErrorHandler } from '../shared/error-handler.js';

/**
 * Unified Database Service
 * Centralizes all DuckDB functionality and provides a consistent interface
 */
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

    async initDuckDB() {
        try {
            // Wait for Apache Arrow to be available
            if (typeof window.Arrow === 'undefined' && !window.arrowReady) {
                this.updateConnectionStatus('connecting', 'Aguardando Apache Arrow...');
                await new Promise((resolve, _reject) => {
                    let attempts = 0;
                    const maxAttempts = 300; // 30 seconds max wait
                    const checkArrow = () => {
                        attempts++;
                        if (typeof window.Arrow !== 'undefined' || window.arrowReady) {
                            resolve();
                        } else if (attempts >= maxAttempts) {
                            console.warn('Apache Arrow loading timeout - continuing anyway');
                            resolve(); // Continue anyway rather than failing
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
            await this.db.instantiate(bundle.mainModule, bundle.pthreadWorker);
            
            this.updateConnectionStatus('connecting', 'Estabelecendo conexão...');
            this.conn = await this.db.connect();
            
            this.updateConnectionStatus('connecting', 'Testando conexão...');
            await this.conn.query('SELECT 1 as test');
            
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

    async loadParquetData(parquetPath = null) {
        const path = parquetPath || this.config.parquetPath;
        
        try {
            this.updateConnectionStatus('connecting', 'Carregando dados...');
            
            const response = await fetch(path);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            
            this.updateConnectionStatus('connecting', 'Processando dados...');
            
            await this.db.registerFileBuffer('despesas.parquet', new Uint8Array(arrayBuffer));
            
            await this.conn.query(`
                CREATE OR REPLACE VIEW despesas AS 
                SELECT * FROM read_parquet('despesas.parquet')
            `);
            
            const countResult = await this.conn.query("SELECT COUNT(*) as total FROM despesas");
            const totalRecords = countResult.toArray()[0].total;
            
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
            throw new Error(`Connection recovery failed: ${error.message}`);
        }
    }

    async query(sql) {
        await this.ensureConnection();
        return await this.conn.query(sql);
    }

    async executeQuery(sql) {
        try {
            const startTime = performance.now();
            await this.ensureConnection();
            const result = await this.conn.query(sql);
            const endTime = performance.now();
            const executionTime = endTime - startTime;
            
            return {
                data: result.toArray(),
                columns: result.schema.fields.map(f => f.name),
                rowCount: result.numRows,
                executionTime
            };
        } catch (error) {
            throw new Error(error.message);
        }
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
        
        const result = await this.conn.query(query);
        const data = result.toArray();
        
        return data;
    }

    async getValueRange(partyFilter = '', categoryFilter = '', searchFilter = '') {
        await this.ensureConnection();
        
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
        
        const result = await this.conn.query(query);
        const data = result.toArray();
        
        if (data.length && data[0].min_valor !== null) {
            const range = {
                min: Math.max(0, Number(data[0].min_valor)) || 0,
                max: Number(data[0].max_valor)
            };
            return range;
        }
        
        return { min: 0, max: 100000 };
    }

    async getFilterOptions() {
        await this.ensureConnection();
        
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

    startConnectionMonitoring(intervalMs = null) {
        const interval = intervalMs || this.config.monitoringInterval;
        this.stopConnectionMonitoring();
        
        this.monitoringInterval = setInterval(async () => {
            try {
                await this.checkConnectionHealth();
            } catch (error) {
                console.warn('Connection monitoring check failed:', error);
            }
        }, interval);
    }

    stopConnectionMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
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

// ===== TAILWIND CONFIGURATION =====

/**
 * Tailwind CSS configuration for database interface
 */
export function configureTailwind() {
    if (typeof window.tailwind === 'undefined') {
        setTimeout(configureTailwind, 100);
        return;
    }
    
    window.tailwind.config = {
        darkMode: 'class',
        theme: {
            extend: {
                colors: {
                    'duckdb': {
                        50: '#fffbeb',
                        100: '#fef3c7',
                        200: '#fde68a',
                        300: '#fcd34d',
                        400: '#fbbf24', 
                        500: '#FFC000', // DuckDB yellow
                        600: '#d97706',
                        700: '#b45309',
                        800: '#92400e',
                        900: '#78350f'
                    }
                },
                fontFamily: {
                    'sans': ['Monda', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif']
                }
            }
        }
    };
}

// ===== GLOBAL API SETUP =====

// Create global database service instance
const databaseService = new DatabaseService();

// Global API for compatibility with existing code
window.duckdbAPI = {
    async initDuckDB() {
        return await databaseService.initDuckDB();
    },
    
    async loadParquetData(path) {
        return await databaseService.loadParquetData(path);
    },
    
    async executeQuery(sql) {
        return await databaseService.executeQuery(sql);
    },
    
    async getSchema() {
        return await databaseService.getSchema();
    },
    
    async queryAggregatedData(minValue, partyFilter, categoryFilter, searchFilter) {
        return await databaseService.queryAggregatedData(minValue, partyFilter, categoryFilter, searchFilter);
    },
    
    async getValueRange(partyFilter, categoryFilter, searchFilter) {
        return await databaseService.getValueRange(partyFilter, categoryFilter, searchFilter);
    },
    
    async getFilterOptions() {
        return await databaseService.getFilterOptions();
    },
    
    async checkConnectionHealth() {
        return await databaseService.checkConnectionHealth();
    },
    
    async query(sql) {
        return await databaseService.query(sql);
    },
    
    getConnectionStatus() {
        return databaseService.getConnectionStatus();
    },
    
    async ensureConnection() {
        return await databaseService.ensureConnection();
    }
};

// Global status update functions
window.updateConnectionStatus = (status, message) => databaseService.updateConnectionStatus(status, message);
window.getConnectionStatus = () => databaseService.getConnectionStatus();

// SQL formatter setup
window.sqlFormatter = { format: sqlFormat };

// D3 Sankey setup
const d3Sankey = window.d3?.sankey;
const sankeyLinkHorizontal = window.d3?.sankeyLinkHorizontal;
window.d3Sankey = d3Sankey;
window.d3SankeyLinkHorizontal = sankeyLinkHorizontal;

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.stopConnectionMonitoring) {
        window.stopConnectionMonitoring();
    }
    databaseService.close();
});

// Start Tailwind configuration
configureTailwind();

export default databaseService;
export { databaseService };