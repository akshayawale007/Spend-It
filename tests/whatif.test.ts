import { describe, expect, it } from 'vitest';
import { totals } from '@/lib/calc';
import { matches, searchExpenses } from '@/lib/search';
import type { ExpenseWithEntries } from '@/lib/types';
import { untickedCount, withoutUnticked } from '@/lib/whatif';
import { calcView } from '@/hooks/useMonthData';

const base = { month_key: '2026-11', category_id: 'c', date: null, note: '', created_at: '' };
const x = (id: string, amount: number, note = '', owner_id: string | null = null) =>
  ({ id, expense_id: 'e1', owner_id, amount, date: '2026-11-02', note, created_at: '' });
const sabji: ExpenseWithEntries = { ...base, id: 'e1', name: 'Sabji', owner_id: null, kind: 'expected', amount: 1000,
  entries: [x('a', 300, 'tomatoes', 'akshay'), x('b', 200, 'onions')] };
const movie: ExpenseWithEntries = { ...base, id: 'e2', name: 'Movie', owner_id: 'akshay', kind: 'spent', amount: 400, entries: [] };
const month = [sabji, movie];
const t = (list: ExpenseWithEntries[]) => totals([{ amount: 5000 }], list.map(calcView), false);

describe('what-if', () => {
  it('leaves everything in when nothing is unticked', () => {
    expect(withoutUnticked(month, new Set())).toBe(month);
    expect(t(month)).toMatchObject({ spent: 900, bank: 4100, available: 3600 });
  });
  it('drops an unticked spend from spent and ABB, but the budget still holds', () => {
    const off = new Set(['a']);
    expect(t(withoutUnticked(month, off))).toMatchObject({ spent: 600, bank: 4400, available: 3600 });
    expect(untickedCount(month, off)).toBe(1);
  });
  it('drops an unticked card completely, budget included', () => {
    const off = new Set(['e1']);
    expect(t(withoutUnticked(month, off))).toMatchObject({ spent: 400, bank: 4600, available: 4600 });
  });
  it('never changes the original data', () => {
    withoutUnticked(month, new Set(['a']));
    expect(sabji.entries).toHaveLength(2);
  });
});

describe('search', () => {
  const names = { cat: () => 'Groceries', own: (id: string | null) => (id === 'akshay' ? 'Akshay' : '') };
  it('matches text case-insensitively and amounts by digits', () => {
    expect(matches('SAB', 'Sabji')).toBe(true);
    expect(matches('₹1,000', 1000)).toBe(true);
    expect(matches('abc', 1000)).toBe(false);
    expect(matches('  ', 'anything')).toBe(true);
  });
  it('finds cards by name, category or a spend inside them', () => {
    expect(searchExpenses(month, 'movie', names.cat, names.own).list).toEqual([movie]);
    expect(searchExpenses(month, 'grocer', names.cat, names.own).list).toHaveLength(2);
    const r = searchExpenses(month, 'onion', names.cat, names.own);
    expect(r.list).toEqual([sabji]);
    expect([...r.entries]).toEqual(['b']);
  });
  it('finds spends by owner', () => {
    const r = searchExpenses(month, 'akshay', names.cat, names.own);
    expect(r.list).toEqual([sabji, movie]);
    expect([...r.entries]).toEqual(['a']);
  });
});
