// Moves data created in device-only mode into a signed-in account without duplicates.
import { DEFAULT_CATEGORIES } from './categories';
import { DEFAULT_OWNERS } from './owners';
import type { Op } from './ops';
import type { Category, Data, Owner } from './types';

const norm = (s: string) => s.trim().toLowerCase();
const DEFAULT_NAMES = new Set(DEFAULT_CATEGORIES.map(c => norm(c.name)));
const DEFAULT_OWNER_NAMES = new Set(DEFAULT_OWNERS.map(o => norm(o.name)));

/** Anything worth moving: money rows, or a category/owner the user made themselves. */
export const hasLocalContent = (d: Data) =>
  d.incomes.length > 0 || d.expenses.length > 0 || d.categories.some(c => !DEFAULT_NAMES.has(norm(c.name)))
  || (d.owners ?? []).some(o => !DEFAULT_OWNER_NAMES.has(norm(o.name)));

/** Maps local rows (categories or owners) onto the account's by name; returns id map + rows to add. */
function matchByName<T extends { id: string; name: string; sort_order: number }>(local: T[], account: T[]) {
  const byName = new Map(account.map(c => [norm(c.name), c.id]));
  const map = new Map<string, string>();
  const add: T[] = [];
  let order = account.reduce((m, c) => Math.max(m, c.sort_order), -1) + 1;
  for (const c of [...local].sort((a, b) => a.sort_order - b.sort_order)) {
    const hit = byName.get(norm(c.name));
    if (hit) { map.set(c.id, hit); continue; }
    add.push({ ...c, sort_order: order++ });
    map.set(c.id, c.id);
    byName.set(norm(c.name), c.id);
  }
  return { map, add };
}

/**
 * Ops that add the device's data to the account. Categories are matched by name, so the
 * device's "Fuel" lands in the account's "Fuel" instead of creating a second one.
 * Every row keeps its UUID, so replaying these is idempotent.
 */
export function localToOps(local: Data, accountCategories: Category[], accountOwners: Owner[] = []): Op[] {
  const { map: catMap, add: newCats } = matchByName(local.categories, accountCategories);
  const { map: ownMap, add: newOwners } = matchByName(local.owners ?? [], accountOwners);
  const own = (id: string | null | undefined) => (id ? ownMap.get(id) ?? null : null);
  const expenses = local.expenses.map(e => ({
    ...e, category_id: e.category_id ? catMap.get(e.category_id) ?? null : null, owner_id: own(e.owner_id),
  }));
  const entries = local.entries.map(x => ({ ...x, owner_id: own(x.owner_id) }));
  const ops: Op[] = [];
  if (newCats.length) ops.push({ t: 'upsert', table: 'categories', rows: newCats });
  if (newOwners.length) ops.push({ t: 'upsert', table: 'owners', rows: newOwners });
  if (local.incomes.length) ops.push({ t: 'upsert', table: 'incomes', rows: local.incomes });
  if (expenses.length) ops.push({ t: 'upsert', table: 'expenses', rows: expenses });
  if (entries.length) ops.push({ t: 'upsert', table: 'spend_entries', rows: entries });
  return ops;
}
