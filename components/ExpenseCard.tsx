'use client';
import { useEffect, useRef, useState } from 'react';
import { saveEntry, newId, stamp } from '@/lib/actions';
import { entriesTotal, gaugePct, isDone, isFull } from '@/lib/calc';
import { defaultDate, fmt, fullDate, parseAmt } from '@/lib/format';
import type { ExpenseWithEntries } from '@/lib/types';
import { useCategoryLookup } from '@/hooks/useMonthData';
import { useApp } from './AppContext';
import { Collapse } from './Collapse';
import { DateField } from './DateField';
import { EntrySheet } from './EntrySheet';
import { ExpenseSheet } from './ExpenseSheet';
import { Gauge } from './Gauge';
import { I } from './icons';
import { useSheets } from './Sheet';
import { useToast } from './Toast';
import { cssVar, shake } from './util';

export function ExpenseCard({ e }: { e: ExpenseWithEntries }) {
  const { month, isExpanded, setExpanded } = useApp();
  const cat = useCategoryLookup()(e.category_id);
  const { open } = useSheets();
  const open_ = isExpanded(e.id);
  const calc = e.kind === 'spent' ? { ...e, entries: [] } : e;
  const done = isDone(calc);
  const full = isFull(calc);
  const card = useRef<HTMLElement>(null);
  const wasFull = useRef(full);

  // Gentle pop when a budget reaches 100%.
  useEffect(() => {
    if (full && !wasFull.current && card.current) {
      const el = card.current;
      el.classList.remove('pop');
      void el.offsetWidth;
      el.classList.add('pop');
    }
    wasFull.current = full;
  }, [full]);

  const edit = (toKind?: 'expected') =>
    open(close => <ExpenseSheet month={month} expenseId={e.id} toKind={toKind} close={close} />, { label: 'Edit expense' });

  const head = (vals: React.ReactNode, lead: React.ReactNode) => (
    <button className="card-main" aria-expanded={open_} onClick={() => setExpanded(e.id, !open_)}>
      <span className="info">
        <span className="top-line">
          <span className="name">{e.name}</span>
          {done && <I.okFull />}
          <span className="tag">{cat.name}</span>
        </span>
        <span className="vals">{vals}</span>
      </span>
      {lead}
      <I.chev />
    </button>
  );

  if (e.kind === 'spent') {
    return (
      <article className="card" style={cssVar(cat.color)} ref={card}>
        {head(
          <>
            <span className="v"><span>Spent</span><b>{fmt(e.amount)}</b></span>
            <span className="v"><span>Date</span><b className="dt">{fullDate(e.date) || '—'}</b></span>
          </>,
          <span className="lead"><span className="spent-ic"><I.check /></span></span>,
        )}
        <Collapse open={open_}>
          {e.note && <div className="note-txt">{e.note}</div>}
          <div className="card-actions" style={{ marginTop: 0 }}>
            <button className="ghost" onClick={() => edit()}><I.pencil /> Edit</button>
            <button className="ghost" onClick={() => edit('expected')}><I.restore /> Make it expected</button>
          </div>
        </Collapse>
      </article>
    );
  }

  const s = entriesTotal(e);
  const over = s > e.amount;
  return (
    <article className="card" style={cssVar(cat.color)} ref={card}>
      {head(
        <>
          <span className="v"><span>Expected</span><b>{fmt(e.amount)}</b></span>
          <span className={over ? 'v over' : 'v'}><span>Spent</span><b>{fmt(s)}</b></span>
        </>,
        <Gauge id={e.id} pct={gaugePct(e)} />,
      )}
      <Collapse open={open_}>
        {e.note && <div className="note-txt">{e.note}</div>}
        {e.entries.length > 0 && (
          <div className="entries">
            {e.entries.map(x => (
              <button key={x.id} className="entry"
                onClick={() => open(close => <EntrySheet entryId={x.id} close={close} />, { label: 'Edit spend' })}>
                <span className="d">{fullDate(x.date) || '—'}</span>
                <span className="n">{x.note}</span>
                <span className="a">{fmt(x.amount)}</span>
              </button>
            ))}
          </div>
        )}
        <QuickLog e={e} month={month} onEdit={() => edit()} />
      </Collapse>
    </article>
  );
}

function QuickLog({ e, month, onEdit }: { e: ExpenseWithEntries; month: string; onEdit: () => void }) {
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => defaultDate(month));
  const [note, setNote] = useState('');
  const amtRef = useRef<HTMLInputElement>(null);

  return (
    <form className="quick" autoComplete="off" noValidate onSubmit={ev => {
      ev.preventDefault();
      const a = parseAmt(amount);
      if (!(a > 0)) return shake(amtRef.current);
      const before = isFull(e);
      saveEntry({ id: newId(), expense_id: e.id, amount: a, date: date || defaultDate(month), note: note.trim(), created_at: stamp() });
      const after = entriesTotal(e) + a;
      setAmount(''); setNote(''); setDate(defaultDate(month));
      if (!before && after >= e.amount)
        toast(after > e.amount ? `${e.name} is over budget by ${fmt(after - e.amount)}` : `${e.name} budget fully used`);
      else toast(`Logged ${fmt(a)} under ${e.name}`);
    }}>
      <div className="qamt"><span>₹</span>
        <input ref={amtRef} className="qin" name="amount" inputMode="decimal" placeholder="Amount" aria-label="Amount spent"
          value={amount} onChange={ev => setAmount(ev.target.value)} />
      </div>
      <DateField className="qin" value={date} onChange={setDate} />
      <input className="qin qnote" name="note" placeholder="Note (optional)" aria-label="Note" value={note} onChange={ev => setNote(ev.target.value)} />
      <button className="btn-ink" type="submit"><I.plusSm /> Log spend</button>
      <button className="ghost qedit" type="button" onClick={onEdit}><I.pencil /> Edit</button>
    </form>
  );
}
