import React from 'react';
import { Wallet, Receipt, PieChart, TrendingUp } from 'lucide-react';

export const ExpenseSummary = ({ summary, isLoading }) => {
  const total = summary?.total ?? 0;
  const count = summary?.count ?? 0;
  const byCategory = summary?.byCategory ?? {};

  const categoryEntries = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);

  const formatCurrency = (val) => {
    return `₹${val.toLocaleString('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    })}`;
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-medium uppercase tracking-wider">
            <span>Total Spending</span>
            <Wallet className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-white font-mono tabular-nums">
              {isLoading ? '...' : formatCurrency(total)}
            </span>
          </div>
          <div className="mt-2 text-xs text-neutral-400">Recorded in SQLite database</div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-medium uppercase tracking-wider">
            <span>Number of Expenses</span>
            <Receipt className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-white font-mono tabular-nums">
              {isLoading ? '...' : count}
            </span>
            <span className="text-xs text-neutral-400">entries</span>
          </div>
          <div className="mt-2 text-xs text-neutral-400">Across all categories</div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-sm sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-medium uppercase tracking-wider">
            <span>Average Expense</span>
            <TrendingUp className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-white font-mono tabular-nums">
              {isLoading ? '...' : formatCurrency(count > 0 ? Math.round(total / count) : 0)}
            </span>
          </div>
          <div className="mt-2 text-xs text-neutral-400">Per transaction</div>
        </div>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <PieChart className="w-4 h-4 text-neutral-400" />
            <h3 className="text-sm font-semibold text-white">Spending by Category</h3>
          </div>
          <span className="text-xs text-neutral-400 font-mono tabular-nums">
            {categoryEntries.length} active categories
          </span>
        </div>

        {categoryEntries.length === 0 ? (
          <div className="py-6 text-center text-xs text-neutral-400">
            No categorized expenses recorded yet.
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {categoryEntries.map(([category, amount]) => {
              const percentage = total > 0 ? Math.round((amount / total) * 100) : 0;
              return (
                <div
                  key={category}
                  className="bg-neutral-950/60 border border-neutral-800/80 rounded-xl p-3.5 hover:border-neutral-700 transition-colors"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-neutral-200">{category}</span>
                    <span className="text-neutral-400 font-mono tabular-nums">{percentage}%</span>
                  </div>
                  <div className="mt-1.5 text-base font-bold text-white font-mono tabular-nums">
                    {formatCurrency(amount)}
                  </div>
                  <div className="mt-2.5 w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(percentage, 3)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExpenseSummary;
