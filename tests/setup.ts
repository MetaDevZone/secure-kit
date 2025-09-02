// Test setup file
import { TextEncoder, TextDecoder } from 'util';
import { jest } from '@jest/globals';

// Polyfill for TextEncoder/TextDecoder in Node.js test environment
global.TextEncoder = TextEncoder as any;
global.TextDecoder = TextDecoder as any;

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.SESSION_SECRET = 'test-session-secret-for-testing';

// Increase timeout for integration tests
jest.setTimeout(30000);

// Mock console methods to reduce noise in tests
const originalConsole = { ...console };
beforeAll(() => {
  console.warn = jest.fn();
  console.error = jest.fn();
  console.log = jest.fn();
  console.info = jest.fn();
});

afterAll(() => {
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
  console.log = originalConsole.log;
  console.info = originalConsole.info;
});

// Mock external dependencies for consistent testing
jest.mock('crypto', () => {
  const actualCrypto = jest.requireActual('crypto') as any;
  let callCount = 0;
  return {
    ...actualCrypto,
    randomBytes: jest.fn((size: number) => {
      callCount++;
      const timestamp = Date.now().toString(36);
      const unique = `${timestamp}-${callCount}`;
      return Buffer.from(unique.padStart(size, '0').slice(0, size));
    }),
    createHash: jest.fn(() => ({
      update: jest.fn().mockReturnThis(),
      digest: jest.fn(() => {
        callCount++;
        return `test-hash-${callCount}`;
      }),
    })),
  };
});

export {};
