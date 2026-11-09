// Pure business rules from spec §5. Everything is strictly per month.
import { curKey, round2 } from './format';

export type CalcExpense = {
  kind: 'expected' | 'spent';
  amount: number;
  entries: { amount: number }[];
};

export const entriesTotal = (e: CalcExpense) => round2(e.entries.reduce((a, x) => a + (Number(x.amount) || 0), 0));

export const spentOf = (e: CalcExpense) => (e.kind === 'spent' ? round2(e.amount) : entriesTotal(e));

/** An expected expense with no fixed budget (amount 0): only logged spends count. */
export const isOpenBudget = (e: CalcExpense) => e.kind === 'expected' && !(e.amount > 0);

export const isFull = (e: CalcExpense) => e.kind === 'expected' && e.amount > 0 && entriesTotal(e) >= e.amount;

export const isDone = (e: CalcExpense) => e.kind === 'spent' || isFull(e);

/** A month is closed once the user's local date is in a later month. */
export const isClosed = (monthKey: string, now = new Date()) => monthKey < curKey(now);

export function deduction(e: CalcExpense, closed: boolean) {
  if (e.kind === 'spent') return round2(e.amount);
  const s = entriesTotal(e);
  return closed ? s : Math.max(round2(e.amount), s);
}

/** Gauge percentage (expected only); may exceed 100. No fixed budget → always 100. */
export const gaugePct = (e: CalcExpense) => (e.amount > 0 ? (entriesTotal(e) / e.amount) * 100 : 100);

export type Totals = {
  funds: number;
  spent: number;
  /** ABB — actual bank balance: funds − totalSpent */
  bank: number;
  /** Σ budgets of expected items */
  budget: number;
  /** The big number: funds − Σ deduction */
  available: number;
};

export function totals(incomes: { amount: number }[], expenses: CalcExpense[], closed: boolean): Totals {
  const funds = round2(incomes.reduce((a, i) => a + (Number(i.amount) || 0), 0));
  let spent = 0, deduct = 0, budget = 0;
  for (const e of expenses) {
    deduct += deduction(e, closed);
    spent += spentOf(e);
    if (e.kind === 'expected') budget += e.amount;
  }
  return {
    funds,
    spent: round2(spent),
    bank: round2(funds - spent),
    budget: round2(budget),
    available: round2(funds - deduct),
  };
}
