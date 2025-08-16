#!/usr/bin/env node

/**
 * Test Runner for VISO
 * Provides convenient commands for running different types of tests
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const TESTS_DIR = path.join(__dirname, 'tests');

// ANSI color codes for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(code);
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

async function checkTestSetup() {
  log('🔍 Checking test setup...', 'blue');
  
  // Check if test directories exist
  const requiredDirs = ['unit', 'integration', 'e2e', 'fixtures', 'mocks'];
  for (const dir of requiredDirs) {
    const dirPath = path.join(TESTS_DIR, dir);
    if (!fs.existsSync(dirPath)) {
      log(`❌ Missing test directory: ${dir}`, 'red');
      return false;
    }
  }
  
  // Check if package.json exists
  const packageJsonPath = path.join(__dirname, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    log('❌ Missing package.json', 'red');
    return false;
  }
  
  log('✅ Test setup looks good!', 'green');
  return true;
}

async function runUnitTests() {
  log('🧪 Running unit tests...', 'cyan');
  try {
    await runCommand('npm', ['run', 'test', '--', 'tests/unit']);
    log('✅ Unit tests passed!', 'green');
  } catch (error) {
    log('❌ Unit tests failed!', 'red');
    throw error;
  }
}

async function runIntegrationTests() {
  log('🔗 Running integration tests...', 'cyan');
  try {
    await runCommand('npm', ['run', 'test', '--', 'tests/integration']);
    log('✅ Integration tests passed!', 'green');
  } catch (error) {
    log('❌ Integration tests failed!', 'red');
    throw error;
  }
}

async function runE2ETests() {
  log('🌐 Running E2E tests...', 'cyan');
  try {
    // Check if Playwright is installed
    await runCommand('npx', ['playwright', '--version']);
    await runCommand('npm', ['run', 'test:e2e']);
    log('✅ E2E tests passed!', 'green');
  } catch (error) {
    log('❌ E2E tests failed!', 'red');
    log('💡 Make sure to install Playwright: npx playwright install', 'yellow');
    throw error;
  }
}

async function runCoverageReport() {
  log('📊 Generating coverage report...', 'cyan');
  try {
    await runCommand('npm', ['run', 'test:coverage']);
    log('✅ Coverage report generated!', 'green');
    log('📂 Open coverage/lcov-report/index.html to view detailed report', 'blue');
  } catch (error) {
    log('❌ Coverage report failed!', 'red');
    throw error;
  }
}

async function runDebugTests() {
  log('🐛 Running debug tests...', 'cyan');
  
  const debugDir = path.join(TESTS_DIR, 'debug');
  if (!fs.existsSync(debugDir)) {
    log('❌ Debug tests directory not found!', 'red');
    throw new Error('Debug tests directory missing');
  }
  
  const debugFiles = fs.readdirSync(debugDir).filter(file => file.endsWith('.js'));
  
  if (debugFiles.length === 0) {
    log('⚠️ No debug test files found!', 'yellow');
    return;
  }
  
  log(`🔍 Found ${debugFiles.length} debug test files`, 'blue');
  
  for (const file of debugFiles) {
    const filePath = path.join(debugDir, file);
    log(`\n🔄 Running ${file}...`, 'cyan');
    
    try {
      await runCommand('node', [filePath], { cwd: __dirname });
      log(`✅ ${file} completed successfully`, 'green');
    } catch (error) {
      log(`❌ ${file} failed`, 'red');
      log(`   Error: ${error.message}`, 'red');
    }
  }
  
  log('\n🔍 Debug tests completed', 'blue');
}

async function installDependencies() {
  log('📦 Installing test dependencies...', 'cyan');
  try {
    await runCommand('npm', ['install']);
    await runCommand('npx', ['playwright', 'install']);
    log('✅ Dependencies installed!', 'green');
  } catch (error) {
    log('❌ Dependency installation failed!', 'red');
    throw error;
  }
}

function showHelp() {
  log('VISO Test Runner', 'bold');
  log('================', 'bold');
  console.log(`
Usage: node test-runner.js [command]

Commands:
  setup       Install dependencies and setup test environment
  unit        Run unit tests only
  integration Run integration tests only
  e2e         Run E2E tests only
  coverage    Run tests with coverage report
  debug       Run debug/manual testing scripts
  all         Run all tests (unit + integration + e2e)
  check       Check test setup without running tests
  help        Show this help message

Examples:
  node test-runner.js setup
  node test-runner.js unit
  node test-runner.js debug
  node test-runner.js all
  node test-runner.js coverage
`);
}

async function main() {
  const command = process.argv[2];
  
  try {
    switch (command) {
      case 'setup':
        await installDependencies();
        break;
        
      case 'check':
        await checkTestSetup();
        break;
        
      case 'unit':
        await checkTestSetup();
        await runUnitTests();
        break;
        
      case 'integration':
        await checkTestSetup();
        await runIntegrationTests();
        break;
        
      case 'e2e':
        await checkTestSetup();
        await runE2ETests();
        break;
        
      case 'coverage':
        await checkTestSetup();
        await runCoverageReport();
        break;
        
      case 'debug':
        await runDebugTests();
        break;
        
      case 'all':
        await checkTestSetup();
        log('🚀 Running complete test suite...', 'bold');
        await runUnitTests();
        await runIntegrationTests();
        await runE2ETests();
        log('🎉 All tests passed!', 'green');
        break;
        
      case 'help':
      case '--help':
      case '-h':
        showHelp();
        break;
        
      default:
        if (command) {
          log(`❌ Unknown command: ${command}`, 'red');
        }
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    log(`❌ Test execution failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  log('❌ Unhandled Rejection:', 'red');
  console.error(reason);
  process.exit(1);
});

// Run the main function
if (require.main === module) {
  main();
}