import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import expensesRouter from './routes/expenses.js';
import vapiRouter from './routes/vapi.js';
import { initDatabase } from './database/database.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Expenses REST API
app.use('/api/expenses', expensesRouter);

// Vapi Tools & Webhooks API
app.use('/api/vapi', vapiRouter);
app.post('/api/vapi-tool', (req, res, next) => {
  req.url = '/tool';
  vapiRouter(req, res, next);
});

// Initialize database and start listening
export async function startBackend(port = PORT) {
  await initDatabase();
  return app.listen(port, () => {
    console.log(`VoiceExpense Backend running on http://localhost:${port}`);
  });
}

if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  startBackend();
}

export default app;
