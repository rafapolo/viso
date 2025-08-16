// Performance Optimization Utilities
import { ErrorHandler } from './error-handler.js';
import appConfig from './app-config.js';

export class PerformanceUtils {
  static cache = new Map();
  static debounceTimers = new Map();
  static observedElements = new WeakMap();

  /**
   * Debounce function execution
   * @param {Function} func - Function to debounce
   * @param {number} delay - Delay in milliseconds
   * @param {string} key - Unique key for the debounce timer
   * @returns {Function} Debounced function
   */
  static debounce(func, delay, key = 'default') {
    return (...args) => {
      const timer = this.debounceTimers.get(key);
      if (timer) {
        clearTimeout(timer);
      }

      this.debounceTimers.set(key, setTimeout(() => {
        func.apply(this, args);
        this.debounceTimers.delete(key);
      }, delay));
    };
  }

  /**
   * Throttle function execution
   * @param {Function} func - Function to throttle
   * @param {number} delay - Delay in milliseconds
   * @returns {Function} Throttled function
   */
  static throttle(func, delay) {
    let lastExecution = 0;
    return (...args) => {
      const now = Date.now();
      if (now - lastExecution >= delay) {
        lastExecution = now;
        return func.apply(this, args);
      }
    };
  }

  /**
   * Memoize function results with TTL
   * @param {Function} func - Function to memoize
   * @param {number} ttl - Time to live in milliseconds
   * @param {Function} keyGenerator - Function to generate cache key
   * @returns {Function} Memoized function
   */
  static memoize(func, ttl = appConfig.performance.caching.maxAge, keyGenerator = JSON.stringify) {
    return (...args) => {
      const key = keyGenerator(args);
      const now = Date.now();
      
      if (this.cache.has(key)) {
        const { value, timestamp } = this.cache.get(key);
        if (now - timestamp < ttl) {
          return value;
        }
        this.cache.delete(key);
      }

      const result = func.apply(this, args);
      this.cache.set(key, { value: result, timestamp: now });

      // Clean up old cache entries periodically
      if (this.cache.size > 100) {
        this.cleanCache();
      }

      return result;
    };
  }

  /**
   * Clean expired cache entries
   */
  static cleanCache() {
    const now = Date.now();
    const {maxAge} = appConfig.performance.caching;

    for (const [key, { timestamp }] of this.cache.entries()) {
      if (now - timestamp > maxAge) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Measure function execution time
   * @param {Function} func - Function to measure
   * @param {string} label - Label for the measurement
   * @returns {Function} Wrapped function with timing
   */
  static measurePerformance(func, label) {
    return async (...args) => {
      const startTime = performance.now();
      
      try {
        const result = await func.apply(this, args);
        const endTime = performance.now();
        const duration = endTime - startTime;

        if (appConfig.development.enablePerformanceMonitoring) {
          console.log(`⏱️ ${label}: ${duration.toFixed(2)}ms`);
        }

        // Log slow operations
        ErrorHandler.logPerformanceIssue(label, duration, 1000);

        return result;
      } catch (error) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        ErrorHandler.handleError(
          new Error(`Performance measurement failed for ${label}: ${error.message}`),
          'Performance Monitoring'
        );
        
        throw error;
      }
    };
  }

  /**
   * Lazy load elements using Intersection Observer
   * @param {Element} element - Element to observe
   * @param {Function} loadCallback - Callback when element enters viewport
   * @param {Object} options - Intersection observer options
   */
  static lazyLoad(element, loadCallback, options = {}) {
    const defaultOptions = {
      threshold: 0.1,
      rootMargin: '50px',
      ...options
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          try {
            loadCallback(entry.target);
            observer.unobserve(entry.target);
          } catch (error) {
            ErrorHandler.handleError(error, 'Lazy Loading');
          }
        }
      });
    }, defaultOptions);

    observer.observe(element);
    this.observedElements.set(element, observer);
  }

  /**
   * Virtual scrolling for large lists
   * @param {Element} container - Container element
   * @param {Array} items - Items to render
   * @param {Function} renderItem - Function to render individual items
   * @param {number} itemHeight - Height of each item
   * @param {number} bufferSize - Number of items to render outside viewport
   */
  static virtualScroll(container, items, renderItem, itemHeight, bufferSize = 5) {
    const containerHeight = container.clientHeight;
    const visibleCount = Math.ceil(containerHeight / itemHeight) + bufferSize * 2;
    
    let startIndex = 0;
    
    const render = () => {
      const fragment = document.createDocumentFragment();
      const endIndex = Math.min(startIndex + visibleCount, items.length);

      // Clear existing content
      container.innerHTML = '';

      // Add spacer for items before visible range
      if (startIndex > 0) {
        const topSpacer = document.createElement('div');
        topSpacer.style.height = `${startIndex * itemHeight}px`;
        fragment.appendChild(topSpacer);
      }

      // Render visible items
      for (let i = startIndex; i < endIndex; i++) {
        const itemElement = renderItem(items[i], i);
        if (itemElement) {
          fragment.appendChild(itemElement);
        }
      }

      // Add spacer for items after visible range
      if (endIndex < items.length) {
        const bottomSpacer = document.createElement('div');
        bottomSpacer.style.height = `${(items.length - endIndex) * itemHeight}px`;
        fragment.appendChild(bottomSpacer);
      }

      container.appendChild(fragment);
    };

    const onScroll = this.throttle(() => {
      const {scrollTop} = container;
      const newStartIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - bufferSize);
      
      if (newStartIndex !== startIndex) {
        startIndex = newStartIndex;
        render();
      }
    }, 16); // ~60fps

    container.addEventListener('scroll', onScroll);
    render();

    return () => {
      container.removeEventListener('scroll', onScroll);
    };
  }

  /**
   * Optimize DOM operations using DocumentFragment
   * @param {Function} callback - Function that performs DOM operations
   * @param {Element} container - Container to append fragment to
   */
  static batchDOMOperations(callback, container) {
    const fragment = document.createDocumentFragment();
    callback(fragment);
    container.appendChild(fragment);
  }

  /**
   * Request Animation Frame wrapper with fallback
   * @param {Function} callback - Function to execute
   * @returns {number} Animation frame ID
   */
  static requestAnimationFrame(callback) {
    if (typeof requestAnimationFrame !== 'undefined') {
      return requestAnimationFrame(callback);
    }
    return setTimeout(callback, 16); // ~60fps fallback
  }

  /**
   * Cancel Animation Frame wrapper
   * @param {number} id - Animation frame ID
   */
  static cancelAnimationFrame(id) {
    if (typeof cancelAnimationFrame !== 'undefined') {
      return cancelAnimationFrame(id);
    }
    return clearTimeout(id);
  }

  /**
   * Image lazy loading with placeholder
   * @param {HTMLImageElement} img - Image element
   * @param {string} src - Image source URL
   * @param {string} placeholder - Placeholder image URL
   */
  static lazyLoadImage(img, src, placeholder = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"%3E%3C/svg%3E') {
    img.src = placeholder;
    
    this.lazyLoad(img, () => {
      const tempImg = new Image();
      tempImg.onload = () => {
        img.src = src;
        img.classList.add('loaded');
      };
      tempImg.onerror = () => {
        img.classList.add('error');
        ErrorHandler.handleError(new Error(`Failed to load image: ${src}`), 'Image Loading');
      };
      tempImg.src = src;
    });
  }

  /**
   * Memory usage monitoring
   * @returns {Object} Memory usage information
   */
  static getMemoryUsage() {
    if (performance.memory) {
      return {
        used: Math.round(performance.memory.usedJSHeapSize / 1048576), // MB
        total: Math.round(performance.memory.totalJSHeapSize / 1048576), // MB
        limit: Math.round(performance.memory.jsHeapSizeLimit / 1048576) // MB
      };
    }
    return null;
  }

  /**
   * Web Worker wrapper for heavy computations
   * @param {Function} workerFunction - Function to run in worker
   * @param {any} data - Data to send to worker
   * @returns {Promise} Promise that resolves with worker result
   */
  static runInWorker(workerFunction, data) {
    return new Promise((resolve, reject) => {
      const workerCode = `
        self.onmessage = function(e) {
          try {
            const result = (${workerFunction.toString()})(e.data);
            self.postMessage({ success: true, result });
          } catch (error) {
            self.postMessage({ success: false, error: error.message });
          }
        };
      `;

      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const worker = new Worker(URL.createObjectURL(blob));

      worker.onmessage = (e) => {
        const { success, result, error } = e.data;
        worker.terminate();
        URL.revokeObjectURL(blob);

        if (success) {
          resolve(result);
        } else {
          reject(new Error(error));
        }
      };

      worker.onerror = (error) => {
        worker.terminate();
        URL.revokeObjectURL(blob);
        reject(error);
      };

      worker.postMessage(data);
    });
  }

  /**
   * Cleanup function to release resources
   */
  static cleanup() {
    // Clear all debounce timers
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();

    // Clear cache
    this.cache.clear();

    // Disconnect all intersection observers
    this.observedElements = new WeakMap();

    console.log('🧹 Performance utilities cleaned up');
  }
}

// Export performance monitoring decorator
export const withPerformanceMonitoring = (target, propertyKey, descriptor) => {
  const originalMethod = descriptor.value;
  descriptor.value = PerformanceUtils.measurePerformance(originalMethod, `${target.constructor.name}.${propertyKey}`);
  return descriptor;
};

// Auto-cleanup on page unload
window.addEventListener('beforeunload', () => {
  PerformanceUtils.cleanup();
});