import { createGzip, createBrotliCompress, constants } from 'zlib';
import { createHash } from 'crypto';
import type { SecureBackendConfig, PerformanceMetrics } from '../types';

export class PerformanceManager {
  private config: SecureBackendConfig;
  private metrics: PerformanceMetrics[] = [];
  private compressionCache: Map<string, Buffer> = new Map();

  constructor(config: SecureBackendConfig) {
    this.config = config;
  }

  // Compression
  async compressResponse(
    data: string | Buffer,
    acceptEncoding: string
  ): Promise<{ data: Buffer; encoding: string } | null> {
    const compression = this.config.performance?.compression;
    if (!compression?.enabled) return null;

    const threshold = compression.threshold || 1024; // 1KB default
    if (data.length < threshold) return null;

    // Check if Brotli is preferred and enabled
    if (compression.brotli && acceptEncoding.includes('br')) {
      return this.compressBrotli(data);
    }

    // Check if gzip is accepted
    if (acceptEncoding.includes('gzip')) {
      return this.compressGzip(data);
    }

    return null;
  }

  private async compressGzip(
    data: string | Buffer
  ): Promise<{ data: Buffer; encoding: string }> {
    const level = this.config.performance?.compression?.level || 6;

    return new Promise((resolve, reject) => {
      const gzip = createGzip({ level });
      const chunks: Buffer[] = [];

      gzip.on('data', chunk => chunks.push(chunk));
      gzip.on('end', () => {
        const compressed = Buffer.concat(chunks);
        resolve({ data: compressed, encoding: 'gzip' });
      });
      gzip.on('error', reject);

      gzip.write(data);
      gzip.end();
    });
  }

  private async compressBrotli(
    data: string | Buffer
  ): Promise<{ data: Buffer; encoding: string }> {
    const level = this.config.performance?.compression?.level || 6;

    return new Promise((resolve, reject) => {
      const brotli = createBrotliCompress({
        params: { [constants.BROTLI_PARAM_QUALITY]: level },
      });
      const chunks: Buffer[] = [];

      brotli.on('data', chunk => chunks.push(chunk));
      brotli.on('end', () => {
        const compressed = Buffer.concat(chunks);
        resolve({ data: compressed, encoding: 'br' });
      });
      brotli.on('error', reject);

      brotli.write(data);
      brotli.end();
    });
  }

  // Caching
  generateETag(data: string | Buffer): string {
    const hash = createHash('md5').update(data).digest('hex');
    return `"${hash}"`;
  }

  generateLastModified(): string {
    return new Date().toUTCString();
  }

  applyCachingHeaders(res: any, data: string | Buffer, maxAge?: number): void {
    const caching = this.config.performance?.caching;
    if (!caching?.enabled) return;

    const age = maxAge || caching.maxAge || 3600; // 1 hour default

    // ETag
    if (caching.etag !== false) {
      const etag = this.generateETag(data);
      res.set('ETag', etag);
    }

    // Last-Modified
    if (caching.lastModified !== false) {
      const lastModified = this.generateLastModified();
      res.set('Last-Modified', lastModified);
    }

    // Cache-Control
    res.set('Cache-Control', `public, max-age=${age}`);
  }

  // Response Monitoring
  recordMetrics(requestTime: number, payloadSize: number): void {
    const monitoring = this.config.performance?.monitoring;
    if (!monitoring?.enabled) return;

    const metrics: PerformanceMetrics = {
      requestTime,
      payloadSize,
      memoryUsage: process.memoryUsage().heapUsed,
      timestamp: new Date(),
    };

    this.metrics.push(metrics);

    // Keep only last 1000 metrics
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }

    // Log slow requests
    if (
      monitoring.logSlowRequests &&
      requestTime > (monitoring.slowRequestThreshold || 1000)
    ) {
      console.warn(`Slow request detected: ${requestTime}ms`);
    }

    // Log large payloads
    if (
      monitoring.logLargePayloads &&
      payloadSize > (monitoring.largePayloadThreshold || 1024 * 1024)
    ) {
      console.warn(`Large payload detected: ${payloadSize} bytes`);
    }
  }

  // JSON Minification
  minifyJSON(data: any): string {
    return JSON.stringify(data);
  }

  // Payload Size Validation
  validatePayloadSize(payload: string | Buffer, maxSize: number): boolean {
    const size = Buffer.byteLength(payload);
    return size <= maxSize;
  }

  // Response Size Optimization
  optimizeResponse(data: any): { data: any; size: number } {
    let optimizedData = data;
    let size = 0;

    if (typeof data === 'string') {
      optimizedData = data.trim();
      size = Buffer.byteLength(optimizedData);
    } else if (typeof data === 'object') {
      optimizedData = this.minifyJSON(data);
      size = Buffer.byteLength(optimizedData);
    } else {
      optimizedData = String(data);
      size = Buffer.byteLength(optimizedData);
    }

    return { data: optimizedData, size };
  }

  // Memory Usage Monitoring
  getMemoryUsage(): NodeJS.MemoryUsage {
    return process.memoryUsage();
  }

  // Performance Metrics
  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  getAverageResponseTime(): number {
    if (this.metrics.length === 0) return 0;

    const total = this.metrics.reduce(
      (sum, metric) => sum + metric.requestTime,
      0
    );
    return total / this.metrics.length;
  }

  getAveragePayloadSize(): number {
    if (this.metrics.length === 0) return 0;

    const total = this.metrics.reduce(
      (sum, metric) => sum + metric.payloadSize,
      0
    );
    return total / this.metrics.length;
  }

  // Clear metrics
  clearMetrics(): void {
    this.metrics = [];
  }

  // Compression cache management
  getCompressionCacheSize(): number {
    return this.compressionCache.size;
  }

  clearCompressionCache(): void {
    this.compressionCache.clear();
  }

  // Database safety helpers
  createQueryTimeout(timeoutMs: number = 5000): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Query timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }

  // Connection pool monitoring
  monitorConnectionPool(pool: any): void {
    if (!pool || typeof pool !== 'object') return;

    const monitoring = this.config.performance?.monitoring;
    if (!monitoring?.enabled) return;

    // Check for connection pool exhaustion
    if (pool.used && pool.size) {
      const usageRatio = pool.used / pool.size;
      if (usageRatio > 0.8) {
        console.warn(
          `Connection pool usage high: ${Math.round(usageRatio * 100)}%`
        );
      }
    }
  }

  // Response time tracking middleware helper
  createResponseTimeTracker(): (req: any, res: any, next: any) => void {
    return (_req: any, res: any, next: any) => {
      const start = Date.now();

      res.on('finish', () => {
        const duration = Date.now() - start;
        const payloadSize = parseInt(res.get('Content-Length') || '0');

        this.recordMetrics(duration, payloadSize);
      });

      next();
    };
  }

  // Performance optimization suggestions
  getOptimizationSuggestions(): string[] {
    const suggestions: string[] = [];
    const avgResponseTime = this.getAverageResponseTime();
    const avgPayloadSize = this.getAveragePayloadSize();

    if (avgResponseTime > 1000) {
      suggestions.push('Consider implementing caching for slow endpoints');
      suggestions.push('Review database query performance');
    }

    if (avgPayloadSize > 1024 * 1024) {
      suggestions.push('Consider pagination for large data sets');
      suggestions.push('Implement response compression');
    }

    const memoryUsage = this.getMemoryUsage();
    if (memoryUsage.heapUsed > 100 * 1024 * 1024) {
      // 100MB
      suggestions.push(
        'Monitor memory usage and consider garbage collection optimization'
      );
    }

    return suggestions;
  }
}
