import type {
  FastifyInstance,
  FastifyRequest,
  FastifyReply,
  FastifyPluginOptions,
} from 'fastify';
import { SecurityManager } from '../core/security';
import { PerformanceManager } from '../core/performance';
import { ConfigManager } from '../core/config';
import type { SecureBackendConfig } from '../types';

export class FastifyAdapter {
  private securityManager: SecurityManager;
  private performanceManager: PerformanceManager;
  private config: SecureBackendConfig;

  constructor(config: SecureBackendConfig) {
    this.config = ConfigManager.createConfig(config);
    this.securityManager = new SecurityManager(this.config);
    this.performanceManager = new PerformanceManager(this.config);
  }

  createPlugin() {
    return async (fastify: FastifyInstance, _options: FastifyPluginOptions) => {
      // Register main security hooks
      fastify.addHook(
        'onRequest',
        async (request: FastifyRequest, reply: FastifyReply) => {
          const startTime = Date.now();
          (request as any).startTime = startTime;

          // Apply security headers
          this.securityManager.applySecurityHeaders(reply as any);

          // CORS validation
          const origin = request.headers.origin;
          if (
            origin &&
            !this.securityManager.validateCORS(origin, request.method)
          ) {
            reply.status(403).send({ error: 'CORS policy violation' });
            return;
          }

          // Rate limiting
          const clientIp = this.getClientIP(request);
          const rateLimitInfo = this.securityManager.checkRateLimit(clientIp);

          if (rateLimitInfo && rateLimitInfo.remaining === 0) {
            reply.header(
              'Retry-After',
              rateLimitInfo.retryAfter?.toString() || '60'
            );
            reply.status(429).send({
              error: 'Rate limit exceeded',
              retryAfter: rateLimitInfo.retryAfter,
            });
            return;
          }

          // Apply rate limit headers
          if (rateLimitInfo) {
            reply.header('X-RateLimit-Limit', rateLimitInfo.limit.toString());
            reply.header(
              'X-RateLimit-Remaining',
              rateLimitInfo.remaining.toString()
            );
            reply.header(
              'X-RateLimit-Reset',
              rateLimitInfo.resetTime.toISOString()
            );
          }

          // JWT validation (if Authorization header is present)
          const authHeader = request.headers.authorization;
          if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const jwtValidation = this.securityManager.validateJWT(token);
            if (!jwtValidation.valid) {
              reply.status(401).send({ error: jwtValidation.error });
              return;
            }
            (request as any).user = jwtValidation.payload;
          }
        }
      );

      // Performance monitoring hook
      fastify.addHook(
        'onSend',
        async (request: FastifyRequest, reply: FastifyReply, payload: any) => {
          const startTime = (request as any).startTime || Date.now();

          // Optimize response
          const optimized = this.performanceManager.optimizeResponse(payload);

          // Apply caching headers
          this.performanceManager.applyCachingHeaders(
            reply as any,
            optimized.data
          );

          // Record metrics
          const duration = Date.now() - startTime;
          const payloadSize = Buffer.isBuffer(optimized.data)
            ? optimized.data.length
            : JSON.stringify(optimized.data).length;
          this.performanceManager.recordMetrics(duration, payloadSize);

          return optimized.data;
        }
      );

      // Register security routes
      this.registerSecurityRoutes(fastify);
    };
  }

  private registerSecurityRoutes(fastify: FastifyInstance) {
    // CSRF token endpoint
    if (this.config.security?.csrf?.enabled) {
      fastify.get(
        '/csrf-token',
        async (_request: FastifyRequest, reply: FastifyReply) => {
          const token = this.securityManager.generateCSRFToken();

          // Set cookie using headers for basic implementation
          reply.header(
            'Set-Cookie',
            `csrf-token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=3600`
          );

          return { csrfToken: token };
        }
      );
    }

    // Security events endpoint
    if (this.config.logging?.enabled) {
      fastify.get(
        '/security-events',
        async (_request: FastifyRequest, _reply: FastifyReply) => {
          const events = this.securityManager.getSecurityEvents();
          return { events };
        }
      );

      // Performance metrics endpoint
      fastify.get(
        '/performance-metrics',
        async (_request: FastifyRequest, _reply: FastifyReply) => {
          const metrics = this.performanceManager.getMetrics();
          const avgResponseTime =
            this.performanceManager.getAverageResponseTime();
          const avgPayloadSize =
            this.performanceManager.getAveragePayloadSize();
          const memoryUsage = this.performanceManager.getMemoryUsage();
          const suggestions =
            this.performanceManager.getOptimizationSuggestions();

          return {
            metrics: metrics.slice(-100),
            summary: {
              averageResponseTime: avgResponseTime,
              averagePayloadSize: avgPayloadSize,
              memoryUsage,
              suggestions,
            },
          };
        }
      );
    }
  }

  // Helper methods
  private getClientIP(request: FastifyRequest): string {
    return request.ip || (request.socket as any).remoteAddress || 'unknown';
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
}
