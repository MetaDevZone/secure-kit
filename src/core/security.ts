import { randomBytes, createHmac } from 'crypto';
import { LRUCache } from 'lru-cache';
import type {
  SecureBackendConfig,
  SecurityEvent,
  ValidationResult,
  RateLimitInfo,
  SanitizationConfig,
} from '../types';
import { SecurityMonitor } from './security-monitor';

export class SecurityManager {
  private config: SecureBackendConfig;
  private rateLimitStore: LRUCache<string, { count: number; resetTime: Date }>;
  private securityEvents: SecurityEvent[] = [];
  private securityMonitor: SecurityMonitor;

  constructor(config: SecureBackendConfig) {
    this.config = config;
    this.rateLimitStore = new LRUCache({
      max: 1000,
      ttl: 1000 * 60 * 15, // 15 minutes
    });

    // Initialize security monitoring
    this.securityMonitor = new SecurityMonitor({
      maxEventsHistory: 10000,
    });

    // Set up event listeners for threat detection
    this.securityMonitor.on('threatDetected', (data: any) => {
      console.warn(
        'Security threat detected:',
        data.rule.name,
        data.threatEvent
      );
    });

    this.securityMonitor.on('blockRequest', (data: any) => {
      console.error(
        'Request blocked due to security threat:',
        data.source,
        data.rule.name
      );
    });
  }

  // Security Headers
  applySecurityHeaders(res: any): void {
    const headers = this.config.security?.headers || {};

    // HSTS
    if (this.config.environment?.https) {
      const hsts = headers.hsts || {};
      const maxAge = hsts.maxAge || 31536000; // 1 year
      let hstsValue = `max-age=${maxAge}`;
      if (hsts.includeSubDomains) hstsValue += '; includeSubDomains';
      if (hsts.preload) hstsValue += '; preload';
      res.set('Strict-Transport-Security', hstsValue);
    }

    // Content Security Policy
    if (headers.csp) {
      const csp = headers.csp;
      const directives = [];

      if (csp.defaultSrc)
        directives.push(`default-src ${csp.defaultSrc.join(' ')}`);
      if (csp.scriptSrc)
        directives.push(`script-src ${csp.scriptSrc.join(' ')}`);
      if (csp.styleSrc) directives.push(`style-src ${csp.styleSrc.join(' ')}`);
      if (csp.imgSrc) directives.push(`img-src ${csp.imgSrc.join(' ')}`);
      if (csp.connectSrc)
        directives.push(`connect-src ${csp.connectSrc.join(' ')}`);
      if (csp.fontSrc) directives.push(`font-src ${csp.fontSrc.join(' ')}`);
      if (csp.objectSrc)
        directives.push(`object-src ${csp.objectSrc.join(' ')}`);
      if (csp.mediaSrc) directives.push(`media-src ${csp.mediaSrc.join(' ')}`);
      if (csp.frameSrc) directives.push(`frame-src ${csp.frameSrc.join(' ')}`);

      if (directives.length > 0) {
        const cspValue = directives.join('; ');
        const headerName = csp.reportOnly
          ? 'Content-Security-Policy-Report-Only'
          : 'Content-Security-Policy';
        res.set(headerName, cspValue);
      }
    }

    // Referrer Policy
    if (headers.referrerPolicy) {
      res.set('Referrer-Policy', headers.referrerPolicy);
    }

    // X-Content-Type-Options
    if (headers.xContentTypeOptions !== false) {
      res.set('X-Content-Type-Options', 'nosniff');
    }

    // X-Frame-Options
    if (headers.xFrameOptions) {
      res.set('X-Frame-Options', headers.xFrameOptions);
    }

    // Permissions Policy
    if (headers.permissionsPolicy) {
      const policies = Object.entries(headers.permissionsPolicy)
        .map(([feature, origins]) => `${feature}=${origins.join(', ')}`)
        .join(', ');
      res.set('Permissions-Policy', policies);
    }

    // Cross-Origin Headers
    if (headers.crossOriginResourcePolicy) {
      res.set(
        'Cross-Origin-Resource-Policy',
        headers.crossOriginResourcePolicy
      );
    }
    if (headers.crossOriginEmbedderPolicy) {
      res.set(
        'Cross-Origin-Embedder-Policy',
        headers.crossOriginEmbedderPolicy
      );
    }
    if (headers.crossOriginOpenerPolicy) {
      res.set('Cross-Origin-Opener-Policy', headers.crossOriginOpenerPolicy);
    }
  }

  // CORS Validation
  validateCORS(origin: string, method: string): boolean {
    const cors = this.config.security?.cors;
    if (!cors) return true;

    // Check origin
    if (cors.origin) {
      if (typeof cors.origin === 'string') {
        if (cors.origin !== origin) return false;
      } else if (Array.isArray(cors.origin)) {
        if (!cors.origin.includes(origin)) return false;
      } else if (cors.origin instanceof RegExp) {
        if (!cors.origin.test(origin)) return false;
      } else if (typeof cors.origin === 'function') {
        if (!cors.origin(origin)) return false;
      }
    }

    // Check method
    if (cors.methods && !cors.methods.includes(method)) {
      return false;
    }

    return true;
  }

  // CSRF Protection
  generateCSRFToken(): string {
    const csrf = this.config.security?.csrf;
    const tokenLength = csrf?.tokenLength || 32;
    return randomBytes(tokenLength).toString('hex');
  }

  validateCSRFToken(token: string, storedToken: string): boolean {
    if (!token || !storedToken) return false;
    return token === storedToken;
  }

  // Rate Limiting
  checkRateLimit(identifier: string): RateLimitInfo | null {
    const rateLimit = this.config.security?.rateLimit;
    if (!rateLimit?.enabled) return null;

    const windowMs = rateLimit.windowMs || 15 * 60 * 1000; // 15 minutes
    const max = rateLimit.max || 100;

    const key = `rate_limit:${identifier}`;
    const now = new Date();
    const resetTime = new Date(now.getTime() + windowMs);

    const current = this.rateLimitStore.get(key);

    if (!current) {
      this.rateLimitStore.set(key, { count: 1, resetTime });
      return {
        limit: max,
        remaining: max - 1,
        resetTime,
      };
    }

    if (now > current.resetTime) {
      this.rateLimitStore.set(key, { count: 1, resetTime });
      return {
        limit: max,
        remaining: max - 1,
        resetTime,
      };
    }

    if (current.count >= max) {
      return {
        limit: max,
        remaining: 0,
        resetTime: current.resetTime,
        retryAfter: Math.ceil(
          (current.resetTime.getTime() - now.getTime()) / 1000
        ),
      };
    }

    current.count++;
    this.rateLimitStore.set(key, current);

    return {
      limit: max,
      remaining: max - current.count,
      resetTime: current.resetTime,
    };
  }

  // Input Sanitization
  sanitizeInput(
    input: any,
    _type: 'body' | 'query' | 'params'
  ): ValidationResult {
    const sanitization = this.config.security?.sanitization;
    if (!sanitization?.enabled) {
      return { isValid: true, errors: [], sanitizedData: input };
    }

    const errors: string[] = [];
    let sanitizedData = input;

    if (typeof input === 'string') {
      sanitizedData = this.sanitizeString(input, sanitization, errors);
    } else if (typeof input === 'object' && input !== null) {
      sanitizedData = this.sanitizeObject(input, sanitization, errors);
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData,
    };
  }

  private sanitizeString(
    str: string,
    config: SanitizationConfig,
    errors: string[]
  ): string {
    let sanitized = str;

    // XSS Protection
    if (config.xss) {
      const xssPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
        /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
      ];

      for (const pattern of xssPatterns) {
        if (pattern.test(sanitized)) {
          errors.push('XSS attempt detected');
          this.logSecurityEvent('xss_attempt', {
            pattern: pattern.source,
            input: str,
          });
        }
      }

      // Basic HTML entity encoding
      sanitized = sanitized
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
    }

    // SQL Injection Protection
    if (config.sqlInjection) {
      const sqlPatterns = [
        /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/gi,
        /(\b(or|and)\b\s+\d+\s*=\s*\d+)/gi,
        /(\b(or|and)\b\s+['"]\w+['"]\s*=\s*['"]\w+['"])/gi,
      ];

      for (const pattern of sqlPatterns) {
        if (pattern.test(sanitized)) {
          errors.push('SQL injection attempt detected');
          this.logSecurityEvent('sql_injection', {
            pattern: pattern.source,
            input: str,
          });
        }
      }
    }

    // NoSQL Injection Protection
    if (config.noSqlInjection) {
      if (sanitized.includes('$') || sanitized.includes('.')) {
        errors.push('NoSQL injection attempt detected');
        this.logSecurityEvent('suspicious_request', {
          input: str,
          type: 'no_sql_injection',
        });
        sanitized = sanitized.replace(/[$.]/g, '');
      }
    }

    return sanitized;
  }

  private sanitizeObject(
    obj: any,
    config: SanitizationConfig,
    errors: string[]
  ): any {
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeInput(item, 'body').sanitizedData);
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = this.sanitizeString(key, config, errors);
      const sanitizedValue = this.sanitizeInput(value, 'body').sanitizedData;
      sanitized[sanitizedKey] = sanitizedValue;
    }

    return sanitized;
  }

  // JWT Validation
  validateJWT(token: string): {
    valid: boolean;
    payload?: any;
    error?: string;
  } {
    const auth = this.config.security?.auth?.jwt;
    if (!auth?.secret) {
      return { valid: false, error: 'JWT secret not configured' };
    }

    try {
      // Basic JWT structure validation
      const parts = token.split('.');
      if (parts.length !== 3) {
        return { valid: false, error: 'Invalid JWT format' };
      }

      // Check for 'alg: none' attack
      const header = JSON.parse(
        Buffer.from(parts[0] || '', 'base64').toString()
      );
      if (header.alg === 'none') {
        this.logSecurityEvent('auth_failure', {
          reason: 'alg_none_attack',
          token,
        });
        return { valid: false, error: 'JWT algorithm "none" not allowed' };
      }

      // Verify signature (simplified - in production use proper JWT library)
      const signature = createHmac('sha256', auth.secret)
        .update(`${parts[0]}.${parts[1]}`)
        .digest('base64url');

      if (signature !== parts[2]) {
        this.logSecurityEvent('auth_failure', {
          reason: 'invalid_signature',
          token,
        });
        return { valid: false, error: 'Invalid JWT signature' };
      }

      // Parse payload
      const payload = JSON.parse(
        Buffer.from(parts[1] || '', 'base64url').toString()
      );

      // Validate claims
      const now = Math.floor(Date.now() / 1000);

      if (payload.exp && payload.exp < now) {
        return { valid: false, error: 'JWT expired' };
      }
      if (payload.iat && payload.iat > now) {
        return { valid: false, error: 'JWT issued in the future' };
      }
      if (auth.issuer && payload.iss !== auth.issuer) {
        return { valid: false, error: 'Invalid JWT issuer' };
      }
      if (auth.audience && payload.aud !== auth.audience) {
        return { valid: false, error: 'Invalid JWT audience' };
      }

      return { valid: true, payload };
    } catch (error) {
      return { valid: false, error: 'JWT validation failed' };
    }
  }

  // File Upload Security
  validateFileUpload(file: any): ValidationResult {
    const fileUpload = this.config.security?.fileUpload;
    if (!fileUpload?.enabled) {
      return { isValid: true, errors: [], sanitizedData: file };
    }

    const errors: string[] = [];

    // Check file size
    if (fileUpload.maxFileSize && file.size > fileUpload.maxFileSize) {
      errors.push(`File size exceeds limit of ${fileUpload.maxFileSize} bytes`);
    }

    // Check MIME type
    if (
      fileUpload.allowedMimeTypes &&
      !fileUpload.allowedMimeTypes.includes(file.mimetype)
    ) {
      errors.push(`File type ${file.mimetype} not allowed`);
    }

    // Check file extension
    if (fileUpload.allowedExtensions) {
      const extension = file.originalname.split('.').pop()?.toLowerCase();
      if (!extension || !fileUpload.allowedExtensions.includes(extension)) {
        errors.push(`File extension .${extension} not allowed`);
      }
    }

    // Check for dangerous extensions
    const dangerousExtensions = [
      '.exe',
      '.bat',
      '.cmd',
      '.com',
      '.pif',
      '.scr',
      '.vbs',
      '.js',
      '.jar',
      '.sh',
    ];
    const extension = file.originalname.split('.').pop()?.toLowerCase();
    if (extension && dangerousExtensions.includes(`.${extension}`)) {
      errors.push(`Dangerous file extension .${extension} detected`);
      this.logSecurityEvent('suspicious_request', {
        type: 'dangerous_file_upload',
        filename: file.originalname,
        extension,
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: errors.length === 0 ? file : null,
    };
  }

  // Redirect Security
  validateRedirect(url: string, allowedDomains: string[]): boolean {
    try {
      const parsedUrl = new URL(url);
      return allowedDomains.some(
        domain =>
          parsedUrl.hostname === domain ||
          parsedUrl.hostname.endsWith(`.${domain}`)
      );
    } catch {
      return false;
    }
  }

  // Security Event Logging
  private logSecurityEvent(
    type: SecurityEvent['type'],
    details: Record<string, any>,
    req?: any
  ): void {
    // Record event in the new security monitor
    this.securityMonitor.recordEvent({
      type: type as any, // Map old type to new enum
      severity: this.determineSeverity(type),
      source: req?.ip || req?.connection?.remoteAddress || 'unknown',
      details,
      metadata: {
        userAgent: req?.headers?.['user-agent'],
        ip: req?.ip || req?.connection?.remoteAddress,
        sessionId: req?.sessionID,
        requestId: req?.id,
      },
    });

    // Keep old event structure for backward compatibility
    const event: SecurityEvent = {
      type,
      timestamp: new Date(),
      ip: req?.ip || 'unknown',
      details,
    };
    this.securityEvents.push(event);

    // Log to console in development
    if (this.config.environment?.production !== true) {
      console.warn(`Security Event: ${type}`, details);
    }

    // Call custom logger if configured
    if (this.config.logging?.customLogger) {
      this.config.logging.customLogger(
        'warn',
        `Security event: ${type}`,
        details
      );
    }
  }

  private determineSeverity(
    type: SecurityEvent['type']
  ): 'low' | 'medium' | 'high' | 'critical' {
    switch (type) {
      case 'csrf_violation':
      case 'rate_limit_exceeded':
        return 'high';
      case 'xss_attempt':
      case 'sql_injection':
        return 'critical';
      case 'auth_failure':
        return 'medium';
      case 'suspicious_request':
        return 'low';
      default:
        return 'low';
    }
  }

  // Get security monitor instance for advanced monitoring
  getSecurityMonitor(): SecurityMonitor {
    return this.securityMonitor;
  }

  // Get security events
  getSecurityEvents(): SecurityEvent[] {
    return [...this.securityEvents];
  }

  // Clear security events
  clearSecurityEvents(): void {
    this.securityEvents = [];
  }
}
