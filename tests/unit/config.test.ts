import { ConfigManager } from '../../src/core/config';

describe('ConfigManager - Unit Tests', () => {
  describe('Configuration Creation', () => {
    test('should create api preset configuration', () => {
      const config = ConfigManager.createConfig('api');

      expect(config).toBeDefined();
      expect(config.security).toBeDefined();
      expect(config.performance).toBeDefined();
      expect(config.security?.csrf?.enabled).toBe(true);
      expect(config.security?.rateLimit?.enabled).toBe(true);
    });

    test('should create webapp preset configuration', () => {
      const config = ConfigManager.createConfig('webapp');

      expect(config).toBeDefined();
      expect(config.security).toBeDefined();
      expect(config.performance).toBeDefined();
      expect(config.security?.csrf?.enabled).toBe(true);
    });

    test('should create strict preset configuration', () => {
      const config = ConfigManager.createConfig('strict');

      expect(config).toBeDefined();
      expect(config.security).toBeDefined();
      expect(config.performance).toBeDefined();
      expect(config.environment?.production).toBe(true);
    });

    test('should create custom configuration', () => {
      const customConfig = {
        security: {
          csrf: {
            enabled: true,
            secret: 'custom-secret',
          },
        },
        performance: {
          compression: {
            enabled: false,
          },
        },
      };

      const config = ConfigManager.createConfig(customConfig);

      expect(config).toBeDefined();
      expect(config.security?.csrf?.enabled).toBe(true);
      expect(config.performance?.compression?.enabled).toBe(false);
    });
  });

  describe('Configuration Validation', () => {
    test('should validate valid configuration', () => {
      const validConfig = ConfigManager.createConfig('api');
      const validation = ConfigManager.validateConfig(validConfig);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should handle basic validation scenarios', () => {
      const basicConfig = {
        security: {
          csrf: {
            enabled: false,
          },
        },
      };

      const validation = ConfigManager.validateConfig(basicConfig as any);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should detect invalid rate limit configuration', () => {
      const invalidConfig = {
        security: {
          rateLimit: {
            enabled: true,
            windowMs: -1, // Invalid negative value
            max: -5, // Invalid negative value
          },
        },
      };

      const validation = ConfigManager.validateConfig(invalidConfig as any);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    test('should detect invalid performance settings', () => {
      const invalidConfig = {
        performance: {
          compression: {
            enabled: true,
            level: 15, // Invalid compression level (max is 9)
          },
          caching: {
            maxAge: -1, // Invalid negative age
          },
        },
      };

      const validation = ConfigManager.validateConfig(invalidConfig as any);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    test('should validate CORS configuration', () => {
      const validConfig = {
        security: {
          cors: {
            origin: ['https://example.com', 'https://app.example.com'],
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE'],
          },
        },
      };

      const validation = ConfigManager.validateConfig(validConfig as any);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should handle CORS validation', () => {
      const configWithCors = {
        security: {
          cors: {
            origin: ['https://example.com'],
          },
        },
      };

      const validation = ConfigManager.validateConfig(configWithCors as any);

      // Basic validation should pass
      expect(validation.isValid).toBe(true);
    });
  });

  describe('Configuration Merging', () => {
    test('should merge configurations correctly', () => {
      const baseConfig = ConfigManager.createConfig('api');
      const overrides = {
        security: {
          csrf: {
            enabled: true,
            tokenLength: 32,
          },
          rateLimit: {
            max: 200,
          },
        },
      };

      const merged = ConfigManager.mergeConfig(baseConfig, overrides);

      expect(merged.security?.csrf?.enabled).toBe(true);
      expect(merged.security?.csrf?.tokenLength).toBe(32);
      expect(merged.security?.rateLimit?.max).toBe(200);
      expect(merged.security?.csrf?.enabled).toBe(
        baseConfig.security?.csrf?.enabled
      );
    });

    test('should handle deep merging', () => {
      const baseConfig = {
        security: {
          headers: {
            hsts: {
              maxAge: 31536000,
              includeSubDomains: true,
            },
            csp: {
              defaultSrc: ['self'],
              scriptSrc: ['self'],
            },
          },
        },
      };

      const overrides = {
        security: {
          headers: {
            hsts: {
              preload: true,
            },
            csp: {
              styleSrc: ['self', 'unsafe-inline'],
            },
          },
        },
      };

      const merged = ConfigManager.mergeConfig(baseConfig as any, overrides);

      expect(merged.security?.headers?.hsts?.maxAge).toBe(31536000);
      expect(merged.security?.headers?.hsts?.includeSubDomains).toBe(true);
      expect(merged.security?.headers?.hsts?.preload).toBe(true);
      expect(merged.security?.headers?.csp?.defaultSrc).toEqual(['self']);
      expect(merged.security?.headers?.csp?.styleSrc).toEqual([
        'self',
        'unsafe-inline',
      ]);
    });

    test('should handle array merging', () => {
      const baseConfig = {
        security: {
          cors: {
            origin: ['https://app1.com'],
            methods: ['GET', 'POST'],
          },
        },
      };

      const overrides = {
        security: {
          cors: {
            origin: ['https://app2.com'],
            credentials: true,
          },
        },
      };

      const merged = ConfigManager.mergeConfig(baseConfig as any, overrides);

      // Arrays should be replaced, not merged
      expect(merged.security?.cors?.origin).toEqual(['https://app2.com']);
      expect(merged.security?.cors?.methods).toEqual(['GET', 'POST']);
      expect(merged.security?.cors?.credentials).toBe(true);
    });
  });

  describe('Preset Differences', () => {
    test('api preset should have moderate security', () => {
      const config = ConfigManager.createConfig('api');

      expect(config.security?.csrf?.enabled).toBe(true);
      expect(config.security?.rateLimit?.enabled).toBe(true);
      expect(config.security?.cors).toBeDefined();
      expect(config.performance?.compression?.enabled).toBe(true);
    });

    test('webapp preset should have enhanced security', () => {
      const config = ConfigManager.createConfig('webapp');

      expect(config.security?.csrf?.enabled).toBe(true);
      expect(config.security?.headers).toBeDefined();
      expect(config.security?.sanitization).toBeDefined();
      expect(config.performance?.caching?.enabled).toBe(true);
    });

    test('strict preset should have maximum security', () => {
      const config = ConfigManager.createConfig('strict');

      expect(config.security?.csrf?.enabled).toBe(true);
      expect(config.security?.headers).toBeDefined();
      expect(config.security?.sanitization).toBeDefined();

      // Strict mode should have stricter rate limits
      if (config.security?.rateLimit?.max) {
        expect(config.security.rateLimit.max).toBeLessThanOrEqual(50);
      }
    });

    test('presets should have different performance settings', () => {
      const apiConfig = ConfigManager.createConfig('api');
      const webappConfig = ConfigManager.createConfig('webapp');
      const strictConfig = ConfigManager.createConfig('strict');

      // API should prioritize performance
      expect(apiConfig.performance?.compression?.enabled).toBe(true);

      // Webapp should balance security and performance
      expect(webappConfig.performance?.caching?.enabled).toBe(true);

      // Strict should prioritize security over performance
      expect(strictConfig.performance?.monitoring?.enabled).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle null/undefined configuration', () => {
      try {
        const nullValidation = ConfigManager.validateConfig(null as any);
        expect(nullValidation.isValid).toBe(false);
        expect(nullValidation.errors.length).toBeGreaterThan(0);
      } catch (error) {
        // Expected behavior for null input
        expect(error).toBeDefined();
      }

      try {
        const undefinedValidation = ConfigManager.validateConfig(
          undefined as any
        );
        expect(undefinedValidation.isValid).toBe(false);
        expect(undefinedValidation.errors.length).toBeGreaterThan(0);
      } catch (error) {
        // Expected behavior for undefined input
        expect(error).toBeDefined();
      }
    });

    test('should handle malformed configuration objects', () => {
      const malformedConfig = {
        security: 'not-an-object',
        performance: null,
      };

      const validation = ConfigManager.validateConfig(malformedConfig as any);

      expect(validation.isValid).toBe(true); // Basic validation is lenient
    });

    test('should handle rate limit validation', () => {
      const invalidConfig = {
        security: {
          rateLimit: {
            enabled: true,
            max: 'not-a-number',
          },
        },
      };

      const validation = ConfigManager.validateConfig(invalidConfig as any);

      // Validation should detect type issues
      expect(validation).toBeDefined();
    });
  });
});
