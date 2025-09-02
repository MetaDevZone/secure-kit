import type Koa from 'koa';
import { SecurityManager } from '../core/security';
import { PerformanceManager } from '../core/performance';
import { ConfigManager } from '../core/config';
import type { SecureBackendConfig } from '../types';

export class KoaAdapter {
  private securityManager: SecurityManager;
  private performanceManager: PerformanceManager;
  private config: SecureBackendConfig;

  constructor(config: SecureBackendConfig) {
    this.config = ConfigManager.createConfig(config);
    this.securityManager = new SecurityManager(this.config);
    this.performanceManager = new PerformanceManager(this.config);
  }

  createMiddleware() {
    return async (ctx: Koa.Context, next: Koa.Next) => {
      try {
        const startTime = Date.now();

        // Apply security headers
        this.securityManager.applySecurityHeaders(ctx.res);

        // CORS validation
        const origin = ctx.get('Origin');
        if (origin && !this.securityManager.validateCORS(origin, ctx.method)) {
          ctx.status = 403;
          ctx.body = { error: 'CORS policy violation' };
          return;
        }

        // Rate limiting
        const clientIp = this.getClientIP(ctx);
        const rateLimitInfo = this.securityManager.checkRateLimit(clientIp);

        if (rateLimitInfo && rateLimitInfo.remaining === 0) {
          ctx.set('Retry-After', rateLimitInfo.retryAfter?.toString() || '60');
          ctx.status = 429;
          ctx.body = {
            error: 'Rate limit exceeded',
            retryAfter: rateLimitInfo.retryAfter,
          };
          return;
        }

        // Apply rate limit headers
        if (rateLimitInfo) {
          ctx.set('X-RateLimit-Limit', rateLimitInfo.limit.toString());
          ctx.set('X-RateLimit-Remaining', rateLimitInfo.remaining.toString());
          ctx.set('X-RateLimit-Reset', rateLimitInfo.resetTime.toISOString());
        }

        // JWT validation (if Authorization header is present)
        const authHeader = ctx.get('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          const jwtValidation = this.securityManager.validateJWT(token);
          if (!jwtValidation.valid) {
            ctx.status = 401;
            ctx.body = { error: jwtValidation.error };
            return;
          }
          // Attach user info to context
          (ctx as any).user = jwtValidation.payload;
        }

        // Input sanitization
        if ((ctx as any).request.body) {
          const bodyValidation = this.securityManager.sanitizeInput(
            (ctx as any).request.body,
            'body'
          );
          if (!bodyValidation.isValid) {
            ctx.status = 400;
            ctx.body = {
              error: 'Invalid input detected',
              details: bodyValidation.errors,
            };
            return;
          }
          (ctx as any).request.body = bodyValidation.sanitizedData;
        }

        if (ctx.query) {
          const queryValidation = this.securityManager.sanitizeInput(
            ctx.query,
            'query'
          );
          if (!queryValidation.isValid) {
            ctx.status = 400;
            ctx.body = {
              error: 'Invalid query parameters detected',
              details: queryValidation.errors,
            };
            return;
          }
          ctx.query = queryValidation.sanitizedData;
        }

        await next();

        // Performance monitoring
        const duration = Date.now() - startTime;
        const payloadSize = ctx.length || 0;
        this.performanceManager.recordMetrics(duration, payloadSize);

        // Optimize response
        if (ctx.body) {
          const optimized = this.performanceManager.optimizeResponse(ctx.body);
          this.performanceManager.applyCachingHeaders(ctx.res, optimized.data);
          ctx.body = optimized.data;
        }
      } catch (error) {
        console.error('Secure backend middleware error:', error);
        ctx.status = 500;
        ctx.body = { error: 'Internal server error' };
      }
    };
  }

  // Helper methods
  private getClientIP(ctx: Koa.Context): string {
    return (
      ctx.ip ||
      ctx.request.ip ||
      (ctx.req.connection as any).remoteAddress ||
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

  // Create specialized middleware
  createJWTAuthMiddleware() {
    return async (ctx: Koa.Context, next: Koa.Next) => {
      const authHeader = ctx.get('Authorization');

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        ctx.status = 401;
        ctx.body = { error: 'Authorization header required' };
        return;
      }

      const token = authHeader.substring(7);
      const validation = this.securityManager.validateJWT(token);

      if (!validation.valid) {
        ctx.status = 401;
        ctx.body = { error: validation.error };
        return;
      }

      (ctx as any).user = validation.payload;
      await next();
    };
  }

  createRateLimitMiddleware() {
    return async (ctx: Koa.Context, next: Koa.Next) => {
      const clientIp = this.getClientIP(ctx);
      const rateLimitInfo = this.securityManager.checkRateLimit(clientIp);

      if (rateLimitInfo && rateLimitInfo.remaining === 0) {
        ctx.set('Retry-After', rateLimitInfo.retryAfter?.toString() || '60');
        ctx.status = 429;
        ctx.body = {
          error: 'Rate limit exceeded',
          retryAfter: rateLimitInfo.retryAfter,
        };
        return;
      }

      if (rateLimitInfo) {
        ctx.set('X-RateLimit-Limit', rateLimitInfo.limit.toString());
        ctx.set('X-RateLimit-Remaining', rateLimitInfo.remaining.toString());
        ctx.set('X-RateLimit-Reset', rateLimitInfo.resetTime.toISOString());
      }

      await next();
    };
  }

  // Add security routes to Koa app
  addSecurityRoutes(app: Koa) {
    // CSRF token endpoint
    if (this.config.security?.csrf?.enabled) {
      app.use(async (ctx, next) => {
        if (ctx.path === '/csrf-token' && ctx.method === 'GET') {
          const token = this.securityManager.generateCSRFToken();
          const cookieName =
            this.config.security?.csrf?.cookieName || 'csrf-token';

          ctx.cookies.set(cookieName, token, {
            httpOnly: true,
            secure: true,
            sameSite: 'strict',
            maxAge: 3600000,
          });

          ctx.body = { csrfToken: token };
          return;
        }
        await next();
      });
    }

    // Security events endpoint
    if (this.config.logging?.enabled) {
      app.use(async (ctx, next) => {
        if (ctx.path === '/security-events' && ctx.method === 'GET') {
          const events = this.securityManager.getSecurityEvents();
          ctx.body = { events };
          return;
        }
        await next();
      });

      // Performance metrics endpoint
      app.use(async (ctx, next) => {
        if (ctx.path === '/performance-metrics' && ctx.method === 'GET') {
          const metrics = this.performanceManager.getMetrics();
          const avgResponseTime =
            this.performanceManager.getAverageResponseTime();
          const avgPayloadSize =
            this.performanceManager.getAveragePayloadSize();
          const memoryUsage = this.performanceManager.getMemoryUsage();
          const suggestions =
            this.performanceManager.getOptimizationSuggestions();

          ctx.body = {
            metrics: metrics.slice(-100),
            summary: {
              averageResponseTime: avgResponseTime,
              averagePayloadSize: avgPayloadSize,
              memoryUsage,
              suggestions,
            },
          };
          return;
        }
        await next();
      });
    }
  }
}
