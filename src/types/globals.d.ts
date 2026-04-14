/**
 * Global window property extensions used across the application.
 */
declare global {
  interface Window {
    // Apache Arrow
    Arrow: typeof import('apache-arrow') | undefined;
    arrowReady: boolean;

    // AMD compatibility shim
    define: ((deps: string[], factory: (...args: unknown[]) => unknown) => void) | undefined;
    originalDefine: typeof window.define;

    // DuckDB globals (exposed by vendor scripts)
    DuckDBBundles: import('@duckdb/duckdb-wasm').DuckDBBundles;
    DuckDBDataProtocol: import('@duckdb/duckdb-wasm').DuckDBDataProtocol;
    duckdbAPI: {
      initDuckDB(): Promise<unknown>;
      loadParquetData(url?: string): Promise<number>;
      executeQuery(sql: string): Promise<import('@duckdb/duckdb-wasm').ArrowTable>;
      getSchema(): Promise<Record<string, unknown>[]>;
      query(sql: string): Promise<{ numRows: number; toArray(): Record<string, unknown>[] }>;
      getFilterOptions(): Promise<{ parties: string[]; categories: string[] }>;
      getValueRange(partyFilter?: string, categoryFilter?: string, searchFilter?: string): Promise<{ min: number; max: number }>;
      queryAggregatedData(minValue?: number, partyFilter?: string, categoryFilter?: string, searchFilter?: string): Promise<Record<string, unknown>[]>;
      checkConnectionHealth(): Promise<boolean>;
    };
    duckdbManager: unknown;

    // D3 (loaded as vendor script)
    d3: typeof import('d3');

    // Monaco editor
    monaco: typeof import('monaco-editor');

    // SQL Formatter
    sqlFormatter: {
      format(sql: string, options?: Record<string, unknown>): string;
    };

    // Application navigation helpers
    navigateToDb(): void;
    navigateToIndex(): void;
    navigateToNetwork(): void;

    // Monaco editor instance (set by category-toggle / db modules)
    monacoEditor: import('monaco-editor').editor.IStandaloneCodeEditor | undefined;

    // Tailwind runtime (injected via CDN script)
    tailwind: { config: Record<string, unknown> } | undefined;

    // Runtime config override (set before app loads)
    VISO_CONFIG: Record<string, unknown> | undefined;

    // D3 Sankey helpers (set in db-api / core/database)
    d3Sankey: unknown;
    d3SankeyLinkHorizontal: unknown;

    // Connection helpers exposed globally
    stopConnectionMonitoring: (() => void) | undefined;
    updateConnectionStatus: ((status: string, message?: string) => void) | undefined;
    getConnectionStatus: (() => string) | undefined;

    // Graph app globals
    ColorUtils: { getPartyColor(party: string): string } | undefined;
    currentSimulation: unknown;
    currentVisualization: {
      label: Record<string, (...args: unknown[]) => unknown>;
      nodes: { id: string; label: string; type: string; party?: string; x?: number; y?: number }[];
      edgeLabels: Record<string, (...args: unknown[]) => unknown>;
    } | undefined;
    currentAggregatedData: Record<string, unknown>[] | undefined;
    densityInfo: { totalNodes: number; filteredNodes: number } | undefined;
    highlightNodeInVisualization: ((entityName: string, entityType: string) => void) | undefined;
    navigateHome: (() => Promise<void>) | undefined;

    // require (AMD/Monaco loader)
    require: ((deps: string[], factory: (...args: unknown[]) => void) => void) & {
      config?: (cfg: Record<string, unknown>) => void;
    } | undefined;
  }
}

// Vite compile-time constants
declare const __APP_VERSION__: string;
declare const __BUILD_DATE__: string;
declare const __BUILD_ENV__: string;

export {};
