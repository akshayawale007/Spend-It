// Text search for expense cards and logged spends.
import type { ExpenseWithEntries } from './types';

const norm = (s: string) => s.toLocaleLowerCase().replace(/\s+/g, ' ').trim();

/** True when any field contains the query (case-insensitive). Amounts match on their digits, e.g. "250". */
export function matches(q: string, ...fields: (string | number | null | undefined)[]) {
  const n = norm(q);
  if (!n) return true;
  const digits = n.replace(/[₹,\s]/g, '');
  return fields.some(f => {
    if (f == null) return false;
    if (typeof f === 'number') return /^\d+(\.\d+)?$/.test(digits) && String(f).includes(digits);
    return norm(f).includes(n);
  });
}

export type ExpenseHits = {
  /** Cards to show: the card itself matched, or one of its spends did. */
  list: ExpenseWithEntries[];
  /** Spends (entry ids) that matched, so their cards can open and show them. */
  entries: Set<string>;
};

/**
 * Cards whose name, note or category match, plus cards with a matching spend
 * (its note, amount or owner).
 */
export function searchExpenses(
  expenses: ExpenseWithEntries[], q: string,
  catName: (id: string | null) => string, ownerName: (id: string | null) => string,
): ExpenseHits {
  const entries = new Set<string>();
  if (!norm(q)) return { list: expenses, entries };
  const list = expenses.filter(e => {
    let hit = matches(q, e.name, e.note, catName(e.category_id));
    if (e.kind === 'spent') return hit || matches(q, e.amount, e.owner_id && ownerName(e.owner_id));
    for (const x of e.entries) {
      if (matches(q, x.note, x.amount, x.owner_id && ownerName(x.owner_id))) { entries.add(x.id); hit = true; }
    }
    return hit;
  });
  return { list, entries };
}
