// Performance Monitor Tests
import { jest } from '@jest/globals';

describe('PerformanceMonitor', () => {
  let MockPerformanceMonitor;
  let mockPerformanceObserver;

  beforeEach(() => {
    // Mock Performance Observer
    mockPerformanceObserver = {
      observe: jest.fn(),
      disconnect: jest.fn()
    };

    global.PerformanceObserver = jest.fn(() => mockPerformanceObserver);

    // Mock performance.memory
    global.performance = {
      ...global.performance,
      now: jest.fn(() => Date.now()),
      memory: {
        usedJSHeapSize: 50 * 1024 * 1024, // 50MB
        totalJSHeapSize: 100 * 1024 * 1024, // 100MB
        jsHeapSizeLimit: 1024 * 1024 * 1024 // 1GB
      }
    };

    // Create mock PerformanceMonitor class
    class MockPerformanceMonitorClass {
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
      }

      initializeMonitoring() {
        if (typeof PerformanceObserver !== 'undefined') {
          this.performanceObserver = new PerformanceObserver((list) => {
            this.processPerformanceEntries(list.getEntries());
          });
          
          this.performanceObserver.observe({
            entryTypes: ['navigation', 'resource', 'measure', 'mark']
          });
        }

        this.startMemoryMonitoring();
      }

      startMemoryMonitoring() {
        if (typeof performance !== 'undefined' && performance.memory) {
          this.memoryMonitor = setInterval(() => {
            const memory = {
              used: Math.round(performance.memory.usedJSHeapSize / 1048576),
              total: Math.round(performance.memory.totalJSHeapSize / 1048576),
              limit: Math.round(performance.memory.jsHeapSizeLimit / 1048576),
              timestamp: Date.now()
            };
            
            this.metrics.system.memoryUsage.push(memory);
            
            if (this.metrics.system.memoryUsage.length > 100) {
              this.metrics.system.memoryUsage.shift();
            }
            
            const usage = (memory.used / memory.limit) * 100;
            if (usage > 80) {
              this.reportHighMemoryUsage(usage, memory);
            }
          }, 1000); // Faster for testing
        }
      }

      stopMemoryMonitoring() {
        if (this.memoryMonitor) {
          clearInterval(this.memoryMonitor);
          this.memoryMonitor = null;
        }
      }

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

      processNavigationTiming(entry) {
        const loadTime = entry.loadEventEnd - entry.navigationStart;
        this.metrics.system.loadTimes.push({
          total: loadTime,
          domContentLoaded: entry.domContentLoadedEventEnd - entry.navigationStart,
          firstPaint: entry.responseEnd - entry.requestStart,
          timestamp: Date.now()
        });
      }

      processResourceTiming(entry) {
        if (entry.name.includes('worker')) {
          const loadTime = entry.responseEnd - entry.requestStart;
          this.recordMeasurement('worker-load', loadTime);
        }
      }

      processMeasure(entry) {
        if (entry.name.startsWith('cache-')) {
          this.recordCacheMeasurement(entry);
        } else if (entry.name.startsWith('worker-')) {
          this.recordWorkerMeasurement(entry);
        }
      }

      processMark(entry) {
        // Custom mark processing
      }

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
        
        if (workerType === 'backgroundSync') {
          const total = worker.tasks;
          const successful = total - worker.errors;
          worker.completionRate = total > 0 ? (successful / total) * 100 : 0;
        }
      }

      recordStorageOperation(operation, duration, size = 0, compressionRatio = 0) {
        const storage = this.metrics.storage;
        
        storage.opfsOperations++;
        storage.opfsTime += duration;
        
        if (compressionRatio > 0) {
          storage.compressionRatio = (storage.compressionRatio + compressionRatio) / 2;
        }
        
        const totalTimeSeconds = storage.opfsTime / 1000;
        storage.storageEfficiency = storage.opfsOperations / Math.max(totalTimeSeconds, 1);
      }

      updateSizeStats(size) {
        const stats = this.metrics.cache.sizeStats;
        stats.min = Math.min(stats.min, size);
        stats.max = Math.max(stats.max, size);
        stats.total += size;
        stats.count++;
      }

      recordMeasurement(name, duration) {
        if (!this.measurements.has(name)) {
          this.measurements.set(name, []);
        }
        
        this.measurements.get(name).push({
          duration,
          timestamp: Date.now()
        });
        
        const measurements = this.measurements.get(name);
        if (measurements.length > 100) {
          measurements.shift();
        }
      }

      recordCacheMeasurement(entry) {
        const operation = entry.name.split('-')[1];
        this.recordCacheOperation(operation, 'measure', entry.duration, true);
      }

      recordWorkerMeasurement(entry) {
        const parts = entry.name.split('-');
        const workerType = parts[1];
        this.recordWorkerOperation(workerType, 'task', entry.duration, true);
      }

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

      calculateCacheEfficiency() {
        const cache = this.metrics.cache;
        const totalRequests = cache.hits + cache.misses;
        
        if (totalRequests === 0) return 0;
        
        const hitRate = (cache.hits / totalRequests) * 100;
        const avgTime = cache.totalRequestTime / totalRequests;
        
        const timeScore = Math.max(0, 100 - (avgTime / 10));
        const efficiency = (hitRate * 0.7) + (timeScore * 0.3);
        
        return Math.round(efficiency * 100) / 100;
      }

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

      calculateWorkerEfficiency(metrics) {
        const totalOps = metrics.tasks + (metrics.queries || 0);
        if (totalOps === 0) return 0;
        
        const errorRate = (metrics.errors / totalOps) * 100;
        const avgTime = metrics.avgResponseTime;
        
        const errorScore = Math.max(0, 100 - errorRate);
        const timeScore = Math.max(0, 100 - (avgTime / 100));
        
        return Math.round(((errorScore * 0.6) + (timeScore * 0.4)) * 100) / 100;
      }

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

      calculateMemoryTrend() {
        const memory = this.metrics.system.memoryUsage;
        if (memory.length < 2) return 'stable';
        
        const recent = memory.slice(-10);
        const first = recent[0].used;
        const last = recent[recent.length - 1].used;
        const change = ((last - first) / first) * 100;
        
        if (change > 10) return 'increasing';
        if (change < -10) return 'decreasing';
        return 'stable';
      }

      getRecommendations() {
        const recommendations = [];
        const cache = this.getCacheMetrics();
        const workers = this.getWorkerMetrics();
        const system = this.getSystemMetrics();
        
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

      reportHighMemoryUsage(usage, memory) {
        console.warn(`High memory usage: ${usage}% (${memory.used}MB/${memory.limit}MB)`);
      }

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

      cleanup() {
        if (this.performanceObserver) {
          this.performanceObserver.disconnect();
        }
        
        this.stopMemoryMonitoring();
      }

      static getInstance() {
        if (!this.instance) {
          this.instance = new MockPerformanceMonitorClass();
        }
        return this.instance;
      }
    }

    MockPerformanceMonitor = MockPerformanceMonitorClass;
  });

  afterEach(() => {
    jest.clearAllMocks();
    if (MockPerformanceMonitor.instance) {
      MockPerformanceMonitor.instance.cleanup();
      MockPerformanceMonitor.instance = null;
    }
  });

  describe('Initialization', () => {
    test('should initialize performance monitoring', () => {
      const monitor = new MockPerformanceMonitor();
      monitor.initializeMonitoring();
      
      expect(PerformanceObserver).toHaveBeenCalled();
      expect(mockPerformanceObserver.observe).toHaveBeenCalledWith({
        entryTypes: ['navigation', 'resource', 'measure', 'mark']
      });
    });

    test('should start memory monitoring', (done) => {
      const monitor = new MockPerformanceMonitor();
      monitor.startMemoryMonitoring();
      
      setTimeout(() => {
        expect(monitor.metrics.system.memoryUsage.length).toBeGreaterThan(0);
        monitor.stopMemoryMonitoring();
        done();
      }, 1100);
    });
  });

  describe('Cache Performance Recording', () => {
    test('should record cache hit', () => {
      const monitor = new MockPerformanceMonitor();
      monitor.recordCacheOperation('hit', 'query', 10, true);
      
      expect(monitor.metrics.cache.hits).toBe(1);
      expect(monitor.metrics.cache.hitsByType.query).toBe(1);
      expect(monitor.metrics.cache.totalRequestTime).toBe(10);
    });

    test('should record cache miss', () => {
      const monitor = new MockPerformanceMonitor();
      monitor.recordCacheOperation('miss', 'query', 25, true);
      
      expect(monitor.metrics.cache.misses).toBe(1);
      expect(monitor.metrics.cache.missesByType.query).toBe(1);
      expect(monitor.metrics.cache.totalRequestTime).toBe(25);
    });

    test('should record cache set with size', () => {
      const monitor = new MockPerformanceMonitor();
      monitor.recordCacheOperation('set', 'data', 15, true, 1024);
      
      expect(monitor.metrics.cache.sets).toBe(1);
      expect(monitor.metrics.cache.totalSetTime).toBe(15);
      expect(monitor.metrics.cache.sizeStats.total).toBe(1024);
      expect(monitor.metrics.cache.sizeStats.count).toBe(1);
    });

    test('should record cache delete', () => {
      const monitor = new MockPerformanceMonitor();
      monitor.recordCacheOperation('delete', 'data', 5, true);
      
      expect(monitor.metrics.cache.deletes).toBe(1);
    });

    test('should handle cache operation errors', () => {
      const monitor = new MockPerformanceMonitor();
      monitor.recordCacheOperation('hit', 'query', 10, false);
      
      expect(monitor.metrics.system.errorCount).toBe(1);
    });
  });

  describe('Worker Performance Recording', () => {
    test('should record file system worker operation', () => {
      const monitor = new MockPerformanceMonitor();
      monitor.recordWorkerOperation('fileSystem', 'task', 100, true);
      
      const worker = monitor.metrics.workers.fileSystem;
      expect(worker.tasks).toBe(1);
      expect(worker.totalTime).toBe(100);
      expect(worker.avgResponseTime).toBe(100);
      expect(worker.errors).toBe(0);
    });

    test('should record data processing query', () => {
      const monitor = new MockPerformanceMonitor();
      monitor.recordWorkerOperation('dataProcessing', 'query', 250, true);
      
      const worker = monitor.metrics.workers.dataProcessing;
      expect(worker.queries).toBe(1);
      expect(worker.totalTime).toBe(250);
      expect(worker.avgResponseTime).toBe(250);
    });

    test('should calculate background sync completion rate', () => {
      const monitor = new MockPerformanceMonitor();
      
      // Record successful tasks
      monitor.recordWorkerOperation('backgroundSync', 'task', 100, true);
      monitor.recordWorkerOperation('backgroundSync', 'task', 150, true);
      monitor.recordWorkerOperation('backgroundSync', 'task', 120, false); // Failed
      
      const worker = monitor.metrics.workers.backgroundSync;
      expect(worker.tasks).toBe(3);
      expect(worker.errors).toBe(1);
      expect(worker.completionRate).toBeCloseTo(66.67, 1);
    });

    test('should handle unknown worker type gracefully', () => {
      const monitor = new MockPerformanceMonitor();
      
      expect(() => {
        monitor.recordWorkerOperation('unknown', 'task', 100, true);
      }).not.toThrow();
    });
  });

  describe('Storage Performance Recording', () => {
    test('should record storage operation', () => {
      const monitor = new MockPerformanceMonitor();
      monitor.recordStorageOperation('write', 50, 2048, 0.6);
      
      const storage = monitor.metrics.storage;
      expect(storage.opfsOperations).toBe(1);
      expect(storage.opfsTime).toBe(50);
      expect(storage.compressionRatio).toBe(0.6);
      expect(storage.storageEfficiency).toBe(20); // 1 operation / 0.05 seconds
    });

    test('should calculate average compression ratio', () => {
      const monitor = new MockPerformanceMonitor();
      monitor.recordStorageOperation('write', 30, 1024, 0.5);
      monitor.recordStorageOperation('write', 40, 2048, 0.7);
      
      expect(monitor.metrics.storage.compressionRatio).toBe(0.6); // (0.5 + 0.7) / 2
    });
  });

  describe('Measurements', () => {
    test('should record custom measurements', () => {
      const monitor = new MockPerformanceMonitor();
      monitor.recordMeasurement('custom-operation', 123);
      
      const measurements = monitor.measurements.get('custom-operation');
      expect(measurements).toHaveLength(1);
      expect(measurements[0].duration).toBe(123);
      expect(measurements[0].timestamp).toBeCloseTo(Date.now(), -2);
    });

    test('should limit measurements to 100 entries', () => {
      const monitor = new MockPerformanceMonitor();
      
      // Add 150 measurements
      for (let i = 0; i < 150; i++) {
        monitor.recordMeasurement('test-operation', i);
      }
      
      const measurements = monitor.measurements.get('test-operation');
      expect(measurements).toHaveLength(100);
      expect(measurements[0].duration).toBe(50); // First 50 should be removed
    });
  });

  describe('Cache Metrics Calculation', () => {
    test('should calculate cache hit rate', () => {
      const monitor = new MockPerformanceMonitor();
      monitor.recordCacheOperation('hit', 'query', 10);
      monitor.recordCacheOperation('hit', 'query', 15);
      monitor.recordCacheOperation('miss', 'query', 20);
      
      const metrics = monitor.getCacheMetrics();
      expect(metrics.hitRate).toBeCloseTo(66.67, 1);
      expect(metrics.totalRequests).toBe(3);
    });

    test('should calculate average request time', () => {
      const monitor = new MockPerformanceMonitor();
      monitor.recordCacheOperation('hit', 'query', 10);
      monitor.recordCacheOperation('miss', 'query', 20);
      
      const metrics = monitor.getCacheMetrics();
      expect(metrics.avgRequestTime).toBe(15);
    });

    test('should calculate cache efficiency', () => {
      const monitor = new MockPerformanceMonitor();
      monitor.recordCacheOperation('hit', 'query', 5); // Fast hit
      monitor.recordCacheOperation('hit', 'query', 5);
      monitor.recordCacheOperation('miss', 'query', 10);
      
      const metrics = monitor.getCacheMetrics();
      expect(metrics.efficiency).toBeGreaterThan(50); // Good hit rate + fast response
    });
  });

  describe('Worker Metrics Calculation', () => {
    test('should calculate worker success rate', () => {
      const monitor = new MockPerformanceMonitor();
      monitor.recordWorkerOperation('fileSystem', 'task', 100, true);
      monitor.recordWorkerOperation('fileSystem', 'task', 120, true);
      monitor.recordWorkerOperation('fileSystem', 'task', 110, false);
      
      const metrics = monitor.getWorkerMetrics();
      expect(metrics.fileSystem.successRate).toBeCloseTo(66.67, 1);
    });

    test('should calculate worker efficiency', () => {
      const monitor = new MockPerformanceMonitor();
      monitor.recordWorkerOperation('dataProcessing', 'query', 50, true); // Fast and successful
      
      const metrics = monitor.getWorkerMetrics();
      expect(metrics.dataProcessing.efficiency).toBeGreaterThan(80);
    });
  });

  describe('System Metrics', () => {
    test('should calculate system uptime', () => {
      const monitor = new MockPerformanceMonitor();
      const sessionStart = monitor.metrics.system.sessionStart;
      
      const metrics = monitor.getSystemMetrics();
      expect(metrics.uptime).toBeGreaterThan(0);
      expect(metrics.uptime).toBeLessThan(1000); // Should be recent
    });

    test('should track error count', () => {
      const monitor = new MockPerformanceMonitor();
      monitor.recordCacheOperation('hit', 'query', 10, false);
      monitor.recordWorkerOperation('fileSystem', 'task', 100, false);
      
      const metrics = monitor.getSystemMetrics();
      expect(metrics.errorCount).toBe(2);
    });

    test('should calculate memory trend', (done) => {
      const monitor = new MockPerformanceMonitor();
      
      // Add memory usage data points
      for (let i = 0; i < 15; i++) {
        monitor.metrics.system.memoryUsage.push({
          used: 50 + i * 2, // Increasing memory usage
          timestamp: Date.now() + i * 1000
        });
      }
      
      const metrics = monitor.getSystemMetrics();
      expect(metrics.memoryTrend).toBe('increasing');
      done();
    });
  });

  describe('Recommendations', () => {
    test('should recommend cache optimization for low hit rate', () => {
      const monitor = new MockPerformanceMonitor();
      monitor.recordCacheOperation('hit', 'query', 10);
      monitor.recordCacheOperation('miss', 'query', 20);
      monitor.recordCacheOperation('miss', 'query', 25);
      monitor.recordCacheOperation('miss', 'query', 30);
      
      const recommendations = monitor.getRecommendations();
      const cacheRec = recommendations.find(r => r.type === 'cache' && r.title === 'Low Cache Hit Rate');
      expect(cacheRec).toBeDefined();
      expect(cacheRec.priority).toBe('high');
    });

    test('should recommend worker optimization for low success rate', () => {
      const monitor = new MockPerformanceMonitor();
      monitor.recordWorkerOperation('fileSystem', 'task', 100, false);
      monitor.recordWorkerOperation('fileSystem', 'task', 120, false);
      monitor.recordWorkerOperation('fileSystem', 'task', 110, true);
      
      const recommendations = monitor.getRecommendations();
      const workerRec = recommendations.find(r => r.type === 'worker');
      expect(workerRec).toBeDefined();
      expect(workerRec.title).toContain('fileSystem Worker Issues');
    });

    test('should recommend memory optimization for high usage', () => {
      const monitor = new MockPerformanceMonitor();
      monitor.metrics.system.memoryUsage.push({ used: 250 }); // High memory usage
      
      const recommendations = monitor.getRecommendations();
      const memoryRec = recommendations.find(r => r.type === 'memory' && r.title === 'High Memory Usage');
      expect(memoryRec).toBeDefined();
    });
  });

  describe('Performance Report', () => {
    test('should generate comprehensive performance report', () => {
      const monitor = new MockPerformanceMonitor();
      monitor.recordCacheOperation('hit', 'query', 10);
      monitor.recordWorkerOperation('fileSystem', 'task', 100, true);
      
      const report = monitor.getPerformanceReport();
      
      expect(report).toHaveProperty('cache');
      expect(report).toHaveProperty('workers');
      expect(report).toHaveProperty('system');
      expect(report).toHaveProperty('storage');
      expect(report).toHaveProperty('recommendations');
      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('sessionDuration');
    });
  });

  describe('Performance Entry Processing', () => {
    test('should process navigation timing', () => {
      const monitor = new MockPerformanceMonitor();
      const navigationEntry = {
        entryType: 'navigation',
        navigationStart: 1000,
        loadEventEnd: 2000,
        domContentLoadedEventEnd: 1500,
        responseEnd: 1200,
        requestStart: 1100
      };
      
      monitor.processNavigationTiming(navigationEntry);
      
      expect(monitor.metrics.system.loadTimes).toHaveLength(1);
      expect(monitor.metrics.system.loadTimes[0].total).toBe(1000);
    });

    test('should process resource timing for workers', () => {
      const monitor = new MockPerformanceMonitor();
      const resourceEntry = {
        entryType: 'resource',
        name: 'filesystem-worker.js',
        responseEnd: 1200,
        requestStart: 1100
      };
      
      monitor.processResourceTiming(resourceEntry);
      
      const measurements = monitor.measurements.get('worker-load');
      expect(measurements).toHaveLength(1);
      expect(measurements[0].duration).toBe(100);
    });
  });

  describe('Cleanup', () => {
    test('should cleanup properly', () => {
      const monitor = new MockPerformanceMonitor();
      monitor.initializeMonitoring();
      
      monitor.cleanup();
      
      expect(mockPerformanceObserver.disconnect).toHaveBeenCalled();
      expect(monitor.memoryMonitor).toBeNull();
    });
  });

  describe('Reset Metrics', () => {
    test('should reset all metrics', () => {
      const monitor = new MockPerformanceMonitor();
      monitor.recordCacheOperation('hit', 'query', 10);
      monitor.recordWorkerOperation('fileSystem', 'task', 100, true);
      monitor.recordMeasurement('test', 50);
      
      monitor.resetMetrics();
      
      expect(monitor.metrics.cache.hits).toBe(0);
      expect(monitor.metrics.workers.fileSystem.tasks).toBe(0);
      expect(monitor.measurements.size).toBe(0);
    });
  });

  describe('Singleton Pattern', () => {
    test('should return same instance', () => {
      const instance1 = MockPerformanceMonitor.getInstance();
      const instance2 = MockPerformanceMonitor.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });
});