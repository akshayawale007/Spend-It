'use client';
import { useRef, useState } from 'react';
import { deleteEntry, saveEntry } from '@/lib/actions';
import { fmt, parseAmt } from '@/lib/format';
import { store } from '@/lib/store';
import { DateField } from './DateField';
import { useToast } from './Toast';
import { shake } from './util';

export function EntrySheet({ entryId, close }: { entryId: string; close: () => void }) {
  const toast = useToast();
  const [snap] = useState(() => {
    const d = store.get().data;
    const en = d.entries.find(x => x.id === entryId);
    return { en, exp: en && d.expenses.find(e => e.id === en.expense_id) };
  });
  const { en, exp } = snap;
  const [amount, setAmount] = useState(en ? String(en.amount) : '');
  const [date, setDate] = useState(en?.date ?? '');
  const [note, setNote] = useState(en?.note ?? '');
  const amtRef = useRef<HTMLInputElement>(null);
  if (!en || !exp) return <p className="hint">This spend no longer exists.</p>;

  return (
    <>
      <div className="sh-head"><h3>Edit spend</h3><p className="sub">Under {exp.name}</p></div>
      <form noValidate autoComplete="off" onSubmit={ev => {
        ev.preventDefault();
        const a = parseAmt(amount);
        if (!(a > 0)) return shake(amtRef.current);
        saveEntry({ ...en, amount: a, date: date || en.date, note: note.trim() });
        close();
        toast('Spend updated');
      }}>
        <div className="field">
          <div className="flabel">Amount</div>
          <div className="amount-wrap"><span>₹</span>
            <input ref={amtRef} className="input" name="amount" inputMode="decimal" aria-label="Amount" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
        </div>
        <div className="field"><div className="flabel">Date</div><DateField className="input" value={date} onChange={setDate} /></div>
        <div className="field">
          <div className="flabel">Note <span className="opt">optional</span></div>
          <input className="input" name="note" aria-label="Note" value={note} onChange={e => setNote(e.target.value)} />
        </div>
        <button className="btn-primary" type="submit">Save</button>
        <button type="button" className="btn-text danger" onClick={() => {
          const undo = deleteEntry(en);
          close();
          toast(`Removed ${fmt(en.amount)} from ${exp.name}`, undo);
        }}>Delete this spend</button>
      </form>
    </>
  );
}
