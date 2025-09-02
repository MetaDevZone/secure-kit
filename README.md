# 🛡️ Secure Kit

[![npm version](https://badge.fury.io/js/secure-kit.svg)](https://badge.fury.io/js/secure-kit)
[![CI Status](https://github.com/MetaDevZone/secure-kit/workflows/CI/badge.svg)](https://github.com/MetaDevZone/secure-kit/actions)
[![Coverage Status](https://coveralls.io/repos/github/MetaDevZone/secure-kit/badge.svg?branch=main)](https://coveralls.io/github/MetaDevZone/secure-kit?branch=main)
[![Security Rating](https://snyk.io/test/github/MetaDevZone/secure-kit/badge.svg)](https://snyk.io/test/github/MetaDevZone/secure-kit)
[![Documentation](https://img.shields.io/badge/docs-TypeDoc-blue.svg)](https://metadevzone.github.io/secure-kit/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Production-grade security + performance toolkit for backend frameworks with OWASP Top 10 compliance**

Secure Kit is a comprehensive middleware solution that provides enterprise-level security and performance optimizations for Express, Koa, Fastify, and NestJS applications. Get OWASP Top 10 protection, performance monitoring, and developer-friendly configuration in minutes, not hours.

## 🚀 Quick Start

```bash
npm install secure-kit
```

```typescript
import express from 'express';
import { ExpressAdapter, ConfigManager } from 'secure-kit';

const app = express();
const config = ConfigManager.createConfig('api');
const secureAdapter = new ExpressAdapter(config);
secureAdapter.applyMiddleware(app);

app.listen(3000);
```

**That's it!** Your app now has:

- ✅ CSRF protection
- ✅ CORS configuration
- ✅ Security headers (Helmet)
- ✅ Rate limiting
- ✅ Input sanitization
- ✅ Compression & caching
- ✅ Performance monitoring

## 📦 Installation

```bash
# npm
npm install secure-kit

# yarn
yarn add secure-kit
```

## 📚 Documentation

- **[Full API Documentation](https://metadevzone.github.io/secure-kit/)** - Complete TypeDoc API reference
- **[Quick Start Guide](#-quick-start)** - Get started in minutes
- **[Configuration Guide](#-configuration)** - Detailed configuration options
- **[Framework Adapters](#-framework-support)** - Express, Koa, Fastify, NestJS guides
- **[Examples](./examples/)** - Sample implementations

## 🔑 CLI Usage

```bash
# Initialize a new secure project
npx secure-backend init --preset webapp --framework express --typescript

# Run a security audit
npx secure-backend audit --format json --output security-report.json --fix

# Manage configuration
npx secure-backend config generate --preset strict --format typescript
npx secure-backend config validate
npx secure-backend config update --key security.cors.origin --value "https://myapp.com"
```

## 🏆 Production Ready

- 100% test coverage (167+ tests)
- Multi-framework support (Express, Koa, Fastify, NestJS)
- Advanced rate limiting, security monitoring, and threat detection
- CLI tool for project setup, audit, and config management
- OWASP Top 10 compliance
- TypeScript support
- CI/CD workflow and automated security checks

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines. All contributions, issues, and feature requests are welcome!

## 🛡️ Security Policy

See [SECURITY.md](SECURITY.md) for responsible disclosure and security best practices.

## 📄 License

MIT © MetaDevZone

---

**Made with ❤️ by the Secure Kit team**

_Secure Kit is trusted by companies building production applications. Join thousands of developers who've chosen security by default._
