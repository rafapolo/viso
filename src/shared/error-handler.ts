export type ErrorSeverity = 'critical' | 'error' | 'warning' | 'info';
export type ErrorType = 'error' | 'warning' | 'info' | 'success';

export interface ErrorInfo {
  message: string;
  stack: string | null | undefined;
  context: string;
  severity: ErrorSeverity;
  timestamp: string;
  url: string;
  userAgent: string;
  [key: string]: unknown;
}

export interface ShowUserErrorOptions {
  type?: ErrorType;
  duration?: number;
  dismissible?: boolean;
  retryAction?: string | null;
}

export interface AsyncWrapperOptions extends ShowUserErrorOptions {
  severity?: ErrorSeverity;
  showUser?: boolean;
  userMessage?: string;
  containerId?: string | null;
  rethrow?: boolean;
}

export interface ErrorBoundaryFallback {
  fallbackHTML?: string;
}

// Centralized Error Handler

export class ErrorHandler {
  static errorCounts: Map<string, number> = new Map();
  static errorCallbacks: ((info: ErrorInfo) => void)[] = [];

  static initialize(): void {
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      this.handleError(event.reason, 'Unhandled Promise', 'global' as ErrorSeverity);
      event.preventDefault();
    });

    window.addEventListener('error', (event) => {
      console.error('JavaScript error:', event.error);
      this.handleError(event.error, 'JavaScript Error', 'global' as ErrorSeverity);
    });
  }

  static addErrorCallback(callback: (info: ErrorInfo) => void): void {
    if (typeof callback === 'function') {
      this.errorCallbacks.push(callback);
    }
  }

  static handleError(
    error: Error | string | unknown,
    context = 'Unknown',
    severity: ErrorSeverity | string = 'error',
    options: Record<string, unknown> = {}
  ): ErrorInfo {
    const errorInfo: ErrorInfo = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null,
      context,
      severity: severity as ErrorSeverity,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      ...options,
    };

    const errorKey = `${context}:${errorInfo.message}`;
    this.errorCounts.set(errorKey, (this.errorCounts.get(errorKey) ?? 0) + 1);

    switch (severity) {
      case 'critical':
      case 'error':
        console.error(`❌ [${context}] ${errorInfo.message}`, errorInfo);
        break;
      case 'warning':
        console.warn(`⚠️ [${context}] ${errorInfo.message}`, errorInfo);
        break;
    }

    this.errorCallbacks.forEach((callback) => {
      try {
        callback(errorInfo);
      } catch {
        // Silently ignore callback errors to prevent error loops
      }
    });

    return errorInfo;
  }

  static showUserError(
    message: string,
    containerId: string | null = null,
    options: ShowUserErrorOptions = {}
  ): void {
    const { type = 'error', duration = 5000, dismissible = true, retryAction = null } = options;

    const errorHTML = this.createErrorMessageHTML(message, type, dismissible, retryAction);

    if (containerId) {
      const container = document.getElementById(containerId);
      if (container) {
        container.innerHTML = errorHTML;
      }
    } else {
      this.showInDefaultContainer(errorHTML, duration);
    }
  }

  static createErrorMessageHTML(
    message: string,
    type: ErrorType = 'error',
    dismissible = true,
    retryAction: string | null = null
  ): string {
    const typeConfig: Record<ErrorType, { icon: string; bgClass: string; borderClass: string; textClass: string }> = {
      error: {
        icon: '❌',
        bgClass: 'bg-red-900/20',
        borderClass: 'border-red-500',
        textClass: 'text-red-200',
      },
      warning: {
        icon: '⚠️',
        bgClass: 'bg-yellow-900/20',
        borderClass: 'border-yellow-500',
        textClass: 'text-yellow-200',
      },
      info: {
        icon: 'ℹ️',
        bgClass: 'bg-blue-900/20',
        borderClass: 'border-blue-500',
        textClass: 'text-blue-200',
      },
      success: {
        icon: '✅',
        bgClass: 'bg-green-900/20',
        borderClass: 'border-green-500',
        textClass: 'text-green-200',
      },
    };

    const config = typeConfig[type] ?? typeConfig.error;

    return `
      <div class="${config.bgClass} border ${config.borderClass} ${config.textClass} p-3 m-3 rounded relative">
        <div class="flex items-start gap-2">
          <span class="text-lg">${config.icon}</span>
          <div class="flex-1">
            <div class="font-medium">${this.capitalizeFirstLetter(type)}:</div>
            <div class="text-sm mt-1">${message}</div>
            ${
              retryAction
                ? `
              <button
                onclick="${retryAction}"
                class="mt-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
              >
                🔄 Try Again
              </button>
            `
                : ''
            }
          </div>
          ${
            dismissible
              ? `
            <button
              onclick="this.parentElement.parentElement.remove()"
              class="text-gray-400 hover:text-white text-sm font-bold ml-2"
            >
              ×
            </button>
          `
              : ''
          }
        </div>
      </div>
    `;
  }

  static showInDefaultContainer(errorHTML: string, duration = 0): void {
    let container = document.getElementById('error-container');

    if (!container) {
      container = document.createElement('div');
      container.id = 'error-container';
      container.className = 'fixed top-4 right-4 max-w-md z-50 space-y-2';
      document.body.appendChild(container);
    }

    const errorElement = document.createElement('div');
    errorElement.innerHTML = errorHTML;
    errorElement.className = 'error-message';

    container.appendChild(errorElement);

    if (duration > 0) {
      setTimeout(() => {
        if (errorElement && errorElement.parentNode) {
          errorElement.remove();
        }
      }, duration);
    }
  }

  static asyncWrapper<T, A extends unknown[]>(
    asyncFn: (...args: A) => Promise<T>,
    context: string,
    options: AsyncWrapperOptions = {}
  ): (...args: A) => Promise<T | undefined> {
    return async (...args: A) => {
      try {
        return await asyncFn(...args);
      } catch (error) {
        this.handleError(error, context, options.severity ?? 'error', options as Record<string, unknown>);

        if (options.showUser) {
          this.showUserError(
            options.userMessage ?? `An error occurred in ${context}`,
            options.containerId ?? null,
            options
          );
        }

        if (options.rethrow !== false) {
          throw error;
        }

        return undefined;
      }
    };
  }

  static createErrorBoundary<T extends unknown[]>(
    componentFn: (...args: T) => string,
    componentName: string,
    fallbackOptions: ErrorBoundaryFallback = {}
  ): (...args: T) => string {
    return (...args: T) => {
      try {
        return componentFn(...args);
      } catch (error) {
        this.handleError(error, `Component: ${componentName}`, 'error');

        const { fallbackHTML = `<div class="text-red-500">Error loading ${componentName}</div>` } =
          fallbackOptions;

        return fallbackHTML;
      }
    };
  }

  static logPerformanceIssue(operation: string, duration: number, threshold = 1000): void {
    if (duration > threshold) {
      this.handleError(
        `Slow operation detected: ${operation} took ${duration}ms (threshold: ${threshold}ms)`,
        'Performance',
        'warning'
      );
    }
  }

  static getErrorStats(): {
    totalErrors: number;
    uniqueErrors: number;
    errorBreakdown: Record<string, number>;
    mostCommonError: { error: string; count: number } | null;
  } {
    return {
      totalErrors: Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0),
      uniqueErrors: this.errorCounts.size,
      errorBreakdown: Object.fromEntries(this.errorCounts),
      mostCommonError: this.getMostCommonError(),
    };
  }

  static getMostCommonError(): { error: string; count: number } | null {
    if (this.errorCounts.size === 0) return null;

    let maxCount = 0;
    let mostCommonError: string | null = null;

    this.errorCounts.forEach((count, error) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommonError = error;
      }
    });

    return mostCommonError ? { error: mostCommonError, count: maxCount } : null;
  }

  static clearErrorStats(): void {
    this.errorCounts.clear();
  }

  static handleDatabaseError(error: Error, operation = 'Database Operation'): void {
    const isConnectionError =
      error.message.includes('connection') ||
      error.message.includes('network') ||
      error.message.includes('timeout');

    this.handleError(error, `Database: ${operation}`, isConnectionError ? 'critical' : 'error');

    if (isConnectionError) {
      this.showUserError('Database connection lost. Please check your connection and try again.', null, {
        type: 'error',
        retryAction: 'location.reload()',
        duration: 0,
      });
    }
  }

  static handleValidationErrors(
    validationErrors: Record<string, string>,
    formContext = 'Form'
  ): void {
    Object.entries(validationErrors).forEach(([field, message]) => {
      this.handleError(
        `Validation failed for field '${field}': ${message}`,
        `${formContext} Validation`,
        'warning'
      );
    });
  }

  static capitalizeFirstLetter(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
