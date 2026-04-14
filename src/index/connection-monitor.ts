// Connection Health Monitoring
import { ErrorHandler } from '../shared/error-handler.js';

interface ConnectionTestResults {
  timestamp: string;
  duckdbAPI: boolean;
  queryExecution: boolean;
  dataAccess: boolean;
  responseTime: number | null;
}

interface DiagnosticsResult {
  timestamp: string;
  userAgent?: string;
  url?: string;
  connectionStatus?: string;
  isMonitoring?: boolean;
  checkInterval?: number;
  testResults?: ConnectionTestResults;
  totalRecords?: unknown;
  dbError?: string;
  error?: string;
}

interface MonitorStatus {
  isMonitoring: boolean;
  checkInterval: number;
  nextCheck: string | null;
}

export class ConnectionMonitor {
  private healthCheckInterval: ReturnType<typeof setInterval> | null;
  private checkIntervalMs: number;

  constructor() {
    this.healthCheckInterval = null;
    this.checkIntervalMs = 30000; // 30 seconds
  }

  startMonitoring(): void {
    this.stopMonitoring();

    this.healthCheckInterval = setInterval(async () => {
      if (window.getConnectionStatus() === 'connected') {
        const isHealthy = await this.checkConnectionHealth();
        if (!isHealthy) {
          window.updateConnectionStatus('error', 'Conexão perdida');
        }
      }
    }, this.checkIntervalMs);
  }

  stopMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  async checkConnectionHealth(): Promise<boolean> {
    try {
      const result = await window.duckdbAPI.query('SELECT 1 as health_check');

      if (result && result.numRows > 0) {
        return true;
      }

      return false;
    } catch (error) {
      ErrorHandler.handleError(error as Error, 'Connection Health Check', 'warn', {
        showUser: false,
      });
      return false;
    }
  }

  async performConnectionTest(): Promise<ConnectionTestResults> {
    const testResults: ConnectionTestResults = {
      timestamp: new Date().toISOString(),
      duckdbAPI: false,
      queryExecution: false,
      dataAccess: false,
      responseTime: null,
    };

    try {
      const startTime = performance.now();

      if (window.duckdbAPI) {
        testResults.duckdbAPI = true;
      }

      const testQuery = 'SELECT COUNT(*) as count FROM despesas LIMIT 1';
      const result = await window.duckdbAPI.query(testQuery);

      if (result) {
        testResults.queryExecution = true;

        if (result.numRows >= 0) {
          testResults.dataAccess = true;
        }
      }

      const endTime = performance.now();
      testResults.responseTime = Math.round(endTime - startTime);

      return testResults;
    } catch (error) {
      ErrorHandler.handleError(error as Error, 'Connection Test');
      return testResults;
    }
  }

  async getDiagnostics(): Promise<DiagnosticsResult> {
    try {
      const diagnostics: DiagnosticsResult = {
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        connectionStatus: window.getConnectionStatus ? window.getConnectionStatus() : 'unknown',
        isMonitoring: this.healthCheckInterval !== null,
        checkInterval: this.checkIntervalMs,
      };

      const testResults = await this.performConnectionTest();
      diagnostics.testResults = testResults;

      if (window.duckdbAPI) {
        try {
          const dbInfo = await window.duckdbAPI.query('SELECT COUNT(*) as total_records FROM despesas');
          if (dbInfo && dbInfo.numRows > 0) {
            diagnostics.totalRecords = dbInfo.toArray()[0]['total_records'];
          }
        } catch (error) {
          diagnostics.dbError = (error as Error).message;
        }
      }

      return diagnostics;
    } catch (error) {
      ErrorHandler.handleError(error as Error, 'Connection Diagnostics');
      return {
        timestamp: new Date().toISOString(),
        error: (error as Error).message,
      };
    }
  }

  updateStatus(status: string, message: string): void {
    if (window.updateConnectionStatus) {
      window.updateConnectionStatus(status, message);
    }
  }

  handleConnectionError(error: Error, context = 'Connection Monitor'): void {
    ErrorHandler.handleError(error, context);
    this.updateStatus('error', 'Erro de conexão');

    setTimeout(() => {
      if (!this.healthCheckInterval) {
        this.startMonitoring();
      }
    }, 10000);
  }

  setMonitoringInterval(intervalMs: number): void {
    if (intervalMs > 0) {
      this.checkIntervalMs = intervalMs;

      if (this.healthCheckInterval) {
        this.stopMonitoring();
        this.startMonitoring();
      }
    }
  }

  getStatus(): MonitorStatus {
    return {
      isMonitoring: this.healthCheckInterval !== null,
      checkInterval: this.checkIntervalMs,
      nextCheck: this.healthCheckInterval
        ? new Date(Date.now() + this.checkIntervalMs).toISOString()
        : null,
    };
  }

  dispose(): void {
    this.stopMonitoring();
  }
}

// Make stop function available globally for cleanup
window.stopConnectionMonitoring = () => {
  const monitor = (window as unknown as Record<string, unknown>)['connectionMonitor'];
  if (monitor && typeof (monitor as ConnectionMonitor).stopMonitoring === 'function') {
    (monitor as ConnectionMonitor).stopMonitoring();
  }
};
