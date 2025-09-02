import type { Request, Response, NextFunction, Application } from 'express';
import { SecurityManager } from '../core/security';
import { PerformanceManager } from '../core/performance';
import { ConfigManager } from '../core/config';
import type { SecureBackendConfig } from '../types';

export type ExpressMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => void;

export class ExpressAdapter {
  private securityManager: SecurityManager;
  private performanceManager: PerformanceManager;
  private config: SecureBackendConfig;

  constructor(config: SecureBackendConfig) {
    this.config = ConfigManager.createConfig(config);
    this.securityManager = new SecurityManager(this.config);
    this.performanceManager = new PerformanceManager(this.config);
  }

  // Main middleware factory
  createMiddleware(): ExpressMiddleware {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const startTime = Date.now();

        // Apply security headers
        this.securityManager.applySecurityHeaders(res);

        // CORS validation
        const origin = req.get('Origin');
        if (origin && !this.securityManager.validateCORS(origin, req.method)) {
          return res.status(403).json({ error: 'CORS policy violation' });
        }

        // Rate limiting
        const clientIp = this.getClientIP(req);
        const rateLimitInfo = this.securityManager.checkRateLimit(clientIp);

        if (rateLimitInfo && rateLimitInfo.remaining === 0) {
          res.set('Retry-After', rateLimitInfo.retryAfter?.toString() || '60');
          return res.status(429).json({
            error: 'Rate limit exceeded',
            retryAfter: rateLimitInfo.retryAfter,
          });
        }

        // Apply rate limit headers
        if (rateLimitInfo) {
          res.set('X-RateLimit-Limit', rateLimitInfo.limit.toString());
          res.set('X-RateLimit-Remaining', rateLimitInfo.remaining.toString());
          res.set('X-RateLimit-Reset', rateLimitInfo.resetTime.toISOString());
        }

        // JWT validation (if Authorization header is present)
        const authHeader = req.get('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          const jwtValidation = this.securityManager.validateJWT(token);
          if (!jwtValidation.valid) {
            return res.status(401).json({ error: jwtValidation.error });
          }
          // Attach user info to request
          (req as any).user = jwtValidation.payload;
        }

        // Input sanitization
        if (req.body) {
          const bodyValidation = this.securityManager.sanitizeInput(
            req.body,
            'body'
          );
          if (!bodyValidation.isValid) {
            return res.status(400).json({
              error: 'Invalid input detected',
              details: bodyValidation.errors,
            });
          }
          req.body = bodyValidation.sanitizedData;
        }

        if (req.query) {
          const queryValidation = this.securityManager.sanitizeInput(
            req.query,
            'query'
          );
          if (!queryValidation.isValid) {
            return res.status(400).json({
              error: 'Invalid query parameters detected',
              details: queryValidation.errors,
            });
          }
          req.query = queryValidation.sanitizedData;
        }

        if (req.params) {
          const paramsValidation = this.securityManager.sanitizeInput(
            req.params,
            'params'
          );
          if (!paramsValidation.isValid) {
            return res.status(400).json({
              error: 'Invalid path parameters detected',
              details: paramsValidation.errors,
            });
          }
          req.params = paramsValidation.sanitizedData;
        }

        // Record metrics on response finish
        res.on('finish', () => {
          const duration = Date.now() - startTime;
          const payloadSize = parseInt(res.get('Content-Length') || '0');
          this.performanceManager.recordMetrics(duration, payloadSize);
        });

        return next();
      } catch (error) {
        console.error('Secure backend middleware error:', error);
        return res.status(500).json({ error: 'Internal server error' });
      }
    };
  }

  // Helper methods
  private getClientIP(req: Request): string {
    return (
      req.ip ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      (req.connection as any).socket?.remoteAddress ||
      'unknown'
    );
  }

  // Utility methods for external use
  getSecurityManager(): SecurityManager {
    return this.securityManager;
  }

  getPerformanceManager(): PerformanceManager {
    return this.performanceManager;
  }

  getConfig(): SecureBackendConfig {
    return this.config;
  }

  // Specialized middleware
  createJWTAuthMiddleware(): ExpressMiddleware {
    return (req: Request, res: Response, next: NextFunction) => {
      const authHeader = req.get('Authorization');

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authorization header required' });
      }

      const token = authHeader.substring(7);
      const validation = this.securityManager.validateJWT(token);

      if (!validation.valid) {
        return res.status(401).json({ error: validation.error });
      }

      (req as any).user = validation.payload;
      return next();
    };
  }

  createRateLimitMiddleware(): ExpressMiddleware {
    return (req: Request, res: Response, next: NextFunction) => {
      const clientIp = this.getClientIP(req);
      const rateLimitInfo = this.securityManager.checkRateLimit(clientIp);

      if (rateLimitInfo && rateLimitInfo.remaining === 0) {
        res.set('Retry-After', rateLimitInfo.retryAfter?.toString() || '60');
        return res.status(429).json({
          error: 'Rate limit exceeded',
          retryAfter: rateLimitInfo.retryAfter,
        });
      }

      if (rateLimitInfo) {
        res.set('X-RateLimit-Limit', rateLimitInfo.limit.toString());
        res.set('X-RateLimit-Remaining', rateLimitInfo.remaining.toString());
        res.set('X-RateLimit-Reset', rateLimitInfo.resetTime.toISOString());
      }

      return next();
    };
  }

  // Add security routes to Express app
  addSecurityRoutes(app: Application): void {
    // CSRF token endpoint
    if (this.config.security?.csrf?.enabled) {
      app.get('/csrf-token', (_req: Request, res: Response) => {
        const token = this.securityManager.generateCSRFToken();
        const cookieName =
          this.config.security?.csrf?.cookieName || 'csrf-token';

        res.cookie(cookieName, token, {
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          maxAge: 3600000,
        });

        res.json({ csrfToken: token });
      });
    }

    // Security events endpoint
    if (this.config.logging?.enabled) {
      app.get('/security-events', (_req: Request, res: Response) => {
        const events = this.securityManager.getSecurityEvents();
        res.json({ events });
      });

      // Performance metrics endpoint
      app.get('/performance-metrics', (_req: Request, res: Response) => {
        const metrics = this.performanceManager.getMetrics();
        const avgResponseTime =
          this.performanceManager.getAverageResponseTime();
        const avgPayloadSize = this.performanceManager.getAveragePayloadSize();
        const memoryUsage = this.performanceManager.getMemoryUsage();
        const suggestions =
          this.performanceManager.getOptimizationSuggestions();

        res.json({
          metrics: metrics.slice(-100),
          summary: {
            averageResponseTime: avgResponseTime,
            averagePayloadSize: avgPayloadSize,
            memoryUsage,
            suggestions,
          },
        });
      });
    }

    // Configuration summary endpoint
    app.get('/config-summary', (_req: Request, res: Response) => {
      const summary = ConfigManager.getConfigSummary(this.config);
      res.json(JSON.parse(summary));
    });
  }
}
