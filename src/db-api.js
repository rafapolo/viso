// Database API setup for db.html
// D3 should already be available globally from script tag in HTML
import { format } from '../vendor/js/sql-formatter-module.js';
import { duckDBManager } from './core/app.js';
// D3 Sankey functions will be available from global d3 object loaded via script tag
const d3Sankey = window.d3?.sankey;
const sankeyLinkHorizontal = window.d3?.sankeyLinkHorizontal;
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