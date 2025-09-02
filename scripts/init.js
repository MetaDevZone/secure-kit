#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const packageName = 'secure-backend';

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

// Preset configurations
const presets = {
  api: {
    name: 'API Server',
    description: 'Secure configuration for REST API servers',
    config: {
      preset: 'api',
      security: {
        headers: {
          enabled: true,
          hsts: { enabled: true, maxAge: 31536000 },
          csp: { enabled: true, reportOnly: false },
          xFrameOptions: 'DENY',
          xContentTypeOptions: true,
          referrerPolicy: 'strict-origin-when-cross-origin'
        },
        cors: {
          enabled: true,
          origin: ['http://localhost:3000', 'https://yourdomain.com'],
          credentials: true
        },
        rateLimit: {
          enabled: true,
          windowMs: 15 * 60 * 1000, // 15 minutes
          max: 100 // limit each IP to 100 requests per windowMs
        },
        csrf: { enabled: true },
        sanitization: { enabled: true },
        jwt: { enabled: true }
      },
      performance: {
        compression: { enabled: true },
        caching: { enabled: true },
        monitoring: { enabled: true }
      }
    }
  },
  webapp: {
    name: 'Web Application',
    description: 'Balanced security for web applications',
    config: {
      preset: 'webapp',
      security: {
        headers: {
          enabled: true,
          hsts: { enabled: true, maxAge: 31536000 },
          csp: { enabled: true, reportOnly: true },
          xFrameOptions: 'SAMEORIGIN',
          xContentTypeOptions: true,
          referrerPolicy: 'origin-when-cross-origin'
        },
        cors: {
          enabled: true,
          origin: true,
          credentials: true
        },
        rateLimit: {
          enabled: true,
          windowMs: 15 * 60 * 1000,
          max: 200
        },
        csrf: { enabled: true },
        sanitization: { enabled: true },
        jwt: { enabled: true }
      },
      performance: {
        compression: { enabled: true },
        caching: { enabled: true },
        monitoring: { enabled: true }
      }
    }
  },
  strict: {
    name: 'Maximum Security',
    description: 'Maximum security configuration for sensitive applications',
    config: {
      preset: 'strict',
      security: {
        headers: {
          enabled: true,
          hsts: { enabled: true, maxAge: 63072000, includeSubDomains: true, preload: true },
          csp: { enabled: true, reportOnly: false, strict: true },
          xFrameOptions: 'DENY',
          xContentTypeOptions: true,
          referrerPolicy: 'no-referrer',
          permissionsPolicy: { enabled: true }
        },
        cors: {
          enabled: true,
          origin: ['https://yourdomain.com'],
          credentials: false
        },
        rateLimit: {
          enabled: true,
          windowMs: 15 * 60 * 1000,
          max: 50
        },
        csrf: { enabled: true },
        sanitization: { enabled: true, strict: true },
        jwt: { enabled: true },
        fileUpload: { enabled: true, strict: true }
      },
      performance: {
        compression: { enabled: true },
        caching: { enabled: true },
        monitoring: { enabled: true }
      }
    }
  }
};

// Framework-specific templates
const frameworkTemplates = {
  express: {
    name: 'Express.js',
    template: `const express = require('express');
const { secureBackend, ExpressAdapter } = require('${packageName}');

const app = express();

// Configure secure-backend
const config = secureBackend({
  preset: 'api', // or 'webapp', 'strict'
  // Add custom overrides here
});

// Apply security middleware
const adapter = new ExpressAdapter(config);
adapter.applyMiddleware(app);

// Your routes here
app.get('/', (req, res) => {
  res.json({ message: 'Secure API is running!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(\`🚀 Secure server running on port \${PORT}\`);
});`
  },
  koa: {
    name: 'Koa.js',
    template: `const Koa = require('koa');
const { secureBackend, KoaAdapter } = require('${packageName}');

const app = new Koa();

// Configure secure-backend
const config = secureBackend({
  preset: 'api', // or 'webapp', 'strict'
  // Add custom overrides here
});

// Apply security middleware
const adapter = new KoaAdapter(config);
adapter.applyMiddleware(app);

// Your routes here
app.use(async (ctx) => {
  ctx.body = { message: 'Secure API is running!' };
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(\`🚀 Secure server running on port \${PORT}\`);
});`
  },
  fastify: {
    name: 'Fastify',
    template: `const fastify = require('fastify');
const { secureBackend, FastifyAdapter } = require('${packageName}');

const app = fastify();

// Configure secure-backend
const config = secureBackend({
  preset: 'api', // or 'webapp', 'strict'
  // Add custom overrides here
});

// Apply security middleware
const adapter = new FastifyAdapter(config);
adapter.applyMiddleware(app);

// Your routes here
app.get('/', async (request, reply) => {
  return { message: 'Secure API is running!' };
});

const PORT = process.env.PORT || 3000;
app.listen({ port: PORT }, () => {
  console.log(\`🚀 Secure server running on port \${PORT}\`);
});`
  }
};

function showHelp() {
  log('\n' + '='.repeat(60), 'bright');
  log('🔒 Secure Backend - Initialization Tool', 'bright');
  log('='.repeat(60), 'bright');
  
  log('\n📋 Available Commands:', 'cyan');
  log('  init [preset] [framework]  - Initialize a new secure backend project');
  log('  presets                    - Show available security presets');
  log('  frameworks                 - Show supported frameworks');
  log('  help                       - Show this help message');
  
  log('\n📦 Available Presets:', 'cyan');
  Object.entries(presets).forEach(([key, preset]) => {
    log(`  ${key.padEnd(10)} - ${preset.name}: ${preset.description}`, 'yellow');
  });
  
  log('\n⚙️  Supported Frameworks:', 'cyan');
  Object.entries(frameworkTemplates).forEach(([key, framework]) => {
    log(`  ${key.padEnd(10)} - ${framework.name}`, 'yellow');
  });
  
  log('\n💡 Examples:', 'cyan');
  log('  npx secure-backend init api express     - Express API with api preset');
  log('  npx secure-backend init webapp koa      - Koa webapp with webapp preset');
  log('  npx secure-backend init strict fastify  - Fastify with strict security');
  
  log('\n' + '='.repeat(60), 'bright');
}

function showPresets() {
  log('\n📦 Available Security Presets:', 'bright');
  log('='.repeat(50), 'bright');
  
  Object.entries(presets).forEach(([key, preset]) => {
    log(`\n🔸 ${preset.name} (${key})`, 'cyan');
    log(`   ${preset.description}`, 'yellow');
    
    const config = preset.config;
    log('   Features:', 'green');
    
    if (config.security.headers.enabled) log('   • Security Headers (HSTS, CSP, etc.)', 'green');
    if (config.security.cors.enabled) log('   • CORS Protection', 'green');
    if (config.security.rateLimit.enabled) log('   • Rate Limiting', 'green');
    if (config.security.csrf.enabled) log('   • CSRF Protection', 'green');
    if (config.security.sanitization.enabled) log('   • Input Sanitization', 'green');
    if (config.security.jwt.enabled) log('   • JWT Authentication', 'green');
    if (config.performance.compression.enabled) log('   • Response Compression', 'green');
    if (config.performance.caching.enabled) log('   • Response Caching', 'green');
  });
}

function showFrameworks() {
  log('\n⚙️  Supported Frameworks:', 'bright');
  log('='.repeat(40), 'bright');
  
  Object.entries(frameworkTemplates).forEach(([key, framework]) => {
    log(`\n🔸 ${framework.name} (${key})`, 'cyan');
    log('   Middleware adapter available', 'green');
    log('   Full TypeScript support', 'green');
    log('   Production-ready integration', 'green');
  });
}

function createConfigFile(preset, framework) {
  const configContent = JSON.stringify(presets[preset].config, null, 2);
  const configPath = 'secure-backend.config.json';
  
  try {
    fs.writeFileSync(configPath, configContent);
    logSuccess(`Created configuration file: ${configPath}`);
    return configPath;
  } catch (error) {
    logError(`Failed to create config file: ${error.message}`);
    return null;
  }
}

function createAppFile(framework) {
  const template = frameworkTemplates[framework].template;
  const appPath = `app.${framework === 'fastify' ? 'js' : 'js'}`;
  
  try {
    fs.writeFileSync(appPath, template);
    logSuccess(`Created application file: ${appPath}`);
    return appPath;
  } catch (error) {
    logError(`Failed to create app file: ${error.message}`);
    return null;
  }
}

function createPackageJson() {
  const packageJson = {
    name: 'my-secure-app',
    version: '1.0.0',
    description: 'Secure backend application',
    main: 'app.js',
    scripts: {
      start: 'node app.js',
      dev: 'nodemon app.js',
      test: 'jest'
    },
    dependencies: {
      [packageName]: '^0.1.0'
    },
    devDependencies: {
      nodemon: '^3.0.0',
      jest: '^29.7.0'
    }
  };
  
  try {
    fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
    logSuccess('Created package.json');
    return true;
  } catch (error) {
    logError(`Failed to create package.json: ${error.message}`);
    return false;
  }
}

function createReadme(preset, framework) {
  const presetInfo = presets[preset];
  const frameworkInfo = frameworkTemplates[framework];
  
  const readmeContent = `# Secure Backend Application

This is a secure backend application using ${frameworkInfo.name} with the **${presetInfo.name}** security preset.

## Features

${presetInfo.description}

### Security Features
- 🔒 Security Headers (HSTS, CSP, X-Frame-Options, etc.)
- 🌐 CORS Protection
- 🛡️ Rate Limiting
- 🔐 CSRF Protection
- 🧹 Input Sanitization
- 🔑 JWT Authentication
- 📁 Secure File Uploads

### Performance Features
- 🗜️ Response Compression
- 💾 Response Caching
- 📊 Performance Monitoring

## Getting Started

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Start the development server:
   \`\`\`bash
   npm run dev
   \`\`\`

3. Start the production server:
   \`\`\`bash
   npm start
   \`\`\`

## Configuration

The security configuration is defined in \`secure-backend.config.json\`. You can modify this file to adjust security settings according to your needs.

## Documentation

For more information about secure-backend, visit:
https://github.com/secure-backend/secure-backend

## Security

This application implements OWASP Top 10 security measures and follows security best practices for production deployments.
`;
  
  try {
    fs.writeFileSync('README.md', readmeContent);
    logSuccess('Created README.md');
    return true;
  } catch (error) {
    logError(`Failed to create README.md: ${error.message}`);
    return false;
  }
}

function initialize(preset, framework) {
  log('\n🚀 Initializing Secure Backend Project...', 'bright');
  log('='.repeat(50), 'bright');
  
  // Validate inputs
  if (!presets[preset]) {
    logError(`Invalid preset: ${preset}`);
    logInfo('Run "npx secure-backend init presets" to see available presets');
    return false;
  }
  
  if (!frameworkTemplates[framework]) {
    logError(`Invalid framework: ${framework}`);
    logInfo('Run "npx secure-backend init frameworks" to see supported frameworks');
    return false;
  }
  
  logInfo(`Using preset: ${presets[preset].name}`);
  logInfo(`Using framework: ${frameworkTemplates[framework].name}`);
  
  // Create files
  const configCreated = createConfigFile(preset, framework);
  const appCreated = createAppFile(framework);
  const packageCreated = createPackageJson();
  const readmeCreated = createReadme(preset, framework);
  
  if (configCreated && appCreated && packageCreated && readmeCreated) {
    log('\n🎉 Project initialized successfully!', 'bright');
    log('='.repeat(50), 'bright');
    
    log('\n📁 Created files:', 'cyan');
    log(`  • ${configCreated}`, 'green');
    log(`  • ${appCreated}`, 'green');
    log(`  • package.json`, 'green');
    log(`  • README.md`, 'green');
    
    log('\n🚀 Next steps:', 'cyan');
    log('  1. Install dependencies: npm install', 'yellow');
    log('  2. Start development: npm run dev', 'yellow');
    log('  3. Review configuration in secure-backend.config.json', 'yellow');
    
    log('\n⚠️  Important Security Notes:', 'red');
    log('  • Update CORS origins in config for production', 'yellow');
    log('  • Set strong JWT secrets in environment variables', 'yellow');
    log('  • Enable HTTPS in production', 'yellow');
    log('  • Review and customize security settings', 'yellow');
    
    return true;
  } else {
    logError('Failed to initialize project completely');
    return false;
  }
}

// Main execution
function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  switch (command) {
    case 'help':
    case '--help':
    case '-h':
      showHelp();
      break;
      
    case 'presets':
      showPresets();
      break;
      
    case 'frameworks':
      showFrameworks();
      break;
      
    case 'init':
      const preset = args[1] || 'api';
      const framework = args[2] || 'express';
      initialize(preset, framework);
      break;
      
    default:
      if (!command) {
        showHelp();
      } else {
        logError(`Unknown command: ${command}`);
        logInfo('Run "npx secure-backend init help" for usage information');
      }
  }
}

// Run the CLI
if (require.main === module) {
  main();
}

module.exports = {
  presets,
  frameworkTemplates,
  initialize,
  showHelp,
  showPresets,
  showFrameworks
};
