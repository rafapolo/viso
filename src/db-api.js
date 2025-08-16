// Database API setup for db.html
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import { sankey as d3Sankey, sankeyLinkHorizontal } from 'https://cdn.jsdelivr.net/npm/d3-sankey@0.12.3/+esm';
import { format } from 'https://cdn.jsdelivr.net/npm/sql-formatter@15/+esm';
import { duckDBManager } from './core.js';

// Make libraries available globally
window.d3 = d3;
window.d3Sankey = d3Sankey;
window.d3SankeyLinkHorizontal = sankeyLinkHorizontal;
window.sqlFormatter = { format };
// Monaco will be available as global 'monaco' from script tags

window.duckdbAPI = {
    async initDuckDB() {
        return await duckDBManager.initDuckDB();
    },
    
    async loadParquetData() {
        return await duckDBManager.loadParquetData('./despesas.parquet');
    },
    
    async executeQuery(sql) {
        try {
            const startTime = performance.now();
            const result = await duckDBManager.query(sql);
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
    },
    
    async getSchema() {
        return await duckDBManager.getSchema();
    }
};