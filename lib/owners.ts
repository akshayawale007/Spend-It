// Owners: who a spend was for. A spend's owner is the entry's own owner; a one-off
// "spent" card's owner is the card's. Planned (expected) budgets never count per owner.
import type { ExpenseWithEntries, Owner } from './types';
import { round2 } from './format';

export const DEFAULT_OWNERS: { name: string; color: string }[] = [
  { name: 'Akshay', color: '#8DB8F2' },
  { name: 'Home', color: '#8FD9A8' },
];

export const NO_OWNER: Pick<Owner, 'name' | 'color'> = { name: 'Unassigned', color: '#C9CCD5' };

export const sortOwners = (os: Owner[]) =>
  [...os].sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));

/** Owner filter: null = everyone, '' = unassigned, else an owner id. */
export type OwnerFilter = string | null;

const matches = (id: string | null, f: string) => (id ?? '') === f;

/** Actual money spent on this card by the filtered owner. */
export function ownerSpent(e: ExpenseWithEntries, f: OwnerFilter): number {
  if (e.kind === 'spent') return f === null || matches(e.owner_id, f) ? round2(e.amount) : 0;
  return round2(e.entries.reduce((a, x) => a + (f === null || matches(x.owner_id, f) ? Number(x.amount) || 0 : 0), 0));
}

/** Spent per owner key ('' = unassigned) for a month. */
export function spentByOwner(expenses: ExpenseWithEntries[]) {
  const m = new Map<string, number>();
  const add = (k: string | null, v: number) => { if (v > 0) m.set(k ?? '', round2((m.get(k ?? '') ?? 0) + v)); };
  for (const e of expenses) {
    if (e.kind === 'spent') add(e.owner_id, Number(e.amount) || 0);
    else for (const x of e.entries) add(x.owner_id, Number(x.amount) || 0);
  }
  return m;
}
