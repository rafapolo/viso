/**
 * Centralized Configuration Service
 */

type ConfigWatcher = (value: unknown, path: string) => void;

export class ConfigService {
  private config: Map<string, unknown>;
  private watchers: Map<string, Set<ConfigWatcher>>;
  private initialized: boolean;

  constructor() {
    this.config = new Map();
    this.watchers = new Map();
    this.initialized = false;

    this.loadDefaults();
  }

  loadDefaults(): void {
    this.setConfig('database', {
      parquetPath: './despesas.parquet',
      tableName: 'despesas',
      connectionTimeout: 30000,
      queryTimeout: 60000,
      maxRetries: 3,
      retryDelay: 1000,
      monitoringInterval: 30000,
      batchSize: 1000,
    });

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
        linkOpacity: 0.5,
      },
    });

    this.setConfig('network', {
      defaultWidth: typeof window !== 'undefined' ? window.innerWidth : 1200,
      defaultHeight: typeof window !== 'undefined' ? window.innerHeight : 800,
      forceStrength: -300,
      linkDistance: 50,
      nodeRadius: { min: 5, max: 50 },
      maxNodes: 1000,
      maxEdges: 5000,
      clustering: { enabled: true, threshold: 0.8 },
      simulation: { alphaDecay: 0.01, velocityDecay: 0.4 },
    });

    this.setConfig('ui', {
      theme: 'dark',
      language: 'pt-BR',
      dateFormat: 'DD/MM/YYYY',
      numberFormat: 'pt-BR',
      pagination: { defaultPageSize: 100, pageSizeOptions: [25, 50, 100, 200, 500] },
      panels: { rightPanelWidth: 320, queryPanelHeight: 320, collapsedWidth: 32, collapsedHeight: 40 },
      search: { debounceMs: 300, minChars: 2, maxResults: 100 },
      notifications: { defaultDuration: 5000, position: 'top-right' },
    });

    this.setConfig('performance', {
      lazyLoading: true,
      virtualScrolling: true,
      dataThrottling: true,
      maxMemoryUsage: 512 * 1024 * 1024,
      cacheSize: 100,
      cacheTTL: 300000,
      debounceMs: 150,
      throttleMs: 100,
    });

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
      experimentalFeatures: false,
    });

    this.setConfig('api', {
      endpoints: { data: './despesas.parquet', schema: null, export: null },
      timeout: 30000,
      retries: 3,
      headers: { 'Content-Type': 'application/json' },
    });

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
      defaultQuery: `-- Análise de gastos parlamentares por partido e categoria\nSELECT \n    sigla_partido,\n    categoria_despesa,\n    COUNT(*) as num_transacoes,\n    SUM(valor_liquido) as total_gasto,\n    AVG(valor_liquido) as gasto_medio\nFROM despesas \nWHERE valor_liquido > 0 \n    AND sigla_partido IS NOT NULL\nGROUP BY sigla_partido, categoria_despesa\nORDER BY total_gasto DESC\nLIMIT 50`,
    });

    this.setConfig('development', {
      debug: typeof process !== 'undefined' && (process as NodeJS.Process)?.env?.NODE_ENV === 'development',
      logLevel: 'info',
      enableHotReload: true,
      showPerformanceMetrics: false,
      enableTestData: false,
    });

    this.setConfig('pwa', {
      enableServiceWorker: true,
      enableOfflineCaching: true,
      enablePushNotifications: false,
      enableBackgroundSync: true,
      cacheStrategy: 'cache-first',
      updateStrategy: 'immediate',
    });
  }

  initialize(): void {
    if (this.initialized) return;
    this.loadFromStorage();
    this.applyEnvironmentOverrides();
    this.applyUrlOverrides();
    this.initialized = true;
  }

  getConfig(path: string, defaultValue?: unknown): unknown {
    const keys = path.split('.');
    let current: unknown = this.config;

    for (const key of keys) {
      if (current instanceof Map) {
        current = current.get(key);
      } else if (current && typeof current === 'object') {
        current = (current as Record<string, unknown>)[key];
      } else {
        return defaultValue;
      }

      if (current === undefined) {
        return defaultValue;
      }
    }

    return current;
  }

  setConfig(path: string, value: unknown): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    let current = this.config;

    for (const key of keys) {
      if (!current.has(key)) {
        current.set(key, new Map());
      }
      current = current.get(key) as Map<string, unknown>;
    }

    current.set(lastKey, value);
    this.notifyWatchers(path, value);
    this.saveToStorage();
  }

  updateConfig(path: string, updates: Record<string, unknown>): void {
    const currentValue = this.getConfig(path);
    if (currentValue && typeof currentValue === 'object') {
      this.setConfig(path, { ...(currentValue as Record<string, unknown>), ...updates });
    } else {
      this.setConfig(path, updates);
    }
  }

  hasConfig(path: string): boolean {
    return this.getConfig(path) !== undefined;
  }

  watch(path: string, callback: ConfigWatcher): () => void {
    if (!this.watchers.has(path)) {
      this.watchers.set(path, new Set());
    }
    this.watchers.get(path)!.add(callback);

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

  notifyWatchers(path: string, value: unknown): void {
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

  getDatabaseConfig(): unknown { return this.getConfig('database'); }
  getVisualizationConfig(): unknown { return this.getConfig('visualization'); }
  getNetworkConfig(): unknown { return this.getConfig('network'); }
  getUIConfig(): unknown { return this.getConfig('ui'); }
  getTheme(): string { return this.getConfig('ui.theme', 'dark') as string; }
  setTheme(theme: string): void { this.setConfig('ui.theme', theme); }
  getPerformanceConfig(): unknown { return this.getConfig('performance'); }
  getFeatureFlags(): unknown { return this.getConfig('features'); }
  isFeatureEnabled(feature: string): boolean { return !!this.getConfig(`features.${feature}`, false); }
  enableFeature(feature: string): void { this.setConfig(`features.${feature}`, true); }
  disableFeature(feature: string): void { this.setConfig(`features.${feature}`, false); }
  getEditorConfig(): unknown { return this.getConfig('editor'); }
  getDefaultQuery(): string { return this.getConfig('editor.defaultQuery', '') as string; }
  isDevelopment(): boolean { return !!this.getConfig('development.debug', false); }
  getLogLevel(): string { return this.getConfig('development.logLevel', 'info') as string; }

  loadFromStorage(): void {
    try {
      const stored = localStorage.getItem('viso-config');
      if (stored) {
        const parsedConfig = JSON.parse(stored) as Record<string, unknown>;
        this.mergeConfig(parsedConfig);
      }
    } catch (error) {
      console.warn('Failed to load config from localStorage:', error);
    }
  }

  saveToStorage(): void {
    try {
      const configObject = this.mapToObject(this.config);
      localStorage.setItem('viso-config', JSON.stringify(configObject));
    } catch (error) {
      console.warn('Failed to save config to localStorage:', error);
    }
  }

  mergeConfig(newConfig: Record<string, unknown>): void {
    Object.entries(newConfig).forEach(([key, value]) => {
      if (this.config.has(key)) {
        const existing = this.config.get(key);
        if (existing instanceof Map && typeof value === 'object' && value !== null) {
          this.mergeMap(existing, value as Record<string, unknown>);
        } else {
          this.config.set(key, value);
        }
      } else {
        this.config.set(key, value);
      }
    });
  }

  mergeMap(map: Map<string, unknown>, object: Record<string, unknown>): void {
    Object.entries(object).forEach(([key, value]) => {
      map.set(key, value);
    });
  }

  mapToObject(map: Map<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of map) {
      if (value instanceof Map) {
        result[key] = this.mapToObject(value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  applyEnvironmentOverrides(): void {
    if (typeof window !== 'undefined' && window.VISO_CONFIG) {
      this.mergeConfig(window.VISO_CONFIG);
    }

    if (typeof process !== 'undefined' && (process as NodeJS.Process)?.env?.NODE_ENV === 'production') {
      this.updateConfig('development', {
        debug: false,
        logLevel: 'warn',
        showPerformanceMetrics: false,
      });
    }
  }

  applyUrlOverrides(): void {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);

    if (params.has('theme')) {
      this.setTheme(params.get('theme')!);
    }
    if (params.has('debug')) {
      this.setConfig('development.debug', params.get('debug') === 'true');
    }
    if (params.has('perf')) {
      this.setConfig('development.showPerformanceMetrics', params.get('perf') === 'true');
    }
  }

  exportConfig(): Record<string, unknown> {
    return this.mapToObject(this.config);
  }

  importConfig(configObject: Record<string, unknown>): void {
    this.mergeConfig(configObject);
    this.saveToStorage();
  }

  resetToDefaults(): void {
    this.config.clear();
    this.loadDefaults();
    this.saveToStorage();
  }

  getConfigSummary(): Record<string, unknown> {
    return {
      theme: this.getTheme(),
      features: this.getFeatureFlags(),
      performance: this.getPerformanceConfig(),
      database: this.getDatabaseConfig(),
    };
  }
}

let globalConfigService: ConfigService | null = null;

export function createConfigService(): ConfigService {
  return new ConfigService();
}

export function getGlobalConfigService(): ConfigService {
  if (!globalConfigService) {
    globalConfigService = new ConfigService();
    globalConfigService.initialize();
  }
  return globalConfigService;
}

export default ConfigService;
