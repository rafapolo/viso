// Centralized Application Configuration
import { APP_CONSTANTS, COLORS } from '../core/config.js';

export interface DatabaseConfig {
  parquetUrl: string;
  defaultQuery: string;
  maxRetries: number;
  timeoutMs: number;
}

export interface AppConfig {
  database: DatabaseConfig;
  visualization: Record<string, unknown>;
  ui: Record<string, unknown>;
  performance: Record<string, unknown>;
  errorHandling: Record<string, unknown>;
  development: Record<string, unknown>;
  security: Record<string, unknown>;
  features: Record<string, boolean>;
}

export const APP_CONFIG: AppConfig = {
  // Database Configuration
  database: {
    parquetUrl:
      'https://rafapolo.github.io/transparencia-dados/despesas_publicas_deputados.parquet',
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
  },

  // Visualization Configuration
  visualization: {
    network: {
      width: APP_CONSTANTS.UI.NETWORK_WIDTH,
      height: APP_CONSTANTS.UI.NETWORK_HEIGHT,
      forces: {
        linkDistance: 100,
        chargeStrength: -300,
        collisionRadius: 30,
      },
      node: {
        minRadius: 5,
        maxRadius: 50,
        radiusDivisor: 5000,
      },
      link: {
        minWidth: 1,
        maxWidth: 10,
        widthDivisor: 1000,
      },
    },
    charts: {
      pieChart: {
        maxSlices: APP_CONSTANTS.TEXT.MAX_PIE_SLICES,
        colors: Object.values(COLORS.ENTITIES),
      },
      timeline: {
        maxDataPoints: 50,
        dateFormat: 'YYYY-MM',
      },
    },
  },

  // UI Configuration
  ui: {
    pagination: {
      rowsPerPage: APP_CONSTANTS.PAGINATION.ROWS_PER_PAGE,
      maxVisiblePages: APP_CONSTANTS.PAGINATION.MAX_VISIBLE_PAGES,
    },
    debounce: {
      search: 300,
      slider: 500,
      resize: 250,
    },
    animation: {
      transitionDuration: 300,
      fadeInDuration: 200,
      modalShowDelay: 100,
    },
    notifications: {
      defaultDuration: 5000,
      errorDuration: 8000,
      successDuration: 3000,
    },
  },

  // Performance Configuration
  performance: {
    lazyLoading: {
      enabled: true,
      threshold: 100,
    },
    virtualization: {
      enabled: true,
      bufferSize: 20,
    },
    caching: {
      enabled: true,
      maxAge: 300000,
      maxSize: 50,
    },
    workers: {
      dataProcessing: true,
      networkCalculation: true,
    },
  },

  // Error Handling Configuration
  errorHandling: {
    maxRetries: 3,
    retryDelay: 1000,
    enableReporting: true,
    userFriendlyMessages: true,
    showStackTrace: false,
  },

  // Development Configuration
  development: {
    enableLogging: true,
    enableDebugMode: false,
    enablePerformanceMonitoring: true,
    mockData: false,
  },

  // Security Configuration
  security: {
    sanitizeInput: true,
    maxQueryLength: 10000,
    allowedFileTypes: ['.parquet', '.csv', '.json'],
    maxFileSize: 100 * 1024 * 1024,
    corsEnabled: true,
  },

  // Feature Flags
  features: {
    sankeyDiagram: true,
    networkAnalysis: true,
    advancedFilters: true,
    dataExport: true,
    realTimeUpdates: false,
    multiLanguage: false,
    darkMode: true,
    offlineMode: false,
  },
};

// Get base path for navigation (handles GitHub Pages vs localhost)
export const getBasePath = (): string => {
  const isDevelopment =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  return isDevelopment ? '/' : '/viso/';
};

// Environment-specific configurations
export const getEnvironmentConfig = (): AppConfig => {
  const isDevelopment =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  if (isDevelopment) {
    return {
      ...APP_CONFIG,
      development: {
        ...APP_CONFIG.development,
        enableLogging: true,
        enableDebugMode: true,
        enablePerformanceMonitoring: true,
      },
      errorHandling: {
        ...APP_CONFIG.errorHandling,
        showStackTrace: true,
      },
    };
  }

  return {
    ...APP_CONFIG,
    development: {
      ...APP_CONFIG.development,
      enableLogging: false,
      enableDebugMode: false,
    },
    errorHandling: {
      ...APP_CONFIG.errorHandling,
      showStackTrace: false,
    },
  };
};

// Configuration validation
export const validateConfig = (config: AppConfig): boolean => {
  const required = [
    'database.parquetUrl',
    'visualization.network.width',
    'visualization.network.height',
    'ui.pagination.rowsPerPage',
  ];

  const missing = required.filter((path) => {
    const value = path.split('.').reduce((obj: unknown, key: string) => {
      return obj && typeof obj === 'object' ? (obj as Record<string, unknown>)[key] : undefined;
    }, config as unknown);
    return value === undefined || value === null;
  });

  if (missing.length > 0) {
    throw new Error(`Missing required configuration: ${missing.join(', ')}`);
  }

  return true;
};

// Default export with environment-specific config
export default getEnvironmentConfig();
