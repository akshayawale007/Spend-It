// Write operations. Every change is applied to local state at once (optimistic) and
// queued for Supabase. Ops are full-row upserts or deletes by id, so they can be
// replayed on top of freshly fetched data.
import type { Data, TableName } from './types';

export type Op =
  | { t: 'upsert'; table: TableName; rows: Record<string, unknown>[] }
  | { t: 'delete'; table: TableName; ids: string[] };

export const keyOf = (table: TableName) => (table === 'spend_entries' ? 'entries' : table) as keyof Data;

type AnyRow = { id: string } & Record<string, unknown>;

export function applyOps(d: Data, ops: Op[]): Data {
  let next = d;
  for (const op of ops) {
    const key = keyOf(op.table);
    const list = next[key] as unknown as AnyRow[];
    if (op.t === 'upsert') {
      const out = [...list];
      for (const row of op.rows as AnyRow[]) {
        const i = out.findIndex(r => r.id === row.id);
        if (i >= 0) out[i] = { ...out[i], ...row };
        else out.push(row);
      }
      next = { ...next, [key]: out };
    } else {
      const ids = new Set(op.ids);
      next = { ...next, [key]: list.filter(r => !ids.has(r.id)) };
      // Mirror the database's cascades.
      if (op.table === 'expenses') next = { ...next, entries: next.entries.filter(x => !ids.has(x.expense_id)) };
      if (op.table === 'categories')
        next = { ...next, expenses: next.expenses.map(e => (e.category_id && ids.has(e.category_id) ? { ...e, category_id: null } : e)) };
    }
  }
  return next;
}
