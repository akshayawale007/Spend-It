import { describe, expect, it } from 'vitest';
import { ownerSpent, spentByOwner } from '@/lib/owners';
import type { ExpenseWithEntries } from '@/lib/types';

const base = { month_key: '2026-11', category_id: 'c', date: null, note: '', created_at: '' };
const x = (id: string, amount: number, owner_id: string | null) => ({ id, expense_id: 'e1', owner_id, amount, date: '2026-11-02', note: '', created_at: '' });
const sabji: ExpenseWithEntries = { ...base, id: 'e1', name: 'Sabji', owner_id: 'home', kind: 'expected', amount: 1000,
  entries: [x('a', 300, 'akshay'), x('b', 200, 'home'), x('c', 50, null)] };
const movie: ExpenseWithEntries = { ...base, id: 'e2', name: 'Movie', owner_id: 'akshay', kind: 'spent', amount: 400, entries: [] };

describe('owners', () => {
  it('counts only actual spends per owner, never the budget', () => {
    expect(ownerSpent(sabji, null)).toBe(550);
    expect(ownerSpent(sabji, 'akshay')).toBe(300);
    expect(ownerSpent(sabji, '')).toBe(50);
    expect(ownerSpent(movie, 'akshay')).toBe(400);
    expect(ownerSpent(movie, 'home')).toBe(0);
  });
  it('splits a month by owner', () => {
    expect(Object.fromEntries(spentByOwner([sabji, movie]))).toEqual({ akshay: 700, home: 200, '': 50 });
  });
});
