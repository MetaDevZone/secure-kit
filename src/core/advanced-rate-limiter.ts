interface AdvancedRateLimitOptions {
  windowMs?: number;
  max?: number;
  maxRequests?: number;
  adaptive?: {
    enabled: boolean;
    baseMultiplier: number;
    recoveryTime: number;
  };
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
  violations: number;
}

export class AdvancedRateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private config: AdvancedRateLimitOptions;
  private cleanupInterval: NodeJS.Timeout;

  constructor(config: AdvancedRateLimitOptions) {
    this.config = {
      windowMs: 15 * 60 * 1000, // 15 minutes default
      max: 100,
      maxRequests: 100,
      ...config,
    };

    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  /**
   * Check if a request should be rate limited
   */
  isAllowed(identifier: string): {
    allowed: boolean;
    remaining: number;
    resetTime: number;
    retryAfter?: number;
  } {
    const now = Date.now();
    const limits = {
      windowMs: this.config.windowMs || 15 * 60 * 1000,
      maxRequests: this.config.maxRequests || this.config.max || 100,
    };

    let entry = this.store.get(identifier);

    if (!entry || now > entry.resetTime) {
      // Create new entry or reset expired one
      entry = {
        count: 0,
        resetTime: now + limits.windowMs,
        violations: entry?.violations || 0,
      };
    }

    // Check if limit exceeded
    if (entry.count >= limits.maxRequests) {
      entry.violations++;
      this.store.set(identifier, entry);

      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
        retryAfter: Math.ceil((entry.resetTime - now) / 1000),
      };
    }

    // Increment count and store
    entry.count++;
    this.store.set(identifier, entry);

    return {
      allowed: true,
      remaining: limits.maxRequests - entry.count,
      resetTime: entry.resetTime,
    };
  }

  /**
   * Clean up expired entries from store
   */
  private cleanup(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime && entry.violations === 0) {
        toDelete.push(key);
      }
    }

    toDelete.forEach(key => this.store.delete(key));
  }

  /**
   * Get current statistics
   */
  getStats(): {
    totalEntries: number;
    activeEntries: number;
    totalViolations: number;
  } {
    const now = Date.now();
    let activeEntries = 0;
    let totalViolations = 0;

    for (const entry of this.store.values()) {
      if (now <= entry.resetTime) {
        activeEntries++;
      }
      totalViolations += entry.violations;
    }

    return {
      totalEntries: this.store.size,
      activeEntries,
      totalViolations,
    };
  }

  /**
   * Reset rate limit for a specific identifier
   */
  reset(identifier: string): void {
    this.store.delete(identifier);
  }

  /**
   * Destroy the rate limiter and cleanup
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }
}
