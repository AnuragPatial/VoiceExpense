import React, { useState, useEffect, useCallback } from 'react';
import VoiceAssistant from './components/VoiceAssistant';
import ExpenseSummary from './components/ExpenseSummary';
import ExpenseList from './components/ExpenseList';
import VapiConfigModal from './components/VapiConfigModal';
import { Expense, ExpenseSummary as ExpenseSummaryType } from './types';
import { Mic, Database, CheckCircle2, AlertCircle, HelpCircle } from 'lucide-react';

export function App() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<ExpenseSummaryType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Vapi Credentials State (supports .env and localStorage overrides)
  const [vapiConfig, setVapiConfig] = useState(() => {
    const envPublicKey = (import.meta as any).env.VITE_VAPI_PUBLIC_KEY || '';
    const envAssistantId = (import.meta as any).env.VITE_VAPI_ASSISTANT_ID || '';
    const localPublicKey = localStorage.getItem('voice_expense_vapi_public_key') || '';
    const localAssistantId = localStorage.getItem('voice_expense_vapi_assistant_id') || '';

    return {
      publicKey: localPublicKey || envPublicKey,
      assistantId: localAssistantId || envAssistantId
    };
  });

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr));
    }, 4000);
  };

  const handleSaveConfig = (newConfig: { publicKey: string; assistantId: string }) => {
    localStorage.setItem('voice_expense_vapi_public_key', newConfig.publicKey);
    localStorage.setItem('voice_expense_vapi_assistant_id', newConfig.assistantId);
    setVapiConfig(newConfig);
    showNotification('success', 'Vapi configuration updated successfully.');
  };

  // Fetch summary from Express backend
  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/expenses/summary');
      if (!res.ok) throw new Error('Failed to fetch summary');
      const data: ExpenseSummaryType = await res.json();
      setSummary(data);
    } catch (err) {
      console.error('Error fetching summary:', err);
    }
  }, []);

  // Fetch expenses with category filter
  const fetchExpenses = useCallback(async () => {
    try {
      setIsLoading(true);
      const url = selectedCategory
        ? `/api/expenses?category=${encodeURIComponent(selectedCategory)}`
        : '/api/expenses';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch expenses');
      const data: Expense[] = await res.json();
      setExpenses(data);
    } catch (err: any) {
      console.error('Error fetching expenses:', err);
      showNotification('error', 'Unable to connect to expense backend server.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory]);

  // Load data on initial render & filter change
  useEffect(() => {
    fetchExpenses();
    fetchSummary();
  }, [fetchExpenses, fetchSummary]);

  // Delete expense handler
  const handleDeleteExpense = async (id: number) => {
    try {
      const res = await fetch(`/api/expenses/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete expense');
      showNotification('success', `Expense #${id} deleted.`);
      fetchExpenses();
      fetchSummary();
    } catch (err: any) {
      console.error('Error deleting expense:', err);
      showNotification('error', 'Could not delete expense.');
    }
  };

  // Manual add expense handler
  const handleAddManualExpense = async (data: {
    amount: number;
    category: string;
    description: string;
    expense_date: string;
  }) => {
    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Failed to save expense');
    }

    showNotification('success', `Added ₹${data.amount} for ${data.description}.`);
    fetchExpenses();
    fetchSummary();
  };

  // Refresh both list and summary (e.g. after voice interaction)
  const handleRefreshAll = () => {
    fetchExpenses();
    fetchSummary();
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans">
      {/* Top Bar Contract: Brand Zone — Nav/Status — Actions */}
      <header className="border-b border-neutral-800/80 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Zone 1: Single text element wordmark */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Mic className="w-4 h-4" />
            </div>
            <span className="text-lg font-bold tracking-tight text-white">VoiceExpense</span>
          </div>

          {/* Zone 2: Navigation & Backend Info */}
          <div className="hidden md:flex items-center gap-4 text-xs text-neutral-400">
            <span className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-neutral-500" />
              <span>SQLite Persistent Storage</span>
            </span>
            <span aria-hidden="true">·</span>
            <span>Vapi AI Voice Assistant</span>
          </div>

          {/* Zone 3: Primary Actions */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsSettingsOpen(true)}
              type="button"
              className="px-3 py-1.5 text-xs font-medium text-neutral-300 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              Setup Vapi
            </button>
          </div>
        </div>
      </header>

      {/* Floating Notification Toast */}
      {notification && (
        <div className="fixed bottom-5 right-5 z-50 animate-in fade-in slide-in-from-bottom-5 duration-200">
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

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Hero Section */}
        <section className="text-center sm:text-left space-y-2">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            VOICE EXPENSE
          </h1>
          <p className="text-base sm:text-lg text-neutral-400 max-w-2xl text-balance">
            Track your expenses by simply talking.
          </p>
        </section>

        {/* Section 1: Voice Assistant Interface */}
        <VoiceAssistant
          onExpenseMutated={handleRefreshAll}
          onOpenSettings={() => setIsSettingsOpen(true)}
          vapiConfig={vapiConfig}
        />

        {/* Section 2: Expense Summary Metrics */}
        <ExpenseSummary summary={summary} isLoading={isLoading} />

        {/* Section 3: Recent Expenses Table */}
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

      {/* Footer */}
      <footer className="border-t border-neutral-800/60 mt-12 py-6 text-center text-xs text-neutral-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>VoiceExpense — Voice-first personal expense tracker</p>
          <div className="flex items-center gap-3">
            <span>Vapi Web SDK</span>
            <span>·</span>
            <span>Express</span>
            <span>·</span>
            <span>SQLite</span>
          </div>
        </div>
      </footer>

      {/* Vapi Configuration Modal */}
      <VapiConfigModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={vapiConfig}
        onSave={handleSaveConfig}
      />
    </div>
  );
}

export default App;
