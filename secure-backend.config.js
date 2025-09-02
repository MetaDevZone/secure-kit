const { ConfigManager } = require('secure-backend');

module.exports = {
  "security": {
    "headers": {
      "csp": {
        "defaultSrc": [
          "'self'"
        ],
        "scriptSrc": [
          "'self'"
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
          "'self'"
        ],
        "objectSrc": [
          "'none'"
        ],
        "mediaSrc": [
          "'self'"
        ],
        "frameSrc": [
          "'none'"
        ]
      },
      "referrerPolicy": "strict-origin-when-cross-origin",
      "xContentTypeOptions": true,
      "xFrameOptions": "DENY",
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
      "crossOriginResourcePolicy": "same-origin",
      "crossOriginEmbedderPolicy": "require-corp",
      "crossOriginOpenerPolicy": "same-origin"
    },
    "cors": {
      "origin": false,
      "credentials": false
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
      "max": 100,
      "message": "Too many requests from this IP",
      "statusCode": 429
    },
    "sanitization": {
      "enabled": true,
      "xss": true,
      "sqlInjection": true,
      "noSqlInjection": true,
      "maxBodySize": 1048576,
      "maxQuerySize": 1024
    },
    "auth": {
      "jwt": {
        "algorithms": [
          "HS256",
          "RS256"
        ],
        "maxAge": 3600
      }
    },
    "fileUpload": {
      "enabled": true,
      "maxFileSize": 5242880,
      "allowedMimeTypes": [
        "image/jpeg",
        "image/png",
        "image/gif",
        "application/pdf"
      ],
      "allowedExtensions": [
        "jpg",
        "jpeg",
        "png",
        "gif",
        "pdf"
      ],
      "stripMetadata": true
    }
  },
  "performance": {
    "compression": {
      "enabled": true,
      "threshold": 1024,
      "level": 6,
      "brotli": true
    },
    "caching": {
      "enabled": true,
      "maxAge": 300,
      "etag": true,
      "lastModified": true
    },
    "monitoring": {
      "enabled": true,
      "logSlowRequests": true,
      "slowRequestThreshold": 1000,
      "logLargePayloads": true,
      "largePayloadThreshold": 1048576
    }
  },
  "logging": {
    "enabled": true,
    "level": "info",
    "format": "json",
    "suspiciousRequests": true,
    "failedLogins": true,
    "rateLimitViolations": true
  },
  "environment": {
    "production": false,
    "https": false
  }
};
