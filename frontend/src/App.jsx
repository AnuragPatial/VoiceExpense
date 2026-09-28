import React, { useState, useEffect, useCallback } from 'react';
import VoiceAssistant from './components/VoiceAssistant';
import ExpenseSummary from './components/ExpenseSummary';
import ExpenseList from './components/ExpenseList';
import { Mic, Database, CheckCircle2, AlertCircle } from 'lucide-react';

export function App() {
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [notification, setNotification] = useState(null);

  const [vapiConfig, setVapiConfig] = useState(() => ({
    publicKey: import.meta.env.VITE_VAPI_PUBLIC_KEY || '',
    assistantId: import.meta.env.VITE_VAPI_ASSISTANT_ID || ''
  }));

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr));
    }, 4000);
  };

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/expenses/summary');
      if (!res.ok) throw new Error('Failed to fetch summary');
      const data = await res.json();
      setSummary(data);
    } catch (err) {
      console.error('Error fetching summary:', err);
    }
  }, []);

  const fetchExpenses = useCallback(async () => {
    try {
      setIsLoading(true);
      const url = selectedCategory
        ? `/api/expenses?category=${encodeURIComponent(selectedCategory)}`
        : '/api/expenses';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch expenses');
      const data = await res.json();
      setExpenses(data);
    } catch (err) {
      console.error('Error fetching expenses:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    fetchExpenses();
    fetchSummary();
  }, [fetchExpenses, fetchSummary]);

  const handleDeleteExpense = async (id) => {
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      showNotification('success', `Expense #${id} deleted.`);
      fetchExpenses();
      fetchSummary();
    } catch (err) {
      showNotification('error', 'Could not delete expense.');
    }
  };

  const handleAddManualExpense = async (data) => {
    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to save expense');
    showNotification('success', `Recorded ₹${data.amount} for ${data.description}.`);
    fetchExpenses();
    fetchSummary();
  };

  const handleRefreshAll = () => {
    fetchExpenses();
    fetchSummary();
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans">
      <header className="border-b border-neutral-800/80 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Mic className="w-4 h-4" />
            </div>
            <span className="text-lg font-bold tracking-tight text-white">VoiceExpense</span>
          </div>

          <div className="hidden md:flex items-center gap-4 text-xs text-neutral-400">
            <span className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-neutral-500" />
              <span>SQLite Storage</span>
            </span>
            <span aria-hidden="true">·</span>
            <span>Vapi AI Voice Assistant</span>
          </div>
        </div>
      </header>

      {notification && (
        <div className="fixed bottom-5 right-5 z-50">
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl text-xs font-medium border ${
              notification.type === 'success'
                ? 'bg-neutral-900 text-emerald-300 border-emerald-700/80'
                : 'bg-neutral-900 text-rose-300 border-rose-700/80'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        <section className="text-center sm:text-left space-y-2">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            VOICE EXPENSE
          </h1>
          <p className="text-base sm:text-lg text-neutral-400 max-w-2xl">
            Track your expenses by simply talking.
          </p>
        </section>

        <VoiceAssistant
          onExpenseMutated={handleRefreshAll}
          onOpenSettings={() => {}}
          vapiConfig={vapiConfig}
        />

        <ExpenseSummary summary={summary} isLoading={isLoading} />

        <ExpenseList
          expenses={expenses}
          isLoading={isLoading}
          onDeleteExpense={handleDeleteExpense}
          onAddManualExpense={handleAddManualExpense}
          onRefresh={handleRefreshAll}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />
      </main>

      <footer className="border-t border-neutral-800/60 mt-12 py-6 text-center text-xs text-neutral-500">
        <p>VoiceExpense — Voice-first personal expense tracker</p>
      </footer>
    </div>
  );
}

export default App;
