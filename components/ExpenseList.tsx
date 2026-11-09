'use client';
import { useEffect, useRef, useState } from 'react';
import { isDone } from '@/lib/calc';
import { monthName } from '@/lib/format';
import { useStore } from '@/lib/store';
import type { ExpenseWithEntries } from '@/lib/types';
import { calcView, useCategories, useCategoryLookup, useOwnerLookup } from '@/hooks/useMonthData';
import { searchExpenses } from '@/lib/search';
import { useApp } from './AppContext';
import { ExpenseCard } from './ExpenseCard';
import { ExpenseSheet } from './ExpenseSheet';
import { I } from './icons';
import { ImportSheet } from './ImportSheet';
import { SearchBox, SearchToggle } from './SearchBox';
import { useSheets } from './Sheet';
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

/** When the card last got money logged: newest log's time, or a one-off spend's creation time. Never logged → ''. */
export const lastLogged = (e: ExpenseWithEntries) =>
  e.kind === 'spent' ? e.created_at : e.entries.reduce((a, x) => (x.created_at > a ? x.created_at : a), '');

/** Most recently logged first; cards with nothing logged go last, newest created first. */
export function sortRecent(list: ExpenseWithEntries[]) {
  return [...list].sort((a, b) => lastLogged(b).localeCompare(lastLogged(a)) || b.created_at.localeCompare(a.created_at));
}

export type SortMode = 'open' | 'recent' | 'category';
const SORTS: { k: SortMode; label: string }[] = [
  { k: 'open', label: 'Open first' },
  { k: 'recent', label: 'Recent' },
  { k: 'category', label: 'Category' },
];
const SORT_KEY = 'spendit:sort';

function useSortMode() {
  const [mode, setMode] = useState<SortMode>('open');
  useEffect(() => {
    try {
      const v = localStorage.getItem(SORT_KEY);
      if (v === 'recent' || v === 'category' || v === 'open') setMode(v);
    } catch { /* ignore */ }
  }, []);
  const set = (m: SortMode) => {
    setMode(m);
    try { localStorage.setItem(SORT_KEY, m); } catch { /* ignore */ }
  };
  return [mode, set] as const;
}

/** Themed sort menu (a native <select> popup can't be styled on desktop). */
function SortMenu({ value, onChange }: { value: SortMode; onChange: (m: SortMode) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div className="sort-wrap" ref={ref}>
      <button type="button" className="sort-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <I.sort /><span>{SORTS.find(x => x.k === value)!.label}</span>
      </button>
      {open && (
        <div className="sort-menu glass" role="menu">
          {SORTS.map(x => (
            <button key={x.k} type="button" role="menuitemradio" aria-checked={x.k === value}
              onClick={() => { onChange(x.k); setOpen(false); }}>
              {x.label}{x.k === value && <I.check />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ExpenseList({ expenses }: { expenses: ExpenseWithEntries[] }) {
  const { month, catFilter, setCatFilter, setExpanded } = useApp();
  const catOf = useCategoryLookup();
  const { open } = useSheets();
  const [sort, setSort] = useSortMode();
  const ownerOf = useOwnerLookup();
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState('');
  const closeSearch = () => { setSearching(false); setQ(''); };
  const catIds = new Set(useCategories().map(c => c.id));
  // Earlier months have cards that can be brought into this one.
  const canImport = useStore(s => s.data.expenses.some(e => e.month_key < month));

  const inCat = catFilter === null ? expenses : expenses.filter(e => (e.category_id ?? '') === catFilter);
  const found = searchExpenses(inCat, q, id => catOf(id).name, id => ownerOf(id).name);
  // Open the cards whose spends matched, so the matching spends are visible.
  const hitKey = [...found.entries].join();
  useEffect(() => {
    if (!hitKey) return;
    for (const e of expenses) if (e.entries.some(x => found.entries.has(x.id))) setExpanded(e.id, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hitKey]);

  const importBtn = canImport && (
    <button className="ghost" onClick={() => open(close => <ImportSheet month={month} close={close} />, { label: 'Import expense cards' })}>
      <I.copy /> Import cards from past months
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
            {importBtn}
          </div>
        </div>
      </section>
    );
  }

  const filterCat = catFilter !== null ? catOf(catFilter || null) : null;
  const shown = found.list;
  const items = sort === 'open' ? sortExpenses(shown) : sortRecent(shown);
  const openCount = items.filter(e => !isDone(calcView(e))).length;

  // Category sort: groups in alphabetical order (uncategorised last), recent first inside each.
  const groups: { id: string; items: ExpenseWithEntries[] }[] = [];
  if (sort === 'category') {
    const m = new Map<string, ExpenseWithEntries[]>();
    for (const e of items) {
      const k = e.category_id && catIds.has(e.category_id) ? e.category_id : '';
      m.set(k, [...(m.get(k) ?? []), e]);
    }
    const name = (k: string) => (k ? catOf(k).name.toLocaleLowerCase() : '￿');
    for (const k of [...m.keys()].sort((a, b) => name(a).localeCompare(name(b)))) groups.push({ id: k, items: m.get(k)! });
  }
  return (
    <section id="list">
      <div className="list-h">
        <h2>Expenses</h2>
        <span>{items.length} item{items.length !== 1 ? 's' : ''}{openCount ? ` · ${openCount} open` : ''}</span>
        <SearchToggle open={searching} onToggle={() => (searching ? closeSearch() : setSearching(true))} />
        <SortMenu value={sort} onChange={setSort} />
      </div>
      {searching && <SearchBox value={q} onChange={setQ} onClose={closeSearch} placeholder="Search expenses and spends" />}
      {q.trim() && !items.length && <p className="search-empty">Nothing matches “{q.trim()}”.</p>}
      {filterCat && (
        <button className="filter-chip" style={cssVar(filterCat.color)} onClick={() => setCatFilter(null)}
          aria-label={`Showing only ${filterCat.name}. Show all expenses`}>
          <i />{filterCat.name}<I.x />
        </button>
      )}
      {filterCat && !items.length && <p className="filter-empty">No {filterCat.name} expenses in {monthName(month)}.</p>}
      {sort === 'category'
        ? groups.map(g => {
          const c = catOf(g.id || null);
          return (
            <div key={g.id || 'none'} className="cat-group">
              {catFilter === null && <div className="group-h" style={cssVar(c.color)}><i />{c.name}<span>{g.items.length}</span></div>}
              {g.items.map(e => <ExpenseCard key={e.id} e={e} hits={found.entries} />)}
            </div>
          );
        })
        : items.map(e => <ExpenseCard key={e.id} e={e} hits={found.entries} />)}
      {importBtn && <div className="copy-row">{importBtn}</div>}
    </section>
  );
}
