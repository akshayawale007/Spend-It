'use client';
import { useEffect, useMemo, useState } from 'react';
import { fmt, monthName, monthShort } from '@/lib/format';
import { totals, type Totals } from '@/lib/calc';
import { ownerSpent, spentByOwner, type OwnerFilter } from '@/lib/owners';
import type { ExpenseWithEntries } from '@/lib/types';
import { untickedCount, withoutUnticked } from '@/lib/whatif';
import { calcView, useCategoryLookup, useOwnerLookup, useOwners } from '@/hooks/useMonthData';
import { useApp } from './AppContext';
import { Collapse } from './Collapse';
import { ExpenseCard } from './ExpenseCard';
import { sortExpenses } from './ExpenseList';
import { I } from './icons';
import { SyncNotice } from './SyncNotice';
import { cssVar } from './util';

export function Insights({ incomes, expenses: all, totals: real, closed }: {
  incomes: { amount: number }[]; expenses: ExpenseWithEntries[]; totals: Totals; closed: boolean;
}) {
  const { month, unticked, tickAll } = useApp();
  const owners = useOwners();
  const ownerOf = useOwnerLookup();
  const [owner, setOwner] = useState<OwnerFilter>(null);
  // What-if: unticked cards and spends are left out of every number on this page.
  const offCount = untickedCount(all, unticked);
  const expenses = useMemo(() => withoutUnticked(all, unticked), [all, unticked]);
  const t = useMemo(() => (offCount ? totals(incomes, expenses.map(calcView), closed) : real), [offCount, incomes, expenses, closed, real]);
  const byOwner = spentByOwner(expenses);
  // Forget a filter whose owner was deleted.
  const valid = owner === null || owner === '' || owners.some(o => o.id === owner);
  const f = valid ? owner : null;
  const ownerTotal = f === null ? t.spent : byOwner.get(f) ?? 0;
  const unassigned = byOwner.get('') ?? 0;
  const pick = (k: OwnerFilter) => setOwner(f === k ? null : k);

  /** A summary value; in what-if mode the real figure sits struck through underneath when it differs. */
  const val = (label: string, v: number, was: number, neg = v < 0) => (
    <div>
      <span>{label}</span>
      <b style={neg ? { color: 'var(--over)' } : undefined}>{fmt(v)}</b>
      {offCount > 0 && v !== was && <s className="was">{fmt(was)}</s>}
    </div>
  );

  return (
    <section id="view-ins">
      <div className="page-h"><h1>Insights</h1></div>
      <SyncNotice gap="bottom" />
      <div className={offCount ? 'ins-card glass sum-card whatif' : 'ins-card glass sum-card'}>
        {offCount > 0 && (
          <div className="whatif-bar" role="status">
            <span className="wi-tag">What-if</span>
            <span className="wi-n">{offCount} unticked</span>
            <button type="button" className="wi-reset" onClick={tickAll}><I.restore /> Tick all</button>
          </div>
        )}
        <div className="sum3 sum4">
          {val('Income', t.funds, real.funds)}
          {val('Spent', t.spent, real.spent, false)}
          {val(closed ? 'Left' : 'Available', t.available, real.available)}
          {val('ABB', t.bank, real.bank)}
        </div>
      </div>
      {(t.spent > 0 || offCount > 0) && owners.length > 0 && (
        <div className="ins-card glass">
          <div className="ins-title">Spent by owner</div>
          <div className="own-filter" role="group" aria-label="Filter by owner">
            <button type="button" className="chip plain" aria-pressed={f === null} onClick={() => setOwner(null)}>
              All <b>{fmt(t.spent)}</b>
            </button>
            {owners.map(o => (
              <button key={o.id} type="button" className="chip" style={cssVar(o.color)} aria-pressed={f === o.id} onClick={() => pick(o.id)}>
                <span className="dot" />{o.name} <b>{fmt(byOwner.get(o.id) ?? 0)}</b>
              </button>
            ))}
            {(unassigned > 0 || f === '') && (
              <button type="button" className="chip" style={cssVar(ownerOf(null).color)} aria-pressed={f === ''} onClick={() => pick('')}>
                <span className="dot" />{ownerOf(null).name} <b>{fmt(unassigned)}</b>
              </button>
            )}
          </div>
        </div>
      )}
      {real.spent || offCount ? (
        <div className="ins-card glass cat-card">
          {ownerTotal > 0 || offCount > 0
            ? <SpendByCategory expenses={expenses} listFrom={all} total={ownerTotal} owner={f}
                title={f === null ? undefined : `${ownerOf(f || null).name} · spent by category`} />
            : <p className="hint">Nothing spent by {ownerOf(f || null).name} in {monthName(month)}.</p>}
        </div>
      ) : (
        <div className="empty glass">
          <div className="empty-art"><I.pie size={28} /></div>
          <h3>No spending in {monthName(month)} yet</h3>
          <p>Once you log spends, you’ll see where your money goes, by category.</p>
        </div>
      )}
    </section>
  );
}

/** "Spent by category": donut + one row per category. Used on Insights and the wide-desktop side column. */
export function SpendByCategory({ expenses, listFrom, total, title = 'Spent by category', owner = null }: {
  expenses: ExpenseWithEntries[]; total: number; title?: string;
  /** Insights what-if: the full month, so unticked cards stay listed (and can be ticked again). */
  listFrom?: ExpenseWithEntries[];
  /** Only count spends by this owner ('' = unassigned). Budgets are hidden then: they have no owner split. */
  owner?: OwnerFilter;
}) {
  const { month, tab, catFilter, setCatFilter } = useApp();
  const catOf = useCategoryLookup();
  const [drawn, setDrawn] = useState(false);
  const [openCat, setOpenCat] = useState<string | null>(null);
  // Insights: tapping a category expands its expenses under it. Expenses tab: it filters the list (tap again to clear).
  const inline = tab !== 'exp';

  useEffect(() => {
    setDrawn(false);
    let r2 = 0;
    const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setDrawn(true)); });
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
  }, [month]);

  const by = new Map<string, number>(), bud = new Map<string, number>();
  const key = (id: string | null) => id ?? '';
  for (const e of expenses) {
    const v = ownerSpent(e, owner);
    if (v > 0) by.set(key(e.category_id), (by.get(key(e.category_id)) ?? 0) + v);
    if (owner === null) bud.set(key(e.category_id), (bud.get(key(e.category_id)) ?? 0) + (e.kind === 'expected' ? e.amount : 0));
  }
  // What-if: keep categories whose cards were all unticked, so they can be ticked back.
  const listed = listFrom ?? expenses;
  const counted = new Set(expenses.map(e => e.id));
  const offCats = listed.filter(e => !counted.has(e.id)).map(e => key(e.category_id));
  const ids = [...new Set([...by.keys(), ...bud.keys(), ...offCats])]
    .sort((a, b) => (by.get(b) ?? 0) - (by.get(a) ?? 0) || (bud.get(b) ?? 0) - (bud.get(a) ?? 0));

  const r = 42, circ = 2 * Math.PI * r;
  const spentIds = ids.filter(id => by.get(id));
  const gap = spentIds.length > 1 ? 1.2 : 0;
  let acc = 0;
  const segs = spentIds.map(id => {
    const frac = by.get(id)! / total, len = Math.max(0, frac * circ - gap);
    const offset = -acc;
    acc += frac * circ;
    return (
      <circle key={id} cx="50" cy="50" r={r} stroke={catOf(id || null).color}
        strokeDasharray={drawn ? `${len} ${circ - len}` : `0 ${circ}`} strokeDashoffset={offset} />
    );
  });

  return (
    <>
      <div className="ins-title">{title}</div>
      <div className="donut-wrap">
        <svg className="donut" viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r={r} stroke="rgba(28,31,42,.06)" />
          {segs}
        </svg>
        <div className="donut-c"><small>{monthShort(month)} spent</small><b>{fmt(total)}</b></div>
      </div>
      <div className={!inline && catFilter !== null ? 'crows filtering' : 'crows'}>
        {ids.map(id => {
          const c = catOf(id || null), v = by.get(id) ?? 0, b = bud.get(id) ?? 0;
          const pct = total ? Math.round((v / total) * 100) : 0;
          const isOpen = inline && openCat === id;
          return (
            <div key={id} className="crow-wrap">
              <button className="crow" style={cssVar(c.color)}
                aria-pressed={inline ? undefined : catFilter === id}
                aria-expanded={inline ? isOpen : undefined} aria-controls={inline ? `cat-${id || 'none'}` : undefined}
                title={inline ? undefined : `Show only ${c.name} expenses`}
                onClick={() => inline ? setOpenCat(isOpen ? null : id) : setCatFilter(catFilter === id ? null : id)}>
                <div className="crow-t"><i /><span className="nm">{c.name}</span><b>{fmt(v)}</b><em>{pct}%</em>{inline && <I.chevSm />}</div>
                <div className="crow-bar"><span style={{ width: drawn ? `${total ? (v / total) * 100 : 0}%` : 0 }} /></div>
                {owner === null && bud.has(id) && (
                  <div className="crow-sub">
                    {/* No card in this category has a fixed budget: nothing to compare against. */}
                    {fmt(v)} of {b > 0 ? fmt(b) : '₹—'} expected
                    {b > 0 && v > b && <> · <span style={{ color: 'var(--over)' }}>{fmt(v - b)} over</span></>}
                  </div>
                )}
              </button>
              {inline && (
                <Collapse open={isOpen} id={`cat-${id || 'none'}`}>
                  <div className="crow-list">
                    {sortExpenses(listed.filter(e => (e.category_id ?? '') === id && (owner === null || ownerSpent(e, owner) > 0 || !counted.has(e.id))))
                      .map(e => <ExpenseCard key={e.id} e={e} canLog={false} tickable={!!listFrom} />)}
                  </div>
                </Collapse>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
