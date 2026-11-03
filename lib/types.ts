import type { Database } from './database.types';

// updated_at is stamped by the store on every write, so it's optional on local rows.
type Row<T extends keyof Database['public']['Tables']> =
  Omit<Database['public']['Tables'][T]['Row'], 'user_id' | 'updated_at'> & { updated_at?: string };

export type Category = Row<'categories'>;
export type Income = Row<'incomes'>;
export type Expense = Row<'expenses'>;
export type Entry = Row<'spend_entries'>;
export type Kind = Expense['kind'];

export type TableName = 'categories' | 'incomes' | 'expenses' | 'spend_entries';

export type Data = {
  categories: Category[];
  incomes: Income[];
  expenses: Expense[];
  entries: Entry[];
};

/** An expense with its logged spends attached (what calc.ts works with). */
export type ExpenseWithEntries = Expense & { entries: Entry[] };
