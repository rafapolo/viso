// Local DuckDB WASM module loader
export default function loadDuckDB() {
    return import('./duckdb-wasm.js');
}

// Re-export the module for ES6 compatibility
export * from './duckdb-wasm.js';