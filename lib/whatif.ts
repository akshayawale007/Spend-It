// Insights "what-if": the user can untick expense cards or single spends to see the month's
// numbers without them. Nothing is changed or saved; it only filters what the totals see.
import type { ExpenseWithEntries } from './types';

/** The month's expenses without the unticked cards and spends. */
export function withoutUnticked(expenses: ExpenseWithEntries[], off: ReadonlySet<string>): ExpenseWithEntries[] {
  if (!off.size) return expenses;
  return expenses
    .filter(e => !off.has(e.id))
    .map(e => (e.entries.some(x => off.has(x.id)) ? { ...e, entries: e.entries.filter(x => !off.has(x.id)) } : e));
}

/** How many of this month's cards and spends are unticked. */
export function untickedCount(expenses: ExpenseWithEntries[], off: ReadonlySet<string>) {
  if (!off.size) return 0;
  let n = 0;
  for (const e of expenses) {
    if (off.has(e.id)) n++;
    for (const x of e.entries) if (off.has(x.id)) n++;
  }
  return n;
}
