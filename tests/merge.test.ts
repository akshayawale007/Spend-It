import { describe, expect, it } from 'vitest';
import { hasLocalContent, localToOps } from '@/lib/merge';
import { applyOps } from '@/lib/ops';
import type { Category, Data } from '@/lib/types';

const cat = (id: string, name: string, sort_order = 0): Category => ({ id, name, color: '#F8C78A', sort_order, created_at: '' });

const local: Data = {
  owners: [],
  categories: [cat('l-fuel', 'Fuel', 0), cat('l-pets', 'Pets', 1)],
  incomes: [{ id: 'i1', month_key: '2026-11', name: 'Salary', amount: 50000, date: null, created_at: '' }],
  expenses: [
    { id: 'e1', month_key: '2026-11', name: 'Petrol', category_id: 'l-fuel', owner_id: null, kind: 'expected', amount: 2000, date: null, note: '', created_at: '' },
    { id: 'e2', month_key: '2026-11', name: 'Vet', category_id: 'l-pets', owner_id: null, kind: 'spent', amount: 900, date: '2026-11-02', note: '', created_at: '' },
  ],
  entries: [{ id: 'x1', expense_id: 'e1', owner_id: null, amount: 500, date: '2026-11-03', note: '', created_at: '' }],
};

describe('moving device-only data into an account', () => {
  it('detects whether there is anything to move', () => {
    expect(hasLocalContent(local)).toBe(true);
    expect(hasLocalContent({ owners: [], categories: [cat('a', 'Fuel')], incomes: [], expenses: [], entries: [] })).toBe(false);
    expect(hasLocalContent({ owners: [], categories: [cat('a', 'Pets')], incomes: [], expenses: [], entries: [] })).toBe(true);
  });

  it('reuses account categories by name instead of duplicating them', () => {
    const account: Data = { owners: [], categories: [cat('a-fuel', 'fuel', 0), cat('a-other', 'Other', 1)], incomes: [], expenses: [], entries: [] };
    const merged = applyOps(account, localToOps(local, account.categories));
    expect(merged.categories.map(c => c.name)).toEqual(['fuel', 'Other', 'Pets']);
    expect(merged.categories.find(c => c.name === 'Pets')!.sort_order).toBe(2);
    expect(merged.expenses.find(e => e.id === 'e1')!.category_id).toBe('a-fuel');
    expect(merged.expenses.find(e => e.id === 'e2')!.category_id).toBe('l-pets');
    expect(merged.incomes).toHaveLength(1);
    expect(merged.entries).toHaveLength(1);
  });

  it('is idempotent when replayed', () => {
    const account: Data = { owners: [], categories: [cat('a-fuel', 'Fuel')], incomes: [], expenses: [], entries: [] };
    const ops = localToOps(local, account.categories);
    const once = applyOps(account, ops);
    expect(applyOps(once, ops)).toEqual(once);
  });
});
