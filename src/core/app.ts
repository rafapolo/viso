/**
 * App Core - Main Application Initialization and Management
 */

import { FormatUtils } from '../shared/formatters.js';
import { ColorUtils } from '../shared/color-utils.js';
import { DataUtils } from '../shared/data-utils.js';
import { databaseService } from './database.js';

export { FormatUtils, ColorUtils, DataUtils };

import { OfflineDataManager } from '../shared/offline-manager.js';
import { DataProcessingWorkerClient, BackgroundSyncClient } from '../shared/enhanced-clients.js';
import { CacheManager } from '../shared/enhanced-storage.js';
import { ErrorHandler } from '../shared/error-handler.js';
import appConfig from './config.js';

type StatusCallback = (status: string, message: string) => void;

export class EnhancedDuckDBManager {
  isInitialized: boolean;
  private statusCallbacks: StatusCallback[];
  private datasets: Map<string, unknown>;

  databaseService: typeof databaseService;
  private offlineDataManager: OfflineDataManager;
  private dataProcessingWorkerClient: DataProcessingWorkerClient;
  private backgroundSyncClient: BackgroundSyncClient;
  private cacheManager: CacheManager;

  constructor() {
    this.isInitialized = false;
    this.statusCallbacks = [];
    this.datasets = new Map();

    this.databaseService = databaseService;

    this.offlineDataManager = new OfflineDataManager();
    this.dataProcessingWorkerClient = new DataProcessingWorkerClient();
    this.backgroundSyncClient = new BackgroundSyncClient();
    this.cacheManager = new CacheManager();

    this.initializeOfflineSupport();
  }

  async initializeOfflineSupport(): Promise<void> {
    try {
      await this.offlineDataManager.initialize();
      await this.cacheManager.initialize();

      if (appConfig.features.backgroundSync) {
        await this.backgroundSyncClient.initialize();
      }
    } catch (error) {
      ErrorHandler.handleError(error as Error, 'EnhancedDuckDBManager Offline Initialization', 'warning');
    }
  }

  // ===== DATABASE SERVICE DELEGATION =====

  addStatusCallback(callback: StatusCallback): void {
    return this.databaseService.addStatusCallback(callback);
  }

  removeStatusCallback(callback: StatusCallback): void {
    return this.databaseService.removeStatusCallback(callback);
  }

  updateConnectionStatus(status: string, message = ''): void {
    return this.databaseService.updateConnectionStatus(status, message);
  }

  getConnectionStatus(): string {
    return this.databaseService.getConnectionStatus();
  }

  async initDuckDB(): Promise<ReturnType<typeof databaseService.initDuckDB>> {
    const result = await this.databaseService.initDuckDB();
    this.isInitialized = true;
    return result;
  }

  async loadParquetData(parquetPath?: string): Promise<number> {
    return this.databaseService.loadParquetData(parquetPath ?? null);
  }

  async checkConnectionHealth(): Promise<boolean> {
    return this.databaseService.checkConnectionHealth();
  }

  async ensureConnection(): Promise<boolean> {
    return this.databaseService.ensureConnection();
  }

  async query(sql: string): Promise<ReturnType<typeof databaseService.query>> {
    return this.databaseService.query(sql);
  }

  async executeQuery(sql: string): Promise<ReturnType<typeof databaseService.executeQuery>> {
    return this.databaseService.executeQuery(sql);
  }

  async getSchema(): Promise<Record<string, unknown>[]> {
    return this.databaseService.getSchema();
  }

  async getTableSchema(): Promise<Record<string, unknown>[]> {
    return this.databaseService.getTableSchema();
  }

  async queryAggregatedData(
    minValue?: number,
    partyFilter?: string,
    categoryFilter?: string,
    searchFilter?: string
  ): Promise<Record<string, unknown>[]> {
    return this.databaseService.queryAggregatedData(minValue, partyFilter, categoryFilter, searchFilter);
  }

  async getValueRange(
    partyFilter?: string,
    categoryFilter?: string,
    searchFilter?: string
  ): Promise<{ min: number; max: number }> {
    return this.databaseService.getValueRange(partyFilter, categoryFilter, searchFilter);
  }

  async getFilterOptions(): Promise<{ parties: string[]; categories: string[] }> {
    return this.databaseService.getFilterOptions();
  }

  startConnectionMonitoring(intervalMs?: number): void {
    return this.databaseService.startConnectionMonitoring(intervalMs ?? null);
  }

  stopConnectionMonitoring(): void {
    return this.databaseService.stopConnectionMonitoring();
  }

  async close(): Promise<void> {
    return this.databaseService.close();
  }

  // ===== ENHANCED FUNCTIONALITY =====

  async loadDatasetWithOfflineSupport(
    datasetId: string,
    url: string,
    options: { forceUpdate?: boolean } = {}
  ): Promise<unknown> {
    try {
      const offlineData = await (this.offlineDataManager as unknown as { getDataset: (id: string) => Promise<unknown> }).getDataset(datasetId);
      if (offlineData && !options.forceUpdate) {
        this.datasets.set(datasetId, offlineData);
        this.updateConnectionStatus('connected', `✅ ${datasetId} (offline)`);
        return offlineData;
      }

      this.updateConnectionStatus('connecting', `Loading ${datasetId}...`);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);

      await (this.offlineDataManager as unknown as { storeDataset: (id: string, d: Uint8Array, meta: Record<string, unknown>) => Promise<void> }).storeDataset(datasetId, data, {
        url,
        timestamp: Date.now(),
        size: data.length,
      });

      await this.databaseService.db!.registerFileBuffer(`${datasetId}.parquet`, data);

      await this.databaseService.conn!.query(`
        CREATE OR REPLACE VIEW ${datasetId} AS
        SELECT * FROM read_parquet('${datasetId}.parquet')
      `);

      const countResult = await this.databaseService.conn!.query(`SELECT COUNT(*) as total FROM ${datasetId}`);
      const totalRecords = countResult.toArray()[0]['total'] as number;

      this.datasets.set(datasetId, data);
      this.updateConnectionStatus('connected', `✅ ${datasetId} • ${FormatUtils.formatNumberAbbreviated(totalRecords)} records`);

      return data;
    } catch (error) {
      ErrorHandler.handleError(error as Error, 'Enhanced Dataset Loading');

      const cachedData = await this.cacheManager.get(`dataset_${datasetId}`);
      if (cachedData) {
        this.datasets.set(datasetId, cachedData);
        this.updateConnectionStatus('connected', `✅ ${datasetId} (cached)`);
        return cachedData;
      }

      throw error;
    }
  }

  async processDataInWorker(
    operation: string,
    data: unknown,
    options: Record<string, unknown> = {}
  ): Promise<unknown> {
    try {
      // DataProcessingWorkerClient uses executeQuery/aggregateData; map generic operation call
      return await this.dataProcessingWorkerClient.executeQuery(
        operation,
        { data, ...options }
      );
    } catch (error) {
      ErrorHandler.handleError(error as Error, 'Enhanced Data Processing');
      throw error;
    }
  }

  async getCachedQueryResult(
    sql: string,
    options: { ttl?: number } = {}
  ): Promise<unknown> {
    const cacheKey = `query_${this.generateQueryHash(sql)}`;

    try {
      const cached = await this.cacheManager.get(cacheKey) as { data: unknown; timestamp: number } | null;
      if (cached && !this.isCacheExpired(cached, options.ttl || 300000)) {
        return cached.data;
      }
    } catch {
      // Cache miss, continue to execute query
    }

    const result = await this.executeQuery(sql);

    try {
      await this.cacheManager.set(cacheKey, { data: result, timestamp: Date.now() }, { ttl: options.ttl });
    } catch (error) {
      console.warn('Failed to cache query result:', error);
    }

    return result;
  }

  generateQueryHash(sql: string): string {
    let hash = 0;
    for (let i = 0; i < sql.length; i++) {
      const char = sql.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }

  isCacheExpired(cached: { timestamp: number }, ttl: number): boolean {
    return Date.now() - cached.timestamp > ttl;
  }

  async getSystemStatus(): Promise<Record<string, unknown>> {
    const status: Record<string, unknown> = {
      database: this.getConnectionStatus(),
      offline: await (this.offlineDataManager as unknown as { getStatus: () => Promise<unknown> }).getStatus(),
      cache: await (this.cacheManager as unknown as { getStatus: () => Promise<unknown> }).getStatus(),
      datasets: Array.from(this.datasets.keys()),
      isInitialized: this.isInitialized,
    };

    if (appConfig.features.backgroundSync) {
      status['backgroundSync'] = await (this.backgroundSyncClient as unknown as { getStatus: () => Promise<unknown> }).getStatus();
    }

    return status;
  }

  async dispose(): Promise<void> {
    await this.close();

    await (this.offlineDataManager as unknown as { dispose?: () => Promise<void> }).dispose?.();
    await (this.cacheManager as unknown as { dispose?: () => Promise<void> }).dispose?.();
    await (this.dataProcessingWorkerClient as unknown as { dispose?: () => Promise<void> }).dispose?.();
    await (this.backgroundSyncClient as unknown as { dispose?: () => Promise<void> }).dispose?.();
  }
}

const duckDBManager = databaseService;
const enhancedDuckDBManager = new EnhancedDuckDBManager();

export default duckDBManager;
export { duckDBManager, enhancedDuckDBManager, databaseService };
