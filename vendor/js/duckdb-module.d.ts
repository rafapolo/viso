/**
 * Type declarations for the vendored DuckDB module wrapper.
 * This file re-exports the DuckDB WASM API used across the project.
 */
export {
  AsyncDuckDB,
  ConsoleLogger,
  VoidLogger,
  DuckDBBundles,
  DuckDBConfig,
  DuckDBConnection,
  DuckDBDataProtocol,
  ArrowTable,
  ArrowField,
  ArrowSchema,
  PreparedStatement,
} from '@duckdb/duckdb-wasm';

export function getJsDelivrBundles(): import('@duckdb/duckdb-wasm').DuckDBBundles;
export function selectBundle(
  bundles: import('@duckdb/duckdb-wasm').DuckDBBundles
): Promise<{ mainModule: string; mainWorker: string; pthreadWorker?: string | null }>;

// Re-export terminate via AsyncDuckDB type (terminate added to AsyncDuckDB interface)
export function createWorker(workerUrl: string): Promise<Worker>;
