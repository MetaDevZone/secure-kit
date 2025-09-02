import { PerformanceManager } from '../../src/core/performance';
import { SecureBackendConfig } from '../../src/types';

describe('PerformanceManager', () => {
  let performanceManager: PerformanceManager;
  let config: SecureBackendConfig;

  beforeEach(() => {
    config = {
      performance: {
        compression: {
          enabled: true,
          threshold: 100,
          level: 6,
          brotli: true,
        },
        caching: {
          enabled: true,
          maxAge: 3600,
          etag: true,
          lastModified: true,
        },
        monitoring: {
          enabled: true,
          logSlowRequests: true,
          slowRequestThreshold: 1000,
          logLargePayloads: true,
          largePayloadThreshold: 1024 * 1024,
        },
      },
    } as SecureBackendConfig;

    performanceManager = new PerformanceManager(config);
  });

  describe('Compression', () => {
    it('should compress gzip responses', async () => {
      const data = 'a'.repeat(200); // Above threshold
      const acceptEncoding = 'gzip';

      const result = await performanceManager.compressResponse(
        data,
        acceptEncoding
      );

      expect(result).toBeDefined();
      expect(result?.encoding).toBe('gzip');
      expect(result?.data.length).toBeLessThan(data.length);
    });

    it('should compress brotli responses', async () => {
      const data = 'a'.repeat(200);
      const acceptEncoding = 'br';

      const result = await performanceManager.compressResponse(
        data,
        acceptEncoding
      );

      expect(result).toBeDefined();
      expect(result?.encoding).toBe('br');
      expect(result?.data.length).toBeLessThan(data.length);
    });

    it('should not compress data below threshold', async () => {
      const data = 'a'.repeat(50); // Below threshold
      const acceptEncoding = 'gzip';

      const result = await performanceManager.compressResponse(
        data,
        acceptEncoding
      );

      expect(result).toBeNull();
    });

    it('should handle no compression preference', async () => {
      const data = 'a'.repeat(200);
      const acceptEncoding = '';

      const result = await performanceManager.compressResponse(
        data,
        acceptEncoding
      );

      expect(result).toBeNull();
    });
  });

  describe('Caching', () => {
    it('should generate ETags', () => {
      const data = { message: 'Hello World' };
      const etag = performanceManager.generateETag(JSON.stringify(data));

      expect(etag).toBeDefined();
      expect(etag).toMatch(/^"test-hash-\d+"$/); // Matches mocked hash format
    });

    it('should generate Last-Modified headers', () => {
      const lastModified = performanceManager.generateLastModified();

      expect(lastModified).toBeDefined();
      expect(new Date(lastModified).getTime()).toBeGreaterThan(0);
    });

    it('should apply caching headers', () => {
      const mockResponse = {
        set: jest.fn().mockReturnThis(),
      } as any;

      const data = { message: 'Hello World' };
      performanceManager.applyCachingHeaders(
        mockResponse,
        JSON.stringify(data)
      );

      expect(mockResponse.set).toHaveBeenCalledWith('ETag', expect.any(String));
      expect(mockResponse.set).toHaveBeenCalledWith(
        'Last-Modified',
        expect.any(String)
      );
      expect(mockResponse.set).toHaveBeenCalledWith(
        'Cache-Control',
        expect.stringContaining('max-age=3600')
      );
    });
  });

  describe('Response Optimization', () => {
    it('should optimize JSON responses', () => {
      const data = { message: 'Hello World', timestamp: Date.now() };
      const result = performanceManager.optimizeResponse(data);

      expect(result.data).toBeDefined();
      expect(result.size).toBeGreaterThan(0);
    });

    it('should handle string responses', () => {
      const data = 'Hello World';
      const result = performanceManager.optimizeResponse(data);

      expect(result.data).toBe(data);
      expect(result.size).toBe(data.length);
    });
  });

  describe('Metrics', () => {
    it('should record response metrics', () => {
      const duration = 150;
      const payloadSize = 1024;

      performanceManager.recordMetrics(duration, payloadSize);

      const metrics = performanceManager.getMetrics();
      expect(metrics.length).toBe(1);
      expect(metrics[0].requestTime).toBe(duration);
      expect(metrics[0].payloadSize).toBe(payloadSize);
    });

    it('should calculate average response time', () => {
      performanceManager.recordMetrics(100, 512);
      performanceManager.recordMetrics(200, 1024);

      const avgTime = performanceManager.getAverageResponseTime();
      expect(avgTime).toBe(150);
    });

    it('should calculate average payload size', () => {
      performanceManager.recordMetrics(100, 512);
      performanceManager.recordMetrics(200, 1024);

      const avgSize = performanceManager.getAveragePayloadSize();
      expect(avgSize).toBe(768);
    });

    it('should get memory usage', () => {
      const memoryUsage = performanceManager.getMemoryUsage();

      expect(memoryUsage).toHaveProperty('heapUsed');
      expect(memoryUsage).toHaveProperty('heapTotal');
      expect(memoryUsage).toHaveProperty('external');
      expect(memoryUsage).toHaveProperty('rss');
    });

    it('should provide optimization suggestions', () => {
      // Record slow responses to trigger suggestions
      performanceManager.recordMetrics(2000, 1024);

      const suggestions = performanceManager.getOptimizationSuggestions();

      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('Cache Management', () => {
    it('should manage compression cache', () => {
      const initialSize = performanceManager.getCompressionCacheSize();

      // This should populate the cache
      performanceManager.compressResponse('a'.repeat(200), 'gzip');

      const newSize = performanceManager.getCompressionCacheSize();
      expect(newSize).toBeGreaterThanOrEqual(initialSize);
    });

    it('should clear compression cache', () => {
      performanceManager.compressResponse('a'.repeat(200), 'gzip');
      performanceManager.clearCompressionCache();

      expect(performanceManager.getCompressionCacheSize()).toBe(0);
    });

    it('should clear metrics', () => {
      performanceManager.recordMetrics(100, 512);
      expect(performanceManager.getMetrics().length).toBe(1);

      performanceManager.clearMetrics();
      expect(performanceManager.getMetrics().length).toBe(0);
    });
  });

  describe('Database Safety', () => {
    it('should create query timeout promises', async () => {
      const timeoutPromise = performanceManager.createQueryTimeout(100);

      await expect(timeoutPromise).rejects.toThrow('Query timeout after 100ms');
    });

    it('should monitor connection pools', () => {
      const mockPool = {
        used: 8,
        size: 10,
      };

      // Should not throw
      expect(() => {
        performanceManager.monitorConnectionPool(mockPool);
      }).not.toThrow();
    });
  });
});
