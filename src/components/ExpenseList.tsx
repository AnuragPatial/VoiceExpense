import React, { useState } from 'react';
import { Expense } from '../types';
import { Trash2, Plus, Filter, RefreshCw, Calendar, Tag, AlertCircle } from 'lucide-react';

interface ExpenseListProps {
  expenses: Expense[];
  isLoading: boolean;
  onDeleteExpense: (id: number) => Promise<void>;
  onAddManualExpense: (data: { amount: number; category: string; description: string; expense_date: string }) => Promise<void>;
  onRefresh: () => void;
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

const CATEGORIES = [
  'All',
  'Food',
  'Transport',
  'Shopping',
  'Bills',
  'Entertainment',
  'Health',
  'Travel',
  'Education',
  'Other'
];

export const ExpenseList: React.FC<ExpenseListProps> = ({
  expenses,
  isLoading,
  onDeleteExpense,
  onAddManualExpense,
  onRefresh,
  selectedCategory,
  onSelectCategory
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Food');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setFormError('Please enter a valid amount greater than 0.');
      return;
    }

    if (!description.trim()) {
      setFormError('Please enter a description for the expense.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onAddManualExpense({
        amount: parsedAmount,
        category,
        description: description.trim(),
        expense_date: date
      });
      // Reset form
      setAmount('');
      setDescription('');
      setShowAddForm(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      setDeletingId(id);
      await onDeleteExpense(id);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDateDisplay = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      }
      return dateStr;
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-sm">
      {/* Top Header & Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-neutral-800">
        <div>
          <h3 className="text-base font-bold text-white tracking-tight">Recent Expenses</h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            Voice-recorded and manual transactions from SQLite database
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{showAddForm ? 'Close Form' : 'Add Manually'}</span>
          </button>

          <button
            onClick={onRefresh}
            type="button"
            disabled={isLoading}
            className="p-2 text-neutral-400 hover:text-white bg-neutral-800/80 hover:bg-neutral-800 border border-neutral-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh expenses"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Optional Manual Entry Drawer */}
      {showAddForm && (
        <form
          onSubmit={handleSubmit}
          className="my-4 p-4 bg-neutral-950/80 border border-neutral-800 rounded-xl space-y-3"
        >
          <div className="text-xs font-semibold text-neutral-300">Quick Manual Expense Entry</div>

          {formError && (
            <div className="flex items-center gap-2 text-xs text-red-400 bg-red-950/40 p-2.5 rounded-lg border border-red-900/50">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-neutral-400 mb-1">Amount (₹)</label>
              <input
                type="number"
                step="0.01"
                min="1"
                placeholder="450"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="w-full px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-neutral-400 mb-1">Description</label>
              <input
                type="text"
                placeholder="e.g. Dinner with friends"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                className="w-full px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-neutral-400 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                {CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-neutral-400 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save to SQLite'}
            </button>
          </div>
        </form>
      )}

      {/* Category Filter Horizontal Tabs */}
      <div className="py-3 flex items-center gap-1.5 overflow-x-auto text-xs no-scrollbar">
        <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider mr-1 flex items-center gap-1">
          <Filter className="w-3 h-3" />
          Filter:
        </span>
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === (cat === 'All' ? '' : cat);
          return (
            <button
              key={cat}
              onClick={() => onSelectCategory(cat === 'All' ? '' : cat)}
              type="button"
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                isSelected
                  ? 'bg-neutral-800 text-white border border-neutral-600'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Responsive Table / Card List */}
      {isLoading && expenses.length === 0 ? (
        <div className="py-12 text-center text-xs text-neutral-400">Loading expenses from server...</div>
      ) : expenses.length === 0 ? (
        <div className="py-12 text-center text-xs text-neutral-400 border border-dashed border-neutral-800 rounded-xl my-2">
          No expenses found. Say <span className="text-emerald-400 font-medium">"Add 450 rupees for dinner"</span> to
          log your first one!
        </div>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-800 text-neutral-400 font-medium uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Description</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3 text-right">Amount</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {expenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-neutral-800/40 transition-colors group">
                  {/* Date */}
                  <td className="py-3 px-3 font-mono text-neutral-400 whitespace-nowrap">
                    {formatDateDisplay(expense.expense_date)}
                  </td>

                  {/* Description */}
                  <td className="py-3 px-3 font-medium text-white max-w-[200px] truncate">
                    {expense.description}
                  </td>

                  {/* Category */}
                  <td className="py-3 px-3 text-neutral-400 whitespace-nowrap">
                    <span className="text-neutral-300">{expense.category}</span>
                  </td>

                  {/* Amount */}
                  <td className="py-3 px-3 text-right font-bold text-white font-mono tabular-nums whitespace-nowrap">
                    ₹{expense.amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </td>

                  {/* Delete Action */}
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => handleDelete(expense.id)}
                      disabled={deletingId === expense.id}
                      type="button"
                      title="Delete expense"
                      className="p-1 text-neutral-500 hover:text-rose-400 rounded transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ExpenseList;
