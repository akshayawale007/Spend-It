'use client';
import { useEffect, useState } from 'react';
import { spentOf } from '@/lib/calc';
import { fmt, monthName, monthShort } from '@/lib/format';
import type { Totals } from '@/lib/calc';
import type { ExpenseWithEntries } from '@/lib/types';
import { calcView, useCategoryLookup } from '@/hooks/useMonthData';
import { useApp } from './AppContext';
import { I } from './icons';
import { SyncNotice } from './SyncNotice';
import { cssVar } from './util';

export function Insights({ expenses, totals: t, closed }: { expenses: ExpenseWithEntries[]; totals: Totals; closed: boolean }) {
  const { month } = useApp();

  return (
    <section id="view-ins">
      <div className="page-h"><h1>Insights</h1></div>
      <SyncNotice gap="bottom" />
      <div className="ins-card glass"><div className="sum3 sum4">
        <div><span>Income</span><b>{fmt(t.funds)}</b></div>
        <div><span>Spent</span><b>{fmt(t.spent)}</b></div>
        <div><span>{closed ? 'Left' : 'Available'}</span><b style={t.available < 0 ? { color: 'var(--over)' } : undefined}>{fmt(t.available)}</b></div>
        <div><span>ABB</span><b style={t.bank < 0 ? { color: 'var(--over)' } : undefined}>{fmt(t.bank)}</b></div>
      </div></div>
      {t.spent ? (
        <div className="ins-card glass cat-card">
          <SpendByCategory expenses={expenses} total={t.spent} />
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
export function SpendByCategory({ expenses, total, title = 'Spent by category' }: {
  expenses: ExpenseWithEntries[]; total: number; title?: string;
}) {
  const { month } = useApp();
  const catOf = useCategoryLookup();
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    setDrawn(false);
    let r2 = 0;
    const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setDrawn(true)); });
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
  }, [month]);

  const by = new Map<string, number>(), bud = new Map<string, number>();
  const key = (id: string | null) => id ?? '';
  for (const e of expenses) {
    const v = spentOf(calcView(e));
    if (v > 0) by.set(key(e.category_id), (by.get(key(e.category_id)) ?? 0) + v);
    if (e.kind === 'expected') bud.set(key(e.category_id), (bud.get(key(e.category_id)) ?? 0) + e.amount);
  }
  const ids = [...new Set([...by.keys(), ...bud.keys()])]
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
      <div className="crows">
        {ids.map(id => {
          const c = catOf(id || null), v = by.get(id) ?? 0, b = bud.get(id) ?? 0;
          const pct = total ? Math.round((v / total) * 100) : 0;
          return (
            <div key={id} className="crow" style={cssVar(c.color)}>
              <div className="crow-t"><i /><span className="nm">{c.name}</span><b>{fmt(v)}</b><em>{pct}%</em></div>
              <div className="crow-bar"><span style={{ width: drawn ? `${total ? (v / total) * 100 : 0}%` : 0 }} /></div>
              {b > 0 && (
                <div className="crow-sub">
                  {fmt(v)} of {fmt(b)} expected
                  {v > b && <> · <span style={{ color: 'var(--over)' }}>{fmt(v - b)} over</span></>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
