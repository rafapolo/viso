// Database API setup for db.html
import { format } from '../vendor/js/sql-formatter-module.js';
import { duckDBManager } from './core/app.js';

// D3 Sankey functions available from global d3 object loaded via script tag
const d3 = window.d3 as Record<string, unknown> | undefined;
const d3Sankey = d3?.['sankey'];
const sankeyLinkHorizontal = d3?.['sankeyLinkHorizontal'];
window.d3Sankey = d3Sankey;
window.d3SankeyLinkHorizontal = sankeyLinkHorizontal;
window.sqlFormatter = { format };

window.duckdbAPI = {
  async initDuckDB() {
    return await duckDBManager.initDuckDB();
  },

  async loadParquetData() {
    return await duckDBManager.loadParquetData('./despesas.parquet');
  },

  async executeQuery(sql: string) {
    try {
      const startTime = performance.now();
      const result = await duckDBManager.query(sql);
      const endTime = performance.now();
      const executionTime = endTime - startTime;

      return {
        toArray: () => result.toArray(),
        schema: result.schema,
        numRows: result.numRows,
        // extra props for callers that destructure
        data: result.toArray(),
        columns: result.schema.fields.map((f: { name: string }) => f.name),
        rowCount: result.numRows,
        executionTime,
      } as unknown as import('@duckdb/duckdb-wasm').ArrowTable;
    } catch (error) {
      throw new Error((error as Error).message);
    }
  },

  async getSchema() {
    return await duckDBManager.getSchema() as Record<string, unknown>[];
  },

  async query(sql: string) {
    const result = await duckDBManager.query(sql);
    return { numRows: result.numRows, toArray: () => result.toArray() as Record<string, unknown>[] };
  },

  async getFilterOptions() {
    return duckDBManager.getFilterOptions();
  },

  async getValueRange(partyFilter = '', categoryFilter = '', searchFilter = '') {
    return duckDBManager.getValueRange(partyFilter, categoryFilter, searchFilter);
  },

  async queryAggregatedData(minValue = 0, partyFilter = '', categoryFilter = '', searchFilter = '') {
    return duckDBManager.queryAggregatedData(minValue, partyFilter, categoryFilter, searchFilter) as unknown as Record<string, unknown>[];
  },

  async checkConnectionHealth() {
    return duckDBManager.checkConnectionHealth();
  },
};
