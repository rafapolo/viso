// Centralized Error Handler

export class ErrorHandler {
  static errorCounts = new Map();
  static errorCallbacks = [];

  /**
   * Initialize error handler with global error catching
   */
  static initialize() {
    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      this.handleError(event.reason, 'Unhandled Promise', 'global');
      event.preventDefault();
    });

    // Catch JavaScript errors
    window.addEventListener('error', (event) => {
      console.error('JavaScript error:', event.error);
      this.handleError(event.error, 'JavaScript Error', 'global');
    });

    console.log('🛡️ Error handler initialized');
  }

  /**
   * Add error callback for custom handling
   * @param {Function} callback - Error callback function
   */
  static addErrorCallback(callback) {
    if (typeof callback === 'function') {
      this.errorCallbacks.push(callback);
    }
  }

  /**
   * Handle errors with consistent logging and user feedback
   * @param {Error|string} error - Error object or message
   * @param {string} context - Context where error occurred
   * @param {string} severity - Error severity level
   * @param {Object} options - Additional options
   */
  static handleError(error, context = 'Unknown', severity = 'error', options = {}) {
    const errorInfo = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null,
      context,
      severity,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      ...options
    };

    // Track error frequency
    const errorKey = `${context}:${errorInfo.message}`;
    this.errorCounts.set(errorKey, (this.errorCounts.get(errorKey) || 0) + 1);

    // Console logging with appropriate level
    switch (severity) {
      case 'critical':
      case 'error':
        console.error(`❌ [${context}] ${errorInfo.message}`, errorInfo);
        break;
      case 'warning':
        console.warn(`⚠️ [${context}] ${errorInfo.message}`, errorInfo);
        break;
      case 'info':
        console.info(`ℹ️ [${context}] ${errorInfo.message}`, errorInfo);
        break;
      default:
        console.log(`📝 [${context}] ${errorInfo.message}`, errorInfo);
    }

    // Trigger error callbacks
    this.errorCallbacks.forEach(callback => {
      try {
        callback(errorInfo);
      } catch (callbackError) {
        console.error('Error in error callback:', callbackError);
      }
    });

    return errorInfo;
  }

  /**
   * Display user-friendly error message in UI
   * @param {string} message - User-friendly error message
   * @param {string} containerId - ID of container to show error in
   * @param {Object} options - Display options
   */
  static showUserError(message, containerId = null, options = {}) {
    const {
      type = 'error',
      duration = 5000,
      dismissible = true,
      retryAction = null
    } = options;

    const errorHTML = this.createErrorMessageHTML(message, type, dismissible, retryAction);

    if (containerId) {
      const container = document.getElementById(containerId);
      if (container) {
        container.innerHTML = errorHTML;
      }
    } else {
      // Show in default error container or create one
      this.showInDefaultContainer(errorHTML, duration);
    }
  }

  /**
   * Create error message HTML
   * @param {string} message - Error message
   * @param {string} type - Error type (error, warning, info)
   * @param {boolean} dismissible - Whether error can be dismissed
   * @param {Function} retryAction - Optional retry function
   * @returns {string} HTML string
   */
  static createErrorMessageHTML(message, type = 'error', dismissible = true, retryAction = null) {
    const typeConfig = {
      error: {
        icon: '❌',
        bgClass: 'bg-red-900/20',
        borderClass: 'border-red-500',
        textClass: 'text-red-200'
      },
      warning: {
        icon: '⚠️',
        bgClass: 'bg-yellow-900/20',
        borderClass: 'border-yellow-500',
        textClass: 'text-yellow-200'
      },
      info: {
        icon: 'ℹ️',
        bgClass: 'bg-blue-900/20',
        borderClass: 'border-blue-500',
        textClass: 'text-blue-200'
      },
      success: {
        icon: '✅',
        bgClass: 'bg-green-900/20',
        borderClass: 'border-green-500',
        textClass: 'text-green-200'
      }
    };

    const config = typeConfig[type] || typeConfig.error;

    return `
      <div class="${config.bgClass} border ${config.borderClass} ${config.textClass} p-3 m-3 rounded relative">
        <div class="flex items-start gap-2">
          <span class="text-lg">${config.icon}</span>
          <div class="flex-1">
            <div class="font-medium">${this.capitalizeFirstLetter(type)}:</div>
            <div class="text-sm mt-1">${message}</div>
            ${retryAction ? `
              <button 
                onclick="${retryAction}" 
                class="mt-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
              >
                🔄 Try Again
              </button>
            ` : ''}
          </div>
          ${dismissible ? `
            <button 
              onclick="this.parentElement.parentElement.remove()" 
              class="text-gray-400 hover:text-white text-sm font-bold ml-2"
            >
              ×
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Show error in default container (create if needed)
   * @param {string} errorHTML - Error HTML content
   * @param {number} duration - Auto-dismiss duration (0 = no auto-dismiss)
   */
  static showInDefaultContainer(errorHTML, duration = 0) {
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

  /**
   * Async error wrapper for functions
   * @param {Function} asyncFn - Async function to wrap
   * @param {string} context - Error context
   * @param {Object} options - Error handling options
   * @returns {Function} Wrapped function
   */
  static asyncWrapper(asyncFn, context, options = {}) {
    return async (...args) => {
      try {
        return await asyncFn(...args);
      } catch (error) {
        this.handleError(error, context, options.severity || 'error', options);
        
        if (options.showUser) {
          this.showUserError(
            options.userMessage || `An error occurred in ${context}`,
            options.containerId,
            options
          );
        }
        
        if (options.rethrow !== false) {
          throw error;
        }
      }
    };
  }

  /**
   * Create error boundary for UI components
   * @param {Function} componentFn - Component function
   * @param {string} componentName - Component name for error context
   * @param {Object} fallbackOptions - Fallback display options
   * @returns {Function} Wrapped component function
   */
  static createErrorBoundary(componentFn, componentName, fallbackOptions = {}) {
    return (...args) => {
      try {
        return componentFn(...args);
      } catch (error) {
        this.handleError(error, `Component: ${componentName}`, 'error');
        
        const { fallbackHTML = `<div class="text-red-500">Error loading ${componentName}</div>` } = fallbackOptions;
        
        return fallbackHTML;
      }
    };
  }

  /**
   * Log performance issues
   * @param {string} operation - Operation that was slow
   * @param {number} duration - Duration in milliseconds
   * @param {number} threshold - Threshold for what's considered slow
   */
  static logPerformanceIssue(operation, duration, threshold = 1000) {
    if (duration > threshold) {
      this.handleError(
        `Slow operation detected: ${operation} took ${duration}ms (threshold: ${threshold}ms)`,
        'Performance',
        'warning'
      );
    }
  }

  /**
   * Get error statistics
   * @returns {Object} Error statistics
   */
  static getErrorStats() {
    return {
      totalErrors: Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0),
      uniqueErrors: this.errorCounts.size,
      errorBreakdown: Object.fromEntries(this.errorCounts),
      mostCommonError: this.getMostCommonError()
    };
  }

  /**
   * Get most common error
   * @returns {Object|null} Most common error info
   */
  static getMostCommonError() {
    if (this.errorCounts.size === 0) return null;

    let maxCount = 0;
    let mostCommonError = null;

    this.errorCounts.forEach((count, error) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommonError = error;
      }
    });

    return mostCommonError ? { error: mostCommonError, count: maxCount } : null;
  }

  /**
   * Clear error statistics
   */
  static clearErrorStats() {
    this.errorCounts.clear();
    console.log('🧹 Error statistics cleared');
  }

  /**
   * Database connection error handler
   * @param {Error} error - Database error
   * @param {string} operation - Database operation that failed
   */
  static handleDatabaseError(error, operation = 'Database Operation') {
    const isConnectionError = error.message.includes('connection') || 
                            error.message.includes('network') ||
                            error.message.includes('timeout');

    this.handleError(error, `Database: ${operation}`, isConnectionError ? 'critical' : 'error');

    if (isConnectionError) {
      this.showUserError(
        'Database connection lost. Please check your connection and try again.',
        null,
        {
          type: 'error',
          retryAction: 'location.reload()',
          duration: 0 // Don't auto-dismiss connection errors
        }
      );
    }
  }

  /**
   * Validation error handler for forms
   * @param {Object} validationErrors - Validation error object
   * @param {string} formContext - Form context
   */
  static handleValidationErrors(validationErrors, formContext = 'Form') {
    Object.entries(validationErrors).forEach(([field, message]) => {
      this.handleError(
        `Validation failed for field '${field}': ${message}`,
        `${formContext} Validation`,
        'warning'
      );
    });
  }

  /**
   * Utility function to capitalize first letter
   * @param {string} str - String to capitalize
   * @returns {string} Capitalized string
   */
  static capitalizeFirstLetter(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}