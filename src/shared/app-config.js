// Centralized Application Configuration
import { APP_CONSTANTS } from './constants.js';

export const APP_CONFIG = {
  // Database Configuration
  database: {
    parquetUrl: 'https://rafapolo.github.io/transparencia-dados/despesas_publicas_deputados.parquet',
    defaultQuery: `SELECT 
      nome_parlamentar,
      sigla_partido,
      fornecedor,
      categoria_despesa,
      valor_liquido,
      data_emissao
    FROM despesas 
    WHERE valor_liquido > 1000
    ORDER BY valor_liquido DESC 
    LIMIT 100`,
    maxRetries: 3,
    timeoutMs: 30000
  },

  // Visualization Configuration
  visualization: {
    network: {
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
        radiusDivisor: 5000
      },
      link: {
        minWidth: 1,
        maxWidth: 10,
        widthDivisor: 1000
      }
    },
    charts: {
      pieChart: {
        maxSlices: APP_CONSTANTS.TEXT.MAX_PIE_SLICES,
        colors: Object.values(APP_CONSTANTS.COLORS.ENTITIES)
      },
      timeline: {
        maxDataPoints: 50,
        dateFormat: 'YYYY-MM'
      }
    }
  },

  // UI Configuration
  ui: {
    pagination: {
      rowsPerPage: APP_CONSTANTS.PAGINATION.ROWS_PER_PAGE,
      maxVisiblePages: APP_CONSTANTS.PAGINATION.MAX_VISIBLE_PAGES
    },
    debounce: {
      search: 300,
      slider: 500,
      resize: 250
    },
    animation: {
      transitionDuration: 300,
      fadeInDuration: 200,
      modalShowDelay: 100
    },
    notifications: {
      defaultDuration: 5000,
      errorDuration: 8000,
      successDuration: 3000
    }
  },

  // Performance Configuration
  performance: {
    lazyLoading: {
      enabled: true,
      threshold: 100 // items
    },
    virtualization: {
      enabled: true,
      bufferSize: 20
    },
    caching: {
      enabled: true,
      maxAge: 300000, // 5 minutes
      maxSize: 50 // MB
    },
    workers: {
      dataProcessing: true,
      networkCalculation: true
    }
  },

  // Error Handling Configuration
  errorHandling: {
    maxRetries: 3,
    retryDelay: 1000, // ms
    enableReporting: true,
    userFriendlyMessages: true,
    showStackTrace: false // in production
  },

  // Development Configuration
  development: {
    enableLogging: true,
    enableDebugMode: false,
    enablePerformanceMonitoring: true,
    mockData: false
  },

  // Security Configuration
  security: {
    sanitizeInput: true,
    maxQueryLength: 10000,
    allowedFileTypes: ['.parquet', '.csv', '.json'],
    maxFileSize: 100 * 1024 * 1024, // 100MB
    corsEnabled: true
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
    offlineMode: false
  }
};

// Environment-specific configurations
export const getEnvironmentConfig = () => {
  const isDevelopment = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1';

  if (isDevelopment) {
    return {
      ...APP_CONFIG,
      development: {
        ...APP_CONFIG.development,
        enableLogging: true,
        enableDebugMode: true,
        enablePerformanceMonitoring: true
      },
      errorHandling: {
        ...APP_CONFIG.errorHandling,
        showStackTrace: true
      }
    };
  }

  return {
    ...APP_CONFIG,
    development: {
      ...APP_CONFIG.development,
      enableLogging: false,
      enableDebugMode: false
    },
    errorHandling: {
      ...APP_CONFIG.errorHandling,
      showStackTrace: false
    }
  };
};

// Configuration validation
export const validateConfig = (config) => {
  const required = [
    'database.parquetUrl',
    'visualization.network.width',
    'visualization.network.height',
    'ui.pagination.rowsPerPage'
  ];

  const missing = required.filter(path => {
    const value = path.split('.').reduce((obj, key) => obj?.[key], config);
    return value === undefined || value === null;
  });

  if (missing.length > 0) {
    throw new Error(`Missing required configuration: ${missing.join(', ')}`);
  }

  return true;
};

// Default export with environment-specific config
export default getEnvironmentConfig();