import { describe, expect, it } from 'vitest';
import { backupToData, dataToBackup, parseBackup } from '@/lib/backup';
import { totals } from '@/lib/calc';
import { applyOps } from '@/lib/ops';
import { monthView } from '@/hooks/useMonthData';

const prototypeFile = {
  v: 1,
  categories: [
    { id: 'fuel', name: 'Fuel', color: '#F8C78A' },
    { id: 'food', name: 'Food & Dining', color: '#F7A68C' },
    { id: 'other', name: 'Other', color: '#D9C2A3' },
  ],
  months: {
    '2026-11': {
      incomes: [{ id: 'i1', name: 'Opening balance', amount: 20000, date: '', carry: '' }],
      expenses: [
        {
          id: 'e1', name: 'Petrol', categoryId: 'fuel', kind: 'expected', amount: 2000, date: '', note: '', done: false,
          createdAt: 1793679275000,
          entries: [
            { id: 'x1', amount: 500, date: '2026-11-03', note: '' },
            { id: 'x2', amount: 500, date: '2026-11-12', note: 'full tank' },
          ],
        },
        { id: 'e2', name: 'Zomato', categoryId: 'food', kind: 'spent', amount: 650, date: '2026-11-04', note: '', done: true, createdAt: 1793679276000, entries: [] },
        { id: 'e3', name: 'Mystery', categoryId: 'gone', kind: 'spent', amount: 10, date: '', note: '', createdAt: 1793679277000, entries: [] },
      ],
    },
  },
};

let n = 0;
const seqId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;

describe('backup import', () => {
  it('rejects junk', () => {
    expect(parseBackup('nope')).toBeNull();
    expect(parseBackup('{"foo":1}')).toBeNull();
  });

  it('counts months and expenses', () => {
    const p = parseBackup(JSON.stringify(prototypeFile))!;
    expect(p.monthCount).toBe(1);
    expect(p.expenseCount).toBe(3);
  });

  it('maps ids, dates and categories', () => {
    const p = parseBackup(JSON.stringify(prototypeFile))!;
    const d = backupToData(p.backup, seqId, Date.UTC(2026, 10, 3));
    expect(d.categories.map(c => c.name)).toEqual(['Fuel', 'Food & Dining', 'Other']);
    expect(d.categories.every(c => /^[0-9a-f-]{36}$/.test(c.id))).toBe(true);
    const petrol = d.expenses.find(e => e.name === 'Petrol')!;
    expect(petrol.category_id).toBe(d.categories[0].id);
    expect(petrol.date).toBeNull();
    expect(petrol.created_at).toBe(new Date(1793679275000).toISOString());
    expect(d.entries.filter(x => x.expense_id === petrol.id)).toHaveLength(2);
    expect(d.incomes[0].date).toBeNull();
    // unknown category → Other
    expect(d.expenses.find(e => e.name === 'Mystery')!.category_id).toBe(d.categories[2].id);
  });

  it('reproduces Available, ABB and gauge values', () => {
    const p = parseBackup(JSON.stringify(prototypeFile))!;
    const d = backupToData(p.backup, seqId);
    const v = monthView(d, '2026-11', new Date(2026, 10, 3));
    expect(v.totals.available).toBe(20000 - 2000 - 650 - 10);
    expect(v.totals.bank).toBe(20000 - 1000 - 650 - 10);
    const petrol = v.expenses.find(e => e.name === 'Petrol')!;
    expect(totals([], [petrol], false).spent).toBe(1000);
  });

  it('round-trips through export', () => {
    const p = parseBackup(JSON.stringify(prototypeFile))!;
    const d = backupToData(p.backup, seqId);
    const again = parseBackup(JSON.stringify(dataToBackup(d)))!;
    const d2 = backupToData(again.backup, seqId);
    const t1 = monthView(d, '2026-11').totals, t2 = monthView(d2, '2026-11').totals;
    expect(t2).toEqual(t1);
  });
});

describe('ops', () => {
  it('cascades expense deletes to entries locally', () => {
    const p = parseBackup(JSON.stringify(prototypeFile))!;
    const d = backupToData(p.backup, seqId);
    const petrol = d.expenses.find(e => e.name === 'Petrol')!;
    const after = applyOps(d, [{ t: 'delete', table: 'expenses', ids: [petrol.id] }]);
    expect(after.expenses).toHaveLength(2);
    expect(after.entries).toHaveLength(0);
  });

  it('upserts by id', () => {
    const d = { owners: [], categories: [], incomes: [], expenses: [], entries: [] };
    const row = { id: 'a', month_key: '2026-11', name: 'Salary', amount: 1, date: null, created_at: '' };
    const d1 = applyOps(d, [{ t: 'upsert', table: 'incomes', rows: [row] }]);
    const d2 = applyOps(d1, [{ t: 'upsert', table: 'incomes', rows: [{ ...row, amount: 5 }] }]);
    expect(d2.incomes).toEqual([{ ...row, amount: 5 }]);
  });
});
