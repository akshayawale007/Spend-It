// Backup import/export in the prototype's JSON shape (spec §7), so files move both ways.
import { z } from 'zod';
import { DEFAULT_CATEGORIES, NEUTRAL, fallbackCategory } from './categories';
import { round2 } from './format';
import type { Category, Data, Entry, Expense, Income, Owner } from './types';
import { uuid } from './uuid';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const str = z.union([z.string(), z.number()]).transform(String);
const optStr = z.union([z.string(), z.number(), z.null()]).optional().transform(v => (v == null ? '' : String(v)));
const amount = z.union([z.number(), z.string()]).transform(v => round2(Number(String(v).replace(/[,₹\s]/g, ''))));
const date = z.unknown().transform(v => (typeof v === 'string' && DATE_RE.test(v) ? v : null));

const entrySchema = z.object({ id: optStr, amount, date, note: optStr, ownerId: optStr }).passthrough();

const expenseSchema = z.object({
  id: optStr,
  name: optStr,
  categoryId: optStr,
  ownerId: optStr,
  kind: z.unknown().transform(v => (v === 'spent' ? 'spent' : 'expected') as Expense['kind']),
  amount,
  date,
  note: optStr,
  createdAt: z.unknown().transform(v => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null)),
  entries: z.array(entrySchema).optional().default([]),
}).passthrough();

const incomeSchema = z.object({ id: optStr, name: optStr, amount, date }).passthrough();

const monthSchema = z.object({
  incomes: z.array(incomeSchema).optional().default([]),
  expenses: z.array(expenseSchema).optional().default([]),
}).passthrough();

export const backupSchema = z.object({
  v: z.unknown().optional(),
  categories: z.array(z.object({ id: str, name: optStr, color: optStr }).passthrough()),
  owners: z.array(z.object({ id: str, name: optStr, color: optStr }).passthrough()).optional().default([]),
  months: z.record(z.string(), monthSchema),
});

export type Backup = z.infer<typeof backupSchema>;

export type ParsedBackup = { backup: Backup; monthCount: number; expenseCount: number };

export function parseBackup(text: string): ParsedBackup | null {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return null; }
  const r = backupSchema.safeParse(raw);
  if (!r.success) return null;
  const months = Object.keys(r.data.months).filter(k => MONTH_RE.test(k));
  const expenseCount = months.reduce((a, k) => a + r.data.months[k].expenses.length, 0);
  return { backup: r.data, monthCount: months.length, expenseCount };
}

/** Turns a backup into fresh rows: new UUIDs, "" dates → null, `done`/`carry` ignored. */
export function backupToData(b: Backup, newId: () => string = uuid, now = Date.now()): Data {
  const catMap = new Map<string, string>();
  const categories: Category[] = [];
  const srcCats = b.categories.length ? b.categories : DEFAULT_CATEGORIES.map((c, i) => ({ id: `d${i}`, ...c }));
  srcCats.forEach((c, i) => {
    if (catMap.has(c.id)) return;
    const id = newId();
    catMap.set(c.id, id);
    categories.push({
      id,
      name: (c.name.trim() || 'Untitled').slice(0, 40),
      color: /^#[0-9a-f]{6}$/i.test(c.color) ? c.color.toUpperCase() : NEUTRAL,
      sort_order: i,
      created_at: new Date(now + i).toISOString(),
    });
  });
  const fallback = fallbackCategory(categories)?.id ?? null;

  const ownMap = new Map<string, string>();
  const owners: Owner[] = [];
  b.owners.forEach((o, i) => {
    if (ownMap.has(o.id)) return;
    const id = newId();
    ownMap.set(o.id, id);
    owners.push({
      id,
      name: (o.name.trim() || 'Untitled').slice(0, 40),
      color: /^#[0-9a-f]{6}$/i.test(o.color) ? o.color.toUpperCase() : NEUTRAL,
      sort_order: i,
      created_at: new Date(now + i).toISOString(),
    });
  });
  const own = (id: string) => ownMap.get(id) ?? null;

  const incomes: Income[] = [], expenses: Expense[] = [], entries: Entry[] = [];
  let seq = 0;
  for (const [month, m] of Object.entries(b.months)) {
    if (!MONTH_RE.test(month)) continue;
    for (const i of m.incomes) {
      if (!(i.amount > 0)) continue;
      incomes.push({ id: newId(), month_key: month, name: i.name.trim() || 'Income', amount: i.amount, date: i.date, created_at: new Date(now + seq++).toISOString() });
    }
    for (const e of m.expenses) {
      if (!(e.amount > 0) && !(e.kind === 'expected' && e.amount === 0)) continue;
      const id = newId();
      expenses.push({
        id,
        month_key: month,
        name: e.name.trim() || 'Expense',
        category_id: catMap.get(e.categoryId) ?? fallback,
        owner_id: own(e.ownerId),
        kind: e.kind,
        amount: e.amount,
        date: e.kind === 'spent' ? e.date : null,
        note: e.note,
        created_at: new Date(e.createdAt ?? now + seq++).toISOString(),
      });
      for (const x of e.entries) {
        if (!(x.amount > 0)) continue;
        entries.push({ id: newId(), expense_id: id, owner_id: own(x.ownerId), amount: x.amount, date: x.date ?? `${month}-01`, note: x.note, created_at: new Date(now + seq++).toISOString() });
      }
    }
  }
  return { categories, owners, incomes, expenses, entries };
}

/** Exports data in the prototype's shape. */
export function dataToBackup(d: Data) {
  const months: Record<string, { incomes: unknown[]; expenses: unknown[] }> = {};
  const month = (k: string) => (months[k] ||= { incomes: [], expenses: [] });
  const byExpense = new Map<string, Entry[]>();
  for (const x of d.entries) byExpense.set(x.expense_id, [...(byExpense.get(x.expense_id) ?? []), x]);
  const sorted = <T extends { created_at: string }>(a: T[]) => [...a].sort((x, y) => x.created_at.localeCompare(y.created_at));

  for (const i of sorted(d.incomes)) {
    month(i.month_key).incomes.push({ id: i.id, name: i.name, amount: i.amount, date: i.date ?? '', carry: '' });
  }
  for (const e of sorted(d.expenses)) {
    month(e.month_key).expenses.push({
      id: e.id, name: e.name, categoryId: e.category_id ?? '', ownerId: e.owner_id ?? '', kind: e.kind, amount: e.amount,
      date: e.date ?? '', note: e.note, done: false, createdAt: Date.parse(e.created_at),
      entries: sorted(byExpense.get(e.id) ?? []).map(x => ({ id: x.id, amount: x.amount, date: x.date, note: x.note, ownerId: x.owner_id ?? '' })),
    });
  }
  return {
    v: 1,
    categories: [...d.categories].sort((a, b) => a.sort_order - b.sort_order).map(c => ({ id: c.id, name: c.name, color: c.color })),
    owners: [...(d.owners ?? [])].sort((a, b) => a.sort_order - b.sort_order).map(o => ({ id: o.id, name: o.name, color: o.color })),
    months,
  };
}
