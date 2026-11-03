import { describe, expect, it } from 'vitest';
import { deduction, gaugePct, isClosed, isDone, isFull, spentOf, totals, type CalcExpense } from '@/lib/calc';

const expected = (amount: number, spends: number[] = []): CalcExpense => ({ kind: 'expected', amount, entries: spends.map(amount => ({ amount })) });
const spent = (amount: number): CalcExpense => ({ kind: 'spent', amount, entries: [] });

describe('worked example (spec §5)', () => {
  const income = [{ amount: 20000 }];

  it('1. income only', () => {
    const t = totals(income, [], false);
    expect(t.available).toBe(20000);
    expect(t.bank).toBe(20000);
  });

  it('2. expected Petrol ₹2,000 is reserved', () => {
    const t = totals(income, [expected(2000)], false);
    expect(t.available).toBe(18000);
    expect(t.bank).toBe(20000);
  });

  it('3. log ₹500', () => {
    const petrol = expected(2000, [500]);
    const t = totals(income, [petrol], false);
    expect(gaugePct(petrol)).toBe(25);
    expect(t.available).toBe(18000);
    expect(t.bank).toBe(19500);
    expect(t.spent).toBe(500);
  });

  it('4. log another ₹500', () => {
    const petrol = expected(2000, [500, 500]);
    const t = totals(income, [petrol], false);
    expect(gaugePct(petrol)).toBe(50);
    expect(t.available).toBe(18000);
    expect(t.bank).toBe(19000);
  });

  it('5. overspend to ₹2,300 counts in full', () => {
    const petrol = expected(2000, [500, 500, 1300]);
    const t = totals(income, [petrol], false);
    expect(gaugePct(petrol)).toBeCloseTo(115);
    expect(t.available).toBe(17700);
    expect(isFull(petrol)).toBe(true);
    expect(isDone(petrol)).toBe(true);
  });

  it('6. spent Zomato ₹650', () => {
    const t = totals(income, [expected(2000, [500, 500, 1300]), spent(650)], false);
    expect(t.available).toBe(17050);
    // The spec text says ABB ₹18,050, but its own formula gives 20,000 − (2,300 + 650) = 17,050.
    expect(t.bank).toBe(17050);
  });

  it('7. after month end, unused budget is released', () => {
    const exps = [expected(2000, [1500]), spent(650)];
    const open = totals(income, exps, false);
    const closed = totals(income, exps, true);
    expect(open.available).toBe(17350);
    expect(closed.available).toBe(17850);
    expect(closed.available - open.available).toBe(500);
    expect(closed.bank).toBe(open.bank);
  });
});

describe('rules', () => {
  it('empty month is all zero', () => {
    expect(totals([], [], false)).toEqual({ funds: 0, spent: 0, bank: 0, budget: 0, available: 0 });
  });

  it('negative available when more is planned than funded', () => {
    const t = totals([{ amount: 1000 }], [expected(5000)], false);
    expect(t.available).toBe(-4000);
    expect(t.bank).toBe(1000);
  });

  it('deduction per kind', () => {
    expect(deduction(spent(650), false)).toBe(650);
    expect(deduction(spent(650), true)).toBe(650);
    expect(deduction(expected(2000, [500]), false)).toBe(2000);
    expect(deduction(expected(2000, [500]), true)).toBe(500);
    expect(deduction(expected(2000, [2500]), false)).toBe(2500);
  });

  it('spentOf ignores entries on spent items', () => {
    expect(spentOf({ kind: 'spent', amount: 300, entries: [{ amount: 999 }] })).toBe(300);
    expect(spentOf(expected(1000, [100, 200.5]))).toBe(300.5);
  });

  it('auto tick: spent always, expected at 100%', () => {
    expect(isDone(spent(1))).toBe(true);
    expect(isDone(expected(1000, [999.99]))).toBe(false);
    expect(isDone(expected(1000, [1000]))).toBe(true);
  });

  it('avoids float drift', () => {
    expect(totals([{ amount: 0.3 }], [spent(0.1), spent(0.2)], false).bank).toBe(0);
  });

  it('isClosed compares with the local month', () => {
    const now = new Date(2026, 10, 3);
    expect(isClosed('2026-10', now)).toBe(true);
    expect(isClosed('2026-11', now)).toBe(false);
    expect(isClosed('2026-12', now)).toBe(false);
    expect(isClosed('2025-12', now)).toBe(true);
  });
});
