import express from 'express';
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
  console.log(`🚀 Secure server running on port ${port}`);
});