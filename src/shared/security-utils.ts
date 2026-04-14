// Security Utilities for Input Sanitization and Validation
import { ErrorHandler } from './error-handler.js';
import appConfig from './app-config.js';

export interface FileValidationResult {
  valid: boolean;
  errors: string[];
}

export interface URLValidationResult {
  valid: boolean;
  errors: string[];
}

export interface SQLValidationResult {
  valid: boolean;
  errors: string[];
  sanitizedQuery: string;
}

export interface InputValidationResult {
  valid: boolean;
  errors: string[];
  suspiciousPatterns: string[];
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}

export interface FileValidationOptions {
  allowedTypes?: string[];
  maxSize?: number;
  requireValidMimeType?: boolean;
}

export interface URLValidationOptions {
  allowedProtocols?: string[];
  allowedDomains?: string[] | null;
  blockedDomains?: string[];
  allowPrivateIPs?: boolean;
}

export interface SQLValidationOptions {
  maxLength?: number;
  blockedOperations?: string[];
}

export interface CSPOptions {
  allowInlineStyles?: boolean;
  allowInlineScripts?: boolean;
  allowEval?: boolean;
  trustedDomains?: string[];
  cdnDomains?: string[];
}

export class SecurityUtils {
  private static rateLimitStore: Map<string, number[]> | null = null;

  static sanitizeHTML(html: string): string {
    if (!html || typeof html !== 'string') return '';
    const temp = document.createElement('div');
    temp.textContent = html;
    return temp.innerHTML;
  }

  static sanitizeSQL(input: string): string {
    if (!input || typeof input !== 'string') return '';
    return input
      .replace(/'/g, "''")
      .replace(/;/g, '')
      .replace(/--/g, '')
      .replace(/\/\*/g, '')
      .replace(/\*\//g, '')
      .replace(/\b(DROP|DELETE|INSERT|UPDATE|CREATE|ALTER|EXEC|EXECUTE|SCRIPT)\b/gi, '')
      .trim();
  }

  static validateFile(file: File | null | undefined, options: FileValidationOptions = {}): FileValidationResult {
    const allowedTypes = (options.allowedTypes ?? (appConfig.security as { allowedFileTypes: string[] }).allowedFileTypes) as string[];
    const maxSize = (options.maxSize ?? (appConfig.security as { maxFileSize: number }).maxFileSize) as number;
    const requireValidMimeType = options.requireValidMimeType ?? true;

    const result: FileValidationResult = { valid: true, errors: [] };

    if (!file) {
      result.valid = false;
      result.errors.push('No file provided');
      return result;
    }

    if (file.size > maxSize) {
      result.valid = false;
      result.errors.push(
        `File size (${this.formatFileSize(file.size)}) exceeds maximum allowed size (${this.formatFileSize(maxSize)})`
      );
    }

    const extension = `.${file.name.split('.').pop()!.toLowerCase()}`;
    if (!allowedTypes.includes(extension)) {
      result.valid = false;
      result.errors.push(
        `File type ${extension} is not allowed. Allowed types: ${allowedTypes.join(', ')}`
      );
    }

    if (requireValidMimeType) {
      const validMimeTypes: Record<string, string[]> = {
        '.parquet': ['application/octet-stream'],
        '.csv': ['text/csv', 'application/csv'],
        '.json': ['application/json'],
      };
      const expectedMimeTypes = validMimeTypes[extension];
      if (expectedMimeTypes && !expectedMimeTypes.includes(file.type)) {
        result.valid = false;
        result.errors.push(`Invalid MIME type ${file.type} for ${extension} file`);
      }
    }

    return result;
  }

  static validateURL(url: string, options: URLValidationOptions = {}): URLValidationResult {
    const {
      allowedProtocols = ['https:', 'http:'],
      allowedDomains = null,
      blockedDomains = ['localhost', '127.0.0.1', '0.0.0.0'],
      allowPrivateIPs = false,
    } = options;

    const result: URLValidationResult = { valid: true, errors: [] };

    try {
      const urlObj = new URL(url);

      if (!allowedProtocols.includes(urlObj.protocol)) {
        result.valid = false;
        result.errors.push(`Protocol ${urlObj.protocol} is not allowed`);
      }

      if (allowedDomains && !allowedDomains.includes(urlObj.hostname)) {
        result.valid = false;
        result.errors.push(`Domain ${urlObj.hostname} is not in allowed list`);
      }

      if (blockedDomains.includes(urlObj.hostname)) {
        result.valid = false;
        result.errors.push(`Domain ${urlObj.hostname} is blocked`);
      }

      if (!allowPrivateIPs && this.isPrivateIP(urlObj.hostname)) {
        result.valid = false;
        result.errors.push('Private IP addresses are not allowed');
      }
    } catch {
      result.valid = false;
      result.errors.push('Invalid URL format');
    }

    return result;
  }

  static isPrivateIP(hostname: string): boolean {
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^127\./,
      /^169\.254\./,
      /^::1$/,
      /^fc00:/,
      /^fe80:/,
    ];
    return privateRanges.some((range) => range.test(hostname));
  }

  static validateSQLQuery(query: string, options: SQLValidationOptions = {}): SQLValidationResult {
    const maxLength = (options.maxLength ?? (appConfig.security as { maxQueryLength: number }).maxQueryLength) as number;
    const blockedOperations = options.blockedOperations ?? [
      'DROP', 'DELETE', 'INSERT', 'UPDATE', 'CREATE', 'ALTER', 'EXEC', 'EXECUTE',
    ];

    const result: SQLValidationResult = { valid: true, errors: [], sanitizedQuery: '' };

    if (!query || typeof query !== 'string') {
      result.valid = false;
      result.errors.push('Query must be a non-empty string');
      return result;
    }

    if (query.length > maxLength) {
      result.valid = false;
      result.errors.push(
        `Query length (${query.length}) exceeds maximum allowed length (${maxLength})`
      );
      return result;
    }

    const upperQuery = query.toUpperCase();
    for (const operation of blockedOperations) {
      if (upperQuery.includes(operation)) {
        result.valid = false;
        result.errors.push(`Operation ${operation} is not allowed`);
      }
    }

    if (result.valid) {
      result.sanitizedQuery = this.sanitizeSQL(query);
    }

    return result;
  }

  static generateCSP(options: CSPOptions = {}): string {
    const {
      allowInlineStyles = false,
      allowInlineScripts = false,
      allowEval = false,
      trustedDomains = [],
      cdnDomains = ['cdnjs.cloudflare.com', 'unpkg.com'],
    } = options;

    const csp: Record<string, string[]> = {
      'default-src': ["'self'"],
      'script-src': ["'self'", ...cdnDomains],
      'style-src': ["'self'", ...cdnDomains],
      'img-src': ["'self'", 'data:', 'https:'],
      'font-src': ["'self'", ...cdnDomains],
      'connect-src': ["'self'", ...trustedDomains],
      'frame-src': ["'none'"],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
    };

    if (allowInlineStyles) csp['style-src'].push("'unsafe-inline'");
    if (allowInlineScripts) csp['script-src'].push("'unsafe-inline'");
    if (allowEval) csp['script-src'].push("'unsafe-eval'");

    return Object.entries(csp)
      .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
      .join('; ');
  }

  static async hashPassword(password: string, salt: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  static generateSecureRandomString(length = 32): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const randomValues = new Uint8Array(length);
    crypto.getRandomValues(randomValues);
    return Array.from(randomValues)
      .map((value) => charset[value % charset.length])
      .join('');
  }

  static validateInput(input: string): InputValidationResult {
    const result: InputValidationResult = { valid: true, errors: [], suspiciousPatterns: [] };

    if (!input || typeof input !== 'string') return result;

    const patterns = [
      { name: 'Script tag', regex: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi },
      { name: 'JavaScript protocol', regex: /javascript:/gi },
      { name: 'Data URL with JavaScript', regex: /data:.*javascript/gi },
      { name: 'SQL injection', regex: /(\bUNION\b|\bSELECT\b|\bINSERT\b|\bDELETE\b|\bUPDATE\b|\bDROP\b)/gi },
      { name: 'XSS attempt', regex: /(onload|onerror|onclick|onmouseover)=/gi },
      { name: 'Path traversal', regex: /(\.\.\/|\.\.\\)/g },
      { name: 'Null bytes', regex: /\\u0000/g },
    ];

    patterns.forEach((pattern) => {
      if (pattern.regex.test(input)) {
        result.valid = false;
        result.suspiciousPatterns.push(pattern.name);
        result.errors.push(`Suspicious pattern detected: ${pattern.name}`);
      }
    });

    return result;
  }

  static rateLimit(key: string, maxRequests = 100, windowMs = 60000): RateLimitResult {
    const now = Date.now();
    const windowStart = now - windowMs;

    if (!this.rateLimitStore) this.rateLimitStore = new Map();

    let requests = this.rateLimitStore.get(key) ?? [];
    requests = requests.filter((timestamp) => timestamp > windowStart);

    if (requests.length >= maxRequests) {
      return { allowed: false, remaining: 0, resetTime: requests[0] + windowMs };
    }

    requests.push(now);
    this.rateLimitStore.set(key, requests);

    return {
      allowed: true,
      remaining: maxRequests - requests.length,
      resetTime: now + windowMs,
    };
  }

  static formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  static secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }

  static escapeHTML(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  static logSecurityEvent(event: string, details: Record<string, unknown> = {}): void {
    const securityEvent = {
      type: event,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      ...details,
    };

    if ((appConfig.development as { enableLogging: boolean }).enableLogging) {
      console.warn('🔒 Security Event:', securityEvent);
    }

    ErrorHandler.handleError(
      new Error(`Security event: ${event}`),
      'Security Monitor',
      'warning',
      { securityEvent }
    );
  }
}

// Global security monitoring
if ((appConfig.security as { sanitizeInput: boolean }).sanitizeInput) {
  document.addEventListener('submit', (event) => {
    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);

    for (const [key, value] of formData.entries()) {
      if (typeof value === 'string') {
        const validation = SecurityUtils.validateInput(value);
        if (!validation.valid) {
          SecurityUtils.logSecurityEvent('Suspicious form input', {
            field: key,
            errors: validation.errors,
            patterns: validation.suspiciousPatterns,
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
