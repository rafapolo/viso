import { defineConfig } from 'vite';
import { resolve } from 'path';
// import { createHtmlPlugin } from 'vite-plugin-html';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import monacoEditorPlugin from 'vite-plugin-monaco-editor';

export default defineConfig(({ command, mode }) => ({
  // Base configuration - use different base for production vs development
  base: mode === 'production' ? '/viso/' : '/',
  
  // Plugins
  plugins: [
    // HTML minification handled by Vite natively
    // Copy vendor directory to build output
    viteStaticCopy({
      targets: [
        {
          src: 'vendor/**/*',
          dest: 'vendor'
        },
        {
          src: 'manifest.json',
          dest: '.'
        }
      ]
    }),
    // Monaco Editor plugin
    monacoEditorPlugin.default({}),
    // SPA routing plugin
    {
      name: 'spa-fallback',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url && (req.url.startsWith('/deputado-') || req.url.startsWith('/empresa-'))) {
            req.url = '/index.html';
          }
          // Handle db.html with query parameters
          if (req.url && req.url.startsWith('/db.html?')) {
            req.url = '/db.html';
          }
          next();
        });
      },
      configurePreviewServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url && (req.url.startsWith('/deputado-') || req.url.startsWith('/empresa-'))) {
            req.url = '/index.html';
          }
          // Handle db.html with query parameters
          if (req.url && req.url.startsWith('/db.html?')) {
            req.url = '/db.html';
          }
          next();
        });
      }
    }
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
          // Vendor libraries (now bundled from vendor/ directory) - Monaco handled by plugin
          
          // Application modules
          shared: [
            'src/core/config.js',
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
            'src/apps/graph-app.js',
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
    port: 3001,
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
      '@tests': resolve(__dirname, 'tests'),
      'apache-arrow': resolve(__dirname, 'node_modules/apache-arrow')
    }
  },
  
  // Define global constants
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
    __BUILD_ENV__: JSON.stringify(process.env.NODE_ENV || 'development'),
    // S3 Configuration from environment
    __S3_ACCESS_KEY_ID__: JSON.stringify(process.env.AWS_ACCESS_KEY_ID || ''),
    __S3_SECRET_ACCESS_KEY__: JSON.stringify(process.env.AWS_SECRET_ACCESS_KEY || ''),
    __S3_BUCKET__: JSON.stringify(process.env.HETZNER_S3_BUCKET || 'baseldosdados'),
    __S3_ENDPOINT__: JSON.stringify(process.env.HETZNER_S3_ENDPOINT || 'https://hel1.your-objectstorage.com'),
  },
  
  // CSS configuration
  css: {
    devSourcemap: true,
    preprocessorOptions: {},
    minify: true
  },
  
  // Optimization
  optimizeDeps: {
    exclude: [
      'd3',
      'd3-sankey', 
      '@duckdb/duckdb-wasm',
      'sql-formatter'
    ]
  },
  
  // Environment variables
  envPrefix: 'VISO_',
  
  // Asset handling
  assetsInclude: ['**/*.parquet'],
  
  // Public directory for static assets
  publicDir: 'public',
}))