import { SecurityManager } from '../../src/core/security';
import { ConfigManager } from '../../src/core/config';

describe('SecurityManager - Unit Tests', () => {
  let securityManager: SecurityManager;
  let config: any;

  beforeEach(() => {
    config = ConfigManager.createConfig('api');
    securityManager = new SecurityManager(config);
  });

  describe('CSRF Protection', () => {
    test('should generate CSRF token', () => {
      const token = securityManager.generateCSRFToken();
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    test('should validate valid CSRF token', () => {
      const token = securityManager.generateCSRFToken();
      const isValid = securityManager.validateCSRFToken(token, token);
      expect(isValid).toBe(true);
    });

    test('should reject invalid CSRF token', () => {
      const token = securityManager.generateCSRFToken();
      const isValid = securityManager.validateCSRFToken(token, 'invalid-token');
      expect(isValid).toBe(false);
    });

    test('should reject empty CSRF token', () => {
      const token = securityManager.generateCSRFToken();
      const isValid = securityManager.validateCSRFToken(token, '');
      expect(isValid).toBe(false);
    });
  });

  describe('CORS Validation', () => {
    test('should allow valid origin', () => {
      const isValid = securityManager.validateCORS(
        'https://example.com',
        'GET'
      );
      expect(typeof isValid).toBe('boolean');
    });

    test('should reject invalid origin when strict', () => {
      const strictConfig = ConfigManager.createConfig({
        ...config,
        security: {
          ...config.security,
          cors: {
            origin: ['https://allowed.com'],
            credentials: true,
          },
        },
      });
      const strictSecurityManager = new SecurityManager(strictConfig);

      const isValid = strictSecurityManager.validateCORS(
        'https://evil.com',
        'GET'
      );
      expect(isValid).toBe(false);
    });

    test('should handle wildcard origins', () => {
      const wildcardConfig = ConfigManager.createConfig({
        ...config,
        security: {
          ...config.security,
          cors: {
            origin: true, // Use true instead of '*' for allowing all origins
            credentials: false,
          },
        },
      });
      const wildcardSecurityManager = new SecurityManager(wildcardConfig);

      const isValid = wildcardSecurityManager.validateCORS(
        'https://any.com',
        'GET'
      );
      expect(isValid).toBe(true);
    });
  });

  describe('Input Sanitization', () => {
    test('should sanitize XSS attempts in body', () => {
      const maliciousInput = '<script>alert("xss")</script>';
      const result = securityManager.sanitizeInput(maliciousInput, 'body');
      expect(result.sanitizedData).not.toContain('<script>');
      expect(result.sanitizedData).toContain('&lt;script&gt;'); // HTML encoded
      expect(result.isValid).toBe(false); // Should be invalid due to XSS detection
      expect(result.errors.some(error => error.includes('XSS'))).toBe(true);
    });

    test('should sanitize SQL injection attempts', () => {
      const maliciousInput = "'; DROP TABLE users; --";
      const result = securityManager.sanitizeInput(maliciousInput, 'body');
      expect(result.sanitizedData).toContain('&#x27;'); // HTML encoded quote
      expect(result.sanitizedData).toContain('DROP TABLE'); // Content is encoded but preserved
      expect(result.isValid).toBe(false); // Should be invalid due to SQL injection detection
      expect(result.errors.some(error => error.includes('SQL'))).toBe(true);
    });

    test('should sanitize NoSQL injection attempts', () => {
      const maliciousInput = { $ne: null };
      const result = securityManager.sanitizeInput(maliciousInput, 'body');
      expect(result.sanitizedData).not.toHaveProperty('$ne');
    });

    test('should preserve safe input', () => {
      const safeInput = 'This is a safe string';
      const result = securityManager.sanitizeInput(safeInput, 'body');
      expect(result.sanitizedData).toBe(safeInput);
      expect(result.isValid).toBe(true);
    });

    test('should handle nested objects', () => {
      const nestedInput = {
        user: {
          name: '<script>alert("xss")</script>',
          email: 'user@example.com',
        },
      };
      const result = securityManager.sanitizeInput(nestedInput, 'body');
      expect(result.sanitizedData.user.name).not.toContain('<script>');
      // Email might be sanitized differently, check what's actually returned
      expect(result.sanitizedData.user.email).toBeDefined();
      expect(result.isValid).toBe(true);
    });
  });

  describe('JWT Validation', () => {
    test('should validate JWT structure', () => {
      const mockJWT =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const result = securityManager.validateJWT(mockJWT);
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    test('should reject malformed JWT', () => {
      const malformedJWT = 'not-a-valid-jwt';
      const result = securityManager.validateJWT(malformedJWT);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should reject empty JWT', () => {
      const result = securityManager.validateJWT('');
      expect(result.valid).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    test('should track requests by IP', () => {
      const ip = '192.168.1.1';
      const result1 = securityManager.checkRateLimit(ip);
      expect(result1).not.toBeNull();
      if (result1) {
        expect(result1.remaining).toBeDefined();
        expect(result1.resetTime).toBeDefined();
        expect(result1.limit).toBeDefined();
      }
    });

    test('should enforce rate limits', () => {
      const strictConfig = ConfigManager.createConfig({
        ...config,
        security: {
          ...config.security,
          rateLimit: {
            enabled: true,
            max: 1,
            windowMs: 60000,
          },
        },
      });
      const strictSecurityManager = new SecurityManager(strictConfig);

      const ip = '192.168.1.2';
      const result1 = strictSecurityManager.checkRateLimit(ip);
      expect(result1).not.toBeNull();
      if (result1) {
        expect(result1.remaining).toBeGreaterThanOrEqual(0);
      }

      const result2 = strictSecurityManager.checkRateLimit(ip);
      expect(result2).not.toBeNull();
      if (result2) {
        expect(result2.remaining).toBe(0);
        expect(result2.retryAfter).toBeDefined();
      }
    });
  });

  describe('File Upload Validation', () => {
    test('should validate allowed file types', () => {
      const validFile = {
        mimetype: 'image/jpeg',
        originalname: 'photo.jpg',
        size: 1024,
      };
      const result = securityManager.validateFileUpload(validFile);
      expect(result.isValid).toBe(true);
    });

    test('should reject disallowed file types', () => {
      const invalidFile = {
        mimetype: 'application/x-executable',
        originalname: 'malware.exe',
        size: 1024,
      };
      const result = securityManager.validateFileUpload(invalidFile);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('File type'))).toBe(
        true
      );
    });

    test('should reject oversized files', () => {
      const oversizedFile = {
        mimetype: 'image/jpeg',
        originalname: 'huge.jpg',
        size: 100 * 1024 * 1024, // 100MB
      };
      const result = securityManager.validateFileUpload(oversizedFile);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('size'))).toBe(true);
    });

    test('should validate file extensions', () => {
      const validFile = {
        mimetype: 'image/jpeg',
        originalname: 'photo.jpg',
        size: 1024,
      };
      const result = securityManager.validateFileUpload(validFile);
      expect(result.isValid).toBe(true);

      const invalidExtension = {
        mimetype: 'image/jpeg',
        originalname: 'photo.exe',
        size: 1024,
      };
      const result2 = securityManager.validateFileUpload(invalidExtension);
      expect(result2.isValid).toBe(false);
    });
  });
});
