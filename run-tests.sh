#!/bin/bash

# VISO Test Runner Script
# Provides convenient commands for running different types of tests

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Print colored output
print_color() {
    printf "${!1}%s${NC}\n" "$2"
}

# Print header
print_header() {
    echo ""
    print_color "BOLD" "========================================="
    print_color "CYAN" "VISO Test Suite"
    print_color "BOLD" "========================================="
    echo ""
}

# Check if dependencies are installed
check_dependencies() {
    print_color "BLUE" "🔍 Checking test dependencies..."
    
    if ! command -v node &> /dev/null; then
        print_color "RED" "❌ Node.js is not installed. Please install Node.js first."
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        print_color "RED" "❌ npm is not installed. Please install npm first."
        exit 1
    fi
    
    if [ ! -f "package.json" ]; then
        print_color "RED" "❌ package.json not found. Please run this script from the project root."
        exit 1
    fi
    
    print_color "GREEN" "✅ Dependencies check passed!"
}

# Install test dependencies
install_deps() {
    print_color "CYAN" "📦 Installing test dependencies..."
    
    npm install
    
    # Install Playwright browsers if not already installed
    if command -v npx &> /dev/null; then
        print_color "BLUE" "🎭 Installing Playwright browsers..."
        npx playwright install
    fi
    
    print_color "GREEN" "✅ Dependencies installed successfully!"
}

# Run unit tests
run_unit_tests() {
    print_color "CYAN" "🧪 Running unit tests..."
    
    if npm run test -- tests/unit; then
        print_color "GREEN" "✅ Unit tests passed!"
    else
        print_color "RED" "❌ Unit tests failed!"
        exit 1
    fi
}

# Run integration tests
run_integration_tests() {
    print_color "CYAN" "🔗 Running integration tests..."
    
    if npm run test -- tests/integration; then
        print_color "GREEN" "✅ Integration tests passed!"
    else
        print_color "RED" "❌ Integration tests failed!"
        exit 1
    fi
}

# Run E2E tests
run_e2e_tests() {
    print_color "CYAN" "🌐 Running E2E tests..."
    
    # Check if local server is running
    if ! curl -s http://localhost:8080 > /dev/null 2>&1; then
        print_color "YELLOW" "⚠️  Local server not detected. Starting server..."
        python -m http.server 8080 > /dev/null 2>&1 &
        SERVER_PID=$!
        sleep 3
        
        # Check if server started successfully
        if ! curl -s http://localhost:8080 > /dev/null 2>&1; then
            print_color "RED" "❌ Failed to start local server"
            exit 1
        fi
        
        print_color "GREEN" "✅ Local server started on port 8080"
    else
        print_color "GREEN" "✅ Local server already running on port 8080"
        SERVER_PID=""
    fi
    
    if npm run test:e2e; then
        print_color "GREEN" "✅ E2E tests passed!"
    else
        print_color "RED" "❌ E2E tests failed!"
        # Stop server if we started it
        if [ ! -z "$SERVER_PID" ]; then
            kill $SERVER_PID 2>/dev/null || true
        fi
        exit 1
    fi
    
    # Stop server if we started it
    if [ ! -z "$SERVER_PID" ]; then
        kill $SERVER_PID 2>/dev/null || true
        print_color "BLUE" "🛑 Local server stopped"
    fi
}

# Run coverage report
run_coverage() {
    print_color "CYAN" "📊 Generating coverage report..."
    
    if npm run test:coverage; then
        print_color "GREEN" "✅ Coverage report generated!"
        print_color "BLUE" "📂 Open coverage/lcov-report/index.html to view detailed report"
    else
        print_color "RED" "❌ Coverage report failed!"
        exit 1
    fi
}

# Run all tests
run_all_tests() {
    print_color "BOLD" "🚀 Running complete test suite..."
    
    run_unit_tests
    run_integration_tests
    run_e2e_tests
    
    print_color "GREEN" "🎉 All tests passed!"
}

# Show help
show_help() {
    cat << EOF
VISO Test Runner

Usage: $0 [COMMAND]

Commands:
    setup       Install dependencies and setup test environment
    unit        Run unit tests only
    integration Run integration tests only
    e2e         Run E2E tests only
    coverage    Run tests with coverage report
    all         Run all tests (unit + integration + e2e)
    help        Show this help message

Examples:
    $0 setup
    $0 unit
    $0 all
    $0 coverage

EOF
}

# Main script logic
main() {
    print_header
    
    case "${1:-help}" in
        "setup")
            check_dependencies
            install_deps
            ;;
        "unit")
            check_dependencies
            run_unit_tests
            ;;
        "integration")
            check_dependencies
            run_integration_tests
            ;;
        "e2e")
            check_dependencies
            run_e2e_tests
            ;;
        "coverage")
            check_dependencies
            run_coverage
            ;;
        "all")
            check_dependencies
            run_all_tests
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            print_color "RED" "❌ Unknown command: $1"
            show_help
            exit 1
            ;;
    esac
}

# Handle script interruption
trap 'print_color "YELLOW" "\n⚠️  Test execution interrupted"' INT TERM

# Run main function with all arguments
main "$@"