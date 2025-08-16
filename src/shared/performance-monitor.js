// Performance Monitor for Cache Operations and System Performance
// Tracks cache performance, worker efficiency, and provides optimization recommendations

import { ErrorHandler } from './error-handler.js';
import appConfig from './app-config.js';

export class PerformanceMonitor {
  static instance = null;
  
  constructor() {
    this.metrics = {
      cache: {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        totalRequestTime: 0,
        totalSetTime: 0,
        hitsByType: {},
        missesByType: {},
        sizeStats: { min: Infinity, max: 0, total: 0, count: 0 }
      },
      workers: {
        fileSystem: { tasks: 0, totalTime: 0, errors: 0, avgResponseTime: 0 },
        dataProcessing: { queries: 0, totalTime: 0, errors: 0, avgResponseTime: 0 },
        backgroundSync: { tasks: 0, totalTime: 0, errors: 0, completionRate: 0 }
      },
      storage: {
        opfsOperations: 0,
        opfsTime: 0,
        compressionRatio: 0,
        storageEfficiency: 0
      },
      system: {
        memoryUsage: [],
        loadTimes: [],
        errorCount: 0,
        sessionStart: Date.now()
      }
    };
    
    this.startTime = performance.now();
    this.measurements = new Map();
    this.performanceObserver = null;
    this.memoryMonitor = null;
    
    this.initializeMonitoring();
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new PerformanceMonitor();
    }
    return this.instance;
  }

  /**
   * Initialize performance monitoring
   */
  initializeMonitoring() {
    if (!appConfig.development.enablePerformanceMonitoring) {
      return;
    }

    try {
      // Setup Performance Observer for navigation and resource timing
      if (typeof PerformanceObserver !== 'undefined') {
        this.performanceObserver = new PerformanceObserver((list) => {
          this.processPerformanceEntries(list.getEntries());
        });
        
        this.performanceObserver.observe({
          entryTypes: ['navigation', 'resource', 'measure', 'mark']
        });
      }

      // Start memory monitoring
      this.startMemoryMonitoring();
      
      // Setup periodic reporting
      this.startPeriodicReporting();
      
      if (appConfig.development.enableLogging) {
        console.log('📊 Performance Monitor initialized');
      }
    } catch (error) {
      console.warn('Performance monitoring setup failed:', error);
    }
  }

  /**
   * Start memory usage monitoring
   */
  startMemoryMonitoring() {
    if (typeof performance !== 'undefined' && performance.memory) {
      this.memoryMonitor = setInterval(() => {
        const memory = {
          used: Math.round(performance.memory.usedJSHeapSize / 1048576), // MB
          total: Math.round(performance.memory.totalJSHeapSize / 1048576), // MB
          limit: Math.round(performance.memory.jsHeapSizeLimit / 1048576), // MB
          timestamp: Date.now()
        };
        
        this.metrics.system.memoryUsage.push(memory);
        
        // Keep only last 100 measurements
        if (this.metrics.system.memoryUsage.length > 100) {
          this.metrics.system.memoryUsage.shift();
        }
        
        // Alert on high memory usage
        const usage = (memory.used / memory.limit) * 100;
        if (usage > 80) {
          this.reportHighMemoryUsage(usage, memory);
        }
      }, 10000); // Every 10 seconds
    }
  }

  /**
   * Start periodic performance reporting
   */
  startPeriodicReporting() {
    setInterval(() => {
      if (appConfig.development.enableLogging) {
        this.logPerformanceSummary();
      }
    }, 60000); // Every minute
  }

  /**
   * Process performance entries from PerformanceObserver
   */
  processPerformanceEntries(entries) {
    entries.forEach(entry => {
      switch (entry.entryType) {
        case 'navigation':
          this.processNavigationTiming(entry);
          break;
        case 'resource':
          this.processResourceTiming(entry);
          break;
        case 'measure':
          this.processMeasure(entry);
          break;
        case 'mark':
          this.processMark(entry);
          break;
      }
    });
  }

  /**
   * Process navigation timing
   */
  processNavigationTiming(entry) {
    const loadTime = entry.loadEventEnd - entry.navigationStart;
    this.metrics.system.loadTimes.push({
      total: loadTime,
      domContentLoaded: entry.domContentLoadedEventEnd - entry.navigationStart,
      firstPaint: entry.responseEnd - entry.requestStart,
      timestamp: Date.now()
    });
  }

  /**
   * Process resource timing
   */
  processResourceTiming(entry) {
    // Track worker script loading times
    if (entry.name.includes('worker')) {
      const loadTime = entry.responseEnd - entry.requestStart;
      this.recordMeasurement('worker-load', loadTime);
    }
  }

  /**
   * Process custom measures
   */
  processMeasure(entry) {
    if (entry.name.startsWith('cache-')) {
      this.recordCacheMeasurement(entry);
    } else if (entry.name.startsWith('worker-')) {
      this.recordWorkerMeasurement(entry);
    }
  }

  /**
   * Process marks (used for custom timing)
   */
  processMark(entry) {
    // Custom mark processing if needed
  }

  /**
   * Record cache operation performance
   */
  recordCacheOperation(operation, type, duration, success = true, size = 0) {
    const cache = this.metrics.cache;
    
    switch (operation) {
      case 'hit':
        cache.hits++;
        cache.hitsByType[type] = (cache.hitsByType[type] || 0) + 1;
        break;
      case 'miss':
        cache.misses++;
        cache.missesByType[type] = (cache.missesByType[type] || 0) + 1;
        break;
      case 'set':
        cache.sets++;
        cache.totalSetTime += duration;
        this.updateSizeStats(size);
        break;
      case 'delete':
        cache.deletes++;
        break;
    }
    
    cache.totalRequestTime += duration;
    
    if (!success) {
      this.metrics.system.errorCount++;
    }
  }

  /**
   * Record worker operation performance
   */
  recordWorkerOperation(workerType, operation, duration, success = true) {
    const worker = this.metrics.workers[workerType];
    if (!worker) return;
    
    if (workerType === 'dataProcessing' && operation === 'query') {
      worker.queries++;
    } else {
      worker.tasks++;
    }
    
    worker.totalTime += duration;
    worker.avgResponseTime = worker.totalTime / Math.max(worker.tasks + worker.queries, 1);
    
    if (!success) {
      worker.errors++;
    }
    
    // Update completion rate for background sync
    if (workerType === 'backgroundSync') {
      const total = worker.tasks;
      const successful = total - worker.errors;
      worker.completionRate = total > 0 ? (successful / total) * 100 : 0;
    }
  }

  /**
   * Record storage operation performance
   */
  recordStorageOperation(operation, duration, size = 0, compressionRatio = 0) {
    const storage = this.metrics.storage;
    
    storage.opfsOperations++;
    storage.opfsTime += duration;
    
    if (compressionRatio > 0) {
      storage.compressionRatio = 
        (storage.compressionRatio + compressionRatio) / 2;
    }
    
    // Calculate storage efficiency (operations per second)
    const totalTimeSeconds = storage.opfsTime / 1000;
    storage.storageEfficiency = storage.opfsOperations / Math.max(totalTimeSeconds, 1);
  }

  /**
   * Update cache size statistics
   */
  updateSizeStats(size) {
    const stats = this.metrics.cache.sizeStats;
    stats.min = Math.min(stats.min, size);
    stats.max = Math.max(stats.max, size);
    stats.total += size;
    stats.count++;
  }

  /**
   * Record custom measurement
   */
  recordMeasurement(name, duration) {
    if (!this.measurements.has(name)) {
      this.measurements.set(name, []);
    }
    
    this.measurements.get(name).push({
      duration,
      timestamp: Date.now()
    });
    
    // Keep only last 100 measurements per type
    const measurements = this.measurements.get(name);
    if (measurements.length > 100) {
      measurements.shift();
    }
  }

  /**
   * Record cache measurement from Performance API
   */
  recordCacheMeasurement(entry) {
    const operation = entry.name.split('-')[1];
    this.recordCacheOperation(operation, 'measure', entry.duration, true);
  }

  /**
   * Record worker measurement from Performance API
   */
  recordWorkerMeasurement(entry) {
    const parts = entry.name.split('-');
    const workerType = parts[1];
    this.recordWorkerOperation(workerType, 'task', entry.duration, true);
  }

  /**
   * Get cache performance metrics
   */
  getCacheMetrics() {
    const cache = this.metrics.cache;
    const totalRequests = cache.hits + cache.misses;
    const hitRate = totalRequests > 0 ? (cache.hits / totalRequests) * 100 : 0;
    const avgRequestTime = totalRequests > 0 ? cache.totalRequestTime / totalRequests : 0;
    const avgSetTime = cache.sets > 0 ? cache.totalSetTime / cache.sets : 0;
    const avgCacheSize = cache.sizeStats.count > 0 ? 
      cache.sizeStats.total / cache.sizeStats.count : 0;
    
    return {
      hitRate: Math.round(hitRate * 100) / 100,
      totalRequests,
      avgRequestTime: Math.round(avgRequestTime * 100) / 100,
      avgSetTime: Math.round(avgSetTime * 100) / 100,
      avgCacheSize: Math.round(avgCacheSize),
      hitsByType: cache.hitsByType,
      missesByType: cache.missesByType,
      efficiency: this.calculateCacheEfficiency()
    };
  }

  /**
   * Calculate cache efficiency score
   */
  calculateCacheEfficiency() {
    const cache = this.metrics.cache;
    const totalRequests = cache.hits + cache.misses;
    
    if (totalRequests === 0) return 0;
    
    const hitRate = (cache.hits / totalRequests) * 100;
    const avgTime = cache.totalRequestTime / totalRequests;
    
    // Efficiency score based on hit rate and response time
    // Higher hit rate and lower response time = higher efficiency
    const timeScore = Math.max(0, 100 - (avgTime / 10)); // Assume 10ms is good
    const efficiency = (hitRate * 0.7) + (timeScore * 0.3);
    
    return Math.round(efficiency * 100) / 100;
  }

  /**
   * Get worker performance metrics
   */
  getWorkerMetrics() {
    const workers = this.metrics.workers;
    const result = {};
    
    for (const [type, metrics] of Object.entries(workers)) {
      const totalOps = metrics.tasks + (metrics.queries || 0);
      const successRate = totalOps > 0 ? 
        ((totalOps - metrics.errors) / totalOps) * 100 : 0;
      
      result[type] = {
        ...metrics,
        successRate: Math.round(successRate * 100) / 100,
        efficiency: this.calculateWorkerEfficiency(metrics)
      };
    }
    
    return result;
  }

  /**
   * Calculate worker efficiency
   */
  calculateWorkerEfficiency(metrics) {
    const totalOps = metrics.tasks + (metrics.queries || 0);
    if (totalOps === 0) return 0;
    
    const errorRate = (metrics.errors / totalOps) * 100;
    const avgTime = metrics.avgResponseTime;
    
    // Efficiency based on low error rate and fast response time
    const errorScore = Math.max(0, 100 - errorRate);
    const timeScore = Math.max(0, 100 - (avgTime / 100)); // Assume 100ms is acceptable
    
    return Math.round(((errorScore * 0.6) + (timeScore * 0.4)) * 100) / 100;
  }

  /**
   * Get system performance metrics
   */
  getSystemMetrics() {
    const system = this.metrics.system;
    const uptime = Date.now() - system.sessionStart;
    
    let avgMemoryUsage = 0;
    let peakMemoryUsage = 0;
    if (system.memoryUsage.length > 0) {
      avgMemoryUsage = system.memoryUsage.reduce((sum, m) => sum + m.used, 0) / 
                      system.memoryUsage.length;
      peakMemoryUsage = Math.max(...system.memoryUsage.map(m => m.used));
    }
    
    return {
      uptime,
      errorCount: system.errorCount,
      avgMemoryUsage: Math.round(avgMemoryUsage),
      peakMemoryUsage,
      loadTimes: system.loadTimes,
      memoryTrend: this.calculateMemoryTrend()
    };
  }

  /**
   * Calculate memory usage trend
   */
  calculateMemoryTrend() {
    const memory = this.metrics.system.memoryUsage;
    if (memory.length < 2) return 'stable';
    
    const recent = memory.slice(-10); // Last 10 measurements
    const first = recent[0].used;
    const last = recent[recent.length - 1].used;
    const change = ((last - first) / first) * 100;
    
    if (change > 10) return 'increasing';
    if (change < -10) return 'decreasing';
    return 'stable';
  }

  /**
   * Get performance recommendations
   */
  getRecommendations() {
    const recommendations = [];
    const cache = this.getCacheMetrics();
    const workers = this.getWorkerMetrics();
    const system = this.getSystemMetrics();
    
    // Cache recommendations
    if (cache.hitRate < 50) {
      recommendations.push({
        type: 'cache',
        priority: 'high',
        title: 'Low Cache Hit Rate',
        description: `Cache hit rate is ${cache.hitRate}%. Consider increasing cache TTL or improving cache key strategy.`,
        action: 'Optimize caching strategy'
      });
    }
    
    if (cache.avgRequestTime > 50) {
      recommendations.push({
        type: 'cache',
        priority: 'medium',
        title: 'Slow Cache Access',
        description: `Average cache access time is ${cache.avgRequestTime}ms. Consider optimizing cache storage.`,
        action: 'Optimize cache performance'
      });
    }
    
    // Worker recommendations
    Object.entries(workers).forEach(([type, metrics]) => {
      if (metrics.successRate < 90) {
        recommendations.push({
          type: 'worker',
          priority: 'high',
          title: `${type} Worker Issues`,
          description: `${type} worker has ${metrics.successRate}% success rate. Check for errors.`,
          action: 'Investigate worker errors'
        });
      }
      
      if (metrics.avgResponseTime > 1000) {
        recommendations.push({
          type: 'worker',
          priority: 'medium',
          title: `Slow ${type} Worker`,
          description: `${type} worker average response time is ${metrics.avgResponseTime}ms.`,
          action: 'Optimize worker performance'
        });
      }
    });
    
    // Memory recommendations
    if (system.peakMemoryUsage > 200) {
      recommendations.push({
        type: 'memory',
        priority: 'medium',
        title: 'High Memory Usage',
        description: `Peak memory usage is ${system.peakMemoryUsage}MB. Consider memory optimization.`,
        action: 'Optimize memory usage'
      });
    }
    
    if (system.memoryTrend === 'increasing') {
      recommendations.push({
        type: 'memory',
        priority: 'high',
        title: 'Memory Leak Suspected',
        description: 'Memory usage is consistently increasing. Check for memory leaks.',
        action: 'Investigate memory leaks'
      });
    }
    
    return recommendations;
  }

  /**
   * Get comprehensive performance report
   */
  getPerformanceReport() {
    return {
      cache: this.getCacheMetrics(),
      workers: this.getWorkerMetrics(),
      system: this.getSystemMetrics(),
      storage: this.metrics.storage,
      recommendations: this.getRecommendations(),
      timestamp: Date.now(),
      sessionDuration: Date.now() - this.metrics.system.sessionStart
    };
  }

  /**
   * Report high memory usage
   */
  reportHighMemoryUsage(usage, memory) {
    ErrorHandler.logPerformanceIssue(
      'High Memory Usage', 
      usage, 
      80, 
      `Memory usage at ${usage}% (${memory.used}MB/${memory.limit}MB)`
    );
  }

  /**
   * Log performance summary
   */
  logPerformanceSummary() {
    const report = this.getPerformanceReport();
    
    console.group('📊 Performance Summary');
    console.log(`Cache Hit Rate: ${report.cache.hitRate}%`);
    console.log(`Avg Memory: ${report.system.avgMemoryUsage}MB`);
    console.log(`Error Count: ${report.system.errorCount}`);
    
    if (report.recommendations.length > 0) {
      console.warn(`${report.recommendations.length} performance recommendations available`);
    }
    
    console.groupEnd();
  }

  /**
   * Export performance data
   */
  exportPerformanceData() {
    const report = this.getPerformanceReport();
    return {
      ...report,
      measurements: Object.fromEntries(this.measurements),
      exportedAt: new Date().toISOString()
    };
  }

  /**
   * Reset performance metrics
   */
  resetMetrics() {
    this.metrics = {
      cache: {
        hits: 0, misses: 0, sets: 0, deletes: 0,
        totalRequestTime: 0, totalSetTime: 0,
        hitsByType: {}, missesByType: {},
        sizeStats: { min: Infinity, max: 0, total: 0, count: 0 }
      },
      workers: {
        fileSystem: { tasks: 0, totalTime: 0, errors: 0, avgResponseTime: 0 },
        dataProcessing: { queries: 0, totalTime: 0, errors: 0, avgResponseTime: 0 },
        backgroundSync: { tasks: 0, totalTime: 0, errors: 0, completionRate: 0 }
      },
      storage: {
        opfsOperations: 0, opfsTime: 0,
        compressionRatio: 0, storageEfficiency: 0
      },
      system: {
        memoryUsage: [],
        loadTimes: [],
        errorCount: 0,
        sessionStart: Date.now()
      }
    };
    
    this.measurements.clear();
    this.startTime = performance.now();
  }

  /**
   * Cleanup monitoring
   */
  cleanup() {
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
    
    if (this.memoryMonitor) {
      clearInterval(this.memoryMonitor);
    }
  }
}

// Export singleton instance
export default PerformanceMonitor.getInstance();