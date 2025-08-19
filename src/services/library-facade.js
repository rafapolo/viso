/**
 * Library Facade Service
 * Provides a unified interface for external libraries (D3, Monaco, SQL Formatter)
 * Handles library loading, initialization, and provides consistent access patterns
 */

import { ErrorHandler } from '../shared/error-handler.js';

export class LibraryFacade {
    constructor() {
        this.libraries = new Map();
        this.loadingPromises = new Map();
        this.initialized = false;
        
        // Configuration for different libraries
        this.libraryConfig = {
            d3: {
                global: 'window.d3',
                scriptUrls: [
                    'vendor/js/d3.v7.min.js',
                    'vendor/js/d3-sankey.min.js'
                ],
                validators: [
                    () => window.d3 && typeof window.d3.select === 'function',
                    () => window.d3 && typeof window.d3.sankey === 'function'
                ],
                dependencies: []
            },
            monaco: {
                global: 'window.monaco',
                scriptUrls: [
                    '/node_modules/monaco-editor/min/vs/loader.js',
                    '/node_modules/monaco-editor/min/vs/editor/editor.main.nls.js',
                    '/node_modules/monaco-editor/min/vs/editor/editor.main.js'
                ],
                validators: [
                    () => window.monaco && typeof window.monaco.editor === 'object'
                ],
                dependencies: [],
                initFunction: async () => {
                    if (window.require) {
                        window.require.config({
                            paths: { 
                                vs: '/node_modules/monaco-editor/min/vs' 
                            }
                        });
                    }
                    return window.monaco;
                }
            },
            sqlFormatter: {
                global: 'window.sqlFormatter',
                scriptUrls: ['vendor/js/sql-formatter.js'],
                validators: [
                    () => window.sqlFormatter && typeof window.sqlFormatter.format === 'function'
                ],
                dependencies: []
            },
            duckdb: {
                global: 'window.duckdb',
                moduleUrl: '../vendor/js/duckdb-module.js',
                validators: [
                    () => window.duckdb && typeof window.duckdb.selectBundle === 'function'
                ],
                dependencies: [],
                isModule: true
            }
        };
    }

    // ===== INITIALIZATION =====

    async initialize(librariesNeeded = ['d3', 'monaco', 'sqlFormatter']) {
        if (this.initialized) return true;
        
        try {
            // Load all required libraries in parallel
            const loadPromises = librariesNeeded.map(lib => this.loadLibrary(lib));
            await Promise.all(loadPromises);
            
            this.initialized = true;
            return true;
        } catch (error) {
            throw ErrorHandler.handleError(error, 'LibraryFacade Initialization');
        }
    }

    // ===== LIBRARY LOADING =====

    async loadLibrary(libraryName) {
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

    async _doLoadLibrary(libraryName) {
        const config = this.libraryConfig[libraryName];
        if (!config) {
            throw new Error(`Unknown library: ${libraryName}`);
        }

        // Check if already loaded
        if (this._isLibraryLoaded(libraryName)) {
            const library = window[config.global];
            if (config.initFunction) {
                await config.initFunction();
            }
            return library;
        }

        // Load dependencies first
        if (config.dependencies && config.dependencies.length > 0) {
            await Promise.all(config.dependencies.map(dep => this.loadLibrary(dep)));
        }

        // Load library
        if (config.isModule && config.moduleUrl) {
            return await this._loadModule(config.moduleUrl, libraryName);
        } else if (config.scriptUrls) {
            await this._loadScripts(config.scriptUrls, libraryName);
            const library = window[config.global];
            
            if (config.initFunction) {
                await config.initFunction();
            }
            
            return library;
        }

        throw new Error(`No loading method configured for ${libraryName}`);
    }

    async _loadModule(moduleUrl, libraryName) {
        try {
            const module = await import(moduleUrl);
            // Store in global for backward compatibility if needed
            if (this.libraryConfig[libraryName].global) {
                const globalPath = this.libraryConfig[libraryName].global.replace('window.', '');
                window[globalPath] = module;
            }
            return module;
        } catch (error) {
            throw new Error(`Failed to load module ${moduleUrl}: ${error.message}`);
        }
    }

    async _loadScripts(scriptUrls, libraryName) {
        const loadPromises = scriptUrls.map(url => this._loadScript(url));
        await Promise.all(loadPromises);
        
        // Wait a bit for global variables to be available
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Validate that library loaded correctly
        if (!this._isLibraryLoaded(libraryName)) {
            throw new Error(`Library ${libraryName} failed validation after loading`);
        }
    }

    _loadScript(url) {
        return new Promise((resolve, reject) => {
            // Check if script already exists
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

    _isLibraryLoaded(libraryName) {
        const config = this.libraryConfig[libraryName];
        if (!config || !config.validators) return false;
        
        return config.validators.every(validator => {
            try {
                return validator();
            } catch (e) {
                return false;
            }
        });
    }

    // ===== LIBRARY ACCESS =====

    getLibrary(libraryName) {
        if (!this.libraries.has(libraryName)) {
            throw new Error(`Library ${libraryName} not loaded. Call loadLibrary() first.`);
        }
        return this.libraries.get(libraryName);
    }

    async getLibraryAsync(libraryName) {
        if (!this.libraries.has(libraryName)) {
            await this.loadLibrary(libraryName);
        }
        return this.libraries.get(libraryName);
    }

    isLibraryAvailable(libraryName) {
        return this.libraries.has(libraryName) && this._isLibraryLoaded(libraryName);
    }

    // ===== CONVENIENT ACCESS METHODS =====

    async getD3() {
        return await this.getLibraryAsync('d3');
    }

    async getMonaco() {
        return await this.getLibraryAsync('monaco');
    }

    async getSQLFormatter() {
        return await this.getLibraryAsync('sqlFormatter');
    }

    async getDuckDB() {
        return await this.getLibraryAsync('duckdb');
    }

    // ===== D3 SPECIFIC METHODS =====

    async createSankeyGenerator(options = {}) {
        const d3 = await this.getD3();
        
        const {
            nodeWidth = 20,
            nodePadding = 8,
            extent = [[0, 0], [1200, 600]]
        } = options;

        return d3.sankey()
            .nodeId(d => d.id)
            .nodeWidth(nodeWidth)
            .nodePadding(nodePadding)
            .extent(extent);
    }

    async createColorScale(type = 'category', options = {}) {
        const d3 = await this.getD3();
        
        switch (type) {
            case 'category':
                return d3.scaleOrdinal(options.range || d3.schemeCategory10);
            case 'sequential':
                return d3.scaleSequential(options.interpolator || d3.interpolateBlues);
            case 'diverging':
                return d3.scaleDiverging(options.interpolator || d3.interpolateRdYlBu);
            default:
                return d3.scaleOrdinal(d3.schemeCategory10);
        }
    }

    // ===== MONACO SPECIFIC METHODS =====

    async createMonacoEditor(container, options = {}) {
        const monaco = await this.getMonaco();
        
        const defaultOptions = {
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
            wrappingIndent: 'indent'
        };

        return monaco.editor.create(container, { ...defaultOptions, ...options });
    }

    // ===== SQL FORMATTER METHODS =====

    async formatSQL(sql, options = {}) {
        const formatter = await this.getSQLFormatter();
        
        const defaultOptions = {
            language: 'sql',
            indent: '    ',
            uppercase: true,
            linesBetweenQueries: 2
        };

        try {
            return formatter.format(sql, { ...defaultOptions, ...options });
        } catch (error) {
            // Fallback to basic formatting
            return sql.trim();
        }
    }

    // ===== UTILITY METHODS =====

    async waitForLibrary(libraryName, timeout = 10000) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            if (this.isLibraryAvailable(libraryName)) {
                return this.getLibrary(libraryName);
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        throw new Error(`Library ${libraryName} failed to load within ${timeout}ms`);
    }

    getLoadedLibraries() {
        return Array.from(this.libraries.keys());
    }

    getLibraryStatus() {
        const status = {};
        
        Object.keys(this.libraryConfig).forEach(libName => {
            status[libName] = {
                loaded: this.libraries.has(libName),
                available: this.isLibraryAvailable(libName),
                loading: this.loadingPromises.has(libName)
            };
        });
        
        return status;
    }

    // ===== CLEANUP =====

    cleanup() {
        this.libraries.clear();
        this.loadingPromises.clear();
        this.initialized = false;
    }
}

// Singleton instance for global use
let globalLibraryFacade = null;

export function createLibraryFacade() {
    return new LibraryFacade();
}

export function getGlobalLibraryFacade() {
    if (!globalLibraryFacade) {
        globalLibraryFacade = new LibraryFacade();
    }
    return globalLibraryFacade;
}

export default LibraryFacade;