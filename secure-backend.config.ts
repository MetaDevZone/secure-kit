import { SecureBackendConfig } from 'secure-backend';

const config: SecureBackendConfig = {
  "security": {
    "headers": {
      "csp": {
        "defaultSrc": [
          "'self'"
        ],
        "scriptSrc": [
          "'self'",
          "'unsafe-inline'"
        ],
        "styleSrc": [
          "'self'",
          "'unsafe-inline'"
        ],
        "imgSrc": [
          "'self'",
          "data:",
          "https:"
        ],
        "connectSrc": [
          "'self'"
        ],
        "fontSrc": [
          "'self'",
          "https://fonts.gstatic.com"
        ],
        "objectSrc": [
          "'none'"
        ],
        "mediaSrc": [
          "'self'"
        ],
        "frameSrc": [
          "'self'"
        ]
      },
      "referrerPolicy": "strict-origin-when-cross-origin",
      "xContentTypeOptions": true,
      "xFrameOptions": "SAMEORIGIN",
      "permissionsPolicy": {
        "camera": [
          "()"
        ],
        "microphone": [
          "()"
        ],
        "geolocation": [
          "()"
        ],
        "payment": [
          "()"
        ]
      },
      "crossOriginResourcePolicy": "same-site",
      "crossOriginEmbedderPolicy": "credentialless",
      "crossOriginOpenerPolicy": "same-origin-allow-popups"
    },
    "cors": {
      "origin": true,
      "credentials": true,
      "methods": [
        "GET",
        "POST",
        "PUT",
        "DELETE",
        "OPTIONS"
      ]
    },
    "csrf": {
      "enabled": true,
      "tokenLength": 32,
      "cookieName": "csrf-token",
      "headerName": "X-CSRF-Token",
      "excludedMethods": [
        "GET",
        "HEAD",
        "OPTIONS"
      ]
    },
    "rateLimit": {
      "enabled": true,
      "windowMs": 900000,
      "max": 200,
      "message": "Too many requests from this IP",
      "statusCode": 429
    },
    "sanitization": {
      "enabled": true,
      "xss": true,
      "sqlInjection": true,
      "noSqlInjection": true,
      "maxBodySize": 10485760,
      "maxQuerySize": 2048
    },
    "auth": {
      "jwt": {
        "algorithms": [
          "HS256",
          "RS256"
        ],
        "maxAge": 86400
      },
      "session": {
        "maxAge": 86400000,
        "httpOnly": true,
        "secure": false,
        "sameSite": "strict"
      }
    },
    "fileUpload": {
      "enabled": true,
      "maxFileSize": 10485760,
      "allowedMimeTypes": [
        "image/jpeg",
        "image/png",
        "image/gif",
        "application/pdf",
        "text/plain"
      ],
      "allowedExtensions": [
        "jpg",
        "jpeg",
        "png",
        "gif",
        "pdf",
        "txt"
      ],
      "stripMetadata": true
    }
  },
  "performance": {
    "compression": {
      "enabled": true,
      "threshold": 512,
      "level": 6,
      "brotli": true
    },
    "caching": {
      "enabled": true,
      "maxAge": 3600,
      "etag": true,
      "lastModified": true
    },
    "monitoring": {
      "enabled": true,
      "logSlowRequests": true,
      "slowRequestThreshold": 2000,
      "logLargePayloads": true,
      "largePayloadThreshold": 5242880
    }
  },
  "logging": {
    "enabled": true,
    "level": "info",
    "format": "text",
    "suspiciousRequests": true,
    "failedLogins": true,
    "rateLimitViolations": true
  },
  "environment": {
    "production": false,
    "https": false
  }
};

export default config;
