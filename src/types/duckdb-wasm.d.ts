/**
 * Ambient type declarations for @duckdb/duckdb-wasm
 * The package ships without bundled .d.ts files; these stubs cover the API surface used in this project.
 */
declare module '@duckdb/duckdb-wasm' {
  export interface DuckDBBundles {
    mvp: { mainModule: string; mainWorker: string };
    eh: { mainModule: string; mainWorker: string };
  }

  export interface DuckDBConfig {
    query?: {
      castTimestampToDate?: boolean;
      castBigIntToDouble?: boolean;
    };
    filesystem?: {
      allowFullHTTPReads?: boolean;
    };
  }

  export interface DuckDBDataProtocol {
    BUFFER: number;
    HTTP: number;
    NATIVE: number;
    NODE_FS: number;
    S3: number;
    BROWSER_FSACCESS: number;
    BROWSER_FILEREADER: number;
  }

  export interface DuckDBConnection {
    query(sql: string): Promise<ArrowTable>;
    prepare(sql: string): Promise<PreparedStatement>;
    close(): Promise<void>;
    send(sql: string): Promise<AsyncIterableIterator<ArrowRecordBatch>>;
    insertArrowFromIPCStream(buffer: Uint8Array, options?: InsertArrowOptions): Promise<void>;
    insertCSVFromPath(path: string, options?: InsertCSVOptions): Promise<void>;
    insertJSONFromPath(path: string, options?: object): Promise<void>;
  }

  export interface PreparedStatement {
    query(...params: unknown[]): Promise<ArrowTable>;
    close(): Promise<void>;
  }

  export interface InsertArrowOptions {
    name: string;
    schema?: string;
    create?: boolean;
  }

  export interface InsertCSVOptions {
    name: string;
    schema?: string;
    create?: boolean;
    header?: boolean;
    delimiter?: string;
  }

  export interface ArrowField {
    name: string;
    type: { typeId: number };
    nullable: boolean;
  }

  export interface ArrowSchema {
    fields: ArrowField[];
  }

  export interface ArrowTable {
    schema: ArrowSchema;
    numRows: number;
    numCols: number;
    toArray(): Record<string, unknown>[];
    getChildAt(index: number): ArrowColumn;
    getColumn(name: string): ArrowColumn | null;
  }

  export interface ArrowColumn {
    toArray(): unknown[];
    get(index: number): unknown;
    length: number;
  }

  export interface ArrowRecordBatch {
    schema: ArrowSchema;
    numRows: number;
  }

  export interface AsyncDuckDB {
    instantiate(mainModule?: string, pthreadWorker?: string | null): Promise<void>;
    connect(): Promise<DuckDBConnection>;
    dropFile(name: string): Promise<void>;
    dropFiles(): Promise<void>;
    flushFiles(): Promise<void>;
    registerFileURL(name: string, url: string, protocol: number, directIO: boolean): Promise<void>;
    registerFileBuffer(name: string, buffer: Uint8Array): Promise<void>;
    registerFileHandle(name: string, file: File, protocol: number, directIO: boolean): Promise<void>;
    copyFileToPath(name: string, dest: string): Promise<void>;
    copyFileToBuffer(name: string): Promise<Uint8Array>;
    open(config: DuckDBConfig): Promise<void>;
    getVersion(): Promise<string>;
    getFeatureFlags(): Promise<number>;
    terminate(): Promise<void>;
  }

  export interface AsyncDuckDBConstructor {
    new (logger: DuckDBLogger, worker: Worker | null): AsyncDuckDB;
  }

  export interface DuckDBLogger {
    log(entry: DuckDBLogEntry): void;
  }

  export interface DuckDBLogEntry {
    timestamp: Date;
    level: number;
    origin: string;
    topic: string;
    value: string;
  }

  export type LogLevel = 'INFO' | 'WARNING' | 'ERROR' | 'NONE';

  export function selectBundle(bundles: DuckDBBundles): Promise<{ mainModule: string; mainWorker: string }>;
  export function getPlatformFeatures(): Promise<{ crossOriginIsolated: boolean }>;

  export const AsyncDuckDB: AsyncDuckDBConstructor;

  export class ConsoleLogger implements DuckDBLogger {
    log(entry: DuckDBLogEntry): void;
  }

  export class VoidLogger implements DuckDBLogger {
    log(entry: DuckDBLogEntry): void;
  }
}
