import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import expensesRouter from './backend/routes/expenses.js';
import vapiRouter from './backend/routes/vapi.js';
import { initDatabase } from './backend/database/database.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createServer() {
  const app = express();

  // Parse command line arguments if provided (e.g. --port=3000 --host=0.0.0.0)
  let port = parseInt(process.env.PORT || '3000', 10);
  let host = process.env.HOST || '0.0.0.0';

  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg.startsWith('--port=')) {
      port = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--port' && process.argv[i + 1]) {
      port = parseInt(process.argv[i + 1], 10);
      i++;
    } else if (arg.startsWith('--host=')) {
      host = arg.split('=')[1];
    } else if (arg === '--host' && process.argv[i + 1]) {
      host = process.argv[i + 1];
      i++;
    }
  }

  const isProduction = process.env.NODE_ENV === 'production';

  // Initialize SQLite Database
  await initDatabase();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // REST API Endpoints
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/expenses', expensesRouter);

  // Vapi Voice AI Webhooks & Tools
  app.use('/api/vapi', vapiRouter);
  app.post('/api/vapi-tool', (req, res, next) => {
    req.url = '/tool';
    vapiRouter(req, res, next);
  });

  // Frontend Integration
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(port, host, () => {
    console.log(`VoiceExpense server running at http://${host}:${port}`);
  });
}

createServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
