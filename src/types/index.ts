// Type-only imports for framework-specific types
import type { NextFunction } from 'express';

// Framework-agnostic request/response interfaces
export interface SecureRequest {
  headers: Record<string, string | string[] | undefined>;
  method: string;
  url: string;
  ip: string;
  body?: any;
  query?: any;
  params?: any;
  cookies?: Record<string, string>;
  get(name: string): string | undefined;
  set(name: string, value: string): void;
}

export interface SecureResponse {
  status(code: number): SecureResponse;
  set(name: string, value: string): SecureResponse;
  json(data: any): SecureResponse;
  send(data: any): SecureResponse;
  end(): SecureResponse;
}

export interface SecureContext {
  req: SecureRequest;
  res: SecureResponse;
  next?: NextFunction;
}

// Security Configuration Types
export interface SecureBackendConfig {
  preset?: string;
  security?: {
    headers?: {
      hsts?: {
        maxAge?: number;
        includeSubDomains?: boolean;
        preload?: boolean;
      };
      csp?: {
        defaultSrc?: string[];
        scriptSrc?: string[];
        styleSrc?: string[];
        imgSrc?: string[];
        connectSrc?: string[];
        fontSrc?: string[];
        objectSrc?: string[];
        mediaSrc?: string[];
        frameSrc?: string[];
        reportUri?: string;
        reportOnly?: boolean;
      };
      referrerPolicy?: string;
      xContentTypeOptions?: boolean;
      xFrameOptions?: string;
      permissionsPolicy?: Record<string, string[]>;
      crossOriginResourcePolicy?: string;
      crossOriginEmbedderPolicy?: string;
      crossOriginOpenerPolicy?: string;
    };
    cors?: {
      origin?:
        | string
        | string[]
        | RegExp
        | boolean
        | ((origin: string) => boolean);
      methods?: string[];
      credentials?: boolean;
    };
    csrf?: {
      enabled?: boolean;
      tokenLength?: number;
      cookieName?: string;
      headerName?: string;
      excludedMethods?: string[];
      cookieOptions?: {
        httpOnly?: boolean;
        secure?: boolean;
        sameSite?: string;
        maxAge?: number;
      };
    };
    rateLimit?: {
      enabled?: boolean;
      windowMs?: number;
      max?: number;
      message?: string;
      statusCode?: number;
    };
    sanitization?: SanitizationConfig;
    auth?: {
      jwt?: {
        secret?: string;
        issuer?: string;
        audience?: string;
        algorithms?: string[];
        maxAge?: number;
      };
      session?: {
        secret?: string;
        maxAge?: number;
        httpOnly?: boolean;
        secure?: boolean;
        sameSite?: string;
      };
    };
    fileUpload?: {
      enabled?: boolean;
      maxFileSize?: number;
      allowedMimeTypes?: string[];
      allowedExtensions?: string[];
      stripMetadata?: boolean;
    };
  };
  performance?: {
    compression?: {
      enabled?: boolean;
      threshold?: number;
      level?: number;
      brotli?: boolean;
    };
    caching?: {
      enabled?: boolean;
      maxAge?: number;
      etag?: boolean;
      lastModified?: boolean;
    };
    monitoring?: {
      enabled?: boolean;
      logSlowRequests?: boolean;
      slowRequestThreshold?: number;
      logLargePayloads?: boolean;
      largePayloadThreshold?: number;
    };
  };
  environment?: {
    https?: boolean;
    production?: boolean;
  };
  logging?: {
    enabled?: boolean;
    level?: string;
    format?: string;
    suspiciousRequests?: boolean;
    failedLogins?: boolean;
    rateLimitViolations?: boolean;
    customLogger?: (level: string, message: string, details?: any) => void;
  };
}

export interface SanitizationConfig {
  enabled?: boolean;
  xss?: boolean;
  sqlInjection?: boolean;
  noSqlInjection?: boolean;
  maxBodySize?: number;
  maxQuerySize?: number;
}

export interface PerformanceMetrics {
  requestTime: number;
  payloadSize: number;
  memoryUsage: number;
  timestamp: Date;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedData: any;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
}

export interface SecurityEvent {
  type:
    | 'csrf_violation'
    | 'rate_limit_exceeded'
    | 'xss_attempt'
    | 'sql_injection'
    | 'auth_failure'
    | 'suspicious_request';
  timestamp: Date;
  ip: string;
  details: Record<string, any>;
}

// Re-export the NextFunction type for convenience
export type { NextFunction };
