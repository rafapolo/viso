export default {
  // Test environment
  testEnvironment: 'jsdom',

  // ES module support - preset handles this automatically
  preset: null,

  // Module transformation
  transform: {
    '^.+\\.js$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', {
          targets: { node: 'current' },
          modules: 'auto' // Let babel handle module transformation
        }]
      ]
    }]
  },

  // Transform ignore patterns for ES modules in node_modules
  transformIgnorePatterns: [
    'node_modules/(?!(d3|d3-.*)/)'
  ],

  // Test file patterns
  testMatch: [
    '<rootDir>/tests/unit/**/*.test.js',
    '<rootDir>/tests/integration/**/*.test.js'
  ],

  // Module resolution
  moduleNameMapper: {
    '^../../src/(.*)$': '<rootDir>/src/$1',
    '^../src/(.*)$': '<rootDir>/src/$1'
  },

  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.js'
  ],

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.js',
    'tests/**/*.js',
    '!tests/**/*.test.js',
    '!tests/setup.js',
    '!tests/mocks/**',
    '!tests/fixtures/**',
    '!tests/debug/**',
    '!tests/utils/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],

  // Performance and debugging
  maxWorkers: '50%',
  testTimeout: 10000,
  clearMocks: true,
  restoreMocks: true,

  // Verbose output for better debugging
  verbose: false,

  // Module directories
  moduleDirectories: ['node_modules', '<rootDir>'],

  // File extensions Jest will process
  moduleFileExtensions: ['js', 'json'],

  // Error handling
  errorOnDeprecated: true
};