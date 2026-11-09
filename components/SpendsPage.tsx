'use client';
import { useMemo, useState } from 'react';
import { fmt, fullDate, monthName } from '@/lib/format';
import { matches } from '@/lib/search';
import type { ExpenseWithEntries } from '@/lib/types';
import { useCategoryLookup, useOwnerLookup } from '@/hooks/useMonthData';
import { useApp } from './AppContext';
import { EntrySheet } from './EntrySheet';
import { ExpenseSheet } from './ExpenseSheet';
import { I } from './icons';
import { LogSpendSheet } from './LogSpendSheet';
import { SearchBox, SearchToggle } from './SearchBox';
import { useSheets } from './Sheet';
import { SyncNotice } from './SyncNotice';
import { cssVar } from './util';

type Row = {
  id: string;
  /** Set for a spend logged under an expected card; null for a one-off spent card. */
  entryId: string | null;
  expense: ExpenseWithEntries;
  amount: number;
  date: string;
  note: string;
  ownerId: string | null;
  loggedAt: string;
};

/** Every spend in the month, newest first: logged spends plus one-off "spent" cards. */
export function monthSpends(expenses: ExpenseWithEntries[]): Row[] {
  const rows: Row[] = [];
  for (const e of expenses) {
    if (e.kind === 'spent') {
      rows.push({ id: e.id, entryId: null, expense: e, amount: e.amount, date: e.date ?? `${e.month_key}-01`, note: e.note, ownerId: e.owner_id ?? null, loggedAt: e.created_at });
    } else {
      for (const x of e.entries)
        rows.push({ id: x.id, entryId: x.id, expense: e, amount: x.amount, date: x.date, note: x.note, ownerId: x.owner_id ?? null, loggedAt: x.created_at });
    }
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date) || b.loggedAt.localeCompare(a.loggedAt));
}

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const dayName = (iso: string) => WEEKDAY[new Date(`${iso}T12:00:00`).getDay()] ?? '';

export function SpendsPage({ expenses }: { expenses: ExpenseWithEntries[] }) {
  const { month } = useApp();
  const { open } = useSheets();
  const catOf = useCategoryLookup();
  const ownerOf = useOwnerLookup();
  const all = useMemo(() => monthSpends(expenses), [expenses]);
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState('');
  const closeSearch = () => { setSearching(false); setQ(''); };
  // Search the note, card, category, owner and amount.
  const rows = all.filter(r => matches(q, r.note, r.expense.name, catOf(r.expense.category_id).name, r.ownerId && ownerOf(r.ownerId).name, r.amount));
  const total = rows.reduce((a, r) => a + r.amount, 0);
  const logSpend = () => open(close => <LogSpendSheet expenses={expenses} close={close} />, { label: 'Log spend' });

  const days: { date: string; rows: Row[] }[] = [];
  for (const r of rows) {
    const last = days[days.length - 1];
    if (last && last.date === r.date) last.rows.push(r);
    else days.push({ date: r.date, rows: [r] });
  }

  const edit = (r: Row) => r.entryId
    ? open(close => <EntrySheet entryId={r.entryId!} close={close} />, { label: 'Edit spend' })
    : open(close => <ExpenseSheet month={month} expenseId={r.expense.id} close={close} />, { label: 'Edit expense' });

  return (
    <section id="view-spn">
      <div className="page-h"><h1>Spends</h1></div>
      <SyncNotice gap="bottom" />
      {!all.length ? (
        <div className="empty glass">
          <div className="empty-art"><I.wallet /></div>
          <h3>No spends in {monthName(month)} yet</h3>
          <p>Everything you log under an expense shows up here, newest first.</p>
          <div className="row"><button className="ghost" onClick={logSpend}><I.plusSm /> Log spend</button></div>
        </div>
      ) : (
        <>
          <div className="list-h">
            <h2>{rows.length} spend{rows.length !== 1 ? 's' : ''}</h2>
            <span>{fmt(total)}</span>
            <SearchToggle open={searching} onToggle={() => (searching ? closeSearch() : setSearching(true))} />
          </div>
          {searching && <SearchBox value={q} onChange={setQ} onClose={closeSearch} placeholder="Search spends" />}
          {!rows.length && <p className="search-empty">No spends match “{q.trim()}”.</p>}
          {days.map(d => (
            <div key={d.date} className="spn-day">
              <div className="spn-dh">
                <b>{fullDate(d.date)}</b><span>{dayName(d.date)}</span>
                <em>{fmt(d.rows.reduce((a, r) => a + r.amount, 0))}</em>
              </div>
              <div className="spn-list glass">
                {d.rows.map(r => {
                  const c = catOf(r.expense.category_id);
                  const o = r.ownerId ? ownerOf(r.ownerId) : null;
                  return (
                    <button key={r.id} className="spn-row" style={cssVar(c.color)} onClick={() => edit(r)}>
                      <span className="spn-main">
                        <span className="spn-name">{r.note || r.expense.name}</span>
                        {r.note && <span className="spn-note">{r.expense.name}</span>}
                        <span className="spn-tags">
                          <span className="tag">{c.name}</span>
                          {o && <span className="tag" style={cssVar(o.color)}>{o.name}</span>}
                        </span>
                      </span>
                      <b className="spn-amt">{fmt(r.amount)}</b>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </>
      )}
      <button className="fab fab-log" onClick={logSpend} aria-label="Log spend" title="Log spend"><I.plus /></button>
    </section>
  );
}
