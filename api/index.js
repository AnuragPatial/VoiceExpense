import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import expensesRouter from '../backend/routes/expenses.js';
import vapiRouter from '../backend/routes/vapi.js';
import { initDatabase } from '../backend/database/database.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

let dbInitialized = false;

app.use(async (req, res, next) => {
  if (!dbInitialized) {
    try {
      await initDatabase();
      dbInitialized = true;
    } catch (err) {
      console.error('Database init error in serverless handler:', err);
    }
  }
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', environment: process.env.VERCEL ? 'vercel' : 'node' });
});

app.use('/api/expenses', expensesRouter);
app.use('/api/vapi', vapiRouter);
app.post('/api/vapi-tool', (req, res, next) => {
  req.url = '/tool';
  vapiRouter(req, res, next);
});

export default app;
