#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

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

function checkEnvironment() {
  const warnings = [];
  const info = [];
  
  // Check Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  
  if (majorVersion < 16) {
    warnings.push(`Node.js version ${nodeVersion} is below the recommended minimum (16.x)`);
  } else {
    info.push(`Node.js version ${nodeVersion} is compatible`);
  }
  
  // Check if running in development
  const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
  if (isDev) {
    info.push('Running in development mode - security warnings will be more verbose');
  }
  
  // Check for common security issues
  const envVars = process.env;
  
  // Check for weak secrets
  const weakSecrets = ['secret', 'password', '123456', 'admin', 'test'];
  const hasWeakSecret = Object.values(envVars).some(value => 
    weakSecrets.some(secret => 
      value && value.toLowerCase().includes(secret)
    )
  );
  
  if (hasWeakSecret) {
    warnings.push('Weak secrets detected in environment variables');
  }
  
  // Check for HTTPS
  const isHttps = envVars.HTTPS === 'true' || envVars.NODE_ENV === 'production';
  if (!isHttps && !isDev) {
    warnings.push('HTTPS is not enabled - required for production');
  }
  
  // Check for security headers
  const hasSecurityHeaders = envVars.SECURITY_HEADERS !== 'false';
  if (!hasSecurityHeaders) {
    warnings.push('Security headers are disabled');
  }
  
  return { warnings, info };
}

function showQuickStart() {
  log('\n🚀 Quick Start Guide:', 'bright');
  log('='.repeat(40), 'bright');
  
  log('\n1. Basic Express.js setup:', 'cyan');
  log('```javascript', 'yellow');
  log('const express = require("express");', 'yellow');
  log('const { secureBackend, ExpressAdapter } = require("secure-backend");', 'yellow');
  log('', 'yellow');
  log('const app = express();', 'yellow');
  log('const config = secureBackend({ preset: "api" });', 'yellow');
  log('const adapter = new ExpressAdapter(config);', 'yellow');
  log('adapter.applyMiddleware(app);', 'yellow');
  log('```', 'yellow');
  
  log('\n2. Initialize a new project:', 'cyan');
  log('npx secure-backend init api express', 'yellow');
  
  log('\n3. Available presets:', 'cyan');
  log('• api     - REST API security', 'green');
  log('• webapp  - Web application security', 'green');
  log('• strict  - Maximum security', 'green');
  
  log('\n4. Supported frameworks:', 'cyan');
  log('• Express.js', 'green');
  log('• Koa.js', 'green');
  log('• Fastify', 'green');
  log('• NestJS', 'green');
}

function showSecurityFeatures() {
  log('\n🔒 Security Features Included:', 'bright');
  log('='.repeat(40), 'bright');
  
  const features = [
    'HTTP Security Headers (HSTS, CSP, X-Frame-Options)',
    'CORS Protection',
    'CSRF Protection',
    'Rate Limiting',
    'Input Sanitization (XSS, SQL Injection)',
    'JWT Authentication & Validation',
    'Secure File Upload Validation',
    'DoS Protection',
    'Secure Redirects',
    'GraphQL Security (depth/cost limits)',
    'Environment Safety Checks'
  ];
  
  features.forEach(feature => {
    log(`• ${feature}`, 'green');
  });
}

function showPerformanceFeatures() {
  log('\n⚡ Performance Features Included:', 'bright');
  log('='.repeat(40), 'bright');
  
  const features = [
    'Response Compression (gzip, Brotli)',
    'Response Caching (ETag, Last-Modified)',
    'JSON Response Minification',
    'Payload Size Validation',
    'Response Time Monitoring',
    'Memory Usage Tracking',
    'Database Query Timeout Protection',
    'Connection Pool Monitoring'
  ];
  
  features.forEach(feature => {
    log(`• ${feature}`, 'green');
  });
}

function showDocumentation() {
  log('\n📚 Documentation & Resources:', 'bright');
  log('='.repeat(40), 'bright');
  
  log('\n• GitHub Repository:', 'cyan');
  log('  https://github.com/secure-backend/secure-backend', 'blue');
  
  log('\n• CLI Commands:', 'cyan');
  log('  npx secure-backend init help      - Show CLI help', 'yellow');
  log('  npx secure-backend init presets   - Show available presets', 'yellow');
  log('  npx secure-backend init frameworks - Show supported frameworks', 'yellow');
  
  log('\n• TypeScript Support:', 'cyan');
  log('  Full TypeScript definitions included', 'green');
  log('  Import types: import type { SecureBackendConfig } from "secure-backend"', 'yellow');
}

function showSecurityWarnings() {
  log('\n⚠️  Security Warnings:', 'bright');
  log('='.repeat(40), 'bright');
  
  const warnings = [
    'Always use HTTPS in production',
    'Set strong, unique JWT secrets',
    'Configure CORS origins for your domains',
    'Review and customize security settings',
    'Keep dependencies updated',
    'Monitor security events and logs',
    'Test security features thoroughly',
    'Follow OWASP security guidelines'
  ];
  
  warnings.forEach(warning => {
    log(`• ${warning}`, 'yellow');
  });
}

function main() {
  // Only run in interactive environments
  if (process.env.NODE_ENV === 'test' || process.env.CI) {
    return;
  }
  
  log('\n🔒 Secure Backend - Installation Complete!', 'bright');
  log('='.repeat(50), 'bright');
  
  // Check environment
  const { warnings, info } = checkEnvironment();
  
  if (info.length > 0) {
    log('\n📋 Environment Check:', 'cyan');
    info.forEach(item => logInfo(item));
  }
  
  if (warnings.length > 0) {
    log('\n⚠️  Security Warnings:', 'red');
    warnings.forEach(warning => logWarning(warning));
  }
  
  // Show features
  showSecurityFeatures();
  showPerformanceFeatures();
  
  // Show quick start
  showQuickStart();
  
  // Show documentation
  showDocumentation();
  
  // Show security warnings
  showSecurityWarnings();
  
  log('\n🎉 You\'re all set! Start building secure applications.', 'bright');
  log('For help: npx secure-backend init help', 'cyan');
  log('='.repeat(50), 'bright');
}

// Run the postinstall script
if (require.main === module) {
  main();
}

module.exports = {
  checkEnvironment,
  showQuickStart,
  showSecurityFeatures,
  showPerformanceFeatures,
  showDocumentation,
  showSecurityWarnings
};
