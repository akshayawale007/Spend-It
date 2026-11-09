'use client';
import { useMemo, useState } from 'react';
import { importCards } from '@/lib/actions';
import { fmt, monthLabel, monthName, monthShort } from '@/lib/format';
import { useStore } from '@/lib/store';
import { useCategoryLookup } from '@/hooks/useMonthData';
import { I } from './icons';
import { useToast } from './Toast';
import { cssVar } from './util';

const key = (name: string) => name.trim().toLocaleLowerCase();

/**
 * Pick expense cards from an earlier month and bring them into `month`.
 * Only the cards come over, never the spends logged under them.
 */
export function ImportSheet({ month, close }: { month: string; close: () => void }) {
  const toast = useToast();
  const catOf = useCategoryLookup();
  const expenses = useStore(s => s.data.expenses);

  // Earlier months that have cards, newest first.
  const months = useMemo(
    () => [...new Set(expenses.filter(e => e.month_key < month).map(e => e.month_key))].sort().reverse(),
    [expenses, month],
  );
  const [from, setFrom] = useState(() => months[0] ?? '');
  const here = useMemo(() => new Set(expenses.filter(e => e.month_key === month).map(e => key(e.name))), [expenses, month]);
  const cards = useMemo(
    () => expenses.filter(e => e.month_key === from).sort((a, b) => a.name.localeCompare(b.name)),
    [expenses, from],
  );
  // Everything is ticked, except cards this month already has.
  const fresh = (list: typeof cards) => new Set(list.filter(e => !here.has(key(e.name))).map(e => e.id));
  const [picked, setPicked] = useState<Set<string>>(() => fresh(cards));

  const pickMonth = (k: string) => {
    setFrom(k);
    setPicked(fresh(expenses.filter(e => e.month_key === k)));
  };
  const toggle = (id: string) => setPicked(s => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const allOn = cards.length > 0 && cards.every(e => picked.has(e.id));

  if (!months.length) {
    return (
      <>
        <div className="sh-head"><h3>Import expense cards</h3><p className="sub">Into {monthLabel(month)}</p></div>
        <p className="hint">There are no expense cards in earlier months to import.</p>
        <button className="btn-primary" type="button" onClick={close}>OK</button>
      </>
    );
  }

  const n = cards.filter(e => picked.has(e.id)).length;
  return (
    <>
      <div className="sh-head"><h3>Import expense cards</h3><p className="sub">Into {monthLabel(month)} · without their logged spends</p></div>

      <div className="field">
        <div className="flabel">From</div>
        <div className="cat-scroll" role="radiogroup" aria-label="Month to import from">
          {months.map(k => (
            <button key={k} type="button" className="chip plain" role="radio" aria-checked={k === from} aria-pressed={k === from} onClick={() => pickMonth(k)}>
              {monthShort(k)} {k.slice(0, 4)}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <div className="flabel">
          <span>{cards.length} card{cards.length !== 1 ? 's' : ''} in {monthName(from)}</span>
          <button type="button" className="link-btn" onClick={() => setPicked(allOn ? new Set() : new Set(cards.map(e => e.id)))}>
            {allOn ? 'Select none' : 'Select all'}
          </button>
        </div>
        <div className="imp-list">
          {cards.map(e => {
            const on = picked.has(e.id);
            const dup = here.has(key(e.name));
            const c = catOf(e.category_id);
            return (
              <button key={e.id} type="button" className="imp-row" role="checkbox" aria-checked={on} style={cssVar(c.color)} onClick={() => toggle(e.id)}>
                <span className="tickbox" aria-hidden="true"><I.tick /></span>
                <span className="imp-main">
                  <b>{e.name}</b>
                  <small>
                    <i />{c.name}
                    {dup && <em> · already in {monthShort(month)}</em>}
                  </small>
                </span>
                <span className="imp-amt">
                  {e.amount > 0 ? fmt(e.amount) : '—'}
                  <small>{e.kind === 'spent' ? 'one-off → budget' : e.amount > 0 ? 'budget' : 'no budget'}</small>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <button className="btn-primary" type="button" disabled={!n} onClick={() => {
        const done = importCards(cards.filter(e => picked.has(e.id)).map(e => e.id), month);
        close();
        toast(`Imported ${done} card${done !== 1 ? 's' : ''} from ${monthName(from)}`);
      }}>
        {n ? `Import ${n} card${n !== 1 ? 's' : ''}` : 'Pick cards to import'}
      </button>
    </>
  );
}
