/**
 * Consolidated Configuration
 * Merges app-config.js, constants.js, and config-service.js into unified configuration
 */

// ===== APPLICATION CONSTANTS =====

export const APP_CONSTANTS = {
  // Pagination
  PAGINATION: {
    ROWS_PER_PAGE: 100,
    MAX_VISIBLE_PAGES: 10,
    DEFAULT_PAGE_SIZE: 50,
    MAX_HISTORY_SIZE: 50
  },

  // UI Dimensions
  UI: {
    MIN_RESULTS_HEIGHT: 150,
    MIN_EDITOR_HEIGHT: 150,
    SANKEY_WIDTH: 1000,
    SANKEY_HEIGHT: 600,
    NETWORK_WIDTH: 1200,
    NETWORK_HEIGHT: 600,
    PIE_CHART_SIZE: 180,
    CHART_PADDING: 80,
    LEGEND_PADDING: 30
  },

  // Timing & Performance
  TIMING: {
    CONNECTION_CHECK_INTERVAL: 30000, // 30 seconds
    MAX_INIT_ATTEMPTS: 50, // 5 seconds total
    DEBOUNCE_MS: 300,
    SHADOW_BLUR: 2,
    SHADOW_OFFSET: 1
  },

  // Text & Display
  TEXT: {
    MAX_TEXT_LENGTH: 50,
    TRUNCATE_SUFFIX: '...',
    MAX_PIE_SLICES: 10,
    GRID_STEPS: 4,
    LABEL_STEPS: 5
  },

  // Network Analysis
  NETWORK: {
    DEFAULT_MIN_VALUE: 0,
    DEFAULT_MAX_VALUE: 100000,
    DEFAULT_FORCE_STRENGTH: 5,
    CLICK_THRESHOLD: 10, // pixels
    TOP_PERCENTILE: 0.2 // 20% for density mode
  },

  // Charts
  CHARTS: {
    MAX_PIE_SLICES: 8,
    DEFAULT_COLORS: [
      '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899',
      '#6366F1', '#EF4444', '#F97316', '#14B8A6', '#06B6D4'
    ]
  }
};

// ===== COLOR DEFINITIONS =====

export const COLORS = {
  ENTITIES: {
    deputado: '#3b82f6',    // Blue
    fornecedor: '#c45211',  // Orange
    category: '#10b981'     // Green
  },
  
  UI: {
    primary: '#3b82f6',
    secondary: '#6b7280',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    background: '#0f1419',
    surface: '#1f2937'
  },

  THEME: {
    dark: {
      background: '#0f1419',
      surface: '#1f2937',
      text: '#ffffff',
      textSecondary: '#9ca3af',
      border: '#374151'
    },
    light: {
      background: '#ffffff',
      surface: '#f9fafb',
      text: '#111827',
      textSecondary: '#6b7280',
      border: '#d1d5db'
    }
  }
};

// ===== DATA TYPE ICONS =====

export const DATA_TYPE_ICONS = {
  STRING: '📝',
  INTEGER: '🔢',
  DECIMAL: '#️⃣',
  DATETIME: '🕐',
  BOOLEAN: '☑️',
  JSON: '🧩',
  ARRAY: '📋',
  UUID: '🆔',
  BINARY: '📦',
  DEFAULT: '📌'
};

// ===== APPLICATION CONFIGURATION =====

export const APP_CONFIG = {
  // Database Configuration
  database: {
    parquetUrl: 'https://rafapolo.github.io/transparencia-dados/despesas_publicas_deputados.parquet',
    parquetPath: './despesas.parquet',
    tableName: 'despesas',
    defaultQuery: `SELECT 
      nome_parlamentar,
      sigla_partido,
      fornecedor,
      categoria_despesa,
      valor_liquido,
      strftime(data_emissao, '%d/%m/%Y') as data_emissao
    FROM despesas 
    WHERE valor_liquido > 500
    ORDER BY valor_liquido DESC 
    LIMIT 100`,
    maxRetries: 3,
    timeoutMs: 30000,
    connectionTimeout: 30000,
    queryTimeout: 60000,
    retryDelay: 1000,
    monitoringInterval: 30000,
    batchSize: 1000
  },

  // Visualization Configuration
  visualization: {
    // Network/Graph visualization (renamed from network)
    graph: {
      width: APP_CONSTANTS.UI.NETWORK_WIDTH,
      height: APP_CONSTANTS.UI.NETWORK_HEIGHT,
      forces: {
        linkDistance: 100,
        chargeStrength: -300,
        collisionRadius: 30
      },
      node: {
        minRadius: 5,
        maxRadius: 50,
        radiusDivisor: 5000,
        opacity: 0.8
      },
      link: {
        minWidth: 1,
        maxWidth: 10,
        widthDivisor: 1000,
        opacity: 0.5
      },
      animation: {
        duration: 300,
        easing: 'ease-in-out'
      }
    },

    // Sankey visualization
    sankey: {
      width: APP_CONSTANTS.UI.SANKEY_WIDTH,
      height: APP_CONSTANTS.UI.SANKEY_HEIGHT,
      margin: { top: 10, right: 10, bottom: 10, left: 10 },
      nodeWidth: 20,
      nodePadding: 15,
      maxNodes: 100,
      maxLinks: 500,
      maxSuppliers: 25
    },

    // Charts configuration
    charts: {
      pieChart: {
        size: APP_CONSTANTS.UI.PIE_CHART_SIZE,
        maxSlices: APP_CONSTANTS.CHARTS.MAX_PIE_SLICES,
        colors: APP_CONSTANTS.CHARTS.DEFAULT_COLORS
      },
      timeline: {
        maxDataPoints: 50,
        padding: APP_CONSTANTS.UI.CHART_PADDING,
        gridSteps: APP_CONSTANTS.TEXT.GRID_STEPS
      },
      barChart: {
        padding: APP_CONSTANTS.UI.CHART_PADDING,
        maxBars: 20
      }
    },

    // Common visualization settings
    colors: {
      schemes: ['schemeCategory10', 'schemeSet3', 'schemeDark2'],
      defaultScheme: 'schemeCategory10',
      entities: COLORS.ENTITIES
    }
  },

  // UI Configuration
  ui: {
    theme: {
      default: 'dark',
      colors: COLORS.THEME
    },
    layout: {
      minResultsHeight: APP_CONSTANTS.UI.MIN_RESULTS_HEIGHT,
      minEditorHeight: APP_CONSTANTS.UI.MIN_EDITOR_HEIGHT,
      legendPadding: APP_CONSTANTS.UI.LEGEND_PADDING
    },
    pagination: APP_CONSTANTS.PAGINATION,
    debounceMs: APP_CONSTANTS.TIMING.DEBOUNCE_MS,
    clickThreshold: APP_CONSTANTS.NETWORK.CLICK_THRESHOLD
  },

  // Performance Configuration
  performance: {
    connectionCheckInterval: APP_CONSTANTS.TIMING.CONNECTION_CHECK_INTERVAL,
    maxInitAttempts: APP_CONSTANTS.TIMING.MAX_INIT_ATTEMPTS,
    shadowBlur: APP_CONSTANTS.TIMING.SHADOW_BLUR,
    shadowOffset: APP_CONSTANTS.TIMING.SHADOW_OFFSET
  },

  // Feature Flags
  features: {
    offlineMode: true,
    backgroundSync: false,
    experimentalCharts: false,
    advancedFilters: true,
    dataExport: true,
    darkMode: true,
    responsiveLayout: true
  },

  // Environment settings
  environment: {
    development: {
      debugMode: true,
      verboseLogging: true,
      performanceMonitoring: true
    },
    production: {
      debugMode: false,
      verboseLogging: false,
      performanceMonitoring: false
    }
  }
};

// ===== CONFIGURATION SERVICE =====

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
        // Load from APP_CONFIG
        Object.entries(APP_CONFIG).forEach(([key, value]) => {
            this.setConfig(key, value);
        });

        // Load constants
        this.setConfig('constants', APP_CONSTANTS);
        this.setConfig('colors', COLORS);

        this.initialized = true;
    }

    // ===== CONFIGURATION MANAGEMENT =====

    setConfig(key, value) {
        const oldValue = this.config.get(key);
        this.config.set(key, value);
        
        // Notify watchers
        this.notifyWatchers(key, value, oldValue);
    }

    getConfig(key, defaultValue = null) {
        return this.config.get(key) || defaultValue;
    }

    hasConfig(key) {
        return this.config.has(key);
    }

    removeConfig(key) {
        const oldValue = this.config.get(key);
        const deleted = this.config.delete(key);
        
        if (deleted) {
            this.notifyWatchers(key, null, oldValue);
        }
        
        return deleted;
    }

    // ===== NESTED CONFIGURATION ACCESS =====

    getNestedConfig(path, defaultValue = null) {
        const keys = path.split('.');
        let current = this.config;
        
        for (const key of keys) {
            if (current instanceof Map) {
                current = current.get(key);
            } else if (typeof current === 'object' && current !== null) {
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

    setNestedConfig(path, value) {
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
        const oldValue = current.get(lastKey);
        current.set(lastKey, value);
        
        // Notify watchers
        this.notifyWatchers(path, value, oldValue);
    }

    // ===== WATCHERS =====

    watch(key, callback) {
        if (!this.watchers.has(key)) {
            this.watchers.set(key, new Set());
        }
        
        this.watchers.get(key).add(callback);
        
        // Return unwatch function
        return () => {
            const keyWatchers = this.watchers.get(key);
            if (keyWatchers) {
                keyWatchers.delete(callback);
                if (keyWatchers.size === 0) {
                    this.watchers.delete(key);
                }
            }
        };
    }

    notifyWatchers(key, newValue, oldValue) {
        const keyWatchers = this.watchers.get(key);
        if (keyWatchers) {
            keyWatchers.forEach(callback => {
                try {
                    callback(newValue, oldValue, key);
                } catch (error) {
                    console.error('Config watcher error:', error);
                }
            });
        }
    }

    // ===== ENVIRONMENT DETECTION =====

    getEnvironment() {
        if (typeof process !== 'undefined' && process.env?.NODE_ENV) {
            return process.env.NODE_ENV;
        }
        
        if (typeof window !== 'undefined') {
            if (window.location.hostname === 'localhost' || 
                window.location.hostname === '127.0.0.1') {
                return 'development';
            }
        }
        
        return 'production';
    }

    getEnvironmentConfig() {
        const env = this.getEnvironment();
        return this.getNestedConfig(`environment.${env}`, {});
    }

    // ===== FEATURE FLAGS =====

    isFeatureEnabled(featureName) {
        return this.getNestedConfig(`features.${featureName}`, false);
    }

    enableFeature(featureName) {
        this.setNestedConfig(`features.${featureName}`, true);
    }

    disableFeature(featureName) {
        this.setNestedConfig(`features.${featureName}`, false);
    }

    // ===== UTILITY METHODS =====

    getAllConfig() {
        const result = {};
        this.config.forEach((value, key) => {
            result[key] = value;
        });
        return result;
    }

    reset() {
        this.config.clear();
        this.watchers.clear();
        this.loadDefaults();
    }

    // ===== BASE PATH HELPER =====

    getBasePath() {
        if (typeof window !== 'undefined') {
            const { pathname } = window.location;
            
            // For GitHub Pages deployment
            if (pathname.includes('/viso/')) {
                return '/viso/';
            }
            
            // For local development or root deployment
            return '/';
        }
        
        return '/';
    }
}

// ===== SINGLETON INSTANCE =====

const configService = new ConfigService();

// ===== EXPORTS =====

export default APP_CONFIG;
export { configService };

// Legacy compatibility exports
export const getBasePath = () => configService.getBasePath();