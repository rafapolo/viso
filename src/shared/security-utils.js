// Security Utilities for Input Sanitization and Validation
import { ErrorHandler } from './error-handler.js';
import appConfig from './app-config.js';

export class SecurityUtils {
  /**
   * Sanitize HTML to prevent XSS attacks
   * @param {string} html - HTML string to sanitize
   * @returns {string} Sanitized HTML
   */
  static sanitizeHTML(html) {
    if (!html || typeof html !== 'string') return '';

    // Create a temporary div element
    const temp = document.createElement('div');
    temp.textContent = html;
    
    // Get the sanitized text content
    return temp.innerHTML;
  }

  /**
   * Sanitize SQL input to prevent SQL injection
   * @param {string} input - Input string to sanitize
   * @returns {string} Sanitized input
   */
  static sanitizeSQL(input) {
    if (!input || typeof input !== 'string') return '';

    // Remove or escape dangerous SQL characters and keywords
    return input
      .replace(/'/g, "''") // Escape single quotes
      .replace(/;/g, '') // Remove semicolons
      .replace(/--/g, '') // Remove SQL comments
      .replace(/\/\*/g, '') // Remove /* comments
      .replace(/\*\//g, '') // Remove */ comments
      .replace(/\b(DROP|DELETE|INSERT|UPDATE|CREATE|ALTER|EXEC|EXECUTE|SCRIPT)\b/gi, '') // Remove dangerous keywords
      .trim();
  }

  /**
   * Validate file upload
   * @param {File} file - File to validate
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  static validateFile(file, options = {}) {
    const {
      allowedTypes = appConfig.security.allowedFileTypes,
      maxSize = appConfig.security.maxFileSize,
      requireValidMimeType = true
    } = options;

    const result = {
      valid: true,
      errors: []
    };

    // Check if file exists
    if (!file) {
      result.valid = false;
      result.errors.push('No file provided');
      return result;
    }

    // Check file size
    if (file.size > maxSize) {
      result.valid = false;
      result.errors.push(`File size (${this.formatFileSize(file.size)}) exceeds maximum allowed size (${this.formatFileSize(maxSize)})`);
    }

    // Check file extension
    const extension = `.${file.name.split('.').pop().toLowerCase()}`;
    if (!allowedTypes.includes(extension)) {
      result.valid = false;
      result.errors.push(`File type ${extension} is not allowed. Allowed types: ${allowedTypes.join(', ')}`);
    }

    // Validate MIME type if required
    if (requireValidMimeType) {
      const validMimeTypes = {
        '.parquet': ['application/octet-stream'],
        '.csv': ['text/csv', 'application/csv'],
        '.json': ['application/json']
      };

      const expectedMimeTypes = validMimeTypes[extension];
      if (expectedMimeTypes && !expectedMimeTypes.includes(file.type)) {
        result.valid = false;
        result.errors.push(`Invalid MIME type ${file.type} for ${extension} file`);
      }
    }

    return result;
  }

  /**
   * Validate URL to prevent SSRF attacks
   * @param {string} url - URL to validate
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  static validateURL(url, options = {}) {
    const {
      allowedProtocols = ['https:', 'http:'],
      allowedDomains = null,
      blockedDomains = ['localhost', '127.0.0.1', '0.0.0.0'],
      allowPrivateIPs = false
    } = options;

    const result = {
      valid: true,
      errors: []
    };

    try {
      const urlObj = new URL(url);

      // Check protocol
      if (!allowedProtocols.includes(urlObj.protocol)) {
        result.valid = false;
        result.errors.push(`Protocol ${urlObj.protocol} is not allowed`);
      }

      // Check domain whitelist
      if (allowedDomains && !allowedDomains.includes(urlObj.hostname)) {
        result.valid = false;
        result.errors.push(`Domain ${urlObj.hostname} is not in allowed list`);
      }

      // Check domain blacklist
      if (blockedDomains.includes(urlObj.hostname)) {
        result.valid = false;
        result.errors.push(`Domain ${urlObj.hostname} is blocked`);
      }

      // Check for private IP ranges
      if (!allowPrivateIPs && this.isPrivateIP(urlObj.hostname)) {
        result.valid = false;
        result.errors.push(`Private IP addresses are not allowed`);
      }

    } catch (error) {
      result.valid = false;
      result.errors.push('Invalid URL format');
    }

    return result;
  }

  /**
   * Check if hostname is a private IP address
   * @param {string} hostname - Hostname to check
   * @returns {boolean} True if private IP
   */
  static isPrivateIP(hostname) {
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^127\./,
      /^169\.254\./,
      /^::1$/,
      /^fc00:/,
      /^fe80:/
    ];

    return privateRanges.some(range => range.test(hostname));
  }

  /**
   * Validate and sanitize SQL query
   * @param {string} query - SQL query to validate
   * @param {Object} options - Validation options
   * @returns {Object} Validation result with sanitized query
   */
  static validateSQLQuery(query, options = {}) {
    const {
      maxLength = appConfig.security.maxQueryLength,
      allowedOperations = ['SELECT', 'WITH', 'ORDER BY', 'GROUP BY', 'HAVING', 'LIMIT', 'WHERE'],
      blockedOperations = ['DROP', 'DELETE', 'INSERT', 'UPDATE', 'CREATE', 'ALTER', 'EXEC', 'EXECUTE']
    } = options;

    const result = {
      valid: true,
      errors: [],
      sanitizedQuery: ''
    };

    if (!query || typeof query !== 'string') {
      result.valid = false;
      result.errors.push('Query must be a non-empty string');
      return result;
    }

    // Check query length
    if (query.length > maxLength) {
      result.valid = false;
      result.errors.push(`Query length (${query.length}) exceeds maximum allowed length (${maxLength})`);
      return result;
    }

    const upperQuery = query.toUpperCase();

    // Check for blocked operations
    for (const operation of blockedOperations) {
      if (upperQuery.includes(operation)) {
        result.valid = false;
        result.errors.push(`Operation ${operation} is not allowed`);
      }
    }

    // Sanitize the query
    if (result.valid) {
      result.sanitizedQuery = this.sanitizeSQL(query);
    }

    return result;
  }

  /**
   * Generate Content Security Policy header
   * @param {Object} options - CSP options
   * @returns {string} CSP header value
   */
  static generateCSP(options = {}) {
    const {
      allowInlineStyles = false,
      allowInlineScripts = false,
      allowEval = false,
      trustedDomains = [],
      cdnDomains = ['cdnjs.cloudflare.com', 'unpkg.com']
    } = options;

    const csp = {
      'default-src': ["'self'"],
      'script-src': ["'self'", ...cdnDomains],
      'style-src': ["'self'", ...cdnDomains],
      'img-src': ["'self'", 'data:', 'https:'],
      'font-src': ["'self'", ...cdnDomains],
      'connect-src': ["'self'", ...trustedDomains],
      'frame-src': ["'none'"],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"]
    };

    if (allowInlineStyles) {
      csp['style-src'].push("'unsafe-inline'");
    }

    if (allowInlineScripts) {
      csp['script-src'].push("'unsafe-inline'");
    }

    if (allowEval) {
      csp['script-src'].push("'unsafe-eval'");
    }

    return Object.entries(csp)
      .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
      .join('; ');
  }

  /**
   * Hash password (client-side hashing for additional security)
   * @param {string} password - Password to hash
   * @param {string} salt - Salt for hashing
   * @returns {Promise<string>} Hashed password
   */
  static async hashPassword(password, salt) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Generate cryptographically secure random string
   * @param {number} length - Length of random string
   * @returns {string} Random string
   */
  static generateSecureRandomString(length = 32) {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const randomValues = new Uint8Array(length);
    crypto.getRandomValues(randomValues);
    
    return Array.from(randomValues)
      .map(value => charset[value % charset.length])
      .join('');
  }

  /**
   * Validate input against common injection patterns
   * @param {string} input - Input to validate
   * @returns {Object} Validation result
   */
  static validateInput(input) {
    const result = {
      valid: true,
      errors: [],
      suspiciousPatterns: []
    };

    if (!input || typeof input !== 'string') {
      return result;
    }

    // Common injection patterns
    const patterns = [
      { name: 'Script tag', regex: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi },
      { name: 'JavaScript protocol', regex: /javascript:/gi },
      { name: 'Data URL with JavaScript', regex: /data:.*javascript/gi },
      { name: 'SQL injection', regex: /(\bUNION\b|\bSELECT\b|\bINSERT\b|\bDELETE\b|\bUPDATE\b|\bDROP\b)/gi },
      { name: 'XSS attempt', regex: /(onload|onerror|onclick|onmouseover)=/gi },
      { name: 'Path traversal', regex: /(\.\.\/|\.\.\\)/g },
      { name: 'Null bytes', regex: /\\u0000/g }
    ];

    patterns.forEach(pattern => {
      if (pattern.regex.test(input)) {
        result.valid = false;
        result.suspiciousPatterns.push(pattern.name);
        result.errors.push(`Suspicious pattern detected: ${pattern.name}`);
      }
    });

    return result;
  }

  /**
   * Rate limiting implementation
   * @param {string} key - Unique key for rate limiting
   * @param {number} maxRequests - Maximum requests allowed
   * @param {number} windowMs - Time window in milliseconds
   * @returns {Object} Rate limit result
   */
  static rateLimit(key, maxRequests = 100, windowMs = 60000) {
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get or create request log for this key
    if (!this.rateLimitStore) {
      this.rateLimitStore = new Map();
    }

    let requests = this.rateLimitStore.get(key) || [];
    
    // Remove old requests outside the window
    requests = requests.filter(timestamp => timestamp > windowStart);

    // Check if limit exceeded
    if (requests.length >= maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: requests[0] + windowMs
      };
    }

    // Add current request
    requests.push(now);
    this.rateLimitStore.set(key, requests);

    return {
      allowed: true,
      remaining: maxRequests - requests.length,
      resetTime: now + windowMs
    };
  }

  /**
   * Format file size for display
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted file size
   */
  static formatFileSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Secure comparison to prevent timing attacks
   * @param {string} a - First string
   * @param {string} b - Second string
   * @returns {boolean} True if strings match
   */
  static secureCompare(a, b) {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  /**
   * Escape HTML entities
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  static escapeHTML(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Log security event
   * @param {string} event - Security event type
   * @param {Object} details - Event details
   */
  static logSecurityEvent(event, details = {}) {
    const securityEvent = {
      type: event,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      ...details
    };

    // Log to console in development
    if (appConfig.development.enableLogging) {
      console.warn('🔒 Security Event:', securityEvent);
    }

    // Send to error handler for potential reporting
    ErrorHandler.handleError(
      new Error(`Security event: ${event}`),
      'Security Monitor',
      'warning',
      { securityEvent }
    );
  }
}

// Global security monitoring
if (appConfig.security.sanitizeInput) {
  // Monitor form submissions
  document.addEventListener('submit', (event) => {
    const form = event.target;
    const formData = new FormData(form);
    
    for (const [key, value] of formData.entries()) {
      if (typeof value === 'string') {
        const validation = SecurityUtils.validateInput(value);
        if (!validation.valid) {
          SecurityUtils.logSecurityEvent('Suspicious form input', {
            field: key,
            errors: validation.errors,
            patterns: validation.suspiciousPatterns
          });
          
          event.preventDefault();
          ErrorHandler.showUserError(
            'Invalid input detected. Please check your data and try again.',
            null,
            { type: 'warning' }
          );
          break;
        }
      }
    }
  });
}