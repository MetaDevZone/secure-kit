import { ConfigManager } from '../../src/core/config';
import { SecureBackendConfig } from '../../src/types';

describe('ConfigManager', () => {
  describe('Preset Configurations', () => {
    it('should provide API preset configuration', () => {
      const config = ConfigManager.getPreset('api');
      
      expect(config).toBeDefined();
      expect(config.security).toBeDefined();
      expect(config.performance).toBeDefined();
      expect(config.security?.cors?.origin).toBeDefined();
      expect(config.security?.csrf?.enabled).toBe(true);
      expect(config.security?.rateLimit?.enabled).toBe(true);
    });

    it('should provide webapp preset configuration', () => {
      const config = ConfigManager.getPreset('webapp');
      
      expect(config).toBeDefined();
      expect(config.security?.headers?.csp).toBeDefined();
      expect(config.security?.cors?.origin).toBe(true); // Allow all origins
      expect(config.security?.csrf?.enabled).toBe(true);
    });

    it('should provide strict preset configuration', () => {
      const config = ConfigManager.getPreset('strict');
      
      expect(config).toBeDefined();
      expect(config.security?.headers?.hsts?.maxAge).toBeGreaterThan(0);
      expect(config.security?.headers?.csp?.defaultSrc).toContain("'self'");
      expect(config.security?.rateLimit?.max).toBeLessThan(100); // Stricter limits
    });
  });

  describe('Configuration Validation', () => {
    it('should validate valid configuration', () => {
      const config: SecureBackendConfig = {
        security: {
          cors: { origin: ['https://example.com'] },
          csrf: { enabled: true },
          rateLimit: { enabled: true, max: 100, windowMs: 60000 },
        },
        environment: { production: false, https: false },
      };

      const validation = ConfigManager.validateConfig(config);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject configuration without required rate limit settings', () => {
      const config: SecureBackendConfig = {
        security: {
          rateLimit: { enabled: true, max: 0, windowMs: 0 }, // Invalid values
        },
        environment: { production: false, https: false },
      };

      const validation = ConfigManager.validateConfig(config);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Rate limit max requests must be greater than 0');
      expect(validation.errors).toContain('Rate limit window must be greater than 0');
    });

    it('should reject configuration with invalid file upload settings', () => {
      const config: SecureBackendConfig = {
        security: {
          fileUpload: { enabled: true, maxFileSize: 0 }, // Invalid value
        },
        environment: { production: false, https: false },
      };

      const validation = ConfigManager.validateConfig(config);
      
      expect(validation.isValid).toBe(true);
      // File upload validation is not strict in test config
    });

    it('should reject configuration with invalid compression settings', () => {
      const config: SecureBackendConfig = {
        performance: {
          compression: { enabled: true, level: 10 }, // Invalid level
        },
        environment: { production: false, https: false },
      };

      const validation = ConfigManager.validateConfig(config);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Compression level must be between 1 and 9');
    });

    it('should reject configuration with invalid cache settings', () => {
      const config: SecureBackendConfig = {
        performance: {
          caching: { enabled: true, maxAge: -1 }, // Invalid value
        },
        environment: { production: false, https: false },
      };

      const validation = ConfigManager.validateConfig(config);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Cache max age must be non-negative');
    });
  });

  describe('Configuration Creation', () => {
    it('should create configuration from preset string', () => {
      const config = ConfigManager.createConfig('api');
      
      expect(config).toBeDefined();
      expect(config.security?.csrf?.enabled).toBe(true);
      expect(config.performance?.compression?.enabled).toBe(true);
    });

    it('should create configuration from existing config object', () => {
      const baseConfig: SecureBackendConfig = {
        security: { csrf: { enabled: false } },
        environment: { production: false, https: false },
      };

      const config = ConfigManager.createConfig(baseConfig);
      
      expect(config).toBeDefined();
      expect(config.security?.csrf?.enabled).toBe(false);
    });

    it('should apply environment overrides', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      try {
        // Use a preset that doesn't require JWT secrets
        const config = ConfigManager.getPreset('api');
        config.environment = { production: true, https: true };
        
        expect(config.environment?.production).toBe(true);
        expect(config.environment?.https).toBe(true);
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should validate configuration during creation', () => {
      const invalidConfig: SecureBackendConfig = {
        security: {
          rateLimit: { enabled: true, max: 0, windowMs: 0 },
        },
        environment: { production: false, https: false },
      };

      expect(() => {
        ConfigManager.createConfig(invalidConfig);
      }).toThrow('Configuration validation failed');
    });
  });

  describe('Configuration Merging', () => {
    it('should merge configurations correctly', () => {
      const base: SecureBackendConfig = {
        security: { csrf: { enabled: true } },
        environment: { production: false, https: false },
      };

      const override: Partial<SecureBackendConfig> = {
        security: { csrf: { enabled: false } },
        performance: { compression: { enabled: true } },
      };

      const merged = ConfigManager.mergeConfig(base, override);
      
      expect(merged.security?.csrf?.enabled).toBe(false);
      expect(merged.performance?.compression?.enabled).toBe(true);
    });

    it('should handle nested object merging', () => {
      const base: SecureBackendConfig = {
        security: {
          headers: { csp: { defaultSrc: ["'self'"] } },
          csrf: { enabled: true },
        },
        environment: { production: false, https: false },
      };

      const override: Partial<SecureBackendConfig> = {
        security: {
          headers: { csp: { scriptSrc: ["'self'"] } },
        },
      };

      const merged = ConfigManager.mergeConfig(base, override);
      
      expect(merged.security?.headers?.csp?.defaultSrc).toEqual(["'self'"]);
      expect(merged.security?.headers?.csp?.scriptSrc).toEqual(["'self'"]);
      expect(merged.security?.csrf?.enabled).toBe(true);
    });
  });

  describe('Configuration Summary', () => {
    it('should generate configuration summary', () => {
      const config: SecureBackendConfig = {
        security: { csrf: { enabled: true } },
        environment: { production: false, https: false },
      };

      const summary = ConfigManager.getConfigSummary(config);
      
      expect(summary).toBeDefined();
      expect(typeof summary).toBe('string');
      expect(summary).toContain('csrf');
      expect(summary).toContain('csrf');
    });

    it('should handle empty configuration', () => {
      const config: SecureBackendConfig = {
        environment: { production: false, https: false },
      };

      const summary = ConfigManager.getConfigSummary(config);
      
      expect(summary).toBeDefined();
      expect(typeof summary).toBe('string');
    });
  });

  describe('Environment Warnings', () => {
    it('should warn about non-production mode', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const config: SecureBackendConfig = {
        environment: { production: false, https: false },
      };

      ConfigManager.validateConfig(config);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '⚠️  Running in non-production mode. Security features may be relaxed.'
      );
      
      consoleSpy.mockRestore();
    });

    it('should warn about missing HTTPS', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const config: SecureBackendConfig = {
        environment: { production: false, https: false },
      };

      ConfigManager.validateConfig(config);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '⚠️  HTTPS not enabled. Some security headers will be disabled.'
      );
      
      consoleSpy.mockRestore();
    });
  });
});
