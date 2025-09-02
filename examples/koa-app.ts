import Koa from 'koa';
import { KoaAdapter } from '../src/adapters/koa';
import { ConfigManager } from '../src/core/config';

// Extend Koa Request/Context for TypeScript
declare module 'koa' {
  interface Request {
    body?: any;
    files?: any;
  }

  interface Context {
    user?: any;
  }
}

const app = new Koa();
const PORT = process.env.PORT || 3000;

// Create secure backend configuration
const config = ConfigManager.createConfig({
  preset: 'webapp',
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
      max: 200,
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
const secureAdapter = new KoaAdapter(config);
secureAdapter.applyMiddleware(app);

// Example routes
app.use(async (ctx, next) => {
  if (ctx.path === '/' && ctx.method === 'GET') {
    ctx.body = {
      message: 'Welcome to Secure Backend Koa API',
      timestamp: new Date().toISOString(),
      user: ctx.user || null,
    };
    return;
  }
  await next();
});

// Protected route example
app.use(async (ctx, next) => {
  if (ctx.path === '/protected' && ctx.method === 'GET') {
    if (!ctx.user) {
      ctx.status = 401;
      ctx.body = { error: 'Authentication required' };
      return;
    }

    ctx.body = {
      message: 'This is a protected route',
      user: ctx.user,
    };
    return;
  }
  await next();
});

// Example route with input validation
app.use(async (ctx, next) => {
  if (ctx.path === '/users' && ctx.method === 'POST') {
    const { name, email, age } = ctx.request.body || {};

    // Input is already sanitized by the middleware
    if (!name || !email) {
      ctx.status = 400;
      ctx.body = { error: 'Name and email are required' };
      return;
    }

    ctx.body = {
      message: 'User created successfully',
      user: { name, email, age },
    };
    return;
  }
  await next();
});

// Example route with file upload
app.use(async (ctx, next) => {
  if (ctx.path === '/upload' && ctx.method === 'POST') {
    if (!ctx.request.files || Object.keys(ctx.request.files).length === 0) {
      ctx.status = 400;
      ctx.body = { error: 'No files uploaded' };
      return;
    }

    const uploadedFiles = Array.isArray(ctx.request.files)
      ? ctx.request.files
      : Object.values(ctx.request.files);

    ctx.body = {
      message: 'Files uploaded successfully',
      files: uploadedFiles.map((file: any) => ({
        name: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
      })),
    };
    return;
  }
  await next();
});

// Example route that triggers rate limiting
app.use(async (ctx, next) => {
  if (ctx.path === '/api/heavy-operation' && ctx.method === 'GET') {
    // Simulate heavy operation
    await new Promise(resolve => setTimeout(resolve, 100));

    ctx.body = {
      message: 'Heavy operation completed',
      timestamp: new Date().toISOString(),
    };
    return;
  }
  await next();
});

// Error handling middleware
app.on('error', (err, ctx) => {
  console.error('Error:', err);
  if (ctx && !ctx.headerSent) {
    ctx.status = 500;
    ctx.body = { error: 'Internal server error' };
  }
});

// 404 handler
app.use(async ctx => {
  ctx.status = 404;
  ctx.body = { error: 'Route not found' };
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Secure Backend Koa App running on port ${PORT}`);
  console.log(
    `📊 Performance metrics: http://localhost:${PORT}/performance-metrics`
  );
  console.log(`🔒 Security events: http://localhost:${PORT}/security-events`);
  console.log(`⚙️  Config summary: http://localhost:${PORT}/config-summary`);
  console.log(`🛡️  CSRF token: http://localhost:${PORT}/csrf-token`);
});
