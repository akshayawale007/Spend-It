'use client';
// High-level mutations. Each applies optimistically via the store; deletes return an undo.
import { fallbackCategory, nextColor } from './categories';
import { store } from './store';
import type { Category, Entry, Expense, Income } from './types';
import { uuid as makeUuid } from './uuid';

const uuid = makeUuid;
const nowIso = (offsetMs = 0) => new Date(Date.now() + offsetMs).toISOString();
const data = () => store.get().data;

export const newId = uuid;
export const stamp = nowIso;

export function saveIncome(row: Income) {
  store.apply([{ t: 'upsert', table: 'incomes', rows: [row] }]);
}

// Undo re-creates rows under fresh ids: a deleted id is tombstoned on the server
// so stale devices can't resurrect it.
export function deleteIncome(row: Income) {
  store.apply([{ t: 'delete', table: 'incomes', ids: [row.id] }]);
  return () => saveIncome({ ...row, id: uuid() });
}

/** Saves an expense; `firstEntries` are logged after it (e.g. when converting spent → expected). */
export function saveExpense(row: Expense, firstEntries: Entry[] = []) {
  store.apply([
    { t: 'upsert', table: 'expenses', rows: [row] },
    ...(firstEntries.length ? [{ t: 'upsert' as const, table: 'spend_entries' as const, rows: firstEntries }] : []),
  ]);
}

export function deleteExpense(row: Expense) {
  const entries = data().entries.filter(x => x.expense_id === row.id);
  store.apply([{ t: 'delete', table: 'expenses', ids: [row.id] }]);
  return () => {
    const id = uuid();
    saveExpense({ ...row, id }, entries.map(x => ({ ...x, id: uuid(), expense_id: id })));
  };
}

export function saveEntry(row: Entry) {
  store.apply([{ t: 'upsert', table: 'spend_entries', rows: [row] }]);
}

export function deleteEntry(row: Entry) {
  store.apply([{ t: 'delete', table: 'spend_entries', ids: [row.id] }]);
  return () => {
    // The parent may have been deleted in the meantime.
    if (data().expenses.some(e => e.id === row.expense_id)) saveEntry({ ...row, id: uuid() });
  };
}

export function addCategory(name: string): Category {
  const cats = data().categories;
  const row: Category = {
    id: uuid(),
    name: name.trim().slice(0, 40),
    color: nextColor(cats),
    sort_order: cats.reduce((m, c) => Math.max(m, c.sort_order), -1) + 1,
    created_at: nowIso(),
  };
  store.apply([{ t: 'upsert', table: 'categories', rows: [row] }]);
  return row;
}

export function updateCategory(row: Category) {
  store.apply([{ t: 'upsert', table: 'categories', rows: [row] }]);
}

/** Moves the category's expenses to "Other" (or the first remaining category), then deletes it. */
export function deleteCategory(id: string) {
  const d = data();
  const target = fallbackCategory(d.categories, id);
  if (!target) return;
  const moved = d.expenses.filter(e => e.category_id === id).map(e => ({ ...e, category_id: target.id }));
  store.apply([
    ...(moved.length ? [{ t: 'upsert' as const, table: 'expenses' as const, rows: moved }] : []),
    { t: 'delete', table: 'categories', ids: [id] },
  ]);
}

/** Copies the expected budgets (name, category, amount, note — no entries, no money). */
export function copyBudgets(fromMonth: string, toMonth: string) {
  const src = data().expenses
    .filter(e => e.month_key === fromMonth && e.kind === 'expected')
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const rows: Expense[] = src.map((e, i) => ({
    id: uuid(), month_key: toMonth, name: e.name, category_id: e.category_id, kind: 'expected',
    amount: e.amount, date: null, note: e.note, created_at: nowIso(i),
  }));
  if (rows.length) store.apply([{ t: 'upsert', table: 'expenses', rows }]);
  return rows.length;
}
