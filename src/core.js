import * as duckdb from 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.28.0/+esm';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';

// Make d3 available globally
window.d3 = d3;

// ===== FORMAT UTILITIES =====
export class FormatUtils {
    static formatCurrency(value, options = {}) {
        const {
            locale = 'pt-BR',
            currency = 'BRL',
            minimumFractionDigits = 2,
            abbreviated = false
        } = options;

        if (abbreviated && typeof value === 'number') {
            if (value >= 1000000) {
                const millions = value / 1000000;
                return `R$ ${millions >= 10 ? millions.toFixed(0) : millions.toFixed(1)}M`;
            }
            if (value >= 10000) {
                return `R$ ${(value / 1000).toFixed(0)}K`;
            }
            if (value >= 1000) {
                return `R$ ${(value / 1000).toFixed(1)}K`;
            }
        }

        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency,
            minimumFractionDigits
        }).format(value);
    }

    static formatNumber(value, locale = 'pt-BR') {
        if (typeof value !== 'number') {
            return value;
        }
        return value.toLocaleString(locale);
    }

    static formatNumberAbbreviated(value, locale = 'pt-BR') {
        if (typeof value !== 'number') {
            return value;
        }
        
        if (value >= 1000000) {
            const millions = value / 1000000;
            return millions >= 10 ? `${millions.toFixed(0)}M` : `${millions.toFixed(1)}M`;
        }
        
        if (value >= 1000) {
            const thousands = value / 1000;
            return thousands >= 10 ? `${thousands.toFixed(0)}K` : `${thousands.toFixed(1)}K`;
        }
        
        return value.toLocaleString(locale);
    }

    static formatDate(dateStr, options = {}) {
        const {
            locale = 'pt-BR',
            format = 'short'
        } = options;

        if (!dateStr) return 'N/A';
        
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return 'Data inválida';

            if (format === 'short') {
                return new Intl.DateTimeFormat(locale, {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                }).format(date);
            } else if (format === 'long') {
                return new Intl.DateTimeFormat(locale, {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                }).format(date);
            } else {
                return new Intl.DateTimeFormat(locale, format).format(date);
            }
        } catch (error) {
            console.warn('Error formatting date:', dateStr, error);
            return 'Data inválida';
        }
    }

    static formatPercentage(value, decimals = 1) {
        if (typeof value !== 'number') return '0%';
        return `${value.toFixed(decimals)}%`;
    }

    static truncateText(text, maxLength = 50, suffix = '...') {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength - suffix.length) + suffix;
    }

    static formatSQL(sql, options = {}) {
        const {
            indent = '    ',
            uppercase = true,
            linesBetweenQueries = 2
        } = options;

        if (!sql || typeof sql !== 'string') return sql;

        try {
            if (typeof window.sqlFormatter !== 'undefined') {
                return window.sqlFormatter.format(sql.trim(), {
                    language: 'sql',
                    indent,
                    uppercase,
                    linesBetweenQueries
                });
            }
            
            return sql.trim().split('\n').map(line => line.trim()).join('\n');
        } catch (error) {
            console.warn('SQL formatting error:', error);
            return sql.trim();
        }
    }
}

export class ColorUtils {
    static categoryColors = [
        '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
        '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6B7280'
    ];

    static getCategoryColor(categoria, options = {}) {
        const { useHash = true, defaultColor = '#6B7280' } = options;
        
        if (!categoria) return defaultColor;
        
        if (!useHash) {
            return this.categoryColors[0];
        }

        let hash = 0;
        for (let i = 0; i < categoria.length; i++) {
            const char = categoria.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        
        const colorIndex = Math.abs(hash) % this.categoryColors.length;
        return this.categoryColors[colorIndex];
    }

    static adjustColorBrightness(color, percent) {
        const num = parseInt(color.replace("#", ""), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.min(255, Math.max(0, (num >> 16) + amt));
        const G = Math.min(255, Math.max(0, (num >> 8 & 0x00FF) + amt));
        const B = Math.min(255, Math.max(0, (num & 0x0000FF) + amt));
        return `#${(0x1000000 + (R * 0x10000) + (G * 0x100) + B).toString(16).slice(1)}`;
    }

    static hexToRgba(hex, alpha = 1) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (!result) return null;
        
        const r = parseInt(result[1], 16);
        const g = parseInt(result[2], 16);
        const b = parseInt(result[3], 16);
        
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    static getContrastColor(backgroundColor) {
        const rgb = this.hexToRgba(backgroundColor);
        if (!rgb) return '#000000';
        
        const values = rgb.match(/\d+/g);
        const brightness = (parseInt(values[0]) * 299 + parseInt(values[1]) * 587 + parseInt(values[2]) * 114) / 1000;
        
        return brightness > 128 ? '#000000' : '#FFFFFF';
    }

    static generateGradient(color, direction = 'to bottom', lighten = 20) {
        const lightColor = this.adjustColorBrightness(color, lighten);
        return `linear-gradient(${direction}, ${color}, ${lightColor})`;
    }
}

export class DataUtils {
    static safeToNumber(value) {
        if (typeof value === 'bigint') {
            return Number(value);
        }
        return value;
    }
    
    static convertNumericFields(obj, fields = ['total_value', 'transaction_count', 'valor_liquido', 'valor_documento']) {
        const result = { ...obj };
        fields.forEach(field => {
            if (result[field] !== undefined && result[field] !== null) {
                result[field] = this.safeToNumber(result[field]);
            }
        });
        return result;
    }

    static calculateStatistics(values) {
        if (!Array.isArray(values) || !values.length) {
            return {
                count: 0, sum: 0, mean: 0, median: 0, min: 0, max: 0, standardDeviation: 0
            };
        }

        const numericValues = values.filter(v => typeof v === 'number' && !isNaN(v));
        if (!numericValues.length) {
            return {
                count: 0, sum: 0, mean: 0, median: 0, min: 0, max: 0, standardDeviation: 0
            };
        }

        const sum = numericValues.reduce((acc, val) => acc + val, 0);
        const mean = sum / numericValues.length;
        
        const sortedValues = [...numericValues].sort((a, b) => a - b);
        const median = sortedValues.length % 2 === 0
            ? (sortedValues[sortedValues.length / 2 - 1] + sortedValues[sortedValues.length / 2]) / 2
            : sortedValues[Math.floor(sortedValues.length / 2)];

        const variance = numericValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / numericValues.length;
        const standardDeviation = Math.sqrt(variance);

        return {
            count: numericValues.length,
            sum,
            mean,
            median,
            min: Math.min(...numericValues),
            max: Math.max(...numericValues),
            standardDeviation
        };
    }

    static groupBy(array, keyFn) {
        return array.reduce((groups, item) => {
            const key = keyFn(item);
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(item);
            return groups;
        }, {});
    }

    static aggregateBy(array, keyFn, valueFn, aggregateFn = (values) => values.reduce((a, b) => a + b, 0)) {
        const groups = this.groupBy(array, keyFn);
        const result = {};
        
        for (const [key, items] of Object.entries(groups)) {
            const values = items.map(valueFn);
            result[key] = aggregateFn(values);
        }
        
        return result;
    }

    static createSlug(text) {
        if (!text) return '';
        return text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');
    }
}

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