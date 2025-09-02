import type { SecureBackendConfig } from '../types';

export class ConfigManager {
  private static readonly PRESETS = {
    api: {
      security: {
        headers: {
          csp: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
          },
          referrerPolicy: 'strict-origin-when-cross-origin',
          xContentTypeOptions: true,
          xFrameOptions: 'DENY',
          permissionsPolicy: {
            camera: ['()'],
            microphone: ['()'],
            geolocation: ['()'],
            payment: ['()'],
          },
          crossOriginResourcePolicy: 'same-origin',
          crossOriginEmbedderPolicy: 'require-corp',
          crossOriginOpenerPolicy: 'same-origin',
        },
        cors: {
          origin: false, // Disable CORS for API
          credentials: false,
        },
        csrf: {
          enabled: true,
          tokenLength: 32,
          cookieName: 'csrf-token',
          headerName: 'X-CSRF-Token',
          excludedMethods: ['GET', 'HEAD', 'OPTIONS'],
        },
        rateLimit: {
          enabled: true,
          windowMs: 15 * 60 * 1000, // 15 minutes
          max: 100, // limit each IP to 100 requests per windowMs
          message: 'Too many requests from this IP',
          statusCode: 429,
        },
        sanitization: {
          enabled: true,
          xss: true,
          sqlInjection: true,
          noSqlInjection: true,
          maxBodySize: 1024 * 1024, // 1MB
          maxQuerySize: 1024, // 1KB
        },
        auth: {
          jwt: {
            algorithms: ['HS256', 'RS256'],
            maxAge: 3600, // 1 hour
          },
        },
        fileUpload: {
          enabled: true,
          maxFileSize: 5 * 1024 * 1024, // 5MB
          allowedMimeTypes: [
            'image/jpeg',
            'image/png',
            'image/gif',
            'application/pdf',
          ],
          allowedExtensions: ['jpg', 'jpeg', 'png', 'gif', 'pdf'],
          stripMetadata: true,
        },
      },
      performance: {
        compression: {
          enabled: true,
          threshold: 1024, // 1KB
          level: 6,
          brotli: true,
        },
        caching: {
          enabled: true,
          maxAge: 300, // 5 minutes for API
          etag: true,
          lastModified: true,
        },
        monitoring: {
          enabled: true,
          logSlowRequests: true,
          slowRequestThreshold: 1000, // 1 second
          logLargePayloads: true,
          largePayloadThreshold: 1024 * 1024, // 1MB
        },
      },
      logging: {
        enabled: true,
        level: 'info',
        format: 'json',
        suspiciousRequests: true,
        failedLogins: true,
        rateLimitViolations: true,
      },
      environment: {
        production: process.env.NODE_ENV === 'production',
        https: process.env.NODE_ENV === 'production',
      },
    },
    webapp: {
      security: {
        headers: {
          csp: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'"],
            fontSrc: ["'self'", 'https://fonts.gstatic.com'],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'self'"],
          },
          referrerPolicy: 'strict-origin-when-cross-origin',
          xContentTypeOptions: true,
          xFrameOptions: 'SAMEORIGIN',
          permissionsPolicy: {
            camera: ['()'],
            microphone: ['()'],
            geolocation: ['()'],
            payment: ['()'],
          },
          crossOriginResourcePolicy: 'same-site',
          crossOriginEmbedderPolicy: 'credentialless',
          crossOriginOpenerPolicy: 'same-origin-allow-popups',
        },
        cors: {
          origin: true, // Allow all origins for webapp
          credentials: true,
          methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        },
        csrf: {
          enabled: true,
          tokenLength: 32,
          cookieName: 'csrf-token',
          headerName: 'X-CSRF-Token',
          excludedMethods: ['GET', 'HEAD', 'OPTIONS'],
        },
        rateLimit: {
          enabled: true,
          windowMs: 15 * 60 * 1000,
          max: 200,
          message: 'Too many requests from this IP',
          statusCode: 429,
        },
        sanitization: {
          enabled: true,
          xss: true,
          sqlInjection: true,
          noSqlInjection: true,
          maxBodySize: 10 * 1024 * 1024, // 10MB
          maxQuerySize: 2048, // 2KB
        },
        auth: {
          jwt: {
            algorithms: ['HS256', 'RS256'],
            maxAge: 24 * 3600, // 24 hours
          },
          session: {
            maxAge: 24 * 3600 * 1000, // 24 hours
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
          },
        },
        fileUpload: {
          enabled: true,
          maxFileSize: 10 * 1024 * 1024, // 10MB
          allowedMimeTypes: [
            'image/jpeg',
            'image/png',
            'image/gif',
            'application/pdf',
            'text/plain',
          ],
          allowedExtensions: ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'txt'],
          stripMetadata: true,
        },
      },
      performance: {
        compression: {
          enabled: true,
          threshold: 512, // 512B
          level: 6,
          brotli: true,
        },
        caching: {
          enabled: true,
          maxAge: 3600, // 1 hour for webapp
          etag: true,
          lastModified: true,
        },
        monitoring: {
          enabled: true,
          logSlowRequests: true,
          slowRequestThreshold: 2000, // 2 seconds
          logLargePayloads: true,
          largePayloadThreshold: 5 * 1024 * 1024, // 5MB
        },
      },
      logging: {
        enabled: true,
        level: 'info',
        format: 'text',
        suspiciousRequests: true,
        failedLogins: true,
        rateLimitViolations: true,
      },
      environment: {
        production: process.env.NODE_ENV === 'production',
        https: process.env.NODE_ENV === 'production',
      },
    },
    strict: {
      security: {
        headers: {
          hsts: {
            maxAge: 31536000, // 1 year
            includeSubDomains: true,
            preload: true,
          },
          csp: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'"],
            imgSrc: ["'self'"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'none'"],
            frameSrc: ["'none'"],
            reportUri: '/csp-report',
          },
          referrerPolicy: 'no-referrer',
          xContentTypeOptions: true,
          xFrameOptions: 'DENY',
          permissionsPolicy: {
            camera: ['()'],
            microphone: ['()'],
            geolocation: ['()'],
            payment: ['()'],
            usb: ['()'],
            magnetometer: ['()'],
            gyroscope: ['()'],
            accelerometer: ['()'],
          },
          crossOriginResourcePolicy: 'same-origin',
          crossOriginEmbedderPolicy: 'require-corp',
          crossOriginOpenerPolicy: 'same-origin',
        },
        cors: {
          origin: false, // Disable CORS completely
          credentials: false,
        },
        csrf: {
          enabled: true,
          tokenLength: 64,
          cookieName: 'csrf-token',
          headerName: 'X-CSRF-Token',
          excludedMethods: ['GET', 'HEAD', 'OPTIONS'],
          cookieOptions: {
            httpOnly: true,
            secure: true,
            sameSite: 'strict',
            maxAge: 3600,
          },
        },
        rateLimit: {
          enabled: true,
          windowMs: 15 * 60 * 1000,
          max: 50, // Very strict rate limiting
          message: 'Rate limit exceeded',
          statusCode: 429,
        },
        sanitization: {
          enabled: true,
          xss: true,
          sqlInjection: true,
          noSqlInjection: true,
          maxBodySize: 1024 * 1024, // 1MB
          maxQuerySize: 512, // 512B
        },
        auth: {
          jwt: {
            algorithms: ['RS256'], // Only asymmetric algorithms
            maxAge: 1800, // 30 minutes
          },
          session: {
            maxAge: 1800 * 1000, // 30 minutes
            httpOnly: true,
            secure: true,
            sameSite: 'strict',
          },
        },
        fileUpload: {
          enabled: false, // Disable file uploads in strict mode
        },
      },
      performance: {
        compression: {
          enabled: true,
          threshold: 1024,
          level: 9, // Maximum compression
          brotli: true,
        },
        caching: {
          enabled: true,
          maxAge: 60, // 1 minute for strict mode
          etag: true,
          lastModified: true,
        },
        monitoring: {
          enabled: true,
          logSlowRequests: true,
          slowRequestThreshold: 500, // 500ms
          logLargePayloads: true,
          largePayloadThreshold: 512 * 1024, // 512KB
        },
      },
      logging: {
        enabled: true,
        level: 'warn',
        format: 'json',
        suspiciousRequests: true,
        failedLogins: true,
        rateLimitViolations: true,
      },
      environment: {
        production: true, // Force production mode
        https: true, // Force HTTPS
      },
    },
  };

  static getPreset(preset: 'api' | 'webapp' | 'strict'): SecureBackendConfig {
    return this.PRESETS[preset] as SecureBackendConfig;
  }

  static mergeConfig(
    base: SecureBackendConfig,
    override: Partial<SecureBackendConfig>
  ): SecureBackendConfig {
    return this.deepMerge(base, override);
  }

  static validateConfig(config: SecureBackendConfig): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Validate security configuration
    if (config.security) {
      // Validate JWT secret in production
      if (
        config.environment?.production &&
        config.security.auth?.jwt &&
        !config.security.auth.jwt.secret
      ) {
        errors.push('JWT secret is required in production environment');
      }

      // Validate session secret in production
      if (
        config.environment?.production &&
        config.security.auth?.session &&
        !config.security.auth.session.secret
      ) {
        errors.push('Session secret is required in production environment');
      }

      // Validate rate limiting configuration
      if (config.security.rateLimit?.enabled) {
        if (
          !config.security.rateLimit.max ||
          config.security.rateLimit.max <= 0
        ) {
          errors.push('Rate limit max requests must be greater than 0');
        }
        if (
          !config.security.rateLimit.windowMs ||
          config.security.rateLimit.windowMs <= 0
        ) {
          errors.push('Rate limit window must be greater than 0');
        }
      }

      // Validate file upload configuration
      if (config.security.fileUpload?.enabled) {
        if (
          config.security.fileUpload.maxFileSize &&
          config.security.fileUpload.maxFileSize <= 0
        ) {
          errors.push('File upload max size must be greater than 0');
        }
      }
    }

    // Validate performance configuration
    if (config.performance) {
      if (config.performance.compression?.enabled) {
        const level = config.performance.compression.level;
        if (level && (level < 1 || level > 9)) {
          errors.push('Compression level must be between 1 and 9');
        }
      }

      if (config.performance.caching?.enabled) {
        if (
          config.performance.caching.maxAge &&
          config.performance.caching.maxAge < 0
        ) {
          errors.push('Cache max age must be non-negative');
        }
      }
    }

    // Environment warnings
    if (config.environment?.production !== true) {
      console.warn(
        '⚠️  Running in non-production mode. Security features may be relaxed.'
      );
    }

    if (config.environment?.https !== true) {
      console.warn(
        '⚠️  HTTPS not enabled. Some security headers will be disabled.'
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static createConfig(
    presetOrConfig: 'api' | 'webapp' | 'strict' | SecureBackendConfig
  ): SecureBackendConfig {
    let config: SecureBackendConfig;

    if (typeof presetOrConfig === 'string') {
      config = this.getPreset(presetOrConfig);
    } else {
      config = presetOrConfig;
    }

    // Apply environment overrides
    config = this.applyEnvironmentOverrides(config);

    // Validate configuration
    const validation = this.validateConfig(config);
    if (!validation.isValid) {
      throw new Error(
        `Configuration validation failed: ${validation.errors.join(', ')}`
      );
    }

    return config;
  }

  private static applyEnvironmentOverrides(
    config: SecureBackendConfig
  ): SecureBackendConfig {
    const env = process.env;

    // Override production setting
    if (env.NODE_ENV === 'production') {
      config.environment = { ...config.environment, production: true };
    }

    // Override HTTPS setting
    if (env.FORCE_HTTPS === 'true') {
      config.environment = { ...config.environment, https: true };
    }

    // Override JWT secret from environment
    if (env.JWT_SECRET && config.security?.auth?.jwt) {
      config.security.auth.jwt.secret = env.JWT_SECRET;
    }

    // Override session secret from environment
    if (env.SESSION_SECRET && config.security?.auth?.session) {
      config.security.auth.session.secret = env.SESSION_SECRET;
    }

    // Override rate limiting from environment
    if (env.RATE_LIMIT_MAX && config.security?.rateLimit) {
      config.security.rateLimit.max = parseInt(env.RATE_LIMIT_MAX, 10);
    }

    return config;
  }

  private static deepMerge(target: any, source: any): any {
    const result = { ...target };

    for (const key in source) {
      if (
        source[key] &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key])
      ) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }

  static getDefaultConfig(): SecureBackendConfig {
    return this.getPreset('api');
  }

  static getConfigSummary(config: SecureBackendConfig): string {
    const summary = {
      preset: config.preset || 'custom',
      security: {
        headers: !!config.security?.headers,
        cors: !!config.security?.cors,
        csrf: !!config.security?.csrf?.enabled,
        rateLimit: !!config.security?.rateLimit?.enabled,
        sanitization: !!config.security?.sanitization?.enabled,
        auth: !!config.security?.auth,
        fileUpload: !!config.security?.fileUpload?.enabled,
      },
      performance: {
        compression: !!config.performance?.compression?.enabled,
        caching: !!config.performance?.caching?.enabled,
        monitoring: !!config.performance?.monitoring?.enabled,
      },
      logging: !!config.logging?.enabled,
      environment: {
        production: config.environment?.production || false,
        https: config.environment?.https || false,
      },
    };

    return JSON.stringify(summary, null, 2);
  }
}
