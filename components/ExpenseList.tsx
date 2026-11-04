'use client';
import { copyBudgets } from '@/lib/actions';
import { isDone } from '@/lib/calc';
import { monthName, shiftKey } from '@/lib/format';
import { useStore } from '@/lib/store';
import type { ExpenseWithEntries } from '@/lib/types';
import { calcView, useCategoryLookup } from '@/hooks/useMonthData';
import { useApp } from './AppContext';
import { ExpenseCard } from './ExpenseCard';
import { ExpenseSheet } from './ExpenseSheet';
import { I } from './icons';
import { useSheets } from './Sheet';
import { useToast } from './Toast';
import { cssVar } from './util';

const lastDate = (e: ExpenseWithEntries) =>
  e.kind === 'spent' ? e.date ?? '' : e.entries.reduce((a, x) => (x.date > a ? x.date : a), '');

/** Open expected items first (oldest created first), then done items, newest date first. */
export function sortExpenses(list: ExpenseWithEntries[]) {
  return [...list].sort((a, b) => {
    const da = isDone(calcView(a)) ? 1 : 0, db = isDone(calcView(b)) ? 1 : 0;
    if (da !== db) return da - db;
    if (!da) return a.created_at.localeCompare(b.created_at);
    return lastDate(b).localeCompare(lastDate(a)) || b.created_at.localeCompare(a.created_at);
  });
}

export function ExpenseList({ expenses }: { expenses: ExpenseWithEntries[] }) {
  const { month, catFilter, setCatFilter } = useApp();
  const catOf = useCategoryLookup();
  const { open } = useSheets();
  const toast = useToast();
  const prevK = shiftKey(month, -1);
  const prevCount = useStore(s => s.data.expenses.filter(e => e.month_key === prevK && e.kind === 'expected').length);
  const canCopy = prevCount > 0 && !expenses.some(e => e.kind === 'expected');

  const copyBtn = canCopy && (
    <button className="ghost" onClick={() => {
      const n = copyBudgets(prevK, month);
      toast(`Copied ${n} budget${n > 1 ? 's' : ''} from ${monthName(prevK)}`);
    }}>
      <I.copy /> Copy {prevCount} budget{prevCount > 1 ? 's' : ''} from {monthName(prevK)}
    </button>
  );

  if (!expenses.length) {
    return (
      <section id="list">
        <div className="empty glass">
          <div className="empty-art"><I.wallet /></div>
          <h3>Nothing planned for {monthName(month)} yet</h3>
          <p>Add <b>expected</b> budgets like Rent or Petrol and log spends under them, or add a one-off <b>spent</b> payment.</p>
          <div className="row">
            <button className="ghost" onClick={() => open(close => <ExpenseSheet month={month} close={close} />, { label: 'New expense' })}>
              <I.plusSm /> Add expense
            </button>
            {copyBtn}
          </div>
        </div>
      </section>
    );
  }

  const filterCat = catFilter !== null ? catOf(catFilter || null) : null;
  const items = sortExpenses(catFilter === null ? expenses : expenses.filter(e => (e.category_id ?? '') === catFilter));
  const openCount = items.filter(e => !isDone(calcView(e))).length;
  return (
    <section id="list">
      <div className="list-h">
        <h2>Expenses</h2>
        <span>{items.length} item{items.length !== 1 ? 's' : ''}{openCount ? ` · ${openCount} open` : ''}</span>
      </div>
      {filterCat && (
        <button className="filter-chip" style={cssVar(filterCat.color)} onClick={() => setCatFilter(null)}
          aria-label={`Showing only ${filterCat.name}. Show all expenses`}>
          <i />{filterCat.name}<I.x />
        </button>
      )}
      {filterCat && !items.length && <p className="filter-empty">No {filterCat.name} expenses in {monthName(month)}.</p>}
      {items.map(e => <ExpenseCard key={e.id} e={e} />)}
      {copyBtn && <div className="copy-row">{copyBtn}</div>}
    </section>
  );
}
