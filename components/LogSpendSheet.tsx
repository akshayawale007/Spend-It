'use client';
import { useMemo, useRef, useState } from 'react';
import { newId, saveEntry, stamp } from '@/lib/actions';
import { entriesTotal } from '@/lib/calc';
import { defaultDate, fmt, monthLabel, parseAmt } from '@/lib/format';
import { matches } from '@/lib/search';
import type { ExpenseWithEntries } from '@/lib/types';
import { useCategoryLookup } from '@/hooks/useMonthData';
import { useApp } from './AppContext';
import { DateField } from './DateField';
import { I } from './icons';
import { liveOwner, OwnerPicker, ownerMissing } from './OwnerPicker';
import { useToast } from './Toast';
import { cssVar, shake } from './util';

/**
 * Log a spend from the Spends tab under one of the month's existing expected cards.
 * New cards are only made on the Expenses tab.
 */
export function LogSpendSheet({ expenses, close }: { expenses: ExpenseWithEntries[]; close: () => void }) {
  const { month, setTab } = useApp();
  const toast = useToast();
  const catOf = useCategoryLookup();
  const cards = useMemo(
    () => expenses.filter(e => e.kind === 'expected').sort((a, b) => a.name.localeCompare(b.name)),
    [expenses],
  );
  const [cardId, setCardId] = useState<string | null>(null);
  const [find, setFind] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => defaultDate(month));
  const [note, setNote] = useState('');
  const [owner, setOwner] = useState<string | null>(null);
  const [ownerTouched, setOwnerTouched] = useState(false);
  const amtRef = useRef<HTMLInputElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const ownRef = useRef<HTMLDivElement>(null);

  if (!cards.length) {
    return (
      <>
        <div className="sh-head"><h3>Log spend</h3><p className="sub">{monthLabel(month)}</p></div>
        <p className="hint">Spends are logged under an <b>expected</b> expense card, and {monthLabel(month)} has none yet. Create one on the Expenses tab first.</p>
        <button className="btn-primary" type="button" onClick={() => { setTab('exp'); close(); }}>Go to Expenses</button>
      </>
    );
  }

  const card = cards.find(c => c.id === cardId) ?? null;
  const shown = cards.filter(c => c.id === cardId || matches(find, c.name, catOf(c.category_id).name));
  const pick = (c: ExpenseWithEntries) => {
    setCardId(c.id);
    // The card's default owner, unless one was already chosen by hand.
    if (!ownerTouched) setOwner(liveOwner(c.owner_id));
  };

  return (
    <>
      <div className="sh-head"><h3>Log spend</h3><p className="sub">{monthLabel(month)}</p></div>
      <form noValidate autoComplete="off" onSubmit={ev => {
        ev.preventDefault();
        if (!card) { toast('Pick the expense card it’s for'); return shake(cardsRef.current); }
        const a = parseAmt(amount);
        if (!(a > 0)) return shake(amtRef.current);
        if (ownerMissing(owner)) { toast('Pick who this spend is for'); return shake(ownRef.current); }
        saveEntry({ id: newId(), expense_id: card.id, owner_id: liveOwner(owner), amount: a, date: date || defaultDate(month), note: note.trim(), created_at: stamp() });
        const after = entriesTotal(card) + a;
        close();
        toast(card.amount > 0 && after > card.amount
          ? `Logged ${fmt(a)} · ${card.name} is ${fmt(after - card.amount)} over budget`
          : `Logged ${fmt(a)} under ${card.name}`);
      }}>
        <div className="field">
          <div className="flabel">Expense card</div>
          {cards.length > 6 && (
            <div className="pick-find">
              <I.search />
              <input placeholder="Find a card" aria-label="Find an expense card" value={find} onChange={e => setFind(e.target.value)} />
            </div>
          )}
          <div className="card-pick" ref={cardsRef} role="radiogroup" aria-label="Expense card" tabIndex={-1}>
            {shown.map(c => {
              const cat = catOf(c.category_id);
              return (
                <button key={c.id} type="button" className="chip" style={cssVar(cat.color)} role="radio"
                  aria-checked={c.id === cardId} aria-pressed={c.id === cardId} onClick={() => pick(c)}>
                  <span className="dot" />{c.name}
                </button>
              );
            })}
            {!shown.length && <span className="hint">No card matches “{find.trim()}”.</span>}
          </div>
          {card && (
            <p className="pick-note">
              {catOf(card.category_id).name} · {fmt(entriesTotal(card))} spent{card.amount > 0 ? ` of ${fmt(card.amount)}` : ''}
            </p>
          )}
        </div>
        <div className="field">
          <div className="flabel">Amount</div>
          <div className="amount-wrap"><span>₹</span>
            <input ref={amtRef} className="input" name="amount" inputMode="decimal" placeholder="0" aria-label="Amount"
              value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
        </div>
        <div className="field"><div className="flabel">Date</div><DateField className="input" value={date} onChange={setDate} /></div>
        <div className="field">
          <div className="flabel">Owner</div>
          <OwnerPicker value={owner} onChange={id => { setOwner(id); setOwnerTouched(true); }} required pickRef={ownRef} />
        </div>
        <div className="field">
          <div className="flabel">Note <span className="opt">optional</span></div>
          <input className="input" name="note" aria-label="Note" value={note} onChange={e => setNote(e.target.value)} />
        </div>
        <button className="btn-primary" type="submit">Log spend</button>
      </form>
    </>
  );
}
