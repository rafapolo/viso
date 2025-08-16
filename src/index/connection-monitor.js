// Connection Health Monitoring
import { ErrorHandler } from '../shared/error-handler.js';

export class ConnectionMonitor {
  constructor() {
    this.healthCheckInterval = null;
    this.checkIntervalMs = 30000; // 30 seconds
  }

  /**
   * Start periodic connection health monitoring
   */
  startMonitoring() {
    // Clear any existing interval
    this.stopMonitoring();

    this.healthCheckInterval = setInterval(async () => {
      if (window.getConnectionStatus() === 'connected') {
        const isHealthy = await this.checkConnectionHealth();
        if (!isHealthy) {
          console.warn('🔴 Connection lost during health check');
          window.updateConnectionStatus('error', 'Conexão perdida');
        }
      }
    }, this.checkIntervalMs);

    console.log('🔍 Connection monitoring started');
  }

  /**
   * Stop connection health monitoring
   */
  stopMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      console.log('⏹️ Connection monitoring stopped');
    }
  }

  /**
   * Check connection health by performing a simple query
   * @returns {Promise<boolean>} Whether connection is healthy
   */
  async checkConnectionHealth() {
    try {
      // Perform a lightweight query to test the connection
      const result = await window.duckdbAPI.query('SELECT 1 as health_check');
      
      if (result && result.numRows > 0) {
        return true;
      }
      
      return false;
    } catch (error) {
      ErrorHandler.handleError(error, 'Connection Health Check', 'warn', {
        showUser: false // Don't show user notification for health checks
      });
      return false;
    }
  }

  /**
   * Perform a comprehensive connection test
   * @returns {Promise<Object>} Test results
   */
  async performConnectionTest() {
    const testResults = {
      timestamp: new Date().toISOString(),
      duckdbAPI: false,
      queryExecution: false,
      dataAccess: false,
      responseTime: null
    };

    try {
      const startTime = performance.now();

      // Test 1: Check if DuckDB API is available
      if (window.duckdbAPI) {
        testResults.duckdbAPI = true;
      }

      // Test 2: Test query execution
      const testQuery = 'SELECT COUNT(*) as count FROM despesas LIMIT 1';
      const result = await window.duckdbAPI.query(testQuery);
      
      if (result) {
        testResults.queryExecution = true;
        
        // Test 3: Check if we can access data
        if (result.numRows >= 0) {
          testResults.dataAccess = true;
        }
      }

      const endTime = performance.now();
      testResults.responseTime = Math.round(endTime - startTime);

      return testResults;

    } catch (error) {
      ErrorHandler.handleError(error, 'Connection Test');
      return testResults;
    }
  }

  /**
   * Get connection diagnostics information
   * @returns {Promise<Object>} Diagnostic information
   */
  async getDiagnostics() {
    try {
      const diagnostics = {
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        connectionStatus: window.getConnectionStatus ? window.getConnectionStatus() : 'unknown',
        isMonitoring: this.healthCheckInterval !== null,
        checkInterval: this.checkIntervalMs
      };

      // Add connection test results
      const testResults = await this.performConnectionTest();
      diagnostics.testResults = testResults;

      // Add database information if available
      if (window.duckdbAPI) {
        try {
          const dbInfo = await window.duckdbAPI.query("SELECT COUNT(*) as total_records FROM despesas");
          if (dbInfo && dbInfo.numRows > 0) {
            diagnostics.totalRecords = dbInfo.toArray()[0].total_records;
          }
        } catch (error) {
          diagnostics.dbError = error.message;
        }
      }

      return diagnostics;

    } catch (error) {
      ErrorHandler.handleError(error, 'Connection Diagnostics');
      return {
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  /**
   * Update connection status in UI
   * @param {string} status - Connection status ('connected', 'error', 'loading')
   * @param {string} message - Status message
   */
  updateStatus(status, message) {
    if (window.updateConnectionStatus) {
      window.updateConnectionStatus(status, message);
    }

    // Also log to console
    const emoji = status === 'connected' ? '✅' : status === 'error' ? '❌' : '⏳';
    console.log(`${emoji} Connection status: ${message}`);
  }

  /**
   * Handle connection errors
   * @param {Error} error - The error that occurred
   * @param {string} context - Context where error occurred
   */
  handleConnectionError(error, context = 'Connection Monitor') {
    ErrorHandler.handleError(error, context);
    this.updateStatus('error', 'Erro de conexão');
    
    // Consider restarting monitoring after a delay
    setTimeout(() => {
      if (!this.healthCheckInterval) {
        console.log('🔄 Attempting to restart connection monitoring...');
        this.startMonitoring();
      }
    }, 10000); // Wait 10 seconds before restart attempt
  }

  /**
   * Set monitoring interval
   * @param {number} intervalMs - Interval in milliseconds
   */
  setMonitoringInterval(intervalMs) {
    if (intervalMs > 0) {
      this.checkIntervalMs = intervalMs;
      
      // Restart monitoring with new interval if currently running
      if (this.healthCheckInterval) {
        this.stopMonitoring();
        this.startMonitoring();
      }
    }
  }

  /**
   * Get monitoring status
   * @returns {Object} Monitoring status information
   */
  getStatus() {
    return {
      isMonitoring: this.healthCheckInterval !== null,
      checkInterval: this.checkIntervalMs,
      nextCheck: this.healthCheckInterval ? 
        new Date(Date.now() + this.checkIntervalMs).toISOString() : null
    };
  }

  /**
   * Dispose of the connection monitor
   */
  dispose() {
    this.stopMonitoring();
    console.log('🧹 Connection monitor disposed');
  }
}

// Make stop function available globally for cleanup
window.stopConnectionMonitoring = () => {
  if (window.connectionMonitor) {
    window.connectionMonitor.stopMonitoring();
  }
};