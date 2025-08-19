export default {
  presets: [
    ['@babel/preset-env', {
      targets: {
        node: 'current'
      },
      // Keep ES modules for Jest to handle properly
      modules: false
    }]
  ],
  
  // Environment-specific configuration
  env: {
    test: {
      presets: [
        ['@babel/preset-env', {
          targets: {
            node: 'current'
          },
          // For Jest, we need to transform ES modules to CommonJS
          modules: 'auto'
        }]
      ]
    }
  },

  // Plugin configuration
  plugins: [
    // Add any plugins needed for your specific use case
  ],

  // Source maps for debugging
  sourceMaps: 'both'
};