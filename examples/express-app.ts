import express from 'express';
import cookieParser from 'cookie-parser';
import { ExpressAdapter } from '../src/adapters/express';
import { ConfigManager } from '../src/core/config';

// Extend Express Request interface for TypeScript
declare global {
  namespace Express {
    interface Request {
      user?: any;
      files?: any;
    }
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

// Parse cookies for CSRF protection
app.use(cookieParser());

// Parse JSON bodies
app.use(express.json());

// Create secure backend configuration
const config = ConfigManager.createConfig({
  preset: 'api',
  security: {
    cors: {
      origin: ['http://localhost:3000', 'https://myapp.com'],
      credentials: true,
    },
    csrf: {
      enabled: true,
      tokenLength: 32,
      cookieName: 'csrf-token',
      headerName: 'X-CSRF-Token',
    },
    rateLimit: {
      enabled: true,
      max: 100,
      windowMs: 15 * 60 * 1000, // 15 minutes
    },
    sanitization: {
      enabled: true,
      xss: true,
      sqlInjection: true,
      noSqlInjection: true,
    },
    auth: {
      jwt: {
        secret: process.env.JWT_SECRET || 'your-secret-key',
        algorithms: ['HS256'],
        maxAge: 3600, // 1 hour
      },
    },
    fileUpload: {
      enabled: true,
      maxFileSize: 5 * 1024 * 1024, // 5MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
      allowedExtensions: ['jpg', 'jpeg', 'png', 'pdf'],
    },
  },
  performance: {
    compression: {
      enabled: true,
      threshold: 1024,
      level: 6,
      brotli: true,
    },
    caching: {
      enabled: true,
      maxAge: 300, // 5 minutes
      etag: true,
      lastModified: true,
    },
    monitoring: {
      enabled: true,
      logSlowRequests: true,
      slowRequestThreshold: 1000,
      logLargePayloads: true,
      largePayloadThreshold: 1024 * 1024,
    },
  },
  logging: {
    enabled: true,
    level: 'info',
    format: 'json',
    suspiciousRequests: true,
    failedLogins: true,
    rateLimitViolations: true,
  },
  environment: {
    production: process.env.NODE_ENV === 'production',
    https: process.env.NODE_ENV === 'production',
  },
});

// Create and apply secure backend middleware
const secureAdapter = new ExpressAdapter(config);
secureAdapter.applyMiddleware(app);

// Example routes
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Secure Backend API',
    timestamp: new Date().toISOString(),
    user: req.user || null,
  });
});

// Protected route example
app.get('/protected', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  return res.json({
    message: 'This is a protected route',
    user: req.user,
  });
});

// Example route with input validation
app.post('/users', (req, res) => {
  const { name, email, age } = req.body;

  // Input is already sanitized by the middleware
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  return res.json({
    message: 'User created successfully',
    user: { name, email, age },
  });
});

// Example route with file upload
app.post('/upload', (req, res) => {
  if (!req.files || Object.keys(req.files).length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  const uploadedFiles = Array.isArray(req.files)
    ? req.files
    : Object.values(req.files);

  return res.json({
    message: 'Files uploaded successfully',
    files: uploadedFiles.map((file: any) => ({
      name: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
    })),
  });
});

// Example route that triggers rate limiting
app.get('/api/heavy-operation', (_req, res) => {
  // Simulate heavy operation
  setTimeout(() => {
    res.json({
      message: 'Heavy operation completed',
      timestamp: new Date().toISOString(),
    });
  }, 100);
});

// Error handling middleware
app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Secure Backend Express App running on port ${PORT}`);
  console.log(
    `📊 Performance metrics: http://localhost:${PORT}/performance-metrics`
  );
  console.log(`🔒 Security events: http://localhost:${PORT}/security-events`);
  console.log(`⚙️  Config summary: http://localhost:${PORT}/config-summary`);
  console.log(`🛡️  CSRF token: http://localhost:${PORT}/csrf-token`);
});

export default app;
