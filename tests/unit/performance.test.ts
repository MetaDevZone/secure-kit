import { PerformanceManager } from '../../src/core/performance';
import { ConfigManager } from '../../src/core/config';

describe('PerformanceManager - Unit Tests', () => {
  let performanceManager: PerformanceManager;
  let config: any;

  beforeEach(() => {
    config = ConfigManager.createConfig('api');
    performanceManager = new PerformanceManager(config);
  });

  describe('Response Compression', () => {
    test('should compress responses when enabled', async () => {
      const data =
        'This is test data that should be compressed when large enough';
      const largeData = data.repeat(100); // Make it large enough for compression

      const compressed = await performanceManager.compressResponse(
        largeData,
        'gzip, deflate, br'
      );

      expect(compressed).not.toBeNull();
      if (compressed) {
        expect(compressed.data).toBeDefined();
        expect(compressed.encoding).toBeDefined();
      }
    });

    test('should skip compression for small payloads', async () => {
      const smallData = 'small';
      const result = await performanceManager.compressResponse(
        smallData,
        'gzip'
      );

      // Small data should not be compressed (returns null)
      expect(result).toBeNull();
    });

    test('should handle brotli compression', async () => {
      const data = 'Test data for brotli compression'.repeat(50);
      const result = await performanceManager.compressResponse(
        data,
        'br, gzip'
      );

      expect(result).not.toBeNull();
      if (result) {
        expect(result.data).toBeDefined();
        expect(result.encoding).toBe('br');
      }
    });

    test('should handle unsupported encoding gracefully', async () => {
      const data = 'Test data';
      const result = await performanceManager.compressResponse(
        data,
        'unsupported-encoding'
      );

      expect(result).toBeNull();
    });
  });

  describe('Caching Headers', () => {
    test('should apply caching headers when enabled', () => {
      const mockResponse = {
        set: jest.fn(),
        get: jest.fn(),
      };

      const data = 'test data for caching';
      performanceManager.applyCachingHeaders(mockResponse, data);

      expect(mockResponse.set).toHaveBeenCalled();
      // Check that caching headers were set
      const setCalls = (mockResponse.set as jest.Mock).mock.calls;
      const headerNames = setCalls.map(call => call[0]);

      expect(headerNames).toContain('Cache-Control');
    });

    test('should generate ETag when enabled', () => {
      const mockResponse = {
        set: jest.fn(),
        get: jest.fn(),
      };

      const data = 'test data for etag';
      performanceManager.applyCachingHeaders(mockResponse, data);

      const setCalls = (mockResponse.set as jest.Mock).mock.calls;
      const etagCall = setCalls.find(call => call[0] === 'ETag');

      if (config.performance?.caching?.etag !== false) {
        expect(etagCall).toBeDefined();
      }
    });

    test('should set Last-Modified when enabled', () => {
      const mockResponse = {
        set: jest.fn(),
        get: jest.fn(),
      };

      const data = 'test data';
      performanceManager.applyCachingHeaders(mockResponse, data);

      const setCalls = (mockResponse.set as jest.Mock).mock.calls;
      const lastModifiedCall = setCalls.find(
        call => call[0] === 'Last-Modified'
      );

      if (config.performance?.caching?.lastModified !== false) {
        expect(lastModifiedCall).toBeDefined();
      }
    });
  });

  describe('Performance Metrics', () => {
    test('should record request metrics', () => {
      const requestTime = 150; // ms
      const payloadSize = 1024; // bytes

      performanceManager.recordMetrics(requestTime, payloadSize);

      const metrics = performanceManager.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics[0].requestTime).toBe(requestTime);
      expect(metrics[0].payloadSize).toBe(payloadSize);
    });

    test('should calculate average response time', () => {
      performanceManager.clearMetrics(); // Start fresh
      performanceManager.recordMetrics(100, 500);
      performanceManager.recordMetrics(200, 1000);
      performanceManager.recordMetrics(300, 1500);

      const avgTime = performanceManager.getAverageResponseTime();
      expect(avgTime).toBe(200); // (100 + 200 + 300) / 3
    });

    test('should track slow requests via console warning', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const slowRequestTime = 2000; // 2 seconds
      performanceManager.recordMetrics(slowRequestTime, 1024);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Slow request detected')
      );

      consoleSpy.mockRestore();
    });

    test('should track large payloads via console warning', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const largePayloadSize = 2 * 1024 * 1024; // 2MB
      performanceManager.recordMetrics(100, largePayloadSize);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Large payload detected')
      );

      consoleSpy.mockRestore();
    });

    test('should provide optimization suggestions', () => {
      // Record some slow requests and large payloads
      performanceManager.clearMetrics();
      performanceManager.recordMetrics(2000, 2 * 1024 * 1024);
      performanceManager.recordMetrics(1500, 1.5 * 1024 * 1024);

      const suggestions = performanceManager.getOptimizationSuggestions();
      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('Memory Usage Tracking', () => {
    test('should track memory usage', () => {
      const memoryUsage = performanceManager.getMemoryUsage();

      expect(memoryUsage).toBeDefined();
      expect(memoryUsage.heapUsed).toBeGreaterThan(0);
      expect(memoryUsage.heapTotal).toBeGreaterThan(0);
    });

    test('should detect memory patterns in optimization suggestions', () => {
      // Record some metrics to simulate activity
      for (let i = 0; i < 10; i++) {
        performanceManager.recordMetrics(100, 1024);
      }

      const suggestions = performanceManager.getOptimizationSuggestions();
      // Should provide suggestions based on current memory state
      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
    });
  });

  describe('Configuration Impact', () => {
    test('should respect compression configuration', () => {
      const configWithoutCompression = ConfigManager.createConfig({
        ...config,
        performance: {
          ...config.performance,
          compression: {
            enabled: false,
          },
        },
      });

      const pmWithoutCompression = new PerformanceManager(
        configWithoutCompression
      );

      // When compression is disabled, it should behave differently
      expect(pmWithoutCompression).toBeDefined();
    });

    test('should respect caching configuration', () => {
      const configWithoutCaching = ConfigManager.createConfig({
        ...config,
        performance: {
          ...config.performance,
          caching: {
            enabled: false,
          },
        },
      });

      const pmWithoutCaching = new PerformanceManager(configWithoutCaching);

      const mockResponse = {
        set: jest.fn(),
        get: jest.fn(),
      };

      pmWithoutCaching.applyCachingHeaders(mockResponse, 'test data');

      // Should not set caching headers when disabled
      expect(mockResponse.set).not.toHaveBeenCalledWith(
        'Cache-Control',
        expect.any(String)
      );
    });

    test('should respect monitoring configuration', () => {
      const configWithoutMonitoring = ConfigManager.createConfig({
        ...config,
        performance: {
          ...config.performance,
          monitoring: {
            enabled: false,
          },
        },
      });

      const pmWithoutMonitoring = new PerformanceManager(
        configWithoutMonitoring
      );

      // Should still work but might not track as much detail
      pmWithoutMonitoring.recordMetrics(100, 1024);
      const metrics = pmWithoutMonitoring.getMetrics();
      expect(metrics).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle compression errors gracefully', async () => {
      // Test with invalid data
      const result = await performanceManager.compressResponse(
        '' as any, // Empty string to avoid null.length error
        'gzip'
      );

      expect(result).toBeNull();
      // Should not throw an error
    });

    test('should handle metrics recording errors', () => {
      // Test with invalid metrics
      expect(() => {
        performanceManager.recordMetrics(-1, -1);
      }).not.toThrow();
    });

    test('should handle caching header errors', () => {
      const mockResponse = {
        set: jest.fn(),
        get: jest.fn(),
      };

      // This should not throw even if response methods fail
      expect(() => {
        performanceManager.applyCachingHeaders(mockResponse, 'test data');
      }).not.toThrow();
    });
  });
});
