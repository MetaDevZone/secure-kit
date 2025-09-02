import { SecurityManager } from '../../src/core/security';
import { SecureBackendConfig } from '../../src/types';

describe('SecurityManager', () => {
  let securityManager: SecurityManager;
  let mockConfig: SecureBackendConfig;

  beforeEach(() => {
    mockConfig = {
      security: {
        headers: {
          hsts: { maxAge: 31536000, includeSubDomains: true },
          csp: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
          },
          referrerPolicy: 'no-referrer',
          xContentTypeOptions: true,
          xFrameOptions: 'DENY',
        },
        cors: {
          origin: ['https://example.com'],
          credentials: false,
        },
        csrf: {
          enabled: true,
          tokenLength: 32,
        },
        rateLimit: {
          enabled: true,
          windowMs: 15 * 60 * 1000,
          max: 100,
        },
        sanitization: {
          enabled: true,
          xss: true,
          sqlInjection: true,
          noSqlInjection: true,
        },
        auth: {
          jwt: {
            secret: 'test-secret',
            algorithms: ['HS256'],
          },
        },
        fileUpload: {
          enabled: true,
          maxFileSize: 1024 * 1024,
          allowedMimeTypes: ['image/jpeg', 'image/png'],
        },
      },
      environment: {
        production: false,
        https: false,
      },
    };

    securityManager = new SecurityManager(mockConfig);
  });

  describe('applySecurityHeaders', () => {
    it('should apply security headers correctly', () => {
      const mockRes = {
        set: jest.fn(),
      };

      securityManager.applySecurityHeaders(mockRes);

      expect(mockRes.set).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(mockRes.set).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
      expect(mockRes.set).toHaveBeenCalledWith('Referrer-Policy', 'no-referrer');
    });

    it('should apply HSTS headers when HTTPS is enabled', () => {
      mockConfig.environment!.https = true;
      securityManager = new SecurityManager(mockConfig);

      const mockRes = {
        set: jest.fn(),
      };

      securityManager.applySecurityHeaders(mockRes);

      expect(mockRes.set).toHaveBeenCalledWith(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains'
      );
    });
  });

  describe('validateCORS', () => {
    it('should allow requests from whitelisted origins', () => {
      const result = securityManager.validateCORS('https://example.com', 'GET');
      expect(result).toBe(true);
    });

    it('should reject requests from non-whitelisted origins', () => {
      const result = securityManager.validateCORS('https://malicious.com', 'GET');
      expect(result).toBe(false);
    });

    it('should allow all origins when origin is true', () => {
      mockConfig.security!.cors!.origin = true;
      securityManager = new SecurityManager(mockConfig);

      const result = securityManager.validateCORS('https://any-origin.com', 'GET');
      expect(result).toBe(true);
    });
  });

  describe('CSRF Protection', () => {
    it('should generate CSRF tokens', () => {
      const token1 = securityManager.generateCSRFToken();
      const token2 = securityManager.generateCSRFToken();

      expect(token1).toBeDefined();
      expect(token2).toBeDefined();
      expect(token1).not.toBe(token2);
      expect(token1.length).toBe(64); // 32 bytes = 64 hex chars
    });

    it('should validate CSRF tokens correctly', () => {
      const token = securityManager.generateCSRFToken();
      
      expect(securityManager.validateCSRFToken(token, token)).toBe(true);
      expect(securityManager.validateCSRFToken(token, 'different-token')).toBe(false);
      expect(securityManager.validateCSRFToken('', '')).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    it('should allow requests within rate limit', () => {
      const result = securityManager.checkRateLimit('127.0.0.1');
      expect(result).toBeDefined();
      expect(result!.remaining).toBe(99); // 100 - 1
    });

    it('should block requests when rate limit is exceeded', () => {
      // Make 100 requests to exceed the limit
      for (let i = 0; i < 100; i++) {
        securityManager.checkRateLimit('127.0.0.1');
      }

      const result = securityManager.checkRateLimit('127.0.0.1');
      expect(result!.remaining).toBe(0);
    });

    it('should reset rate limit after window expires', () => {
      // Mock Date.now to simulate time passing
      const originalNow = Date.now;
      Date.now = jest.fn(() => originalNow() + 16 * 60 * 1000); // 16 minutes later

      const result = securityManager.checkRateLimit('127.0.0.1');
      expect(result!.remaining).toBe(99); // Should reset

      Date.now = originalNow;
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize XSS attempts', () => {
      const maliciousInput = '<script>alert("xss")</script>';
      const result = securityManager.sanitizeInput(maliciousInput, 'body');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('XSS attempt detected');
    });

    it('should sanitize SQL injection attempts', () => {
      const maliciousInput = "'; DROP TABLE users; --";
      const result = securityManager.sanitizeInput(maliciousInput, 'body');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('SQL injection attempt detected');
    });

    it('should sanitize NoSQL injection attempts', () => {
      const maliciousInput = '{"$where": "1==1"}';
      const result = securityManager.sanitizeInput(maliciousInput, 'body');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('NoSQL injection attempt detected');
    });

    it('should allow valid input', () => {
      const validInput = 'Hello, World!';
      const result = securityManager.sanitizeInput(validInput, 'body');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('JWT Validation', () => {
    it('should reject JWT with alg: none', () => {
      const maliciousToken = 'eyJhbGciOiJub25lIiwidHlwZSI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.';
      const result = securityManager.validateJWT(maliciousToken);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('JWT algorithm "none" not allowed');
    });

    it('should reject invalid JWT format', () => {
      const invalidToken = 'invalid.jwt.token';
      const result = securityManager.validateJWT(invalidToken);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('JWT validation failed');
    });

    it('should reject JWT with invalid signature', () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.invalid-signature';
      const result = securityManager.validateJWT(token);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid JWT signature');
    });
  });

  describe('File Upload Validation', () => {
    it('should validate file size', () => {
      const file = {
        size: 2 * 1024 * 1024, // 2MB
        mimetype: 'image/jpeg',
        originalname: 'test.jpg',
      };

      const result = securityManager.validateFileUpload(file);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File size exceeds limit of 1048576 bytes');
    });

    it('should validate MIME type', () => {
      const file = {
        size: 1024,
        mimetype: 'application/exe',
        originalname: 'test.exe',
      };

      const result = securityManager.validateFileUpload(file);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File type application/exe not allowed');
    });

    it('should detect dangerous file extensions', () => {
      const file = {
        size: 1024,
        mimetype: 'application/octet-stream',
        originalname: 'malware.exe',
      };

      const result = securityManager.validateFileUpload(file);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Dangerous file extension .exe detected');
    });

    it('should allow valid files', () => {
      const file = {
        size: 1024,
        mimetype: 'image/jpeg',
        originalname: 'photo.jpg',
      };

      const result = securityManager.validateFileUpload(file);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Redirect Security', () => {
    it('should validate redirect URLs against allowlist', () => {
      const allowedDomains = ['example.com', 'trusted.com'];
      
      expect(securityManager.validateRedirect('https://example.com/path', allowedDomains)).toBe(true);
      expect(securityManager.validateRedirect('https://trusted.com/api', allowedDomains)).toBe(true);
      expect(securityManager.validateRedirect('https://malicious.com/evil', allowedDomains)).toBe(false);
    });

    it('should handle invalid URLs', () => {
      const allowedDomains = ['example.com'];
      
      expect(securityManager.validateRedirect('not-a-url', allowedDomains)).toBe(false);
    });
  });

  describe('Security Events', () => {
    it('should log security events', () => {
      const events = securityManager.getSecurityEvents();
      expect(events).toHaveLength(0);

      // Trigger a security event
      securityManager.sanitizeInput('<script>alert("xss")</script>', 'body');

      const newEvents = securityManager.getSecurityEvents();
      expect(newEvents).toHaveLength(1);
      expect(newEvents[0].type).toBe('xss_attempt');
    });

    it('should clear security events', () => {
      // Trigger a security event
      securityManager.sanitizeInput('<script>alert("xss")</script>', 'body');
      expect(securityManager.getSecurityEvents()).toHaveLength(1);

      securityManager.clearSecurityEvents();
      expect(securityManager.getSecurityEvents()).toHaveLength(0);
    });
  });
});
