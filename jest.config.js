export default {
  // Test environment
  testEnvironment: 'jsdom',

  // ES module support - preset handles this automatically
  preset: null,

  // Module transformation
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        allowJs: true,
        esModuleInterop: true,
        module: 'commonjs',
        rootDir: '.'
      }
    }],
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
    '<rootDir>/tests/unit/**/*.test.[jt]s',
    '<rootDir>/tests/integration/**/*.test.[jt]s'
  ],

  // Module resolution — strip .js extension so ts-jest resolves .ts files
  moduleNameMapper: {
    '^../../src/(.*)\\.js$': '<rootDir>/src/$1',
    '^../src/(.*)\\.js$': '<rootDir>/src/$1',
    '^../../src/(.*)$': '<rootDir>/src/$1',
    '^../src/(.*)$': '<rootDir>/src/$1',
    '^../fixtures/(.*)\\.js$': '<rootDir>/tests/fixtures/$1',
    '^../mocks/(.*)\\.js$': '<rootDir>/tests/mocks/$1',
    '^../utils/(.*)\\.js$': '<rootDir>/tests/utils/$1'
  },

  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.ts'
  ],

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.ts',
    'tests/**/*.ts',
    '!tests/**/*.test.ts',
    '!tests/setup.ts',
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
  moduleFileExtensions: ['ts', 'js', 'json'],

  // Error handling
  errorOnDeprecated: true
};