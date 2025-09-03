import fs from 'fs';
import path from 'path';
import { ConfigManager } from '../../core/config';

interface InitOptions {
  preset: string;
  framework: string;
  output: string;
  typescript: boolean;
}

export async function initCommand(options: InitOptions): Promise<void> {
  console.log('🔒 Initializing Secure Backend...');
  console.log(`Preset: ${options.preset}`);
  console.log(`Framework: ${options.framework}`);
  console.log(`Output: ${options.output}`);
  console.log(`TypeScript: ${options.typescript}`);

  try {
    // Create configuration
    const config = ConfigManager.createConfig(options.preset as any);

    // Generate configuration file
    const configContent = generateConfigFile(config, options);
    const configFileName = options.typescript
      ? 'secure-backend.config.ts'
      : 'secure-backend.config.js';
    const configPath = path.join(options.output, configFileName);

    fs.writeFileSync(configPath, configContent);
    console.log(`✅ Created configuration file: ${configPath}`);

    // Generate example file
    const exampleContent = generateExampleFile(options);
    const exampleFileName = options.typescript ? 'server.ts' : 'server.js';
    const examplePath = path.join(options.output, 'examples', exampleFileName);

    // Create examples directory
    const examplesDir = path.join(options.output, 'examples');
    if (!fs.existsSync(examplesDir)) {
      fs.mkdirSync(examplesDir, { recursive: true });
    }

    fs.writeFileSync(examplePath, exampleContent);
    console.log(`✅ Created example file: ${examplePath}`);

    // Generate package.json scripts if package.json exists
    const packageJsonPath = path.join(options.output, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      updatePackageJson(packageJsonPath, options);
      console.log(`✅ Updated package.json with security scripts`);
    }

    // Create .env template
    const envContent = generateEnvTemplate(options);
    const envPath = path.join(options.output, '.env.example');
    fs.writeFileSync(envPath, envContent);
    console.log(`✅ Created environment template: ${envPath}`);

    console.log('\n🎉 Secure Backend initialization complete!');
    console.log('\nNext steps:');
    console.log('1. Copy .env.example to .env and configure your secrets');
    console.log('2. Install dependencies: npm install secure-kit');
    console.log('3. Run the example: node examples/' + exampleFileName);
    console.log('4. Review and customize your configuration');
  } catch (error) {
    console.error('❌ Error initializing Secure Backend:', error);
    process.exit(1);
  }
}

function generateConfigFile(config: any, options: InitOptions): string {
  const isTypeScript = options.typescript;

  if (isTypeScript) {
    return `import { SecureBackendConfig } from 'secure-kit';

const config: SecureBackendConfig = ${JSON.stringify(config, null, 2)};

export default config;`;
  } else {
    return `const { ConfigManager } = require('secure-kit');

module.exports = ${JSON.stringify(config, null, 2)};`;
  }
}

function generateExampleFile(options: InitOptions): string {
  const isTypeScript = options.typescript;
  const framework = options.framework.toLowerCase();

  if (framework === 'express') {
    return generateExpressExample(isTypeScript);
  } else if (framework === 'koa') {
    return generateKoaExample(isTypeScript);
  } else if (framework === 'fastify') {
    return generateFastifyExample(isTypeScript);
  } else {
    return generateExpressExample(isTypeScript);
  }
}

function generateExpressExample(isTypeScript: boolean): string {
  if (isTypeScript) {
    return `import express from 'express';
import { ExpressAdapter } from 'secure-kit';
import config from '../secure-backend.config';

const app = express();
const secureBackend = new ExpressAdapter(config);

// Apply security middleware
app.use(secureBackend.createMiddleware());

// Basic JSON parsing
app.use(express.json());

// Example routes
app.get('/', (req, res) => {
  res.json({ message: 'Hello Secure World!' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(\`🚀 Secure server running on port \${port}\`);
});`;
  } else {
    return `const express = require('express');
const { ExpressAdapter } = require('secure-kit');
const config = require('../secure-backend.config');

const app = express();
const secureBackend = new ExpressAdapter(config);

// Apply security middleware
app.use(secureBackend.createMiddleware());

// Basic JSON parsing
app.use(express.json());

// Example routes
app.get('/', (req, res) => {
  res.json({ message: 'Hello Secure World!' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(\`🚀 Secure server running on port \${port}\`);
});`;
  }
}

function generateKoaExample(isTypeScript: boolean): string {
  if (isTypeScript) {
    return `import Koa from 'koa';
import { KoaAdapter } from 'secure-kit';
import config from '../secure-backend.config';

const app = new Koa();
const secureBackend = new KoaAdapter(config);

// Apply security middleware
app.use(secureBackend.createMiddleware());

// Example routes
app.use(async (ctx, next) => {
  if (ctx.path === '/') {
    ctx.body = { message: 'Hello Secure World!' };
  } else if (ctx.path === '/api/health') {
    ctx.body = { status: 'ok', timestamp: new Date().toISOString() };
  } else {
    await next();
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(\`🚀 Secure Koa server running on port \${port}\`);
});`;
  } else {
    return `const Koa = require('koa');
const { KoaAdapter } = require('secure-kit');
const config = require('../secure-backend.config');

const app = new Koa();
const secureBackend = new KoaAdapter(config);

// Apply security middleware
app.use(secureBackend.createMiddleware());

// Example routes
app.use(async (ctx, next) => {
  if (ctx.path === '/') {
    ctx.body = { message: 'Hello Secure World!' };
  } else if (ctx.path === '/api/health') {
    ctx.body = { status: 'ok', timestamp: new Date().toISOString() };
  } else {
    await next();
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(\`🚀 Secure Koa server running on port \${port}\`);
});`;
  }
}

function generateFastifyExample(isTypeScript: boolean): string {
  if (isTypeScript) {
    return `import fastify from 'fastify';
import { FastifyAdapter } from 'secure-kit';
import config from '../secure-backend.config';

const server = fastify({ logger: true });
const secureBackend = new FastifyAdapter(config);

// Register security plugin
server.register(secureBackend.createPlugin());

// Example routes
server.get('/', async (request, reply) => {
  return { message: 'Hello Secure World!' };
});

server.get('/api/health', async (request, reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

const start = async () => {
  try {
    const port = process.env.PORT || 3000;
    await server.listen({ port: +port });
    console.log(\`🚀 Secure Fastify server running on port \${port}\`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};
start();`;
  } else {
    return `const fastify = require('fastify');
const { FastifyAdapter } = require('secure-kit');
const config = require('../secure-backend.config');

const server = fastify({ logger: true });
const secureBackend = new FastifyAdapter(config);

// Register security plugin
server.register(secureBackend.createPlugin());

// Example routes
server.get('/', async (request, reply) => {
  return { message: 'Hello Secure World!' };
});

server.get('/api/health', async (request, reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

const start = async () => {
  try {
    const port = process.env.PORT || 3000;
    await server.listen({ port: +port });
    console.log(\`🚀 Secure Fastify server running on port \${port}\`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};
start();`;
  }
}

function updatePackageJson(
  packageJsonPath: string,
  options: InitOptions
): void {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  if (!packageJson.scripts) {
    packageJson.scripts = {};
  }

  // Add security-related scripts
  packageJson.scripts['security:audit'] = 'npx secure-backend audit';
  packageJson.scripts['security:check'] =
    'npm audit && npx secure-backend audit';
  packageJson.scripts['dev:secure'] =
    'NODE_ENV=development node examples/server.' +
    (options.typescript ? 'ts' : 'js');

  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
}

function generateEnvTemplate(_options: InitOptions): string {
  return `# Secure Backend Configuration
NODE_ENV=development
PORT=3000

# Security Secrets (CHANGE THESE IN PRODUCTION!)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
SESSION_SECRET=your-super-secret-session-key-change-this-in-production
CSRF_SECRET=your-super-secret-csrf-key-change-this-in-production

# HTTPS Configuration (for production)
FORCE_HTTPS=false

# Database (if applicable)
# DATABASE_URL=postgresql://user:password@localhost:5432/mydb

# Redis (for session storage)
# REDIS_URL=redis://localhost:6379

# CORS Origins (comma-separated)
# ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Rate Limiting
# RATE_LIMIT_WINDOW_MS=900000
# RATE_LIMIT_MAX_REQUESTS=100

# File Upload Limits
# MAX_FILE_SIZE=5242880
# ALLOWED_FILE_TYPES=image/jpeg,image/png,application/pdf`;
}
