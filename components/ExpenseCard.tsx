'use client';
import { useEffect, useRef, useState } from 'react';
import { saveEntry, newId, stamp } from '@/lib/actions';
import { entriesTotal, gaugePct, isDone, isFull } from '@/lib/calc';
import { defaultDate, fmt, fullDate, parseAmt } from '@/lib/format';
import type { ExpenseWithEntries } from '@/lib/types';
import { useCategoryLookup, useOwnerLookup } from '@/hooks/useMonthData';
import { useApp } from './AppContext';
import { Collapse } from './Collapse';
import { DateField } from './DateField';
import { EntrySheet } from './EntrySheet';
import { ExpenseSheet } from './ExpenseSheet';
import { Gauge } from './Gauge';
import { I } from './icons';
import { liveOwner, OwnerPicker, ownerMissing } from './OwnerPicker';
import { useSheets } from './Sheet';
import { useToast } from './Toast';
import { cssVar, shake } from './util';

/**
 * `canLog` = show the quick log form (off on Insights, which only shows Edit).
 * `hits` = spends matching a search, highlighted.
 * `tickable` = Insights what-if: a tick box on the card and on each spend to leave it out of the numbers.
 */
export function ExpenseCard({ e, canLog = true, hits, tickable = false }: {
  e: ExpenseWithEntries; canLog?: boolean; hits?: Set<string>; tickable?: boolean;
}) {
  const { month, isExpanded, setExpanded, unticked, toggleTick } = useApp();
  const cardOff = tickable && unticked.has(e.id);
  const cls = tickable ? (cardOff ? 'card tickable off' : 'card tickable') : 'card';
  const cardTick = tickable && <TickBox on={!cardOff} label={e.name} onToggle={() => toggleTick(e.id)} />;
  const cat = useCategoryLookup()(e.category_id);
  const ownerOf = useOwnerLookup();
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
      <article className={cls} style={cssVar(cat.color)} ref={card}>
        {cardTick}
        {head(
          <>
            <span className="v"><span>Spent</span><b>{fmt(e.amount)}</b></span>
            <span className="v"><span>Date</span><b className="dt">{fullDate(e.date) || '—'}</b></span>
            {e.owner_id && <span className="v"><span>Owner</span><b className="dt">{ownerOf(e.owner_id).name}</b></span>}
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
  const over = e.amount > 0 && s > e.amount;
  return (
    <article className={cls} style={cssVar(cat.color)} ref={card}>
      {cardTick}
      {head(
        <>
          <span className="v"><span>Expected</span><b>{e.amount > 0 ? fmt(e.amount) : '—'}</b></span>
          <span className={over ? 'v over' : 'v'}><span>Spent</span><b>{fmt(s)}</b></span>
        </>,
        <Gauge id={e.id} pct={gaugePct(e)} />,
      )}
      <Collapse open={open_}>
        {e.note && <div className="note-txt">{e.note}</div>}
        {e.entries.length > 0 && (
          <div className="entries">
            {e.entries.map(x => {
              const row = (
                <button key={x.id} className={hits?.has(x.id) ? 'entry hit' : 'entry'}
                  onClick={() => open(close => <EntrySheet entryId={x.id} close={close} />, { label: 'Edit spend' })}>
                  <span className="d">{fullDate(x.date) || '—'}</span>
                  <span className="n">{x.note}</span>
                  {x.owner_id && <span className="tag own" style={cssVar(ownerOf(x.owner_id).color)}>{ownerOf(x.owner_id).name}</span>}
                  <span className="a">{fmt(x.amount)}</span>
                </button>
              );
              if (!tickable) return row;
              const off = cardOff || unticked.has(x.id);
              return (
                <div key={x.id} className={off ? 'entry-row off' : 'entry-row'}>
                  <TickBox on={!off} disabled={cardOff} label={x.note || fmt(x.amount)} onToggle={() => toggleTick(x.id)} />
                  {row}
                </div>
              );
            })}
          </div>
        )}
        {canLog
          ? <QuickLog e={e} month={month} onEdit={() => edit()} />
          : <div className="card-actions"><button className="ghost" onClick={() => edit()}><I.pencil /> Edit</button></div>}
      </Collapse>
    </article>
  );
}

/** Round tick for the Insights what-if. Ticked = counted. */
function TickBox({ on, label, disabled, onToggle }: { on: boolean; label: string; disabled?: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="tickbox" role="checkbox" aria-checked={on} disabled={disabled}
      aria-label={`Count ${label}`} title={on ? 'Untick to leave it out' : 'Tick to count it again'} onClick={onToggle}>
      <I.tick />
    </button>
  );
}

function QuickLog({ e, month, onEdit }: { e: ExpenseWithEntries; month: string; onEdit: () => void }) {
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => defaultDate(month));
  const [note, setNote] = useState('');
  const [owner, setOwner] = useState<string | null>(e.owner_id ?? null);
  // Follow the card's default owner when it's changed in the edit sheet.
  useEffect(() => setOwner(e.owner_id ?? null), [e.owner_id]);
  const amtRef = useRef<HTMLInputElement>(null);
  const ownRef = useRef<HTMLDivElement>(null);

  return (
    <form className="quick" aria-label={`Log a spend under ${e.name}`} autoComplete="off" noValidate onSubmit={ev => {
      ev.preventDefault();
      const a = parseAmt(amount);
      if (!(a > 0)) return shake(amtRef.current);
      if (ownerMissing(owner)) { toast('Pick who this spend is for'); return shake(ownRef.current); }
      const before = isFull(e);
      const ownerId = liveOwner(owner);
      saveEntry({ id: newId(), expense_id: e.id, owner_id: ownerId, amount: a, date: date || defaultDate(month), note: note.trim(), created_at: stamp() });
      const after = entriesTotal(e) + a;
      setAmount(''); setNote(''); setDate(defaultDate(month)); setOwner(e.owner_id ?? null);
      if (e.amount > 0 && !before && after >= e.amount)
        toast(after > e.amount ? `${e.name} is over budget by ${fmt(after - e.amount)}` : `${e.name} budget fully used`);
      else toast(`Logged ${fmt(a)} under ${e.name}`);
    }}>
      <div className="qamt"><span>₹</span>
        <input ref={amtRef} className="qin" name="amount" inputMode="decimal" placeholder="Amount" aria-label="Amount spent"
          value={amount} onChange={ev => setAmount(ev.target.value)} />
      </div>
      <DateField className="qin" value={date} onChange={setDate} />
      <div className="qnote-row">
        <input className="qin qnote" name="note" placeholder="Note (optional)" aria-label="Note" value={note} onChange={ev => setNote(ev.target.value)} />
        <button className="qin qedit" type="button" onClick={onEdit} aria-label={`Edit ${e.name}`} title="Edit expense"><I.pencil /></button>
      </div>
      <div className="qowner"><OwnerPicker value={owner} onChange={setOwner} small required pickRef={ownRef} /></div>
      <button className="btn-log" type="submit">Log spend</button>
    </form>
  );
}
