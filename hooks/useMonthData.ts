'use client';
import { useMemo } from 'react';
import { isClosed, totals } from '@/lib/calc';
import { sortCategories, UNCATEGORISED } from '@/lib/categories';
import { useStore } from '@/lib/store';
import type { Category, Data, ExpenseWithEntries } from '@/lib/types';

export function monthView(data: Data, month: string, now = new Date()) {
  const incomes = data.incomes
    .filter(i => i.month_key === month)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const byExp = new Map<string, ExpenseWithEntries['entries']>();
  for (const x of data.entries) {
    const l = byExp.get(x.expense_id);
    if (l) l.push(x); else byExp.set(x.expense_id, [x]);
  }
  const expenses: ExpenseWithEntries[] = data.expenses
    .filter(e => e.month_key === month)
    .map(e => ({
      ...e,
      // Entries are kept but ignored while the expense is a one-off "spent" payment.
      entries: (byExp.get(e.id) ?? []).sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at)),
    }));
  const closed = isClosed(month, now);
  return { incomes, expenses, closed, totals: totals(incomes, expenses.map(calcView), closed) };
}

/** What calc.ts sees: entries only count for expected expenses. */
export const calcView = (e: ExpenseWithEntries) => (e.kind === 'spent' ? { ...e, entries: [] } : e);

export function useMonthData(month: string) {
  const data = useStore(s => s.data);
  return useMemo(() => monthView(data, month), [data, month]);
}

export function useCategories() {
  const cats = useStore(s => s.data.categories);
  return useMemo(() => sortCategories(cats), [cats]);
}

export function useCategoryLookup() {
  const cats = useStore(s => s.data.categories);
  return useMemo(() => {
    const m = new Map(cats.map(c => [c.id, c]));
    return (id: string | null): Pick<Category, 'name' | 'color'> & { id: string | null } =>
      (id && m.get(id)) || { id, ...UNCATEGORISED };
  }, [cats]);
}

export function useMonthsWithData() {
  const data = useStore(s => s.data);
  return useMemo(() => {
    const s = new Set<string>();
    for (const i of data.incomes) s.add(i.month_key);
    for (const e of data.expenses) s.add(e.month_key);
    return s;
  }, [data]);
}
