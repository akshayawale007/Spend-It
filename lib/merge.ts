// Moves data created in device-only mode into a signed-in account without duplicates.
import { DEFAULT_CATEGORIES } from './categories';
import type { Op } from './ops';
import type { Category, Data } from './types';

const norm = (s: string) => s.trim().toLowerCase();
const DEFAULT_NAMES = new Set(DEFAULT_CATEGORIES.map(c => norm(c.name)));

/** Anything worth moving: money rows, or a category the user made themselves. */
export const hasLocalContent = (d: Data) =>
  d.incomes.length > 0 || d.expenses.length > 0 || d.categories.some(c => !DEFAULT_NAMES.has(norm(c.name)));

/**
 * Ops that add the device's data to the account. Categories are matched by name, so the
 * device's "Fuel" lands in the account's "Fuel" instead of creating a second one.
 * Every row keeps its UUID, so replaying these is idempotent.
 */
export function localToOps(local: Data, accountCategories: Category[]): Op[] {
  const byName = new Map(accountCategories.map(c => [norm(c.name), c.id]));
  const catMap = new Map<string, string>();
  const newCats: Category[] = [];
  let order = accountCategories.reduce((m, c) => Math.max(m, c.sort_order), -1) + 1;
  for (const c of [...local.categories].sort((a, b) => a.sort_order - b.sort_order)) {
    const hit = byName.get(norm(c.name));
    if (hit) { catMap.set(c.id, hit); continue; }
    newCats.push({ ...c, sort_order: order++ });
    catMap.set(c.id, c.id);
    byName.set(norm(c.name), c.id);
  }
  const expenses = local.expenses.map(e => ({ ...e, category_id: e.category_id ? catMap.get(e.category_id) ?? null : null }));
  const ops: Op[] = [];
  if (newCats.length) ops.push({ t: 'upsert', table: 'categories', rows: newCats });
  if (local.incomes.length) ops.push({ t: 'upsert', table: 'incomes', rows: local.incomes });
  if (expenses.length) ops.push({ t: 'upsert', table: 'expenses', rows: expenses });
  if (local.entries.length) ops.push({ t: 'upsert', table: 'spend_entries', rows: local.entries });
  return ops;
}
