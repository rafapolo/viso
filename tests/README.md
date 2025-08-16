# VISO Test Suite

## Overview

This document describes the comprehensive test suite for the VISO (Parliamentary Expenses Visualization) project. The tests are organized to validate both the legacy and refactored codebase, ensuring functionality works correctly across different architectural approaches.

## Test Structure

```
tests/
├── unit/                    # Unit tests for individual modules
│   ├── format-utils.test.js      # Format utilities (currency, dates, etc.)
│   ├── query-utils.test.js       # SQL query building and utilities
│   ├── duckdb-manager.test.js    # Database connection management
│   ├── shared-utils.test.js      # DOM utilities and error handling
│   ├── state-manager.test.js     # State management and URL state
│   └── chart-utils.test.js       # Chart creation and visualization
├── integration/             # Integration tests for component interaction
│   ├── query-interface.test.js   # Query interface functionality
│   └── network-visualization.test.js # Network visualization
├── e2e/                     # End-to-end tests (Playwright)
│   ├── user-workflows.test.js    # Complete user workflows
│   └── data-visualization.test.js # Data visualization flows
├── debug/                   # Manual debugging and validation scripts
│   ├── db-errors-debug.js        # Database error testing
│   ├── db-layout-debug.js        # Layout validation
│   ├── db-functionality-debug.js # Full functionality test
│   └── dist-validation.js        # Production build validation
├── mocks/                   # Mock data and services
├── fixtures/                # Test data and fixtures
└── setup.js                # Global test setup
```

## Refactored Architecture Testing

The refactored codebase introduces a modular architecture with the following key components:

### Core Modules Tested

1. **Shared Utilities** (`src/shared/`)
   - `dom-utils.js` - DOM manipulation and safety
   - `error-handler.js` - Centralized error handling
   - `api-utils.js` - API communication utilities

2. **State Management** (`src/state-manager.js`)
   - Application state management
   - URL state synchronization
   - Local storage management
   - Undo/redo functionality

3. **Data Processing** (`src/format-utils.js`, `src/query-utils.js`)
   - Data formatting (currency, dates, percentages)
   - SQL query building and validation
   - Data transformation utilities

4. **Database Management** (`src/duckdb-manager.js`)
   - DuckDB WASM connection handling
   - Query execution and result processing
   - Connection status monitoring

5. **Visualization** (`src/chart-utils.js`)
   - Chart creation (pie, bar, time series)
   - Canvas manipulation and rendering
   - Interactive features

## Test Categories

### Unit Tests

Unit tests focus on individual modules and functions, using mock implementations to avoid external dependencies:

- **Format Utils**: Tests currency formatting, date handling, percentage calculations
- **Query Utils**: Tests SQL query building, pagination, and filtering
- **DuckDB Manager**: Tests connection management and query execution logic
- **Shared Utils**: Tests DOM utilities and error handling mechanisms
- **State Manager**: Tests state management, history, and persistence
- **Chart Utils**: Tests chart creation and data visualization

### Integration Tests

Integration tests validate component interactions:

- **Query Interface**: Tests the complete query execution flow
- **Network Visualization**: Tests data processing and visualization pipeline

### End-to-End Tests

E2E tests validate complete user workflows using Playwright:

- **User Workflows**: Complete user journeys from data loading to visualization
- **Data Visualization**: Interactive features and responsive behavior

### Debug Tests

Manual testing scripts for validation and debugging:

- **DB Error Testing**: Validates error handling in database operations
- **Layout Testing**: Ensures UI components render correctly
- **Functionality Testing**: Comprehensive feature validation
- **Dist Validation**: Tests production build functionality

## Running Tests

### All Tests
```bash
npm test
```

### Unit Tests Only
```bash
npm run test tests/unit/
```

### Integration Tests Only
```bash
npm run test tests/integration/
```

### E2E Tests
```bash
npm run test:e2e
```

### Debug Scripts
```bash
npm run test:debug
```

### Coverage Report
```bash
npm run test:coverage
```

### Using Test Runner
```bash
# Setup test environment
node test-runner.js setup

# Run specific test types
node test-runner.js unit
node test-runner.js integration
node test-runner.js e2e
node test-runner.js debug
node test-runner.js coverage

# Run all tests
node test-runner.js all

# Check test setup
node test-runner.js check
```

## Test Configuration

### Jest Configuration

Tests use Jest with the following configuration:

- **Environment**: jsdom for DOM testing
- **Coverage**: Includes src/ and tests/ directories
- **Setup**: Global setup in `tests/setup.js`
- **Mocks**: Global mocks for canvas, performance, fetch

### Playwright Configuration

E2E tests use Playwright with:

- **Browsers**: Chromium (headless by default)
- **Timeouts**: 30s for actions, 60s for tests
- **Base URL**: Configurable test server
- **Screenshots**: On failure

## Mock Strategy

### DOM Mocking
- Canvas API mocking for chart tests
- Element creation and manipulation
- Event listener management

### API Mocking
- DuckDB WASM interface mocking
- HTTP request mocking
- Database query result mocking

### Module Mocking
Since the refactored codebase uses ES modules and Jest has limitations with ES module imports, tests use mock implementations that mirror the actual module interfaces. This approach:

1. **Maintains Interface Compatibility**: Mocks replicate the exact API of real modules
2. **Enables Fast Testing**: Avoids complex ES module configuration
3. **Validates Logic**: Tests business logic without external dependencies
4. **Ensures Reliability**: Consistent test behavior across environments

## Test Data

### Fixtures
- **Sample Parquet Data**: Representative parliamentary expense data
- **Mock Query Results**: Predefined query responses
- **Test Schemas**: Database schema definitions

### Mocks
- **DuckDB Manager**: Mock database connections and queries
- **API Responses**: Mock HTTP responses
- **DOM Elements**: Mock DOM manipulation

## Continuous Integration

Tests are designed to run in CI environments:

- **Headless Mode**: E2E tests run without GUI
- **Fast Execution**: Unit and integration tests complete quickly
- **Parallel Execution**: Tests can run in parallel
- **Environment Isolation**: Each test suite is independent

## Debugging Tests

### Failed Tests
1. Check test output for specific error messages
2. Use `npm run test:debug` for manual validation
3. Run individual test files: `npm test tests/unit/specific-test.js`
4. Use `console.log` in test files for debugging

### Browser Tests
1. Use headless: false in Playwright for visual debugging
2. Add `page.pause()` in E2E tests for step-by-step debugging
3. Check browser console output in debug scripts

### Coverage Issues
1. Run `npm run test:coverage` to see coverage report
2. Check `coverage/lcov-report/index.html` for detailed coverage
3. Add tests for uncovered code paths

## Performance Considerations

- **Fast Unit Tests**: Mock heavy dependencies
- **Isolated Tests**: Each test is independent
- **Parallel Execution**: Tests run concurrently when possible
- **Resource Cleanup**: Proper cleanup in afterEach hooks

## Best Practices

1. **Test Structure**: Use describe/test blocks for clear organization
2. **Assertions**: Use specific expectations rather than broad checks
3. **Mocking**: Mock external dependencies consistently
4. **Cleanup**: Always clean up resources after tests
5. **Documentation**: Comment complex test logic
6. **Error Testing**: Test both success and failure cases

## Contributing

When adding new features or modifying existing code:

1. **Write Tests First**: Use TDD approach when possible
2. **Update Existing Tests**: Modify tests when changing functionality
3. **Add Coverage**: Ensure new code has appropriate test coverage
4. **Test Integration**: Verify changes don't break existing functionality
5. **Document Changes**: Update this README when adding new test categories

## Troubleshooting

### Common Issues

1. **ES Module Errors**: Use mock implementations instead of direct imports
2. **Canvas Errors**: Ensure canvas mocks are properly configured
3. **Timeout Issues**: Increase timeouts for slow operations
4. **CORS Issues**: Use proper test server configuration
5. **File Not Found**: Check file paths in debug scripts

### Getting Help

- Check test output for specific error messages
- Review this documentation for test structure
- Use debug scripts for manual validation
- Check the test setup configuration

This test suite ensures the VISO application maintains high quality and reliability across both legacy and refactored codebases.