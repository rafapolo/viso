/**
 * Centralized Configuration Service
 * Manages all application configuration including database settings,
 * visualization options, UI preferences, and feature flags
 */

export class ConfigService {
    constructor() {
        this.config = new Map();
        this.watchers = new Map();
        this.initialized = false;
        
        // Load default configuration
        this.loadDefaults();
    }

    // ===== INITIALIZATION =====

    loadDefaults() {
        // Database Configuration
        this.setConfig('database', {
            parquetPath: './despesas.parquet',
            tableName: 'despesas',
            connectionTimeout: 30000,
            queryTimeout: 60000,
            maxRetries: 3,
            retryDelay: 1000,
            monitoringInterval: 30000,
            batchSize: 1000
        });

        // Visualization Configuration
        this.setConfig('visualization', {
            defaultWidth: 1200,
            defaultHeight: 600,
            margin: { top: 10, right: 10, bottom: 10, left: 10 },
            sankeyNodeWidth: 20,
            sankeyNodePadding: 15,
            maxNodes: 100,
            maxLinks: 500,
            animationDuration: 300,
            colors: {
                schemes: ['schemeCategory10', 'schemeSet3', 'schemeDark2'],
                defaultScheme: 'schemeCategory10',
                nodeOpacity: 0.8,
                linkOpacity: 0.5
            }
        });

        // Network Visualization Configuration
        this.setConfig('network', {
            defaultWidth: window.innerWidth,
            defaultHeight: window.innerHeight,
            forceStrength: -300,
            linkDistance: 50,
            nodeRadius: { min: 5, max: 50 },
            maxNodes: 1000,
            maxEdges: 5000,
            clustering: {
                enabled: true,
                threshold: 0.8
            },
            simulation: {
                alphaDecay: 0.01,
                velocityDecay: 0.4
            }
        });

        // UI Configuration
        this.setConfig('ui', {
            theme: 'dark', // 'light' | 'dark' | 'auto'
            language: 'pt-BR',
            dateFormat: 'DD/MM/YYYY',
            numberFormat: 'pt-BR',
            pagination: {
                defaultPageSize: 100,
                pageSizeOptions: [25, 50, 100, 200, 500]
            },
            panels: {
                rightPanelWidth: 320,
                queryPanelHeight: 320,
                collapsedWidth: 32,
                collapsedHeight: 40
            },
            search: {
                debounceMs: 300,
                minChars: 2,
                maxResults: 100
            },
            notifications: {
                defaultDuration: 5000,
                position: 'top-right'
            }
        });

        // Performance Configuration
        this.setConfig('performance', {
            lazyLoading: true,
            virtualScrolling: true,
            dataThrottling: true,
            maxMemoryUsage: 512 * 1024 * 1024, // 512MB
            cacheSize: 100,
            cacheTTL: 300000, // 5 minutes
            debounceMs: 150,
            throttleMs: 100
        });

        // Feature Flags
        this.setConfig('features', {
            enableServiceWorker: true,
            enableOfflineMode: true,
            enableAnalytics: false,
            enableExport: true,
            enableImport: true,
            enableAdvancedFilters: true,
            enableDataValidation: true,
            enablePerformanceMonitoring: true,
            enableErrorReporting: true,
            experimentalFeatures: false
        });

        // API Configuration
        this.setConfig('api', {
            endpoints: {
                data: './despesas.parquet',
                schema: null,
                export: null
            },
            timeout: 30000,
            retries: 3,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // Editor Configuration
        this.setConfig('editor', {
            theme: 'vs-dark',
            fontSize: 14,
            tabSize: 4,
            wordWrap: 'on',
            minimap: false,
            lineNumbers: true,
            autoFormat: true,
            autoSave: true,
            autoSaveDelay: 2000,
            defaultQuery: `-- Análise de gastos parlamentares por partido e categoria
SELECT 
    sigla_partido,
    categoria_despesa,
    COUNT(*) as num_transacoes,
    SUM(valor_liquido) as total_gasto,
    AVG(valor_liquido) as gasto_medio
FROM despesas 
WHERE valor_liquido > 0 
    AND sigla_partido IS NOT NULL
GROUP BY sigla_partido, categoria_despesa
ORDER BY total_gasto DESC
LIMIT 50`
        });

        // Development Configuration
        this.setConfig('development', {
            debug: process?.env?.NODE_ENV === 'development',
            logLevel: 'info', // 'debug' | 'info' | 'warn' | 'error'
            enableHotReload: true,
            showPerformanceMetrics: false,
            enableTestData: false
        });

        // PWA Configuration
        this.setConfig('pwa', {
            enableServiceWorker: true,
            enableOfflineCaching: true,
            enablePushNotifications: false,
            enableBackgroundSync: true,
            cacheStrategy: 'cache-first',
            updateStrategy: 'immediate'
        });
    }

    initialize() {
        if (this.initialized) return;

        // Load configuration from localStorage if available
        this.loadFromStorage();

        // Apply environment-specific overrides
        this.applyEnvironmentOverrides();

        // Apply URL parameter overrides
        this.applyUrlOverrides();

        this.initialized = true;
    }

    // ===== CONFIGURATION ACCESS =====

    getConfig(path, defaultValue = undefined) {
        const keys = path.split('.');
        let current = this.config;

        for (const key of keys) {
            if (current instanceof Map) {
                current = current.get(key);
            } else if (current && typeof current === 'object') {
                current = current[key];
            } else {
                return defaultValue;
            }

            if (current === undefined) {
                return defaultValue;
            }
        }

        return current;
    }

    setConfig(path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        let current = this.config;

        // Navigate to parent
        for (const key of keys) {
            if (!current.has(key)) {
                current.set(key, new Map());
            }
            current = current.get(key);
        }

        // Set value
        current.set(lastKey, value);

        // Notify watchers
        this.notifyWatchers(path, value);

        // Persist to localStorage
        this.saveToStorage();
    }

    updateConfig(path, updates) {
        const currentValue = this.getConfig(path);
        if (currentValue && typeof currentValue === 'object') {
            const newValue = { ...currentValue, ...updates };
            this.setConfig(path, newValue);
        } else {
            this.setConfig(path, updates);
        }
    }

    hasConfig(path) {
        return this.getConfig(path) !== undefined;
    }

    // ===== WATCHERS =====

    watch(path, callback) {
        if (!this.watchers.has(path)) {
            this.watchers.set(path, new Set());
        }
        this.watchers.get(path).add(callback);

        // Return unwatch function
        return () => {
            const pathWatchers = this.watchers.get(path);
            if (pathWatchers) {
                pathWatchers.delete(callback);
                if (pathWatchers.size === 0) {
                    this.watchers.delete(path);
                }
            }
        };
    }

    notifyWatchers(path, value) {
        const pathWatchers = this.watchers.get(path);
        if (pathWatchers) {
            pathWatchers.forEach(callback => {
                try {
                    callback(value, path);
                } catch (error) {
                    console.error(`Error in config watcher for ${path}:`, error);
                }
            });
        }
    }

    // ===== CONVENIENCE METHODS =====

    // Database
    getDatabaseConfig() {
        return this.getConfig('database');
    }

    // Visualization
    getVisualizationConfig() {
        return this.getConfig('visualization');
    }

    getNetworkConfig() {
        return this.getConfig('network');
    }

    // UI
    getUIConfig() {
        return this.getConfig('ui');
    }

    getTheme() {
        return this.getConfig('ui.theme', 'dark');
    }

    setTheme(theme) {
        this.setConfig('ui.theme', theme);
    }

    // Performance
    getPerformanceConfig() {
        return this.getConfig('performance');
    }

    // Features
    getFeatureFlags() {
        return this.getConfig('features');
    }

    isFeatureEnabled(feature) {
        return this.getConfig(`features.${feature}`, false);
    }

    enableFeature(feature) {
        this.setConfig(`features.${feature}`, true);
    }

    disableFeature(feature) {
        this.setConfig(`features.${feature}`, false);
    }

    // Editor
    getEditorConfig() {
        return this.getConfig('editor');
    }

    getDefaultQuery() {
        return this.getConfig('editor.defaultQuery', '');
    }

    // Development
    isDevelopment() {
        return this.getConfig('development.debug', false);
    }

    getLogLevel() {
        return this.getConfig('development.logLevel', 'info');
    }

    // ===== PERSISTENCE =====

    loadFromStorage() {
        try {
            const stored = localStorage.getItem('viso-config');
            if (stored) {
                const parsedConfig = JSON.parse(stored);
                this.mergeConfig(parsedConfig);
            }
        } catch (error) {
            console.warn('Failed to load config from localStorage:', error);
        }
    }

    saveToStorage() {
        try {
            const configObject = this.mapToObject(this.config);
            localStorage.setItem('viso-config', JSON.stringify(configObject));
        } catch (error) {
            console.warn('Failed to save config to localStorage:', error);
        }
    }

    mergeConfig(newConfig) {
        Object.entries(newConfig).forEach(([key, value]) => {
            if (this.config.has(key)) {
                const existing = this.config.get(key);
                if (existing instanceof Map && typeof value === 'object') {
                    this.mergeMap(existing, value);
                } else {
                    this.config.set(key, value);
                }
            } else {
                this.config.set(key, value);
            }
        });
    }

    mergeMap(map, object) {
        Object.entries(object).forEach(([key, value]) => {
            map.set(key, value);
        });
    }

    mapToObject(map) {
        const result = {};
        for (const [key, value] of map) {
            if (value instanceof Map) {
                result[key] = this.mapToObject(value);
            } else {
                result[key] = value;
            }
        }
        return result;
    }

    // ===== ENVIRONMENT OVERRIDES =====

    applyEnvironmentOverrides() {
        // Check for environment-specific configurations
        if (typeof window !== 'undefined' && window.VISO_CONFIG) {
            this.mergeConfig(window.VISO_CONFIG);
        }

        // Apply NODE_ENV specific overrides
        if (process?.env?.NODE_ENV === 'production') {
            this.updateConfig('development', {
                debug: false,
                logLevel: 'warn',
                showPerformanceMetrics: false
            });
        }
    }

    applyUrlOverrides() {
        if (typeof window === 'undefined') return;

        const params = new URLSearchParams(window.location.search);
        
        // Theme override
        if (params.has('theme')) {
            this.setTheme(params.get('theme'));
        }

        // Debug mode
        if (params.has('debug')) {
            this.setConfig('development.debug', params.get('debug') === 'true');
        }

        // Performance monitoring
        if (params.has('perf')) {
            this.setConfig('development.showPerformanceMetrics', params.get('perf') === 'true');
        }
    }

    // ===== UTILITY METHODS =====

    exportConfig() {
        return this.mapToObject(this.config);
    }

    importConfig(configObject) {
        this.mergeConfig(configObject);
        this.saveToStorage();
    }

    resetToDefaults() {
        this.config.clear();
        this.loadDefaults();
        this.saveToStorage();
    }

    getConfigSummary() {
        return {
            theme: this.getTheme(),
            features: this.getFeatureFlags(),
            performance: this.getPerformanceConfig(),
            database: this.getDatabaseConfig()
        };
    }
}

// Singleton instance
let globalConfigService = null;

export function createConfigService() {
    return new ConfigService();
}

export function getGlobalConfigService() {
    if (!globalConfigService) {
        globalConfigService = new ConfigService();
        globalConfigService.initialize();
    }
    return globalConfigService;
}

export default ConfigService;