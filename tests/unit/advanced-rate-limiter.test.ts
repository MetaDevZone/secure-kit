import { AdvancedRateLimiter } from '../../src/core/advanced-rate-limiter';

describe('AdvancedRateLimiter', () => {
  let rateLimiter: AdvancedRateLimiter;

  beforeEach(() => {
    rateLimiter = new AdvancedRateLimiter({
      windowMs: 60000, // 1 minute
      maxRequests: 10,
      adaptive: {
        enabled: true,
        baseMultiplier: 0.5,
        recoveryTime: 300000, // 5 minutes
      },
    });
  });

  afterEach(() => {
    rateLimiter.destroy();
  });

  describe('Basic Rate Limiting', () => {
    it('should allow requests within limit', () => {
      const result = rateLimiter.isAllowed('user1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });

    it('should block requests when limit exceeded', () => {
      // Use up all allowed requests
      for (let i = 0; i < 10; i++) {
        rateLimiter.isAllowed('user2');
      }

      const result = rateLimiter.isAllowed('user2');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should reset after window expires', (done) => {
      // Use up all requests
      for (let i = 0; i < 10; i++) {
        rateLimiter.isAllowed('user3');
      }

      // Should be blocked
      expect(rateLimiter.isAllowed('user3').allowed).toBe(false);

      // Wait for window to reset (shortened for test)
      rateLimiter = new AdvancedRateLimiter({
        windowMs: 100, // 100ms for quick test
        maxRequests: 5,
      });

      for (let i = 0; i < 5; i++) {
        rateLimiter.isAllowed('user4');
      }

      expect(rateLimiter.isAllowed('user4').allowed).toBe(false);

      setTimeout(() => {
        expect(rateLimiter.isAllowed('user4').allowed).toBe(true);
        done();
      }, 150);
    });
  });

  describe('Statistics', () => {
    it('should provide accurate statistics', () => {
      rateLimiter.isAllowed('user5');
      rateLimiter.isAllowed('user6');

      const stats = rateLimiter.getStats();
      expect(stats.totalEntries).toBe(2);
      expect(stats.activeEntries).toBe(2);
    });

    it('should track violations', () => {
      // Use up all requests to create violations
      for (let i = 0; i < 15; i++) {
        rateLimiter.isAllowed('user7');
      }

      const stats = rateLimiter.getStats();
      expect(stats.totalViolations).toBeGreaterThan(0);
    });
  });

  describe('Management', () => {
    it('should reset specific user limits', () => {
      // Use up requests
      for (let i = 0; i < 10; i++) {
        rateLimiter.isAllowed('user8');
      }

      expect(rateLimiter.isAllowed('user8').allowed).toBe(false);

      // Reset and try again
      rateLimiter.reset('user8');
      expect(rateLimiter.isAllowed('user8').allowed).toBe(true);
    });

    it('should cleanup properly on destroy', () => {
      rateLimiter.isAllowed('user9');
      expect(rateLimiter.getStats().totalEntries).toBe(1);

      rateLimiter.destroy();
      expect(rateLimiter.getStats().totalEntries).toBe(0);
    });
  });
});
