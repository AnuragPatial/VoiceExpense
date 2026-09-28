export interface Expense {
  id: number;
  amount: number;
  category: string;
  description: string;
  expense_date: string;
  created_at: string;
}

export interface ExpenseSummary {
  total: number;
  count: number;
  byCategory: Record<string, number>;
}

export interface TranscriptItem {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
  isFinal?: boolean;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'listening' | 'speaking';
