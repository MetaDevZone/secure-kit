import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import { FastifyAdapter } from '../src/adapters/fastify';
import { ConfigManager } from '../src/core/config';

// Extend Fastify Request for TypeScript
declare module 'fastify' {
  interface FastifyRequest {
    user?: any;
    files?: any;
  }
}

const fastify = Fastify({
  logger: {
    level: 'info',
  },
});

const PORT = process.env.PORT || 3000;

// Create secure backend configuration
const config = ConfigManager.createConfig({
  preset: 'webapp',
  security: {
    cors: {
      origin: ['http://localhost:3000', 'https://myapp.com'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
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
        maxAge: 24 * 3600, // 24 hours
      },
    },
    fileUpload: {
      enabled: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedMimeTypes: [
        'image/jpeg',
        'image/png',
        'application/pdf',
        'text/plain',
      ],
      allowedExtensions: ['jpg', 'jpeg', 'png', 'pdf', 'txt'],
    },
  },
  performance: {
    compression: {
      enabled: true,
      threshold: 512,
      level: 6,
      brotli: true,
    },
    caching: {
      enabled: true,
      maxAge: 3600, // 1 hour
      etag: true,
      lastModified: true,
    },
    monitoring: {
      enabled: true,
      logSlowRequests: true,
      slowRequestThreshold: 2000,
      logLargePayloads: true,
      largePayloadThreshold: 5 * 1024 * 1024,
    },
  },
  logging: {
    enabled: true,
    level: 'info',
    format: 'text',
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
const secureAdapter = new FastifyAdapter(config);
secureAdapter.applyMiddleware(fastify);

// Example routes
fastify.get('/', async (request, reply) => {
  return {
    message: 'Welcome to Secure Backend Fastify App',
    timestamp: new Date().toISOString(),
    user: (request as any).user || null,
  };
});

// Protected route example
fastify.get('/protected', async (request, reply) => {
  if (!(request as any).user) {
    reply.status(401);
    return { error: 'Authentication required' };
  }

  return {
    message: 'This is a protected route',
    user: (request as any).user,
  };
});

// Example route with input validation
fastify.post('/users', async (request, reply) => {
  const { name, email, age } = request.body as any;

  // Input is already sanitized by the middleware
  if (!name || !email) {
    reply.status(400);
    return { error: 'Name and email are required' };
  }

  return {
    message: 'User created successfully',
    user: { name, email, age },
  };
});

// Example route with file upload
fastify.post('/upload', async (request, reply) => {
  const files = await request.files();

  if (!files || files.length === 0) {
    reply.status(400);
    return { error: 'No files uploaded' };
  }

  return {
    message: 'Files uploaded successfully',
    files: files.map(file => ({
      name: file.filename,
      size: file.file.bytesRead,
      mimetype: file.mimetype,
    })),
  };
});

// Example route that triggers rate limiting
fastify.get('/api/heavy-operation', async (request, reply) => {
  // Simulate heavy operation
  await new Promise(resolve => setTimeout(resolve, 100));

  return {
    message: 'Heavy operation completed',
    timestamp: new Date().toISOString(),
  };
});

// Example route with query parameters
fastify.get('/search', async (request, reply) => {
  const { q, page, limit } = request.query as any;

  // Query parameters are already sanitized by the middleware
  return {
    message: 'Search results',
    query: q,
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 10,
    results: [],
  };
});

// Example route with path parameters
fastify.get('/users/:id', async (request, reply) => {
  const { id } = request.params as any;

  // Path parameters are already sanitized by the middleware
  return {
    message: 'User details',
    id,
    user: {
      id,
      name: 'John Doe',
      email: 'john@example.com',
    },
  };
});

// Start server
const start = async () => {
  try {
    await fastify.listen(PORT, '0.0.0.0');
    console.log(`🚀 Secure Backend Fastify App running on port ${PORT}`);
    console.log(
      `📊 Performance metrics: http://localhost:${PORT}/performance-metrics`
    );
    console.log(`🔒 Security events: http://localhost:${PORT}/security-events`);
    console.log(`⚙️  Config summary: http://localhost:${PORT}/config-summary`);
    console.log(`🛡️  CSRF token: http://localhost:${PORT}/csrf-token`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

export default fastify;
