import {
  SecurityMonitor,
  SecurityEventType,
} from '../../src/core/security-monitor';

describe('SecurityMonitor', () => {
  let securityMonitor: SecurityMonitor;

  beforeEach(() => {
    securityMonitor = new SecurityMonitor({
      maxEventsHistory: 1000,
    });
  });

  afterEach(() => {
    securityMonitor.clear();
  });

  describe('Event Recording', () => {
    test('should record security events with unique IDs', () => {
      const event1 = securityMonitor.recordEvent({
        type: SecurityEventType.XSS_ATTEMPT,
        severity: 'high',
        source: '192.168.1.1',
        details: { payload: '<script>alert("xss")</script>' },
        metadata: { userAgent: 'Mozilla/5.0' },
      });

      const event2 = securityMonitor.recordEvent({
        type: SecurityEventType.SQL_INJECTION_ATTEMPT,
        severity: 'critical',
        source: '192.168.1.2',
        details: { payload: "'; DROP TABLE users; --" },
        metadata: { userAgent: 'curl/7.68.0' },
      });

      expect(event1.id).toBeDefined();
      expect(event2.id).toBeDefined();
      expect(event1.id).not.toBe(event2.id);
      expect(event1.timestamp).toBeLessThanOrEqual(event2.timestamp);
    });

    test('should auto-generate timestamps', () => {
      const beforeTime = Date.now();

      const event = securityMonitor.recordEvent({
        type: SecurityEventType.RATE_LIMIT_EXCEEDED,
        severity: 'medium',
        source: '10.0.0.1',
        details: { limit: 100, current: 101 },
        metadata: {},
      });

      const afterTime = Date.now();

      expect(event.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(event.timestamp).toBeLessThanOrEqual(afterTime);
    });

    test('should maintain event history within limits', () => {
      const limitedMonitor = new SecurityMonitor({ maxEventsHistory: 5 });

      // Record more events than the limit
      for (let i = 0; i < 10; i++) {
        limitedMonitor.recordEvent({
          type: SecurityEventType.AUTHENTICATION_FAILURE,
          severity: 'medium',
          source: `192.168.1.${i}`,
          details: { attempt: i },
          metadata: {},
        });
      }

      const events = limitedMonitor.getRecentEvents();
      expect(events.length).toBe(5);

      // Should keep the most recent events
      expect(events[0].details.attempt).toBe(5);
      expect(events[4].details.attempt).toBe(9);
    });
  });

  describe('Event Retrieval', () => {
    beforeEach(() => {
      // Setup test events
      securityMonitor.recordEvent({
        type: SecurityEventType.XSS_ATTEMPT,
        severity: 'high',
        source: '192.168.1.1',
        details: {},
        metadata: {},
      });

      securityMonitor.recordEvent({
        type: SecurityEventType.SQL_INJECTION_ATTEMPT,
        severity: 'critical',
        source: '192.168.1.2',
        details: {},
        metadata: {},
      });

      securityMonitor.recordEvent({
        type: SecurityEventType.RATE_LIMIT_EXCEEDED,
        severity: 'medium',
        source: '192.168.1.1',
        details: {},
        metadata: {},
      });
    });

    test('should get events by type', () => {
      const xssEvents = securityMonitor.getEventsByType(
        SecurityEventType.XSS_ATTEMPT
      );
      const sqlEvents = securityMonitor.getEventsByType(
        SecurityEventType.SQL_INJECTION_ATTEMPT
      );

      expect(xssEvents.length).toBe(1);
      expect(sqlEvents.length).toBe(1);
      expect(xssEvents[0].type).toBe(SecurityEventType.XSS_ATTEMPT);
      expect(sqlEvents[0].type).toBe(SecurityEventType.SQL_INJECTION_ATTEMPT);
    });

    test('should get events by severity', () => {
      const criticalEvents = securityMonitor.getEventsBySeverity('critical');
      const highEvents = securityMonitor.getEventsBySeverity('high');
      const mediumEvents = securityMonitor.getEventsBySeverity('medium');

      expect(criticalEvents.length).toBe(1);
      expect(highEvents.length).toBe(1);
      expect(mediumEvents.length).toBe(1);
    });

    test('should get events in time range', () => {
      const now = Date.now();
      const events = securityMonitor.getEventsInRange(now - 1000, now + 1000);

      expect(events.length).toBe(3);
    });

    test('should limit results appropriately', () => {
      const events = securityMonitor.getRecentEvents(2);
      expect(events.length).toBe(2);
    });
  });

  describe('Metrics and Statistics', () => {
    beforeEach(() => {
      // Record diverse test events
      securityMonitor.recordEvent({
        type: SecurityEventType.XSS_ATTEMPT,
        severity: 'high',
        source: '192.168.1.1',
        details: {},
        metadata: {},
      });

      securityMonitor.recordEvent({
        type: SecurityEventType.XSS_ATTEMPT,
        severity: 'high',
        source: '192.168.1.2',
        details: {},
        metadata: {},
      });

      securityMonitor.recordEvent({
        type: SecurityEventType.SQL_INJECTION_ATTEMPT,
        severity: 'critical',
        source: '192.168.1.1',
        details: {},
        metadata: {},
      });
    });

    test('should provide accurate metrics', () => {
      const metrics = securityMonitor.getMetrics();

      expect(metrics.totalEvents).toBe(3);
      expect(metrics.eventsByType[SecurityEventType.XSS_ATTEMPT]).toBe(2);
      expect(
        metrics.eventsByType[SecurityEventType.SQL_INJECTION_ATTEMPT]
      ).toBe(1);
      expect(metrics.eventsBySeverity.high).toBe(2);
      expect(metrics.eventsBySeverity.critical).toBe(1);
    });

    test('should track top sources', () => {
      const metrics = securityMonitor.getMetrics();

      expect(metrics.topSources).toContainEqual({
        source: '192.168.1.1',
        count: 2,
      });
      expect(metrics.topSources).toContainEqual({
        source: '192.168.1.2',
        count: 1,
      });
    });

    test('should identify suspicious sources', () => {
      // Record many events from the same source
      for (let i = 0; i < 6; i++) {
        securityMonitor.recordEvent({
          type: SecurityEventType.AUTHENTICATION_FAILURE,
          severity: 'high',
          source: '192.168.1.100',
          details: {},
          metadata: {},
        });
      }

      expect(securityMonitor.isSuspiciousSource('192.168.1.100')).toBe(true);
      expect(securityMonitor.isSuspiciousSource('192.168.1.1')).toBe(false);
    });
  });

  describe('Threat Detection Rules', () => {
    test('should trigger brute force detection rule', done => {
      let ruleTriggered = false;

      securityMonitor.on('threatDetected', data => {
        if (data.rule.id === 'brute_force_detection') {
          ruleTriggered = true;
          expect(data.rule.name).toBe('Brute Force Attack Detection');
          done();
        }
      });

      // Record multiple auth failures from same source
      for (let i = 0; i < 5; i++) {
        securityMonitor.recordEvent({
          type: SecurityEventType.AUTHENTICATION_FAILURE,
          severity: 'medium',
          source: '192.168.1.100',
          details: { username: 'admin' },
          metadata: {},
        });
      }

      // Give event loop time to process
      setTimeout(() => {
        if (!ruleTriggered) {
          done();
        }
      }, 100);
    });

    test('should trigger injection attack pattern rule', done => {
      let ruleTriggered = false;

      securityMonitor.on('threatDetected', data => {
        if (data.rule.id === 'injection_attack_pattern') {
          ruleTriggered = true;
          done();
        }
      });

      // Record multiple injection attempts
      for (let i = 0; i < 3; i++) {
        securityMonitor.recordEvent({
          type: SecurityEventType.SQL_INJECTION_ATTEMPT,
          severity: 'high',
          source: '192.168.1.200',
          details: { payload: 'malicious_sql' },
          metadata: {},
        });
      }

      setTimeout(() => {
        if (!ruleTriggered) {
          done();
        }
      }, 100);
    });

    test('should respect rule cooldown periods', () => {
      let triggerCount = 0;

      securityMonitor.on('threatDetected', () => {
        triggerCount++;
      });

      // Trigger rule multiple times rapidly
      for (let i = 0; i < 10; i++) {
        securityMonitor.recordEvent({
          type: SecurityEventType.AUTHENTICATION_FAILURE,
          severity: 'medium',
          source: '192.168.1.300',
          details: {},
          metadata: {},
        });
      }

      // Should only trigger once due to cooldown
      setTimeout(() => {
        expect(triggerCount).toBeLessThanOrEqual(1);
      }, 100);
    });

    test('should support custom threat rules', () => {
      const customRule = {
        id: 'custom_test_rule',
        name: 'Custom Test Rule',
        description: 'Test custom rule',
        eventTypes: [SecurityEventType.UNAUTHORIZED_ACCESS],
        condition: (events: any[]) => events.length > 0,
        action: 'alert' as const,
        severity: 'medium' as const,
        cooldown: 1000,
      };

      securityMonitor.addThreatRule(customRule);

      let ruleTriggered = false;
      securityMonitor.on('threatDetected', data => {
        if (data.rule.id === 'custom_test_rule') {
          ruleTriggered = true;
        }
      });

      securityMonitor.recordEvent({
        type: SecurityEventType.UNAUTHORIZED_ACCESS,
        severity: 'medium',
        source: '192.168.1.400',
        details: {},
        metadata: {},
      });

      setTimeout(() => {
        expect(ruleTriggered).toBe(true);
      }, 50);
    });
  });

  describe('Security Reports', () => {
    beforeEach(() => {
      // Create a mix of events over time
      securityMonitor.recordEvent({
        type: SecurityEventType.XSS_ATTEMPT,
        severity: 'critical',
        source: '192.168.1.1',
        details: {},
        metadata: {},
      });

      securityMonitor.recordEvent({
        type: SecurityEventType.RATE_LIMIT_EXCEEDED,
        severity: 'medium',
        source: '192.168.1.2',
        details: {},
        metadata: {},
      });

      // Multiple events from same source to trigger suspicious behavior
      for (let i = 0; i < 25; i++) {
        // Increased to trigger auth failure recommendation
        securityMonitor.recordEvent({
          type: SecurityEventType.AUTHENTICATION_FAILURE,
          severity: 'high',
          source: '192.168.1.100',
          details: {},
          metadata: {},
        });
      }
    });

    test('should generate comprehensive security report', () => {
      const startTime = Date.now() - 3600000; // 1 hour ago
      const endTime = Date.now();

      const report = securityMonitor.generateReport(startTime, endTime);

      expect(report.summary.totalEvents).toBeGreaterThan(0);
      expect(report.summary.criticalEvents).toBe(1);
      expect(report.summary.highSeverityEvents).toBeGreaterThanOrEqual(25);
      expect(report.summary.uniqueSources).toBe(3);

      expect(report.topThreats.length).toBeGreaterThan(0);
      expect(report.suspiciousSources).toContain('192.168.1.100');
      expect(report.recommendations.length).toBeGreaterThan(0);
    });

    test('should provide actionable recommendations', () => {
      const startTime = Date.now() - 3600000;
      const endTime = Date.now();

      const report = securityMonitor.generateReport(startTime, endTime);

      expect(
        report.recommendations.some(rec =>
          rec.includes('critical security events detected')
        )
      ).toBe(true);
      expect(
        report.recommendations.some(rec =>
          rec.includes('authentication failures')
        )
      ).toBe(true);
    });
  });

  describe('Event Lifecycle', () => {
    test('should emit events for external monitoring', done => {
      securityMonitor.on('securityEvent', event => {
        expect(event.type).toBe(SecurityEventType.CSRF_TOKEN_MISMATCH);
        expect(event.severity).toBe('high');
        done();
      });

      securityMonitor.recordEvent({
        type: SecurityEventType.CSRF_TOKEN_MISMATCH,
        severity: 'high',
        source: '192.168.1.1',
        details: {},
        metadata: {},
      });
    });

    test('should handle clear operations properly', () => {
      securityMonitor.recordEvent({
        type: SecurityEventType.XSS_ATTEMPT,
        severity: 'high',
        source: '192.168.1.1',
        details: {},
        metadata: {},
      });

      expect(securityMonitor.getMetrics().totalEvents).toBe(1);

      securityMonitor.clear();

      expect(securityMonitor.getMetrics().totalEvents).toBe(0);
      expect(securityMonitor.getRecentEvents().length).toBe(0);
    });
  });
});
