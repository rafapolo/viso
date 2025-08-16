// Application Constants
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
  }
};

// Color Palette
export const COLORS = {
  // Primary Brand Colors
  DUCKDB: {
    50: '#fffbeb',
    100: '#fef3c7', 
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#FFC000', // DuckDB yellow
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f'
  },

  // Entity Type Colors
  ENTITIES: {
    DEPUTY: '#3b82f6',    // Blue
    SUPPLIER: '#ef4444',   // Red
    PARTY: '#2E86AB',      // Deep blue
    CATEGORY: '#A23B72',   // Purple
    FORNECEDOR: '#F18F01'  // Orange
  },

  // Chart Colors Palette
  CHART_PALETTE: [
    '#3B82F6', // blue
    '#10B981', // green
    '#8B5CF6', // purple
    '#F59E0B', // yellow
    '#EC4899', // pink
    '#6366F1', // indigo
    '#EF4444', // red
    '#F97316', // orange
    '#14B8A6', // teal
    '#06B6D4'  // cyan
  ],

  // Semantic Colors
  SEMANTIC: {
    SUCCESS: '#10B981',
    ERROR: '#EF4444',
    WARNING: '#F59E0B',
    INFO: '#3B82F6',
    DEFAULT_GRAY: '#6B7280',
    LIGHT_GRAY: '#9CA3AF',
    BORDER_GRAY: '#374151',
    GRID_COLOR: '#374151',
    WHITE: '#FFFFFF',
    BLACK: '#000000',
    SELECTION_GOLD: '#FFD700'
  },

  // Theme Colors
  THEME: {
    DARK: {
      BACKGROUND: '#0f1419',
      TEXT: '#FFFFFF',
      BORDER: '#374151',
      TRACK_BG: '#374151',
      THUMB_BORDER: '#1f2937'
    },
    LIGHT: {
      BACKGROUND: '#f3f4f6',
      TEXT: '#000000', 
      BORDER: '#e5e7eb',
      TRACK_BG: '#d1d5db',
      THUMB_BORDER: '#ffffff'
    }
  }
};

// Data Type Icons
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

// CSS Classes
export const CSS_CLASSES = {
  STATUS: {
    ERROR: 'text-xs text-red-500 dark:text-red-400',
    SUCCESS: 'text-xs text-duckdb-500',
    DISCONNECTED: 'text-xs text-red-500 dark:text-red-400'
  },
  
  BUTTONS: {
    DISABLED: 'cursor-not-allowed opacity-50',
    ACTIVE: 'z-10 bg-duckdb-500 border-duckdb-500 text-black'
  },

  PAGINATION: {
    BUTTON_BASE: 'relative inline-flex items-center px-4 py-2 border text-sm font-medium',
    BUTTON_NORMAL: 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
  }
};

// SQL Query Templates
export const QUERY_TEMPLATES = {
  DEFAULT_LIMIT: 10,
  AGGREGATION_LIMIT: 15,
  TOP_RESULTS_LIMIT: 20,
  ANALYSIS_LIMIT: 30
};