// Performance Optimization Utilities
import { ErrorHandler } from './error-handler.js';
import appConfig from './app-config.js';

interface CacheEntry<T = unknown> {
  value: T;
  timestamp: number;
}

// non-standard Chrome memory API
interface PerformanceWithMemory extends Performance {
  memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
}

export class PerformanceUtils {
  static cache: Map<string, CacheEntry> = new Map();
  static debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  static observedElements: WeakMap<Element, IntersectionObserver> = new WeakMap();

  static debounce<T extends unknown[]>(
    func: (...args: T) => void,
    delay: number,
    key = 'default'
  ): (...args: T) => void {
    return (...args: T) => {
      const timer = this.debounceTimers.get(key);
      if (timer) {
        clearTimeout(timer);
      }

      this.debounceTimers.set(
        key,
        setTimeout(() => {
          func.apply(this, args);
          this.debounceTimers.delete(key);
        }, delay)
      );
    };
  }

  static throttle<T extends unknown[]>(
    func: (...args: T) => unknown,
    delay: number
  ): (...args: T) => unknown {
    let lastExecution = 0;
    return (...args: T) => {
      const now = Date.now();
      if (now - lastExecution >= delay) {
        lastExecution = now;
        return func.apply(this, args);
      }
    };
  }

  static memoize<T extends unknown[]>(
    func: (...args: T) => unknown,
    ttl: number = (appConfig.performance as { caching: { maxAge: number } }).caching.maxAge,
    keyGenerator: (args: T) => string = JSON.stringify
  ): (...args: T) => unknown {
    return (...args: T) => {
      const key = keyGenerator(args);
      const now = Date.now();

      if (this.cache.has(key)) {
        const entry = this.cache.get(key)!;
        if (now - entry.timestamp < ttl) {
          return entry.value;
        }
        this.cache.delete(key);
      }

      const result = func.apply(this, args);
      this.cache.set(key, { value: result, timestamp: now });

      if (this.cache.size > 100) {
        this.cleanCache();
      }

      return result;
    };
  }

  static cleanCache(): void {
    const now = Date.now();
    const {maxAge} = (appConfig.performance as { caching: { maxAge: number } }).caching;

    for (const [key, { timestamp }] of this.cache.entries()) {
      if (now - timestamp > maxAge) {
        this.cache.delete(key);
      }
    }
  }

  static measurePerformance<T extends unknown[]>(
    func: (...args: T) => Promise<unknown>,
    label: string
  ): (...args: T) => Promise<unknown> {
    return async (...args: T) => {
      const startTime = performance.now();

      try {
        const result = await func.apply(this, args);
        const endTime = performance.now();
        const duration = endTime - startTime;

        if ((appConfig.development as { enablePerformanceMonitoring: boolean }).enablePerformanceMonitoring) {
          // Performance monitoring
        }

        ErrorHandler.logPerformanceIssue(label, duration, 1000);

        return result;
      } catch (error) {
        ErrorHandler.handleError(
          new Error(`Performance measurement failed for ${label}: ${(error as Error).message}`),
          'Performance Monitoring'
        );

        throw error;
      }
    };
  }

  static lazyLoad(
    element: Element,
    loadCallback: (target: Element) => void,
    options: IntersectionObserverInit = {}
  ): void {
    const defaultOptions: IntersectionObserverInit = {
      threshold: 0.1,
      rootMargin: '50px',
      ...options,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
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

  static virtualScroll<T>(
    container: HTMLElement,
    items: T[],
    renderItem: (item: T, index: number) => HTMLElement | null,
    itemHeight: number,
    bufferSize = 5
  ): () => void {
    const containerHeight = container.clientHeight;
    const visibleCount = Math.ceil(containerHeight / itemHeight) + bufferSize * 2;

    let startIndex = 0;

    const render = (): void => {
      const fragment = document.createDocumentFragment();
      const endIndex = Math.min(startIndex + visibleCount, items.length);

      container.innerHTML = '';

      if (startIndex > 0) {
        const topSpacer = document.createElement('div');
        topSpacer.style.height = `${startIndex * itemHeight}px`;
        fragment.appendChild(topSpacer);
      }

      for (let i = startIndex; i < endIndex; i++) {
        const itemElement = renderItem(items[i], i);
        if (itemElement) {
          fragment.appendChild(itemElement);
        }
      }

      if (endIndex < items.length) {
        const bottomSpacer = document.createElement('div');
        bottomSpacer.style.height = `${(items.length - endIndex) * itemHeight}px`;
        fragment.appendChild(bottomSpacer);
      }

      container.appendChild(fragment);
    };

    const onScroll = this.throttle(() => {
      const { scrollTop } = container;
      const newStartIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - bufferSize);

      if (newStartIndex !== startIndex) {
        startIndex = newStartIndex;
        render();
      }
    }, 16) as () => void;

    container.addEventListener('scroll', onScroll);
    render();

    return () => {
      container.removeEventListener('scroll', onScroll);
    };
  }

  static batchDOMOperations(
    callback: (fragment: DocumentFragment) => void,
    container: Element
  ): void {
    const fragment = document.createDocumentFragment();
    callback(fragment);
    container.appendChild(fragment);
  }

  static requestAnimationFrame(callback: FrameRequestCallback): number {
    if (typeof requestAnimationFrame !== 'undefined') {
      return requestAnimationFrame(callback);
    }
    return setTimeout(callback, 16) as unknown as number;
  }

  static cancelAnimationFrame(id: number): void {
    if (typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(id);
    } else {
      clearTimeout(id);
    }
  }

  static lazyLoadImage(
    img: HTMLImageElement,
    src: string,
    placeholder = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"%3E%3C/svg%3E'
  ): void {
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

  static getMemoryUsage(): { used: number; total: number; limit: number } | null {
    const perf = performance as PerformanceWithMemory;
    if (perf.memory) {
      return {
        used: Math.round(perf.memory.usedJSHeapSize / 1048576),
        total: Math.round(perf.memory.totalJSHeapSize / 1048576),
        limit: Math.round(perf.memory.jsHeapSizeLimit / 1048576),
      };
    }
    return null;
  }

  static runInWorker<T>(workerFunction: (data: unknown) => T, data: unknown): Promise<T> {
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
      const blobUrl = URL.createObjectURL(blob);
      const worker = new Worker(blobUrl);

      worker.onmessage = (e: MessageEvent<{ success: boolean; result: T; error: string }>) => {
        const { success, result, error } = e.data;
        worker.terminate();
        URL.revokeObjectURL(blobUrl);

        if (success) {
          resolve(result);
        } else {
          reject(new Error(error));
        }
      };

      worker.onerror = (error) => {
        worker.terminate();
        URL.revokeObjectURL(blobUrl);
        reject(error);
      };

      worker.postMessage(data);
    });
  }

  static cleanup(): void {
    this.debounceTimers.forEach((timer) => clearTimeout(timer));
    this.debounceTimers.clear();
    this.cache.clear();
    this.observedElements = new WeakMap();
  }
}

// Export performance monitoring decorator
export const withPerformanceMonitoring = (
  target: object,
  propertyKey: string,
  descriptor: PropertyDescriptor
): PropertyDescriptor => {
  const originalMethod = descriptor.value;
  descriptor.value = PerformanceUtils.measurePerformance(
    originalMethod,
    `${(target as { constructor: { name: string } }).constructor.name}.${propertyKey}`
  );
  return descriptor;
};

// Auto-cleanup on page unload
window.addEventListener('beforeunload', () => {
  PerformanceUtils.cleanup();
});
