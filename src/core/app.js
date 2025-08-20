/**
 * App Core - Main Application Initialization and Management
 * Consolidated from core.js and enhanced-core.js with database service integration
 */

// Import utilities from shared locations
import { FormatUtils } from '../shared/formatters.js';
import { ColorUtils } from '../shared/color-utils.js';
import { DataUtils } from '../shared/data-utils.js';
import { databaseService } from './database.js';

// Re-export utilities for backward compatibility
export { FormatUtils, ColorUtils, DataUtils };

// ===== ENHANCED CORE FUNCTIONALITY =====

// Import enhanced functionality
import { OfflineDataManager } from '../shared/offline-manager.js';
import { DataProcessingWorkerClient, BackgroundSyncClient } from '../shared/enhanced-clients.js';
import { CacheManager } from '../shared/enhanced-storage.js';
import { ErrorHandler } from '../shared/error-handler.js';
import appConfig from './config.js';

export class EnhancedDuckDBManager {
    constructor() {
        this.isInitialized = false;
        this.statusCallbacks = [];
        this.datasets = new Map();
        
        // Use the shared database service
        this.databaseService = databaseService;
        
        // Initialize components
        this.offlineDataManager = new OfflineDataManager();
        this.dataProcessingWorkerClient = new DataProcessingWorkerClient();
        this.backgroundSyncClient = new BackgroundSyncClient();
        this.cacheManager = new CacheManager();
        
        // Initialize offline data manager
        this.initializeOfflineSupport();
    }

    /**
     * Initialize offline support
     */
    async initializeOfflineSupport() {
        try {
            await this.offlineDataManager.initialize();
            await this.cacheManager.initialize();
            
            // Set up background sync if enabled
            if (appConfig.features.backgroundSync) {
                await this.backgroundSyncClient.initialize();
            }
            
        } catch (error) {
            ErrorHandler.handleError(error, 'EnhancedDuckDBManager Offline Initialization', 'warning');
        }
    }

    // ===== DATABASE SERVICE DELEGATION =====

    addStatusCallback(callback) {
        return this.databaseService.addStatusCallback(callback);
    }

    removeStatusCallback(callback) {
        return this.databaseService.removeStatusCallback(callback);
    }

    updateConnectionStatus(status, message = '') {
        return this.databaseService.updateConnectionStatus(status, message);
    }

    getConnectionStatus() {
        return this.databaseService.getConnectionStatus();
    }

    async initDuckDB() {
        const result = await this.databaseService.initDuckDB();
        this.isInitialized = true;
        return result;
    }

    async loadParquetData(parquetPath) {
        return await this.databaseService.loadParquetData(parquetPath);
    }

    async checkConnectionHealth() {
        return await this.databaseService.checkConnectionHealth();
    }

    async ensureConnection() {
        return await this.databaseService.ensureConnection();
    }

    async query(sql) {
        return await this.databaseService.query(sql);
    }

    async executeQuery(sql) {
        return await this.databaseService.executeQuery(sql);
    }

    async getSchema() {
        return await this.databaseService.getSchema();
    }

    async getTableSchema() {
        return await this.databaseService.getTableSchema();
    }

    async queryAggregatedData(minValue, partyFilter, categoryFilter, searchFilter) {
        return await this.databaseService.queryAggregatedData(minValue, partyFilter, categoryFilter, searchFilter);
    }

    async getValueRange(partyFilter, categoryFilter, searchFilter) {
        return await this.databaseService.getValueRange(partyFilter, categoryFilter, searchFilter);
    }

    async getFilterOptions() {
        return await this.databaseService.getFilterOptions();
    }

    startConnectionMonitoring(intervalMs) {
        return this.databaseService.startConnectionMonitoring(intervalMs);
    }

    stopConnectionMonitoring() {
        return this.databaseService.stopConnectionMonitoring();
    }

    async close() {
        return await this.databaseService.close();
    }

    // ===== ENHANCED FUNCTIONALITY =====

    /**
     * Load dataset with offline capabilities
     * @param {string} datasetId - Dataset identifier
     * @param {string} url - Data source URL
     * @param {Object} options - Loading options
     */
    async loadDatasetWithOfflineSupport(datasetId, url, options = {}) {
        try {
            // Check if data is available offline
            const offlineData = await this.offlineDataManager.getDataset(datasetId);
            if (offlineData && !options.forceUpdate) {
                this.datasets.set(datasetId, offlineData);
                this.updateConnectionStatus('connected', `✅ ${datasetId} (offline)`);
                return offlineData;
            }

            // Load from network
            this.updateConnectionStatus('connecting', `Loading ${datasetId}...`);
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            const data = new Uint8Array(arrayBuffer);

            // Store offline for future use
            await this.offlineDataManager.storeDataset(datasetId, data, {
                url,
                timestamp: Date.now(),
                size: data.length
            });

            // Register with database
            await this.databaseService.db.registerFileBuffer(`${datasetId}.parquet`, data);
            
            await this.databaseService.conn.query(`
                CREATE OR REPLACE VIEW ${datasetId} AS 
                SELECT * FROM read_parquet('${datasetId}.parquet')
            `);

            const countResult = await this.databaseService.conn.query(`SELECT COUNT(*) as total FROM ${datasetId}`);
            const totalRecords = countResult.toArray()[0].total;

            this.datasets.set(datasetId, data);
            this.updateConnectionStatus('connected', `✅ ${datasetId} • ${FormatUtils.formatNumberAbbreviated(totalRecords)} records`);
            
            return data;

        } catch (error) {
            ErrorHandler.handleError(error, 'Enhanced Dataset Loading');
            
            // Try to fall back to cached data
            const cachedData = await this.cacheManager.get(`dataset_${datasetId}`);
            if (cachedData) {
                this.datasets.set(datasetId, cachedData);
                this.updateConnectionStatus('connected', `✅ ${datasetId} (cached)`);
                return cachedData;
            }
            
            throw error;
        }
    }

    /**
     * Process data using worker client
     * @param {string} operation - Processing operation
     * @param {*} data - Data to process
     * @param {Object} options - Processing options
     */
    async processDataInWorker(operation, data, options = {}) {
        try {
            return await this.dataProcessingWorkerClient.processData(operation, data, options);
        } catch (error) {
            ErrorHandler.handleError(error, 'Enhanced Data Processing');
            throw error;
        }
    }

    /**
     * Get cached query result
     * @param {string} sql - SQL query
     * @param {Object} options - Cache options
     */
    async getCachedQueryResult(sql, options = {}) {
        const cacheKey = `query_${this.generateQueryHash(sql)}`;
        
        try {
            const cached = await this.cacheManager.get(cacheKey);
            if (cached && !this.isCacheExpired(cached, options.ttl || 300000)) {
                return cached.data;
            }
        } catch (error) {
            // Cache miss, continue to execute query
        }

        // Execute query and cache result
        const result = await this.executeQuery(sql);
        
        try {
            await this.cacheManager.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            }, options.ttl);
        } catch (error) {
            // Cache storage failed, but query succeeded
            console.warn('Failed to cache query result:', error);
        }

        return result;
    }

    /**
     * Generate hash for query caching
     * @param {string} sql - SQL query
     */
    generateQueryHash(sql) {
        // Simple hash function for SQL queries
        let hash = 0;
        for (let i = 0; i < sql.length; i++) {
            const char = sql.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString();
    }

    /**
     * Check if cached data is expired
     * @param {Object} cached - Cached data with timestamp
     * @param {number} ttl - Time to live in milliseconds
     */
    isCacheExpired(cached, ttl) {
        return Date.now() - cached.timestamp > ttl;
    }

    /**
     * Get system status including offline capabilities
     */
    async getSystemStatus() {
        const status = {
            database: this.getConnectionStatus(),
            offline: await this.offlineDataManager.getStatus(),
            cache: await this.cacheManager.getStatus(),
            datasets: Array.from(this.datasets.keys()),
            isInitialized: this.isInitialized
        };

        if (appConfig.features.backgroundSync) {
            status.backgroundSync = await this.backgroundSyncClient.getStatus();
        }

        return status;
    }

    /**
     * Cleanup and dispose of resources
     */
    async dispose() {
        await this.close();
        
        if (this.offlineDataManager) {
            await this.offlineDataManager.dispose();
        }
        
        if (this.cacheManager) {
            await this.cacheManager.dispose();
        }
        
        if (this.dataProcessingWorkerClient) {
            await this.dataProcessingWorkerClient.dispose();
        }
        
        if (this.backgroundSyncClient) {
            await this.backgroundSyncClient.dispose();
        }
    }
}

// Create singleton instances for backward compatibility
const duckDBManager = databaseService; // Use database service directly for simple operations
const enhancedDuckDBManager = new EnhancedDuckDBManager();

// Export both for different use cases
export default duckDBManager;
export { duckDBManager, enhancedDuckDBManager, databaseService };