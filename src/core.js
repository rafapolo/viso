import * as duckdb from '../vendor/js/duckdb-module.js';

// Import utilities from new locations
import { FormatUtils } from './shared/formatters.js';
import { ColorUtils } from './shared/color-utils.js';
import { DataUtils } from './shared/data-utils.js';

// d3 should already be available globally from script tag in HTML

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

    async loadParquetData() {
        try {
            const bucket = 'baseldosdados';
            const prefix = 'br_camara_dados_abertos/despesa/';
            const endpoint = window.__S3_ENDPOINT__ || 'https://hel1.your-objectstorage.com';
            
            this.updateConnectionStatus('connecting', 'Gerando URLs assinadas...');
            
            // List of parquet files (from earlier discovery)
            const files = [
                '000000000000.parquet', '000000000001.parquet', '000000000002.parquet',
                '000000000003.parquet', '000000000004.parquet', '000000000005.parquet',
                '000000000006.parquet', '000000000007.parquet', '000000000008.parquet',
                '000000000009.parquet', '000000000010.parquet', '000000000011.parquet',
                '000000000012.parquet', '000000000013.parquet', '000000000014.parquet',
                '000000000015.parquet', '000000000016.parquet', '000000000017.parquet',
                '000000000018.parquet', '000000000019.parquet', '000000000020.parquet',
                '000000000021.parquet'
            ];
            
            this.updateConnectionStatus('connecting', `Baixando ${files.length} arquivos...`);
            
            // Download and register each file
            const buffers = [];
            for (let i = 0; i < files.length; i++) {
                const filename = files[i];
                const url = `${endpoint}/${bucket}/${prefix}${filename}`;
                
                this.updateConnectionStatus('connecting', `Baixando ${i + 1}/${files.length}...`);
                
                try {
                    const response = await fetch(url);
                    if (!response.ok) {
                        console.warn(`Failed to fetch ${filename}: ${response.status}`);
                        continue;
                    }
                    
                    const buffer = await response.arrayBuffer();
                    const localName = `despesas_${i}.parquet`;
                    await this.db.registerFileBuffer(localName, new Uint8Array(buffer));
                    buffers.push(localName);
                } catch (fetchError) {
                    console.warn(`Error fetching ${filename}:`, fetchError.message);
                }
            }
            
            if (buffers.length === 0) {
                throw new Error('Nenhum arquivo foi baixado');
            }
            
            this.updateConnectionStatus('connecting', 'Processando dados...');
            
            // Create view from all local files
            const unionQueries = buffers.map(name => 
                `SELECT * FROM read_parquet('${name}')`
            ).join(' UNION ALL ');
            
            await this.conn.query(`
                CREATE OR REPLACE VIEW despesas AS 
                SELECT 
                    nome_parlamentar,
                    sigla_partido,
                    sigla_uf,
                    fornecedor,
                    cnpj_cpf_fornecedor,
                    categoria_despesa,
                    subcategoria_despesa,
                    tipo_documento,
                    valor_documento,
                    valor_retido,
                    valor_liquido,
                    data_emissao
                FROM (${unionQueries})
            `);
            
            const countResult = await this.conn.query("SELECT COUNT(*) as total FROM despesas");
            const totalRecords = countResult.toArray()[0].total;
            
            this.updateConnectionStatus('connected', `✅ ${FormatUtils.formatNumberAbbreviated(totalRecords)} records`);
            return totalRecords;
            
        } catch (error) {
            console.error('❌ Error loading parquet:', error);
            this.updateConnectionStatus('error', `Erro: ${error.message}`);
            throw error;
        }
    }
    
    async configureS3() {
        const accessKeyId = window.__S3_ACCESS_KEY_ID__ || '';
        const secretAccessKey = window.__S3_SECRET_ACCESS_KEY__ || '';
        const endpoint = window.__S3_ENDPOINT__ || 'https://hel1.your-objectstorage.com';
        
        await this.conn.query(`
            SET s3_access_key_id = '${accessKeyId}';
            SET s3_secret_access_key = '${secretAccessKey}';
            SET s3_endpoint = '${endpoint.replace('https://', '')}';
            SET s3_use_ssl = true;
            SET s3_url_style = 'path';
            SET s3_region = 'us-east-1';
        `);
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

    async queryAggregatedData(minValue = 0, partyFilter = '', categoryFilter = '', searchFilter = '', applyDefaultMinFloor = true) {
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
        
        const effectiveMinValue = applyDefaultMinFloor
            ? Math.max(minValue, 1000)
            : Math.max(minValue, 0);

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

    startConnectionMonitoring(intervalMs = 30000) {
        this.stopConnectionMonitoring();
        
        this.monitoringInterval = setInterval(async () => {
            try {
                await this.checkConnectionHealth();
            } catch (error) {
                console.warn('Connection monitoring check failed:', error);
            }
        }, intervalMs);
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

const duckDBManager = new DuckDBManager();

// Global API for compatibility with existing code
window.duckdbAPI = {
    initDuckDB: () => duckDBManager.initDuckDB(),
    loadParquetData: () => duckDBManager.loadParquetData(),
    queryAggregatedData: (minValue, partyFilter, categoryFilter, searchFilter, applyDefaultMinFloor = true) => 
        duckDBManager.queryAggregatedData(minValue, partyFilter, categoryFilter, searchFilter, applyDefaultMinFloor),
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
