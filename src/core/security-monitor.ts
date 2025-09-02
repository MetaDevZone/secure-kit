import { EventEmitter } from 'events';

export interface SecurityEvent {
  id: string;
  timestamp: number;
  type: SecurityEventType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  details: Record<string, any>;
  metadata: {
    userAgent?: string;
    ip?: string;
    userId?: string;
    sessionId?: string;
    requestId?: string;
  };
}

export enum SecurityEventType {
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  SUSPICIOUS_INPUT = 'suspicious_input',
  AUTHENTICATION_FAILURE = 'authentication_failure',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  SQL_INJECTION_ATTEMPT = 'sql_injection_attempt',
  XSS_ATTEMPT = 'xss_attempt',
  CSRF_TOKEN_MISMATCH = 'csrf_token_mismatch',
  FILE_UPLOAD_VIOLATION = 'file_upload_violation',
  SECURITY_HEADER_MISSING = 'security_header_missing',
  MALFORMED_REQUEST = 'malformed_request',
  BRUTE_FORCE_ATTEMPT = 'brute_force_attempt',
  ANOMALOUS_BEHAVIOR = 'anomalous_behavior',
}

export interface SecurityMetrics {
  totalEvents: number;
  eventsByType: Record<SecurityEventType, number>;
  eventsBySeverity: Record<string, number>;
  recentEvents: SecurityEvent[];
  topSources: Array<{ source: string; count: number }>;
  alertThresholds: {
    rateLimit: number;
    authFailures: number;
    injectionAttempts: number;
  };
}

export interface ThreatDetectionRule {
  id: string;
  name: string;
  description: string;
  eventTypes: SecurityEventType[];
  condition: (events: SecurityEvent[]) => boolean;
  action: 'log' | 'alert' | 'block';
  severity: 'low' | 'medium' | 'high' | 'critical';
  cooldown: number; // Minimum time between triggers in ms
}

export class SecurityMonitor extends EventEmitter {
  private events: SecurityEvent[] = [];
  private metrics: SecurityMetrics;
  private threatRules: Map<string, ThreatDetectionRule> = new Map();
  private lastRuleTrigger: Map<string, number> = new Map();
  private maxEventsHistory: number;

  constructor(
    config: {
      maxEventsHistory?: number;
      threatDetectionRules?: ThreatDetectionRule[];
    } = {}
  ) {
    super();

    this.maxEventsHistory = config.maxEventsHistory || 10000;
    this.metrics = this.initializeMetrics();

    // Load default threat detection rules
    this.loadDefaultThreatRules();

    // Load custom rules if provided
    if (config.threatDetectionRules) {
      config.threatDetectionRules.forEach(rule => this.addThreatRule(rule));
    }
  }

  /**
   * Record a security event
   */
  recordEvent(event: Omit<SecurityEvent, 'id' | 'timestamp'>): SecurityEvent {
    const fullEvent: SecurityEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      ...event,
    };

    // Add to events history
    this.events.push(fullEvent);

    // Maintain history size limit
    if (this.events.length > this.maxEventsHistory) {
      this.events.shift();
    }

    // Update metrics
    this.updateMetrics(fullEvent);

    // Check threat detection rules
    this.checkThreatRules(fullEvent);

    // Emit event for external listeners
    this.emit('securityEvent', fullEvent);

    return fullEvent;
  }

  /**
   * Get current security metrics
   */
  getMetrics(): SecurityMetrics {
    return { ...this.metrics };
  }

  /**
   * Get recent security events
   */
  getRecentEvents(limit: number = 100): SecurityEvent[] {
    return this.events.slice(-limit);
  }

  /**
   * Get events by type
   */
  getEventsByType(
    type: SecurityEventType,
    limit: number = 100
  ): SecurityEvent[] {
    return this.events.filter(event => event.type === type).slice(-limit);
  }

  /**
   * Get events by severity
   */
  getEventsBySeverity(
    severity: SecurityEvent['severity'],
    limit: number = 100
  ): SecurityEvent[] {
    return this.events
      .filter(event => event.severity === severity)
      .slice(-limit);
  }

  /**
   * Get events in time range
   */
  getEventsInRange(startTime: number, endTime: number): SecurityEvent[] {
    return this.events.filter(
      event => event.timestamp >= startTime && event.timestamp <= endTime
    );
  }

  /**
   * Add a threat detection rule
   */
  addThreatRule(rule: ThreatDetectionRule): void {
    this.threatRules.set(rule.id, rule);
  }

  /**
   * Remove a threat detection rule
   */
  removeThreatRule(ruleId: string): void {
    this.threatRules.delete(ruleId);
    this.lastRuleTrigger.delete(ruleId);
  }

  /**
   * Check if IP/source is currently exhibiting suspicious behavior
   */
  isSuspiciousSource(source: string, timeWindow: number = 300000): boolean {
    const cutoff = Date.now() - timeWindow;
    const recentEvents = this.events.filter(
      event =>
        event.source === source &&
        event.timestamp > cutoff &&
        (event.severity === 'high' || event.severity === 'critical')
    );

    return recentEvents.length > 5; // Threshold for suspicious behavior
  }

  /**
   * Generate security report for a time period
   */
  generateReport(
    startTime: number,
    endTime: number
  ): {
    summary: {
      totalEvents: number;
      criticalEvents: number;
      highSeverityEvents: number;
      uniqueSources: number;
    };
    topThreats: Array<{ type: SecurityEventType; count: number }>;
    suspiciousSources: string[];
    recommendations: string[];
  } {
    const events = this.getEventsInRange(startTime, endTime);

    const summary = {
      totalEvents: events.length,
      criticalEvents: events.filter(e => e.severity === 'critical').length,
      highSeverityEvents: events.filter(e => e.severity === 'high').length,
      uniqueSources: new Set(events.map(e => e.source)).size,
    };

    const threatCounts = new Map<SecurityEventType, number>();
    const sourceCounts = new Map<string, number>();

    events.forEach(event => {
      threatCounts.set(event.type, (threatCounts.get(event.type) || 0) + 1);
      sourceCounts.set(event.source, (sourceCounts.get(event.source) || 0) + 1);
    });

    const topThreats = Array.from(threatCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const suspiciousSources = Array.from(sourceCounts.entries())
      .filter(([_, count]) => count > 10)
      .map(([source, _]) => source);

    const recommendations = this.generateRecommendations(events);

    return {
      summary,
      topThreats,
      suspiciousSources,
      recommendations,
    };
  }

  /**
   * Clear all events and reset metrics
   */
  clear(): void {
    this.events = [];
    this.metrics = this.initializeMetrics();
    this.lastRuleTrigger.clear();
  }

  private initializeMetrics(): SecurityMetrics {
    return {
      totalEvents: 0,
      eventsByType: Object.values(SecurityEventType).reduce(
        (acc, type) => {
          acc[type] = 0;
          return acc;
        },
        {} as Record<SecurityEventType, number>
      ),
      eventsBySeverity: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      },
      recentEvents: [],
      topSources: [],
      alertThresholds: {
        rateLimit: 100,
        authFailures: 10,
        injectionAttempts: 5,
      },
    };
  }

  private updateMetrics(event: SecurityEvent): void {
    this.metrics.totalEvents++;
    this.metrics.eventsByType[event.type]++;
    this.metrics.eventsBySeverity[event.severity]++;

    // Update recent events (last 10)
    this.metrics.recentEvents.push(event);
    if (this.metrics.recentEvents.length > 10) {
      this.metrics.recentEvents.shift();
    }

    // Update top sources
    this.updateTopSources(event.source);
  }

  private updateTopSources(source: string): void {
    const existing = this.metrics.topSources.find(s => s.source === source);
    if (existing) {
      existing.count++;
    } else {
      this.metrics.topSources.push({ source, count: 1 });
    }

    // Sort and keep top 10
    this.metrics.topSources.sort((a, b) => b.count - a.count);
    this.metrics.topSources = this.metrics.topSources.slice(0, 10);
  }

  private generateEventId(): string {
    return `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private checkThreatRules(event: SecurityEvent): void {
    for (const [ruleId, rule] of this.threatRules) {
      if (!rule.eventTypes.includes(event.type)) continue;

      // Check cooldown
      const lastTrigger = this.lastRuleTrigger.get(ruleId);
      if (lastTrigger && Date.now() - lastTrigger < rule.cooldown) {
        continue;
      }

      // Check rule condition
      if (rule.condition(this.events)) {
        this.lastRuleTrigger.set(ruleId, Date.now());
        this.handleThreatDetection(rule, event);
      }
    }
  }

  private handleThreatDetection(
    rule: ThreatDetectionRule,
    triggerEvent: SecurityEvent
  ): void {
    const threatEvent: SecurityEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      type: SecurityEventType.ANOMALOUS_BEHAVIOR,
      severity: rule.severity,
      source: triggerEvent.source,
      details: {
        ruleName: rule.name,
        ruleDescription: rule.description,
        triggerEvent: triggerEvent.id,
        action: rule.action,
      },
      metadata: triggerEvent.metadata,
    };

    this.events.push(threatEvent);
    this.updateMetrics(threatEvent);

    // Emit threat detection event
    this.emit('threatDetected', {
      rule,
      triggerEvent,
      threatEvent,
    });

    // Take action based on rule
    switch (rule.action) {
      case 'block':
        this.emit('blockRequest', { source: triggerEvent.source, rule });
        break;
      case 'alert':
        this.emit('securityAlert', { rule, triggerEvent });
        break;
      case 'log':
        // Already logged by adding to events
        break;
    }
  }

  private loadDefaultThreatRules(): void {
    const defaultRules: ThreatDetectionRule[] = [
      {
        id: 'brute_force_detection',
        name: 'Brute Force Attack Detection',
        description:
          'Detects multiple authentication failures from the same source',
        eventTypes: [SecurityEventType.AUTHENTICATION_FAILURE],
        condition: events => {
          const recent = events.filter(
            e =>
              e.type === SecurityEventType.AUTHENTICATION_FAILURE &&
              Date.now() - e.timestamp < 300000 // 5 minutes
          );
          const sourceGroups = new Map<string, number>();
          recent.forEach(e => {
            sourceGroups.set(e.source, (sourceGroups.get(e.source) || 0) + 1);
          });
          return Array.from(sourceGroups.values()).some(count => count >= 5);
        },
        action: 'block',
        severity: 'high',
        cooldown: 600000, // 10 minutes
      },
      {
        id: 'injection_attack_pattern',
        name: 'Injection Attack Pattern',
        description: 'Detects patterns of SQL/NoSQL injection attempts',
        eventTypes: [SecurityEventType.SQL_INJECTION_ATTEMPT],
        condition: events => {
          const recent = events.filter(
            e =>
              e.type === SecurityEventType.SQL_INJECTION_ATTEMPT &&
              Date.now() - e.timestamp < 600000 // 10 minutes
          );
          return recent.length >= 3;
        },
        action: 'alert',
        severity: 'high',
        cooldown: 300000, // 5 minutes
      },
      {
        id: 'rate_limit_abuse',
        name: 'Rate Limit Abuse',
        description: 'Detects persistent rate limit violations',
        eventTypes: [SecurityEventType.RATE_LIMIT_EXCEEDED],
        condition: events => {
          const recent = events.filter(
            e =>
              e.type === SecurityEventType.RATE_LIMIT_EXCEEDED &&
              Date.now() - e.timestamp < 3600000 // 1 hour
          );
          const sourceGroups = new Map<string, number>();
          recent.forEach(e => {
            sourceGroups.set(e.source, (sourceGroups.get(e.source) || 0) + 1);
          });
          return Array.from(sourceGroups.values()).some(count => count >= 10);
        },
        action: 'block',
        severity: 'medium',
        cooldown: 1800000, // 30 minutes
      },
    ];

    defaultRules.forEach(rule => this.addThreatRule(rule));
  }

  private generateRecommendations(events: SecurityEvent[]): string[] {
    const recommendations: string[] = [];

    const criticalCount = events.filter(e => e.severity === 'critical').length;
    const highCount = events.filter(e => e.severity === 'high').length;

    if (criticalCount > 0) {
      recommendations.push(
        `${criticalCount} critical security events detected - immediate action required`
      );
    }

    if (highCount > 10) {
      recommendations.push(
        'High volume of high-severity events - consider tightening security policies'
      );
    }

    const injectionAttempts = events.filter(
      e =>
        e.type === SecurityEventType.SQL_INJECTION_ATTEMPT ||
        e.type === SecurityEventType.XSS_ATTEMPT
    ).length;

    if (injectionAttempts > 5) {
      recommendations.push(
        'Multiple injection attempts detected - review input validation and sanitization'
      );
    }

    const authFailures = events.filter(
      e => e.type === SecurityEventType.AUTHENTICATION_FAILURE
    ).length;

    if (authFailures > 20) {
      recommendations.push(
        'High number of authentication failures - consider implementing account lockout policies'
      );
    }

    return recommendations;
  }
}
