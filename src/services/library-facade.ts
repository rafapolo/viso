/**
 * Library Facade Service
 * Provides a unified interface for external libraries (D3, Monaco, SQL Formatter)
 */

import { ErrorHandler } from '../shared/error-handler.js';

type LibraryValidator = () => boolean;

interface LibraryConfig {
  global: string;
  scriptUrls?: string[];
  moduleUrl?: string;
  validators?: LibraryValidator[];
  dependencies?: string[];
  isModule?: boolean;
  initFunction?: () => Promise<unknown>;
}

export class LibraryFacade {
  private libraries: Map<string, unknown>;
  private loadingPromises: Map<string, Promise<unknown>>;
  private initialized: boolean;
  private libraryConfig: Record<string, LibraryConfig>;

  constructor() {
    this.libraries = new Map();
    this.loadingPromises = new Map();
    this.initialized = false;

    this.libraryConfig = {
      d3: {
        global: 'window.d3',
        scriptUrls: [
          'vendor/js/d3.v7.min.js',
          'vendor/js/d3-sankey.min.js',
        ],
        validators: [
          () => !!(window.d3 && typeof (window.d3 as Record<string, unknown>)['select'] === 'function'),
          () => !!(window.d3 && typeof (window.d3 as Record<string, unknown>)['sankey'] === 'function'),
        ],
        dependencies: [],
      },
      monaco: {
        global: 'window.monaco',
        scriptUrls: [
          '/node_modules/monaco-editor/min/vs/loader.js',
          '/node_modules/monaco-editor/min/vs/editor/editor.main.nls.js',
          '/node_modules/monaco-editor/min/vs/editor/editor.main.js',
        ],
        validators: [
          () => !!(window.monaco && typeof window.monaco.editor === 'object'),
        ],
        dependencies: [],
        initFunction: async () => {
          if (window.require) {
            (window.require as unknown as { config?: (cfg: Record<string, unknown>) => void }).config?.({
              paths: { vs: '/node_modules/monaco-editor/min/vs' },
            });
          }
          return window.monaco;
        },
      },
      sqlFormatter: {
        global: 'window.sqlFormatter',
        scriptUrls: ['vendor/js/sql-formatter.js'],
        validators: [
          () => !!(window.sqlFormatter && typeof window.sqlFormatter.format === 'function'),
        ],
        dependencies: [],
      },
      duckdb: {
        global: 'window.duckdb',
        moduleUrl: '../vendor/js/duckdb-module.js',
        validators: [
          () => !!(window.duckdbAPI && typeof window.duckdbAPI.initDuckDB === 'function'),
        ],
        dependencies: [],
        isModule: true,
      },
    };
  }

  async initialize(librariesNeeded: string[] = ['d3', 'monaco', 'sqlFormatter']): Promise<boolean> {
    if (this.initialized) return true;

    try {
      const loadPromises = librariesNeeded.map(lib => this.loadLibrary(lib));
      await Promise.all(loadPromises);

      this.initialized = true;
      return true;
    } catch (error) {
      throw ErrorHandler.handleError(error as Error, 'LibraryFacade Initialization');
    }
  }

  async loadLibrary(libraryName: string): Promise<unknown> {
    if (this.libraries.has(libraryName)) {
      return this.libraries.get(libraryName);
    }

    if (this.loadingPromises.has(libraryName)) {
      return this.loadingPromises.get(libraryName);
    }

    const loadPromise = this._doLoadLibrary(libraryName);
    this.loadingPromises.set(libraryName, loadPromise);

    try {
      const library = await loadPromise;
      this.libraries.set(libraryName, library);
      this.loadingPromises.delete(libraryName);
      return library;
    } catch (error) {
      this.loadingPromises.delete(libraryName);
      throw error;
    }
  }

  private async _doLoadLibrary(libraryName: string): Promise<unknown> {
    const config = this.libraryConfig[libraryName];
    if (!config) {
      throw new Error(`Unknown library: ${libraryName}`);
    }

    if (this._isLibraryLoaded(libraryName)) {
      const globalKey = config.global.replace('window.', '');
      const library = (window as unknown as Record<string, unknown>)[globalKey];
      if (config.initFunction) {
        await config.initFunction();
      }
      return library;
    }

    if (config.dependencies && config.dependencies.length > 0) {
      await Promise.all(config.dependencies.map(dep => this.loadLibrary(dep)));
    }

    if (config.isModule && config.moduleUrl) {
      return await this._loadModule(config.moduleUrl, libraryName);
    } else if (config.scriptUrls) {
      await this._loadScripts(config.scriptUrls, libraryName);
      const globalKey = config.global.replace('window.', '');
      const library = (window as unknown as Record<string, unknown>)[globalKey];

      if (config.initFunction) {
        await config.initFunction();
      }

      return library;
    }

    throw new Error(`No loading method configured for ${libraryName}`);
  }

  private async _loadModule(moduleUrl: string, libraryName: string): Promise<unknown> {
    try {
      const module = await import(moduleUrl);
      if (this.libraryConfig[libraryName].global) {
        const globalPath = this.libraryConfig[libraryName].global.replace('window.', '');
        (window as unknown as Record<string, unknown>)[globalPath] = module;
      }
      return module;
    } catch (error) {
      throw new Error(`Failed to load module ${moduleUrl}: ${(error as Error).message}`);
    }
  }

  private async _loadScripts(scriptUrls: string[], libraryName: string): Promise<void> {
    const loadPromises = scriptUrls.map(url => this._loadScript(url));
    await Promise.all(loadPromises);

    await new Promise(resolve => setTimeout(resolve, 100));

    if (!this._isLibraryLoaded(libraryName)) {
      throw new Error(`Library ${libraryName} failed validation after loading`);
    }
  }

  private _loadScript(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${url}"]`);
      if (existing) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = url;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${url}`));
      document.head.appendChild(script);
    });
  }

  private _isLibraryLoaded(libraryName: string): boolean {
    const config = this.libraryConfig[libraryName];
    if (!config || !config.validators) return false;

    return config.validators.every(validator => {
      try {
        return validator();
      } catch {
        return false;
      }
    });
  }

  getLibrary(libraryName: string): unknown {
    if (!this.libraries.has(libraryName)) {
      throw new Error(`Library ${libraryName} not loaded. Call loadLibrary() first.`);
    }
    return this.libraries.get(libraryName);
  }

  async getLibraryAsync(libraryName: string): Promise<unknown> {
    if (!this.libraries.has(libraryName)) {
      await this.loadLibrary(libraryName);
    }
    return this.libraries.get(libraryName);
  }

  isLibraryAvailable(libraryName: string): boolean {
    return this.libraries.has(libraryName) && this._isLibraryLoaded(libraryName);
  }

  async getD3(): Promise<unknown> { return await this.getLibraryAsync('d3'); }
  async getMonaco(): Promise<unknown> { return await this.getLibraryAsync('monaco'); }
  async getSQLFormatter(): Promise<unknown> { return await this.getLibraryAsync('sqlFormatter'); }
  async getDuckDB(): Promise<unknown> { return await this.getLibraryAsync('duckdb'); }

  async createSankeyGenerator(options: { nodeWidth?: number; nodePadding?: number; extent?: [[number, number], [number, number]] } = {}): Promise<unknown> {
    const d3 = await this.getD3() as Record<string, (...args: unknown[]) => unknown>;

    const {
      nodeWidth = 20,
      nodePadding = 8,
      extent = [[0, 0], [1200, 600]],
    } = options;

    if (!d3['sankey']) return null;

    type FluentFn = Record<string, (v: unknown) => FluentFn>;
    const gen = d3['sankey']() as FluentFn;
    return gen['nodeId']?.((d: unknown) => (d as Record<string, unknown>)['id'])
      ['nodeWidth']?.(nodeWidth)
      ['nodePadding']?.(nodePadding)
      ['extent']?.(extent);
  }

  async createColorScale(type = 'category', options: { range?: unknown[]; interpolator?: unknown } = {}): Promise<unknown> {
    const d3 = await this.getD3() as Record<string, unknown>;

    switch (type) {
      case 'category':
        return (d3['scaleOrdinal'] as (r: unknown) => unknown)(options.range || d3['schemeCategory10']);
      case 'sequential':
        return (d3['scaleSequential'] as (i: unknown) => unknown)(options.interpolator || d3['interpolateBlues']);
      case 'diverging':
        return (d3['scaleDiverging'] as (i: unknown) => unknown)(options.interpolator || d3['interpolateRdYlBu']);
      default:
        return (d3['scaleOrdinal'] as (r: unknown) => unknown)(d3['schemeCategory10']);
    }
  }

  async createMonacoEditor(container: HTMLElement, options: Record<string, unknown> = {}): Promise<unknown> {
    const monaco = await this.getMonaco() as typeof import('monaco-editor');

    const defaultOptions: import('monaco-editor').editor.IStandaloneEditorConstructionOptions = {
      value: '',
      language: 'sql',
      theme: 'vs-dark',
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 14,
      lineNumbers: 'on',
      renderWhitespace: 'selection',
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      wrappingIndent: 'indent',
    };

    return monaco.editor.create(container, { ...defaultOptions, ...options });
  }

  async formatSQL(sql: string, options: Record<string, unknown> = {}): Promise<string> {
    const formatter = await this.getSQLFormatter() as { format: (s: string, o: Record<string, unknown>) => string };

    const defaultOptions = {
      language: 'sql',
      indent: '    ',
      uppercase: true,
      linesBetweenQueries: 2,
    };

    try {
      return formatter.format(sql, { ...defaultOptions, ...options });
    } catch {
      return sql.trim();
    }
  }

  async waitForLibrary(libraryName: string, timeout = 10000): Promise<unknown> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (this.isLibraryAvailable(libraryName)) {
        return this.getLibrary(libraryName);
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error(`Library ${libraryName} failed to load within ${timeout}ms`);
  }

  getLoadedLibraries(): string[] {
    return Array.from(this.libraries.keys());
  }

  getLibraryStatus(): Record<string, { loaded: boolean; available: boolean; loading: boolean }> {
    const status: Record<string, { loaded: boolean; available: boolean; loading: boolean }> = {};

    Object.keys(this.libraryConfig).forEach(libName => {
      status[libName] = {
        loaded: this.libraries.has(libName),
        available: this.isLibraryAvailable(libName),
        loading: this.loadingPromises.has(libName),
      };
    });

    return status;
  }

  cleanup(): void {
    this.libraries.clear();
    this.loadingPromises.clear();
    this.initialized = false;
  }
}

let globalLibraryFacade: LibraryFacade | null = null;

export function createLibraryFacade(): LibraryFacade {
  return new LibraryFacade();
}

export function getGlobalLibraryFacade(): LibraryFacade {
  if (!globalLibraryFacade) {
    globalLibraryFacade = new LibraryFacade();
  }
  return globalLibraryFacade;
}

export default LibraryFacade;
