// API Utilities for DuckDB and other API interactions
import { APP_CONSTANTS } from '../core/config.js';

export interface QueryResult {
  data: Record<string, unknown>[];
  columns?: string[];
  executionTime?: number;
  success: boolean;
  error?: string;
}

export interface PaginatedResult extends QueryResult {
  currentPage: number;
  pageSize: number;
  hasMore: boolean;
}

export interface FilterOptions {
  minValue?: number;
  maxValue?: number;
  partyFilter?: string;
  categoryFilter?: string;
  searchFilter?: string;
  dateRange?: { start: string; end: string };
}

export class APIUtils {
  private static rateLimitStore: Map<string, number[]> | null = null;

  static async executeDuckDBQuery(sql: string): Promise<QueryResult> {
    if (!window.duckdbAPI) throw new Error('DuckDB API not available');
    try {
      const startTime = performance.now();
      const result = await window.duckdbAPI.executeQuery(sql);
      const endTime = performance.now();
      return {
        ...(result as object),
        executionTime: endTime - startTime,
        success: true,
      } as QueryResult;
    } catch (error) {
      throw new Error(`Query execution failed: ${(error as Error).message}`);
    }
  }

  static async initializeDuckDB(): Promise<{ success: true }> {
    if (!window.duckdbAPI) throw new Error('DuckDB API not loaded');
    try {
      await window.duckdbAPI.initDuckDB();
      return { success: true };
    } catch (error) {
      throw new Error(`DuckDB initialization failed: ${(error as Error).message}`);
    }
  }

  static async loadParquetData(
    filePath = './despesas.parquet',
    onProgress: ((msg: string) => void) | null = null
  ): Promise<unknown> {
    if (!window.duckdbAPI) throw new Error('DuckDB API not available');
    try {
      if (onProgress) onProgress('Loading parquet data...');
      const totalRecords = await window.duckdbAPI.loadParquetData(filePath);
      if (onProgress) onProgress(`Loaded ${(totalRecords as number).toLocaleString()} records`);
      return totalRecords;
    } catch (error) {
      throw new Error(`Failed to load data: ${(error as Error).message}`);
    }
  }

  static async getDatabaseSchema(): Promise<Record<string, unknown>[]> {
    if (!window.duckdbAPI) throw new Error('DuckDB API not available');
    try {
      return await window.duckdbAPI.getSchema();
    } catch (error) {
      throw new Error(`Schema retrieval failed: ${(error as Error).message}`);
    }
  }

  static async waitForDuckDBAPI(
    maxAttempts: number = APP_CONSTANTS.TIMING.MAX_INIT_ATTEMPTS,
    intervalMs = 100
  ): Promise<boolean> {
    let attempts = 0;
    while (typeof window.duckdbAPI === 'undefined' && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      attempts++;
    }
    return typeof window.duckdbAPI !== 'undefined';
  }

  static async executePaginatedQuery(
    baseQuery: string,
    page = 1,
    pageSize: number = APP_CONSTANTS.PAGINATION.ROWS_PER_PAGE
  ): Promise<PaginatedResult> {
    const offset = (page - 1) * pageSize;
    const paginatedQuery = `${baseQuery} LIMIT ${pageSize} OFFSET ${offset}`;
    const result = await this.executeDuckDBQuery(paginatedQuery);
    return {
      ...result,
      currentPage: page,
      pageSize,
      hasMore: result.data.length === pageSize,
    };
  }

  static async executeMultipleQueries(
    queries: string[],
    onProgress: ((msg: string) => void) | null = null
  ): Promise<(QueryResult | { success: false; error: string })[]> {
    const results: (QueryResult | { success: false; error: string })[] = [];
    for (let i = 0; i < queries.length; i++) {
      if (onProgress) onProgress(`Executing query ${i + 1} of ${queries.length}...`);
      try {
        results.push(await this.executeDuckDBQuery(queries[i]));
      } catch (error) {
        results.push({ success: false, error: (error as Error).message });
      }
    }
    return results;
  }

  static async checkConnectionHealth(): Promise<boolean> {
    try {
      const result = await this.executeDuckDBQuery('SELECT 1 as test');
      return result.success && result.data.length > 0;
    } catch {
      return false;
    }
  }

  static buildFilterClause(filters: FilterOptions = {}): string {
    const conditions: string[] = [];
    const { minValue, maxValue, partyFilter, categoryFilter, searchFilter, dateRange } = filters;

    if (minValue !== undefined && minValue > 0) {
      conditions.push(`valor_liquido >= ${minValue}`);
    }
    if (maxValue !== undefined) {
      conditions.push(`valor_liquido <= ${maxValue}`);
    }
    if (partyFilter?.trim()) {
      conditions.push(`sigla_partido = '${partyFilter.replace(/'/g, "''")}'`);
    }
    if (categoryFilter?.trim()) {
      conditions.push(`categoria_despesa = '${categoryFilter.replace(/'/g, "''")}'`);
    }
    if (searchFilter?.trim()) {
      const searchTerm = searchFilter.replace(/'/g, "''");
      conditions.push(`(
        nome_parlamentar ILIKE '%${searchTerm}%' OR
        fornecedor ILIKE '%${searchTerm}%' OR
        categoria_despesa ILIKE '%${searchTerm}%'
      )`);
    }
    if (dateRange?.start && dateRange?.end) {
      conditions.push(`data_emissao BETWEEN '${dateRange.start}' AND '${dateRange.end}'`);
    }

    return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  }

  static escapeSQLString(value: string | unknown): string {
    if (typeof value !== 'string') return value as string;
    return value.replace(/'/g, "''");
  }

  static formatSQL(sql: string): string {
    if (!sql || typeof sql !== 'string') return sql;
    try {
      if (typeof window.sqlFormatter !== 'undefined' && window.sqlFormatter.format) {
        return window.sqlFormatter.format(sql.trim(), {
          language: 'sql',
          indent: '    ',
          uppercase: true,
          linesBetweenQueries: 2,
        });
      }
      return sql.trim();
    } catch {
      return sql.trim();
    }
  }

  static exportToCSV(
    results: { data: Record<string, unknown>[]; columns: string[] },
    filename = 'query_results.csv'
  ): void {
    if (!results?.data || !results?.columns) {
      throw new Error('Invalid results data for CSV export');
    }
    try {
      const headers = results.columns.join(',');
      const rows = results.data.map((row) =>
        results.columns
          .map((col) => {
            const value = row[col];
            if (value === null || value === undefined) return '';
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          })
          .join(',')
      );

      const csvContent = [headers, ...rows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      throw new Error(`Failed to export CSV: ${(error as Error).message}`);
    }
  }

  static withRetry<T extends unknown[]>(
    apiCall: (...args: T) => Promise<unknown>,
    maxRetries = 3,
    delayMs = 1000
  ): (...args: T) => Promise<unknown> {
    return async (...args: T) => {
      let lastError: Error | undefined;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await apiCall(...args);
        } catch (error) {
          lastError = error as Error;
          if (attempt < maxRetries) {
            await new Promise((resolve) =>
              setTimeout(resolve, delayMs * Math.pow(2, attempt))
            );
          }
        }
      }
      throw lastError;
    };
  }
}
