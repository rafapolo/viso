import { defineConfig } from 'vite';
import { resolve } from 'path';
import { createHtmlPlugin } from 'vite-plugin-html';

export default defineConfig({
  // Base configuration
  base: './',
  
  // Plugins
  plugins: [
    createHtmlPlugin({
      minify: process.env.NODE_ENV === 'production' ? {
        collapseWhitespace: true,
        removeComments: true,
        removeRedundantAttributes: true,
        removeEmptyAttributes: true,
        minifyCSS: true,
        minifyJS: true
      } : false
    })
  ],
  
  // Build configuration
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    minify: 'terser',
    target: 'es2020',
    
    // Enable minification for all assets
    cssCodeSplit: true,
    reportCompressedSize: true,
    
    // Chunk splitting for better caching
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        db: resolve(__dirname, 'db.html')
      },
      output: {
        manualChunks: {
          // Vendor libraries
          vendor: ['d3', 'd3-sankey'],
          monaco: ['monaco-editor', 'sql-formatter'],
          duckdb: ['@duckdb/duckdb-wasm'],
          
          // Application modules
          shared: [
            'src/shared/constants.js',
            'src/shared/dom-utils.js',
            'src/shared/api-utils.js',
            'src/shared/error-handler.js',
            'src/shared/app-config.js',
            'src/shared/performance-utils.js',
            'src/shared/security-utils.js',
            'src/shared/formatters.js',
            'src/shared/color-utils.js',
            'src/shared/data-utils.js',
            'src/shared/state-manager.js',
            'src/shared/ui-utils.js'
          ],
          utils: [
            'src/utils/query-builder.js',
            'src/utils/query-utils.js'
          ],
          apps: [
            'src/apps/network-app.js',
            'src/apps/db-app.js'
          ]
        },
        
        // Clean file naming
        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js',
        assetFileNames: ({ name }) => {
          if (/\.(gif|jpe?g|png|svg)$/.test(name ?? '')) {
            return 'images/[name]-[hash][extname]';
          }
          if (/\.css$/.test(name ?? '')) {
            return 'css/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        }
      }
    },
    
    // Terser options for production builds
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production',
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.debug'],
      },
      mangle: {
        safari10: true,
      },
      format: {
        comments: false,
      },
    },
    
    // File size warnings
    chunkSizeWarningLimit: 1000,
  },
  
  // Development server
  server: {
    port: 3000,
    host: true,
    open: false,
    cors: true
  },
  
  // Preview server (for testing production build)
  preview: {
    port: 4173,
    host: true,
    open: false,
    cors: true
  },
  
  // Path resolution
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@shared': resolve(__dirname, 'src/shared'),
      '@apps': resolve(__dirname, 'src/apps'),
      '@db': resolve(__dirname, 'src/db'),
      '@index': resolve(__dirname, 'src/index'),
      '@features': resolve(__dirname, 'src/features'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@tests': resolve(__dirname, 'tests')
    }
  },
  
  // Define global constants
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
    __BUILD_ENV__: JSON.stringify(process.env.NODE_ENV || 'development'),
  },
  
  // CSS configuration
  css: {
    devSourcemap: true,
    preprocessorOptions: {},
    minify: true
  },
  
  // Optimization
  optimizeDeps: {
    include: [
      'd3',
      'd3-sankey',
      '@duckdb/duckdb-wasm'
    ]
  },
  
  // Environment variables
  envPrefix: 'VISO_',
  
  // Asset handling
  assetsInclude: ['**/*.parquet']
})