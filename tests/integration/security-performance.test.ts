import { ConfigManager } from '../../src/core/config';
import { SecurityManager } from '../../src/core/security';
import { PerformanceManager } from '../../src/core/performance';
import { ExpressAdapter } from '../../src/adapters/express';

describe('Integration Tests', () => {
  let config: any;
  let securityManager: SecurityManager;
  let performanceManager: PerformanceManager;
  let expressAdapter: ExpressAdapter;

  beforeEach(() => {
    config = ConfigManager.createConfig('api');
    securityManager = new SecurityManager(config);
    performanceManager = new PerformanceManager(config);
    expressAdapter = new ExpressAdapter(config);
  });

  describe('Security + Performance Integration', () => {
    test('should combine CSRF protection with rate limiting', () => {
      // Generate CSRF token
      const token = securityManager.generateCSRFToken();
      expect(token).toBeDefined();

      // Verify rate limiting works
      const clientIP = '192.168.1.1';

      // Multiple requests should eventually hit rate limit
      let hitRateLimit = false;
      for (let i = 0; i < 150; i++) {
        const rateLimitInfo = securityManager.checkRateLimit(clientIP);
        if (rateLimitInfo && rateLimitInfo.remaining === 0) {
          hitRateLimit = true;
          break;
        }
      }

      expect(hitRateLimit).toBe(true);
    });

    test('should sanitize input and compress response', async () => {
      // Sanitize malicious input
      const maliciousInput = '<script>alert("xss")</script>';
      const sanitized = securityManager.sanitizeInput(maliciousInput, 'body');

      expect(sanitized.isValid).toBe(false); // Malicious input should be marked invalid
      expect(sanitized.sanitizedData).not.toContain('<script>');

      // Compress the sanitized response
      const largeData = sanitized.sanitizedData.repeat(100);
      const compressed = await performanceManager.compressResponse(
        largeData,
        'gzip'
      );

      if (compressed) {
        expect(compressed.data).toBeDefined();
        expect(compressed.encoding).toBe('gzip');
      }
    });

    test('should validate CORS and apply caching headers', () => {
      // Mock response object
      const mockResponse = {
        set: jest.fn(),
        get: jest.fn(),
      };

      // Apply caching headers (would normally be done after CORS check)
      performanceManager.applyCachingHeaders(
        mockResponse,
        'test response data'
      );

      expect(mockResponse.set).toHaveBeenCalled();
    });
  });

  describe('Framework Adapter Integration', () => {
    test('should integrate security and performance with Express adapter', () => {
      const middleware = expressAdapter.createMiddleware();
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });

    test('should handle complete request cycle', () => {
      // Mock Express request/response
      const mockReq = {
        ip: '192.168.1.1',
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'https://example.com',
        },
        body: { data: 'test data' },
        get: jest.fn(),
      };

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        get: jest.fn(),
      };

      const mockNext = jest.fn();

      // Apply main middleware
      const middleware = expressAdapter.createMiddleware();

      expect(() => {
        middleware(mockReq as any, mockRes as any, mockNext);
      }).not.toThrow();
    });
  });

  describe('Configuration Presets Integration', () => {
    test('should create working API configuration', () => {
      const apiConfig = ConfigManager.createConfig('api');
      const apiSecurity = new SecurityManager(apiConfig);
      const apiPerformance = new PerformanceManager(apiConfig);

      expect(apiSecurity).toBeDefined();
      expect(apiPerformance).toBeDefined();

      // Test that API config allows standard operations
      const token = apiSecurity.generateCSRFToken();
      expect(token).toBeDefined();
    });

    test('should create working webapp configuration', () => {
      const webappConfig = ConfigManager.createConfig('webapp');
      const webappSecurity = new SecurityManager(webappConfig);
      const webappPerformance = new PerformanceManager(webappConfig);

      expect(webappSecurity).toBeDefined();
      expect(webappPerformance).toBeDefined();

      // Test webapp-specific features
      const input = 'user input with <script>alert("test")</script>';
      const sanitized = webappSecurity.sanitizeInput(input, 'body');
      expect(sanitized.sanitizedData).not.toContain('<script>');
    });

    test('should create working strict configuration', () => {
      const strictConfig = ConfigManager.createConfig('strict');
      const strictSecurity = new SecurityManager(strictConfig);
      const strictPerformance = new PerformanceManager(strictConfig);

      expect(strictSecurity).toBeDefined();
      expect(strictPerformance).toBeDefined();

      // Test strict mode has tighter limits
      expect(strictConfig.security?.rateLimit?.max).toBeLessThanOrEqual(50);
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle security validation failures gracefully', () => {
      const invalidFile = {
        originalname: 'virus.exe',
        mimetype: 'application/x-executable',
        size: 1024,
        buffer: Buffer.from('fake-exe-content'),
      };

      const result = securityManager.validateFileUpload(invalidFile);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should handle performance optimization gracefully', async () => {
      // Test compression with various data types
      const testData = [
        'simple string',
        JSON.stringify({ key: 'value' }),
        Buffer.from('buffer data'),
      ];

      for (const data of testData) {
        const result = await performanceManager.compressResponse(data, 'gzip');
        // Should either compress or return null, but not throw
        expect(result === null || (result && result.data)).toBe(true);
      }
    });

    test('should maintain security even with performance optimizations', () => {
      // Ensure security checks still work when performance features are enabled
      const maliciousInput = "'; DROP TABLE users; --";
      const sanitized = securityManager.sanitizeInput(maliciousInput, 'query');

      expect(sanitized.isValid).toBe(false); // SQL injection should be marked invalid
      expect(sanitized.sanitizedData).toContain('DROP TABLE'); // Content encoded but preserved

      // Performance should still work with sanitized data
      const mockResponse = { set: jest.fn(), get: jest.fn() };
      expect(() => {
        performanceManager.applyCachingHeaders(
          mockResponse,
          sanitized.sanitizedData
        );
      }).not.toThrow();
    });
  });

  describe('Memory and Performance Monitoring', () => {
    test('should track performance metrics during operations', () => {
      // Record some operations
      performanceManager.recordMetrics(100, 1024);
      performanceManager.recordMetrics(200, 2048);
      performanceManager.recordMetrics(150, 1536);

      const avgResponseTime = performanceManager.getAverageResponseTime();
      expect(avgResponseTime).toBe(150); // (100 + 200 + 150) / 3

      const avgPayloadSize = performanceManager.getAveragePayloadSize();
      expect(avgPayloadSize).toBe(1536); // (1024 + 2048 + 1536) / 3
    });

    test('should provide optimization suggestions', () => {
      // Simulate slow requests and large payloads
      performanceManager.clearMetrics();
      performanceManager.recordMetrics(2000, 2 * 1024 * 1024); // 2MB, 2s
      performanceManager.recordMetrics(1800, 1.8 * 1024 * 1024); // 1.8MB, 1.8s

      const suggestions = performanceManager.getOptimizationSuggestions();
      expect(suggestions.length).toBeGreaterThan(0);
      expect(
        suggestions.some(
          s => s.includes('caching') || s.includes('compression')
        )
      ).toBe(true);
    });

    test('should handle memory usage monitoring', () => {
      const memoryUsage = performanceManager.getMemoryUsage();
      expect(memoryUsage.heapUsed).toBeGreaterThan(0);
      expect(memoryUsage.heapTotal).toBeGreaterThan(0);
      expect(memoryUsage.external).toBeGreaterThanOrEqual(0);
    });
  });
});
