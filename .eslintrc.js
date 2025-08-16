module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
    jest: true
  },
  extends: [
    'eslint:recommended',
    'prettier'
  ],
  plugins: [
    'jest'
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    // Best Practices
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-debugger': 'error',
    'no-alert': 'error',
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-undef': 'error',
    'prefer-const': 'error',
    'no-var': 'error',

    // ES6+
    'arrow-spacing': 'error',
    'prefer-arrow-callback': 'error',
    'prefer-template': 'error',
    'template-curly-spacing': 'error',

    // Code Quality
    'eqeqeq': ['error', 'always'],
    'no-duplicate-imports': 'error',
    'no-useless-return': 'error',
    'object-shorthand': 'error',
    'prefer-destructuring': ['error', {
      array: false,
      object: true
    }],

    // Security
    'no-new-object': 'error',
    'no-new-wrappers': 'error',
    'no-array-constructor': 'error',

    // Performance
    'no-extend-native': 'error',
    'no-iterator': 'error',
    'no-proto': 'error',

    // Jest specific rules
    'jest/no-disabled-tests': 'warn',
    'jest/no-focused-tests': 'error',
    'jest/no-identical-title': 'error',
    'jest/prefer-to-have-length': 'warn',
    'jest/valid-expect': 'error'
  },
  overrides: [
    {
      files: ['tests/**/*.js'],
      env: {
        jest: true
      },
      rules: {
        'no-console': 'off'
      }
    },
    {
      files: ['src/shared/**/*.js'],
      rules: {
        'no-console': ['error', { allow: ['warn', 'error'] }]
      }
    },
    {
      files: ['*.config.js', 'vite.config.js', 'playwright.config.js'],
      env: {
        node: true
      },
      rules: {
        'no-console': 'off'
      }
    }
  ],
  globals: {
    // Browser globals
    'd3': 'readonly',
    'monaco': 'readonly',

    // Application globals
    'DuckDBDataProtocol': 'readonly',
    'DuckDBBundles': 'readonly',

    // Test globals
    'expect': 'readonly',
    'jest': 'readonly',
    'describe': 'readonly',
    'it': 'readonly',
    'beforeEach': 'readonly',
    'afterEach': 'readonly',
    'beforeAll': 'readonly',
    'afterAll': 'readonly'
  }
};